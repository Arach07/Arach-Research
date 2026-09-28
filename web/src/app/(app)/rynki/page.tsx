import Link from "next/link";
import { Change } from "@/components/change";
import { LiveBadge, LiveRefresh } from "@/components/live-refresh";
import { EmptyState, PageHeader } from "@/components/page-header";
import { Sparkline } from "@/components/sparkline";
import { formatNumber } from "@/lib/format";
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
      <LiveRefresh />
      <PageHeader title="Rynki" subtitle="Kursy, wykresy 30 dni i pełne raporty" action={<LiveBadge at={live.fetchedAt} />} />
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
                  <li key={i.nazwa} className="grid grid-cols-[1fr_5rem_auto] items-center gap-3 py-2.5">
                    <div className="min-w-0">
                      <div className="truncate text-sm">{i.nazwa}</div>
                      <div className="tabular gold text-[15px]">
                        {i.wartosc != null ? formatNumber(i.wartosc, i.cyfry ?? 2) : "—"}
                        <span className="ml-1 text-[11px]">{i.jednostka !== "pkt" ? i.jednostka : ""}</span>
                      </div>
                    </div>
                    <div>{i.seria && i.seria.length > 1 && <Sparkline values={i.seria} height={28} />}</div>
                    <div className="text-right text-xs">
                      <Change value={i.d1 ?? null} className="block font-semibold" />
                      <Change value={i.d30 ?? null} label="30d" className="block text-[11px]" />
                    </div>
                  </li>
                ))}
              </ul>
            </Link>
          );
        })}
      </div>
    </>
  );
}
