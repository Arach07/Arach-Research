// Klocek "Weryfikacja źródeł": sprawdza linki na liście CERT Polska i składa raport dla apki:
// - content: pełny tekst (komentarz AI + twarde dane + źródła) — zapasowo i do archiwum,
// - data: uporządkowane dane (instrumenty z wykresami, newsy, komentarz) — z tego rysuje apka.
// Gdy Gemini nie odpowie (np. limit), raport i tak powstaje — z danymi i nagłówkami newsów.

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
  const odrzucone = [...new Set(temat.newsy.filter((n) => naLiscieCert(n.domena)).map((n) => n.domena))];

  const komentarz = (item.json.mergedResponse ?? '').trim() || null;
  const numery = new Set([...(komentarz ?? '').matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1])));
  const zNumerami = newsy.map((n) => ({
    nr: n.nr,
    tytul: n.tytul,
    opis: n.opis,
    link: n.link,
    domena: n.domena,
    data: n.data,
    cytowany: numery.has(n.nr),
  }));

  // Tekst — dla archiwum i starszych widoków
  const cytowane = zNumerami.filter((n) => n.cytowany);
  const doListy = cytowane.length ? cytowane : zNumerami.slice(0, 8);
  const sekcje = [
    komentarz ??
      '⚠️ Komentarz AI niedostępny (limit Gemini). Najważniejsze nagłówki:\n' +
        zNumerami.slice(0, 8).map((n) => `- [${n.nr}] ${n.tytul} (${n.domena})`).join('\n'),
    'Twarde dane (API, liczone automatycznie):\n' + temat.daneTekst,
  ];
  const zrodlaDanych = temat.instrumenty.filter((x) => x.zrodlo);
  if (zrodlaDanych.length) {
    sekcje.push('Źródła danych:\n' + zrodlaDanych.map((x) => `- 📊 ${x.nazwa} ${x.zrodlo}`).join('\n'));
  }
  if (doListy.length) {
    sekcje.push('Źródła newsów:\n' + doListy.map((n) => `- [${n.nr}] ${n.domena} — ${n.tytul} ${n.link}`).join('\n'));
  }
  if (odrzucone.length) {
    sekcje.push('🚫 Odrzucone (lista ostrzeżeń CERT Polska): ' + odrzucone.join(', '));
  }

  return {
    json: {
      category: temat.category,
      title: temat.title,
      content: sekcje.join('\n\n'),
      data: {
        wersja: 2,
        komentarz,
        instrumenty: temat.instrumenty,
        newsy: zNumerami,
        odrzucone,
        ...(temat.cert ? { cert: temat.cert } : {}),
      },
    },
    pairedItem: { item: i },
  };
});
