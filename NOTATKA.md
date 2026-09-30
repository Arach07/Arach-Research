# Research: notatka o stanie projektu

**Stan na: wtorek 29.09.2026, rano (komputer w pracy)**

Ta notatka opisuje dokładnie, co już działa, gdzie co jest i co robimy dalej.
Żeby wrócić do pracy, napisz w Claude Code: **„jestem w domu, robimy VPN”** albo **„robimy Oracle”**.

---

## 1. Co to jest i jak działa

Prywatna aplikacja (tylko dla mnie), która **3 razy dziennie** zbiera informacje o rynkach i pokazuje je na telefonie:
złoto, GPW, rynek USA, krypto, ostrzeżenia przed scamami oraz podsumowanie dnia.

```
[n8n: harmonogram 9:00 / 14:00 / 20:00]
   → pobiera twarde dane z API (NBP, Yahoo Finance, lista CERT Polska)
   → pobiera newsy z RSS 13 zaufanych portali
   → Gemini pisze komentarz TYLKO na podstawie tych danych, z numerami źródeł [1] [2]
   → weryfikacja: każdy link sprawdzany na liście niebezpiecznych domen CERT Polska
   → zapis do bazy Supabase (tabela reports)
          ↓
[Apka na Vercelu (PWA, styl Midnight Gold)] ← czyta raporty z Supabase, logowanie tylko dla mnie
```

Dlaczego tak:
- **Twarde dane z API**, bo AI potrafi pewnym tonem podać nieaktualne liczby (tak było ze złotem: „wysoko”, a w rzeczywistości spadało).
- **RSS zamiast wyszukiwarki Google w Gemini**, bo darmowy Gemini z Google Search zwracał błąd 429 (limit), a RSS jest darmowy, bez limitów i daje prawdziwe linki.
- **Raport powstaje nawet bez Gemini:** jeśli AI ma limit, zapisują się dane i nagłówki z dopiskiem „Komentarz AI niedostępny”.

---

## 2. Konta i usługi (wszystko darmowe)

| Usługa | Do czego | Szczegóły |
|---|---|---|
| **GitHub** | kod projektu | repo **Arach07/Arach-Research** (prywatne), gałąź `main` |
| **Vercel** | hosting apki | projekt **research-page** (Root Directory: `web`), każdy push na `main` = automatyczny deploy |
| **Supabase** | baza + logowanie | organizacja i projekt **Arach-Research**, URL `https://iknezuouboolldwoahzw.supabase.co` |
| **Google AI Studio** | klucz Gemini API | darmowy plan, **bez podpiętej płatności** (billing) |
| **n8n** | automatyzacja | wersja 2.40.7, lokalnie na komputerze w pracy, `http://localhost:5678`, darmowa licencja Community |

⚠️ Na Vercelu i w Supabase jest też osobny stary projekt **Home-Budget**. Nie mylić go z tym.

### Zmienne środowiskowe na Vercelu (projekt research-page)
- `NEXT_PUBLIC_SUPABASE_URL` = `https://iknezuouboolldwoahzw.supabase.co` (**bez** `/rest/v1/` na końcu, był z tym problem)
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` = klucz **anon public** z Supabase (publiczny z założenia)

### Credentiale w n8n (klucze nigdy nie trafiają do repo ani na czat)
- **Google Gemini(PaLM) Api account:** klucz z AI Studio.
- **Supabase account:** Host `https://iknezuouboolldwoahzw.supabase.co` + klucz **service_role (secret)** z zakładki „Legacy anon, service_role API keys”. Ten klucz jest **tylko w n8n**: nigdy na Vercelu ani na czacie.

### Bezpieczeństwo Supabase
- Rejestracja nowych użytkowników **wyłączona**, jest tylko moje konto (Auto Confirm).
- Tabela `reports` ma RLS: zalogowany użytkownik tylko **czyta**, zapisuje wyłącznie n8n (service_role).

---

## 3. Pliki w projekcie (`Desktop\ResearchApp`)

| Ścieżka | Co to |
|---|---|
| `web/` | apka Next.js 16 (uwaga: w wersji 16 middleware nazywa się `proxy.ts`) |
| `web/src/app/(app)/` | 4 zakładki: `page.tsx` (Dziś), `rynki/`, `scamy/`, `archiwum/` |
| `web/src/lib/cert.ts` | sprawdzanie linków na liście CERT + wykrywanie podszywania się |
| `supabase/schema.sql` | struktura tabeli `reports` (już uruchomiona w Supabase) |
| `n8n/raport-dzienny.json` | **gotowy workflow do wklejenia w n8n** (Ctrl+A → Ctrl+C → w n8n Ctrl+V) |
| `n8n/src/dane-i-tematy.js` | kod klocka „Dane i tematy” (API, RSS, lista tematów) |
| `n8n/src/weryfikacja-zrodel.js` | kod klocka „Weryfikacja źródeł” (CERT, składanie raportu) |
| `n8n/build-workflow.mjs` | skleja powyższe w `raport-dzienny.json`: `node n8n/build-workflow.mjs` |
| `n8n/start-n8n.cmd` | uruchamianie n8n na Windowsie (dwuklik, okna nie zamykać) |
| `design/makiety.html` | 3 makiety wyglądu; wybrana: **C „Midnight Gold”** |

---

## 4. Workflow n8n „Raport dzienny”

```
[Start] / [Harmonogram 9:00/14:00/20:00] → [Dane i tematy] → [Jeden prompt] → [Runda]
  → [Gemini 1] → nie? → [Gemini 2] → nie? → [Gemini 3] → nie? → [Gemini 4] → nie? → [Gemma 5]
       └tak──────────────┴──────────────┴──────────────┴──────────────┴──→ [Weryfikacja źródeł] → [Zapis do apki]
  wszystkie 5 odmówiły → [Kolejna runda?] → tak (runda < 3) → [Pauza 60 s] → [Runda] (od nowa)
                                          → nie → [Weryfikacja źródeł] (raport bez komentarza AI)
```

- **Łańcuch 5 modeli** (każdy ma **osobny** dzienny limit):
  1. `gemini-3.5-flash-lite`, 2. `gemini-3.5-flash`, 3. `gemini-3-flash-preview`, 4. `gemini-3.1-flash-lite`, 5. `gemma-4-31b-it`.
  - **Gemma** to tekstowy model Google (nie do grafik), zwykle z większym darmowym limitem. Nie przyjmuje instrukcji systemowej ani trybu JSON, więc zasady dostaje na początku wiadomości, a odpowiedź „naprawia” klocek Weryfikacja (wycina JSON, poprawia znaki nowej linii).
- **Pauza 10 s przed każdym kolejnym modelem.** Diagnoza z historii n8n (28.09): nieudane próby to **503 „Service unavailable”** (przeciążenie serwerów Google), a **nie** wyczerpany limit, więc chwila odczekania pomaga.
- **Rundy:** gdy wszystkie 5 modeli odmówi, następuje pauza 60 s i cały łańcuch od nowa, **maksymalnie 3 rundy** (pomaga na przeciążenia 503; na wyczerpany dzienny limit 429 pomagają inne modele).
- Modele, liczbę rund i pauzę zmienia się w `n8n/build-workflow.mjs` (`MODELE`, `RUNDY`, `PAUZA_MIEDZY_RUNDAMI_S`), a potem trzeba uruchomić `node n8n/build-workflow.mjs`.
- Pomijamy modele 2.5 (niedostępne dla nowych kont), „live”, „transcribe”, „lyria” (muzyka), „nano-banana” (grafika), „robotics”.

- **Model Gemini:** `models/gemini-3.5-flash-lite`. Modele `gemini-2.5-*` zwracają 404 dla nowych użytkowników, a `3-flash-preview` i `3.5-flash` były przeciążone (503).
- **Jedno zapytanie do Gemini na cały raport** (klocek „Jeden prompt”, kod w `n8n/src/jeden-prompt.js`). Gemini odsyła JSON `{ "zloto": "...", "gpw": "...", ... }`.
  - **Dlaczego:** błędy „too many requests” to był **DZIENNY** limit darmowego Gemini, a nie minutowy, więc pauzy nie pomagały. 6 zapytań × 3 razy dziennie = 18 to za dużo. Teraz są **3 zapytania dziennie**.
  - Wcześniejsza wersja z pętlą „Po kolei” i pauzą 10 s jest zastąpiona.
- **Limit Gemini odnawia się ok. 9:00** czasu polskiego (północ w Kalifornii), dlatego pierwszy raport jest o 9:00. Każde ręczne „Execute workflow” też zużywa 1 zapytanie.
- **Gemini ma „continue on error”:** przy limicie raport i tak się zapisuje (dane, wykresy i newsy, bez komentarza AI).
- **Strefa czasowa workflowu:** Europe/Warsaw.
- **Zapis do apki:** klocek Supabase w trybie **Auto-Map Input Data**, więc sam wysyła `category`, `title`, `content`, `data`.
- **Tematy** (dodanie nowego = nowa pozycja w tablicy `tematy` w `n8n/src/dane-i-tematy.js`, potem `node n8n/build-workflow.mjs` i ponowne wklejenie):
  `zloto`, `gpw`, `usa`, `spolki`, `krypto`, `scamy`, `dzien` (podsumowanie dnia).
- **🏢 Spółki: giganci** (od 29.09): Nvidia, AMD, Apple, Microsoft, Alphabet, Amazon, Meta, Tesla, Novo Nordisk, ASML, CD Projekt, PKO BP, Pekao, Orlen, KGHM, PZU, LPP, Dino, Allegro, XTB (20 spółek).
  - Dane: rok notowań z Yahoo (kurs, zmiany, **odległość od rocznego szczytu i dołka**), największe ruchy dnia i miesiąca.
  - Newsy: **Google News** z wyszukiwaniem po nazwie spółki (różne portale), tylko artykuły z nazwą spółki w tytule, bez wyników sportowych, filtrowane przez CERT.
  - Lista spółek jest w DWÓCH miejscach i nazwy muszą się zgadzać: `n8n/src/dane-i-tematy.js` (`SPOLKI`) i `web/src/lib/quotes.ts` (`SPOLKI`, kursy na żywo co 60 s).
- **🧠 Podsumowanie dnia** (od 29.09) jest dłuższe (ok. 300–450 słów), w sekcjach: 📰 Co się stało, 🔗 Co to znaczy, 🏢 Spółki w ruchu, **💡 Pomysły do rozważenia**, ⚠️ Ryzyka. Pomysły są formułowane jako „można rozważyć / warto przeanalizować”, z liczbami i źródłami, nigdy „kup”. Na końcu dopisek, że to informacja, a nie porada inwestycyjna.

### Źródła danych
- **Twarde dane:** NBP (złoto 1 g, USD/PLN, 30 dni), Yahoo Finance (złoto w USD, WIG20, WIG, S&P 500, Nasdaq, Dow Jones, Bitcoin i Ethereum: `BTC-USD`, `ETH-USD`), lista CERT Polska (ok. 130 tys. domen, w tym ok. 4,5 tys. „finansowych”).
- **RSS:** Bankier (x2), Money.pl, Parkiet, Puls Biznesu, Business Insider, Comparic, CNBC, MarketWatch, Yahoo Finance, CoinDesk, Cointelegraph, CERT Polska, Sekurak. Maksymalnie 3 newsy z jednego portalu na temat.

### Znane ograniczenia
- **Stooq** blokuje automaty (zabezpieczenie JavaScript), więc nie używamy.
- **WIG20 i WIG:** Yahoo nie ma ich historii dziennej. Rozwiązanie (29.09): dzienne zamknięcia składane z danych **godzinowych** z 3 miesięcy (ok. 67 dni), więc jest wykres 30 sesji i zmiany tygodniowe/miesięczne (w n8n `zGodzinowych`, w apce `dailyFromHourly`).
- **CoinGecko** od 29.09 rano zwraca 403 (blokada), więc krypto pobieramy z Yahoo.
- **Yahoo Finance** to nieoficjalne API; jeśli padnie, raport pokaże „brak danych” zamiast się wysypać.
- **Lista CERT** jest alfabetyczna i bez dat, więc przykłady domen są losowane, a nie „najnowsze”.
- **Tabela n8n Supabase:** lista tabel się nie ładuje („[object Object]”), dlatego `reports` jest wpisane ręcznie; kolumny ładują się normalnie.

---

## 5. Apka (Vercel), styl Midnight Gold

### Układ informacji (od 29.09): trzy poziomy, żeby nie było młynu
1. **📊 Dziś = raport do przeczytania raz** (9:00 / 14:00 / 20:00), rozwijany, sekcje: 📰 Co się stało · 🔄 Od ostatniego raportu · 📅 Co przed nami · 🌍 Makro w pigułce · 📊 Sygnały techniczne · 🏢 Spółki w ruchu · 📈 Rekomendacje dnia · 💡 Pomysły do rozważenia · ⚠️ Ryzyka.
2. **🔎 Rynki = dane do przeglądania**, przełącznik u góry:
   - **Przegląd:** złoto, GPW, USA, krypto,
   - **Spółki:** nastrój (ile spółek nad średnią 200 dni, vs tydzień temu) + lista z plakietkami z liczbami (🟢/🔴 % vs trend, RSI, 🔵 wyprzedana / 🟠 wykupiona, ⭐ nowa rekomendacja),
   - **Makro:** kafelki w grupach (stopy i obligacje, waluty, surowce, nastroje: VIX i Fear & Greed, świat: DAX),
   - **Kalendarz:** wydarzenia makro (Forex Factory) i wyniki spółek z USA (Nasdaq), czas polski.
3. **Strona spółki** (`/spolki/SYMBOL`): wykres, roczny zakres, **analiza techniczna z wyjaśnieniem po ludzku**, rekomendacje analityków dla tej spółki, newsy o niej.
- Wskaźniki: RSI(14) metodą Wildera, średnie 50 i 200 dni; liczone w n8n (`techniczne`) i na żywo w apce (`web/src/lib/tech.ts`).
- „Od ostatniego raportu” korzysta z pamięci workflowu n8n (`$getWorkflowStaticData`). Działa przy automatycznych uruchomieniach (przy ręcznym teście pamięć może być pusta).

Czarne tło ze złotą łuną u góry i ukośną fakturą, liczby w złotym gradiencie, zielone i czerwone zmiany.

| Zakładka | Zawartość |
|---|---|
| 📊 **Dziś** | pasek kursów, 🧠 podsumowanie dnia, karty tematów z mini-wykresem |
| 🔎 **Rynki** | instrumenty z wykresami 30 dni; po kliknięciu pełny raport z przypisami [n] do źródeł i listą poprzednich raportów |
| 🛡️ **Scamy** | **„Sprawdź link”** (🔴 z listy CERT / 🟡 podejrzana / 🟢 oficjalna / ⚪ brak na liście), porady, ostrzeżenia |
| 📁 **Archiwum** | raporty pogrupowane po dniach + wyszukiwarka |

- **Kursy na żywo:** zakładki Dziś i Rynki oraz szczegóły tematu pobierają kursy bezpośrednio (NBP, Yahoo), bez AI. Przeglądarka co 20 s odpytuje `/api/kursy`, co **nie dotyka bazy Supabase**, więc nie zużywa limitu transferu. Nowe raporty: apka co minutę pyta `/api/najnowszy-raport` tylko o datę najnowszego raportu (~100 bajtów) i gdy n8n doda nowy, sama go wczytuje (najpóźniej ok. 1 min po zapisie). Oznaczenie: zielona kropka i „Kursy na żywo · GG:MM”. Kod: `web/src/lib/quotes.ts`. Komentarze AI i newsy dalej pochodzą z raportu n8n (3 razy dziennie). Archiwum pokazuje kursy z chwili raportu.
  - Częstotliwość zmian w źródłach: złoto NBP i USD/PLN raz dziennie (dni robocze ok. 12:00), GPW w trakcie sesji 9:00–17:00 (ok. 15 min opóźnienia), USA 15:30–22:00, krypto 24/7.
- Instalacja na telefonie: otwórz adres apki, potem Udostępnij, potem „Dodaj do ekranu początkowego”.
- Raporty się **nie nadpisują**: każde uruchomienie dopisuje 6 nowych. „Dziś” i „Rynki” pokazują najnowsze, a starsze są w Archiwum.
- Miejsce: ok. 0,3 MB dziennie przy 12–18 raportach, a darmowy Supabase ma 500 MB, co daje ok. 3–4 lata.
- **Limity darmowego Supabase:** baza 500 MB, transfer ok. 5 GB/mies. Pomiar 29.09 (9 tematów): **1 raport ≈ 117 KB** (Spółki 43 KB, Podsumowanie 25 KB, Makro 15 KB), **dziennie ≈ 0,34 MB**, **30 dni ≈ 10 MB (ok. 2% limitu)**, więc sprzątanie po 30 dniach w zupełności wystarcza.
- **Szybkość (29.09):** Rynki mają wszystkie 4 widoki od razu w przeglądarce, więc przełączanie Przegląd/Spółki/Makro/Kalendarz jest natychmiastowe (`web/src/components/view-tabs.tsx`). Serwer nie pobiera już kursów na żywo przy ładowaniu stron; robi to przeglądarka (`/api/kursy`) zaraz po otwarciu i co 20 s. Z bazy pobierany jest tylko najnowszy raport z potrzebnych tematów (`latestReports`).
- **Sprzątanie:** raporty starsze niż **30 dni** usuwa co noc zadanie w bazie (pg_cron), plik `supabase/cleanup.sql`. Uruchomione 28.09.2026 (zadanie `usun-stare-raporty`, codziennie 3:00 UTC).
- **Do zrobienia później:** Archiwum pokazuje ostatnie 100 raportów; przy 30 dniach to ok. 5 dni, więc trzeba dodać „pokaż starsze”.

### Wiarygodność danych (od 29.09 wieczorem)
- **Stan źródeł:** n8n zapisuje w każdym raporcie `problemy`, czyli źródła, które nie odpowiedziały (API, kanały RSS, kalendarz, CERT). Dziś pokazuje wtedy złote ostrzeżenie. Drugie ostrzeżenie pojawia się, gdy nowego raportu nie ma od ponad 14 godzin (n8n nie działa?). Kod: `zglos()` w `dane-i-tematy.js`, komponent `web/src/components/source-status.tsx`.
- **Kontrola liczb AI:** klocek Weryfikacja sprawdza każdą liczbę z komentarza z danymi i newsami (także kierunek: „wzrost” przy spadku). Wynik jest pod komentarzem: ✓ albo lista niezgodnych liczb. Test na 21 raportach z historii: 513 liczb, 0 fałszywych alarmów, złapane 3 prawdziwe błędy AI („ASML +329%” zamiast 3,29%). Ograniczenie: wymyślona liczba, która przypadkiem pasuje do innej z danych, przejdzie.
- **Wyniki pomysłów** (`/pomysly`, link pod podsumowaniem dnia): raport dnia zapisuje migawkę cen (`ceny`) i listę pomysłów (`pomysly`, strzałka ↑ szansa / ↓ ostrzeżenie). Apka liczy zmianę do dziś, po 7 i po 30 dniach, na tle WIG20 lub S&P 500. Ten sam pomysł powtórzony w ciągu 3 dni liczy się raz. Obliczenia: `web/src/lib/pomysly-wyniki.ts`.
- **Sprzątanie:** podsumowania dnia są trzymane 180 dni (potrzebne do wyników po 30 dniach), reszta 30 dni. Nowy `supabase/cleanup.sql` uruchomiony 30.09 ✅.

---

## 6. NA CZYM SKOŃCZYLIŚMY: zadania do zrobienia

### A. Teraz, na komputerze w pracy (chodzi 24 h)

**Gdzie działa n8n:** obecnie **z okna rozmowy z Claude Code** (a nie z `start-n8n.cmd`).
Dopóki okno Claude Code jest otwarte, harmonogram działa. **Zamknięcie okna Claude Code = n8n się wyłącza.**
Gdy będziesz chciał, żeby n8n działał niezależnie: dwuklik na `n8n/start-n8n.cmd` (okno cmd „nie zamykaj”).

**Zrobione 28.09:**
- [x] Workflow z jednym zapytaniem do Gemini, łańcuchem modeli i harmonogramem, przetestowany ręcznie (komentarz napisał Gemini 3).
- [x] Test harmonogramu o 16:30: **n8n uruchomił się sam** ✅.
- [x] Apka sama pokazuje nowy raport najpóźniej ok. 1 min po zapisie ✅.
- [x] Supabase: sprzątanie raportów starszych niż 30 dni (`supabase/cleanup.sql`) ✅.
- [x] Kursy na żywo co 20 s, szybsze zakładki, kółeczko ładowania, stabilny układ ✅.

**Do zrobienia (najbliższe):**
1. [x] **Wgrać NAJNOWSZY workflow** z `n8n/raport-dzienny.json` (**5 modeli + do 3 rund z pauzą 60 s**): w n8n Ctrl+A, Delete, wklej, sprawdź **Credential** w 5 klockach modeli i w „Zapis do apki”, Ctrl+S.
2. [x] **Publish** (prawy górny róg), żeby harmonogram 9:00/14:00/20:00 działał. W nowej wersji nie ma już testowej reguły 16:30.
3. [x] ✅ 28.09 20:00 i 29.09 9:00: raport z komentarzem, Gemini 1 za pierwszym razem (ok. 30 s). Popołudniowe błędy 28.09 to była awaria/przeciążenie Google. **Sprawdzić raport z 20:00:** w apce „Komentarze z raportu: pon. 20:00” i czy jest komentarz AI. Jeśli nie, n8n, Executions, uruchomienie z 20:00, screen czerwonych klocków i treść błędu (429 = limit, 503 = przeciążenie).
3a. [ ] **Później: model spoza Google na końcu łańcucha**, żeby awaria Google (28.09 od ok. 16:30 wszystkie 5 modeli dawało 503) nie zostawiała raportu bez komentarza. Kandydaci darmowi: **Groq** (modele Llama, bez karty, bardzo szybki) albo **OpenRouter** (darmowe modele). Uwaga: **Groq ≠ Grok** — Grok to model firmy xAI (płatny API), Groq to darmowa platforma z modelami open source. Potrzebne: konto + klucz API, w n8n klocek HTTP Request albo gotowy klocek Groq.
4. [ ] Decyzja: dołożyć `gemini-3.8-flash` jako 6. model przed Gemmą? (propozycja Claude'a, jedna linijka w `MODELE`).
5. [ ] Jeśli n8n ma działać bez otwartego Claude Code: `start-n8n.cmd` + **autostart** (Win+R, `shell:startup`, skrót do `start-n8n.cmd`).
6. [x] Uśpienie komputera: potwierdzone, że komputer nie usypia się sam (tylko blokuje ekran). Nic nie trzeba zmieniać.
7. [ ] Bezpieczeństwo: klucz Gemini wklejony wcześniej na czat powinien być **usunięty w AI Studio** (nowy klucz tylko w n8n). Sprawdzić, czy stary na pewno skasowany.

⚠️ Komputer służbowy: IT może nie lubić programów serwerowych, a klucze leżą na firmowym sprzęcie. To rozwiązanie **przejściowe**, docelowo Oracle.

### B. W domu, zadanie 1: VPN na domowym komputerze (chcę się tego NAUCZYĆ)
**Cel:** bezpieczny dostęp do domowego komputera i n8n **z zewnątrz** (z pracy, z telefonu).

**Krok 0 (najważniejszy, 5 minut): czy mam publiczne IP, czy CGNAT?**
- Zalogować się do routera (zwykle `192.168.1.1` albo `192.168.0.1`, hasło często na naklejce) i znaleźć **adres WAN**.
- Wejść na **whatismyip.com** i porównać:
  - **takie same:** mam publiczne IP, robimy **WireGuard** od podstaw (więcej nauki),
  - **różne** (router pokazuje np. `100.x.x.x` albo `10.x.x.x`): jestem za **CGNAT**, robimy **Tailscale** (zbudowany na WireGuard, omija CGNAT).

**Czego się nauczę, po kolei:**
1. IP, NAT i porty: dlaczego komputer w domu jest „niewidoczny” z internetu.
2. Klucze publiczne i prywatne: jak urządzenia ufają sobie bez hasła.
3. Tunel: co się dzieje, gdy telefon „wchodzi” do domowej sieci.
4. Konfiguracja: serwer na domowym komputerze, klienci (telefon, laptop): peers, AllowedIPs.
5. Router: przekierowanie portu **UDP 51820** oraz DuckDNS, gdy IP się zmienia.
6. Test: z telefonu na danych komórkowych otworzyć n8n z domowego komputera.

**Przygotować:** login i hasło do routera, telefon, ok. 1 godzinę.
**Hasło startowe:** „jestem w domu, robimy VPN”.

### C. W domu, zadanie 2: n8n na Oracle Cloud (24/7, dostęp z każdego miejsca)
1. Konto: **oracle.com/cloud/free**, „Start for free”. **Home Region: Germany Central (Frankfurt)**, bo potem nie da się go zmienić. Karta jest tylko do weryfikacji.
2. Maszyna: Ubuntu, ARM Ampere A1 (np. 2 rdzenie i 12 GB RAM). Przy błędzie „out of capacity” ponawiać.
3. Otworzyć porty 80 i 443 w Oracle (Security List) i na maszynie.
4. Darmowa subdomena na **duckdns.org** (np. `arach-n8n.duckdns.org`) skierowana na IP serwera.
5. Claude przygotuje **docker-compose (n8n + Caddy z automatycznym HTTPS)** i skrypt instalacyjny, uruchamiany jedną komendą.
6. Na serwerze: konto w n8n, darmowy klucz licencji, credentiale (Gemini, Supabase service_role), import `n8n/raport-dzienny.json`, **Publish**.
7. Wyłączyć n8n na komputerze w pracy, żeby raporty nie robiły się podwójnie.

- **Plan B:** Mikrus (ok. 75 zł/rok) albo Hetzner (ok. 18 zł/mies.).
- **Opcja docelowa:** Oracle + VPN, czyli n8n widoczny **tylko przez mój VPN**, niewidoczny dla reszty internetu.
- **Hasło startowe:** „jestem w domu, robimy Oracle”.

---

## 7. PLAN ROZBUDOWY (zdecydowane 28.09.2026, robimy WSZYSTKO, ale PÓŹNIEJ; teraz bez zmian)

Kolejność do ustalenia przy starcie. Wszystko darmowe.

### 7.1 Watchlista moich spółek
- Wybrane spółki z GPW (np. `PKO.WA`, `PKN.WA`, `CDR.WA`, `KGH.WA`) i z USA (np. `NVDA`): kurs, zmiana, wykres i **newsy tylko o nich**.
- Lista edytowana w apce (ekran Ustawienia), trzymana w Supabase; n8n czyta ją przy każdym raporcie.

### 7.2 Kalendarz wydarzeń
- Decyzje o stopach: **RPP** (PL), **Fed** (USA), **EBC**.
- Dane makro: inflacja CPI, rynek pracy USA (NFP), PKB.
- **Wyniki kwartalne spółek i daty dywidend** (szczególnie GPW i watchlista).
- Źródła: darmowy tygodniowy kalendarz makro (XML) + RSS portali.

### 7.3 Stopy, obligacje, waluty, surowce, sentyment
- Stopa referencyjna **NBP**, WIBOR/WIRON, **inflacja PL** (GUS), rentowność **USA 10Y** (`^TNX`).
- Waluty: **EUR/PLN, CHF/PLN, GBP/PLN** (NBP).
- Surowce: **srebro, ropa Brent, gaz, miedź** (Yahoo; miedź → KGHM, ropa → Orlen).
- Europa i Azja: **DAX, Nikkei** (poranny nastrój przed otwarciem GPW).
- Sentyment: **VIX** (akcje), **Fear & Greed** (krypto, alternative.me).
- Kontekst techniczny: maksimum i minimum 52 tygodni, średnie 50/200 dni, odległość od rekordu.

### 7.4 Alerty push na telefon
- Duże ruchy (np. > 2%), progi cenowe (np. WIG20 < 4000), newsy o spółkach z watchlisty, nowe scamy.
- Web Push w PWA (Android i iPhone z apką na ekranie głównym).

### 7.5 Pozostałe pomysły (z analizy)
- **Raport poranny ≠ wieczorny:** 9:00 „co przed nami” (kalendarz, Azja, kontrakty na S&P), 20:00 „co się wydarzyło” (podsumowanie sesji, najwięksi zwycięzcy i przegrani).
- **Mój portfel:** pozycje (ile i po ile), wartość, zysk/strata, udziały.
- **Podsumowanie tygodnia** w niedzielę.
- **Obligacje detaliczne** (EDO, COI) i najlepsze lokaty jako punkt odniesienia; podatek Belki, limity IKE/IKZE.
- **Lista ostrzeżeń publicznych KNF** w scamach i w sprawdzaniu linków (nazwy firm).
- Ekran **Ustawienia** (godziny raportów, tematy, watchlista), „Pokaż starsze” w Archiwum.

Jak to działa: schemat od n8n do apki i dlaczego wybraliśmy takie rozwiązania.
Konta i usługi: GitHub, Vercel, Supabase, Gemini i n8n, gdzie który klucz ma trafić i czego nie mylić z Home-Budget. Samych kluczy w notatce nie ma.
Pliki w projekcie: co jest gdzie.
Workflow n8n: klocki, model Gemini, źródła danych, znane ograniczenia.
Apka: 4 zakładki, archiwum, ile miejsca zostało w bazie.
Na czym skończyliśmy: lista z kratkami do odhaczenia:
A. teraz w pracy: przełączenie n8n, Publish, autostart,
B. w domu: VPN, zaczynając od sprawdzenia, czy masz publiczne IP czy CGNAT, plus plan nauki,
C. w domu: Oracle krok po kroku.
Pomysły na później.
Zapisałem też w pamięci, żeby przy następnej rozmowie najpierw czytać tę notatkę. Wystarczy, że napiszesz „jestem w domu, robimy VPN” albo „na czym skończyliśmy?”. Po każdym zrobionym zadaniu będę ją aktualizował.

Nie zapisałem natomiast całej naszej rozmowy słowo w słowo. W notatce jest wszystko, co z niej ważne, tylko uporządkowane.

Zostało jeszcze zadanie A.1 na dziś: napisz „przełącz”, gdy będziesz gotowy odpalić start-n8n.cmd

---

## 8. Historia sesji 28.09.2026 (skrót chronologiczny)

1. Pomysł: kolega chciał newsy giełdowe na WhatsAppie. Opcje: n8n/Make/Zapier, gotowce (ChatGPT/Gemini), własny skrypt. WhatsApp trudny (Meta Business API), Telegram łatwy.
2. Decyzja: **uczę się n8n**; kolega robi swoją wersję sam. Pierwotny plan PWA porzucony, a potem wrócił jako moja prywatna apka.
3. Wybór **darmowego stosu**: n8n self-hosted + Gemini API (free) + Supabase + Vercel.
4. Instalacja n8n lokalnie (`npx n8n`), darmowa licencja Community.
5. Lekcja 1: n8n → NBP (cena złota). Lekcja 2: Gemini (błędy: 503 przeciążenie, 2.5 niedostępne dla nowych kont; działa `gemini-3.5-flash-lite`).
6. Mail (SMTP) odrzucony, od razu apka: Next.js 16 + Supabase (logowanie tylko ja, RLS) + Vercel (`research-page`). Problemy po drodze: pusty projekt Supabase, pomylony projekt Home-Budget, URL z `/rest/v1/`.
7. n8n → Supabase (klocek „Create a row”, klucz service_role).
8. Workflow z listą tematów (1 klocek zapisu zamiast wielu).
9. Gemini opisał złoto jako „wysoko”, choć spadało, więc przejście na **twarde dane z API** (NBP, Yahoo, CoinGecko) i **weryfikację źródeł na liście CERT Polska**.
10. Google Search w Gemini: błąd 429, więc **newsy z RSS 13 zaufanych portali**; raport powstaje nawet bez AI.
11. Makiety wyglądu, wybrany **Midnight Gold**; apka z 4 zakładkami (Dziś, Rynki, Scamy ze sprawdzaniem linków, Archiwum).
12. Harmonogram (najpierw 8/13/18, potem **9/14/20**, bo limit Gemini odnawia się ok. 9:00).
13. Odkrycie: błędy to **dzienny** limit, więc **1 zapytanie na raport** zamiast 6, potem **łańcuch 3, a następnie 5 modeli** (w tym Gemma) i **do 3 rund** z pauzą 60 s.
14. Apka: **kursy na żywo co 20 s** (bez zużywania limitu Supabase), sprawdzanie nowych raportów co minutę, przyspieszenie (serwer we Frankfurcie, lżejsze zapytania), kółeczko ładowania, stabilny układ.
15. Supabase: sprzątanie raportów po 30 dniach.
16. Plan rozbudowy na później (sekcja 7) i plan na dom: VPN (nauka) + Oracle (sekcja 6 B/C).

**Surowy zapis całej rozmowy** (z obrazkami, ok. 10 MB) jest tylko lokalnie na tym komputerze:
`C:/Users/arachowicz/.claude/projects/c--Users-arachowicz-Desktop-ResearchApp/3bf128a6-5c94-4b63-b4b1-dad18ba86d10.jsonl`
⚠️ Nie wrzucać go do repo ani nikomu nie wysyłać: zawiera m.in. klucz Gemini wklejony na czat.
