"use client";

import Link from "next/link";
import type { Instrument, Szerokosc } from "@/lib/reports";
import { formatNumber, formatPct } from "@/lib/format";
import { rsiLevel } from "@/lib/tech";
import { Change } from "./change";
import { useLiveInstrument, useLiveQuotes } from "./live-quotes";
import { Sparkline } from "./sparkline";

const BADGE = {
  green: "bg-up/12 text-up",
  red: "bg-down/12 text-down",
  blue: "bg-[#78aaff]/15 text-[#9cc2ff]",
  orange: "bg-[#ffaa5a]/15 text-[#ffb870]",
  neutral: "bg-white/[0.06] text-muted",
};

function Badge({ tone, children }: { tone: keyof typeof BADGE; children: React.ReactNode }) {
  return <span className={`whitespace-nowrap rounded-lg px-1.5 py-px text-[10.5px] ${BADGE[tone]}`}>{children}</span>;
}

// Plakietki techniczne z liczbami: trend (vs średnia 200 dni) i RSI (słowo tylko przy skrajnych wartościach)
export function TechBadges({ instrument }: { instrument: Instrument }) {
  const { odSma200, rsi } = instrument;
  const level = rsiLevel(rsi);
  return (
    <div className="flex flex-wrap gap-1.5">
      {odSma200 != null &&
        (odSma200 >= 0 ? (
          <Badge tone="green">🟢 {formatPct(odSma200)} nad trendem</Badge>
        ) : (
          <Badge tone="red">🔴 {formatPct(odSma200)} pod trendem</Badge>
        ))}
      {rsi != null &&
        (level === "oversold" ? (
          <Badge tone="blue">🔵 RSI {Math.round(rsi)} wyprzedana</Badge>
        ) : level === "overbought" ? (
          <Badge tone="orange">🟠 RSI {Math.round(rsi)} wykupiona</Badge>
        ) : (
          <Badge tone="neutral">RSI {Math.round(rsi)}</Badge>
        ))}
    </div>
  );
}

// Wiersz spółki na liście (Rynki → Spółki): kurs na żywo, wykres, zmiana, plakietki; klik = strona spółki
export function CompanyRow({ instrument: base, hasRecommendation }: { instrument: Instrument; hasRecommendation: boolean }) {
  const i = useLiveInstrument(base);
  return (
    <li>
      <Link
        href={`/spolki/${encodeURIComponent(i.symbol ?? i.nazwa)}`}
        className="block py-2.5 transition-colors hover:bg-white/[0.02]"
      >
        <div className="grid grid-cols-[1fr_4.5rem_auto] items-center gap-3">
          <div className="min-w-0">
            <div className="truncate text-sm">
              {i.nazwa}
              {hasRecommendation && <span className="ml-1 text-xs" title="Nowa rekomendacja analityka">⭐</span>}
            </div>
            <div className="tabular gold text-[15px]">
              {i.wartosc != null ? formatNumber(i.wartosc, i.wartosc > 1000 ? 0 : 2) : "—"}
              <span className="ml-1 text-[11px]">{i.jednostka === "USD" ? "$" : i.jednostka}</span>
            </div>
          </div>
          <div>{i.seria && i.seria.length > 1 && <Sparkline values={i.seria} height={26} />}</div>
          <Change value={i.d1 ?? null} className="text-right text-xs font-semibold" />
        </div>
        <div className="mt-1.5">
          <TechBadges instrument={i} />
        </div>
      </Link>
    </li>
  );
}

// Nastrój wśród spółek: ile jest nad średnią 200 dni (liczone na żywo, gdy są kursy)
export function BreadthCard({ fromReport }: { fromReport?: Szerokosc }) {
  const quotes = useLiveQuotes();
  const live = quotes?.byCategory.spolki?.filter((i) => i.odSma200 != null) ?? [];
  const above = live.length ? live.filter((i) => (i.odSma200 ?? 0) >= 0).length : (fromReport?.nad ?? 0);
  const total = live.length || fromReport?.wszystkie || 0;
  if (!total) return null;
  const percent = Math.round((above / total) * 100);
  const weekAgo = fromReport ? Math.round((fromReport.nadTydzienTemu / fromReport.wszystkie) * 100) : null;
  return (
    <div className="card p-4">
      <div className="text-xs text-muted">📊 Nastrój wśród {total} spółek</div>
      <div className="mt-1 text-[15px]">
        <b className="text-up">{above} nad trendem</b> · <b className="text-down">{total - above} pod trendem</b>
      </div>
      <div className="my-2 h-2 overflow-hidden rounded-full bg-down/35">
        <div className="h-full rounded-full bg-up" style={{ width: `${percent}%` }} />
      </div>
      <div className="text-xs text-muted">
        {percent}%{weekAgo != null && ` · tydzień temu ${weekAgo}%`} · trend = średnia z 200 dni
      </div>
    </div>
  );
}

// Analiza techniczna spółki z wyjaśnieniem po ludzku (wartości na żywo)
export function TechExplained({ instrument: base }: { instrument: Instrument }) {
  const i = useLiveInstrument(base);
  const cur = i.jednostka === "USD" ? "$" : i.jednostka;
  const level = rsiLevel(i.rsi);
  const rows: { badge: React.ReactNode; text: React.ReactNode }[] = [];

  if (i.rsi != null) {
    rows.push({
      badge:
        level === "oversold" ? (
          <Badge tone="blue">🔵 RSI {Math.round(i.rsi)}</Badge>
        ) : level === "overbought" ? (
          <Badge tone="orange">🟠 RSI {Math.round(i.rsi)}</Badge>
        ) : (
          <Badge tone="neutral">RSI {Math.round(i.rsi)}</Badge>
        ),
      text:
        level === "oversold" ? (
          <>
            Akcje <b>mocno spadły w krótkim czasie</b> — rynek może być nimi „zmęczony”. Wyprzedanie bywa okazją, ale nie
            gwarantuje odbicia.
          </>
        ) : level === "overbought" ? (
          <>
            Akcje <b>mocno urosły w krótkim czasie</b> — możliwa chwila oddechu albo korekta. Nie znaczy to, że wzrosty
            muszą się skończyć.
          </>
        ) : (
          <>Tempo zmian kursu jest umiarkowane — bez skrajnego wykupienia ani wyprzedania (RSI między 30 a 70).</>
        ),
    });
  }
  if (i.odSma200 != null && i.sma200 != null) {
    rows.push({
      badge:
        i.odSma200 >= 0 ? (
          <Badge tone="green">🟢 {formatPct(i.odSma200)} nad trendem</Badge>
        ) : (
          <Badge tone="red">🔴 {formatPct(i.odSma200)} pod trendem</Badge>
        ),
      text: (
        <>
          Kurs jest <b>{i.odSma200 >= 0 ? "powyżej" : "poniżej"} średniej z 200 dni</b> ({formatNumber(i.sma200)} {cur}) —
          długoterminowy trend jest {i.odSma200 >= 0 ? "wzrostowy" : "spadkowy"}.
          {Math.abs(i.odSma200) <= 2 && " Kurs jest tuż przy średniej — to ważny poziom, często decyduje o dalszym kierunku."}
          {i.odSma200 > 30 && " Duża odległość od średniej może oznaczać przegrzanie."}
        </>
      ),
    });
  }
  if (i.odSma50 != null && i.sma50 != null) {
    rows.push({
      badge: <Badge tone={i.odSma50 >= 0 ? "green" : "red"}>{formatPct(i.odSma50)} vs 50 dni</Badge>,
      text: (
        <>
          Średnia z 50 dni ({formatNumber(i.sma50)} {cur}) pokazuje trend krótszy, z ostatnich ~2,5 miesiąca — kurs jest
          {i.odSma50 >= 0 ? " nad nią" : " pod nią"}.
        </>
      ),
    });
  }
  if (i.odSzczytu != null) {
    rows.push({
      badge: <Badge tone={i.odSzczytu > -10 ? "green" : "red"}>{formatPct(i.odSzczytu)} od szczytu</Badge>,
      text:
        i.odSzczytu > -3 ? (
          <>Kurs jest blisko najwyższego poziomu z ostatniego roku.</>
        ) : (
          <>
            Tyle brakuje do najwyższego kursu z ostatnich 12 miesięcy. Przy dużym spadku warto sprawdzić, czy jego powód
            jest przejściowy.
          </>
        ),
    });
  }
  if (!rows.length) return null;
  return (
    <div className="card space-y-3 p-4">
      {rows.map((r, idx) => (
        <div key={idx}>
          {r.badge}
          <p className="mt-1 text-[13px] leading-snug text-foreground/85">{r.text}</p>
        </div>
      ))}
    </div>
  );
}

const MACRO_HINTS: Record<string, string> = {
  "Obligacje USA 10 lat": "wyżej = zwykle gorzej dla złota i akcji",
  "VIX (strach na akcjach)": "poniżej 20 spokojnie, powyżej 30 panika",
  "Fear & Greed (krypto)": "0 skrajny strach, 100 skrajna chciwość",
  Miedź: "ważne dla KGHM",
  "Ropa Brent": "ważne dla Orlenu i inflacji",
};

// Kafelek makro: wartość na żywo (jeśli jest), zmiana, mały wykres i podpowiedź, jak czytać
export function MacroTile({ instrument: base }: { instrument: Instrument }) {
  const i = useLiveInstrument(base);
  const hint = MACRO_HINTS[i.nazwa] ?? i.opisPl;
  const change = i.d30 ?? i.d7 ?? i.d1 ?? null;
  const changeLabel = i.d30 != null ? "30 dni" : i.d7 != null ? "tydzień" : "dzień";
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-line bg-gradient-to-b from-card to-card-2 p-3">
      <div className="text-[11px] text-muted">{i.nazwa}</div>
      <div className="tabular gold text-[17px]">
        {i.wartosc != null ? formatNumber(i.wartosc, i.cyfry ?? 2) : "—"}
        <span className="ml-1 text-[11px]">{i.jednostka === "USD" ? "$" : i.jednostka}</span>
      </div>
      {change != null && <Change value={change} label={changeLabel} className="text-[11px]" />}
      {i.seria && i.seria.length > 1 && <Sparkline values={i.seria} height={22} />}
      {hint && <div className="text-[10.5px] leading-snug text-muted">{hint}</div>}
    </div>
  );
}
