// Klocek "Weryfikacja źródeł": sprawdza linki na liście CERT Polska i składa gotową treść
// raportu (komentarz AI + twarde dane + źródła). Gdy Gemini nie odpowie (np. limit),
// raport i tak powstaje — z twardymi danymi i nagłówkami newsów.

const certTxt = await this.helpers.httpRequest({
  url: 'https://hole.cert.pl/domains/v2/domains.txt',
  timeout: 30000,
});
const cert = new Set(certTxt.split('\n').map((s) => s.trim().toLowerCase()).filter(Boolean));

// "sub.bankier.pl" -> sprawdza sub.bankier.pl, bankier.pl
function naLiscieCert(domena) {
  const czesci = domena.toLowerCase().split('.');
  return czesci.slice(0, -1).some((_, i) => cert.has(czesci.slice(i).join('.')));
}

// Pętla zachowuje kolejność, więc i-ta odpowiedź Gemini = i-ty temat
const tematy = $('Dane i tematy').all();

return $input.all().map((item, i) => {
  const temat = tematy[i].json;
  const newsy = temat.newsy.filter((n) => !naLiscieCert(n.domena));
  const odrzucone = temat.newsy.filter((n) => naLiscieCert(n.domena)).map((n) => n.domena);

  const tekstAI = (item.json.mergedResponse ?? '').trim();
  let komentarz;
  let cytowane;
  if (tekstAI) {
    komentarz = tekstAI;
    const numery = new Set([...tekstAI.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1])));
    cytowane = newsy.filter((n) => numery.has(n.nr));
  } else {
    // Gemini nie odpowiedział — pokazujemy same nagłówki
    komentarz =
      '⚠️ Komentarz AI niedostępny (limit Gemini). Najważniejsze nagłówki:\n' +
      newsy.slice(0, 8).map((n) => `- [${n.nr}] ${n.tytul} (${n.domena})`).join('\n');
    cytowane = newsy.slice(0, 8);
  }
  if (!cytowane.length) cytowane = newsy.slice(0, 5);

  const sekcje = [
    komentarz || 'Brak newsów i komentarza.',
    'Twarde dane (API, liczone automatycznie):\n' + temat.daneTekst,
    'Źródła danych:\n' + temat.zrodla.map((z) => `- 📊 ${z.nazwa} ${z.url}`).join('\n'),
  ];
  if (cytowane.length) {
    sekcje.push(
      'Źródła newsów:\n' + cytowane.map((n) => `- [${n.nr}] ${n.domena} — ${n.tytul} ${n.link}`).join('\n'),
    );
  }
  if (odrzucone.length) {
    sekcje.push('🚫 Odrzucone (lista ostrzeżeń CERT Polska): ' + [...new Set(odrzucone)].join(', '));
  }

  return {
    json: { category: temat.category, title: temat.title, content: sekcje.join('\n\n') },
    pairedItem: { item: i },
  };
});
