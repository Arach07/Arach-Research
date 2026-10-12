// Lokalny test klocków n8n BEZ n8n: uruchamia kod z n8n/src tak, jak robi to n8n
// (Dane i tematy → Jeden prompt → Weryfikacja źródeł → Treść powiadomienia), na prawdziwych źródłach danych.
// AI nie jest wywoływane: komentarz AI bierzemy z ostatniego prawdziwego raportu w historii n8n (albo z pliku).
//
// Użycie:  node n8n-test.cjs
//          node n8n-test.cjs --ai plik.json          (własna odpowiedź AI: {"zloto":"...", "gpw":"...", ...})
//          node n8n-test.cjs --pamiec-z-n8n          (pamięć tygodnia z prawdziwego n8n, np. do testu soboty)
// Zmienne:  FAIL='faireconomy|BTC-USD'   — udaje awarię źródeł, których adres pasuje do wzorca
//           FAKE_NOW=2026-10-10T08:00:00Z — udaje inną chwilę (np. sobotę 10:00 czasu polskiego)
// Uwaga: Forex Factory blokuje (429) przy kilku pobraniach w krótkim czasie — przy serii testów dawaj FAIL=faireconomy.
// Wynik: dane/test-wynik.json (dane tematów, polecenie dla AI, raporty, treść powiadomienia).

const fs = require('node:fs');
const path = require('node:path');
const { DANE, klocek, najnowszeZ, odpowiedzAI, pamiecN8n } = require('./lib.cjs');

const argv = process.argv.slice(2);
const opcja = (n) => argv.includes(n);
const wartosc = (n) => (argv.includes(n) ? argv[argv.indexOf(n) + 1] : null);

// Udawana chwila (FAKE_NOW) — kod klocków dostaje własną klasę Date
const przesuniecie = process.env.FAKE_NOW ? new Date(process.env.FAKE_NOW).getTime() - Date.now() : 0;
class FakeDate extends Date {
  constructor(...a) {
    if (a.length) super(...a);
    else super(Date.now() + przesuniecie);
  }
  static now() {
    return Date.now() + przesuniecie;
  }
}

// this.helpers.httpRequest z n8n: JSON albo tekst, błąd przy kodzie innym niż 2xx
const helpers = {
  async httpRequest({ url, json, headers, timeout }) {
    if (process.env.FAIL && new RegExp(process.env.FAIL).test(url)) throw new Error('Request failed with status code 403 (FAIL)');
    const r = await fetch(url, { headers, signal: AbortSignal.timeout(timeout ?? 30000) });
    if (!r.ok) throw new Error(`Request failed with status code ${r.status}`);
    return json ? r.json() : r.text();
  },
};

(async () => {
  const t0 = Date.now();
  const pamiec = opcja('--pamiec-z-n8n') ? pamiecN8n() : {};
  const PARAMS = ['$input', '$', '$getWorkflowStaticData', 'Date'];
  const uruchom = (plik, $input, $) => klocek(plik, PARAMS).call({ helpers }, $input, $, () => pamiec, FakeDate);

  const dane = await uruchom('dane-i-tematy.js', null, null);
  const prompt = await uruchom('jeden-prompt.js', { all: () => dane }, null);

  let ai = '';
  if (wartosc('--ai')) ai = fs.readFileSync(wartosc('--ai'), 'utf8');
  else {
    const ostatnie = najnowszeZ('Weryfikacja źródeł');
    ai = ostatnie ? odpowiedzAI(ostatnie.runData) : '';
    console.log(`Komentarz AI: z wykonania #${ostatnie?.id ?? '-'} (liczby w kontroli mogą się nie zgadzać, bo dane są nowsze).`);
  }
  const raporty = await uruchom('weryfikacja-zrodel.js', { first: () => ({ json: { mergedResponse: ai } }) }, () => ({ all: () => dane }));
  const tresc = await uruchom('tresc-powiadomienia.js', null, () => ({ all: () => raporty }));

  const wynik = {
    dane: dane.map((d) => d.json),
    prompt: prompt[0].json.prompt,
    raporty: raporty.map((r) => r.json),
    powiadomienie: tresc[0].json,
    pamiec,
  };
  const plik = path.join(DANE, 'test-wynik.json');
  fs.writeFileSync(plik, JSON.stringify(wynik, null, 1));

  const dzien = wynik.raporty.find((r) => r.category === 'dzien')?.data ?? {};
  console.log(`OK w ${((Date.now() - t0) / 1000).toFixed(1)} s — tematy: ${wynik.raporty.map((r) => r.category).join(', ')}`);
  console.log('Typ raportu:', dzien.typRaportu ? `${dzien.typRaportu.ikona} ${dzien.typRaportu.nazwa}` : '-');
  for (const s of dzien.stanRynkow ?? []) console.log(`  stan: ${s.status.padEnd(10)} ${s.rynek} — ${s.tekst}`);
  console.log('Problemy ze źródłami:', (dzien.problemy ?? []).map((p) => `${p.zrodlo} (${p.blad})`).join('; ') || 'brak');
  console.log(`Powiadomienie: ${wynik.powiadomienie.title} | ${wynik.powiadomienie.body.replace(/\n/g, ' | ')}`);
  console.log('Pełny wynik:', plik);
})().catch((e) => {
  console.error('BŁĄD:', e.message);
  process.exit(1);
});
