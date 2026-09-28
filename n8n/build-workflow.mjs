// Składa n8n/raport-dzienny.json z kodu w n8n/src (żeby nie edytować JS wewnątrz JSON-a).
// Uruchom: node n8n/build-workflow.mjs
import fs from 'node:fs';

const dir = new URL('.', import.meta.url);
const src = (f) => fs.readFileSync(new URL(`src/${f}`, dir), 'utf8');

const SYSTEM = `Jesteś analitykiem rynków finansowych. Piszesz krótkie, rzeczowe raporty po polsku dla inwestora indywidualnego.

Zasady:
- Korzystaj WYŁĄCZNIE z sekcji TWARDE DANE i NEWSY. Nie dopisuj faktów, liczb ani wydarzeń spoza nich.
- Liczby z TWARDE DANE są pewne (z API). Nie podawaj innych wartości dla tych instrumentów.
- Po każdej informacji z newsów podaj numer źródła w nawiasie kwadratowym, np. [3]. Możesz łączyć kilka: [1][4].
- Prognozy tylko wtedy, gdy są w newsach, z nazwą autora. Nigdy nie wymyślaj własnych prognoz.
- Jeśli newsów na dany temat brakuje, napisz to wprost.
- 5-8 punktów, każdy zaczyna się od "- ". Na końcu jedno zdanie zaczynające się od "Podsumowanie:".
- Zwykły tekst: bez nagłówków, bez pogrubień, bez znaków # i *.`;

const workflow = {
  name: 'Raport dzienny',
  nodes: [
    {
      parameters: {},
      id: '7b0f7a1e-1111-4a6b-9c01-000000000001',
      name: 'Start',
      type: 'n8n-nodes-base.manualTrigger',
      typeVersion: 1,
      position: [0, 0],
    },
    {
      parameters: { jsCode: src('dane-i-tematy.js') },
      id: '7b0f7a1e-1111-4a6b-9c01-000000000002',
      name: 'Dane i tematy',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [220, 0],
    },
    {
      parameters: {
        modelId: { __rl: true, mode: 'id', value: 'models/gemini-3.5-flash-lite' },
        messages: {
          values: [
            {
              content:
                '=Dzisiaj jest {{ $json.dzis }}.\n\nTEMAT RAPORTU:\n{{ $json.prompt }}\n\nTWARDE DANE:\n{{ $json.daneTekst }}\n\nNEWSY (z zaufanych portali, numerowane):\n{{ $json.newsyTekst }}',
            },
          ],
        },
        options: { includeMergedResponse: true, systemMessage: SYSTEM },
      },
      id: '7b0f7a1e-1111-4a6b-9c01-000000000003',
      name: 'Gemini',
      type: '@n8n/n8n-nodes-langchain.googleGemini',
      typeVersion: 1.2,
      position: [680, 220],
      retryOnFail: true,
      maxTries: 2,
      waitBetweenTries: 5000,
      // Gdy Gemini nie odpowie (np. limit), raport powstaje bez komentarza AI
      onError: 'continueRegularOutput',
      credentials: { googlePalmApi: { name: 'Google Gemini(PaLM) Api account' } },
    },
    {
      // Darmowy Gemini ma limit zapytań na minutę — tematy idą po kolei z pauzą
      parameters: { batchSize: 1, options: {} },
      id: '7b0f7a1e-1111-4a6b-9c01-000000000006',
      name: 'Po kolei',
      type: 'n8n-nodes-base.splitInBatches',
      typeVersion: 3,
      position: [440, 0],
    },
    {
      parameters: { resume: 'timeInterval', amount: 10, unit: 'seconds' },
      id: '7b0f7a1e-1111-4a6b-9c01-000000000007',
      name: 'Pauza 10 s',
      type: 'n8n-nodes-base.wait',
      typeVersion: 1.1,
      position: [920, 220],
      webhookId: '7b0f7a1e-1111-4a6b-9c01-000000000008',
    },
    {
      parameters: { jsCode: src('weryfikacja-zrodel.js') },
      id: '7b0f7a1e-1111-4a6b-9c01-000000000005',
      name: 'Weryfikacja źródeł',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [680, 0],
    },
    {
      parameters: {
        tableId: 'reports',
        // Wysyła category, title, content i data (obiekt JSON do kolumny jsonb) bez zamiany na tekst
        dataToSend: 'autoMapInputData',
        inputsToIgnore: '',
      },
      id: '7b0f7a1e-1111-4a6b-9c01-000000000004',
      name: 'Zapis do apki',
      type: 'n8n-nodes-base.supabase',
      typeVersion: 1,
      position: [900, 0],
      credentials: { supabaseApi: { name: 'Supabase account' } },
    },
  ],
  connections: {
    Start: { main: [[{ node: 'Dane i tematy', type: 'main', index: 0 }]] },
    'Dane i tematy': { main: [[{ node: 'Po kolei', type: 'main', index: 0 }]] },
    // wyjście 0 = "done" (wszystkie tematy gotowe), wyjście 1 = "loop" (kolejny temat)
    'Po kolei': {
      main: [
        [{ node: 'Weryfikacja źródeł', type: 'main', index: 0 }],
        [{ node: 'Gemini', type: 'main', index: 0 }],
      ],
    },
    'Gemini': { main: [[{ node: 'Pauza 10 s', type: 'main', index: 0 }]] },
    'Pauza 10 s': { main: [[{ node: 'Po kolei', type: 'main', index: 0 }]] },
    'Weryfikacja źródeł': { main: [[{ node: 'Zapis do apki', type: 'main', index: 0 }]] },
  },
  settings: { executionOrder: 'v1' },
};

fs.writeFileSync(new URL('raport-dzienny.json', dir), JSON.stringify(workflow, null, 2) + '\n');
console.log('Zapisano n8n/raport-dzienny.json');
