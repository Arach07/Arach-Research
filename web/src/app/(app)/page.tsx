import Link from "next/link";
import { logout } from "@/app/login/actions";
import { CategoryCard } from "@/components/category-card";
import { Collapsible } from "@/components/collapsible";
import { Commentary } from "@/components/commentary";
import { Ticker } from "@/components/instruments";
import { LiveBadge } from "@/components/live-quotes";
import { EmptyState } from "@/components/page-header";
import { PushToggle } from "@/components/push-toggle";
import { NumberCheck, SourceStatus } from "@/components/source-status";
import { formatDateTime } from "@/lib/format";
import { MARKET_ORDER, latestReports } from "@/lib/reports";

export default async function TodayPage() {
  const { latest, error } = await latestReports([...MARKET_ORDER, "scamy", "dzien"]);
  const reports = Object.values(latest).sort((a, b) => b.created_at.localeCompare(a.created_at));
  const summary = latest.dzien;
  // Kursy na żywo podmieniają się w przeglądarce (komponenty kursów same je pobierają)
  const markets = MARKET_ORDER.map((c) => latest[c]).filter(Boolean);
  const scams = latest.scamy;

  // Pasek kursów: instrumenty z podsumowania dnia (wartości na żywo podstawia przeglądarka)
  const ticker =
    summary?.data?.instrumenty ?? markets.flatMap((r) => r.data?.instrumenty?.filter((i) => !i.blad).slice(0, 1) ?? []);
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
        <div className="flex items-center gap-3">
          <PushToggle />
          <form action={logout}>
            <button className="text-xs text-muted hover:text-accent">Wyloguj</button>
          </form>
        </div>
      </header>

      {error && (
        <p className="card border-down/40 p-3 text-sm text-down">Nie udało się pobrać raportów: {error}</p>
      )}

      {/* Stan danych: źródła, które nie odpowiedziały (te same w całym uruchomieniu n8n), i brak nowych raportów */}
      <SourceStatus newest={newest} problemy={reports[0]?.data?.problemy} />

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
            <>
              <Collapsible>
                <Commentary text={summary.data.komentarz} citations={false} />
              </Collapsible>
              <NumberCheck kontrola={summary.data.kontrola} />
              <Link href="/rynki/dzien" className="mt-4 block text-right text-xs text-muted hover:text-accent">
                Podsumowanie ze źródłami ›
              </Link>
              <Link
                href="/pomysly"
                className="mt-3 flex items-center justify-between rounded-xl border border-line px-3 py-2.5 text-sm hover:border-line-strong hover:text-accent"
              >
                <span>💡 Jak wyszły wcześniejsze pomysły?</span>
                <span className="text-muted">›</span>
              </Link>
            </>
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
