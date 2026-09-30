import { timingSafeEqual } from "node:crypto";
import { pushSkonfigurowany, wyslij, type Subskrypcja } from "@/lib/push";

// n8n po zapisaniu raportu zleca tu wysłanie powiadomienia. Adres jest poza logowaniem (proxy.ts),
// więc chroni go hasło w nagłówku "x-push-secret" = PUSH_SECRET z ustawień Vercela.
// n8n podaje też listę urządzeń (czyta ją z bazy swoim kluczem), dzięki czemu Vercel
// nie potrzebuje klucza service_role do bazy.

function hasloPoprawne(podane: string | null) {
  const wlasciwe = process.env.PUSH_SECRET;
  if (!wlasciwe || !podane) return false;
  const a = Buffer.from(podane);
  const b = Buffer.from(wlasciwe);
  return a.length === b.length && timingSafeEqual(a, b);
}

const tekst = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");

export async function POST(request: Request) {
  if (!hasloPoprawne(request.headers.get("x-push-secret"))) {
    return Response.json({ blad: "Brak dostępu" }, { status: 401 });
  }
  if (!pushSkonfigurowany()) {
    return Response.json({ blad: "Brak kluczy VAPID w ustawieniach Vercela" }, { status: 500 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const subskrypcje = (Array.isArray(body?.subskrypcje) ? body.subskrypcje : [])
    .filter(
      (s): s is Subskrypcja =>
        typeof s?.endpoint === "string" && /^https:\/\//.test(s.endpoint) && typeof s.p256dh === "string" && typeof s.auth === "string",
    )
    .slice(0, 50);
  if (!subskrypcje.length) return Response.json({ wyslane: 0, wygasle: [], bledy: [] });

  const url = tekst(body?.url, 200);
  const wynik = await wyslij(subskrypcje, {
    // Pusty tytuł jest dozwolony: iPhone i tak dopisuje "from Research" nad treścią
    title: typeof body?.title === "string" ? tekst(body.title, 120) : "Research",
    body: tekst(body?.body, 400) || "Nowy raport jest gotowy",
    // Tylko adresy wewnątrz apki
    url: url.startsWith("/") && !url.startsWith("//") ? url : "/",
    tag: tekst(body?.tag, 40) || "raport",
  });
  return Response.json(wynik);
}
