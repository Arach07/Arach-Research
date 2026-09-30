// Klocek "Treść powiadomienia": krótka wiadomość na telefon o nowym raporcie.
// Dni robocze:
//   Au ▲ 0,8%  ·  Ag ▼ 0,4%              ← tytuł (złoto i srebro, uncja z giełdy)
//   from Research                        ← dopisuje iPhone
//   WIG20 +0,7% · S&P −0,2% (wt.) · BTC +0,3%   ← dzień przy danych z poprzedniej sesji
//   💡 2 pomysły (+ ewentualne ostrzeżenia)
// Sobota: 📆 Podsumowanie tygodnia (zmiany tygodniowe, bilans pomysłów); niedziela: 🔭 Przed tygodniem.

const raporty = $('Weryfikacja źródeł').all().map((x) => x.json);
const dzien = raporty.find((r) => r.category === 'dzien')?.data ?? {};
const typ = dzien.typRaportu?.kod;
// Instrumenty ze wszystkich tematów (złoto z tematu Złoto, srebro z Makro)
const instrumenty = new Map(
  raporty.flatMap((r) => r.data?.instrumenty ?? []).filter((i) => !i.blad).map((i) => [i.nazwa, i]),
);
const liczba = (v) => Math.abs(v).toFixed(1).replace('.', ',') + '%';
const zmiana = (v) => (Math.abs(v) < 0.05 ? '0%' : (v > 0 ? '+' : '−') + liczba(v));
const strzalka = (v) => (Math.abs(v) < 0.05 ? '■ 0%' : `${v > 0 ? '▲' : '▼'} ${liczba(v)}`);
// "(wt.)" przy liczbie z poprzedniej sesji — np. S&P rano pokazuje wczorajszą sesję w USA
const dzienSesji = (i) =>
  ['przed', 'poprzednia'].includes(i.sesja?.status) && i.sesja.dzien
    ? ` (${new Date(`${i.sesja.dzien}T12:00:00Z`).toLocaleDateString('pl-PL', { timeZone: 'Europe/Warsaw', weekday: 'short' })})`
    : '';

const odmiana = (n, jeden, kilka, wiele) =>
  n === 1 ? jeden : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? kilka : wiele;
const pomysly = dzien.pomysly?.length ?? 0;
const problemy = dzien.problemy?.length ?? 0;
const niezgodne = raporty.reduce(
  (s, r) => s + (r.data?.kontrola?.niezgodne?.length ?? 0) + (r.data?.kontrola?.czas?.length ?? 0),
  0,
);
const ostrzezenia = [
  dzien.komentarz ? '' : '⚠️ bez komentarza AI',
  problemy ? `⚠️ ${problemy} ${odmiana(problemy, 'źródło nie odpowiada', 'źródła nie odpowiadają', 'źródeł nie odpowiada')}` : '',
  niezgodne ? `⚠️ ${niezgodne} ${odmiana(niezgodne, 'uwaga', 'uwagi', 'uwag')} do komentarza AI` : '',
];
const KROTKO = { WIG20: 'WIG20', 'S&P 500': 'S&P', Bitcoin: 'BTC' };
const rynek = (klucz, fn) =>
  (dzien.instrumenty ?? [])
    .filter((i) => !i.blad && KROTKO[i.nazwa] && i[klucz] != null)
    .map(fn)
    .filter(Boolean)
    .join(' · ');

let title;
let linie;
if (typ === 'sobota') {
  // Podsumowanie tygodnia: zmiany tygodniowe i bilans pomysłów
  const t = dzien.tydzien;
  title = '📆 Podsumowanie tygodnia';
  linie = [
    `Tydzień: ${rynek('d7', (i) => `${KROTKO[i.nazwa]} ${zmiana(i.d7)}`)}`,
    [t?.pomysly ? `💡 Pomysły: ${t.trafione} z ${t.pomysly} trafione` : '', ...ostrzezenia].filter(Boolean).join(' · '),
  ];
} else if (typ === 'niedziela') {
  // Przed tygodniem: ile ważnych wydarzeń, krypto z weekendu, pomysły na tydzień
  const w = dzien.przedTygodniem;
  title = '🔭 Przed tygodniem';
  linie = [
    [w?.wydarzenia ? `📅 ${w.wydarzenia} ${odmiana(w.wydarzenia, 'ważne wydarzenie', 'ważne wydarzenia', 'ważnych wydarzeń')}` : '', rynek('d1', (i) => (i.nazwa === 'Bitcoin' ? `BTC ${zmiana(i.d1)}` : ''))]
      .filter(Boolean)
      .join(' · '),
    [pomysly ? `💡 ${pomysly} ${odmiana(pomysly, 'pomysł', 'pomysły', 'pomysłów')} na tydzień` : '', ...ostrzezenia].filter(Boolean).join(' · '),
  ];
} else {
  // Dni robocze: tytułem są metale (iPhone zawsze pokazuje tytuł, pusty zamienia na nazwę apki)
  title =
    [
      ['Au', 'Złoto (1 uncja)'],
      ['Ag', 'Srebro'],
    ]
      .filter(([, nazwa]) => instrumenty.get(nazwa)?.d1 != null)
      .map(([symbol, nazwa]) => `${symbol} ${strzalka(instrumenty.get(nazwa).d1)}`)
      .join('  ·  ') || 'Research';
  linie = [
    rynek('d1', (i) => `${KROTKO[i.nazwa]} ${zmiana(i.d1)}${dzienSesji(i)}`),
    [pomysly ? `💡 ${pomysly} ${odmiana(pomysly, 'pomysł', 'pomysły', 'pomysłów')}` : '', ...ostrzezenia].filter(Boolean).join(' · '),
  ];
}

return [
  {
    json: {
      title,
      body: linie.filter(Boolean).join('\n') || 'Nowy raport jest gotowy',
      url: '/',
      tag: 'raport',
    },
  },
];
