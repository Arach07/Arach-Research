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

// "📌 Stan rynków" z chwili raportu: co jest już ostateczne (✅), co trwa (🟢), a co jest z poprzedniej sesji (⏳).
// Zwinięty pokazuje same ikony rynków w jednej linijce, po stuknięciu — całość.
export function MarketStatus({ stan, czas }: { stan?: StanRynku[]; czas?: string }) {
  if (!stan?.length) return null;
  const rynki = stan.filter((s) => s.status !== "info");
  return (
    <details className="card group p-4">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          <span className="block text-xs font-semibold uppercase tracking-[0.12em] text-accent">📌 Stan rynków</span>
          <span className="mt-1 block truncate text-xs text-muted">
            {rynki.map((s) => `${IKONY[s.status]} ${s.rynek}`).join(" · ")}
          </span>
        </span>
        <span className="shrink-0 text-sm text-accent transition-transform group-open:rotate-180">▾</span>
      </summary>
      {czas && <p className="mt-3 text-[11px] text-muted">W chwili raportu · {formatShort(czas)}</p>}
      <ul className="mt-2 space-y-2 text-sm leading-snug">
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
    </details>
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
