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
};

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
  krypto: { label: "Krypto", icon: "₿" },
  scamy: { label: "Scamy", icon: "🚨" },
  ogolny: { label: "Rynki", icon: "📈" },
};

// Kolejność kart na ekranach
export const MARKET_ORDER = ["zloto", "gpw", "usa", "krypto"];

export function categoryMeta(category: string) {
  return CATEGORIES[category] ?? { label: category, icon: "📄" };
}

// Raporty z ostatnich dni, najnowsze pierwsze
export async function recentReports(limit = 60) {
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

export async function reportById(id: number) {
  const supabase = await createClient();
  const { data } = await supabase.from("reports").select("*").eq("id", id).maybeSingle<Report>();
  return data;
}

export async function reportsForCategory(category: string, limit = 15) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("reports")
    .select("*")
    .eq("category", category)
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<Report[]>();
  return data ?? [];
}

export async function searchReports(query: string, limit = 100) {
  const supabase = await createClient();
  let request = supabase
    .from("reports")
    .select("id, created_at, category, title, content, data")
    .order("created_at", { ascending: false })
    .limit(limit);

  // Znaki specjalne filtra PostgREST (przecinek, nawiasy, %) usuwamy z zapytania
  const q = query.replace(/[,()%*\\]/g, " ").trim();
  if (q) request = request.or(`title.ilike.%${q}%,content.ilike.%${q}%`);

  const { data, error } = await request.returns<Report[]>();
  return { reports: data ?? [], error: error?.message ?? null };
}

// Pierwsze zdanie/punkt komentarza AI albo pierwszy nagłówek — do podglądu na kartach
export function teaser(report: Report) {
  const komentarz = report.data?.komentarz;
  if (komentarz) {
    const pierwszy = komentarz
      .split("\n")
      .map((l) => l.replace(/^-\s*/, "").trim())
      .find((l) => l && !l.startsWith("Podsumowanie:"));
    if (pierwszy) return pierwszy.replace(/\s*\[\d+\]/g, "");
  }
  const news = report.data?.newsy?.[0];
  if (news) return news.tytul;
  return report.content.split("\n").find((l) => l.trim())?.replace(/^-\s*/, "") ?? "";
}
