// Klocek "Weryfikacja źródeł": sprawdza źródła Gemini na liście CERT Polska
// i składa gotową treść raportu (tekst + twarde dane + źródła).

const ZAUFANE = [
  'bankier.pl', 'money.pl', 'pb.pl', 'parkiet.com', 'rp.pl', 'businessinsider.com.pl', 'forsal.pl',
  'wnp.pl', 'isbnews.pl', 'pap.pl', 'tvn24.pl', 'strefainwestorow.pl', 'comparic.pl', 'obserwatorfinansowy.pl',
  'gpw.pl', 'knf.gov.pl', 'nbp.pl', 'gov.pl', 'cert.pl', 'policja.pl', 'niebezpiecznik.pl', 'sekurak.pl',
  'zaufanatrzeciastrona.pl', 'cyberdefence24.pl', 'xtb.com', 'bossa.pl', 'mbank.pl', 'stooq.pl',
  'reuters.com', 'bloomberg.com', 'cnbc.com', 'ft.com', 'wsj.com', 'marketwatch.com', 'investing.com',
  'yahoo.com', 'apnews.com', 'bbc.com', 'economist.com', 'barrons.com', 'fool.com', 'morningstar.com',
  'federalreserve.gov', 'ecb.europa.eu', 'sec.gov', 'gold.org', 'kitco.com',
  'coindesk.com', 'cointelegraph.com', 'theblock.co', 'decrypt.co', 'coingecko.com', 'coinmarketcap.com',
];

const certTxt = await this.helpers.httpRequest({
  url: 'https://hole.cert.pl/domains/v2/domains.txt',
  timeout: 30000,
});
const cert = new Set(certTxt.split('\n').map((s) => s.trim().toLowerCase()).filter(Boolean));

// "sub.bankier.pl" -> sprawdza sub.bankier.pl, bankier.pl
function domenaIRodzice(domena) {
  const czesci = domena.split('.');
  return czesci.slice(0, -1).map((_, i) => czesci.slice(i).join('.'));
}
const naLiscie = (domena, zbior) => domenaIRodzice(domena).some((d) => zbior.has(d));
const zaufane = new Set(ZAUFANE);

// Pętla zachowuje kolejność, więc i-ta odpowiedź Gemini = i-ty temat
const tematy = $('Dane i tematy').all();

return $input.all().map((item, i) => {
  const temat = tematy[i].json;
  const chunks = item.json.groundingMetadata?.groundingChunks ?? [];

  const zrodla = [];
  const odrzucone = [];
  const widziane = new Set();
  for (const c of chunks) {
    const url = c.web?.uri;
    const domena = (c.web?.title ?? '').toLowerCase().replace(/^www\./, '').trim();
    if (!url || widziane.has(url)) continue;
    widziane.add(url);

    if (/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domena) && naLiscie(domena, cert)) {
      odrzucone.push(domena);
    } else if (naLiscie(domena, zaufane)) {
      zrodla.push(`- ✅ ${domena} ${url}`);
    } else {
      zrodla.push(`- ⚠️ ${domena || 'nieznane źródło'} ${url}`);
    }
  }

  const sekcje = [
    (item.json.mergedResponse ?? '').trim() || 'Brak odpowiedzi modelu.',
    'Twarde dane (API, liczone automatycznie):\n' + temat.daneTekst,
    'Źródła danych:\n' + temat.zrodla.map((z) => `- 📊 ${z.nazwa} ${z.url}`).join('\n'),
  ];
  if (zrodla.length) {
    sekcje.push('Źródła newsów (✅ zaufane, ⚠️ nieweryfikowane):\n' + zrodla.join('\n'));
  }
  if (odrzucone.length) {
    sekcje.push('🚫 Odrzucone źródła (lista ostrzeżeń CERT Polska): ' + [...new Set(odrzucone)].join(', '));
  }

  return {
    json: { category: temat.category, title: temat.title, content: sekcje.join('\n\n') },
    pairedItem: { item: i },
  };
});
