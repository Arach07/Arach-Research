import type { News } from "@/lib/reports";
import { formatShort } from "@/lib/format";

// Lista newsów ze źródłami. Cytowane przez AI są na górze i oznaczone numerem.
export function NewsList({ news, limit }: { news: News[]; limit?: number }) {
  const sorted = [...news].sort((a, b) => Number(b.cytowany ?? false) - Number(a.cytowany ?? false));
  const shown = limit ? sorted.slice(0, limit) : sorted;
  if (!shown.length) return <p className="text-sm text-muted">Brak newsów z zaufanych portali.</p>;

  return (
    <ul className="divide-y divide-line">
      {shown.map((n) => (
        <li key={n.nr} id={`news-${n.nr}`} className="scroll-mt-20 py-3 first:pt-0 last:pb-0">
          <a href={n.link} target="_blank" rel="noopener noreferrer" className="group flex gap-3">
            <span
              className={`tabular mt-0.5 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-semibold ${
                n.cytowany ? "bg-accent text-background" : "bg-white/[0.06] text-muted"
              }`}
            >
              {n.nr}
            </span>
            <span className="min-w-0">
              <span className="block text-sm leading-snug group-hover:text-accent">{n.tytul}</span>
              <span className="mt-1 block text-[11px] text-muted">
                ✅ {n.domena}
                {n.data && ` · ${formatShort(n.data)}`}
              </span>
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}
