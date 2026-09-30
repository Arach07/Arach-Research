import { BackLink } from "@/components/back-link";
import { notFound } from "next/navigation";
import { InstrumentPanel } from "@/components/instruments";
import { LiveBadge } from "@/components/live-quotes";
import { TechExplained } from "@/components/market-views";
import { NewsList } from "@/components/news-list";
import { formatShort } from "@/lib/format";
import { latestForCategory } from "@/lib/reports";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">{title}</h2>
      {children}
    </section>
  );
}

export default async function CompanyPage({ params }: PageProps<"/spolki/[symbol]">) {
  const { symbol: raw } = await params;
  const symbol = decodeURIComponent(raw);

  const report = await latestForCategory("spolki");
  const company = report?.data?.instrumenty?.find((i) => i.symbol === symbol || i.nazwa === symbol);
  if (!report || !company) notFound();

  const recommendations = (report.data?.rekomendacje ?? []).filter((r) => r.spolka === company.nazwa);
  const news = (report.data?.newsy ?? []).filter((n) => n.opis === company.nazwa);

  return (
    <div className="space-y-6">
      <div>
        <BackLink href="/rynki?widok=spolki" label="Spółki" />
        <div className="flex items-end justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">
            {company.nazwa} <span className="text-sm font-normal text-muted">{company.symbol}</span>
          </h1>
          <LiveBadge />
        </div>
      </div>

      <InstrumentPanel instrument={company} live />

      <Section title="📊 Analiza techniczna">
        <TechExplained instrument={company} />
      </Section>

      <Section title="📈 Rekomendacje analityków">
        {recommendations.length ? (
          <ul className="card divide-y divide-line px-4">
            {recommendations.map((r) => (
              <li key={r.link} className="py-3">
                <a href={r.link} target="_blank" rel="noopener noreferrer" className="text-sm hover:text-accent">
                  {r.tytul}
                </a>
                <div className="mt-1 text-[11px] text-muted">
                  ✅ {r.domena}
                  {r.data && ` · ${formatShort(r.data)}`}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="card p-4 text-sm text-muted">Brak nowych rekomendacji w ostatnich dniach.</p>
        )}
      </Section>

      <Section title="📰 Newsy o spółce">
        <div className="card p-4">
          <NewsList news={news} />
        </div>
      </Section>

      <p className="text-center text-xs text-muted">To informacja, nie porada inwestycyjna.</p>
    </div>
  );
}
