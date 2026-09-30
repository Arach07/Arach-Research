// Status sesji przy kursie (ta sama logika co w n8n, klocek "Dane i tematy"):
// trwa       = handel teraz, liczby jeszcze się zmienią
// przed      = dzisiejsza sesja jeszcze się nie zaczęła — kurs z poprzedniego zamknięcia
// zamknieta  = dzisiejsza sesja zakończona — wynik dnia ostateczny
// poprzednia = dziś bez sesji (weekend, święto) — kurs z ostatniej sesji
// dzis       = NBP opublikował już dzisiejszy kurs

export type Sesja = {
  status: "trwa" | "przed" | "zamknieta" | "poprzednia" | "dzis";
  dzien?: string | null; // YYYY-MM-DD dnia, z którego jest kurs
  otwarcie?: string | null;
  zamkniecie?: string | null;
};

export type YahooMeta = {
  exchangeTimezoneName?: string;
  regularMarketTime?: number;
  currentTradingPeriod?: { regular?: { start?: number; end?: number } };
};

const TZ = "Europe/Warsaw";
const dzienW = (ms: number, tz = TZ) => new Date(ms).toLocaleDateString("sv-SE", { timeZone: tz });

export function sesjaZMeta(m: YahooMeta): Sesja {
  const teraz = Date.now();
  const tz = m.exchangeTimezoneName || TZ;
  const start = m.currentTradingPeriod?.regular?.start ? m.currentTradingPeriod.regular.start * 1000 : null;
  const koniec = m.currentTradingPeriod?.regular?.end ? m.currentTradingPeriod.regular.end * 1000 : null;
  const ostatnia = m.regularMarketTime ? m.regularMarketTime * 1000 : null;
  const dzien = ostatnia ? dzienW(ostatnia, tz) : null;
  let status: Sesja["status"];
  // "trwa" tylko przy świeżej transakcji — w weekend Yahoo potrafi pokazywać okres sesji bez handlu
  if (start && koniec && teraz >= start && teraz < koniec && ostatnia && teraz - ostatnia < 2 * 3600e3) status = "trwa";
  else if (start && teraz < start && dzienW(start, tz) === dzienW(teraz, tz)) status = "przed";
  else status = dzien === dzienW(teraz, tz) ? "zamknieta" : "poprzednia";
  return {
    status,
    dzien,
    otwarcie: start ? new Date(start).toISOString() : null,
    zamkniecie: koniec ? new Date(koniec).toISOString() : null,
  };
}

export const sesjaNbp = (data: string): Sesja => ({ status: data === dzienW(Date.now()) ? "dzis" : "poprzednia", dzien: data });

// "wt. 29.09" — dzień, z którego jest kurs
export function dzienKrotko(dzien?: string | null) {
  if (!dzien) return "";
  return new Date(`${dzien}T12:00:00Z`).toLocaleDateString("pl-PL", { timeZone: TZ, weekday: "short", day: "2-digit", month: "2-digit" });
}
