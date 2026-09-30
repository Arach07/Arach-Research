// Klocek "Jeden prompt": skleja wszystkie tematy w JEDNO zapytanie do Gemini.
// Darmowy Gemini ma mały dzienny limit zapytań — 1 zapytanie na raport zamiast 6.
// Gemini odpowiada obiektem JSON: { "zloto": "komentarz...", "gpw": "...", ... }.

const tematy = $input.all().map((item) => item.json);
const typ = tematy[0]?.typRaportu;
// Wprost dla każdego rynku: jakiego czasu używać (AI lubi pisać "zakończył sesję", gdy sesja jeszcze trwa)
const JAK_PISAC = {
  trwa: (r) => `${r.rynek}: sesja TRWA — pisz "w trakcie sesji", "rośnie/spada"; NIE pisz, że ${r.rynek} "zakończył(a) sesję" ani "na zamknięciu".`,
  zamknieta: (r) => `${r.rynek}: dzisiejsza sesja ZAMKNIĘTA — pisz "zakończył(a) sesję", to wynik ostateczny dnia.`,
  przed: (r) => `${r.rynek}: dziś sesja jeszcze się NIE zaczęła — liczby są z sesji ${dzien(r.dzien)}; pisz np. "na zamknięciu sesji ${dzien(r.dzien)}", NIE "dziś".`,
  poprzednia: (r) => `${r.rynek}: dziś nie ma sesji — liczby są z ostatniej sesji (${dzien(r.dzien)}); NIE pisz "dziś".`,
};
// "wt. 29.09" — dzień sesji, z której są liczby
function dzien(d) {
  return d ? new Date(`${d}T12:00:00Z`).toLocaleDateString('pl-PL', { timeZone: 'Europe/Warsaw', weekday: 'short', day: '2-digit', month: '2-digit' }) : 'poprzedniej';
}
const zasadyCzasu = (tematy[0]?.stanRynkow ?? [])
  .filter((r) => ['GPW', 'USA'].includes(r.rynek) && JAK_PISAC[r.status])
  .map((r) => JAK_PISAC[r.status](r));
const weekend = typ?.kod === 'sobota' || typ?.kod === 'niedziela';

const sekcje = tematy.map(
  (t) => `=== TEMAT: ${t.category} ===
ZADANIE: ${t.prompt}

TWARDE DANE:
${t.daneTekst}

NEWSY (numeracja tylko w obrębie tego tematu):
${t.newsyTekst}`,
);

const klucze = tematy.map((t) => `"${t.category}"`).join(', ');

return [
  {
    json: {
      prompt: `Dzisiaj jest ${tematy[0]?.dzis ?? ''}. To raport „${typ?.nazwa ?? ''}”.

STAN RYNKÓW w chwili raportu (obowiązuje we WSZYSTKICH tematach):
${(tematy[0]?.stanTekst ?? []).map((l) => '- ' + l).join('\n')}
JAK PISAĆ O RYNKACH (obowiązkowo):
${zasadyCzasu.map((l) => '- ' + l).join('\n')}
- Krypto (Bitcoin, Ethereum) handluje się bez przerwy — nie pisz przy nich o "sesji".
- Przy liczbach z TWARDYCH DANYCH nie dopisuj źródła w nawiasie (żadnych "[dane]", "[twarde dane]") — nawiasy kwadratowe tylko z numerem newsa, np. [3].${
        weekend
          ? '\nWeekend: giełdy nie działają (poza krypto). W komentarzach do tematów pisz o minionym tygodniu i zmianach tygodniowych, a nie o "dzisiejszej sesji".'
          : ''
      }

Przygotuj komentarze do ${tematy.length} tematów poniżej. Odpowiedz WYŁĄCZNIE obiektem JSON z kluczami ${klucze}.
Wartością każdego klucza jest komentarz do danego tematu jako zwykły tekst (znaki nowej linii jako \\n).
Numery źródeł [n] w komentarzu odnoszą się do newsów z TEGO SAMEGO tematu.

${sekcje.join('\n\n')}`,
    },
  },
];
