# Narzędzia do testów i diagnostyki

Skrypty, którymi Claude sprawdzał projekt (wcześniej leżały w katalogu tymczasowym — tu są na stałe).
Czytają historię n8n prosto z jego bazy (`~/.n8n/database.sqlite`, tylko odczyt; inna lokalizacja: zmienna `N8N_DB`).

**Wymagania:** Node 22.6+ (wbudowany SQLite i uruchamianie TypeScriptu). Jednorazowo w tym folderze: `npm install`.
**Wyniki i kopie** (np. lista CERT) lądują w `dane/` — folder jest ignorowany przez Git.

| Polecenie (w folderze `narzedzia`) | Co robi | Kiedy używać |
|---|---|---|
| `node uruchomienia.cjs [N]` / `node uruchomienia.cjs od 60` | lista ostatnich uruchomień n8n: typ raportu, czy AI odpowiedziało, kontrola liczb i stanu sesji, problemy ze źródłami, czy poszło powiadomienie | „czy weekend / noc poszły dobrze?” |
| `node raport.cjs [nr] [pelny]` | szczegóły jednego raportu: stan rynków, tematy, niezgodne liczby, pomysły, treść powiadomienia; `pelny` = dane dla AI i cały komentarz | „co było w raporcie z soboty?”, „czemu jest ⚠️?” |
| `node kontrola-historia.cjs [krotko]` | uruchamia aktualną kontrolę (klocek Weryfikacja z `n8n/src`) na WSZYSTKICH raportach z historii | **po każdej zmianie kontroli liczb** — liczba niezgodnych nie może rosnąć (stan 12.10: 52 raporty, 4538 liczb, 9 niezgodnych — same prawdziwe błędy AI, 1 błąd stanu sesji) |
| `FAIL=faireconomy node n8n-test.cjs` | lokalny przebieg klocków n8n na prawdziwych źródłach (bez wywołania AI — komentarz z ostatniego raportu) + treść powiadomienia; wynik w `dane/test-wynik.json` | **po każdej zmianie w `n8n/src`**, przed importem do n8n |
| `FAKE_NOW=2026-10-10T08:00:00Z node n8n-test.cjs --pamiec-z-n8n` | to samo, ale „w sobotę 10:00” i z prawdziwą pamięcią tygodnia | test raportów weekendowych |
| `FAIL='BTC-USD\|sekurak' node n8n-test.cjs` | udaje awarię wybranych źródeł | test ostrzeżeń „źródło nie odpowiada” |
| `node audyt-danych.cjs [nr]` | kursy z raportu vs to, co Yahoo/NBP podają teraz + niezależne przeliczenie zmian dziennych | „czy dane są wiarygodne?” (świeży raport: różnice 0–0,2%) |
| `node czat-test.mts "pytanie" "dalsze pytanie"` | prawdziwa rozmowa z Gemini na danych z ostatniego raportu (klucz z `web/.env.local`, nie jest wyświetlany) | po zmianach w czacie (`web/src/lib/czat-*.ts`) |

Uwagi:
- `n8n-test.cjs` przy każdym uruchomieniu pobiera prawdziwe dane — Forex Factory blokuje (429) po kilku pobraniach w krótkim czasie, dlatego przy serii testów dodawaj `FAIL=faireconomy`.
- W `n8n-test.cjs` liczby w kontroli zwykle się „nie zgadzają” (stary komentarz AI vs nowe dane) — to normalne; wiarygodny test kontroli to `kontrola-historia.cjs`.
- `czat-test.mts` zużywa limit darmowego Gemini dla klucza czatu (każde pytanie = 1 zapytanie).
- Na Windows w Git Bash zmienne środowiskowe ustawiasz jak wyżej (`FAIL=... node ...`); w PowerShell: `$env:FAIL='faireconomy'; node n8n-test.cjs`.
