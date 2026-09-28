import { formatPct, trend } from "@/lib/format";

const COLORS = { up: "text-up", down: "text-down", flat: "text-muted" };
const ARROWS = { up: "▲", down: "▼", flat: "■" };

// Zmiana procentowa ze strzałką i kolorem (zielony wzrost, czerwony spadek)
export function Change({
  value,
  label,
  className = "",
}: {
  value: number | null | undefined;
  label?: string;
  className?: string;
}) {
  const t = trend(value);
  return (
    <span className={`tabular whitespace-nowrap ${COLORS[t]} ${className}`}>
      {value == null ? "—" : `${ARROWS[t]} ${formatPct(value).replace(/^[+-]/, "")}`}
      {label && <span className="ml-1 font-sans text-muted">{label}</span>}
    </span>
  );
}
