// Klocek "Jeden prompt": skleja wszystkie tematy w JEDNO zapytanie do Gemini.
// Darmowy Gemini ma mały dzienny limit zapytań — 1 zapytanie na raport zamiast 6.
// Gemini odpowiada obiektem JSON: { "zloto": "komentarz...", "gpw": "...", ... }.

const tematy = $input.all().map((item) => item.json);
const typ = tematy[0]?.typRaportu;
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
Pisz zgodnie ze stanem rynków: o sesji zamkniętej jako o wyniku ("GPW zakończyła sesję wzrostem…", "wczorajsza sesja w USA…"), o sesji trwającej jako o sytuacji w trakcie ("w trakcie sesji…"), a przy danych z poprzedniej sesji podaj, z którego dnia są. Nigdy nie pisz o wczorajszej sesji tak, jakby była dzisiejsza.${
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
