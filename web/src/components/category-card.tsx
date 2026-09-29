import Link from "next/link";
import type { Report } from "@/lib/reports";
import { categoryMeta, teaser } from "@/lib/reports";
import { CardQuote } from "./instruments";

// Zwinięta karta tematu: ikona, zmiana głównego instrumentu (na żywo), mini-wykres, pierwsza myśl z raportu
export function CategoryCard({ report, href }: { report: Report; href: string }) {
  const meta = categoryMeta(report.category);
  const instruments = report.data?.instrumenty?.filter((i) => !i.blad) ?? [];
  // Karta spółek zbiera wiele firm — zamiast jednej zmiany pokazujemy, ile rośnie, a ile spada
  const isCompanies = report.category === "spolki";
  const main = isCompanies ? undefined : instruments[0];
  const up = instruments.filter((i) => (i.d1 ?? 0) > 0).length;
  const down = instruments.filter((i) => (i.d1 ?? 0) < 0).length;
  const newsCount = report.data?.newsy?.length ?? 0;

  return (
    <Link href={href} className="card group relative block p-4 transition-colors hover:border-line-strong">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold">
          <span className="mr-1.5">{meta.icon}</span>
          {meta.label}
        </h3>
        {!main && report.category === "scamy" && <span className="chip">{newsCount} ostrzeżeń</span>}
        {isCompanies && instruments.length > 0 && (
          <span className="chip tabular">
            <span className="text-up">▲ {up}</span> <span className="text-down">▼ {down}</span>
          </span>
        )}
      </div>
      {main && <CardQuote instrument={main} />}
      <p className="mt-2 line-clamp-2 text-sm leading-snug text-foreground/85">{teaser(report)}</p>
      <div className="mt-2 text-right text-xs text-muted group-hover:text-accent">Pełny raport ›</div>
    </Link>
  );
}
