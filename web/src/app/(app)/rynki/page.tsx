import Link from "next/link";
import { MarketRow } from "@/components/instruments";
import { LiveBadge } from "@/components/live-quotes";
import { EmptyState, PageHeader } from "@/components/page-header";
import { liveQuotes, withLive } from "@/lib/quotes";
import { MARKET_ORDER, categoryMeta, latestByCategory, recentReports } from "@/lib/reports";

export default async function MarketsPage() {
  const [{ reports }, live] = await Promise.all([recentReports(), liveQuotes()]);
  const latest = latestByCategory(reports);
  const markets = MARKET_ORDER.map((c) => latest[c])
    .filter(Boolean)
    .map((r) => withLive(r, live));

  return (
    <>
      <PageHeader title="Rynki" subtitle="Kursy, wykresy 30 dni i pełne raporty" action={<LiveBadge />} />
      {markets.length === 0 && <EmptyState>Brak danych rynkowych.</EmptyState>}

      <div className="space-y-5">
        {markets.map((report) => {
          const meta = categoryMeta(report.category);
          const instruments = report.data?.instrumenty ?? [];
          return (
            <Link
              key={report.id}
              href={`/rynki/${report.category}`}
              className="card group block p-4 transition-colors hover:border-line-strong"
            >
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-semibold">
                  {meta.icon} {meta.label}
                </h2>
                <span className="text-xs text-muted group-hover:text-accent">Raport ›</span>
              </div>
              <ul className="divide-y divide-line">
                {instruments.map((i) => (
                  <MarketRow key={i.nazwa} instrument={i} />
                ))}
              </ul>
            </Link>
          );
        })}
      </div>
    </>
  );
}
