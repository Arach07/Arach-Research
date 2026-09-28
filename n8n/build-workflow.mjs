// Składa n8n/raport-dzienny.json z kodu w n8n/src (żeby nie edytować JS wewnątrz JSON-a).
// Uruchom: node n8n/build-workflow.mjs
import fs from 'node:fs';

const dir = new URL('.', import.meta.url);
const src = (f) => fs.readFileSync(new URL(`src/${f}`, dir), 'utf8');

const SYSTEM = `Jesteś analitykiem rynków finansowych. Piszesz krótkie, rzeczowe komentarze po polsku dla inwestora indywidualnego.

Zasady dla każdego tematu:
- Korzystaj WYŁĄCZNIE z TWARDYCH DANYCH i NEWSÓW danego tematu. Nie dopisuj faktów, liczb ani wydarzeń spoza nich.
- Liczby z TWARDYCH DANYCH są pewne (z API). Nie podawaj innych wartości dla tych instrumentów.
- Po każdej informacji z newsów podaj numer źródła w nawiasie kwadratowym, np. [3]. Możesz łączyć kilka: [1][4].
- Prognozy tylko wtedy, gdy są w newsach, z nazwą autora. Nigdy nie wymyślaj własnych prognoz.
- Jeśli newsów na dany temat brakuje, napisz to wprost.
- Domyślnie 5-8 punktów, każdy zaczyna się od "- ", a na końcu jedno zdanie zaczynające się od "Podsumowanie:" (chyba że ZADANIE tematu mówi inaczej).
- Zwykły tekst: bez nagłówków, bez pogrubień, bez znaków # i *.

Odpowiadasz WYŁĄCZNIE poprawnym obiektem JSON: klucz = nazwa tematu, wartość = komentarz (string).`;

// Łańcuch modeli (kolejność = kolejność prób). Limit darmowego Gemini liczy się osobno
// dla każdego modelu, więc gdy jeden odmówi (limit/przeciążenie), próbujemy następnego.
// gemma: modele Gemma nie przyjmują instrukcji systemowej ani trybu JSON —
// dostają zasady na początku wiadomości, a JSON wyłuskuje klocek "Weryfikacja źródeł".
const MODELE = [
  { nazwa: 'Gemini 1 (3.5-flash-lite)', model: 'models/gemini-3.5-flash-lite' },
  { nazwa: 'Gemini 2 (3.5-flash)', model: 'models/gemini-3.5-flash' },
  { nazwa: 'Gemini 3 (3-flash)', model: 'models/gemini-3-flash-preview' },
  { nazwa: 'Gemini 4 (3.1-flash-lite)', model: 'models/gemini-3.1-flash-lite' },
  { nazwa: 'Gemma 5 (gemma-4-31b)', model: 'models/gemma-4-31b-it', gemma: true },
];

// Gdy wszystkie modele odmówią: pauza i cały łańcuch od nowa, maksymalnie tyle rund
const RUNDY = 3;
const PAUZA_MIEDZY_RUNDAMI_S = 60;

const id = (n) => `7b0f7a1e-1111-4a6b-9c01-${String(n).padStart(12, '0')}`;

function gemini(m, i, position) {
  const prompt = "$('Jeden prompt').first().json.prompt";
  return {
    parameters: {
      modelId: { __rl: true, mode: 'id', value: m.model },
      messages: {
        values: [
          {
            content: m.gemma
              ? `={{ ${JSON.stringify(SYSTEM + '\n\n---\n\n')} + ${prompt} }}`
              : `={{ ${prompt} }}`,
          },
        ],
      },
      jsonOutput: !m.gemma,
      options: m.gemma ? { includeMergedResponse: true } : { includeMergedResponse: true, systemMessage: SYSTEM },
    },
    id: id(100 + i),
    name: m.nazwa,
    type: '@n8n/n8n-nodes-langchain.googleGemini',
    typeVersion: 1.2,
    position,
    retryOnFail: true,
    maxTries: 2,
    waitBetweenTries: 5000,
    // Gdy model nie odpowie (np. limit), workflow idzie dalej zamiast się zatrzymać
    onError: 'continueRegularOutput',
    credentials: { googlePalmApi: { name: 'Google Gemini(PaLM) Api account' } },
  };
}

function warunek(name, nodeId, position, condition) {
  return {
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
        conditions: [{ id: nodeId.replace('1111', '2222'), ...condition }],
        combinator: 'and',
      },
      options: {},
    },
    id: nodeId,
    name,
    type: 'n8n-nodes-base.if',
    typeVersion: 2.2,
    position,
  };
}

// Czy model zwrócił komentarz? wyjście 0 = tak, wyjście 1 = nie (następny model)
const czyJestKomentarz = (i, position) =>
  warunek(`Jest komentarz? (${i + 1})`, id(200 + i), position, {
    leftValue: '={{ $json.mergedResponse }}',
    rightValue: '',
    operator: { type: 'string', operation: 'notEmpty', singleValue: true },
  });

const to = (node) => ({ node, type: 'main', index: 0 });
const WERYFIKACJA = to('Weryfikacja źródeł');

// Model → IF → (tak: Weryfikacja | nie: kolejny model); po ostatnim modelu: kolejna runda albo koniec
const polaczeniaModeli = Object.fromEntries(
  MODELE.flatMap((m, i) => {
    const ifName = `Jest komentarz? (${i + 1})`;
    const dalej = i < MODELE.length - 1 ? to(MODELE[i + 1].nazwa) : to('Kolejna runda?');
    return [
      [m.nazwa, { main: [[to(ifName)]] }],
      [ifName, { main: [[WERYFIKACJA], [dalej]] }],
    ];
  }),
);

const X = (i) => 880 + i * 440;
const Y = (i) => i * 180;
const ostatni = MODELE.length - 1;

const workflow = {
  name: 'Raport dzienny',
  nodes: [
    {
      parameters: {},
      id: id(1),
      name: 'Start',
      type: 'n8n-nodes-base.manualTrigger',
      typeVersion: 1,
      position: [0, -120],
    },
    {
      // Codziennie o 9:00, 14:00 i 20:00 czasu polskiego (9:00 = po odnowieniu dziennego limitu Gemini)
      parameters: {
        rule: { interval: [{ field: 'cronExpression', expression: '0 9,14,20 * * *' }] },
      },
      id: id(9),
      name: 'Harmonogram 9/14/20',
      type: 'n8n-nodes-base.scheduleTrigger',
      typeVersion: 1.2,
      position: [0, 120],
    },
    {
      parameters: { jsCode: src('dane-i-tematy.js') },
      id: id(2),
      name: 'Dane i tematy',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [220, 0],
    },
    {
      // Darmowy Gemini ma mały dzienny limit — wszystkie tematy idą w jednym zapytaniu
      parameters: { jsCode: src('jeden-prompt.js') },
      id: id(6),
      name: 'Jeden prompt',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [440, 0],
    },
    {
      // Licznik rund: 1, 2, 3... (ile razy przeszliśmy przez cały łańcuch modeli)
      parameters: { jsCode: 'return [{ json: { runda: $runIndex + 1 } }];' },
      id: id(7),
      name: 'Runda',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [660, 0],
    },
    ...MODELE.flatMap((m, i) => [gemini(m, i, [X(i), Y(i)]), czyJestKomentarz(i, [X(i) + 220, Y(i)])]),
    warunek('Kolejna runda?', id(300), [X(ostatni) + 440, Y(ostatni)], {
      leftValue: "={{ $('Runda').last().json.runda }}",
      rightValue: RUNDY,
      operator: { type: 'number', operation: 'lt' },
    }),
    {
      // Przeciążenie (503) zwykle mija po chwili — czekamy i próbujemy całą rundę od nowa
      parameters: { resume: 'timeInterval', amount: PAUZA_MIEDZY_RUNDAMI_S, unit: 'seconds' },
      id: id(301),
      name: `Pauza ${PAUZA_MIEDZY_RUNDAMI_S} s`,
      type: 'n8n-nodes-base.wait',
      typeVersion: 1.1,
      position: [X(ostatni) + 660, Y(ostatni) + 180],
      webhookId: id(302),
    },
    {
      parameters: { jsCode: src('weryfikacja-zrodel.js') },
      id: id(5),
      name: 'Weryfikacja źródeł',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [X(ostatni) + 880, 0],
    },
    {
      parameters: {
        tableId: 'reports',
        // Wysyła category, title, content i data (obiekt JSON do kolumny jsonb) bez zamiany na tekst
        dataToSend: 'autoMapInputData',
        inputsToIgnore: '',
      },
      id: id(4),
      name: 'Zapis do apki',
      type: 'n8n-nodes-base.supabase',
      typeVersion: 1,
      position: [X(ostatni) + 1100, 0],
      credentials: { supabaseApi: { name: 'Supabase account' } },
    },
  ],
  connections: {
    Start: { main: [[to('Dane i tematy')]] },
    'Harmonogram 9/14/20': { main: [[to('Dane i tematy')]] },
    'Dane i tematy': { main: [[to('Jeden prompt')]] },
    'Jeden prompt': { main: [[to('Runda')]] },
    Runda: { main: [[to(MODELE[0].nazwa)]] },
    ...polaczeniaModeli,
    // tak = zostały rundy → pauza i od nowa; nie = koniec prób → raport bez komentarza AI
    'Kolejna runda?': { main: [[to(`Pauza ${PAUZA_MIEDZY_RUNDAMI_S} s`)], [WERYFIKACJA]] },
    [`Pauza ${PAUZA_MIEDZY_RUNDAMI_S} s`]: { main: [[to('Runda')]] },
    'Weryfikacja źródeł': { main: [[to('Zapis do apki')]] },
  },
  settings: { executionOrder: 'v1', timezone: 'Europe/Warsaw' },
};

fs.writeFileSync(new URL('raport-dzienny.json', dir), JSON.stringify(workflow, null, 2) + '\n');
console.log('Zapisano n8n/raport-dzienny.json');
