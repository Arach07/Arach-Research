import Link from "next/link";
import { EmptyState, PageHeader } from "@/components/page-header";
import { dayKey, formatDay, formatShort } from "@/lib/format";
import { categoryMeta, searchReports, teaser, type Report } from "@/lib/reports";

export default async function ArchivePage({ searchParams }: PageProps<"/archiwum">) {
  const { q } = await searchParams;
  const query = typeof q === "string" ? q : "";
  const { reports, error } = await searchReports(query);

  // Grupowanie po dniu (strefa warszawska)
  const days = new Map<string, Report[]>();
  for (const r of reports) {
    const key = dayKey(r.created_at);
    days.set(key, [...(days.get(key) ?? []), r]);
  }

  return (
    <>
      <PageHeader title="Archiwum" subtitle="Wszystkie raporty, najnowsze na górze" />

      <form className="mb-6">
        <input
          name="q"
          defaultValue={query}
          placeholder="Szukaj, np. złoto, Orlen, Fed…"
          className="w-full rounded-xl border border-line-strong bg-background/60 px-3 py-2.5 text-[15px] outline-none placeholder:text-muted/70 focus:border-accent"
        />
      </form>

      {error && <p className="text-sm text-down">Błąd wyszukiwania: {error}</p>}
      {!error && reports.length === 0 && (
        <EmptyState>{query ? `Nic nie znaleziono dla „${query}”.` : "Brak raportów."}</EmptyState>
      )}

      <div className="space-y-6">
        {[...days.entries()].map(([key, dayReports]) => (
          <section key={key}>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted">
              {formatDay(dayReports[0].created_at)}
            </h2>
            <ul className="card divide-y divide-line">
              {dayReports.map((r) => {
                const meta = categoryMeta(r.category);
                return (
                  <li key={r.id}>
                    <Link href={`/archiwum/${r.id}`} className="block px-4 py-3 hover:bg-white/[0.02]">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="font-medium">
                          {meta.icon} {meta.label}
                        </span>
                        <span className="tabular text-xs text-muted">{formatShort(r.created_at)}</span>
                      </div>
                      <p className="mt-1 line-clamp-1 text-sm text-muted">{teaser(r)}</p>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}
