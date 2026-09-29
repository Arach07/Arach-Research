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
        : '') +
      (i.rsi != null ? ` | RSI(14): ${Math.round(i.rsi)}` : '') +
      (i.odSma200 != null ? ` | vs średnia 200 dni: ${fmtPct(i.odSma200)}` : '') +
      (i.odSma50 != null ? ` | vs średnia 50 dni: ${fmtPct(i.odSma50)}` : '') +
      (i.opisPl ? ` | ${i.opisPl}` : '');

// ---------- Analiza techniczna (liczona z historii kursów) ----------

const srednia = (seria, n) => (seria.length >= n ? seria.slice(-n).reduce((s, x) => s + x, 0) / n : null);

// RSI (14 sesji, metoda Wildera): <30 = wyprzedana, >70 = wykupiona
function rsi(seria, n = 14) {
  if (seria.length <= n) return null;
  let zysk = 0;
  let strata = 0;
  for (let i = 1; i <= n; i++) {
    const d = seria[i] - seria[i - 1];
    if (d >= 0) zysk += d;
    else strata -= d;
  }
  zysk /= n;
  strata /= n;
  for (let i = n + 1; i < seria.length; i++) {
    const d = seria[i] - seria[i - 1];
    zysk = (zysk * (n - 1) + Math.max(d, 0)) / n;
    strata = (strata * (n - 1) + Math.max(-d, 0)) / n;
  }
  return strata === 0 ? 100 : 100 - 100 / (1 + zysk / strata);
}

function techniczne(seria) {
  const cena = seria[seria.length - 1];
  const sma50 = srednia(seria, 50);
  const sma200 = srednia(seria, 200);
  // Czy tydzień (5 sesji) temu kurs był nad średnią 200 dni — do porównania "szerokości rynku"
  const tydzien = seria.slice(0, -5);
  const sma200Tydzien = srednia(tydzien, 200);
  return {
    rsi: rsi(seria),
    sma50,
    sma200,
    odSma50: pct(cena, sma50),
    odSma200: pct(cena, sma200),
    nadTrendemTydzienTemu: sma200Tydzien != null ? tydzien[tydzien.length - 1] > sma200Tydzien : null,
  };
}

// Spółka: rok notowań z Yahoo — kurs, zmiany, wykres 30 sesji, odległość od rocznego szczytu/dołka
// i wskaźniki techniczne (RSI, średnie 50/200 dni)
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
    ...techniczne(seria),
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

async function zGodzinowych(symbol) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=3mo&interval=1h`;
    const r = (await http(url)).chart.result[0];
    const cl = r.indicators.quote[0].close;
    const dni = new Map();
    (r.timestamp ?? []).forEach((t, i) => {
      if (cl[i] != null) dni.set(new Date(t * 1000).toLocaleDateString('sv-SE', { timeZone: 'Europe/Warsaw' }), cl[i]);
    });
    return [...dni.values()];
  } catch {
    return [];
  }
}

async function yahoo(symbol, nazwa, jednostka) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=2mo&interval=1d`;
  const r = (await http(url)).chart.result[0];
  const closes = r.indicators.quote[0].close.filter((x) => x != null);
  const zrodlo = `https://finance.yahoo.com/quote/${encodeURIComponent(symbol)}`;
  if (closes.length > 21) return instrument(nazwa, jednostka, closes, { zrodlo });
  // Dla indeksów GPW (WIG20, WIG) Yahoo nie ma historii dziennej, ale ma godzinową —
  // dzienne zamknięcie = ostatnia wartość godzinowa danego dnia (czas warszawski)
  const dzienne = await zGodzinowych(symbol);
  if (dzienne.length > 21) {
    return instrument(nazwa, jednostka, [...dzienne.slice(0, -1), r.meta.regularMarketPrice], { zrodlo });
  }
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
  { symbol: 'NVO', nazwa: 'Novo Nordisk', zapytanie: 'Novo Nordisk akcje', filtr: /novo|wegovy|ozempic/i },
  { symbol: 'ASML', nazwa: 'ASML', zapytanie: 'ASML akcje', filtr: /asml/i },
  { symbol: 'XTB.WA', nazwa: 'XTB', zapytanie: 'XTB akcje', filtr: /\bxtb\b/i },
  { symbol: 'PEO.WA', nazwa: 'Pekao', zapytanie: 'Pekao akcje', filtr: /pekao/i },
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

// ---------- Szerokość rynku i sygnały techniczne ----------

const zTrendem = zDanymi.filter((s) => s.odSma200 != null);
const szerokosc = {
  nad: zTrendem.filter((s) => s.odSma200 >= 0).length,
  pod: zTrendem.filter((s) => s.odSma200 < 0).length,
  wszystkie: zTrendem.length,
  nadTydzienTemu: zTrendem.filter((s) => s.nadTrendemTydzienTemu).length,
};
const sygnaly = [
  `Szerokość rynku: ${szerokosc.nad} z ${szerokosc.wszystkie} spółek nad średnią 200 dni (tydzień temu ${szerokosc.nadTydzienTemu})`,
  ...zDanymi.filter((s) => s.rsi != null && s.rsi <= 30).map((s) => `${s.nazwa}: RSI ${Math.round(s.rsi)} — wyprzedana`),
  ...zDanymi.filter((s) => s.rsi != null && s.rsi >= 70).map((s) => `${s.nazwa}: RSI ${Math.round(s.rsi)} — wykupiona`),
  ...zDanymi
    .filter((s) => s.odSma200 != null && Math.abs(s.odSma200) <= 2)
    .map((s) => `${s.nazwa}: blisko średniej 200 dni (${fmtPct(s.odSma200)}) — test ważnego poziomu`),
];

// ---------- Makro: stopy, obligacje, waluty, surowce, nastroje ----------

const zGrupa = (grupa, lista) => lista.map((i) => ({ ...i, grupa }));
const walutaNbp = async (kod, nazwa) => {
  const r = (await http(`https://api.nbp.pl/api/exchangerates/rates/a/${kod}/last/30/?format=json`)).rates;
  return instrument(nazwa, 'zł', r.map((x) => x.mid), {
    cyfry: 4,
    zrodlo: `https://api.nbp.pl/api/exchangerates/rates/a/${kod}/last/30/?format=json`,
  });
};
const stopaNbp = await bezpiecznie('Stopa NBP', async () => {
  const xml = await http('https://static.nbp.pl/dane/stopy/stopy_procentowe.xml', false);
  const ref = xml.match(/id="ref"[\s\S]*?oprocentowanie="([\d,]+)"[\s\S]*?trend\s*=\s*"([^"]*)"[\s\S]*?obowiazuje_od="([^"]+)"/);
  if (!ref) throw new Error('brak stopy referencyjnej');
  return [
    {
      nazwa: 'Stopa referencyjna NBP',
      jednostka: '%',
      wartosc: Number(ref[1].replace(',', '.')),
      cyfry: 2,
      d1: null,
      d7: null,
      d30: null,
      seria: [],
      zrodlo: 'https://nbp.pl/polityka-pieniezna/decyzje-rpp/podstawowe-stopy-procentowe-nbp/',
      opisPl: `obowiązuje od ${ref[3]}, ostatni ruch: ${ref[2]}`,
    },
  ];
});
const fearGreed = await bezpiecznie('Fear & Greed (krypto)', async () => {
  const f = (await http('https://api.alternative.me/fng/?limit=8')).data;
  const pl = { 'Extreme Fear': 'skrajny strach', Fear: 'strach', Neutral: 'neutralnie', Greed: 'chciwość', 'Extreme Greed': 'skrajna chciwość' };
  return [
    {
      nazwa: 'Fear & Greed (krypto)',
      jednostka: '/100',
      wartosc: Number(f[0].value),
      cyfry: 0,
      d1: null,
      d7: pct(Number(f[0].value), Number(f[7].value)),
      d30: null,
      seria: f.map((x) => Number(x.value)).reverse(),
      zrodlo: 'https://alternative.me/crypto/fear-and-greed-index/',
      opisPl: pl[f[0].value_classification] ?? f[0].value_classification,
    },
  ];
});
const makro = [
  ...zGrupa('stopy', [
    ...stopaNbp,
    ...(await bezpiecznie('USA 10 lat', async () => [await yahoo('^TNX', 'Obligacje USA 10 lat', '%')])),
  ]),
  ...zGrupa('waluty', [
    ...usdPln,
    ...(await bezpiecznie('EUR/PLN', async () => [await walutaNbp('eur', 'EUR/PLN')])),
    ...(await bezpiecznie('CHF/PLN', async () => [await walutaNbp('chf', 'CHF/PLN')])),
  ]),
  ...zGrupa('surowce', [
    ...(await bezpiecznie('Ropa Brent', async () => [await yahoo('BZ=F', 'Ropa Brent', 'USD')])),
    ...(await bezpiecznie('Miedź', async () => [await yahoo('HG=F', 'Miedź', 'USD')])),
    ...(await bezpiecznie('Srebro', async () => [await yahoo('SI=F', 'Srebro', 'USD')])),
  ]),
  ...zGrupa('nastroje', [
    ...(await bezpiecznie('VIX', async () => [await yahoo('^VIX', 'VIX (strach na akcjach)', 'pkt')])),
    ...fearGreed,
  ]),
  ...zGrupa('swiat', [...(await bezpiecznie('DAX', async () => [await yahoo('^GDAXI', 'DAX (Niemcy)', 'pkt')]))]),
];

// ---------- Kalendarz: dane makro (Forex Factory) + wyniki spółek z USA (Nasdaq) ----------

const KRAJE = { USD: '🇺🇸 USA', EUR: '🇪🇺 Strefa euro', CNY: '🇨🇳 Chiny', GBP: '🇬🇧 W. Brytania', JPY: '🇯🇵 Japonia' };
const wydarzenia = [];
try {
  const xml = await http('https://nfs.faireconomy.media/ff_calendar_thisweek.xml', false);
  const pole = (e, n) => czysc(tag(e, n) ?? '');
  for (const e of xml.split('<event>').slice(1)) {
    const kraj = pole(e, 'country');
    const waznosc = pole(e, 'impact');
    // Ważne dla nas: wszystkie "High" z głównych gospodarek + "Medium" z USA i strefy euro
    if (!KRAJE[kraj] || !(waznosc === 'High' || (waznosc === 'Medium' && (kraj === 'USD' || kraj === 'EUR')))) continue;
    const [mm, dd, rrrr] = pole(e, 'date').split('-');
    const g = pole(e, 'time').match(/(\d+):(\d+)(am|pm)/i);
    let data = null;
    if (g) {
      const h = (Number(g[1]) % 12) + (g[3].toLowerCase() === 'pm' ? 12 : 0);
      data = new Date(Date.UTC(Number(rrrr), Number(mm) - 1, Number(dd), h, Number(g[2]))).toISOString();
    } else {
      data = new Date(Date.UTC(Number(rrrr), Number(mm) - 1, Number(dd), 12)).toISOString();
    }
    if (new Date(data).getTime() < Date.now() - 6 * 3600 * 1000) continue; // pomijamy to, co już dawno było
    wydarzenia.push({
      data,
      caly_dzien: !g,
      kraj: KRAJE[kraj],
      nazwa: pole(e, 'title'),
      waznosc: waznosc === 'High' ? 'wysoka' : 'średnia',
      prognoza: pole(e, 'forecast') || null,
      poprzednio: pole(e, 'previous') || null,
      typ: 'makro',
    });
  }
} catch {}
const SPOLKI_USA = SPOLKI.filter((s) => !s.symbol.includes('.'));
for (let i = 0; i < 14; i++) {
  const dzien = new Date(Date.now() + i * 864e5).toISOString().slice(0, 10);
  try {
    const j = await http(`https://api.nasdaq.com/api/calendar/earnings?date=${dzien}`);
    for (const row of j?.data?.rows ?? []) {
      const s = SPOLKI_USA.find((x) => x.symbol === row.symbol);
      if (!s) continue;
      wydarzenia.push({
        data: new Date(`${dzien}T12:00:00Z`).toISOString(),
        caly_dzien: true,
        kraj: '🏢 Wyniki',
        nazwa: `${s.nazwa} publikuje wyniki kwartalne${/after/i.test(row.time ?? '') ? ' (po sesji)' : /pre/i.test(row.time ?? '') ? ' (przed sesją)' : ''}`,
        waznosc: 'wysoka',
        prognoza: row.epsForecast ? `EPS ${row.epsForecast}` : null,
        poprzednio: null,
        typ: 'wyniki',
      });
    }
  } catch {
    break; // Nasdaq nie odpowiada — pomijamy wyniki
  }
}
wydarzenia.sort((a, b) => a.data.localeCompare(b.data));
const kalendarzTekst = wydarzenia.slice(0, 25).map(
  (w) =>
    `${new Date(w.data).toLocaleString('pl-PL', { timeZone: 'Europe/Warsaw', weekday: 'short', day: '2-digit', month: '2-digit', ...(w.caly_dzien ? {} : { hour: '2-digit', minute: '2-digit' }) })} ${w.kraj}: ${w.nazwa} (ważność: ${w.waznosc}${w.prognoza ? `, prognoza ${w.prognoza}` : ''}${w.poprzednio ? `, poprzednio ${w.poprzednio}` : ''})`,
);

// ---------- Rekomendacje analityków (z newsów: RSS + Google News) ----------

// Granice słów liczone ręcznie (JS nie traktuje "ą", "ę" itd. jako liter), żeby nie łapać
// "s-kupuj-e akcje" ani "kupuj-ącym". "upgrade/downgrade" tylko w kontekście ratingu (nie "upgrade sieci").
const REKOMENDACJA = /rekomendac|cen[ayę] docelow|(^|[^a-ząćęłńóśźż])(kupuj|trzymaj|sprzedaj|akumuluj|redukuj)(?![a-ząćęłńóśźż])|overweight|underweight|outperform|underperform|price target|(upgrade|downgrade)[sd]?\b.{0,40}\b(to (buy|sell|hold|neutral|overweight|underweight|outperform)|rating)|(podnosi|obniża|podtrzymuje) (ocen|rekomend|cen[ęy] docelow)/i;
// Spółka, której nazwa pada w tytule NAJWCZEŚNIEJ (np. "Allegro … menedżerki z Amazona" → Allegro)
const spolkaZTytulu = (tytul) =>
  SPOLKI.map((s) => ({ s, i: tytul.search(s.filtr) }))
    .filter((x) => x.i >= 0)
    .sort((a, b) => a.i - b.i)[0]?.s.nazwa ?? null;
const wszystkieNewsy = [
  ...(await Promise.all(Object.keys(RSS).map(pobierzKanal))).flat(),
  ...(await newsyOSpolce({ nazwa: 'Rekomendacje', zapytanie: 'rekomendacja akcje cena docelowa' }, 12)),
  ...newsySpolek,
];
const widzianeRek = new Set();
const rekomendacje = wszystkieNewsy
  .filter((n) => REKOMENDACJA.test(n.tytul))
  .filter((n) => {
    const t = new Date(n.data ?? 0).getTime();
    return !t || t >= Date.now() - 4 * 864e5;
  })
  .filter((n) => !widzianeRek.has(n.tytul) && widzianeRek.add(n.tytul))
  .map((n) => ({ ...n, spolka: spolkaZTytulu(n.tytul) }))
  .sort((a, b) => Number(Boolean(b.spolka)) - Number(Boolean(a.spolka)))
  .slice(0, 12)
  .map((n, i) => ({
    ...n,
    nr: i + 1,
    opis: n.spolka ?? 'rekomendacja',
    data: n.data instanceof Date ? n.data.toISOString() : n.data,
  }));

// ---------- Co się zmieniło od ostatniego raportu (pamięć workflowu) ----------
// n8n zapamiętuje kursy między automatycznymi uruchomieniami (przy ręcznym teście pamięć może być pusta).

const pamiec = $getWorkflowStaticData('global');
const poprzedni = pamiec.ostatniRaport ?? null;
const kluczowe = [...zloto, ...zlotoUsd, ...gpw, ...usa, ...krypto, ...usdPln, ...makro.filter((m) => m.grupa === 'surowce'), ...zDanymi]
  .filter((i) => !i.blad && i.wartosc != null);
const odOstatniego = [];
if (poprzedni?.ceny) {
  const zmiany = kluczowe
    .filter((i) => poprzedni.ceny[i.nazwa] != null)
    .map((i) => ({ nazwa: i.nazwa, zmiana: pct(i.wartosc, poprzedni.ceny[i.nazwa]) }))
    .filter((z) => z.zmiana != null && Math.abs(z.zmiana) >= 0.05);
  const godzina = new Date(poprzedni.czas).toLocaleString('pl-PL', { timeZone: 'Europe/Warsaw', weekday: 'short', hour: '2-digit', minute: '2-digit' });
  odOstatniego.push(
    `Poprzedni raport: ${godzina}`,
    `Najmocniej w górę od tamtej pory: ${zmiany.filter((z) => z.zmiana > 0).sort((a, b) => b.zmiana - a.zmiana).slice(0, 4).map((z) => `${z.nazwa} ${fmtPct(z.zmiana)}`).join(', ') || 'brak'}`,
    `Najmocniej w dół od tamtej pory: ${zmiany.filter((z) => z.zmiana < 0).sort((a, b) => a.zmiana - b.zmiana).slice(0, 4).map((z) => `${z.nazwa} ${fmtPct(z.zmiana)}`).join(', ') || 'brak'}`,
  );
} else {
  odOstatniego.push('Brak danych z poprzedniego raportu (pierwsze uruchomienie po zmianie).');
}
pamiec.ostatniRaport = { czas: new Date().toISOString(), ceny: Object.fromEntries(kluczowe.map((i) => [i.nazwa, i.wartosc])) };

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
    dodatkowe: [...ruchy, ...sygnaly],
    // Dla apki: szerokość rynku i rekomendacje (strona każdej spółki pokazuje swoje)
    extra: { szerokosc, rekomendacje },
    newsy: newsySpolek,
    prompt:
      'Duże spółki z USA i GPW (Nvidia, AMD, CD Projekt, Orlen itd.). WYJĄTEK od liczby punktów: 6-10 punktów, po jednym na spółkę wartą uwagi (największe ruchy dnia/miesiąca, duża odległość od rocznego szczytu, skrajne RSI albo ważny news). W każdym punkcie: nazwa spółki, liczby (zmiana, RSI, pozycja wobec średniej 200 dni), POWÓD ruchu z newsów z numerem źródła, a jeśli pasuje — krótka uwaga typu "może być warta dalszej analizy, bo …" albo "ostrożnie, bo …". Na końcu "Podsumowanie:".',
  },
  {
    category: 'makro',
    title: 'Makro',
    instrumenty: makro,
    newsy: await newsy(
      [...PL, ...US],
      /stop[ya] procent|rpp|\bfed\b|ebc|\becb\b|inflac|cpi|pkb|gdp|obligac|rentowno|treasur|yield|rop[ay]|brent|opec|dolar|euro|frank|miedź|miedzi|recesj/i,
    ),
    prompt:
      'Makro w 3-5 punktach: co mówią stopy procentowe (NBP), rentowności obligacji USA, waluty, surowce (ropa, miedź, srebro) i wskaźniki nastrojów (VIX, Fear & Greed) — i jak to wpływa na akcje, złoto i złotówkę. Konkretne liczby z TWARDYCH DANYCH. Na końcu "Podsumowanie:".',
  },
  {
    category: 'kalendarz',
    title: 'Kalendarz',
    instrumenty: [],
    dodatkowe: kalendarzTekst.length ? kalendarzTekst : ['Brak ważnych wydarzeń w kalendarzu na najbliższe dni.'],
    extra: { wydarzenia },
    newsy: [],
    prompt:
      'Kalendarz: wybierz 3-6 najważniejszych wydarzeń z TWARDYCH DANYCH (daty są w czasie polskim) i w 1 zdaniu wyjaśnij, dlaczego każde jest ważne dla inwestora w Polsce (np. inflacja w USA → decyzje Fed → dolar i akcje). Nazwy wskaźników przetłumacz na polski. Bez "Podsumowanie:".',
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
// Newsy dla podsumowania: najważniejsze z tematów + wszystkie rekomendacje (żeby dało się je cytować)
const newsyDnia = [
  ...tematy.filter((t) => t.category !== 'kalendarz').flatMap((t) => t.newsy.slice(0, t.category === 'spolki' ? 6 : 3)),
  ...rekomendacje.filter((r) => !tematy.some((t) => t.newsy.slice(0, 6).some((n) => n.tytul === r.tytul))),
].map((n, i) => ({ ...n, nr: i + 1 }));
const makroSkrot = makro
  .filter((i) => !i.blad)
  .map((i) => `${i.nazwa}: ${fmtNum(i.wartosc, i.cyfry)} ${i.jednostka}${i.d30 != null ? ` (miesiąc ${fmtPct(i.d30)})` : ''}${i.opisPl ? ` — ${i.opisPl}` : ''}`);
tematy.push({
  category: 'dzien',
  title: 'Podsumowanie dnia',
  instrumenty: [...pierwszy(zloto), ...pierwszy(gpw), ...pierwszy(usa), ...pierwszy(krypto), ...pierwszy(usdPln)],
  dodatkowe: [
    '— RUCHY SPÓŁEK —', ...ruchy,
    '— SYGNAŁY TECHNICZNE —', ...sygnaly,
    '— OD OSTATNIEGO RAPORTU —', ...odOstatniego,
    '— MAKRO —', ...makroSkrot,
    '— KALENDARZ (czas polski) —', ...(kalendarzTekst.slice(0, 10).length ? kalendarzTekst.slice(0, 10) : ['brak ważnych wydarzeń']),
  ],
  newsy: newsyDnia,
  prompt: `Rozbudowany RAPORT DNIA dla inwestora indywidualnego (ok. 500-800 słów — może być długi, czytelnik czyta go raz, dokładnie). WYJĄTEK od domyślnego formatu: podziel tekst na sekcje. Każda sekcja zaczyna się od osobnej linii z samą nazwą sekcji i dwukropkiem, dokładnie w tej kolejności:
Co się stało:
Od ostatniego raportu:
Co przed nami:
Makro w pigułce:
Sygnały techniczne:
Spółki w ruchu:
Rekomendacje dnia:
Pomysły do rozważenia:
Ryzyka:
Pod nazwą sekcji: 2-4 punkty zaczynające się od "- ".
- "Co się stało" — najważniejsze wydarzenia na rynkach (liczby + źródła).
- "Od ostatniego raportu" — co się zmieniło od poprzedniego raportu (dane z sekcji OD OSTATNIEGO RAPORTU); jeśli brak danych, 1 punkt z najważniejszą zmianą dnia.
- "Co przed nami" — najważniejsze wydarzenia z KALENDARZA (dzień, godzina, dlaczego ważne; nazwy po polsku).
- "Makro w pigułce" — stopy, rentowności, dolar, ropa, nastroje (VIX, Fear & Greed) i co z tego wynika.
- "Sygnały techniczne" — szerokość rynku (ile spółek nad średnią 200 dni vs tydzień temu), spółki wyprzedane/wykupione (RSI), testy średniej 200 dni. Wyjaśniaj po ludzku, co znaczy dany sygnał.
- "Spółki w ruchu" — największe wzrosty/spadki dużych spółek i ich POWODY z newsów.
- "Rekomendacje dnia" — rekomendacje analityków z newsów (kto, dla jakiej spółki, jaka ocena, cena docelowa tylko jeśli jest w newsie, z numerem źródła). Jeśli brak — napisz to.
- "Pomysły do rozważenia" — 2-4 pomysły łączące dane: np. wyprzedana spółka (RSI) + dobry news + rekomendacja; co, dlaczego teraz (liczby + źródło), na co uważać. Sformułowania "można rozważyć", "warto przeanalizować", "dla cierpliwych", NIGDY "kup", "sprzedaj", "pewny zysk".
- "Ryzyka" — co może pójść nie tak (makro, geopolityka, zmienność, wydarzenia z kalendarza).
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
