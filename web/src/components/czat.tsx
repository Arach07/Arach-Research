"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

// Czat AI: uchwyt ‹ przy prawej krawędzi → panel wysuwany z prawej (ok. 85% szerokości).
// Jedna rozmowa dla całej apki (trwa do zamknięcia apki — sessionStorage), AI pamięta wcześniejsze pytania.
// "Zapytaj o ten raport" pod raportami otwiera czat z tym raportem jako tematem.

type Wiadomosc = { role: "user" | "model"; text: string; blad?: boolean };
type Temat = { id: number; nazwa: string } | null;

const LIMIT_DZIENNY = 30;
const KLUCZ_ROZMOWY = "czat-rozmowa";
const KLUCZ_LIMITU = "czat-limit";

const PYTANIA_OGOLNE = ["Co jest najważniejsze dziś?", "Co to jest RSI?", "Wyjaśnij stan rynków", "Jak wygląda złoto?"];
const PYTANIA_O_RAPORT = ["Streść ten raport prościej", "Co z tego wynika?", "Wyjaśnij trudne pojęcia"];

type CzatKontekst = {
  otworz: (temat?: Temat) => void;
};
const Kontekst = createContext<CzatKontekst | null>(null);

function dzisiaj() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Warsaw" });
}

// Ile pytań zadano dziś na tym urządzeniu (zabezpieczenie przed przypadkowym wyczerpaniem limitu AI)
function licznik(zwieksz = false) {
  try {
    const zapis = JSON.parse(localStorage.getItem(KLUCZ_LIMITU) ?? "{}") as { dzien?: string; n?: number };
    const n = zapis.dzien === dzisiaj() ? (zapis.n ?? 0) : 0;
    if (zwieksz) localStorage.setItem(KLUCZ_LIMITU, JSON.stringify({ dzien: dzisiaj(), n: n + 1 }));
    return zwieksz ? n + 1 : n;
  } catch {
    return 0;
  }
}

export function CzatProvider({ children }: { children: React.ReactNode }) {
  const [otwarty, setOtwarty] = useState(false);
  const [wiadomosci, setWiadomosci] = useState<Wiadomosc[]>([]);
  const [temat, setTemat] = useState<Temat>(null);
  const [pisze, setPisze] = useState(false);
  const wczytane = useRef(false);

  // Rozmowa przetrwa przejścia między stronami i odświeżenie, znika po zamknięciu apki
  useEffect(() => {
    (async () => {
      await Promise.resolve();
      try {
        const zapis = JSON.parse(sessionStorage.getItem(KLUCZ_ROZMOWY) ?? "null") as {
          wiadomosci: Wiadomosc[];
          temat: Temat;
        } | null;
        if (zapis) {
          setWiadomosci(zapis.wiadomosci ?? []);
          setTemat(zapis.temat ?? null);
        }
      } catch {}
      wczytane.current = true;
    })();
  }, []);
  useEffect(() => {
    if (!wczytane.current) return;
    try {
      sessionStorage.setItem(KLUCZ_ROZMOWY, JSON.stringify({ wiadomosci: wiadomosci.slice(-40), temat }));
    } catch {}
  }, [wiadomosci, temat]);

  const otworz = useCallback((nowyTemat?: Temat) => {
    if (nowyTemat !== undefined) setTemat(nowyTemat);
    setOtwarty(true);
  }, []);

  const wyslij = useCallback(
    async (pytanie: string) => {
      const tekst = pytanie.trim();
      if (!tekst || pisze) return;
      if (licznik() >= LIMIT_DZIENNY) {
        setWiadomosci((w) => [
          ...w,
          { role: "user", text: tekst },
          { role: "model", text: `Dzisiejszy limit ${LIMIT_DZIENNY} pytań jest wykorzystany. Wróć jutro.`, blad: true },
        ]);
        return;
      }
      licznik(true);
      const historia = [...wiadomosci.filter((w) => !w.blad), { role: "user" as const, text: tekst }];
      setWiadomosci((w) => [...w, { role: "user", text: tekst }, { role: "model", text: "" }]);
      setPisze(true);
      const ustawOdpowiedz = (fn: (stara: string) => string, czyBlad = false) =>
        setWiadomosci((w) => {
          const kopia = [...w];
          const ostatnia = kopia[kopia.length - 1];
          kopia[kopia.length - 1] = { ...ostatnia, text: fn(ostatnia.text), blad: czyBlad || undefined };
          return kopia;
        });
      try {
        const res = await fetch("/api/czat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wiadomosci: historia.map(({ role, text }) => ({ role, text })), raport: temat?.id ?? null }),
        });
        if (!res.ok || !res.body) {
          const { blad } = (await res.json().catch(() => ({}))) as { blad?: string };
          ustawOdpowiedz(() => `⚠️ ${blad ?? "AI nie odpowiedziało. Spróbuj za chwilę."}`, true);
          return;
        }
        const reader = res.body.getReader();
        const dekoder = new TextDecoder();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          const kawalek = dekoder.decode(value, { stream: true });
          ustawOdpowiedz((stara) => stara + kawalek);
        }
        ustawOdpowiedz((stara) => stara.trim() || "⚠️ AI nie odpowiedziało. Spróbuj zadać pytanie inaczej.");
      } catch {
        ustawOdpowiedz(() => "⚠️ Brak połączenia. Spróbuj za chwilę.", true);
      } finally {
        setPisze(false);
      }
    },
    [pisze, wiadomosci, temat],
  );

  const nowaRozmowa = () => {
    setWiadomosci([]);
    setTemat(null);
  };

  return (
    <Kontekst.Provider value={{ otworz }}>
      {children}
      <Uchwyt widoczny={!otwarty} onClick={() => setOtwarty(true)} />
      <Panel
        otwarty={otwarty}
        zamknij={() => setOtwarty(false)}
        wiadomosci={wiadomosci}
        temat={temat}
        usunTemat={() => setTemat(null)}
        pisze={pisze}
        wyslij={wyslij}
        nowaRozmowa={nowaRozmowa}
      />
    </Kontekst.Provider>
  );
}

export function useCzat() {
  return useContext(Kontekst);
}

// Mały uchwyt ze strzałką przy prawej krawędzi, w złotej ramce
function Uchwyt({ widoczny, onClick }: { widoczny: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Otwórz czat AI"
      className={`fixed right-0 z-30 flex h-14 w-7 items-center justify-center rounded-l-xl border border-r-0 border-line-strong bg-card/95 text-lg text-accent shadow-lg shadow-black/40 backdrop-blur transition-all duration-300 ${
        widoczny ? "translate-x-0 opacity-100" : "pointer-events-none translate-x-full opacity-0"
      }`}
      style={{ bottom: "calc(env(safe-area-inset-bottom) + 7rem)" }}
    >
      ‹
    </button>
  );
}

function Panel({
  otwarty,
  zamknij,
  wiadomosci,
  temat,
  usunTemat,
  pisze,
  wyslij,
  nowaRozmowa,
}: {
  otwarty: boolean;
  zamknij: () => void;
  wiadomosci: Wiadomosc[];
  temat: Temat;
  usunTemat: () => void;
  pisze: boolean;
  wyslij: (pytanie: string) => void;
  nowaRozmowa: () => void;
}) {
  const [tekst, setTekst] = useState("");
  const lista = useRef<HTMLDivElement>(null);
  const pole = useRef<HTMLTextAreaElement>(null);
  const dotyk = useRef<{ x: number; y: number } | null>(null);

  // Nowa treść → przewiń na dół rozmowy
  useEffect(() => {
    lista.current?.scrollTo({ top: lista.current.scrollHeight, behavior: "smooth" });
  }, [wiadomosci, otwarty]);

  // Otwarty panel: strona pod spodem się nie przewija, Esc zamyka (komputer)
  useEffect(() => {
    if (!otwarty) return;
    const poprzedni = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const esc = (e: KeyboardEvent) => e.key === "Escape" && zamknij();
    window.addEventListener("keydown", esc);
    return () => {
      document.body.style.overflow = poprzedni;
      window.removeEventListener("keydown", esc);
    };
  }, [otwarty, zamknij]);

  const zadaj = (pytanie: string) => {
    wyslij(pytanie);
    setTekst("");
    if (pole.current) pole.current.style.height = "";
  };

  // Przesunięcie palcem w prawo zamyka panel (tylko wyraźnie poziomy ruch — pionowy to przewijanie rozmowy)
  const onTouchStart = (e: React.TouchEvent) => {
    dotyk.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!dotyk.current) return;
    const dx = e.changedTouches[0].clientX - dotyk.current.x;
    const dy = e.changedTouches[0].clientY - dotyk.current.y;
    dotyk.current = null;
    if (dx > 70 && Math.abs(dx) > Math.abs(dy) * 1.5) zamknij();
  };

  const pytania = temat ? PYTANIA_O_RAPORT : PYTANIA_OGOLNE;

  return (
    <div className={`fixed inset-0 z-40 ${otwarty ? "" : "pointer-events-none"}`} aria-hidden={!otwarty}>
      {/* Przyciemnienie — stuknięcie zamyka */}
      <button
        type="button"
        aria-label="Zamknij czat"
        tabIndex={-1}
        onClick={zamknij}
        className={`absolute inset-0 bg-black/55 transition-opacity duration-300 ${otwarty ? "opacity-100" : "opacity-0"}`}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Czat AI"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        className={`absolute inset-y-0 right-0 flex w-[86vw] max-w-[420px] flex-col border-l border-line-strong bg-background shadow-2xl shadow-black/70 transition-transform duration-300 ease-out ${
          otwarty ? "translate-x-0" : "translate-x-full"
        }`}
        style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <header className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
          <div className="min-w-0">
            <div className="font-semibold">
              💬 <span className="gold">Zapytaj o rynki</span>
            </div>
            {temat && (
              <button
                type="button"
                onClick={usunTemat}
                className="mt-1 max-w-full truncate rounded-full bg-accent/15 px-2 py-0.5 text-[11px] text-accent"
              >
                o raporcie: {temat.nazwa} ✕
              </button>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {wiadomosci.length > 0 && (
              <button type="button" onClick={nowaRozmowa} className="rounded-full px-2.5 py-1.5 text-xs text-muted hover:text-accent">
                Nowa
              </button>
            )}
            <button
              type="button"
              onClick={zamknij}
              aria-label="Zamknij"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-line text-muted hover:text-accent"
            >
              ✕
            </button>
          </div>
        </header>

        <div ref={lista} className="flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-4">
          {!wiadomosci.length && (
            <div className="text-sm text-muted">
              <p>
                Zapytaj o cokolwiek z apki — kursy, raporty, spółki, kalendarz, pomysły. Odpowiadam na podstawie najnowszych
                raportów i kursów na żywo.
              </p>
            </div>
          )}
          {wiadomosci.map((w, i) =>
            w.role === "user" ? (
              <div key={i} className="ml-8 rounded-2xl rounded-br-md bg-accent/15 px-3.5 py-2.5 text-[15px] whitespace-pre-wrap">
                {w.text}
              </div>
            ) : (
              <div
                key={i}
                className={`mr-4 rounded-2xl rounded-bl-md border px-3.5 py-2.5 text-[15px] leading-relaxed whitespace-pre-wrap ${
                  w.blad ? "border-accent/40 bg-accent/[0.06] text-accent" : "border-line bg-card"
                }`}
              >
                {w.text || <span className="inline-flex gap-1 text-muted">pisze<span className="animate-pulse">…</span></span>}
              </div>
            ),
          )}
        </div>

        <div className="border-t border-line px-3 pt-2.5 pb-3">
          {!pisze && (
            <div className="no-scrollbar -mx-3 mb-2 flex gap-2 overflow-x-auto px-3">
              {pytania.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => zadaj(p)}
                  className="shrink-0 rounded-full border border-line-strong bg-white/[0.03] px-3 py-1.5 text-xs text-foreground/85 hover:border-accent hover:text-accent"
                >
                  {p}
                </button>
              ))}
            </div>
          )}
          <form
            className="flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              zadaj(tekst);
            }}
          >
            <textarea
              ref={pole}
              value={tekst}
              rows={1}
              onChange={(e) => {
                setTekst(e.target.value);
                // Pole rośnie razem z tekstem (do ok. 4 linijek)
                e.target.style.height = "";
                e.target.style.height = `${Math.min(e.target.scrollHeight, 110)}px`;
              }}
              onKeyDown={(e) => {
                // Komputer: Enter wysyła, Shift+Enter = nowa linijka
                if (e.key === "Enter" && !e.shiftKey && !("ontouchstart" in window)) {
                  e.preventDefault();
                  zadaj(tekst);
                }
              }}
              placeholder="Napisz pytanie…"
              // 16 px — iPhone nie powiększa wtedy ekranu przy pisaniu
              className="max-h-[110px] min-w-0 flex-1 resize-none rounded-2xl border border-line-strong bg-card px-3.5 py-2.5 text-[16px] leading-snug outline-none placeholder:text-muted/70 focus:border-accent"
            />
            <button
              type="submit"
              disabled={!tekst.trim() || pisze}
              aria-label="Wyślij"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-[#f7dd9c] to-accent-deep text-lg font-semibold text-background disabled:opacity-40"
            >
              ➤
            </button>
          </form>
          <p className="mt-2 text-center text-[10.5px] text-muted">
            AI może się mylić · informacja, nie porada inwestycyjna
          </p>
        </div>
      </section>
    </div>
  );
}

// Link pod raportem: otwiera czat z tym raportem jako tematem
export function ZapytajORaport({ id, nazwa }: { id: number; nazwa: string }) {
  const czat = useCzat();
  if (!czat) return null;
  return (
    <button
      type="button"
      onClick={() => czat.otworz({ id, nazwa })}
      className="flex w-full items-center justify-center gap-2 rounded-2xl border border-line-strong bg-white/[0.03] py-3 text-sm font-medium text-accent hover:bg-accent/10"
    >
      💬 Zapytaj o ten raport
    </button>
  );
}
