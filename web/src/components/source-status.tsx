import type { Kontrola, Problem } from "@/lib/reports";
import { hoursSince } from "@/lib/format";

// n8n robi raporty o 9:00, 14:00 i 20:00 — najdłuższa przerwa to noc (13 h)
const MAX_HOURS_WITHOUT_REPORT = 14;

function Warning({ children }: { children: React.ReactNode }) {
  return (
    <div className="card border-accent/40 bg-accent/[0.06] p-3 text-sm">
      <div className="flex gap-2">
        <span>⚠️</span>
        <div className="min-w-0 space-y-1">{children}</div>
      </div>
    </div>
  );
}

// Ostrzeżenia o stanie danych: brak nowego raportu (n8n nie działa?) i źródła, które nie odpowiedziały
export function SourceStatus({ newest, problemy }: { newest?: string; problemy?: Problem[] }) {
  const hours = newest ? hoursSince(newest) : 0;
  const stale = hours > MAX_HOURS_WITHOUT_REPORT;
  if (!stale && !problemy?.length) return null;

  return (
    <div className="space-y-2">
      {stale && (
        <Warning>
          <p className="font-medium text-accent">Brak nowego raportu od {Math.floor(hours)} godz.</p>
          <p className="text-muted">
            n8n zwykle zapisuje raport o 9:00, 14:00 i 20:00. Sprawdź, czy komputer z n8n jest włączony, a okno n8n
            otwarte.
          </p>
        </Warning>
      )}
      {problemy?.length ? (
        <Warning>
          <p className="font-medium text-accent">
            W ostatnim raporcie {problemy.length === 1 ? "nie odpowiedziało 1 źródło" : `nie odpowiedziały źródła (${problemy.length})`}
          </p>
          <ul className="text-muted">
            {problemy.map((p) => (
              <li key={p.zrodlo}>
                <span className="text-foreground/85">{p.zrodlo}</span>
                {p.blad ? ` — ${p.blad}` : ""}
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted">Reszta raportu jest aktualna. Brakujące dane pokazujemy jako „brak danych”.</p>
        </Warning>
      ) : null}
    </div>
  );
}

// Wynik kontroli liczb z komentarza AI: zielony znaczek albo lista liczb, których nie ma w danych
export function NumberCheck({ kontrola }: { kontrola?: Kontrola | null }) {
  if (!kontrola || kontrola.sprawdzone === 0) return null;
  if (!kontrola.niezgodne.length) {
    return (
      <p className="mt-3 text-xs text-muted">
        <span className="text-up">✓</span> Liczby w komentarzu sprawdzone automatycznie: {kontrola.zgodne} z{" "}
        {kontrola.sprawdzone} zgodne z danymi
      </p>
    );
  }
  return (
    <details className="mt-3 rounded-xl border border-accent/40 bg-accent/[0.06] px-3 py-2 text-xs">
      <summary className="cursor-pointer font-medium text-accent">
        ⚠️ {kontrola.niezgodne.length} z {kontrola.sprawdzone} liczb w komentarzu AI nie zgadza się z danymi
      </summary>
      <ul className="mt-2 space-y-2 text-muted">
        {kontrola.niezgodne.map((n, i) => (
          <li key={i}>
            <span className="tabular font-semibold text-foreground">{n.liczba}</span> — {n.powod}
            <div className="mt-0.5 italic">„…{n.fragment}…”</div>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-muted">Pewne są kursy w kafelkach i wykresach (prosto z API), nie ta liczba w tekście.</p>
    </details>
  );
}
