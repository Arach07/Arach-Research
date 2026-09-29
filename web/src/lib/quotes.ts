import type { Instrument } from "./reports";
import { technicals } from "./tech";

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

async function getJson<T>(url: string, revalidate = REVALIDATE_SECONDS): Promise<T> {
  const response = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (research-app)" },
    next: { revalidate },
    // Wolne źródło nie może blokować całej strony — po 4 s bierzemy dane z raportu
    signal: AbortSignal.timeout(4000),
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

// Dzienne zamknięcia z danych godzinowych: ostatnia wartość każdego dnia (czas warszawski).
// Historia zmienia się wolno, więc odświeżamy najwyżej co 10 minut.
async function dailyFromHourly(symbol: string): Promise<number[]> {
  try {
    const data = await getJson<{
      chart: { result: { timestamp?: number[]; indicators: { quote: { close: (number | null)[] }[] } }[] };
    }>(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=3mo&interval=1h`, 600);
    const r = data.chart.result[0];
    const closes = r.indicators.quote[0].close;
    const days = new Map<string, number>();
    (r.timestamp ?? []).forEach((t, i) => {
      const c = closes[i];
      if (c != null) days.set(new Date(t * 1000).toLocaleDateString("sv-SE", { timeZone: "Europe/Warsaw" }), c);
    });
    return [...days.values()];
  } catch {
    return [];
  }
}

async function yahoo(symbol: string, nazwa: string, jednostka: string, revalidate = REVALIDATE_SECONDS): Promise<Instrument> {
  const data = await getJson<YahooChart>(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=2mo&interval=1d`,
    revalidate,
  );
  const r = data.chart.result[0];
  const closes = r.indicators.quote[0].close.filter((x): x is number => x != null);
  const zrodlo = `https://finance.yahoo.com/quote/${encodeURIComponent(symbol)}`;
  const price = r.meta.regularMarketPrice;

  if (closes.length > 21) {
    // Ostatni punkt serii zastępujemy bieżącą ceną (w trakcie sesji zamknięcia jeszcze nie ma)
    return instrument(nazwa, jednostka, [...closes.slice(0, -1), price], { zrodlo });
  }
  // Dla indeksów GPW (WIG20, WIG) Yahoo nie ma historii dziennej, ale ma godzinową
  const daily = await dailyFromHourly(symbol);
  if (daily.length > 21) {
    return instrument(nazwa, jednostka, [...daily.slice(0, -1), price], { zrodlo });
  }
  return instrument(nazwa, jednostka, [price], {
    zrodlo,
    d1: r.meta.regularMarketChangePercent ?? null,
    d7: null,
    d30: null,
  });
}

// Duże spółki — te same co w n8n (n8n/src/dane-i-tematy.js, SPOLKI); nazwy muszą się zgadzać.
export const SPOLKI = [
  ["NVDA", "Nvidia"], ["AMD", "AMD"], ["AAPL", "Apple"], ["MSFT", "Microsoft"],
  ["GOOGL", "Alphabet (Google)"], ["AMZN", "Amazon"], ["META", "Meta"], ["TSLA", "Tesla"],
  ["CDR.WA", "CD Projekt"], ["PKO.WA", "PKO BP"], ["PKN.WA", "Orlen"], ["KGH.WA", "KGHM"],
  ["PZU.WA", "PZU"], ["LPP.WA", "LPP"], ["DNP.WA", "Dino Polska"], ["ALE.WA", "Allegro"],
  ["NVO", "Novo Nordisk"], ["ASML", "ASML"], ["XTB.WA", "XTB"], ["PEO.WA", "Pekao"],
] as const;

// Spółka: rok notowań (wykres 30 sesji + odległość od rocznego szczytu/dołka). 16 spółek,
// więc odświeżamy najwyżej co minutę, żeby nie zasypywać Yahoo zapytaniami.
async function company(symbol: string, nazwa: string): Promise<Instrument> {
  const data = await getJson<YahooChart & { chart: { result: { meta: { currency?: string } }[] } }>(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1y&interval=1d`,
    60,
  );
  const r = data.chart.result[0];
  const closes = r.indicators.quote[0].close.filter((x): x is number => x != null);
  const price = r.meta.regularMarketPrice ?? closes[closes.length - 1];
  const seria = [...closes.slice(0, -1), price];
  const max52 = Math.max(...seria);
  const min52 = Math.min(...seria);
  return {
    ...instrument(nazwa, r.meta.currency === "USD" ? "USD" : "zł", seria, {
      zrodlo: `https://finance.yahoo.com/quote/${encodeURIComponent(symbol)}`,
    }),
    symbol,
    max52,
    min52,
    odSzczytu: pct(price, max52),
    odDolka: pct(price, min52),
    ...technicals(seria),
  };
}

// Makro na żywo (nazwy jak w n8n, temat "makro"). Stopa NBP i Fear & Greed zmieniają się rzadko —
// te bierzemy z raportu. Odświeżamy najwyżej co minutę.
async function nbpRate(kod: string, nazwa: string): Promise<Instrument> {
  const r = await getJson<{ rates: { mid: number }[] }>(
    `https://api.nbp.pl/api/exchangerates/rates/a/${kod}/last/30/?format=json`,
    600,
  );
  return instrument(nazwa, "zł", r.rates.map((x) => x.mid), {
    cyfry: 4,
    zrodlo: `https://api.nbp.pl/api/exchangerates/rates/a/${kod}/last/30/?format=json`,
  });
}

async function macro(): Promise<Instrument[]> {
  const items = await Promise.all([
    safe(() => yahoo("^TNX", "Obligacje USA 10 lat", "%", 60)),
    safe(() => nbpRate("eur", "EUR/PLN")),
    safe(() => nbpRate("chf", "CHF/PLN")),
    safe(() => yahoo("BZ=F", "Ropa Brent", "USD", 60)),
    safe(() => yahoo("HG=F", "Miedź", "USD", 60)),
    safe(() => yahoo("SI=F", "Srebro", "USD", 60)),
    safe(() => yahoo("^VIX", "VIX (strach na akcjach)", "pkt", 60)),
    safe(() => yahoo("^GDAXI", "DAX (Niemcy)", "pkt", 60)),
  ]);
  return items.filter((i): i is Instrument => i !== null);
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

// Krypto z Yahoo (CoinGecko od 29.09 zwraca 403). Notowania 7 dni w tygodniu,
// więc tydzień = 7 punktów wstecz, a miesiąc = 30 (a nie 5 i 21 jak na giełdzie)
async function cryptoYahoo(symbol: string, nazwa: string): Promise<Instrument> {
  const data = await getJson<YahooChart>(
    `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=2mo&interval=1d`,
  );
  const r = data.chart.result[0];
  const closes = r.indicators.quote[0].close.filter((x): x is number => x != null);
  const s = [...closes.slice(0, -1), r.meta.regularMarketPrice];
  const back = (n: number) => (s.length > n ? s[s.length - 1 - n] : null);
  const last = s[s.length - 1];
  return instrument(nazwa, "USD", s, {
    cyfry: 0,
    zrodlo: `https://finance.yahoo.com/quote/${symbol}`,
    d7: pct(last, back(7)),
    d30: pct(last, back(30)),
  });
}

async function crypto(): Promise<Instrument[]> {
  return Promise.all([cryptoYahoo("BTC-USD", "Bitcoin"), cryptoYahoo("ETH-USD", "Ethereum")]);
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
  const companiesPromise = Promise.all(SPOLKI.map(([symbol, nazwa]) => safe(() => company(symbol, nazwa))));
  const macroPromise = macro();
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
  const companies = only(...(await companiesPromise));

  return {
    byCategory: {
      zloto: only(gold, goldUsd, usd),
      gpw: only(wig20, wig, usd),
      usa: only(spx, nasdaq, dow),
      krypto: coins ?? [],
      spolki: companies,
      makro: [...(usd ? [usd] : []), ...(await macroPromise)],
    },
    ticker: only(gold, wig20, spx, coins?.[0] ?? null, usd),
    fetchedAt: new Date().toISOString(),
  };
}

// Kursy na żywo, a gdy któregoś nie udało się pobrać — ten z raportu n8n
export function mergeInstruments(live: Instrument[] | undefined, fromReport: Instrument[] | undefined) {
  const byName = new Map((fromReport ?? []).map((i) => [i.nazwa, i]));
  // Łączymy pola: kurs na żywo nadpisuje wartości, a dodatkowe pola z raportu (np. roczny szczyt) zostają
  for (const i of live ?? []) byName.set(i.nazwa, { ...byName.get(i.nazwa), ...i });
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
