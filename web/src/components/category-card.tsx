import Link from "next/link";
import type { Report } from "@/lib/reports";
import { categoryMeta, teaser } from "@/lib/reports";
import { CardQuote } from "./instruments";

// Zwinięta karta tematu: ikona, zmiana głównego instrumentu (na żywo), mini-wykres, pierwsza myśl z raportu
export function CategoryCard({ report, href }: { report: Report; href: string }) {
  const meta = categoryMeta(report.category);
  const main = report.data?.instrumenty?.find((i) => !i.blad);
  const newsCount = report.data?.newsy?.length ?? 0;

  return (
    <Link href={href} className="card group relative block p-4 transition-colors hover:border-line-strong">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold">
          <span className="mr-1.5">{meta.icon}</span>
          {meta.label}
        </h3>
        {!main && report.category === "scamy" && <span className="chip">{newsCount} ostrzeżeń</span>}
      </div>
      {main && <CardQuote instrument={main} />}
      <p className="mt-2 line-clamp-2 text-sm leading-snug text-foreground/85">{teaser(report)}</p>
      <div className="mt-2 text-right text-xs text-muted group-hover:text-accent">Pełny raport ›</div>
    </Link>
  );
}
