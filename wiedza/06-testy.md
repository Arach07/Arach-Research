# 06. Testy i sprawdzanie

Narzędzia i ich opis: **[`../narzedzia/README.md`](../narzedzia/README.md)** (jednorazowo `npm install` w `narzedzia/`).

## Co sprawdzać po zmianie
| Zmiana | Sprawdzenie |
|---|---|
| kod klocków n8n (`n8n/src`) | `FAIL=faireconomy node narzedzia/n8n-test.cjs` (przebieg bez błędów, tematy, stan rynków, powiadomienie) → `node n8n/build-workflow.mjs` → import + **Publish** w n8n |
| kontrola liczb / stanu sesji (`weryfikacja-zrodel.js`) | `node narzedzia/kontrola-historia.cjs` — niezgodnych nie może przybyć; prawdziwe błędy (329%, 39022 zł…) dalej łapane |
| raporty weekendowe | `FAKE_NOW=2026-10-10T08:00:00Z node narzedzia/n8n-test.cjs --pamiec-z-n8n` (sobota) i `FAKE_NOW=2026-10-11T16:00:00Z …` (niedziela) |
| apka (`web/`) | w `web/`: `npx tsc --noEmit && npx eslint src && npx next build`; wygląd sprawdza Arek na iPhonie (apka wymaga logowania — Claude nie widzi ekranu) |
| czat | `node narzedzia/czat-test.mts "pytanie"` (prawdziwy Gemini) |
| po wdrożeniu n8n | `node narzedzia/uruchomienia.cjs` po najbliższym raporcie; czy opublikowana wersja = plik (porównanie kodu klocków w bazie n8n z `n8n/raport-dzienny.json`) |
| wiarygodność danych | `node narzedzia/audyt-danych.cjs` zaraz po raporcie |

## Wyniki przeglądów
- **30.09 (kamień milowy):** 34 kursy zgodne ze źródłami (0,00–0,18%), zmiany dzienne przeliczone niezależnie się zgadzają, NBP co do grosza; kontrola na 22 raportach bez fałszywych alarmów; 9 problemów w kodzie znalezionych i poprawionych (m.in. raport ginął, gdy lista CERT nie odpowiadała; fałszywe „brak raportu” w weekend).
- **07.10:** wszystkie automatyczne raporty od 01.10 OK, w tym pierwszy weekend; poprawione: Yahoo RSS (404), fałszywy alarm „506.592”, sekcje sobotnie.
- **12.10:** wszystkie automatyczne raporty 01.10–12.10 zakończone sukcesem (w tym drugi weekend); kontrola na 52 raportach: 0 fałszywych alarmów po poprawce „32.299.946”.

Wzorzec, który się sprawdza: najpierw liczby i dane (narzędzia), potem dopiero wnioski; każdą zmianę kontroli testować na całej historii.
