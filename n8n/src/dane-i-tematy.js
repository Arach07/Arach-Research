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

// Zmiany z serii zamknięć: 1 sesja, 5 sesji (tydzień), 21 sesji (miesiąc)
function zmiany(closes) {
  const last = closes[closes.length - 1];
  const back = (n) => (closes.length > n ? closes[closes.length - 1 - n] : null);
  return { last, d1: pct(last, back(1)), d7: pct(last, back(5)), d30: pct(last, back(21)) };
}
const opisZmian = (z) =>
  `dzień ${fmtPct(z.d1)} | tydzień ${fmtPct(z.d7)} | miesiąc ${fmtPct(z.d30)}`;

// Błąd jednego źródła nie wywala całego raportu
async function bezpiecznie(nazwa, fn) {
  try {
    return await fn();
  } catch (e) {
    return [`${nazwa}: brak danych (${e.message})`];
  }
}

async function yahoo(symbol, nazwa, jednostka) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=2mo&interval=1d`;
  const r = (await http(url)).chart.result[0];
  const closes = r.indicators.quote[0].close.filter((x) => x != null);
  if (closes.length > 21) {
    const z = zmiany(closes);
    return `${nazwa}: ${fmtNum(z.last)} ${jednostka} | ${opisZmian(z)}`;
  }
  // Yahoo nie ma historii dla części indeksów GPW, jest tylko zmiana dzienna
  return `${nazwa}: ${fmtNum(r.meta.regularMarketPrice)} ${jednostka} | dzień ${fmtPct(r.meta.regularMarketChangePercent)}`;
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

const zloto = await bezpiecznie('Złoto NBP', async () => {
  const g = await http('https://api.nbp.pl/api/cenyzlota/last/30?format=json');
  const z = zmiany(g.map((x) => x.cena));
  return [
    `Złoto wg NBP (1 g, notowanie z ${g[g.length - 1].data}): ${fmtNum(z.last)} zł | ${opisZmian(z)}`,
  ];
});
const zlotoUsd = await bezpiecznie('Złoto USD', async () => [
  await yahoo('GC=F', 'Złoto kontrakty (1 uncja)', 'USD'),
]);
const usdPln = await bezpiecznie('USD/PLN', async () => {
  const r = (await http('https://api.nbp.pl/api/exchangerates/rates/a/usd/last/30/?format=json')).rates;
  const z = zmiany(r.map((x) => x.mid));
  return [`Kurs USD/PLN wg NBP (${r[r.length - 1].effectiveDate}): ${fmtNum(z.last, 4)} zł | ${opisZmian(z)}`];
});
const gpw = await bezpiecznie('GPW', async () => [
  await yahoo('WIG20.WA', 'WIG20', 'pkt'),
  await yahoo('WIG.WA', 'WIG', 'pkt'),
]);
const usa = await bezpiecznie('USA', async () => [
  await yahoo('^GSPC', 'S&P 500', 'pkt'),
  await yahoo('^IXIC', 'Nasdaq Composite', 'pkt'),
  await yahoo('^DJI', 'Dow Jones', 'pkt'),
]);
const krypto = await bezpiecznie('CoinGecko', async () => {
  const cg = await http(
    'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=bitcoin,ethereum&price_change_percentage=24h,7d,30d',
  );
  return cg.map(
    (c) =>
      `${c.name}: ${fmtNum(c.current_price, 0)} USD | 24h ${fmtPct(c.price_change_percentage_24h_in_currency)} | 7 dni ${fmtPct(c.price_change_percentage_7d_in_currency)} | 30 dni ${fmtPct(c.price_change_percentage_30d_in_currency)}`,
  );
});
const scamy = await bezpiecznie('CERT Polska', async () => {
  const lista = (await http('https://hole.cert.pl/domains/v2/domains.txt', false))
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
  const slowa = /invest|inwest|crypto|krypto|bitcoin|btc|gield|broker|trad|zarob|zysk|forex|lewandowski|orlen|pko|pekao|baltic|gpw|knf|nbp/i;
  const finansowe = lista.filter((d) => slowa.test(d));
  // Lista jest alfabetyczna i bez dat — losujemy przykłady
  const przyklady = [...finansowe].sort(() => Math.random() - 0.5).slice(0, 15);
  return [
    `Lista ostrzeżeń CERT Polska: ${lista.length.toLocaleString('pl-PL')} niebezpiecznych domen, w tym ${finansowe.length.toLocaleString('pl-PL')} z nazwą sugerującą inwestycje/finanse`,
    `Przykładowe domeny z listy CERT (nie wchodzić!): ${przyklady.join(', ')}`,
  ];
});

// ---------- Tematy ----------

const tematy = [
  {
    category: 'zloto',
    title: 'Złoto',
    dane: [...zloto, ...zlotoUsd, ...usdPln],
    zrodla: [
      { nazwa: 'NBP — ceny złota', url: 'https://api.nbp.pl/api/cenyzlota/last/30?format=json' },
      { nazwa: 'Yahoo Finance — GC=F', url: 'https://finance.yahoo.com/quote/GC=F' },
    ],
    // "złoto/złota/złotu/złocie" = kruszec; "złoty/złotego/złotówka" = waluta — tej nie chcemy
    newsy: await newsy([...PL, ...US], /\bz[łl]ot[oau]\b|z[łl]ocie|\bgold\b|kruszc|szlachetn|srebr|silver/i, 72),
    prompt: 'Złoto: co napędza ostatnie ruchy ceny, najważniejsze newsy, prognozy banków i analityków (kto i jaki poziom).',
  },
  {
    category: 'gpw',
    title: 'GPW',
    dane: [...gpw, ...usdPln],
    zrodla: [{ nazwa: 'Yahoo Finance — WIG20', url: 'https://finance.yahoo.com/quote/WIG20.WA' }],
    newsy: await newsy(
      ['bankierGielda', ...PL],
      /gpw|wig|giełd|gield|spółk|spolk|akcj|dywidend|notowa|rekomend|emisj|makler/i,
    ),
    prompt: 'Giełda w Warszawie: najważniejsze newsy o spółkach (wyniki, dywidendy, komunikaty), wzrosty i spadki, rekomendacje domów maklerskich.',
  },
  {
    category: 'usa',
    title: 'Rynek USA',
    dane: usa,
    zrodla: [{ nazwa: 'Yahoo Finance — S&P 500', url: 'https://finance.yahoo.com/quote/%5EGSPC' }],
    newsy: await newsy(
      US,
      /fed|s&p|nasdaq|dow|stock|wall street|earnings|inflation|rate|market|treasur|yield|tariff|economy|shares/i,
    ),
    prompt: 'Rynek akcji w USA: najważniejsze wydarzenia (Fed, dane makro, wyniki dużych spółek), nastroje i prognozy analityków.',
  },
  {
    category: 'krypto',
    title: 'Krypto',
    dane: krypto,
    zrodla: [{ nazwa: 'CoinGecko', url: 'https://www.coingecko.com/' }],
    newsy: await newsy(['coindesk', 'cointelegraph', ...PL], /bitcoin|btc|ethereum|eth|krypto|crypto|etf|stablecoin|blockchain/i),
    prompt: 'Kryptowaluty: najważniejsze wydarzenia i trendy (regulacje, ETF-y, duże przepływy), prognozy analityków dla Bitcoina i Ethereum.',
  },
  {
    category: 'scamy',
    title: 'Ostrzeżenia przed scamami',
    dane: scamy,
    zrodla: [{ nazwa: 'CERT Polska — lista ostrzeżeń', url: 'https://cert.pl/lista-ostrzezen/' }],
    newsy: await newsy(
      ['cert', 'sekurak', ...PL],
      /oszust|oszuk|scam|fałszyw|falszyw|wyłudz|wyludz|phishing|podszyw|ostrzeż|ostrzez|piramid/i,
      24 * 7,
    ),
    prompt: 'Oszustwa inwestycyjne i finansowe w Polsce z ostatnich 7 dni: nowe schematy (np. fałszywe artykuły z celebrytami, "platformy AI", fałszywi doradcy), ostrzeżenia CERT/KNF/policji, jak się chronić.',
  },
];

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
    daneTekst: t.dane.map((d) => '- ' + d).join('\n'),
    newsyTekst: t.newsy.length
      ? t.newsy.map((n) => `[${n.nr}] ${godz(n.data)} ${n.domena} — ${n.tytul}. ${n.opis}`).join('\n')
      : 'Brak newsów na ten temat w zaufanych kanałach RSS.',
  },
}));
