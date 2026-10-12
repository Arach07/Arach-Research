// Przegląd uruchomień n8n: czy raporty poszły o czasie i czy są w porządku.
// Użycie:  node uruchomienia.cjs            → ostatnie 15
//          node uruchomienia.cjs 30         → ostatnie 30
//          node uruchomienia.cjs od 60      → od wykonania nr 60
// Dla każdego: typ raportu, czy AI odpowiedziało, kontrola liczb i stanu sesji, problemy ze źródłami, powiadomienie.

const { uruchomienia, wykonanie, wyjscie, czasPl } = require('./lib.cjs');

const [a, b] = process.argv.slice(2);
const lista = a === 'od' ? uruchomienia({ od: Number(b) }) : uruchomienia({ limit: Number(a) || 15 });

for (const u of lista) {
  const naglowek = `#${u.id} ${czasPl(u.startedAt).padEnd(17)} ${u.mode.padEnd(7)} ${u.status.padEnd(8)}`;
  const w = wykonanie(u.id);
  const raporty = w && wyjscie(w.runData, 'Weryfikacja źródeł');
  if (!raporty) {
    console.log(`${naglowek} (brak raportu w tym wykonaniu)`);
    continue;
  }
  const dzien = raporty.find((r) => r.category === 'dzien')?.data ?? {};
  const liczby = raporty.reduce((s, r) => s + (r.data?.kontrola?.sprawdzone ?? 0), 0);
  const zle = raporty.reduce((s, r) => s + (r.data?.kontrola?.niezgodne?.length ?? 0), 0);
  const czas = raporty.reduce((s, r) => s + (r.data?.kontrola?.czas?.length ?? 0), 0);
  const push = wyjscie(w.runData, 'Wyślij powiadomienie')?.[0];
  console.log(
    `${naglowek} ${dzien.typRaportu ? `${dzien.typRaportu.ikona} ${dzien.typRaportu.nazwa}`.padEnd(24) : '(stary format)'.padEnd(24)}` +
      ` | AI ${raporty.every((r) => r.data?.komentarz) ? 'tak' : 'NIE'}` +
      ` | liczby ${liczby - zle}/${liczby}` +
      ` | stan sesji błędy ${czas}` +
      ` | problemy: ${(dzien.problemy ?? []).map((p) => p.zrodlo).join(', ') || 'brak'}` +
      ` | push: ${push ? (push.wyslane ?? push.blad ?? '?') : '-'}`,
  );
}
