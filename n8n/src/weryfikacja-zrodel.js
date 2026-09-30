// Klocek "Weryfikacja źródeł": sprawdza linki na liście CERT Polska i składa raport dla apki:
// - content: pełny tekst (komentarz AI + twarde dane + źródła) — zapasowo i do archiwum,
// - data: uporządkowane dane (instrumenty z wykresami, newsy, komentarz) — z tego rysuje apka.
// Gdy Gemini nie odpowie (np. limit), raport i tak powstaje — z danymi i nagłówkami newsów.

// Gdy lista CERT nie odpowie, raport i tak powstaje (linki bez sprawdzenia) — z ostrzeżeniem w apce
let cert = new Set();
let problemCert = null;
try {
  const certTxt = await this.helpers.httpRequest({
    url: 'https://hole.cert.pl/domains/v2/domains.txt',
    timeout: 30000,
  });
  cert = new Set(certTxt.split('\n').map((s) => s.trim().toLowerCase()).filter(Boolean));
} catch (e) {
  problemCert = { zrodlo: 'Lista CERT Polska (sprawdzanie linków)', blad: String(e.message ?? e).slice(0, 160) };
}

// "sub.bankier.pl" -> sprawdza sub.bankier.pl, bankier.pl
function naLiscieCert(domena) {
  const czesci = domena.toLowerCase().split('.');
  return czesci.slice(0, -1).some((_, i) => cert.has(czesci.slice(i).join('.')));
}

// Jedna odpowiedź Gemini z komentarzami do wszystkich tematów: { "zloto": "...", "gpw": "...", ... }
// Przy błędzie (np. limit) odpowiedzi nie ma — raporty powstają bez komentarza AI.
// Gemma nie ma trybu JSON: bywa, że dopisze coś przed/po albo wstawi zwykłe znaki nowej linii
// w środek tekstu (to formalnie błędny JSON). Bierzemy tekst od pierwszej { do ostatniej }
// i zamieniamy znaki nowej linii WEWNĄTRZ napisów na \n.
function naprawJson(tekst) {
  let wynik = '';
  let wNapisie = false;
  let poBackslashu = false;
  for (const znak of tekst) {
    if (wNapisie && !poBackslashu && znak === '\n') wynik += '\\n';
    else if (wNapisie && !poBackslashu && znak === '\r') continue;
    else if (wNapisie && !poBackslashu && znak === '\t') wynik += '\\t';
    else wynik += znak;
    if (znak === '"' && !poBackslashu) wNapisie = !wNapisie;
    poBackslashu = znak === '\\' && !poBackslashu;
  }
  return wynik;
}

let komentarze = {};
const odpowiedz = ($input.first()?.json.mergedResponse ?? '').trim();
const start = odpowiedz.indexOf('{');
const koniec = odpowiedz.lastIndexOf('}');
if (start >= 0 && koniec > start) {
  const kandydat = odpowiedz.slice(start, koniec + 1);
  try {
    komentarze = JSON.parse(kandydat);
  } catch {
    try {
      komentarze = JSON.parse(naprawJson(kandydat));
    } catch {
      komentarze = {};
    }
  }
}

// ---------- Kontrola liczb w komentarzu AI ----------
// Każda liczba z komentarza (procenty, kursy, wartości z jednostką) musi występować w TWARDYCH DANYCH
// albo w newsach (z dowolnego tematu — podsumowanie dnia cytuje dane z innych tematów).
// Sprawdzamy też kierunek: "wzrost o 2,5%" przy danych "-2,5%" to błąd.

// Liczba: "4 194,90", "-3,28", "0.3", "83879", "$300,000" (spacja/nbsp jako separator tysięcy)
const LICZBA = /[-+−]?\d{1,3}(?:[   ]\d{3})+(?:,\d+)?|[-+−]?\d+(?:[.,]\d+)?/g;
// Mnożnik po liczbie: "84K", "300 million", "2,6 mld", "130 tysięcy"
const MNOZNIKI = [
  [/^\s?(tys|tysi|thousand)/i, 1e3],
  [/^K\b/i, 1e3],
  [/^\s?(mln|milion|million)/i, 1e6],
  [/^\s?M\b/, 1e6],
  [/^\s?(mld|miliard|billion|bn\b)/i, 1e9],
  [/^\s?B\b/, 1e9],
  [/^\s?(bln|bilion|trillion)/i, 1e12],
];

function liczby(tekst) {
  return [...tekst.matchAll(LICZBA)].map((m) => {
    const surowa = m[0];
    const po = tekst.slice(m.index + surowa.length, m.index + surowa.length + 12);
    const znak = /^[-−]/.test(surowa) ? -1 : surowa.startsWith('+') ? 1 : 0;
    const cyfry = surowa.replace(/^[-+−]/, '').replace(/[   ]/g, '');
    const [, ulamek = ''] = cyfry.split(/[.,]/);
    const wartosc = Number(cyfry.replace(',', '.'));
    // Wszystkie sensowne odczyty liczby: angielskie "1,665" / "300,000" to tysiące, a nie ułamek
    const wartosci = [wartosc];
    if (/^\d{1,3}(,\d{3})+$/.test(cyfry)) wartosci.push(Number(cyfry.replace(/,/g, '')));
    const mnoznik = MNOZNIKI.find(([re]) => re.test(po))?.[1];
    if (mnoznik) wartosci.push(...wartosci.map((w) => w * mnoznik));
    return {
      surowa,
      wartosc,
      wartosci,
      znak,
      miejsca: ulamek.length,
      separator: cyfry.includes('.') ? '.' : cyfry.includes(',') ? ',' : '',
      procent: /^\s?(%|proc)/.test(po),
      mnoznik: Boolean(mnoznik),
      poz: m.index,
      dl: surowa.length,
    };
  });
}

const tekstyZrodel = $('Dane i tematy').all().flatMap((x) => [x.json.daneTekst ?? '', x.json.newsyTekst ?? '']);
const dozwolone = tekstyZrodel.flatMap(liczby);

// Uwaga na polskie odmiany: "wzroście" (ś), "rosnąć", "zwyżka"
const W_GORE = /wzros|wzroś|wzrós|wzrost|zysk|urós|urosł|rośnie|rosną|rosnąc|rosła|rósł|zwyżk|podroż|drożej|w górę|odbi|dopisał/i;
const W_DOL = /spad|strac|tani|zniżk|w dół|obniż|przecen|traci|zjecha|osuwa/i;
// "około 84 000 USD", "powyżej 4150 pkt", "ponad 8%" — zaokrąglenie jest wtedy w porządku
const W_PRZYBLIZENIU = /okoł|ok\.|okolic|blisko|rejon|powyżej|poniżej|ponad|niemal|prawie|przekr|przedzia|pułap/i;

function kontrolaLiczb(komentarz) {
  if (!komentarz) return null;
  const niezgodne = [];
  let sprawdzone = 0;
  for (const l of liczby(komentarz)) {
    const po = komentarz.slice(l.poz + l.dl, l.poz + l.dl + 12);
    const przed = komentarz.slice(Math.max(0, l.poz - 45), l.poz);
    // Pomijamy: przypisy [3], daty 29.09, godziny 14:30, lata 2026
    if (/\[$/.test(przed) && /^\]/.test(po)) continue;
    if (l.separator === '.' && l.miejsca === 2 && !l.procent && /^\d{1,2}\.\d{2}$/.test(l.surowa)) continue;
    if (/:$/.test(przed) || /^:\d/.test(po)) continue;
    const zJednostka = l.procent || l.mnoznik || /^\s?(proc|pkt|punkt|USD|\$|zł|PLN|EUR)/i.test(po);
    const rok = l.miejsca === 0 && l.wartosc >= 1990 && l.wartosc <= 2100;
    // Sprawdzamy tylko liczby "rynkowe": z częścią ułamkową, z jednostką albo duże (kursy)
    if (rok && !zJednostka) continue;
    if (!(l.miejsca > 0 || zJednostka || l.wartosc >= 1000)) continue;
    sprawdzone++;

    // Zgodna, gdy któraś liczba ze źródeł po zaokrągleniu do tylu miejsc, ile podało AI, daje to samo.
    // Przy "około/powyżej/ponad…" wystarczy bliska wartość (AI zaokrągla: 83 879 → "około 84 000").
    const przyblizenie = W_PRZYBLIZENIU.test(przed.slice(-25));
    const zaokr = (v) => Math.round(Math.abs(v) * 10 ** l.miejsca) / 10 ** l.miejsca;
    const zgodna = (d, w, a) => {
      if (zaokr(w) === a || Math.abs(Math.abs(w) - a) <= Math.max(0.005, a * 0.0005)) return true;
      if (!przyblizenie) return false;
      return l.procent ? Math.abs(Math.abs(w) - a) <= (l.miejsca ? 0.15 : 1) : Math.abs(Math.abs(w) - a) <= a * 0.025;
    };
    const pasujace = dozwolone.filter(
      // Procent z komentarza porównujemy tylko z procentami ze źródeł ("159%" to nie "159 mln")
      (d) => (!l.procent || d.procent) && d.wartosci.some((w) => l.wartosci.some((a) => zgodna(d, w, a))),
    );
    const fragment = komentarz
      .slice(Math.max(0, l.poz - 60), l.poz + l.dl + 25)
      .replace(/\s+/g, ' ')
      .trim();
    if (!pasujace.length) {
      niezgodne.push({ liczba: l.surowa.trim(), fragment, powod: 'brak tej liczby w danych i newsach' });
      continue;
    }

    // Kierunek: jawny znak liczby albo najbliższe słowo przed nią w tym samym fragmencie zdania
    let kierunek = l.znak;
    if (!kierunek) {
      const kawalek = przed.split(/, |; |\(|\. | – | - |\n/).pop();
      const g = [...kawalek.matchAll(new RegExp(W_GORE.source, 'gi'))].pop()?.index ?? -1;
      const d = [...kawalek.matchAll(new RegExp(W_DOL.source, 'gi'))].pop()?.index ?? -1;
      kierunek = g > d ? 1 : d > g ? -1 : 0;
    }
    // Błąd tylko wtedy, gdy WSZYSTKIE pasujące liczby ze źródeł to zmiany o przeciwnym znaku
    if (kierunek && pasujace.every((d) => d.znak !== 0 && d.znak !== kierunek)) {
      niezgodne.push({
        liczba: l.surowa.trim(),
        fragment,
        powod: kierunek > 0 ? 'AI pisze o wzroście, a dane pokazują spadek' : 'AI pisze o spadku, a dane pokazują wzrost',
      });
    }
  }
  return { sprawdzone, zgodne: sprawdzone - niezgodne.length, niezgodne };
}

// Przypisy: "[1, 3]" → "[1][3]" (apka robi z nich klikalne kółka), a pseudo-przypisy bez numeru
// ("[dane własne]", "[twarde dane]", "[NBP]") usuwamy — to nie są źródła, tylko szum w tekście.
function uporzadkujPrzypisy(tekst) {
  return tekst
    .replace(/\[(\d+(?:\s*,\s*\d+)+)\]/g, (_, lista) => lista.split(',').map((n) => `[${n.trim()}]`).join(''))
    .replace(/\s*\[(?!\d+\])[^\]\n]{1,40}\]/g, '');
}

// ---------- Kontrola czasu: czy AI pisze o sesji zgodnie ze stanem rynków ----------
// Np. "WIG20 zakończył sesję wzrostem" w raporcie o 15:00, gdy sesja GPW jeszcze trwa.
// Sprawdzamy fragmenty zdań (do przecinka/średnika), w których pada nazwa rynku.
const RYNKI_CZASU = {
  GPW: /\bGPW\b|WIG20|\bWIG\b|warszawsk|polsk\w* giełd|polsk\w* parkiet/i,
  USA: /S&P|Nasdaq|Dow Jones|Wall Street|w USA|amerykańsk\w* (giełd|rynk|sesj|indeks|akcj)/i,
};
const ZAMKNIECIE = /zakończ|zamkn(ął|ęła|ęły|ęli)|na zamknięciu|zamknięci[ea] sesji/i;
const DZIS_W_TRAKCIE = /w trakcie (dzisiejszej )?sesji|dzisiejsz\w* sesj|dziś (rośnie|spada|zyskuje|traci)/i;
function kontrolaCzasu(komentarz, stan) {
  if (!komentarz || !stan?.length) return [];
  const statusy = Object.fromEntries(stan.map((s) => [s.rynek, s.status]));
  const uwagi = [];
  for (const fragment of komentarz.split(/\n|[.;](?=\s)|,\s|\s–\s|\spodczas gdy\s/)) {
    for (const [rynek, re] of Object.entries(RYNKI_CZASU)) {
      if (!re.test(fragment)) continue;
      // Fragment o obu rynkach naraz jest niejednoznaczny — pomijamy
      if (Object.entries(RYNKI_CZASU).some(([inny, re2]) => inny !== rynek && re2.test(fragment))) continue;
      const status = statusy[rynek];
      let powod = null;
      if (status === 'trwa' && ZAMKNIECIE.test(fragment)) powod = `AI pisze o zamknięciu sesji, a sesja ${rynek} jeszcze trwa`;
      if ((status === 'przed' || status === 'poprzednia') && DZIS_W_TRAKCIE.test(fragment))
        powod = `AI pisze o dzisiejszej sesji ${rynek}, a dane są z poprzedniej sesji`;
      if (powod) uwagi.push({ fragment: fragment.trim().slice(0, 140), powod });
    }
  }
  return uwagi;
}

// Pomysły z podsumowania dnia (sekcja "Pomysły do rozważenia"), osobno — apka liczy ich wyniki.
// Strzałka na początku: ↑ szansa na wzrost, ↓ ostrzeżenie przed spadkiem (bez strzałki = ↑).
// Ta sama logika jest w apce (web/src/lib/pomysly.ts) dla starszych raportów.
function pomyslyZKomentarza(komentarz) {
  const linie = komentarz.split('\n').map((l) => l.trim());
  const start = linie.findIndex((l) => /^pomysły do rozważenia:?$/i.test(l));
  if (start < 0) return [];
  const pomysly = [];
  for (const l of linie.slice(start + 1)) {
    if (!l) continue;
    if (!l.startsWith('- ')) break;
    const tekst = l.slice(2).trim();
    pomysly.push({ tekst: tekst.replace(/^[↑↓⬆⬇]\s*/, ''), kierunek: /^[↓⬇]/.test(tekst) ? -1 : 1 });
  }
  return pomysly;
}

const wyniki = $('Dane i tematy').all().map((item, i) => {
  const temat = item.json;
  const newsy = temat.newsy.filter((n) => !naLiscieCert(n.domena));
  const odrzucone = [...new Set(temat.newsy.filter((n) => naLiscieCert(n.domena)).map((n) => n.domena))];

  const surowy = komentarze[temat.category];
  const komentarz = uporzadkujPrzypisy((typeof surowy === 'string' ? surowy : '').trim()) || null;
  const numery = new Set([...(komentarz ?? '').matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1])));
  const kontrola = kontrolaLiczb(komentarz);
  const zNumerami = newsy.map((n) => ({
    nr: n.nr,
    tytul: n.tytul,
    opis: n.opis,
    link: n.link,
    domena: n.domena,
    data: n.data,
    cytowany: numery.has(n.nr),
  }));

  // Tekst — dla archiwum i starszych widoków
  const cytowane = zNumerami.filter((n) => n.cytowany);
  const doListy = cytowane.length ? cytowane : zNumerami.slice(0, 8);
  const sekcje = [
    komentarz ??
      '⚠️ Komentarz AI niedostępny (limit Gemini). Najważniejsze nagłówki:\n' +
        zNumerami.slice(0, 8).map((n) => `- [${n.nr}] ${n.tytul} (${n.domena})`).join('\n'),
    'Twarde dane (API, liczone automatycznie):\n' + temat.daneTekst,
  ];
  const zrodlaDanych = temat.instrumenty.filter((x) => x.zrodlo);
  if (zrodlaDanych.length) {
    sekcje.push('Źródła danych:\n' + zrodlaDanych.map((x) => `- 📊 ${x.nazwa} ${x.zrodlo}`).join('\n'));
  }
  if (doListy.length) {
    sekcje.push('Źródła newsów:\n' + doListy.map((n) => `- [${n.nr}] ${n.domena} — ${n.tytul} ${n.link}`).join('\n'));
  }
  if (odrzucone.length) {
    sekcje.push('🚫 Odrzucone (lista ostrzeżeń CERT Polska): ' + odrzucone.join(', '));
  }

  return {
    json: {
      category: temat.category,
      title: temat.title,
      content: sekcje.join('\n\n'),
      data: {
        wersja: 2,
        komentarz,
        // Źródła, które nie odpowiedziały w tym uruchomieniu (te same dla wszystkich tematów)
        // (bez dublowania, gdy lista CERT nie odpowiedziała już w "Dane i tematy")
        problemy: [
          ...(temat.problemy ?? []),
          ...(problemCert && !(temat.problemy ?? []).some((p) => p.zrodlo.startsWith('Lista CERT')) ? [problemCert] : []),
        ],
        // Jaki to raport (przed sesją / po GPW / po USA / sobota / niedziela) i co jest już pewne
        typRaportu: temat.typRaportu ?? null,
        stanRynkow: temat.stanRynkow ?? [],
        kontrola: kontrola && { ...kontrola, czas: kontrolaCzasu(komentarz, temat.stanRynkow) },
        ...(temat.category === 'dzien' && komentarz ? { pomysly: pomyslyZKomentarza(komentarz) } : {}),
        instrumenty: temat.instrumenty,
        newsy: zNumerami,
        odrzucone,
        ...(temat.cert ? { cert: temat.cert } : {}),
        // Dodatkowe dane dla apki (szerokość rynku, kalendarz, rekomendacje — też przez filtr CERT)
        ...(temat.extra ?? {}),
        ...(temat.extra?.rekomendacje
          ? {
              rekomendacje: temat.extra.rekomendacje
                .filter((r) => !naLiscieCert(r.domena))
                .map((r) => ({ tytul: r.tytul, link: r.link, domena: r.domena, data: r.data, spolka: r.spolka })),
            }
          : {}),
      },
    },
    pairedItem: { item: i },
  };
});

// ---------- Pamięć tygodnia (do sobotniego podsumowania) ----------
// Zapisuje się tylko przy automatycznych uruchomieniach (tak działa pamięć n8n) — ręczne testy jej nie psują.
const pamiec = $getWorkflowStaticData('global');
const DWA_TYGODNIE = 14 * 864e5;
const swieze = (lista) => (lista ?? []).filter((x) => Date.now() - new Date(x.t).getTime() < DWA_TYGODNIE);
const teraz = new Date().toISOString();
const raportDnia = wyniki.find((w) => w.json.category === 'dzien')?.json.data;

// Pomysły z ceną z chwili raportu; instrument = nazwa z migawki cen, która pada w tekście najwcześniej
const ceny = raportDnia?.ceny ?? {};
const wzorce = Object.keys(ceny).map((pelna) => {
  const krotka = pelna.replace(/\s*\(.*\)$/, '');
  const rdzen = (krotka.length >= 5 ? krotka.slice(0, -1) : krotka).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Polska odmiana: "Tesli", "Orlenu" — rdzeń + do 3 liter; krótkie nazwy (PZU, AMD) tylko w całości
  const koniec = krotka.length >= 5 ? '[a-ząćęłńóśźż]{0,3}' : '';
  return { pelna, re: new RegExp(`(^|[^a-ząćęłńóśźż0-9])${rdzen}${koniec}(?![a-ząćęłńóśźż])`, 'i') };
});
const czego = (tekst) =>
  wzorce
    .map((w) => ({ ...w, i: tekst.search(w.re) }))
    .filter((w) => w.i >= 0)
    .sort((a, b) => a.i - b.i)[0]?.pelna ?? null;
const nowePomysly = (raportDnia?.pomysly ?? []).map((p) => {
  const nazwa = czego(p.tekst);
  return { t: teraz, tekst: p.tekst.slice(0, 200), kierunek: p.kierunek, nazwa, cena: nazwa ? ceny[nazwa] : null };
});
pamiec.pomysly = [...swieze(pamiec.pomysly), ...nowePomysly];

const kontrole = wyniki.map((w) => w.json.data.kontrola).filter(Boolean);
pamiec.statystyki = [
  ...swieze(pamiec.statystyki),
  {
    t: teraz,
    sprawdzone: kontrole.reduce((s, k) => s + k.sprawdzone, 0),
    niezgodne: kontrole.reduce((s, k) => s + k.niezgodne.length, 0),
    bezAI: !raportDnia?.komentarz,
  },
];

return wyniki;
