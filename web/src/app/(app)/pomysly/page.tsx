import Link from "next/link";
import { Change } from "@/components/change";
import { EmptyState, PageHeader } from "@/components/page-header";
import { formatDateTime, formatNumber, formatPct } from "@/lib/format";
import { podsumowanie, wynikiPomyslow, type WynikPomyslu } from "@/lib/pomysly";

function Wynik({ label, z }: { label: string; z: WynikPomyslu["zmiany"]["teraz"] }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] text-muted">{label}</div>
      {z ? (
        <>
          <Change value={z.zmiana} className="text-sm" />
          {z.rynek != null && <div className="tabular text-[11px] text-muted">rynek {formatPct(z.rynek)}</div>}
        </>
      ) : (
        <div className="text-sm text-muted">—</div>
      )}
    </div>
  );
}

function Podsumowanie({ tytul, s }: { tytul: string; s: ReturnType<typeof podsumowanie> }) {
  if (!s) return null;
  return (
    <div className="card p-4">
      <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">{tytul}</div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="tabular gold text-3xl">
          {s.trafione}/{s.liczba}
        </span>
        <span className="text-sm text-muted">poszło w zapowiadanym kierunku</span>
      </div>
      <p className="mt-2 text-sm">
        Średni wynik: <span className={s.sredni >= 0 ? "text-up" : "text-down"}>{formatPct(s.sredni)}</span>
        {s.rynek != null && (
          <>
            {" "}
            · rynek w tym czasie: <span className="text-muted">{formatPct(s.rynek)}</span>
          </>
        )}
      </p>
      {s.zRynkiem > 0 && (
        <p className="mt-1 text-xs text-muted">
          Lepiej niż rynek: {s.lepszeOdRynku} z {s.zRynkiem}
        </p>
      )}
    </div>
  );
}

export default async function IdeasPage() {
  const { wyniki, error, naZywo } = await wynikiPomyslow();
  const po7 = podsumowanie(wyniki, "d7");
  const po30 = podsumowanie(wyniki, "d30");
  const najstarszy = wyniki.at(-1)?.created_at;

  return (
    <>
      <PageHeader title="💡 Wyniki pomysłów" subtitle="Czy „Pomysły do rozważenia” z raportów się sprawdzają" back="/" />

      {error && <p className="card border-down/40 p-3 text-sm text-down">Nie udało się pobrać pomysłów: {error}</p>}

      {!error && wyniki.length === 0 && (
        <EmptyState>Brak pomysłów. Pojawią się po najbliższym podsumowaniu dnia z n8n.</EmptyState>
      )}

      {wyniki.length > 0 && (
        <div className="space-y-5">
          {po7 || po30 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Podsumowanie tytul="Po 7 dniach" s={po7} />
              <Podsumowanie tytul="Po 30 dniach" s={po30} />
            </div>
          ) : (
            <div className="card p-4 text-sm text-muted">
              Pierwsze wyniki po 7 dniach od pomysłu
              {najstarszy ? ` (pomysł z ${formatDateTime(najstarszy)} — wynik od ${formatDateTime(new Date(new Date(najstarszy).getTime() + 7 * 864e5).toISOString())})` : ""}
              . Na razie widać tylko zmianę od pomysłu do dziś.
            </div>
          )}

          <p className="text-xs leading-relaxed text-muted">
            ↑ = szansa na wzrost (trafiony, gdy kurs rośnie), ↓ = ostrzeżenie (trafiony, gdy kurs spada). „Rynek” to WIG20
            dla spółek z GPW i S&amp;P 500 dla spółek z USA, w tym samym okresie. Ten sam pomysł powtórzony w kolejnych
            raportach liczymy raz. Kurs „dziś” {naZywo ? "na żywo" : "z ostatniego raportu"}.
          </p>

          <ul className="space-y-3">
            {wyniki.map((w) => (
              <li key={`${w.id}-${w.tekst.slice(0, 30)}`} className="card p-4">
                <div className="flex items-center justify-between gap-2 text-xs text-muted">
                  <span>
                    {formatDateTime(w.created_at)}
                    {w.powtorzen > 0 && ` · powtórzony ${w.powtorzen}×`}
                  </span>
                  <span className={w.kierunek === 1 ? "text-up" : "text-down"}>
                    {w.kierunek === 1 ? "↑ szansa na wzrost" : "↓ ostrzeżenie"}
                  </span>
                </div>
                <div className="mt-1.5 font-semibold">
                  {w.nazwa ? (
                    w.symbol ? (
                      <Link href={`/spolki/${encodeURIComponent(w.symbol)}`} className="hover:text-accent">
                        {w.nazwa} ›
                      </Link>
                    ) : (
                      w.nazwa
                    )
                  ) : (
                    <span className="text-muted">Nie rozpoznano instrumentu</span>
                  )}
                  {w.cena != null && (
                    <span className="tabular ml-2 text-sm font-normal text-muted">
                      wtedy {formatNumber(w.cena, w.cena >= 1000 ? 0 : 2)}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm leading-snug text-foreground/85">{w.tekst.replace(/\s*\[\d+\]/g, "")}</p>
                {w.nazwa && (
                  <div className="mt-3 grid grid-cols-3 gap-2 border-t border-line pt-3">
                    <Wynik label="Do dziś" z={w.zmiany.teraz} />
                    <Wynik label="Po 7 dniach" z={w.zmiany.d7} />
                    <Wynik label="Po 30 dniach" z={w.zmiany.d30} />
                  </div>
                )}
              </li>
            ))}
          </ul>

          <p className="text-xs text-muted">
            To statystyka z krótkiego okresu — kilka trafień z rzędu to jeszcze nie dowód. Informacja, nie porada
            inwestycyjna.
          </p>
        </div>
      )}
    </>
  );
}
