import Link from "next/link";
import { notFound } from "next/navigation";
import { LiveRefresh } from "@/components/live-refresh";
import { PageHeader } from "@/components/page-header";
import { ReportView } from "@/components/report-view";
import { formatShort } from "@/lib/format";
import { liveQuotes, withLive } from "@/lib/quotes";
import { CATEGORIES, latestForCategory, olderForCategory } from "@/lib/reports";

export default async function CategoryPage({ params }: PageProps<"/rynki/[kategoria]">) {
  const { kategoria } = await params;
  if (!CATEGORIES[kategoria]) notFound();

  const [latest, older, live] = await Promise.all([
    latestForCategory(kategoria),
    olderForCategory(kategoria),
    liveQuotes(),
  ]);
  if (!latest) {
    return <PageHeader title={CATEGORIES[kategoria].label} subtitle="Brak raportów" back="/rynki" />;
  }

  return (
    <>
      <Link href="/rynki" className="mb-3 inline-block text-sm text-muted hover:text-accent">
        ‹ Rynki
      </Link>
      <LiveRefresh />
      <ReportView report={withLive(latest, live)} liveAt={live.byCategory[kategoria]?.length ? live.fetchedAt : undefined} />

      {older.length > 0 && (
        <section className="mt-8 space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Poprzednie raporty</h2>
          <ul className="card divide-y divide-line">
            {older.map((r) => (
              <li key={r.id}>
                <Link href={`/archiwum/${r.id}`} className="flex justify-between px-4 py-3 text-sm hover:text-accent">
                  <span>{r.title}</span>
                  <span className="tabular text-xs text-muted">{formatShort(r.created_at)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
