// Szczegóły jednego raportu z historii n8n.
// Użycie:  node raport.cjs            → najnowszy raport
//          node raport.cjs 58         → wykonanie nr 58
//          node raport.cjs 58 pelny   → dodatkowo pełny komentarz AI do podsumowania i dane, które dostało AI
// Pokazuje: typ raportu, stan rynków, problemy ze źródłami, kontrolę liczb i stanu sesji, pomysły, powiadomienie.

const { wykonanie, wyjscie, najnowszeZ, czasPl } = require('./lib.cjs');

const [nr, tryb] = process.argv.slice(2);
const w = nr ? wykonanie(Number(nr)) : najnowszeZ('Weryfikacja źródeł');
if (!w) throw new Error('Nie ma takiego wykonania.');
const raporty = wyjscie(w.runData, 'Weryfikacja źródeł');
if (!raporty) throw new Error(`Wykonanie #${w.id} nie ma raportu (np. błąd przed klockiem Weryfikacja).`);

const dzien = raporty.find((r) => r.category === 'dzien')?.data ?? {};
console.log(`#${w.id} ${czasPl(w.startedAt)} (${w.mode}, ${w.status})`);
console.log('Typ:', dzien.typRaportu ? `${dzien.typRaportu.ikona} ${dzien.typRaportu.nazwa}` : '(stary format)');
for (const s of dzien.stanRynkow ?? []) console.log(`  stan: ${s.status.padEnd(10)} ${s.rynek} — ${s.tekst}`);
console.log('Problemy ze źródłami:', (dzien.problemy ?? []).map((p) => `${p.zrodlo} (${p.blad})`).join('; ') || 'brak');

console.log('\nTematy:');
for (const r of raporty) {
  const k = r.data?.kontrola;
  const nr = new Set((r.data?.newsy ?? []).map((n) => n.nr));
  const zlePrzypisy = [...(r.data?.komentarz ?? '').matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1])).filter((n) => !nr.has(n));
  console.log(
    `  ${r.category.padEnd(10)} AI ${r.data?.komentarz ? 'tak' : 'NIE'} | liczby ${k ? `${k.zgodne}/${k.sprawdzone}` : '-'}` +
      ` | newsy ${r.data?.newsy?.length ?? 0} (cytowane ${(r.data?.newsy ?? []).filter((n) => n.cytowany).length})` +
      ` | odrzucone CERT ${r.data?.odrzucone?.length ?? 0}` +
      (zlePrzypisy.length ? ` | PRZYPISY BEZ NEWSA: ${zlePrzypisy.join(',')}` : ''),
  );
  for (const n of k?.niezgodne ?? []) console.log(`     ⚠️ liczba ${n.liczba}: ${n.powod} „${n.fragment}”`);
  for (const n of k?.czas ?? []) console.log(`     ⚠️ stan sesji: ${n.powod} „${n.fragment}”`);
}

console.log('\nPomysły:', (dzien.pomysly ?? []).map((p) => `${p.kierunek === -1 ? '↓' : '↑'} ${p.tekst.slice(0, 90)}`).join('\n         ') || 'brak');
if (dzien.tydzien) console.log('Tydzień:', JSON.stringify(dzien.tydzien));
if (dzien.przedTygodniem) console.log('Przed tygodniem:', JSON.stringify(dzien.przedTygodniem));
const tresc = wyjscie(w.runData, 'Treść powiadomienia')?.[0];
if (tresc) console.log(`\nPowiadomienie:\n  ${tresc.title}\n  from Research\n  ${tresc.body.replace(/\n/g, '\n  ')}`);
console.log('Wysłane:', JSON.stringify(wyjscie(w.runData, 'Wyślij powiadomienie')?.[0] ?? '-'));

if (tryb === 'pelny') {
  const dane = wyjscie(w.runData, 'Dane i tematy')?.find((t) => t.category === 'dzien');
  console.log('\n=== DANE DLA AI (podsumowanie) ===\n' + (dane?.daneTekst ?? '-'));
  console.log('\n=== KOMENTARZ AI (podsumowanie) ===\n' + (dzien.komentarz ?? '-'));
}
