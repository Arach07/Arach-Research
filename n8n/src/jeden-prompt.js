// Klocek "Jeden prompt": skleja wszystkie tematy w JEDNO zapytanie do Gemini.
// Darmowy Gemini ma mały dzienny limit zapytań — 1 zapytanie na raport zamiast 6.
// Gemini odpowiada obiektem JSON: { "zloto": "komentarz...", "gpw": "...", ... }.

const tematy = $input.all().map((item) => item.json);

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
      prompt: `Dzisiaj jest ${tematy[0]?.dzis ?? ''}.

Przygotuj komentarze do ${tematy.length} tematów poniżej. Odpowiedz WYŁĄCZNIE obiektem JSON z kluczami ${klucze}.
Wartością każdego klucza jest komentarz do danego tematu jako zwykły tekst (znaki nowej linii jako \\n).
Numery źródeł [n] w komentarzu odnoszą się do newsów z TEGO SAMEGO tematu.

${sekcje.join('\n\n')}`,
    },
  },
];
