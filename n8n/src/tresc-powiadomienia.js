// Klocek "Treść powiadomienia": krótka wiadomość na telefon o nowym raporcie —
// godzina, zmiany dnia (WIG20, S&P 500, Bitcoin, złoto), liczba pomysłów i ewentualne ostrzeżenia.

const raporty = $('Weryfikacja źródeł').all().map((x) => x.json);
const dzien = raporty.find((r) => r.category === 'dzien')?.data ?? {};

const godzina = new Date().toLocaleTimeString('pl-PL', { timeZone: 'Europe/Warsaw', hour: '2-digit', minute: '2-digit' });
const zmiana = (v) =>
  Math.abs(v) < 0.05 ? '0%' : (v > 0 ? '+' : '−') + Math.abs(v).toFixed(1).replace('.', ',') + '%';
const KROTKO = { WIG20: 'WIG20', 'S&P 500': 'S&P', Bitcoin: 'BTC', 'Złoto NBP (1 g)': 'Złoto' };
const ruchy = (dzien.instrumenty ?? [])
  .filter((i) => !i.blad && KROTKO[i.nazwa] && i.d1 != null)
  .map((i) => `${KROTKO[i.nazwa]} ${zmiana(i.d1)}`);

const odmiana = (n, jeden, kilka, wiele) =>
  n === 1 ? jeden : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? kilka : wiele;
const pomysly = dzien.pomysly?.length ?? 0;
const problemy = dzien.problemy?.length ?? 0;
const niezgodne = raporty.reduce((s, r) => s + (r.data?.kontrola?.niezgodne?.length ?? 0), 0);

const czesci = [
  ruchy.join(' · '),
  pomysly ? `💡 ${pomysly} ${odmiana(pomysly, 'pomysł', 'pomysły', 'pomysłów')}` : '',
  dzien.komentarz ? '' : '⚠️ bez komentarza AI',
  problemy ? `⚠️ ${problemy} ${odmiana(problemy, 'źródło nie odpowiada', 'źródła nie odpowiadają', 'źródeł nie odpowiada')}` : '',
  niezgodne ? `⚠️ ${niezgodne} ${odmiana(niezgodne, 'liczba', 'liczby', 'liczb')} AI do sprawdzenia` : '',
].filter(Boolean);

return [
  {
    json: {
      title: `🧠 Raport ${godzina} gotowy`,
      body: czesci.join(' · ') || 'Nowy raport jest gotowy',
      url: '/',
      tag: 'raport',
    },
  },
];
