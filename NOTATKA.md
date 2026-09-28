# Research: notatka o stanie projektu

**Stan na: poniedziałek 28.09.2026, po południu (komputer w pracy)**

Ta notatka opisuje dokładnie, co już działa, gdzie co jest i co robimy dalej.
Żeby wrócić do pracy, napisz w Claude Code: **„jestem w domu, robimy VPN”** albo **„robimy Oracle”**.

---

## 1. Co to jest i jak działa

Prywatna aplikacja (tylko dla mnie), która **3 razy dziennie** zbiera informacje o rynkach i pokazuje je na telefonie:
złoto, GPW, rynek USA, krypto, ostrzeżenia przed scamami oraz podsumowanie dnia.

```
[n8n: harmonogram 8:00 / 13:00 / 18:00]
   → pobiera twarde dane z API (NBP, Yahoo Finance, CoinGecko, lista CERT Polska)
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
[Start (ręcznie)] ─┐
                   ├→ [Dane i tematy] → [Po kolei] ──done──→ [Weryfikacja źródeł] → [Zapis do apki]
[Harmonogram     ] ─┘                       ↓ loop     ↑
[8:00/13:00/18:00]                      [Gemini] → [Pauza 10 s]
```

- **Model Gemini:** `models/gemini-3.5-flash-lite`. Modele `gemini-2.5-*` zwracają 404 dla nowych użytkowników, a `3-flash-preview` i `3.5-flash` były przeciążone (503).
- **Pętla „Po kolei” z pauzą 10 s:** tematy idą do Gemini pojedynczo, bo darmowy limit zapytań na minutę jest mały.
- **Gemini ma „continue on error”:** przy limicie raport i tak się zapisuje.
- **Strefa czasowa workflowu:** Europe/Warsaw.
- **Zapis do apki:** klocek Supabase w trybie **Auto-Map Input Data**, więc sam wysyła `category`, `title`, `content`, `data`.
- **Tematy** (dodanie nowego = nowa pozycja w tablicy `tematy` w `n8n/src/dane-i-tematy.js`, potem `node n8n/build-workflow.mjs` i ponowne wklejenie):
  `zloto`, `gpw`, `usa`, `krypto`, `scamy`, `dzien` (podsumowanie dnia).

### Źródła danych
- **Twarde dane:** NBP (złoto 1 g, USD/PLN, 30 dni), Yahoo Finance (złoto w USD, WIG20, WIG, S&P 500, Nasdaq, Dow Jones), CoinGecko (Bitcoin, Ethereum), lista CERT Polska (ok. 130 tys. domen, w tym ok. 4,5 tys. „finansowych”).
- **RSS:** Bankier (x2), Money.pl, Parkiet, Puls Biznesu, Business Insider, Comparic, CNBC, MarketWatch, Yahoo Finance, CoinDesk, Cointelegraph, CERT Polska, Sekurak. Maksymalnie 3 newsy z jednego portalu na temat.

### Znane ograniczenia
- **Stooq** blokuje automaty (zabezpieczenie JavaScript), więc nie używamy.
- **WIG20 i WIG z Yahoo** mają tylko zmianę dzienną, bez historii tygodniowej i miesięcznej.
- **Yahoo Finance** to nieoficjalne API; jeśli padnie, raport pokaże „brak danych” zamiast się wysypać.
- **Lista CERT** jest alfabetyczna i bez dat, więc przykłady domen są losowane, a nie „najnowsze”.
- **Tabela n8n Supabase:** lista tabel się nie ładuje („[object Object]”), dlatego `reports` jest wpisane ręcznie; kolumny ładują się normalnie.

---

## 5. Apka (Vercel), styl Midnight Gold

Czarne tło ze złotą łuną u góry i ukośną fakturą, liczby w złotym gradiencie, zielone i czerwone zmiany.

| Zakładka | Zawartość |
|---|---|
| 📊 **Dziś** | pasek kursów, 🧠 podsumowanie dnia, karty tematów z mini-wykresem |
| 🔎 **Rynki** | instrumenty z wykresami 30 dni; po kliknięciu pełny raport z przypisami [n] do źródeł i listą poprzednich raportów |
| 🛡️ **Scamy** | **„Sprawdź link”** (🔴 z listy CERT / 🟡 podejrzana / 🟢 oficjalna / ⚪ brak na liście), porady, ostrzeżenia |
| 📁 **Archiwum** | raporty pogrupowane po dniach + wyszukiwarka |

- Instalacja na telefonie: otwórz adres apki, potem Udostępnij, potem „Dodaj do ekranu początkowego”.
- Raporty się **nie nadpisują**: każde uruchomienie dopisuje 6 nowych. „Dziś” i „Rynki” pokazują najnowsze, a starsze są w Archiwum.
- Miejsce: ok. 0,3 MB dziennie przy 12–18 raportach, a darmowy Supabase ma 500 MB, co daje ok. 3–4 lata.
- **Do zrobienia później:** Archiwum pokazuje ostatnie 100 raportów, więc trzeba dodać „pokaż starsze”. Opcjonalnie automatyczne usuwanie raportów starszych niż rok.

---

## 6. NA CZYM SKOŃCZYLIŚMY: zadania do zrobienia

### A. Teraz, na komputerze w pracy (chodzi 24 h)
1. [ ] Napisać Claude'owi **„przełącz”**. Wyłączy n8n uruchomione z rozmowy, które zgaśnie po zamknięciu sesji.
2. [ ] Dwuklik na `Desktop\ResearchApp\n8n\start-n8n.cmd` i poczekać na „Editor is now accessible”. **Okna nie zamykać.**
3. [ ] W n8n: Ctrl+A, potem Delete, potem wkleić zawartość `n8n/raport-dzienny.json` (z harmonogramem 8/13/18).
4. [ ] Sprawdzić credentiale w klockach **Gemini** i **Zapis do apki**, potem Ctrl+S.
5. [ ] Kliknąć **Publish** (prawy górny róg). **Bez tego harmonogram nie ruszy.**
6. [ ] Raz odpalić ręcznie (**Execute workflow**) i sprawdzić apkę: czy są wykresy, podsumowanie dnia i przypisy.
7. [ ] Autostart: Win+R, wpisać `shell:startup`, wrzucić tam **skrót** do `start-n8n.cmd`.
8. [ ] Uśpienie komputera: Ustawienia, System, Zasilanie, **Nigdy**.

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

## 7. Na później (pomysły)
- Ekran **Ustawienia** w apce: godziny raportów, obserwowane spółki, nowe tematy bez otwierania n8n.
- Powiadomienia push „📈 Raport gotowy”.
- „Pokaż starsze” w Archiwum.
- Twarde dane dla większej liczby instrumentów (srebro, ropa, EUR/PLN, pojedyncze spółki z GPW).
- Nauka n8n w praktyce: plan z pierwszej rozmowy (n8n → RSS/API → AI → wysyłka) jest zrealizowany i rozbudowany.
