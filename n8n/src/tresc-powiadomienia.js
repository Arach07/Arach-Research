// Klocek "Treść powiadomienia": krótka wiadomość na telefon o nowym raporcie:
//   Au ▲ 0,8%  ·  Ag ▼ 0,4%              ← tytuł (złoto i srebro, uncja z giełdy)
//   from Research                        ← dopisuje iPhone
//   WIG20 +0,7% · S&P −0,2% · BTC +0,3%
//   💡 2 pomysły (+ ewentualne ostrzeżenia)

const raporty = $('Weryfikacja źródeł').all().map((x) => x.json);
const dzien = raporty.find((r) => r.category === 'dzien')?.data ?? {};
// Instrumenty ze wszystkich tematów (złoto z tematu Złoto, srebro z Makro)
const instrumenty = new Map(
  raporty.flatMap((r) => r.data?.instrumenty ?? []).filter((i) => !i.blad).map((i) => [i.nazwa, i]),
);
const liczba = (v) => Math.abs(v).toFixed(1).replace('.', ',') + '%';

// Tytuł: złoto (Au) i srebro (Ag) ze strzałką
const strzalka = (v) => (Math.abs(v) < 0.05 ? '■ 0%' : `${v > 0 ? '▲' : '▼'} ${liczba(v)}`);
const metale = [
  ['Au', 'Złoto (1 uncja)'],
  ['Ag', 'Srebro'],
]
  .filter(([, nazwa]) => instrumenty.get(nazwa)?.d1 != null)
  .map(([symbol, nazwa]) => `${symbol} ${strzalka(instrumenty.get(nazwa).d1)}`)
  .join('  ·  ');

// Linia rynków jak dotąd (bez złota — jest w tytule)
const zmiana = (v) => (Math.abs(v) < 0.05 ? '0%' : (v > 0 ? '+' : '−') + liczba(v));
const KROTKO = { WIG20: 'WIG20', 'S&P 500': 'S&P', Bitcoin: 'BTC' };
const ruchy = (dzien.instrumenty ?? [])
  .filter((i) => !i.blad && KROTKO[i.nazwa] && i.d1 != null)
  .map((i) => `${KROTKO[i.nazwa]} ${zmiana(i.d1)}`)
  .join(' · ');

const odmiana = (n, jeden, kilka, wiele) =>
  n === 1 ? jeden : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? kilka : wiele;
const pomysly = dzien.pomysly?.length ?? 0;
const problemy = dzien.problemy?.length ?? 0;
const niezgodne = raporty.reduce((s, r) => s + (r.data?.kontrola?.niezgodne?.length ?? 0), 0);

// Ostatnia linia: pomysły i ewentualne ostrzeżenia
const dodatki = [
  pomysly ? `💡 ${pomysly} ${odmiana(pomysly, 'pomysł', 'pomysły', 'pomysłów')}` : '',
  dzien.komentarz ? '' : '⚠️ bez komentarza AI',
  problemy ? `⚠️ ${problemy} ${odmiana(problemy, 'źródło nie odpowiada', 'źródła nie odpowiadają', 'źródeł nie odpowiada')}` : '',
  niezgodne ? `⚠️ ${niezgodne} ${odmiana(niezgodne, 'liczba', 'liczby', 'liczb')} AI do sprawdzenia` : '',
]
  .filter(Boolean)
  .join(' · ');

return [
  {
    json: {
      // iPhone zawsze pokazuje tytuł (pusty zamienia na nazwę apki), więc tytułem są metale
      title: metale || 'Research',
      body: [ruchy, dodatki].filter(Boolean).join('\n') || 'Nowy raport jest gotowy',
      url: '/',
      tag: 'raport',
    },
  },
];
