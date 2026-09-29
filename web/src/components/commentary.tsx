import type { ReactNode } from "react";

// Zamienia "[3]" w tekście AI na klikalny przypis prowadzący do newsa nr 3 na liście źródeł
function withCitations(text: string, keyPrefix: string, citations: boolean): ReactNode[] {
  if (!citations) return [text.replace(/\s*\[\d+\]/g, "")];
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

// Sekcje rozbudowanego podsumowania dnia (linia z samą nazwą i dwukropkiem)
const SECTIONS: Record<string, string> = {
  "co się stało": "📰",
  "od ostatniego raportu": "🔄",
  "co przed nami": "📅",
  "makro w pigułce": "🌍",
  "sygnały techniczne": "📊",
  "co to znaczy": "🔗",
  "spółki w ruchu": "🏢",
  "rekomendacje dnia": "📈",
  "pomysły do rozważenia": "💡",
  ryzyka: "⚠️",
};

type Block =
  | { kind: "heading"; text: string; icon: string }
  | { kind: "list"; items: string[] }
  | { kind: "summary"; text: string }
  | { kind: "note"; text: string }
  | { kind: "text"; text: string };

// Tekst AI → bloki w oryginalnej kolejności (nagłówki sekcji, listy punktów, akapity)
function toBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;

    const heading = line.match(/^([^:\-][^:]{2,40}):\s*$/);
    const key = heading?.[1].toLowerCase();
    if (heading && key && (key in SECTIONS || line.length < 45)) {
      blocks.push({ kind: "heading", text: heading[1], icon: SECTIONS[key] ?? "•" });
    } else if (line.startsWith("- ")) {
      const last = blocks[blocks.length - 1];
      if (last?.kind === "list") last.items.push(line.slice(2));
      else blocks.push({ kind: "list", items: [line.slice(2)] });
    } else if (line.startsWith("Podsumowanie:")) {
      blocks.push({ kind: "summary", text: line.slice("Podsumowanie:".length) });
    } else if (/nie porada inwestycyjna/i.test(line)) {
      blocks.push({ kind: "note", text: line });
    } else {
      blocks.push({ kind: "text", text: line });
    }
  }
  return blocks;
}

// Komentarz AI: sekcje, punkty "- " jako lista, "Podsumowanie:" wyróżnione, przypisy klikalne
export function Commentary({ text, citations = true }: { text: string; citations?: boolean }) {
  return (
    <div className="space-y-3 text-[15px] leading-relaxed">
      {toBlocks(text).map((b, i) => {
        const key = `b${i}`;
        switch (b.kind) {
          case "heading":
            return (
              <h3
                key={key}
                className={`pt-2 text-xs font-semibold uppercase tracking-[0.12em] first:pt-0 ${
                  b.icon === "💡" ? "text-accent" : "text-muted"
                }`}
              >
                <span className="mr-1.5">{b.icon}</span>
                {b.text}
              </h3>
            );
          case "list":
            return (
              <ul key={key} className="space-y-2.5">
                {b.items.map((item, j) => (
                  <li key={`${key}-${j}`} className="flex gap-2.5">
                    <span className="mt-[0.6em] h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                    <span>{withCitations(item, `${key}-${j}`, citations)}</span>
                  </li>
                ))}
              </ul>
            );
          case "summary":
            return (
              <p key={key} className="rounded-xl border-l-2 border-accent bg-accent/[0.06] px-3 py-2 text-sm">
                <span className="font-semibold text-accent">Podsumowanie:</span>
                {withCitations(b.text, key, citations)}
              </p>
            );
          case "note":
            return (
              <p key={key} className="border-t border-line pt-3 text-xs text-muted">
                {b.text}
              </p>
            );
          default:
            return <p key={key}>{withCitations(b.text, key, citations)}</p>;
        }
      })}
    </div>
  );
}
