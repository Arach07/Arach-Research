import Link from "next/link";
import { Commentary } from "@/components/commentary";
import { MarketRow } from "@/components/instruments";
import { LiveBadge } from "@/components/live-quotes";
import { BreadthCard, CompanyRow, MacroTile } from "@/components/market-views";
import { EmptyState, PageHeader } from "@/components/page-header";
import { formatDay } from "@/lib/format";
import { liveQuotes, withLive } from "@/lib/quotes";
import { categoryMeta, latestByCategory, recentReports, type Report, type Wydarzenie } from "@/lib/reports";

const VIEWS = [
  { id: "przeglad", label: "Przegląd" },
  { id: "spolki", label: "Spółki" },
  { id: "makro", label: "Makro" },
  { id: "kalendarz", label: "Kalendarz" },
] as const;
type View = (typeof VIEWS)[number]["id"];

const OVERVIEW = ["zloto", "gpw", "usa", "krypto"];

const MACRO_GROUPS = [
  { id: "stopy", label: "🏦 Stopy i obligacje" },
  { id: "waluty", label: "💱 Waluty (NBP)" },
  { id: "surowce", label: "🛢️ Surowce" },
  { id: "nastroje", label: "😨 Nastroje" },
  { id: "swiat", label: "🌐 Świat" },
];

function Tabs({ active }: { active: View }) {
  return (
    <nav className="mb-5 flex rounded-xl border border-line bg-white/[0.03] p-1">
      {VIEWS.map((v) => (
        <Link
          key={v.id}
          href={v.id === "przeglad" ? "/rynki" : `/rynki?widok=${v.id}`}
          className={`flex-1 rounded-lg py-1.5 text-center text-[13px] transition-colors ${
            v.id === active ? "bg-accent/15 font-semibold text-accent" : "text-muted hover:text-foreground"
          }`}
        >
          {v.label}
        </Link>
      ))}
    </nav>
  );
}

function AiNote({ report }: { report?: Report }) {
  if (!report?.data?.komentarz) return null;
  return (
    <section className="card card-hero mb-5 p-4">
      <Commentary text={report.data.komentarz} citations={false} />
    </section>
  );
}

function Overview({ latest }: { latest: Record<string, Report> }) {
  const markets = OVERVIEW.map((c) => latest[c]).filter(Boolean);
  if (!markets.length) return <EmptyState>Brak danych rynkowych.</EmptyState>;
  return (
    <div className="space-y-5">
      {markets.map((report) => {
        const meta = categoryMeta(report.category);
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
              {(report.data?.instrumenty ?? []).map((i) => (
                <MarketRow key={i.nazwa} instrument={i} />
              ))}
            </ul>
          </Link>
        );
      })}
    </div>
  );
}

function Companies({ report }: { report?: Report }) {
  const companies = (report?.data?.instrumenty ?? []).filter((i) => !i.blad);
  if (!companies.length) return <EmptyState>Brak danych o spółkach — pojawią się po najbliższym raporcie.</EmptyState>;
  const withRec = new Set((report?.data?.rekomendacje ?? []).map((r) => r.spolka).filter(Boolean));
  const sorted = [...companies].sort((a, b) => (b.d1 ?? 0) - (a.d1 ?? 0));
  return (
    <div className="space-y-4">
      <BreadthCard fromReport={report?.data?.szerokosc} />
      <ul className="card divide-y divide-line px-4">
        {sorted.map((i) => (
          <CompanyRow key={i.nazwa} instrument={i} hasRecommendation={withRec.has(i.nazwa)} />
        ))}
      </ul>
      <p className="text-center text-xs text-muted">
        🟢/🔴 = kurs względem średniej z 200 dni · RSI poniżej 30 = wyprzedana, powyżej 70 = wykupiona · ⭐ = nowa
        rekomendacja
      </p>
    </div>
  );
}

function Macro({ report }: { report?: Report }) {
  const items = (report?.data?.instrumenty ?? []).filter((i) => !i.blad);
  if (!items.length) return <EmptyState>Brak danych makro — pojawią się po najbliższym raporcie.</EmptyState>;
  return (
    <>
      <AiNote report={report} />
      <div className="space-y-5">
        {MACRO_GROUPS.map((g) => {
          const group = items.filter((i) => i.grupa === g.id);
          if (!group.length) return null;
          return (
            <section key={g.id}>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted">{g.label}</h2>
              <div className="grid grid-cols-2 gap-2.5">
                {group.map((i) => (
                  <MacroTile key={i.nazwa} instrument={i} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}

function Calendar({ report }: { report?: Report }) {
  const events = report?.data?.wydarzenia ?? [];
  if (!events.length) return <EmptyState>Brak ważnych wydarzeń w kalendarzu na najbliższe dni.</EmptyState>;
  const days = new Map<string, Wydarzenie[]>();
  for (const e of events) {
    const key = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Warsaw" }).format(new Date(e.data));
    days.set(key, [...(days.get(key) ?? []), e]);
  }
  const time = (iso: string) =>
    new Intl.DateTimeFormat("pl-PL", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Warsaw" }).format(new Date(iso));
  return (
    <>
      <AiNote report={report} />
      <div className="space-y-5">
        {[...days.entries()].map(([key, list]) => (
          <section key={key}>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted">{formatDay(list[0].data)}</h2>
            <ul className="card divide-y divide-line">
              {list.map((e, idx) => (
                <li key={`${key}-${idx}`} className="flex gap-3 px-4 py-2.5">
                  <span className="tabular w-11 shrink-0 text-xs text-muted">{e.caly_dzien ? "cały" : time(e.data)}</span>
                  <div className="min-w-0 text-sm">
                    <div>
                      {e.waznosc === "wysoka" && <span className="mr-1 text-down">●</span>}
                      <span className="text-muted">{e.kraj}:</span> {e.nazwa}
                    </div>
                    {(e.prognoza || e.poprzednio) && (
                      <div className="tabular text-[11px] text-muted">
                        {e.prognoza && `prognoza ${e.prognoza}`}
                        {e.prognoza && e.poprzednio && " · "}
                        {e.poprzednio && `poprzednio ${e.poprzednio}`}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
        <p className="text-center text-xs text-muted">● = wydarzenie o wysokiej ważności · godziny w czasie polskim</p>
      </div>
    </>
  );
}

export default async function MarketsPage({ searchParams }: PageProps<"/rynki">) {
  const { widok } = await searchParams;
  const view: View = VIEWS.some((v) => v.id === widok) ? (widok as View) : "przeglad";

  const [{ reports }, live] = await Promise.all([recentReports(), liveQuotes()]);
  const latestRaw = latestByCategory(reports);
  const latest = Object.fromEntries(Object.entries(latestRaw).map(([k, r]) => [k, withLive(r, live)]));

  return (
    <>
      <PageHeader title="Rynki" subtitle="Kursy, spółki, makro i kalendarz" action={<LiveBadge />} />
      <Tabs active={view} />
      {view === "przeglad" && <Overview latest={latest} />}
      {view === "spolki" && <Companies report={latest.spolki} />}
      {view === "makro" && <Macro report={latest.makro} />}
      {view === "kalendarz" && <Calendar report={latestRaw.kalendarz} />}
    </>
  );
}
