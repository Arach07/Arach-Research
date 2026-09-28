import type { Instrument } from "./reports";

// Kursy na żywo pobierane przez apkę (bez AI). Te same źródła co w n8n,
// odświeżane najwyżej co 20 sekund — komentarze i newsy dalej robi n8n 3 razy dziennie.
const REVALIDATE_SECONDS = 20;

const pct = (now: number, before: number | null) => (before ? ((now - before) / before) * 100 : null);

function instrument(
  nazwa: string,
  jednostka: string,
  seria: number[],
  opts: Partial<Pick<Instrument, "zrodlo" | "cyfry" | "d1" | "d7" | "d30">> = {},
): Instrument {
  const last = seria[seria.length - 1];
  const back = (n: number) => (seria.length > n ? seria[seria.length - 1 - n] : null);
  return {
    nazwa,
    jednostka,
    wartosc: last,
    cyfry: opts.cyfry ?? 2,
    d1: opts.d1 !== undefined ? opts.d1 : pct(last, back(1)),
    d7: opts.d7 !== undefined ? opts.d7 : pct(last, back(5)),
    d30: opts.d30 !== undefined ? opts.d30 : pct(last, back(21)),
    seria: seria.slice(-30),
    zrodlo: opts.zrodlo,
  };
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (research-app)" },
    next: { revalidate: REVALIDATE_SECONDS },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json() as Promise<T>;
}

type YahooChart = {
  chart: {
    result: {
      meta: { regularMarketPrice: number; regularMarketChangePercent?: number; chartPreviousClose?: number };
      indicators: { quote: { close: (number | null)[] }[] };
    }[];
  };
};

async function yahoo(symbol: string, nazwa: string, jednostka: string): Promise<Instrument> {
  const data = await getJson<YahooChart>(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=2mo&interval=1d`,
  );
  const r = data.chart.result[0];
  const closes = r.indicators.quote[0].close.filter((x): x is number => x != null);
  const zrodlo = `https://finance.yahoo.com/quote/${encodeURIComponent(symbol)}`;
  const price = r.meta.regularMarketPrice;

  if (closes.length > 21) {
    // Ostatni punkt serii zastępujemy bieżącą ceną (w trakcie sesji zamknięcia jeszcze nie ma)
    return instrument(nazwa, jednostka, [...closes.slice(0, -1), price], { zrodlo });
  }
  // Dla części indeksów GPW Yahoo nie ma historii — jest tylko zmiana dzienna
  return instrument(nazwa, jednostka, [price], {
    zrodlo,
    d1: r.meta.regularMarketChangePercent ?? null,
    d7: null,
    d30: null,
  });
}

async function nbpGold(): Promise<Instrument> {
  const g = await getJson<{ data: string; cena: number }[]>(
    "https://api.nbp.pl/api/cenyzlota/last/30?format=json",
  );
  return instrument("Złoto NBP (1 g)", "zł", g.map((x) => x.cena), {
    zrodlo: "https://api.nbp.pl/api/cenyzlota/last/30?format=json",
  });
}

async function nbpUsd(): Promise<Instrument> {
  const r = await getJson<{ rates: { mid: number }[] }>(
    "https://api.nbp.pl/api/exchangerates/rates/a/usd/last/30/?format=json",
  );
  return instrument("USD/PLN", "zł", r.rates.map((x) => x.mid), {
    cyfry: 4,
    zrodlo: "https://api.nbp.pl/api/exchangerates/rates/a/usd/last/30/?format=json",
  });
}

type CoinGeckoMarket = {
  id: string;
  name: string;
  current_price: number;
  sparkline_in_7d?: { price: number[] };
  price_change_percentage_24h_in_currency?: number;
  price_change_percentage_7d_in_currency?: number;
  price_change_percentage_30d_in_currency?: number;
};

async function crypto(): Promise<Instrument[]> {
  const cg = await getJson<CoinGeckoMarket[]>(
    "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=bitcoin,ethereum&price_change_percentage=24h,7d,30d&sparkline=true",
  );
  return cg.map((c) => {
    const seria = (c.sparkline_in_7d?.price ?? []).filter((_, i) => i % 6 === 0);
    return instrument(c.name, "USD", [...seria, c.current_price], {
      cyfry: 0,
      zrodlo: `https://www.coingecko.com/pl/waluty/${c.id}`,
      d1: c.price_change_percentage_24h_in_currency ?? null,
      d7: c.price_change_percentage_7d_in_currency ?? null,
      d30: c.price_change_percentage_30d_in_currency ?? null,
    });
  });
}

// Błąd jednego źródła nie psuje reszty — wtedy apka pokaże dane z ostatniego raportu
async function safe<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch {
    return null;
  }
}

export type LiveQuotes = {
  byCategory: Record<string, Instrument[]>;
  ticker: Instrument[];
  fetchedAt: string;
};

export async function liveQuotes(): Promise<LiveQuotes> {
  const [gold, goldUsd, usd, wig20, wig, spx, nasdaq, dow, coins] = await Promise.all([
    safe(nbpGold),
    safe(() => yahoo("GC=F", "Złoto (1 uncja)", "USD")),
    safe(nbpUsd),
    safe(() => yahoo("WIG20.WA", "WIG20", "pkt")),
    safe(() => yahoo("WIG.WA", "WIG", "pkt")),
    safe(() => yahoo("^GSPC", "S&P 500", "pkt")),
    safe(() => yahoo("^IXIC", "Nasdaq", "pkt")),
    safe(() => yahoo("^DJI", "Dow Jones", "pkt")),
    safe(crypto),
  ]);

  const only = (...items: (Instrument | null)[]) => items.filter((i): i is Instrument => i !== null);

  return {
    byCategory: {
      zloto: only(gold, goldUsd, usd),
      gpw: only(wig20, wig, usd),
      usa: only(spx, nasdaq, dow),
      krypto: coins ?? [],
    },
    ticker: only(gold, wig20, spx, coins?.[0] ?? null, usd),
    fetchedAt: new Date().toISOString(),
  };
}

// Kursy na żywo, a gdy któregoś nie udało się pobrać — ten z raportu n8n
export function mergeInstruments(live: Instrument[] | undefined, fromReport: Instrument[] | undefined) {
  const byName = new Map((fromReport ?? []).map((i) => [i.nazwa, i]));
  for (const i of live ?? []) byName.set(i.nazwa, i);
  // Kolejność: jak w raporcie, a nowe na końcu
  const order = [...(fromReport ?? []).map((i) => i.nazwa), ...(live ?? []).map((i) => i.nazwa)];
  return [...new Set(order)].map((n) => byName.get(n)!).filter(Boolean);
}

// Kopia raportu z instrumentami podmienionymi na kursy na żywo (tylko dla najnowszych raportów)
export function withLive<T extends { category: string; data: { instrumenty?: Instrument[] } | null }>(
  report: T,
  live: LiveQuotes,
): T {
  const liveForCategory = live.byCategory[report.category];
  if (!report.data || !liveForCategory?.length) return report;
  return {
    ...report,
    data: { ...report.data, instrumenty: mergeInstruments(liveForCategory, report.data.instrumenty) },
  };
}
