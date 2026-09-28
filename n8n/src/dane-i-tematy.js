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
    : `${i.nazwa}: ${fmtNum(i.wartosc, i.cyfry)} ${i.jednostka} | dzień ${fmtPct(i.d1)} | tydzień ${fmtPct(i.d7)} | miesiąc ${fmtPct(i.d30)}`;

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

const PL = ['bankier', 'money', 'parkiet', 'pb', 'insider', 'comparic'];
const US = ['cnbc', 'marketwatch', 'yahoo'];

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

// Podsumowanie dnia: kluczowe liczby + po 2 najnowsze newsy z każdego tematu
const pierwszy = (lista) => lista.filter((i) => !i.blad).slice(0, 1);
const newsyDnia = tematy
  .flatMap((t) => t.newsy.slice(0, 2))
  .map((n, i) => ({ ...n, nr: i + 1 }));
tematy.push({
  category: 'dzien',
  title: 'Podsumowanie dnia',
  instrumenty: [...pierwszy(zloto), ...pierwszy(gpw), ...pierwszy(usa), ...pierwszy(krypto), ...pierwszy(usdPln)],
  newsy: newsyDnia,
  prompt:
    'Podsumowanie dnia na rynkach. WYJĄTEK od zasad o punktach: napisz tylko 2-3 krótkie zdania ciągłym tekstem, bez myślników i bez "Podsumowanie:", z numerami źródeł. Najważniejsze najpierw.',
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
