import type { ReactNode } from "react";

// Zamienia "[3]" w tekście AI na klikalny przypis prowadzący do newsa nr 3 na liście źródeł
function withCitations(text: string, keyPrefix: string): ReactNode[] {
  return text.split(/(\[\d+\])/g).map((part, i) => {
    const match = part.match(/^\[(\d+)\]$/);
    if (!match) return part;
    return (
      <a
        key={`${keyPrefix}-${i}`}
        href={`#news-${match[1]}`}
        className="mx-0.5 inline-flex h-4 min-w-4 -translate-y-0.5 items-center justify-center rounded-full bg-accent/15 px-1 align-middle text-[10px] font-semibold text-accent"
      >
        {match[1]}
      </a>
    );
  });
}

// Komentarz AI: punkty "- ..." jako lista, "Podsumowanie:" wyróżnione, przypisy klikalne
export function Commentary({ text }: { text: string }) {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const points = lines.filter((l) => l.startsWith("- "));
  const summary = lines.find((l) => l.startsWith("Podsumowanie:"));
  const other = lines.filter((l) => !l.startsWith("- ") && l !== summary);

  return (
    <div className="space-y-3 text-[15px] leading-relaxed">
      {other.map((l, i) => (
        <p key={`o${i}`}>{withCitations(l, `o${i}`)}</p>
      ))}
      {points.length > 0 && (
        <ul className="space-y-2.5">
          {points.map((l, i) => (
            <li key={`p${i}`} className="flex gap-2.5">
              <span className="mt-[0.6em] h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
              <span>{withCitations(l.slice(2), `p${i}`)}</span>
            </li>
          ))}
        </ul>
      )}
      {summary && (
        <p className="rounded-xl border-l-2 border-accent bg-accent/[0.06] px-3 py-2 text-sm">
          <span className="font-semibold text-accent">Podsumowanie:</span>
          {withCitations(summary.slice("Podsumowanie:".length), "s")}
        </p>
      )}
    </div>
  );
}
