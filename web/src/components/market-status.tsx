import type { StanRynku } from "@/lib/reports";
import { formatShort } from "@/lib/format";
import { dzienKrotko, type Sesja } from "@/lib/sesja";

const IKONY: Record<StanRynku["status"], string> = {
  trwa: "🟢",
  zamknieta: "✅",
  dzis: "✅",
  przed: "⏳",
  poprzednia: "⏳",
  info: "📅",
  brak: "⚪",
};

// "📌 Stan rynków" z chwili raportu: co jest już ostateczne (✅), co trwa (🟢), a co jest z poprzedniej sesji (⏳)
export function MarketStatus({ stan, czas }: { stan?: StanRynku[]; czas?: string }) {
  if (!stan?.length) return null;
  return (
    <section className="card p-4">
      <h2 className="mb-2.5 flex items-baseline justify-between gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-accent">
        <span>📌 Stan rynków</span>
        {czas && <span className="font-normal normal-case tracking-normal text-muted">w chwili raportu · {formatShort(czas)}</span>}
      </h2>
      <ul className="space-y-2 text-sm leading-snug">
        {stan.map((s) => (
          <li key={s.rynek} className="flex gap-2">
            <span className="shrink-0">{IKONY[s.status]}</span>
            <span>
              <span className="font-medium">{s.rynek}:</span> <span className="text-foreground/80">{s.tekst}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 border-t border-line pt-2.5 text-[11px] text-muted">
        ✅ wynik ostateczny · 🟢 jeszcze się zmienia (aktualny kurs przy kafelkach) · ⏳ dane z poprzedniej sesji
      </p>
    </section>
  );
}

// Mała plakietka przy kursie: czy to wynik ostateczny, handel na żywo, czy kurs z poprzedniej sesji
export function SessionBadge({ sesja, className = "" }: { sesja?: Sesja; className?: string }) {
  if (!sesja) return null;
  const teksty: Record<Sesja["status"], string> = {
    trwa: "🟢 trwa",
    zamknieta: "✅ zamknięcie",
    dzis: "✅ dzisiejszy",
    przed: `⏳ ${dzienKrotko(sesja.dzien)}`,
    poprzednia: `⏳ ${dzienKrotko(sesja.dzien)}`,
  };
  return <span className={`whitespace-nowrap text-[10px] text-muted ${className}`}>{teksty[sesja.status]}</span>;
}
