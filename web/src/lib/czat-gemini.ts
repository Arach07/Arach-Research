// Rozmowa z Gemini dla czatu w apce: odpowiedź strumieniowo (pojawia się słowo po słowie).
// Gdy model jest przeciążony (503) albo ma wyczerpany limit (429), próbujemy następnego.
// Klucz: GEMINI_CHAT_KEY — osobny projekt w AI Studio, żeby czat nie zjadał limitu raportów n8n.

export type Wiadomosc = { role: "user" | "model"; text: string };

// Kolejność prób (każdy model ma osobny dzienny limit)
export const MODELE_CZATU = ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-3.5-flash", "gemini-3-flash-preview"];

export class BladCzatu extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function komunikat(status: number, tresc: string) {
  if (status === 429) return "Limit pytań do AI na dziś jest wyczerpany. Spróbuj jutro.";
  if (status === 503 || status === 500) return "AI jest teraz przeciążone. Spróbuj za chwilę.";
  if (status === 400 && /api key/i.test(tresc)) return "Klucz AI jest nieprawidłowy — sprawdź GEMINI_CHAT_KEY w Vercelu.";
  if (status === 403) return "Klucz AI nie ma dostępu do Gemini — sprawdź projekt w AI Studio.";
  return `AI nie odpowiedziało (błąd ${status}).`;
}

// Zwraca strumień tekstu odpowiedzi. Błąd przed rozpoczęciem odpowiedzi → BladCzatu (z czytelnym komunikatem).
export async function rozmowaZGemini({
  klucz,
  instrukcja,
  wiadomosci,
  modele = MODELE_CZATU,
  baza = "https://generativelanguage.googleapis.com",
}: {
  klucz: string;
  instrukcja: string;
  wiadomosci: Wiadomosc[];
  modele?: string[];
  baza?: string;
}): Promise<ReadableStream<Uint8Array>> {
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: instrukcja }] },
    contents: wiadomosci.map((w) => ({ role: w.role, parts: [{ text: w.text }] })),
    generationConfig: { temperature: 0.4, maxOutputTokens: 1500 },
  });

  let ostatni: BladCzatu | null = null;
  for (const model of modele) {
    let res: Response;
    try {
      res = await fetch(`${baza}/v1beta/models/${model}:streamGenerateContent?alt=sse`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": klucz },
        body,
        signal: AbortSignal.timeout(30_000),
      });
    } catch {
      ostatni = new BladCzatu("Nie udało się połączyć z AI. Spróbuj za chwilę.", 504);
      continue;
    }
    if (!res.ok || !res.body) {
      const tresc = await res.text().catch(() => "");
      ostatni = new BladCzatu(komunikat(res.status, tresc), res.status);
      // Przeciążenie, limit albo brak modelu dla tego klucza — próbujemy następnego modelu
      if ([404, 429, 500, 503].includes(res.status)) continue;
      throw ostatni;
    }
    return tekstZeStrumienia(res.body);
  }
  throw ostatni ?? new BladCzatu("AI nie odpowiedziało.", 502);
}

// Odpowiedź Gemini (SSE: "data: {json}\n\n") → sam tekst odpowiedzi
function tekstZeStrumienia(zrodlo: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  const dekoder = new TextDecoder();
  const koder = new TextEncoder();
  let bufor = "";
  const reader = zrodlo.getReader();
  return new ReadableStream<Uint8Array>({
    // Czytamy, aż będzie co oddać (kawałek z sieci nie zawsze zawiera pełne zdarzenie) — inaczej strumień stoi
    async pull(controller) {
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) {
            if (bufor.trim()) wyslij(bufor, controller);
            controller.close();
            return;
          }
          bufor += dekoder.decode(value, { stream: true });
          const zdarzenia = bufor.split(/\r?\n\r?\n/);
          bufor = zdarzenia.pop() ?? "";
          let wyslane = 0;
          for (const z of zdarzenia) wyslane += wyslij(z, controller);
          if (wyslane) return;
        }
      } catch {
        controller.enqueue(koder.encode("\n\n⚠️ Odpowiedź została przerwana."));
        controller.close();
      }
    },
    cancel() {
      reader.cancel().catch(() => {});
    },
  });

  // Zwraca, ile kawałków tekstu przekazano dalej
  function wyslij(zdarzenie: string, controller: ReadableStreamDefaultController<Uint8Array>) {
    let n = 0;
    for (const linia of zdarzenie.split(/\r?\n/)) {
      if (!linia.startsWith("data:")) continue;
      try {
        const json = JSON.parse(linia.slice(5).trim());
        const tekst = (json.candidates?.[0]?.content?.parts ?? [])
          .map((p: { text?: string; thought?: boolean }) => (p.thought ? "" : (p.text ?? "")))
          .join("");
        if (tekst) {
          controller.enqueue(koder.encode(tekst));
          n++;
        }
      } catch {
        // niepełna linia — pomijamy
      }
    }
    return n;
  }
}
