import { createClient } from "@/lib/supabase/server";
import { BladCzatu, rozmowaZGemini, type Wiadomosc } from "@/lib/czat-gemini";
import { instrukcja, KOLEJNOSC, zbudujKontekst, type PomyslWKontekscie } from "@/lib/czat-kontekst";
import { wynikiPomyslow } from "@/lib/pomysly";
import { liveQuotes } from "@/lib/quotes";
import { latestReports, reportById } from "@/lib/reports";

// Czat AI w apce: pytanie + historia rozmowy → odpowiedź Gemini strumieniowo (słowo po słowie).
// AI dostaje dane z najnowszych raportów ze wszystkich zakładek, kursy na żywo i pomysły z wynikami.
// Tylko po zalogowaniu (proxy.ts + sprawdzenie niżej), klucz GEMINI_CHAT_KEY tylko na serwerze.

export const maxDuration = 60;

const MAX_WIADOMOSCI = 16; // ostatnie wiadomości rozmowy wysyłane do AI
const MAX_ZNAKOW = 2000; // długość jednego pytania

const blad = (tekst: string, status: number) => Response.json({ blad: tekst }, { status });

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) return blad("Zaloguj się ponownie.", 401);

  const klucz = process.env.GEMINI_CHAT_KEY?.trim();
  if (!klucz) return blad("Brak klucza AI (GEMINI_CHAT_KEY) w ustawieniach Vercela.", 500);

  const body = (await request.json().catch(() => null)) as { wiadomosci?: unknown; raport?: unknown } | null;
  const wiadomosci: Wiadomosc[] = (Array.isArray(body?.wiadomosci) ? body.wiadomosci : [])
    .filter(
      (w): w is Wiadomosc =>
        (w?.role === "user" || w?.role === "model") && typeof w?.text === "string" && w.text.trim().length > 0,
    )
    .map((w) => ({ role: w.role, text: w.text.slice(0, MAX_ZNAKOW) }))
    .slice(-MAX_WIADOMOSCI);
  if (!wiadomosci.length || wiadomosci[wiadomosci.length - 1].role !== "user") return blad("Brak pytania.", 400);
  // Gemini wymaga, żeby rozmowa zaczynała się od użytkownika
  while (wiadomosci[0]?.role === "model") wiadomosci.shift();

  const raportId = typeof body?.raport === "number" && Number.isInteger(body.raport) ? body.raport : null;

  // Dane apki: raporty z bazy, kursy na żywo i pomysły — równolegle; brak któregoś nie blokuje czatu
  const [raporty, live, pomysly, focus] = await Promise.all([
    latestReports(KOLEJNOSC),
    liveQuotes().catch(() => null),
    wynikiPomyslow().catch(() => null),
    raportId ? reportById(raportId) : Promise.resolve(null),
  ]);
  const pomyslyKontekst: PomyslWKontekscie[] = (pomysly?.wyniki ?? []).map((p) => ({
    created_at: p.created_at,
    tekst: p.tekst,
    kierunek: p.kierunek,
    nazwa: p.nazwa,
    teraz: p.zmiany.teraz?.zmiana ?? null,
    d7: p.zmiany.d7?.zmiana ?? null,
  }));
  const kontekst = zbudujKontekst({ latest: raporty.latest, live, pomysly: pomyslyKontekst, focus });

  try {
    const strumien = await rozmowaZGemini({ klucz, instrukcja: instrukcja(kontekst), wiadomosci });
    return new Response(strumien, {
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  } catch (e) {
    if (e instanceof BladCzatu) return blad(e.message, e.status === 429 ? 429 : 502);
    return blad("AI nie odpowiedziało. Spróbuj za chwilę.", 502);
  }
}
