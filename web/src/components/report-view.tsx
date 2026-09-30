import type { Report } from "@/lib/reports";
import { categoryMeta } from "@/lib/reports";
import { formatDateTime, formatNumber } from "@/lib/format";
import { Commentary } from "./commentary";
import { InstrumentPanel } from "./instruments";
import { LiveBadge } from "./live-quotes";
import { NewsList } from "./news-list";
import { ReportContent } from "./report-content";
import { MarketStatus } from "./market-status";
import { NumberCheck } from "./source-status";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">{title}</h2>
      {children}
    </section>
  );
}

// Pełny raport: komentarz AI, instrumenty z wykresami, CERT, źródła
export function ReportView({ report, live = false }: { report: Report; live?: boolean }) {
  const meta = categoryMeta(report.category);
  const data = report.data;

  // Starsze raporty (sprzed wersji 2) mają tylko tekst
  if (!data?.wersja) {
    return (
      <article className="card p-5">
        <ReportContent text={report.content ?? ""} />
      </article>
    );
  }

  const instrumenty = data.instrumenty ?? [];
  const newsy = data.newsy ?? [];

  return (
    <div className="space-y-6">
      <header>
        <div className="text-sm text-muted">{formatDateTime(report.created_at)}</div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          {meta.icon} {meta.label}
        </h1>
      </header>

      {report.category === "dzien" && <MarketStatus stan={data.stanRynkow} czas={report.created_at} />}

      <article className="card card-hero p-5">
        {data.komentarz ? (
          <>
            <Commentary text={data.komentarz} />
            <NumberCheck kontrola={data.kontrola} />
          </>
        ) : (
          <p className="text-sm text-muted">
            ⚠️ Komentarz AI niedostępny (limit Gemini) — poniżej dane i najważniejsze nagłówki.
          </p>
        )}
      </article>

      {instrumenty.length > 0 && (
        <Section title={live ? "Kursy" : "Twarde dane (stan z chwili raportu)"}>
          {live && <LiveBadge />}
          <div className="grid gap-3 sm:grid-cols-2">
            {instrumenty.map((i) => (
              <InstrumentPanel key={i.nazwa} instrument={i} live={live} />
            ))}
          </div>
        </Section>
      )}

      {data.cert && !data.cert.blad && (
        <Section title="Lista ostrzeżeń CERT Polska">
          <div className="card space-y-3 p-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="tabular gold text-2xl">{formatNumber(data.cert.wszystkie ?? 0, 0)}</div>
                <div className="text-xs text-muted">niebezpiecznych domen</div>
              </div>
              <div>
                <div className="tabular gold text-2xl">{formatNumber(data.cert.finansowe ?? 0, 0)}</div>
                <div className="text-xs text-muted">udaje inwestycje i finanse</div>
              </div>
            </div>
            {data.cert.przyklady?.length ? (
              <div>
                <div className="mb-1.5 text-xs text-muted">Przykłady (nie wchodzić!):</div>
                <div className="flex flex-wrap gap-1.5">
                  {data.cert.przyklady.map((d) => (
                    <span key={d} className="tabular rounded-md bg-down/10 px-1.5 py-0.5 text-[11px] text-down">
                      {d}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </Section>
      )}

      <Section title="Źródła">
        <div className="card p-4">
          <NewsList news={newsy} />
        </div>
        {data.odrzucone?.length ? (
          <p className="text-xs text-down">
            🚫 Odrzucone źródła z listy CERT: {data.odrzucone.join(", ")}
          </p>
        ) : null}
      </Section>
    </div>
  );
}
