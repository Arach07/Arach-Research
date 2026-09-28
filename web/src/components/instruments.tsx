import type { Instrument } from "@/lib/reports";
import { formatNumber } from "@/lib/format";
import { Change } from "./change";
import { Sparkline } from "./sparkline";

function Value({ instrument, className = "" }: { instrument: Instrument; className?: string }) {
  if (instrument.wartosc == null) return <span className="text-muted">brak danych</span>;
  return (
    <span className={`tabular gold ${className}`}>
      {formatNumber(instrument.wartosc, instrument.cyfry ?? 2)}
      {instrument.jednostka && instrument.jednostka !== "pkt" && (
        <span className="ml-1 text-[0.7em]">{instrument.jednostka === "USD" ? "$" : instrument.jednostka}</span>
      )}
    </span>
  );
}

// Poziomy pasek kursów na ekranie "Dziś"
export function Ticker({ instruments }: { instruments: Instrument[] }) {
  const items = instruments.filter((i) => !i.blad);
  if (!items.length) return null;
  return (
    <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
      {items.map((i) => (
        <div
          key={i.nazwa}
          className="min-w-[7.5rem] shrink-0 rounded-2xl border border-line-strong/60 bg-white/[0.03] px-3 py-2.5"
        >
          <div className="truncate text-[11px] text-muted">{i.nazwa}</div>
          <Value instrument={i} className="mt-0.5 block text-[15px]" />
          <Change value={i.d1 ?? null} className="mt-0.5 block text-[11px] font-semibold" />
        </div>
      ))}
    </div>
  );
}

// Szczegóły instrumentu: wartość, wykres, zmiany 1d/7d/30d
export function InstrumentPanel({ instrument }: { instrument: Instrument }) {
  if (instrument.blad) {
    return (
      <div className="card p-4 text-sm text-muted">
        {instrument.nazwa}: brak danych ({instrument.blad})
      </div>
    );
  }
  const seria = instrument.seria ?? [];
  return (
    <div className="card p-4">
      <div className="flex items-baseline justify-between gap-3">
        <div className="text-sm text-muted">{instrument.nazwa}</div>
        {instrument.zrodlo && (
          <a
            href={instrument.zrodlo}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-muted underline decoration-line-strong underline-offset-2"
          >
            źródło
          </a>
        )}
      </div>
      <Value instrument={instrument} className="mt-1 block text-2xl font-medium" />
      {seria.length > 1 && <Sparkline values={seria} height={56} className="mt-3" />}
      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
        {(
          [
            ["dzień", instrument.d1],
            ["tydzień", instrument.d7],
            ["miesiąc", instrument.d30],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className="rounded-xl bg-white/[0.03] py-1.5">
            <div className="text-[10px] uppercase tracking-wide text-muted">{label}</div>
            <Change value={value ?? null} className="font-semibold" />
          </div>
        ))}
      </div>
    </div>
  );
}
