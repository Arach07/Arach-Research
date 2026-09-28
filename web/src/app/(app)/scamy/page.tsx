import { PageHeader } from "@/components/page-header";
import { ReportView } from "@/components/report-view";
import { latestForCategory } from "@/lib/reports";
import { LinkChecker } from "./link-checker";

const TIPS = [
  "Żaden bank, KNF ani celebryta nie poleca „platform inwestycyjnych” w reklamach.",
  "„Gwarantowany zysk” i „AI zarabia za Ciebie” to zawsze oszustwo.",
  "Nie instaluj AnyDesk/TeamViewer na prośbę „doradcy” — to przejęcie konta.",
  "Sprawdź firmę na liście ostrzeżeń publicznych KNF przed jakąkolwiek wpłatą.",
  "Oszustwo zgłoś na incydent.cert.pl albo SMS-em na numer 8080.",
];

export default async function ScamsPage() {
  const latest = await latestForCategory("scamy");

  return (
    <>
      <PageHeader title="Scamy" subtitle="Sprawdzanie linków i najnowsze ostrzeżenia" />
      <div className="space-y-6">
        <LinkChecker />

        <section className="card p-5">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-muted">Jak się nie dać</h2>
          <ul className="space-y-2 text-sm">
            {TIPS.map((tip) => (
              <li key={tip} className="flex gap-2.5">
                <span className="mt-[0.55em] h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                {tip}
              </li>
            ))}
          </ul>
        </section>

        {latest && <ReportView report={latest} />}
      </div>
    </>
  );
}
