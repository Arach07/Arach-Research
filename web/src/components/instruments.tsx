"use client";

import type { Instrument } from "@/lib/reports";
import { formatNumber } from "@/lib/format";
import { Change } from "./change";
import { useLiveInstrument } from "./live-quotes";
import { Sparkline } from "./sparkline";

// Kursy aktualizują się same co 20 s (LiveQuotesProvider). Z live=false komponent pokazuje
// wartości z chwili raportu — tak jest w archiwum.
function useInstrument(instrument: Instrument, live: boolean) {
  const current = useLiveInstrument(instrument);
  return live ? current : instrument;
}

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

function TickerItem({ instrument }: { instrument: Instrument }) {
  const i = useInstrument(instrument, true);
  return (
    <div className="min-w-[7.5rem] shrink-0 rounded-2xl border border-line-strong/60 bg-white/[0.03] px-3 py-2.5">
      <div className="truncate text-[11px] text-muted">{i.nazwa}</div>
      <Value instrument={i} className="mt-0.5 block text-[15px]" />
      <Change value={i.d1 ?? null} className="mt-0.5 block text-[11px] font-semibold" />
    </div>
  );
}

// Poziomy pasek kursów na ekranie "Dziś"
export function Ticker({ instruments }: { instruments: Instrument[] }) {
  const items = instruments.filter((i) => !i.blad);
  if (!items.length) return null;
  return (
    <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
      {items.map((i) => (
        <TickerItem key={i.nazwa} instrument={i} />
      ))}
    </div>
  );
}

// Szczegóły instrumentu: wartość, wykres, zmiany 1d/7d/30d
export function InstrumentPanel({ instrument: base, live = false }: { instrument: Instrument; live?: boolean }) {
  const instrument = useInstrument(base, live);
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

// Wiersz na liście "Rynki": nazwa, wartość, mini-wykres, zmiana dzień/30 dni
export function MarketRow({ instrument: base }: { instrument: Instrument }) {
  const i = useInstrument(base, true);
  return (
    <li className="grid grid-cols-[1fr_5rem_auto] items-center gap-3 py-2.5">
      <div className="min-w-0">
        <div className="truncate text-sm">{i.nazwa}</div>
        <div className="tabular gold text-[15px]">
          {i.wartosc != null ? formatNumber(i.wartosc, i.cyfry ?? 2) : "—"}
          <span className="ml-1 text-[11px]">{i.jednostka !== "pkt" ? i.jednostka : ""}</span>
        </div>
      </div>
      <div>{i.seria && i.seria.length > 1 && <Sparkline values={i.seria} height={28} />}</div>
      <div className="text-right text-xs">
        <Change value={i.d1 ?? null} className="block font-semibold" />
        <Change value={i.d30 ?? null} label="30d" className="block text-[11px]" />
      </div>
    </li>
  );
}

// Zmiana i mini-wykres głównego instrumentu na karcie tematu
export function CardQuote({ instrument: base }: { instrument: Instrument }) {
  const main = useInstrument(base, true);
  return (
    <>
      <span className="chip absolute right-4 top-4">
        <Change value={main.d30 ?? main.d1 ?? null} label={main.d30 != null ? "30 dni" : "dzień"} />
      </span>
      {main.seria && main.seria.length > 1 && <Sparkline values={main.seria} height={34} className="mt-3" />}
    </>
  );
}
