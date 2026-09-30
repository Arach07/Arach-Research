// Klocek "Treść powiadomienia": wiadomość na telefon o nowym raporcie, w osobnych linijkach:
//   (bez tytułu — iPhone sam dopisuje "from Research")
//   Złoto ▲ 0,6%   Srebro ▼ 1,2%
//   USD ▲ 0,1%   EUR ▼ 0,2%
//   💡 Pomysły: CD Projekt ↑, PKO BP ↓
//   📰 Najważniejszy news dnia (pierwszy punkt "Co się stało")
//   ⚠️ Ostrzeżenia — tylko gdy coś jest nie tak

const raporty = $('Weryfikacja źródeł').all().map((x) => x.json);
const dzien = raporty.find((r) => r.category === 'dzien')?.data ?? {};
// Wszystkie instrumenty ze wszystkich tematów (złoto z tematu Złoto, srebro i waluty z Makro)
const instrumenty = new Map(
  raporty.flatMap((r) => r.data?.instrumenty ?? []).filter((i) => !i.blad).map((i) => [i.nazwa, i]),
);

// 1. Rynki: zmiana dzienna ze strzałką
const zmiana = (v) =>
  Math.abs(v) < 0.05 ? '■ 0%' : `${v > 0 ? '▲' : '▼'} ${Math.abs(v).toFixed(1).replace('.', ',')}%`;
// Metale i waluty w osobnych linijkach — na zablokowanym ekranie iPhone'a mieści się ok. 38 znaków
const linia = (pary) =>
  pary
    .filter(([, nazwa]) => instrumenty.get(nazwa)?.d1 != null)
    .map(([krotko, nazwa]) => `${krotko} ${zmiana(instrumenty.get(nazwa).d1)}`)
    .join('   ');
const metale = linia([['Złoto', 'Złoto (1 uncja)'], ['Srebro', 'Srebro']]);
const waluty = linia([['USD', 'USD/PLN'], ['EUR', 'EUR/PLN']]);

// 2. Pomysły: nazwa instrumentu, który pada w tekście najwcześniej, + strzałka kierunku
const nazwy = [...instrumenty.keys()].map((n) => ({ pelna: n, krotka: n.replace(/\s*\(.*\)$/, '') }));
const czego = (tekst) =>
  nazwy
    .map((n) => ({ ...n, i: tekst.toLowerCase().indexOf(n.krotka.toLowerCase()) }))
    .filter((n) => n.i >= 0)
    .sort((a, b) => a.i - b.i || b.krotka.length - a.krotka.length)[0]?.krotka;
const pomysly = (dzien.pomysly ?? [])
  .map((p) => {
    const nazwa = czego(p.tekst);
    return nazwa ? `${nazwa} ${p.kierunek === -1 ? '↓' : '↑'}` : null;
  })
  .filter(Boolean);
const liniaPomyslow = pomysly.length
  ? `💡 Pomysły: ${[...new Set(pomysly)].join(', ')}`
  : dzien.pomysly?.length
    ? `💡 Pomysły: ${dzien.pomysly.length}`
    : '';

// 3. Najważniejszy news: pierwszy punkt sekcji "Co się stało", bez przypisów, skrócony
function najwazniejszy(komentarz) {
  if (!komentarz) return '';
  const linie = komentarz.split('\n').map((l) => l.trim());
  const start = linie.findIndex((l) => /^co się stało:?$/i.test(l));
  const punkt = linie.slice(start + 1).find((l) => l.startsWith('- '));
  if (!punkt) return '';
  let tekst = punkt
    .slice(2)
    .replace(/\s*\[[^\]]*\]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\.$/, '');
  if (tekst.length > 90) tekst = tekst.slice(0, 90).replace(/[\s,;:–-]+\S*$/, '') + '…';
  return `📰 ${tekst}`;
}

// 4. Ostrzeżenia (po ludzku), tylko gdy są
const ostrzezenia = [
  dzien.komentarz ? '' : 'bez komentarza AI',
  ...(dzien.problemy ?? []).map((p) => `brak danych: ${p.zrodlo.replace(/\s*\(.*\)$/, '')}`),
  (() => {
    const n = raporty.reduce((s, r) => s + (r.data?.kontrola?.niezgodne?.length ?? 0), 0);
    return n ? `${n} ${n === 1 ? 'liczba' : n < 5 ? 'liczby' : 'liczb'} AI do sprawdzenia` : '';
  })(),
].filter(Boolean);

const linie = [
  metale,
  waluty,
  liniaPomyslow,
  najwazniejszy(dzien.komentarz),
  ostrzezenia.length ? `⚠️ ${ostrzezenia.join(' · ').replace(/^./, (c) => c.toUpperCase())}` : '',
].filter(Boolean);

return [
  {
    json: {
      title: '',
      body: linie.join('\n') || 'Nowy raport jest gotowy',
      url: '/',
      tag: 'raport',
    },
  },
];
