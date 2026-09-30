// Harmonogram raportów n8n (czas polski) — ten sam co w n8n/build-workflow.mjs:
// pn–pt 8:30, 17:15, 22:15 · sobota 10:00 · niedziela 18:00.
// Służy do ostrzeżenia "brak raportu": sprawdzamy, czy przyszedł raport, który POWINIEN już być
// (a nie "ile godzin minęło" — przerwa sobota→niedziela to 32 godziny i jest normalna).

const PORY: { dni: number[]; godzina: number; minuta: number }[] = [
  { dni: [1, 2, 3, 4, 5], godzina: 8, minuta: 30 },
  { dni: [1, 2, 3, 4, 5], godzina: 17, minuta: 15 },
  { dni: [1, 2, 3, 4, 5], godzina: 22, minuta: 15 },
  { dni: [6], godzina: 10, minuta: 0 },
  { dni: [0], godzina: 18, minuta: 0 },
];

// Ile czasu po planowanej godzinie czekamy (pobranie danych + AI z ponownymi próbami trwa do kilku minut)
const ZAPAS_MS = 30 * 60 * 1000;

const DNI = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 } as const;

function czesci(ms: number) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Europe/Warsaw",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      weekday: "short",
      hourCycle: "h23",
    })
      .formatToParts(ms)
      .map((x) => [x.type, x.value]),
  );
  return {
    rok: Number(p.year),
    miesiac: Number(p.month),
    dzien: Number(p.day),
    godzina: Number(p.hour),
    minuta: Number(p.minute),
    dzienTygodnia: DNI[p.weekday as keyof typeof DNI],
  };
}

// Chwila (ms) dla daty i godziny w czasie polskim — z uwzględnieniem czasu letniego/zimowego
function wWarszawie(rok: number, miesiac: number, dzien: number, godzina: number, minuta: number) {
  const zgadnij = Date.UTC(rok, miesiac - 1, dzien, godzina, minuta);
  const p = czesci(zgadnij);
  const przesuniecie = Date.UTC(p.rok, p.miesiac - 1, p.dzien, p.godzina, p.minuta) - zgadnij;
  return zgadnij - przesuniecie;
}

// Ostatni raport, który według harmonogramu powinien już być (z zapasem), albo null
export function ostatniPlanowanyRaport(teraz = Date.now()): number | null {
  let najnowszy: number | null = null;
  for (let dni = 0; dni <= 3; dni++) {
    const d = czesci(teraz - dni * 864e5);
    for (const pora of PORY) {
      if (!pora.dni.includes(d.dzienTygodnia)) continue;
      const t = wWarszawie(d.rok, d.miesiac, d.dzien, pora.godzina, pora.minuta);
      if (t + ZAPAS_MS <= teraz && (najnowszy == null || t > najnowszy)) najnowszy = t;
    }
  }
  return najnowszy;
}
