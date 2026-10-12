// Test kontroli liczb i stanu sesji (klocek "Weryfikacja źródeł" z n8n/src) na WSZYSTKICH raportach z historii n8n.
// Po każdej zmianie w kontroli: uruchom i porównaj — liczba niezgodnych nie powinna rosnąć (fałszywe alarmy),
// a prawdziwe błędy AI (np. "ASML +329%" zamiast 3,29%) dalej mają być łapane.
// Użycie:  node kontrola-historia.cjs          → podsumowanie + każda niezgodność
//          node kontrola-historia.cjs krotko   → tylko podsumowanie

const { uruchomienia, wykonanie, odpowiedzAI, listaCert, klocek } = require('./lib.cjs');

(async () => {
  const cert = await listaCert();
  const weryfikacja = klocek('weryfikacja-zrodel.js', ['$input', '$', '$getWorkflowStaticData']);
  const krotko = process.argv[2] === 'krotko';
  let raportow = 0;
  let liczb = 0;
  let niezgodnych = 0;
  let czasu = 0;

  for (const u of uruchomienia()) {
    const w = wykonanie(u.id);
    const dane = w && w.runData['Dane i tematy']?.[0]?.data?.main?.[0];
    const ai = w && odpowiedzAI(w.runData);
    if (!dane || !ai) continue;
    const wynik = await weryfikacja.call(
      { helpers: { httpRequest: async () => cert } },
      { first: () => ({ json: { mergedResponse: ai } }) },
      () => ({ all: () => dane }),
      () => ({}), // pusta pamięć — test nie może dopisywać pomysłów ani statystyk do prawdziwej pamięci
    );
    raportow++;
    for (const r of wynik) {
      const k = r.json.data.kontrola;
      if (!k) continue;
      liczb += k.sprawdzone;
      niezgodnych += k.niezgodne.length;
      czasu += k.czas?.length ?? 0;
      if (krotko) continue;
      for (const n of k.niezgodne) console.log(`#${u.id} ${r.json.category}: ${n.liczba} — ${n.powod}\n     „${n.fragment}”`);
      for (const n of k.czas ?? []) console.log(`#${u.id} ${r.json.category}: STAN SESJI — ${n.powod}\n     „${n.fragment}”`);
    }
  }
  console.log(`\nRAZEM: ${raportow} raportów, ${liczb} liczb sprawdzonych, niezgodnych: ${niezgodnych}, błędów stanu sesji: ${czasu}`);
})().catch((e) => {
  console.error('BŁĄD:', e.message);
  process.exit(1);
});
