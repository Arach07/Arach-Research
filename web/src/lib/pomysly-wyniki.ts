// Obliczanie wyników "Pomysłów do rozważenia" — bez bazy i sieci (dane podaje lib/pomysly.ts),
// więc da się to przetestować na prawdziwych raportach z historii n8n.

export type Pomysl = { tekst: string; kierunek: 1 | -1 };

export type WynikPomyslu = {
  id: number;
  created_at: string;
  tekst: string;
  kierunek: 1 | -1;
  powtorzen: number; // ile razy AI powtórzyło ten sam pomysł w kolejnych raportach
  nazwa: string | null; // rozpoznany instrument (null = nie wiadomo, czego dotyczy)
  symbol: string | null; // do linku na stronę spółki
  cena: number | null;
  benchmark: string | null;
  zmiany: Record<"d7" | "d30" | "teraz", { zmiana: number; rynek: number | null } | null>;
};

// Nazwa jak w danych (klucz migawki cen) + wzorzec w tekście pomysłu + indeks odniesienia
const INSTRUMENTY: [string, RegExp, string | null][] = [
  ["Nvidia", /nvidi/i, "S&P 500"],
  ["AMD", /\bAMD\b/, "S&P 500"],
  ["Apple", /apple/i, "S&P 500"],
  ["Microsoft", /microsoft/i, "S&P 500"],
  ["Alphabet (Google)", /alphabet|google/i, "S&P 500"],
  ["Amazon", /amazon/i, "S&P 500"],
  ["Meta", /\bmeta\b/i, "S&P 500"],
  ["Tesla", /tesl/i, "S&P 500"],
  ["Novo Nordisk", /novo/i, "S&P 500"],
  ["ASML", /asml/i, "S&P 500"],
  ["CD Projekt", /cd ?projekt/i, "WIG20"],
  ["PKO BP", /\bpko\b/i, "WIG20"],
  ["Pekao", /pekao/i, "WIG20"],
  ["Orlen", /orlen/i, "WIG20"],
  ["KGHM", /kghm/i, "WIG20"],
  ["PZU", /\bpzu\b/i, "WIG20"],
  ["LPP", /\blpp\b/i, "WIG20"],
  ["Dino Polska", /\bdino\b/i, "WIG20"],
  ["Allegro", /allegro/i, "WIG20"],
  ["XTB", /\bxtb\b/i, "WIG20"],
  ["Bitcoin", /bitcoin|\bBTC\b/i, null],
  ["Ethereum", /ethereum|\bETH\b/, null],
  ["Złoto (1 uncja)", /złot[oa](?![a-ząćęłńóśźż])|złocie|kruszc/i, null],
  ["Srebro", /srebr/i, null],
  ["Miedź", /miedź|miedzi/i, null],
  ["Ropa Brent", /\brop[aeyę](?![a-ząćęłńóśźż])|brent/i, null],
  ["WIG20", /wig20/i, null],
  ["S&P 500", /s&p/i, null],
  ["Nasdaq", /nasdaq/i, null],
];

// Instrument, którego nazwa pada w tekście NAJWCZEŚNIEJ
function rozpoznaj(tekst: string) {
  return (
    INSTRUMENTY.map(([nazwa, re, benchmark]) => ({ nazwa, benchmark, i: tekst.search(re) }))
      .filter((x) => x.i >= 0)
      .sort((a, b) => a.i - b.i)[0] ?? null
  );
}

// Ta sama logika co w n8n (klocek "Weryfikacja źródeł") — dla raportów sprzed zapisywania `pomysly`
export function pomyslyZKomentarza(komentarz: string): Pomysl[] {
  const linie = komentarz.split("\n").map((l) => l.trim());
  const start = linie.findIndex((l) => /^pomysły do rozważenia:?$/i.test(l));
  if (start < 0) return [];
  const pomysly: Pomysl[] = [];
  for (const l of linie.slice(start + 1)) {
    if (!l) continue;
    if (!l.startsWith("- ")) break;
    const tekst = l.slice(2).trim();
    pomysly.push({ tekst: tekst.replace(/^[↑↓⬆⬇]\s*/, ""), kierunek: /^[↓⬇]/.test(tekst) ? -1 : 1 });
  }
  return pomysly;
}

export type Migawka = { t: number; ceny: Record<string, number> };
export type RaportZPomyslami = { id: number; created_at: string; pomysly: Pomysl[]; ceny: Record<string, number> | null };

const DZIEN_MS = 864e5;
const pct = (teraz: number, wtedy: number) => ((teraz - wtedy) / wtedy) * 100;

// rows: podsumowania dnia od najstarszego; dzis: kursy teraz; symbole: nazwa spółki → symbol (link do strony spółki)
export function policzWyniki(
  rows: RaportZPomyslami[],
  dzis: Record<string, number>,
  symbole: Record<string, string>,
  now = Date.now(),
): WynikPomyslu[] {
  const migawki: Migawka[] = rows
    .filter((r) => r.ceny && Object.keys(r.ceny).length)
    .map((r) => ({ t: new Date(r.created_at).getTime(), ceny: r.ceny! }));

  // Cena instrumentu w pierwszym raporcie po danej chwili (np. 7 dni po pomyśle)
  const cenaPo = (nazwa: string, t: number) => migawki.find((m) => m.t >= t && m.ceny[nazwa] != null)?.ceny[nazwa] ?? null;

  const wyniki: WynikPomyslu[] = [];
  for (const r of rows) {
    const t = new Date(r.created_at).getTime();
    for (const p of r.pomysly ?? []) {
      const rozpoznany = rozpoznaj(p.tekst);
      const nazwa = rozpoznany?.nazwa ?? null;
      // Ten sam pomysł (instrument + kierunek) powtórzony w ciągu 3 dni liczymy raz — od pierwszego wystąpienia
      const wczesniejszy = nazwa
        ? wyniki.find(
            (w) => w.nazwa === nazwa && w.kierunek === p.kierunek && t - new Date(w.created_at).getTime() < 3 * DZIEN_MS,
          )
        : undefined;
      if (wczesniejszy) {
        wczesniejszy.powtorzen++;
        continue;
      }
      const cena = nazwa ? (r.ceny?.[nazwa] ?? null) : null;
      const benchmark = rozpoznany?.benchmark ?? null;
      const cenaRynku = benchmark ? (r.ceny?.[benchmark] ?? null) : null;
      const zmiana = (po: number | null, rynekPo: number | null) =>
        cena != null && po != null
          ? { zmiana: pct(po, cena), rynek: cenaRynku != null && rynekPo != null ? pct(rynekPo, cenaRynku) : null }
          : null;
      const po = (dni: number) =>
        nazwa && t + dni * DZIEN_MS <= now
          ? zmiana(cenaPo(nazwa, t + dni * DZIEN_MS), benchmark ? cenaPo(benchmark, t + dni * DZIEN_MS) : null)
          : null;
      wyniki.push({
        id: r.id,
        created_at: r.created_at,
        tekst: p.tekst,
        kierunek: p.kierunek === -1 ? -1 : 1,
        powtorzen: 0,
        nazwa,
        symbol: nazwa ? (symbole[nazwa] ?? null) : null,
        cena,
        benchmark,
        zmiany: {
          d7: po(7),
          d30: po(30),
          teraz: nazwa ? zmiana(dzis[nazwa] ?? null, benchmark ? (dzis[benchmark] ?? null) : null) : null,
        },
      });
    }
  }
  return wyniki.reverse();
}

// Podsumowanie po N dniach: ile pomysłów poszło w zapowiadanym kierunku, średni wynik i średni wynik rynku
export function podsumowanie(wyniki: WynikPomyslu[], klucz: "d7" | "d30") {
  const z = wyniki.filter((w) => w.zmiany[klucz]);
  if (!z.length) return null;
  const wynik = (w: WynikPomyslu) => w.kierunek * w.zmiany[klucz]!.zmiana;
  const zRynkiem = z.filter((w) => w.zmiany[klucz]!.rynek != null);
  return {
    liczba: z.length,
    trafione: z.filter((w) => wynik(w) > 0).length,
    sredni: z.reduce((s, w) => s + wynik(w), 0) / z.length,
    // Dla porównania: co w tym czasie zrobił rynek (w tym samym kierunku co pomysł)
    rynek: zRynkiem.length
      ? zRynkiem.reduce((s, w) => s + w.kierunek * w.zmiany[klucz]!.rynek!, 0) / zRynkiem.length
      : null,
    lepszeOdRynku: zRynkiem.filter((w) => wynik(w) > w.kierunek * w.zmiany[klucz]!.rynek!).length,
    zRynkiem: zRynkiem.length,
  };
}
