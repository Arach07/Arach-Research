import { createClient } from "@/lib/supabase/server";

// Kształt danych zapisywanych przez n8n (klocek "Weryfikacja źródeł", data.wersja = 2)
export type Instrument = {
  nazwa: string;
  jednostka?: string;
  wartosc?: number;
  cyfry?: number;
  d1?: number | null;
  d7?: number | null;
  d30?: number | null;
  seria?: number[];
  zrodlo?: string;
  blad?: string;
  // Spółki: roczny szczyt/dołek i odległość od nich (w %)
  symbol?: string;
  max52?: number;
  min52?: number;
  odSzczytu?: number | null;
  odDolka?: number | null;
  // Analiza techniczna: RSI(14), średnie 50/200 dni i odległość kursu od nich (w %)
  rsi?: number | null;
  sma50?: number | null;
  sma200?: number | null;
  odSma50?: number | null;
  odSma200?: number | null;
  // Makro: grupa kafelka (stopy, waluty, surowce, nastroje, swiat) i opis po polsku
  grupa?: string;
  opisPl?: string;
};

export type Szerokosc = { nad: number; pod: number; wszystkie: number; nadTydzienTemu: number };

export type Wydarzenie = {
  data: string;
  caly_dzien?: boolean;
  kraj: string;
  nazwa: string;
  waznosc: "wysoka" | "średnia";
  prognoza?: string | null;
  poprzednio?: string | null;
  typ: "makro" | "wyniki";
};

export type Rekomendacja = { tytul: string; link: string; domena: string; data: string | null; spolka: string | null };

export type News = {
  nr: number;
  tytul: string;
  opis?: string;
  link: string;
  domena: string;
  data: string | null;
  cytowany?: boolean;
};

export type CertInfo = {
  wszystkie?: number;
  finansowe?: number;
  przyklady?: string[];
  blad?: string;
};

export type ReportData = {
  wersja?: number;
  komentarz?: string | null;
  instrumenty?: Instrument[];
  newsy?: News[];
  odrzucone?: string[];
  cert?: CertInfo;
  szerokosc?: Szerokosc;
  wydarzenia?: Wydarzenie[];
  rekomendacje?: Rekomendacja[];
};

export type Report = {
  id: number;
  created_at: string;
  category: string;
  title: string;
  content: string;
  data: ReportData | null;
};

export const CATEGORIES: Record<string, { label: string; icon: string }> = {
  dzien: { label: "Podsumowanie dnia", icon: "🧠" },
  zloto: { label: "Złoto", icon: "🥇" },
  gpw: { label: "GPW", icon: "🇵🇱" },
  usa: { label: "Rynek USA", icon: "🇺🇸" },
  spolki: { label: "Spółki", icon: "🏢" },
  makro: { label: "Makro", icon: "🌍" },
  kalendarz: { label: "Kalendarz", icon: "📅" },
  krypto: { label: "Krypto", icon: "₿" },
  scamy: { label: "Scamy", icon: "🚨" },
  ogolny: { label: "Rynki", icon: "📈" },
};

// Kolejność kart na ekranach
export const MARKET_ORDER = ["zloto", "gpw", "usa", "spolki", "krypto"];

export function categoryMeta(category: string) {
  return CATEGORIES[category] ?? { label: category, icon: "📄" };
}

// Najnowsze raporty (2 ostatnie uruchomienia n8n po 9 tematów) — wystarczy, by mieć najnowszy z każdej kategorii
export async function recentReports(limit = 20) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reports")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<Report[]>();
  return { reports: data ?? [], error: error?.message ?? null };
}

// Najnowszy raport dla każdej kategorii
export function latestByCategory(reports: Report[]) {
  const latest: Record<string, Report> = {};
  for (const r of reports) latest[r.category] ??= r;
  return latest;
}

// Data najnowszego raportu — lekkie zapytanie do sprawdzania, czy są nowe raporty
export async function latestReportAt() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("reports")
    .select("created_at")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ created_at: string }>();
  return data?.created_at ?? null;
}

export async function reportById(id: number) {
  const supabase = await createClient();
  const { data } = await supabase.from("reports").select("*").eq("id", id).maybeSingle<Report>();
  return data;
}

export async function latestForCategory(category: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("reports")
    .select("*")
    .eq("category", category)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<Report>();
  return data;
}

// Lekki wiersz do list (archiwum, poprzednie raporty) — bez treści i wykresów
export type ReportSummary = {
  id: number;
  created_at: string;
  category: string;
  title: string;
  komentarz: string | null;
};

const SUMMARY_COLUMNS = "id, created_at, category, title, komentarz:data->>komentarz";

export async function olderForCategory(category: string, limit = 15) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("reports")
    .select(SUMMARY_COLUMNS)
    .eq("category", category)
    .order("created_at", { ascending: false })
    .range(1, limit)
    .returns<ReportSummary[]>();
  return data ?? [];
}

export async function searchReports(query: string, limit = 100) {
  const supabase = await createClient();
  let request = supabase
    .from("reports")
    .select(SUMMARY_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(limit);

  // Znaki specjalne filtra PostgREST (przecinek, nawiasy, %) usuwamy z zapytania
  const q = query.replace(/[,()%*\\]/g, " ").trim();
  if (q) request = request.or(`title.ilike.%${q}%,content.ilike.%${q}%`);

  const { data, error } = await request.returns<ReportSummary[]>();
  return { reports: data ?? [], error: error?.message ?? null };
}

// Pierwsze zdanie/punkt komentarza AI albo pierwszy nagłówek — do podglądu na kartach
export function teaser(report: Report | ReportSummary) {
  const komentarz = "data" in report ? report.data?.komentarz : report.komentarz;
  if (komentarz) {
    const pierwszy = komentarz
      .split("\n")
      .map((l) => l.replace(/^-\s*/, "").trim())
      .find((l) => l && !l.startsWith("Podsumowanie:"));
    if (pierwszy) return pierwszy.replace(/\s*\[\d+\]/g, "");
  }
  if (!("data" in report)) return "Komentarz AI niedostępny — otwórz raport, żeby zobaczyć dane i newsy.";
  const news = report.data?.newsy?.[0];
  if (news) return news.tytul;
  return report.content.split("\n").find((l) => l.trim())?.replace(/^-\s*/, "") ?? "";
}
