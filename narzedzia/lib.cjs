// Wspólne funkcje narzędzi: odczyt bazy n8n (TYLKO do odczytu), rozpakowanie zapisu wykonania, ścieżki.
// Baza n8n: ~/.n8n/database.sqlite (inna lokalizacja: zmienna N8N_DB). Wymaga Node 22.5+ (wbudowany node:sqlite).

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { parse } = require('flatted');

// node:sqlite jest oznaczony jako eksperymentalny — wyciszamy tylko to jedno ostrzeżenie
const emitWarning = process.emitWarning;
process.emitWarning = (w, ...a) => (String(w).includes('SQLite') ? undefined : emitWarning.call(process, w, ...a));

const REPO = path.resolve(__dirname, '..');
const DANE = path.join(__dirname, 'dane');
const BAZA_N8N = process.env.N8N_DB || path.join(os.homedir(), '.n8n', 'database.sqlite');
fs.mkdirSync(DANE, { recursive: true });

let polaczenie = null;
function baza() {
  if (!fs.existsSync(BAZA_N8N)) throw new Error(`Nie ma bazy n8n: ${BAZA_N8N} (ustaw N8N_DB, jeśli jest gdzie indziej)`);
  const { DatabaseSync } = require('node:sqlite');
  polaczenie ??= new DatabaseSync(BAZA_N8N, { readOnly: true });
  return polaczenie;
}

// Czas z bazy n8n (UTC, "2026-10-12 06:30:01.638") → czas polski
const czasPl = (s) =>
  new Date(s.replace(' ', 'T') + 'Z').toLocaleString('pl-PL', {
    timeZone: 'Europe/Warsaw',
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

function uruchomienia({ od = 0, limit = 1000 } = {}) {
  return baza()
    .prepare('select id, startedAt, stoppedAt, mode, status from execution_entity where id >= ? order by id desc limit ?')
    .all(od, limit)
    .reverse();
}

// Pełny zapis jednego wykonania: { id, startedAt, mode, status, runData } (runData = wyniki klocków)
function wykonanie(id) {
  const r = baza()
    .prepare(
      'select e.id, e.startedAt, e.mode, e.status, d.data from execution_entity e join execution_data d on d.executionId = e.id where e.id = ?',
    )
    .get(id);
  if (!r) return null;
  return { id: r.id, startedAt: r.startedAt, mode: r.mode, status: r.status, runData: parse(r.data).resultData?.runData ?? {} };
}

// Wynik klocka (lista item.json) albo null
const wyjscie = (runData, klocek) => runData[klocek]?.[0]?.data?.main?.[0]?.map((x) => x.json) ?? null;

// Odpowiedź AI z danego wykonania (ostatni model z łańcucha, który odpowiedział)
function odpowiedzAI(runData) {
  return (
    Object.entries(runData)
      .filter(([k]) => /Gemini|Gemma/.test(k))
      .flatMap(([, v]) => v)
      .map((r) => r.data?.main?.[0]?.[0]?.json?.mergedResponse)
      .filter(Boolean)
      .pop() ?? ''
  );
}

// Najnowsze wykonanie, w którym jest wynik danego klocka
function najnowszeZ(klocek) {
  for (const u of uruchomienia({ limit: 50 }).reverse()) {
    const w = wykonanie(u.id);
    if (w && wyjscie(w.runData, klocek)) return w;
  }
  return null;
}

// Pamięć workflowu n8n (staticData: ostatni raport, pomysły i statystyki tygodnia)
function pamiecN8n() {
  const r = baza().prepare('select staticData from workflow_entity where active = 1').get();
  if (!r?.staticData) return {};
  const d = JSON.parse(r.staticData);
  return d.global ?? d;
}

// Lista niebezpiecznych domen CERT (kopia w dane/cert.txt, odświeżana raz na dobę)
async function listaCert() {
  const plik = path.join(DANE, 'cert.txt');
  if (fs.existsSync(plik) && Date.now() - fs.statSync(plik).mtimeMs < 864e5) return fs.readFileSync(plik, 'utf8');
  const tekst = await (await fetch('https://hole.cert.pl/domains/v2/domains.txt')).text();
  fs.writeFileSync(plik, tekst);
  return tekst;
}

// Kod klocka n8n z repo (n8n/src/...) jako funkcja async — tak, jak uruchamia go n8n
const AsyncFunction = (async () => {}).constructor;
function klocek(plik, parametry) {
  return new AsyncFunction(...parametry, fs.readFileSync(path.join(REPO, 'n8n', 'src', plik), 'utf8'));
}

module.exports = { REPO, DANE, BAZA_N8N, baza, czasPl, uruchomienia, wykonanie, wyjscie, odpowiedzAI, najnowszeZ, pamiecN8n, listaCert, klocek };
