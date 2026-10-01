// Dane dla czatu AI: najnowsze raporty ze wszystkich zakładek + kursy na żywo + pomysły z wynikami,
// ułożone w zwięzły tekst (pełne raporty mają ok. 120 KB — AI dostaje wyciąg, ok. kilkanaście KB).
// Bez bazy i sieci (dane podaje /api/czat), więc da się to przetestować na prawdziwych raportach.

import type { Instrument, Report } from "./reports";

const TZ = "Europe/Warsaw";
const LABELS: Record<string, string> = {
  dzien: "PODSUMOWANIE DNIA",
  zloto: "ZŁOTO",
  gpw: "GPW",
  usa: "RYNEK USA",
  spolki: "SPÓŁKI (20 dużych z USA i GPW)",
  makro: "MAKRO",
  kalendarz: "KALENDARZ",
  krypto: "KRYPTO",
  scamy: "OSTRZEŻENIA PRZED OSZUSTWAMI",
};
export const KOLEJNOSC = ["dzien", "zloto", "gpw", "usa", "spolki", "makro", "kalendarz", "krypto", "scamy"];

export type PomyslWKontekscie = {
  created_at: string;
  tekst: string;
  kierunek: 1 | -1;
  nazwa: string | null;
  teraz: number | null; // zmiana od pomysłu do dziś (%)
  d7: number | null;
};

const kiedy = (iso: string) =>
  new Date(iso).toLocaleString("pl-PL", { timeZone: TZ, weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const proc = (v: number | null | undefined) =>
  v == null || Number.isNaN(v) ? "b/d" : `${v > 0 ? "+" : ""}${v.toFixed(2).replace(".", ",")}%`;
const liczba = (v: number, cyfry = 2) =>
  v.toLocaleString("pl-PL", { minimumFractionDigits: cyfry, maximumFractionDigits: cyfry });
const dzienSesji = (d?: string | null) =>
  d ? new Date(`${d}T12:00:00Z`).toLocaleDateString("pl-PL", { timeZone: TZ, weekday: "short", day: "2-digit", month: "2-digit" }) : "";

function opisSesji(i: Instrument) {
  const s = i.sesja;
  if (!s) return "";
  if (s.status === "trwa") return "sesja trwa";
  if (s.status === "zamknieta") return "dzisiejsza sesja zamknięta (wynik ostateczny)";
  if (s.status === "dzis") return "dzisiejszy kurs NBP";
  return `dane z sesji ${dzienSesji(s.dzien)}`;
}

function linijkaInstrumentu(i: Instrument) {
  if (i.blad || i.wartosc == null) return `${i.nazwa}: brak danych`;
  const czesci = [
    `${i.nazwa}: ${liczba(i.wartosc, i.cyfry ?? 2)} ${i.jednostka ?? ""}`.trim(),
    `dzień ${proc(i.d1)}`,
    `tydzień ${proc(i.d7)}`,
    `miesiąc ${proc(i.d30)}`,
  ];
  if (i.rsi != null) czesci.push(`RSI ${Math.round(i.rsi)}`);
  if (i.odSma200 != null) czesci.push(`vs średnia 200 dni ${proc(i.odSma200)}`);
  if (i.odSzczytu != null) czesci.push(`od rocznego szczytu ${proc(i.odSzczytu)}`);
  if (i.opisPl) czesci.push(i.opisPl);
  const sesja = opisSesji(i);
  if (sesja) czesci.push(sesja);
  return czesci.join(" | ");
}

// Przypisy [3] z komentarzy zamieniamy na nazwę portalu — w czacie numery newsów nic by nie mówiły
function komentarzZPortalami(r: Report) {
  const newsy = new Map((r.data?.newsy ?? []).map((n) => [n.nr, n.domena]));
  return (r.data?.komentarz ?? "").replace(/\[(\d+)\]/g, (m, nr) => (newsy.has(Number(nr)) ? `(${newsy.get(Number(nr))})` : ""));
}

export function zbudujKontekst({
  latest,
  live,
  pomysly,
  focus,
}: {
  latest: Record<string, Report>;
  live: { byCategory: Record<string, Instrument[]>; fetchedAt: string } | null;
  pomysly: PomyslWKontekscie[];
  focus: Report | null;
}) {
  const bloki: string[] = [];
  const dzien = latest.dzien;

  if (dzien?.data?.stanRynkow?.length) {
    bloki.push(
      `=== STAN RYNKÓW (z raportu „${dzien.data.typRaportu?.nazwa ?? "raport"}”, ${kiedy(dzien.created_at)}) ===\n` +
        dzien.data.stanRynkow.map((s) => `- ${s.rynek}: ${s.tekst}`).join("\n"),
    );
  }

  // Kursy na żywo (te same co w kafelkach apki); gdy się nie udało — z raportów
  const widziane = new Set<string>();
  const kursy: string[] = [];
  for (const kat of KOLEJNOSC) {
    const lista = live?.byCategory[kat]?.length ? live.byCategory[kat] : (latest[kat]?.data?.instrumenty ?? []);
    for (const i of lista) {
      if (widziane.has(i.nazwa)) continue;
      widziane.add(i.nazwa);
      kursy.push(`- ${linijkaInstrumentu(i)}`);
    }
  }
  if (kursy.length) {
    bloki.push(
      `=== KURSY ${live ? `NA ŻYWO (pobrane ${new Date(live.fetchedAt).toLocaleTimeString("pl-PL", { timeZone: TZ, hour: "2-digit", minute: "2-digit" })})` : "Z OSTATNICH RAPORTÓW"} ===\n` +
        kursy.join("\n"),
    );
  }

  for (const kat of KOLEJNOSC) {
    const r = latest[kat];
    if (!r) continue;
    const czesci = [`=== ${LABELS[kat] ?? kat} — raport z ${kiedy(r.created_at)} ===`];
    const komentarz = komentarzZPortalami(r).slice(0, 6000);
    czesci.push(komentarz ? `Komentarz AI z raportu:\n${komentarz}` : "Komentarz AI: niedostępny w tym raporcie.");
    if (kat === "kalendarz" && r.data?.wydarzenia?.length) {
      czesci.push(
        "Wydarzenia (czas polski):\n" +
          r.data.wydarzenia
            .slice(0, 25)
            .map((w) => `- ${kiedy(w.data)} ${w.kraj}: ${w.nazwa} (ważność: ${w.waznosc}${w.prognoza ? `, prognoza ${w.prognoza}` : ""}${w.poprzednio ? `, poprzednio ${w.poprzednio}` : ""})`)
            .join("\n"),
      );
    }
    if (kat === "spolki" && r.data?.rekomendacje?.length) {
      czesci.push("Rekomendacje analityków z newsów:\n" + r.data.rekomendacje.map((x) => `- ${x.tytul} (${x.domena})`).join("\n"));
    }
    if (kat === "scamy" && r.data?.cert && !r.data.cert.blad) {
      czesci.push(`Lista CERT Polska: ${r.data.cert.wszystkie} niebezpiecznych domen, w tym ${r.data.cert.finansowe} „finansowych”.`);
    }
    const newsy = (r.data?.newsy ?? []).slice(0, 12);
    if (newsy.length) czesci.push("Newsy:\n" + newsy.map((n) => `- ${n.tytul} (${n.domena})`).join("\n"));
    bloki.push(czesci.join("\n"));
  }

  if (pomysly.length) {
    bloki.push(
      "=== POMYSŁY Z RAPORTÓW I ICH WYNIKI (najnowsze na górze) ===\n" +
        pomysly
          .slice(0, 12)
          .map(
            (p) =>
              `- ${kiedy(p.created_at)} ${p.kierunek === -1 ? "↓ ostrzeżenie" : "↑ szansa"}${p.nazwa ? ` — ${p.nazwa}` : ""}: ${p.tekst.replace(/\s*\[\d+\]/g, "")}` +
              (p.teraz != null ? ` | od pomysłu do dziś ${proc(p.teraz)}` : "") +
              (p.d7 != null ? ` | po 7 dniach ${proc(p.d7)}` : ""),
          )
          .join("\n"),
    );
  }

  if (focus) {
    bloki.push(
      `=== RAPORT, O KTÓRY PYTA UŻYTKOWNIK: ${LABELS[focus.category] ?? focus.category}, ${kiedy(focus.created_at)} ===\n` +
        (komentarzZPortalami(focus) || focus.content || "") +
        ((focus.data?.instrumenty ?? []).length ? `\nKursy z chwili raportu:\n${focus.data!.instrumenty!.map((i) => `- ${linijkaInstrumentu(i)}`).join("\n")}` : ""),
    );
  }

  return bloki.join("\n\n");
}

export function instrukcja(kontekst: string, teraz = new Date()) {
  return `Jesteś asystentem w prywatnej aplikacji „Research” (raporty rynkowe: GPW, USA, złoto, waluty, krypto, ostrzeżenia przed oszustwami). Rozmawiasz po polsku z jej właścicielem — inwestorem indywidualnym, który chce rozumieć rynki.

Zasady:
- Najpierw korzystaj z DANYCH APLIKACJI poniżej (najnowsze raporty i kursy na żywo). Liczby podawaj dokładnie tak jak w danych.
- Gdy odpowiadasz z wiedzy ogólnej (definicje, jak działa wskaźnik, historia), zaznacz to krótko: „(wiedza ogólna)”. Jeśli czegoś nie ma w danych (np. spółka spoza listy, starsze raporty, przyszłe kursy) — powiedz to wprost i nie zgaduj liczb.
- Szanuj STAN RYNKÓW: o sesji zamkniętej pisz jako o wyniku, o trwającej „w trakcie sesji”, przy danych z poprzedniej sesji podaj jej dzień.
- Przy informacjach z newsów podawaj portal, np. „według bankier.pl”.
- Pisz prosto i konkretnie: zwykle 2–6 zdań albo krótka lista z punktami zaczynającymi się od „- ”. Bez nagłówków i bez znaczników formatowania (** , #).
- Nie doradzasz kupna ani sprzedaży. Możesz wyjaśniać, porównywać i wskazywać ryzyka. Gdy pytanie dotyczy decyzji (kupić, sprzedać, zainwestować), zacznij odpowiedź od zdania: „Nie doradzam kupna ani sprzedaży, ale oto, co mówią dane:” i pokaż argumenty za i przeciw. W pozostałych odpowiedziach nie dodawaj zastrzeżeń (aplikacja pokazuje je na stałe).

Teraz jest ${teraz.toLocaleString("pl-PL", { timeZone: TZ, weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}.

DANE APLIKACJI:
${kontekst}`;
}
