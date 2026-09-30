import webpush from "web-push";

// Wysyłka powiadomień push (Web Push, klucze VAPID). Klucze są w zmiennych środowiskowych Vercela:
// NEXT_PUBLIC_VAPID_PUBLIC_KEY (jawny, zna go też przeglądarka) i VAPID_PRIVATE_KEY (tajny).

export type Subskrypcja = { endpoint: string; p256dh: string; auth: string };
export type Wiadomosc = { title: string; body: string; url?: string; tag?: string };

export function pushSkonfigurowany() {
  return Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

let gotowe = false;
function konfiguruj() {
  if (gotowe) return;
  webpush.setVapidDetails(
    // Kontakt dla usług push (Apple/Google) — adres apki zamiast e-maila
    process.env.VAPID_SUBJECT ?? "https://research.app",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  gotowe = true;
}

// Wysyła do wszystkich podanych urządzeń. Zwraca, ile doszło, i które subskrypcje wygasły
// (410/404 = urządzenie wyłączyło powiadomienia albo usunięto apkę — można je skasować z bazy).
export async function wyslij(subskrypcje: Subskrypcja[], wiadomosc: Wiadomosc) {
  konfiguruj();
  const payload = JSON.stringify(wiadomosc);
  const wyniki = await Promise.allSettled(
    subskrypcje.map((s) =>
      webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, {
        TTL: 6 * 3600, // raport sprzed ponad 6 godzin nie jest już "nowy"
        urgency: "normal",
      }),
    ),
  );
  const wygasle: string[] = [];
  const bledy: string[] = [];
  wyniki.forEach((w, i) => {
    if (w.status === "fulfilled") return;
    const kod = (w.reason as { statusCode?: number })?.statusCode;
    if (kod === 404 || kod === 410) wygasle.push(subskrypcje[i].endpoint);
    else bledy.push(`${kod ?? "?"}: ${String((w.reason as Error)?.message ?? w.reason).slice(0, 120)}`);
  });
  return { wyslane: wyniki.filter((w) => w.status === "fulfilled").length, wygasle, bledy };
}
