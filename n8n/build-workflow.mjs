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

const workflow = {
  name: 'Raport dzienny',
  nodes: [
    {
      parameters: {},
      id: '7b0f7a1e-1111-4a6b-9c01-000000000001',
      name: 'Start',
      type: 'n8n-nodes-base.manualTrigger',
      typeVersion: 1,
      position: [0, -120],
    },
    {
      // Codziennie o 9:00, 14:00 i 20:00 czasu polskiego (9:00 = po odnowieniu dziennego limitu Gemini) (strefa z ustawień workflowu)
      parameters: {
        rule: { interval: [{ field: 'cronExpression', expression: '0 9,14,20 * * *' }] },
      },
      id: '7b0f7a1e-1111-4a6b-9c01-000000000009',
      name: 'Harmonogram 9/14/20',
      type: 'n8n-nodes-base.scheduleTrigger',
      typeVersion: 1.2,
      position: [0, 120],
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
      // Darmowy Gemini ma mały dzienny limit — wszystkie tematy idą w jednym zapytaniu
      parameters: { jsCode: src('jeden-prompt.js') },
      id: '7b0f7a1e-1111-4a6b-9c01-000000000006',
      name: 'Jeden prompt',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [440, 0],
    },
    {
      parameters: {
        modelId: { __rl: true, mode: 'id', value: 'models/gemini-3.5-flash-lite' },
        messages: { values: [{ content: '={{ $json.prompt }}' }] },
        jsonOutput: true,
        options: { includeMergedResponse: true, systemMessage: SYSTEM },
      },
      id: '7b0f7a1e-1111-4a6b-9c01-000000000003',
      name: 'Gemini',
      type: '@n8n/n8n-nodes-langchain.googleGemini',
      typeVersion: 1.2,
      position: [660, 0],
      retryOnFail: true,
      maxTries: 3,
      waitBetweenTries: 5000,
      // Gdy Gemini nie odpowie (np. limit), raport powstaje bez komentarza AI
      onError: 'continueRegularOutput',
      credentials: { googlePalmApi: { name: 'Google Gemini(PaLM) Api account' } },
    },
    {
      parameters: { jsCode: src('weryfikacja-zrodel.js') },
      id: '7b0f7a1e-1111-4a6b-9c01-000000000005',
      name: 'Weryfikacja źródeł',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [880, 0],
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
      position: [1100, 0],
      credentials: { supabaseApi: { name: 'Supabase account' } },
    },
  ],
  connections: {
    Start: { main: [[{ node: 'Dane i tematy', type: 'main', index: 0 }]] },
    'Harmonogram 9/14/20': { main: [[{ node: 'Dane i tematy', type: 'main', index: 0 }]] },
    'Dane i tematy': { main: [[{ node: 'Jeden prompt', type: 'main', index: 0 }]] },
    'Jeden prompt': { main: [[{ node: 'Gemini', type: 'main', index: 0 }]] },
    Gemini: { main: [[{ node: 'Weryfikacja źródeł', type: 'main', index: 0 }]] },
    'Weryfikacja źródeł': { main: [[{ node: 'Zapis do apki', type: 'main', index: 0 }]] },
  },
  settings: { executionOrder: 'v1', timezone: 'Europe/Warsaw' },
};

fs.writeFileSync(new URL('raport-dzienny.json', dir), JSON.stringify(workflow, null, 2) + '\n');
console.log('Zapisano n8n/raport-dzienny.json');
