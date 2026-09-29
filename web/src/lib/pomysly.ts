import { createClient } from "@/lib/supabase/server";
import { policzWyniki, pomyslyZKomentarza, type Pomysl, type WynikPomyslu } from "./pomysly-wyniki";
import type { Instrument } from "./reports";
import { liveQuotes, SPOLKI } from "./quotes";

// Wyniki "Pomysłów do rozważenia" z podsumowań dnia: cena w chwili pomysłu (migawka `ceny` z raportu),
// po 7 i 30 dniach (migawki z późniejszych raportów) i dziś (kurs na żywo) — na tle rynku (WIG20 / S&P 500).
// Tu tylko pobieranie danych; obliczenia są w pomysly-wyniki.ts.

export { podsumowanie, type WynikPomyslu } from "./pomysly-wyniki";

const SYMBOLE: Record<string, string> = Object.fromEntries(SPOLKI.map(([symbol, nazwa]) => [nazwa, symbol]));

type Row = { id: number; created_at: string; pomysly: Pomysl[] | null; ceny: Record<string, number> | null };

export async function wynikiPomyslow() {
  const supabase = await createClient();
  // Lekkie zapytanie: tylko pomysły i migawki cen, bez treści raportów
  const { data, error } = await supabase
    .from("reports")
    .select("id, created_at, pomysly:data->pomysly, ceny:data->ceny")
    .eq("category", "dzien")
    .order("created_at", { ascending: true })
    .limit(1000)
    .returns<Row[]>();
  if (error) return { wyniki: [] as WynikPomyslu[], error: error.message, naZywo: false };
  const rows = data ?? [];

  // Starsze raporty (sprzed tej funkcji): pomysły z tekstu komentarza, ceny z raportów tematów z tego samego uruchomienia
  const bezPomyslow = rows.filter((r) => !r.pomysly);
  if (bezPomyslow.length) {
    const { data: stare } = await supabase
      .from("reports")
      .select("id, komentarz:data->>komentarz")
      .in("id", bezPomyslow.map((r) => r.id))
      .returns<{ id: number; komentarz: string | null }[]>();
    const komentarze = new Map((stare ?? []).map((s) => [s.id, s.komentarz]));
    for (const r of bezPomyslow) r.pomysly = pomyslyZKomentarza(komentarze.get(r.id) ?? "");
  }
  const bezCen = rows.filter((r) => !r.ceny && r.pomysly?.length);
  if (bezCen.length) {
    const czasy = bezCen.map((r) => new Date(r.created_at).getTime());
    const { data: tematy } = await supabase
      .from("reports")
      .select("created_at, instrumenty:data->instrumenty")
      .in("category", ["zloto", "gpw", "usa", "krypto", "spolki", "makro"])
      .gte("created_at", new Date(Math.min(...czasy) - 15 * 60e3).toISOString())
      .lte("created_at", new Date(Math.max(...czasy) + 15 * 60e3).toISOString())
      .returns<{ created_at: string; instrumenty: Instrument[] | null }[]>();
    for (const r of bezCen) {
      const t = new Date(r.created_at).getTime();
      const ceny: Record<string, number> = {};
      for (const temat of tematy ?? []) {
        // Jedno uruchomienie n8n zapisuje wszystkie tematy w ciągu kilku sekund
        if (Math.abs(new Date(temat.created_at).getTime() - t) > 5 * 60e3) continue;
        for (const i of temat.instrumenty ?? []) if (!i.blad && i.wartosc != null) ceny[i.nazwa] ??= i.wartosc;
      }
      r.ceny = ceny;
    }
  }

  const najnowszeCeny = [...rows].reverse().find((r) => r.ceny && Object.keys(r.ceny).length)?.ceny ?? {};

  // Kursy dziś: na żywo, a gdy się nie uda — z najnowszej migawki
  let naZywo = false;
  const dzis: Record<string, number> = { ...najnowszeCeny };
  try {
    const live = await liveQuotes();
    for (const i of Object.values(live.byCategory).flat()) {
      if (!i.blad && i.wartosc != null) {
        dzis[i.nazwa] = i.wartosc;
        naZywo = true;
      }
    }
  } catch {
    // zostają ceny z ostatniego raportu
  }

  const wyniki = policzWyniki(
    rows.map((r) => ({ ...r, pomysly: r.pomysly ?? [] })),
    dzis,
    SYMBOLE,
  );
  return { wyniki, error: null, naZywo };
}
