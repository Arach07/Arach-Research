import { logout } from "@/app/login/actions";
import { CategoryCard } from "@/components/category-card";
import { Commentary } from "@/components/commentary";
import { Ticker } from "@/components/instruments";
import { LiveBadge } from "@/components/live-quotes";
import { EmptyState } from "@/components/page-header";
import { formatDateTime } from "@/lib/format";
import { liveQuotes, mergeInstruments, withLive } from "@/lib/quotes";
import { MARKET_ORDER, latestByCategory, recentReports } from "@/lib/reports";

export default async function TodayPage() {
  const [{ reports, error }, live] = await Promise.all([recentReports(), liveQuotes()]);
  const latest = latestByCategory(reports);
  const summary = latest.dzien;
  const markets = MARKET_ORDER.map((c) => latest[c])
    .filter(Boolean)
    .map((r) => withLive(r, live));
  const scams = latest.scamy;

  // Pasek kursów: na żywo, a brakujące uzupełnione danymi z podsumowania dnia
  const ticker = mergeInstruments(live.ticker, summary?.data?.instrumenty);
  const newest = reports[0]?.created_at;

  return (
    <div className="space-y-5">
      <header className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-semibold tracking-tight">
            <span className="gold">Research</span>
          </h1>
          {newest && <p className="text-sm text-muted">Komentarze z raportu: {formatDateTime(newest)}</p>}
        </div>
        <form action={logout}>
          <button className="text-xs text-muted hover:text-accent">Wyloguj</button>
        </form>
      </header>

      {error && (
        <p className="card border-down/40 p-3 text-sm text-down">Nie udało się pobrać raportów: {error}</p>
      )}

      {!error && reports.length === 0 && (
        <EmptyState>Brak raportów. Odpal workflow w n8n, a pierwszy raport pojawi się tutaj.</EmptyState>
      )}

      {ticker.length > 0 && (
        <div className="space-y-2">
          <LiveBadge />
          <Ticker instruments={ticker} />
        </div>
      )}

      {summary && (
        <section className="card card-hero p-5">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-accent">
            🧠 Podsumowanie dnia
          </h2>
          {summary.data?.komentarz ? (
            <Commentary text={summary.data.komentarz.replace(/\s*\[\d+\]/g, "")} />
          ) : (
            <p className="text-sm text-muted">Komentarz AI niedostępny — zajrzyj do tematów poniżej.</p>
          )}
        </section>
      )}

      <div className="space-y-3">
        {markets.map((r) => (
          <CategoryCard key={r.id} report={r} href={`/rynki/${r.category}`} />
        ))}
        {scams && <CategoryCard report={scams} href="/scamy" />}
      </div>
    </div>
  );
}
