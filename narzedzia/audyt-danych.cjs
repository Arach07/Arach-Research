// Audyt danych: kursy z raportu n8n porównane z tym, co źródła (Yahoo, NBP) podają TERAZ,
// plus niezależne przeliczenie zmiany dziennej. Różnice rzędu 0,0–0,2% przy świeżym raporcie = ruch cen w kilka minut.
// Użycie:  node audyt-danych.cjs        → najnowszy raport
//          node audyt-danych.cjs 78     → wykonanie nr 78 (im starsze, tym większe różnice cen — to normalne)

const { wykonanie, wyjscie, najnowszeZ, czasPl } = require('./lib.cjs');

const SYMBOLE = {
  WIG20: 'WIG20.WA',
  WIG: 'WIG.WA',
  'S&P 500': '^GSPC',
  Nasdaq: '^IXIC',
  'Dow Jones': '^DJI',
  'Złoto (1 uncja)': 'GC=F',
  Srebro: 'SI=F',
  Bitcoin: 'BTC-USD',
  Ethereum: 'ETH-USD',
  'Ropa Brent': 'BZ=F',
  Miedź: 'HG=F',
  'VIX (strach na akcjach)': '^VIX',
  'DAX (Niemcy)': '^GDAXI',
  'Obligacje USA 10 lat': '^TNX',
};

(async () => {
  const nr = process.argv[2];
  const w = nr ? wykonanie(Number(nr)) : najnowszeZ('Weryfikacja źródeł');
  const raporty = w && wyjscie(w.runData, 'Weryfikacja źródeł');
  if (!raporty) throw new Error('Brak raportu w tym wykonaniu.');
  console.log(`Raport #${w.id} z ${czasPl(w.startedAt)} vs źródła teraz\n`);

  const wszystkie = new Map();
  for (const r of raporty) for (const i of r.data.instrumenty ?? []) if (!i.blad) wszystkie.set(i.nazwa, i);

  console.log('instrument | w raporcie | teraz | różnica ceny | d1 raport | d1 niezależnie | sesja');
  for (const [nazwa, i] of wszystkie) {
    const symbol = SYMBOLE[nazwa] ?? i.symbol;
    if (!symbol) continue;
    try {
      const j = await (
        await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=5d&interval=1d`, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
        })
      ).json();
      const r = j.chart.result[0];
      const zamkniecia = r.indicators.quote[0].close.filter((x) => x != null);
      const poprzednie = zamkniecia[zamkniecia.length - 2];
      const d1 = ((r.meta.regularMarketPrice - poprzednie) / poprzednie) * 100;
      const roznica = ((i.wartosc - r.meta.regularMarketPrice) / r.meta.regularMarketPrice) * 100;
      const uwaga = Math.abs(roznica) > 1 || Math.abs((i.d1 ?? 0) - d1) > 0.3 ? '  <-- SPRAWDŹ' : '';
      console.log(
        [nazwa, i.wartosc?.toFixed(2), r.meta.regularMarketPrice?.toFixed(2), roznica.toFixed(2) + '%', i.d1?.toFixed(2), d1.toFixed(2), i.sesja?.status ?? '-'].join(' | ') + uwaga,
      );
    } catch (e) {
      console.log(`${nazwa} | błąd pobrania: ${e.message}`);
    }
  }

  const nbp = await (await fetch('https://api.nbp.pl/api/exchangerates/rates/a/usd/last/2/?format=json')).json();
  const zloto = await (await fetch('https://api.nbp.pl/api/cenyzlota/last/2?format=json')).json();
  const usd = wszystkie.get('USD/PLN');
  const zl = wszystkie.get('Złoto NBP (1 g)');
  console.log(`\nNBP USD/PLN: raport ${usd?.wartosc} | NBP teraz ${nbp.rates[1].mid} (${nbp.rates[1].effectiveDate})`);
  console.log(`NBP złoto 1 g: raport ${zl?.wartosc} | NBP teraz ${zloto[1].cena} (${zloto[1].data})`);
})().catch((e) => {
  console.error('BŁĄD:', e.message);
  process.exit(1);
});
