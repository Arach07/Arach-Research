// Składa n8n/raport-dzienny.json z kodu w n8n/src (żeby nie edytować JS wewnątrz JSON-a).
// Uruchom: node n8n/build-workflow.mjs
import fs from 'node:fs';

const dir = new URL('.', import.meta.url);
const src = (f) => fs.readFileSync(new URL(`src/${f}`, dir), 'utf8');

const SYSTEM = `Jesteś analitykiem rynków finansowych. Piszesz krótkie, rzeczowe raporty po polsku dla inwestora indywidualnego.

Zasady:
- Liczby z sekcji TWARDE DANE są pewne (pochodzą z API). Używaj tylko ich dla tych instrumentów. Jeśli wyszukiwarka podaje inne wartości, ufaj twardym danym.
- Newsy i prognozy bierz z wyszukiwarki Google, z ostatnich 24-48 godzin (dla oszustw z ostatnich 7 dni).
- Po każdej informacji z wyszukiwarki podaj w nawiasie domenę źródła, np. (bankier.pl).
- Prognozy tylko cytowane od analityków lub instytucji, z nazwą autora. Nigdy nie wymyślaj własnych prognoz ani liczb.
- Nie cytuj stron, które wyglądają na reklamy inwestycyjne, "platformy AI" albo obiecują zyski.
- Jeśli czegoś nie znalazłeś, napisz to wprost zamiast zgadywać.
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
                '=Dzisiaj jest {{ $json.dzis }}.\n\nTWARDE DANE:\n{{ $json.daneTekst }}\n\nTEMAT RAPORTU:\n{{ $json.prompt }}',
            },
          ],
        },
        builtInTools: { googleSearch: true },
        options: { includeMergedResponse: true, systemMessage: SYSTEM },
      },
      id: '7b0f7a1e-1111-4a6b-9c01-000000000003',
      name: 'Gemini + Google Search',
      type: '@n8n/n8n-nodes-langchain.googleGemini',
      typeVersion: 1.2,
      position: [440, 0],
      retryOnFail: true,
      maxTries: 3,
      waitBetweenTries: 5000,
      credentials: { googlePalmApi: { name: 'Google Gemini(PaLM) Api account' } },
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
        fieldsUi: {
          fieldValues: [
            { fieldId: 'category', fieldValue: '={{ $json.category }}' },
            { fieldId: 'title', fieldValue: '={{ $json.title }}' },
            { fieldId: 'content', fieldValue: '={{ $json.content }}' },
          ],
        },
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
    'Dane i tematy': { main: [[{ node: 'Gemini + Google Search', type: 'main', index: 0 }]] },
    'Gemini + Google Search': { main: [[{ node: 'Weryfikacja źródeł', type: 'main', index: 0 }]] },
    'Weryfikacja źródeł': { main: [[{ node: 'Zapis do apki', type: 'main', index: 0 }]] },
  },
  settings: { executionOrder: 'v1' },
};

fs.writeFileSync(new URL('raport-dzienny.json', dir), JSON.stringify(workflow, null, 2) + '\n');
console.log('Zapisano n8n/raport-dzienny.json');
