import { createClient } from "@/lib/supabase/server";
import { logout } from "./login/actions";
import { ReportContent } from "./report-content";

type Report = {
  id: number;
  created_at: string;
  category: string;
  title: string;
  content: string;
  data: Record<string, unknown>;
};

const CATEGORIES: Record<string, string> = {
  zloto: "🥇 Złoto",
  gpw: "🇵🇱 GPW",
  usa: "🇺🇸 USA",
  krypto: "₿ Krypto",
  scamy: "🚨 Scamy",
  ogolny: "📈 Rynki",
};

const dateFormat = new Intl.DateTimeFormat("pl-PL", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Warsaw",
});

export default async function Home() {
  const supabase = await createClient();
  const { data: reports, error } = await supabase
    .from("reports")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50)
    .returns<Report[]>();

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Raporty</h1>
        <form action={logout}>
          <button className="text-sm text-muted hover:text-foreground">Wyloguj</button>
        </form>
      </header>

      {error && (
        <p className="rounded-lg border border-red-500/40 p-3 text-sm text-red-500">
          Nie udało się pobrać raportów: {error.message}
        </p>
      )}

      {!error && reports?.length === 0 && (
        <p className="text-muted">
          Brak raportów. Odpal workflow w n8n, a pierwszy raport pojawi się tutaj.
        </p>
      )}

      <ul className="space-y-4">
        {reports?.map((report) => (
          <li key={report.id} className="rounded-2xl border border-line bg-card p-5">
            <div className="mb-2 flex items-center justify-between gap-3 text-sm">
              <span className="rounded-full bg-accent/15 px-2.5 py-0.5 font-medium text-accent">
                {CATEGORIES[report.category] ?? report.category}
              </span>
              <time className="text-muted" dateTime={report.created_at}>
                {dateFormat.format(new Date(report.created_at))}
              </time>
            </div>
            <h2 className="mb-2 text-lg font-semibold">{report.title}</h2>
            <ReportContent text={report.content} />
          </li>
        ))}
      </ul>
    </main>
  );
}
