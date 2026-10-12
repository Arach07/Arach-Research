// Test czatu AI na PRAWDZIWYM Gemini: dane z najnowszego raportu n8n → kontekst → Gemini (rozmowa wieloetapowa).
// Klucz: web/.env.local (linijka GEMINI_CHAT_KEY=...) — plik ignorowany przez Git, klucz nie jest wyświetlany.
// Każde pytanie zużywa limit darmowego Gemini dla klucza czatu.
// Użycie:  node czat-test.mts "Co jest najważniejsze dziś?" "A co to jest RSI?"
//          (kolejne pytania to dalszy ciąg tej samej rozmowy)
// Wymaga Node 22.6+ (uruchamia TypeScript bezpośrednio).

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { instrukcja, zbudujKontekst } from '../web/src/lib/czat-kontekst.ts';
import { rozmowaZGemini } from '../web/src/lib/czat-gemini.ts';

const require = createRequire(import.meta.url);
const { najnowszeZ, wyjscie, pamiecN8n } = require('./lib.cjs');
const tu = path.dirname(fileURLToPath(import.meta.url));

const env = fs.readFileSync(path.join(tu, '..', 'web', '.env.local'), 'utf8');
const klucz = env.match(/^GEMINI_CHAT_KEY=(.+)$/m)?.[1]?.trim();
if (!klucz) throw new Error('Brak GEMINI_CHAT_KEY w web/.env.local');

// Dane jak w apce: najnowsze raporty ze wszystkich tematów (z historii n8n)
const w = najnowszeZ('Weryfikacja źródeł');
const start = new Date(w.startedAt.replace(' ', 'T') + 'Z').toISOString();
const latest = Object.fromEntries(
  wyjscie(w.runData, 'Weryfikacja źródeł').map((r: any, i: number) => [r.category, { id: i, created_at: start, ...r }]),
);

// Pomysły z pamięci n8n (cena przy pomyśle → cena w najnowszym raporcie)
const ceny = latest.dzien?.data?.ceny ?? {};
const pomysly = (pamiecN8n().pomysly ?? [])
  .slice()
  .reverse()
  .map((p: any) => ({
    created_at: p.t,
    tekst: p.tekst,
    kierunek: p.kierunek,
    nazwa: p.nazwa,
    teraz: p.nazwa && ceny[p.nazwa] && p.cena ? ((ceny[p.nazwa] - p.cena) / p.cena) * 100 : null,
    rynekTeraz: null,
    d7: null,
    benchmark: null,
  }));

const kontekst = zbudujKontekst({ latest, live: null, pomysly, focus: null });
console.log(`Dane z raportu #${w.id}; kontekst: ${kontekst.length} znaków, pomysłów: ${pomysly.length}`);

const historia: { role: 'user' | 'model'; text: string }[] = [];
for (const pytanie of process.argv.slice(2)) {
  historia.push({ role: 'user', text: pytanie });
  console.log(`\n🧑 ${pytanie}\n🤖`);
  const t0 = Date.now();
  const strumien = await rozmowaZGemini({ klucz, instrukcja: instrukcja(kontekst), wiadomosci: historia });
  const dekoder = new TextDecoder();
  let odpowiedz = '';
  for await (const kawalek of strumien) {
    const tekst = dekoder.decode(kawalek);
    odpowiedz += tekst;
    process.stdout.write(tekst);
  }
  console.log(`\n   [${((Date.now() - t0) / 1000).toFixed(1)} s]`);
  historia.push({ role: 'model', text: odpowiedz });
}
