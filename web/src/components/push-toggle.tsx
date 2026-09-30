"use client";

import { useEffect, useState } from "react";
import { usunSubskrypcje, wyslijTest, zapiszSubskrypcje } from "@/app/(app)/push-actions";

const KLUCZ = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

type Stan =
  | "ladowanie"
  | "brak-klucza" // apka bez kluczy VAPID (nieustawione na Vercelu)
  | "ios-bez-ikony" // iPhone: powiadomienia działają tylko w apce dodanej do ekranu początkowego
  | "nieobslugiwane"
  | "zablokowane"
  | "wylaczone"
  | "wlaczone";

// Przyciski wygodne do stuknięcia palcem
const PRZYCISK = "rounded-full bg-accent/15 px-3.5 py-2 text-xs font-semibold disabled:opacity-50";

function klucz(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

function urzadzenie() {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return "iPhone";
  if (/iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "iPad";
  if (/Android/.test(ua)) return "Android";
  return "Komputer";
}

function doZapisu(sub: PushSubscription) {
  const json = sub.toJSON();
  return { endpoint: sub.endpoint, p256dh: json.keys?.p256dh ?? "", auth: json.keys?.auth ?? "" };
}

// Włączanie powiadomień o nowych raportach (9:00 / 14:00 / 20:00) na tym urządzeniu
export function PushToggle() {
  const [stan, setStan] = useState<Stan>("ladowanie");
  const [zajety, setZajety] = useState(false);
  const [komunikat, setKomunikat] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      await Promise.resolve();
      const ios = /iPhone|iPad/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
      const zIkony =
        window.matchMedia("(display-mode: standalone)").matches ||
        (navigator as Navigator & { standalone?: boolean }).standalone === true;
      if (!KLUCZ) return setStan("brak-klucza");
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        return setStan(ios && !zIkony ? "ios-bez-ikony" : "nieobslugiwane");
      }
      try {
        const rejestracja = await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
        const sub = await rejestracja.pushManager.getSubscription();
        if (sub) {
          // Odświeżamy wpis w bazie (np. po wyczyszczeniu danych lub zmianie kluczy przeglądarki)
          await zapiszSubskrypcje(doZapisu(sub), urzadzenie());
          return setStan("wlaczone");
        }
        setStan(Notification.permission === "denied" ? "zablokowane" : "wylaczone");
      } catch {
        setStan("nieobslugiwane");
      }
    })();
  }, []);

  async function wlacz() {
    setZajety(true);
    setKomunikat(null);
    try {
      const zgoda = await Notification.requestPermission();
      if (zgoda !== "granted") {
        setStan(zgoda === "denied" ? "zablokowane" : "wylaczone");
        return;
      }
      const rejestracja = await navigator.serviceWorker.ready;
      const sub = await rejestracja.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: klucz(KLUCZ!) });
      const blad = await zapiszSubskrypcje(doZapisu(sub), urzadzenie());
      if (blad) {
        await sub.unsubscribe();
        setKomunikat(blad);
        return;
      }
      setStan("wlaczone");
      setKomunikat("Włączone. Możesz wysłać próbne powiadomienie.");
    } catch (e) {
      setKomunikat(`Nie udało się włączyć: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setZajety(false);
    }
  }

  async function wylacz() {
    setZajety(true);
    setKomunikat(null);
    try {
      const sub = await (await navigator.serviceWorker.ready).pushManager.getSubscription();
      if (sub) {
        await usunSubskrypcje(sub.endpoint);
        await sub.unsubscribe();
      }
      setStan("wylaczone");
    } finally {
      setZajety(false);
    }
  }

  async function test() {
    setZajety(true);
    setKomunikat(null);
    const blad = await wyslijTest();
    setKomunikat(blad ?? "Wysłane — powiadomienie powinno przyjść w ciągu kilku sekund.");
    setZajety(false);
  }

  if (stan === "ladowanie" || stan === "brak-klucza") return null;

  return (
    <section className="card p-4 text-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="font-medium">🔔 Powiadomienia o raportach</div>
          <div className="text-xs text-muted">
            {stan === "wlaczone" && "Włączone na tym urządzeniu · 9:00, 14:00, 20:00"}
            {stan === "wylaczone" && "Informacja na telefon, gdy nowy raport jest gotowy"}
            {stan === "zablokowane" && "Zablokowane — włącz je w ustawieniach telefonu/przeglądarki dla tej apki"}
            {stan === "nieobslugiwane" && "Ta przeglądarka nie obsługuje powiadomień"}
            {stan === "ios-bez-ikony" && "Na iPhonie: Udostępnij → „Do ekranu początkowego”, potem otwórz apkę z ikony"}
          </div>
        </div>
        {stan === "wylaczone" && (
          <button onClick={wlacz} disabled={zajety} className={`${PRZYCISK} shrink-0 text-accent`}>
            Włącz
          </button>
        )}
        {stan === "wlaczone" && (
          <div className="flex shrink-0 gap-2">
            <button onClick={test} disabled={zajety} className={`${PRZYCISK} text-accent`}>
              Test
            </button>
            <button onClick={wylacz} disabled={zajety} className={`${PRZYCISK} text-muted`}>
              Wyłącz
            </button>
          </div>
        )}
      </div>
      {komunikat && <p className="mt-2 text-xs text-muted">{komunikat}</p>}
    </section>
  );
}
