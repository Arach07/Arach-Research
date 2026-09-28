import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { ReportView } from "@/components/report-view";
import { formatShort } from "@/lib/format";
import { CATEGORIES, reportsForCategory } from "@/lib/reports";

export default async function CategoryPage({ params }: PageProps<"/rynki/[kategoria]">) {
  const { kategoria } = await params;
  if (!CATEGORIES[kategoria]) notFound();

  const [latest, ...older] = await reportsForCategory(kategoria);
  if (!latest) {
    return <PageHeader title={CATEGORIES[kategoria].label} subtitle="Brak raportów" back="/rynki" />;
  }

  return (
    <>
      <Link href="/rynki" className="mb-3 inline-block text-sm text-muted hover:text-accent">
        ‹ Rynki
      </Link>
      <ReportView report={latest} />

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
