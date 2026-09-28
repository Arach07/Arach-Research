"use client";

import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { LiveQuotes } from "@/lib/quotes";
import type { Instrument } from "@/lib/reports";

const QUOTES_EVERY_MS = 20_000;
// Raporty (komentarze AI, newsy) zmieniają się 3 razy dziennie — po powrocie do apki
// odświeżamy je najwyżej co 5 minut, żeby nie zużywać limitu transferu Supabase
const REPORTS_MIN_GAP_MS = 5 * 60_000;

const LiveQuotesContext = createContext<LiveQuotes | null>(null);

export function LiveQuotesProvider({ initial, children }: { initial: LiveQuotes; children: React.ReactNode }) {
  const [quotes, setQuotes] = useState(initial);
  const router = useRouter();
  const lastReportsRefresh = useRef(0);

  useEffect(() => {
    lastReportsRefresh.current = Date.now();

    const loadQuotes = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const response = await fetch("/api/kursy", { cache: "no-store" });
        if (response.ok) setQuotes(await response.json());
      } catch {
        // brak sieci — zostają ostatnie kursy
      }
    };

    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      loadQuotes();
      if (Date.now() - lastReportsRefresh.current > REPORTS_MIN_GAP_MS) {
        lastReportsRefresh.current = Date.now();
        router.refresh();
      }
    };

    const id = window.setInterval(loadQuotes, QUOTES_EVERY_MS);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router]);

  return <LiveQuotesContext.Provider value={quotes}>{children}</LiveQuotesContext.Provider>;
}

function useLiveQuotes() {
  return useContext(LiveQuotesContext);
}

// Najświeższa wersja instrumentu (po nazwie), a gdy nie ma kursu na żywo — ta przekazana
export function useLiveInstrument(instrument: Instrument): Instrument {
  const quotes = useLiveQuotes();
  if (!quotes) return instrument;
  for (const list of [quotes.ticker, ...Object.values(quotes.byCategory)]) {
    const found = list.find((i) => i.nazwa === instrument.nazwa);
    if (found) return found;
  }
  return instrument;
}

export function LiveBadge() {
  const quotes = useLiveQuotes();
  if (!quotes) return null;
  const time = new Intl.DateTimeFormat("pl-PL", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "Europe/Warsaw",
  }).format(new Date(quotes.fetchedAt));
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-up opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-up" />
      </span>
      Kursy na żywo · {time}
    </span>
  );
}
