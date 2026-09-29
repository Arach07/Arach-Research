// Klocek "Dane i tematy": pobiera twarde dane z API i newsy z RSS zaufanych portali,
// a potem buduje listę tematów raportu. Nowy temat = nowa pozycja w tablicy `tematy` na dole.

const http = (url, json = true) =>
  this.helpers.httpRequest({
    url,
    json,
    headers: { 'User-Agent': 'Mozilla/5.0 (research-app)' },
    timeout: 30000,
  });

const pct = (now, before) => (before ? ((now - before) / before) * 100 : null);
const fmtPct = (v) =>
  v == null || Number.isNaN(v) ? 'b/d' : (v > 0 ? '+' : '') + v.toFixed(2).replace('.', ',') + '%';
const fmtNum = (v, digits = 2) =>
  v.toLocaleString('pl-PL', { minimumFractionDigits: digits, maximumFractionDigits: digits });

// Instrument (to widzi apka): wartość, zmiany 1 sesja / 5 sesji (tydzień) / 21 sesji (miesiąc)
// i seria do wykresu. Seria ma maks. 30 punktów.
function instrument(nazwa, jednostka, seria, { zrodlo, cyfry = 2, d1, d7, d30 } = {}) {
  const last = seria[seria.length - 1];
  const back = (n) => (seria.length > n ? seria[seria.length - 1 - n] : null);
  return {
    nazwa,
    jednostka,
    wartosc: last,
    cyfry,
    d1: d1 !== undefined ? d1 : pct(last, back(1)),
    d7: d7 !== undefined ? d7 : pct(last, back(5)),
    d30: d30 !== undefined ? d30 : pct(last, back(21)),
    seria: seria.slice(-30),
    zrodlo,
  };
}

const opis = (i) =>
  i.blad
    ? `${i.nazwa}: brak danych (${i.blad})`
    : `${i.nazwa}: ${fmtNum(i.wartosc, i.cyfry)} ${i.jednostka} | dzień ${fmtPct(i.d1)} | tydzień ${fmtPct(i.d7)} | miesiąc ${fmtPct(i.d30)}` +
      (i.odSzczytu != null
        ? ` | od szczytu 52 tyg.: ${fmtPct(i.odSzczytu)} | od dołka 52 tyg.: ${fmtPct(i.odDolka)}`
        : '');

// Spółka: rok notowań z Yahoo — kurs, zmiany, wykres 30 sesji i odległość od rocznego szczytu/dołka
async function spolka(s) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(s.symbol)}?range=1y&interval=1d`;
  const r = (await http(url)).chart.result[0];
  const closes = r.indicators.quote[0].close.filter((x) => x != null);
  const cena = r.meta.regularMarketPrice ?? closes[closes.length - 1];
  const seria = [...closes.slice(0, -1), cena];
  const max52 = Math.max(...seria);
  const min52 = Math.min(...seria);
  return {
    ...instrument(s.nazwa, r.meta.currency === 'USD' ? 'USD' : 'zł', seria, {
      zrodlo: `https://finance.yahoo.com/quote/${encodeURIComponent(s.symbol)}`,
    }),
    symbol: s.symbol,
    max52,
    min52,
    odSzczytu: pct(cena, max52),
    odDolka: pct(cena, min52),
  };
}

// Błąd jednego źródła nie wywala całego raportu
async function bezpiecznie(nazwa, fn) {
  try {
    return await fn();
  } catch (e) {
    return [{ nazwa, blad: e.message }];
  }
}

async function yahoo(symbol, nazwa, jednostka) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=2mo&interval=1d`;
  const r = (await http(url)).chart.result[0];
  const closes = r.indicators.quote[0].close.filter((x) => x != null);
  const zrodlo = `https://finance.yahoo.com/quote/${encodeURIComponent(symbol)}`;
  if (closes.length > 21) return instrument(nazwa, jednostka, closes, { zrodlo });
  // Yahoo nie ma historii dla części indeksów GPW, jest tylko zmiana dzienna
  return instrument(nazwa, jednostka, [r.meta.regularMarketPrice], {
    zrodlo,
    d1: r.meta.regularMarketChangePercent ?? null,
    d7: null,
    d30: null,
  });
}

// ---------- RSS ----------

const RSS = {
  bankier: 'https://www.bankier.pl/rss/wiadomosci.xml',
  bankierGielda: 'https://www.bankier.pl/rss/gielda.xml',
  money: 'https://www.money.pl/rss/rss.xml',
  parkiet: 'https://www.parkiet.com/rss_main',
  pb: 'https://www.pb.pl/rss/najnowsze.xml',
  insider: 'https://businessinsider.com.pl/gielda.feed',
  comparic: 'https://comparic.pl/feed/',
  cnbc: 'https://www.cnbc.com/id/100003114/device/rss/rss.html',
  marketwatch: 'https://feeds.content.dowjones.io/public/rss/mw_topstories',
  yahoo: 'https://finance.yahoo.com/news/rssindex',
  coindesk: 'https://www.coindesk.com/arc/outboundfeeds/rss/',
  cointelegraph: 'https://cointelegraph.com/rss',
  cert: 'https://cert.pl/feed/',
  sekurak: 'https://sekurak.pl/feed/',
};

const encje = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const czysc = (s = '') =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, n) => encje[n.toLowerCase()] ?? m)
    .replace(/\s+/g, ' ')
    .trim();
const tag = (xml, nazwa) => xml.match(new RegExp(`<${nazwa}[^>]*>([\\s\\S]*?)</${nazwa}>`, 'i'))?.[1];

const kanaly = {};
async function pobierzKanal(klucz) {
  if (!kanaly[klucz]) {
    kanaly[klucz] = (async () => {
      try {
        const xml = await http(RSS[klucz], false);
        return xml
          .split(/<item[\s>]/i)
          .slice(1)
          .map((it) => {
            const link = czysc(tag(it, 'link') ?? tag(it, 'guid'));
            const data = new Date(czysc(tag(it, 'pubDate') ?? tag(it, 'dc:date') ?? ''));
            return {
              tytul: czysc(tag(it, 'title')),
              opis: czysc(tag(it, 'description')).slice(0, 220),
              link,
              data: Number.isNaN(data.getTime()) ? null : data,
              domena: (() => {
                try {
                  return new URL(link).hostname.replace(/^www\./, '');
                } catch {
                  return klucz;
                }
              })(),
            };
          })
          .filter((n) => n.tytul && /^https?:\/\//.test(n.link));
      } catch {
        return []; // kanał nie odpowiada — pomijamy
      }
    })();
  }
  return kanaly[klucz];
}

// Newsy z wybranych kanałów, z ostatnich `godzin`, opcjonalnie tylko pasujące do `filtr`.
// Maks. 3 newsy z jednego portalu, żeby źródła były różnorodne.
async function newsy(klucze, filtr, godzin = 48, limit = 12, naPortal = 3) {
  const od = Date.now() - godzin * 3600 * 1000;
  const wszystkie = (await Promise.all(klucze.map(pobierzKanal))).flat();
  const widziane = new Set();
  const naDomene = {};
  return wszystkie
    .filter((n) => !n.data || n.data.getTime() >= od)
    .filter((n) => !filtr || filtr.test(n.tytul + ' ' + n.opis))
    .sort((a, b) => (b.data?.getTime() ?? 0) - (a.data?.getTime() ?? 0))
    .filter((n) => {
      // Ten sam artykuł bywa w kilku kanałach z innym ?utm_... w linku
      const klucz = n.link.split('?')[0];
      if (widziane.has(klucz) || widziane.has(n.tytul)) return false;
      widziane.add(klucz).add(n.tytul);
      naDomene[n.domena] = (naDomene[n.domena] ?? 0) + 1;
      return naDomene[n.domena] <= naPortal;
    })
    .slice(0, limit)
    .map((n, i) => ({ ...n, nr: i + 1, data: n.data?.toISOString() ?? null }));
}

// Newsy o konkretnej spółce z Google News (zbiera artykuły z wielu portali).
// Domena = portal źródłowy (z <source url>), więc filtr CERT działa tak jak dla RSS.
async function newsyOSpolce(s, naSpolke = 2) {
  try {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(`${s.zapytanie} when:3d`)}&hl=pl&gl=PL&ceid=PL:pl`;
    const xml = await http(url, false);
    return xml
      .split(/<item[\s>]/i)
      .slice(1)
      .map((it) => {
        const zrodloUrl = it.match(/<source url="([^"]+)"/)?.[1] ?? '';
        const zrodloNazwa = czysc(tag(it, 'source') ?? '');
        const tytulPelny = czysc(tag(it, 'title'));
        const data = new Date(czysc(tag(it, 'pubDate') ?? ''));
        let domena = 'news.google.com';
        try {
          domena = new URL(zrodloUrl).hostname.replace(/^www\./, '');
        } catch {}
        return {
          // Google dopisuje " - Nazwa portalu" na końcu tytułu
          tytul: zrodloNazwa && tytulPelny.endsWith(` - ${zrodloNazwa}`)
            ? tytulPelny.slice(0, -(zrodloNazwa.length + 3))
            : tytulPelny,
          opis: s.nazwa,
          link: czysc(tag(it, 'link')),
          data: Number.isNaN(data.getTime()) ? null : data,
          domena,
          spolka: s.nazwa,
        };
      })
      .filter((n) => n.tytul && /^https?:\/\//.test(n.link))
      // Google zwraca też luźno powiązane artykuły — zostawiamy tylko te, które wymieniają spółkę w tytule
      .filter((n) => !s.filtr || s.filtr.test(n.tytul))
      // Sponsorowane drużyny (np. Orlen Wisła Płock) — wyniki meczów to nie newsy giełdowe
      .filter((n) => !/\b\d{1,2}\s?:\s?\d{1,2}\b|mecz|ligi|liga|piłkar|siatkar|szczypiorn|kibic/i.test(n.tytul))
      .sort((a, b) => (b.data?.getTime() ?? 0) - (a.data?.getTime() ?? 0))
      .slice(0, naSpolke);
  } catch {
    return [];
  }
}

const PL = ['bankier', 'money', 'parkiet', 'pb', 'insider', 'comparic'];
const US = ['cnbc', 'marketwatch', 'yahoo'];

// Duże spółki śledzone w temacie "Spółki: giganci". Nowa spółka = nowa linijka.
// zapytanie = fraza do wyszukania newsów w Google News; filtr = tytuł newsa musi wymieniać spółkę.
// UWAGA: nazwy muszą być takie same jak w apce (web/src/lib/quotes.ts, SPOLKI) — tam są kursy na żywo.
const SPOLKI = [
  { symbol: 'NVDA', nazwa: 'Nvidia', zapytanie: 'Nvidia akcje', filtr: /nvidia/i },
  { symbol: 'AMD', nazwa: 'AMD', zapytanie: 'AMD akcje', filtr: /\bamd\b/i },
  { symbol: 'AAPL', nazwa: 'Apple', zapytanie: 'Apple akcje', filtr: /apple/i },
  { symbol: 'MSFT', nazwa: 'Microsoft', zapytanie: 'Microsoft akcje', filtr: /microsoft/i },
  { symbol: 'GOOGL', nazwa: 'Alphabet (Google)', zapytanie: 'Alphabet Google akcje', filtr: /alphabet|google/i },
  { symbol: 'AMZN', nazwa: 'Amazon', zapytanie: 'Amazon akcje', filtr: /amazon/i },
  { symbol: 'META', nazwa: 'Meta', zapytanie: 'Meta Platforms akcje', filtr: /\bmeta\b|facebook/i },
  { symbol: 'TSLA', nazwa: 'Tesla', zapytanie: 'Tesla akcje', filtr: /tesl/i },
  { symbol: 'CDR.WA', nazwa: 'CD Projekt', zapytanie: 'CD Projekt akcje', filtr: /cd ?projekt|cdpr|wiedźmin|cyberpunk/i },
  { symbol: 'PKO.WA', nazwa: 'PKO BP', zapytanie: 'PKO BP akcje', filtr: /\bpko\b/i },
  { symbol: 'PKN.WA', nazwa: 'Orlen', zapytanie: 'Orlen akcje', filtr: /orlen/i },
  { symbol: 'KGH.WA', nazwa: 'KGHM', zapytanie: 'KGHM akcje', filtr: /kghm/i },
  { symbol: 'PZU.WA', nazwa: 'PZU', zapytanie: 'PZU akcje', filtr: /\bpzu\b/i },
  { symbol: 'LPP.WA', nazwa: 'LPP', zapytanie: 'LPP akcje', filtr: /\blpp\b/i },
  { symbol: 'DNP.WA', nazwa: 'Dino Polska', zapytanie: 'Dino Polska akcje', filtr: /\bdino\b/i },
  { symbol: 'ALE.WA', nazwa: 'Allegro', zapytanie: 'Allegro akcje', filtr: /allegro/i },
];

// ---------- Twarde dane ----------

const zloto = await bezpiecznie('Złoto NBP (1 g)', async () => {
  const g = await http('https://api.nbp.pl/api/cenyzlota/last/30?format=json');
  return [
    instrument('Złoto NBP (1 g)', 'zł', g.map((x) => x.cena), {
      zrodlo: 'https://api.nbp.pl/api/cenyzlota/last/30?format=json',
    }),
  ];
});
const zlotoUsd = await bezpiecznie('Złoto (1 uncja)', async () => [
  await yahoo('GC=F', 'Złoto (1 uncja)', 'USD'),
]);
const usdPln = await bezpiecznie('USD/PLN', async () => {
  const r = (await http('https://api.nbp.pl/api/exchangerates/rates/a/usd/last/30/?format=json')).rates;
  return [
    instrument('USD/PLN', 'zł', r.map((x) => x.mid), {
      cyfry: 4,
      zrodlo: 'https://api.nbp.pl/api/exchangerates/rates/a/usd/last/30/?format=json',
    }),
  ];
});
const gpw = await bezpiecznie('GPW', async () => [
  await yahoo('WIG20.WA', 'WIG20', 'pkt'),
  await yahoo('WIG.WA', 'WIG', 'pkt'),
]);
const usa = await bezpiecznie('USA', async () => [
  await yahoo('^GSPC', 'S&P 500', 'pkt'),
  await yahoo('^IXIC', 'Nasdaq', 'pkt'),
  await yahoo('^DJI', 'Dow Jones', 'pkt'),
]);
const krypto = await bezpiecznie('CoinGecko', async () => {
  const cg = await http(
    'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=bitcoin,ethereum&price_change_percentage=24h,7d,30d&sparkline=true',
  );
  return cg.map((c) => {
    // sparkline to 7 dni co godzinę — co 6. punkt wystarczy do wykresu
    const seria = (c.sparkline_in_7d?.price ?? []).filter((_, i) => i % 6 === 0);
    return instrument(c.name, 'USD', [...seria, c.current_price], {
      cyfry: 0,
      zrodlo: `https://www.coingecko.com/pl/waluty/${c.id}`,
      d1: c.price_change_percentage_24h_in_currency ?? null,
      d7: c.price_change_percentage_7d_in_currency ?? null,
      d30: c.price_change_percentage_30d_in_currency ?? null,
    });
  });
});

// Spółki: kursy z rocznej historii + po 2 najnowsze newsy o każdej z Google News (równolegle)
const spolki = await Promise.all(
  SPOLKI.map((s) => bezpiecznie(s.nazwa, async () => [await spolka(s)]).then((x) => x[0])),
);
const widzianeSpolki = new Set();
const newsySpolek = (await Promise.all(SPOLKI.map((s) => newsyOSpolce(s))))
  .flat()
  .filter((n) => !widzianeSpolki.has(n.tytul) && widzianeSpolki.add(n.tytul))
  .sort((a, b) => (b.data?.getTime() ?? 0) - (a.data?.getTime() ?? 0))
  .slice(0, 28)
  .map((n, i) => ({ ...n, nr: i + 1, data: n.data?.toISOString() ?? null }));

// Największe ruchy dnia i miesiąca wśród spółek — podpowiedź dla AI, gdzie szukać tematów
const zDanymi = spolki.filter((s) => !s.blad);
const poZmianie = (klucz) => [...zDanymi].filter((s) => s[klucz] != null).sort((a, b) => a[klucz] - b[klucz]);
const ruchy = [
  `Najmocniej w dół (dzień): ${poZmianie('d1').slice(0, 3).map((s) => `${s.nazwa} ${fmtPct(s.d1)}`).join(', ')}`,
  `Najmocniej w górę (dzień): ${poZmianie('d1').slice(-3).reverse().map((s) => `${s.nazwa} ${fmtPct(s.d1)}`).join(', ')}`,
  `Najdalej od rocznego szczytu: ${poZmianie('odSzczytu').slice(0, 3).map((s) => `${s.nazwa} ${fmtPct(s.odSzczytu)}`).join(', ')}`,
  `Najmocniej w dół (miesiąc): ${poZmianie('d30').slice(0, 3).map((s) => `${s.nazwa} ${fmtPct(s.d30)}`).join(', ')}`,
];

let cert = null;
try {
  const lista = (await http('https://hole.cert.pl/domains/v2/domains.txt', false))
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
  const slowa = /invest|inwest|crypto|krypto|bitcoin|btc|gield|broker|trad|zarob|zysk|forex|lewandowski|orlen|pko|pekao|baltic|gpw|knf|nbp/i;
  const finansowe = lista.filter((d) => slowa.test(d));
  cert = {
    wszystkie: lista.length,
    finansowe: finansowe.length,
    // Lista jest alfabetyczna i bez dat — losujemy przykłady
    przyklady: [...finansowe].sort(() => Math.random() - 0.5).slice(0, 12),
  };
} catch (e) {
  cert = { blad: e.message };
}
const certTekst = cert.blad
  ? [`Lista CERT Polska: brak danych (${cert.blad})`]
  : [
      `Lista ostrzeżeń CERT Polska: ${cert.wszystkie.toLocaleString('pl-PL')} niebezpiecznych domen, w tym ${cert.finansowe.toLocaleString('pl-PL')} z nazwą sugerującą inwestycje/finanse`,
      `Przykładowe domeny z listy CERT (nie wchodzić!): ${cert.przyklady.join(', ')}`,
    ];

// ---------- Tematy ----------

const tematy = [
  {
    category: 'zloto',
    title: 'Złoto',
    instrumenty: [...zloto, ...zlotoUsd, ...usdPln],
    // "złoto/złota/złotu/złocie" = kruszec; "złoty/złotego/złotówka" = waluta — tej nie chcemy
    newsy: await newsy([...PL, ...US], /\bz[łl]ot[oau]\b|z[łl]ocie|\bgold\b|kruszc|szlachetn|srebr|silver/i, 72),
    prompt: 'Złoto: co napędza ostatnie ruchy ceny, najważniejsze newsy, prognozy banków i analityków (kto i jaki poziom).',
  },
  {
    category: 'gpw',
    title: 'GPW',
    instrumenty: [...gpw, ...usdPln],
    newsy: await newsy(
      ['bankierGielda', ...PL],
      /gpw|wig|giełd|gield|spółk|spolk|akcj|dywidend|notowa|rekomend|emisj|makler/i,
    ),
    prompt: 'Giełda w Warszawie: najważniejsze newsy o spółkach (wyniki, dywidendy, komunikaty), wzrosty i spadki, rekomendacje domów maklerskich.',
  },
  {
    category: 'usa',
    title: 'Rynek USA',
    instrumenty: usa,
    newsy: await newsy(
      US,
      /fed|s&p|nasdaq|dow|stock|wall street|earnings|inflation|rate|market|treasur|yield|tariff|economy|shares/i,
    ),
    prompt: 'Rynek akcji w USA: najważniejsze wydarzenia (Fed, dane makro, wyniki dużych spółek), nastroje i prognozy analityków.',
  },
  {
    category: 'spolki',
    title: 'Spółki: giganci',
    instrumenty: spolki,
    dodatkowe: ruchy,
    newsy: newsySpolek,
    prompt:
      'Duże spółki z USA i GPW (Nvidia, AMD, CD Projekt, Orlen itd.). WYJĄTEK od liczby punktów: 6-10 punktów, po jednym na spółkę wartą uwagi (największe ruchy dnia/miesiąca, duża odległość od rocznego szczytu albo ważny news). W każdym punkcie: nazwa spółki, liczby (zmiana, odległość od szczytu 52 tyg.), POWÓD ruchu z newsów z numerem źródła, a jeśli pasuje — krótka uwaga typu "może być warta dalszej analizy, bo …" albo "ostrożnie, bo …". Na końcu "Podsumowanie:".',
  },
  {
    category: 'krypto',
    title: 'Krypto',
    instrumenty: krypto,
    newsy: await newsy(['coindesk', 'cointelegraph', ...PL], /bitcoin|btc|ethereum|eth|krypto|crypto|etf|stablecoin|blockchain/i),
    prompt: 'Kryptowaluty: najważniejsze wydarzenia i trendy (regulacje, ETF-y, duże przepływy), prognozy analityków dla Bitcoina i Ethereum.',
  },
  {
    category: 'scamy',
    title: 'Ostrzeżenia przed scamami',
    instrumenty: [],
    dodatkowe: certTekst,
    cert,
    newsy: await newsy(
      ['cert', 'sekurak', ...PL],
      /oszust|oszuk|scam|fałszyw|falszyw|wyłudz|wyludz|phishing|podszyw|ostrzeż|ostrzez|piramid/i,
      24 * 7,
    ),
    prompt: 'Oszustwa inwestycyjne i finansowe w Polsce z ostatnich 7 dni: nowe schematy (np. fałszywe artykuły z celebrytami, "platformy AI", fałszywi doradcy), ostrzeżenia CERT/KNF/policji, jak się chronić.',
  },
];

// Podsumowanie dnia: kluczowe liczby, największe ruchy spółek i najważniejsze newsy ze wszystkich tematów
const pierwszy = (lista) => lista.filter((i) => !i.blad).slice(0, 1);
const newsyDnia = tematy
  .flatMap((t) => t.newsy.slice(0, t.category === 'spolki' ? 6 : 3))
  .map((n, i) => ({ ...n, nr: i + 1 }));
tematy.push({
  category: 'dzien',
  title: 'Podsumowanie dnia',
  instrumenty: [...pierwszy(zloto), ...pierwszy(gpw), ...pierwszy(usa), ...pierwszy(krypto), ...pierwszy(usdPln)],
  dodatkowe: ruchy,
  newsy: newsyDnia,
  prompt: `Rozbudowane podsumowanie dnia dla inwestora indywidualnego (ok. 300-450 słów). WYJĄTEK od domyślnego formatu: podziel tekst na sekcje. Każda sekcja zaczyna się od osobnej linii z samą nazwą sekcji i dwukropkiem, dokładnie tak:
Co się stało:
Co to znaczy:
Spółki w ruchu:
Pomysły do rozważenia:
Ryzyka:
Pod nazwą sekcji: 2-4 punkty zaczynające się od "- ".
- "Co się stało" — najważniejsze wydarzenia dnia na rynkach (liczby + źródła).
- "Co to znaczy" — jak te wydarzenia łączą się ze sobą (np. rentowności obligacji → złoto, dolar → spółki, wyniki → sektor).
- "Spółki w ruchu" — największe wzrosty/spadki dużych spółek i ich POWODY z newsów.
- "Pomysły do rozważenia" — 2-4 pomysły: co (spółka/instrument/sektor), dlaczego może być wart dalszej analizy teraz (konkretne liczby z danych, np. spadek od szczytu, i news ze źródłem), na co uważać. Używaj sformułowań "można rozważyć", "warto przeanalizować", "dla cierpliwych", NIGDY "kup", "sprzedaj", "pewny zysk". Nie wymyślaj cen docelowych — podawaj je tylko, jeśli są w newsach, z autorem.
- "Ryzyka" — co może pójść nie tak (makro, geopolityka, zmienność).
Na samym końcu osobna linia: "To informacja, nie porada inwestycyjna — przed decyzją zweryfikuj sam i dopasuj do swojej sytuacji."`,
});

const dzis = new Date().toLocaleDateString('pl-PL', { timeZone: 'Europe/Warsaw' });
const godz = (iso) =>
  iso
    ? new Date(iso).toLocaleString('pl-PL', {
        timeZone: 'Europe/Warsaw',
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

return tematy.map((t) => ({
  json: {
    ...t,
    title: `${t.title} — ${dzis}`,
    dzis,
    daneTekst: [...t.instrumenty.map(opis), ...(t.dodatkowe ?? [])].map((d) => '- ' + d).join('\n') || '- brak',
    newsyTekst: t.newsy.length
      ? t.newsy.map((n) => `[${n.nr}] ${godz(n.data)} ${n.domena} — ${n.tytul}. ${n.opis}`).join('\n')
      : 'Brak newsów na ten temat w zaufanych kanałach RSS.',
  },
}));
