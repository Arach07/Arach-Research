# 09. Historia projektu (28.09–12.10.2026)

Szczegóły każdej zmiany: `git log` (opisy commitów po polsku). Tu: przebieg, decyzje i lekcje.

## Skąd się wzięło
- Kolega chciał newsy giełdowe na WhatsAppie. Rozważone: n8n/Make/Zapier, gotowce (ChatGPT/Gemini), własny skrypt; WhatsApp trudny (Meta Business API), Telegram łatwy.
- Decyzja: **Arek uczy się n8n**; kolega robi swoją wersję sam. Plan PWA najpierw porzucony, potem wrócił jako prywatna apka Arka.
- Wymaganie: **wszystko darmowe** → n8n self-hosted + Gemini API (free) + Supabase + Vercel.
- Dalszy pomysł (zapisany na później): sprawdzanie oszustw automatycznie (CERT, KNF, monitorowanie podszywających się domen) — częściowo zrealizowane (lista CERT przy każdym linku, „Sprawdź link” w apce).

## 28.09 (poniedziałek) — od zera do działającej apki
1. n8n lokalnie (`npx n8n`, Community). Lekcja 1: NBP (cena złota). Lekcja 2: Gemini — `gemini-2.5-*` 404 dla nowych kont, `3-flash-preview`/`3.5-flash` przeciążone (503), działa `gemini-3.5-flash-lite`.
2. Mail (SMTP) odrzucony → apka: Next.js 16 + Supabase (logowanie tylko Arek, RLS) + Vercel (`research-page`). Problemy: pusty projekt Supabase (Research Page), pomylony projekt Home-Budget, URL z `/rest/v1/`.
3. n8n → Supabase (klucz service_role), lista tematów jednym klockiem zapisu.
4. AI napisało, że złoto jest „wysoko”, a spadało → **twarde dane z API** + weryfikacja linków na liście CERT.
5. Gemini z Google Search: 429 → **newsy z RSS** zaufanych portali; raport powstaje nawet bez AI.
6. Styl **Midnight Gold**, 4 zakładki (Dziś, Rynki, Scamy, Archiwum).
7. Błędy 429 to **dzienny** limit → **jedno zapytanie na raport**; łańcuch 3, potem **5 modeli** (z Gemmą), do **3 rund**; po 16:30 wszystkie modele 503 (awaria Google) → pauza 10 s między modelami.
8. Kursy na żywo co 20 s bez zużywania limitu bazy, automatyczne wczytywanie nowego raportu, sprzątanie po 30 dniach, harmonogram 9/14/20 (limit Gemini odnawia się ok. 9:00).
9. Plan rozbudowy na później i plany domowe (VPN, Oracle).

## 29.09 (wtorek) — rozbudowa
- 20 dużych spółek (USA + GPW), rozbudowane podsumowanie dnia z **pomysłami do rozważenia**.
- WIG20/WIG: brak historii dziennej w Yahoo → zamknięcia z danych godzinowych.
- Analiza techniczna (RSI, średnie 50/200), makro (stopy, obligacje, waluty, surowce, VIX, Fear & Greed, DAX), kalendarz (Forex Factory + Nasdaq), rekomendacje analityków, „od ostatniego raportu”.
- Rynki z widokami Przegląd/Spółki/Makro/Kalendarz, strony spółek.
- **CoinGecko 403** (Bitcoin zniknął z Dziś) → krypto z Yahoo. Lekcja: n8n uruchamiał starą **opublikowaną** wersję — po imporcie zawsze **Publish**.
- **Wiarygodność:** stan źródeł (ostrzeżenie, gdy coś nie odpowiada), **kontrola liczb AI** (na historii złapała „ASML +329%”), **wyniki pomysłów** (`/pomysly`).

## 30.09 (środa) — powiadomienia, harmonogram pod rynki, kamień milowy
- Kontrola: odmiany „wzroście” (fałszywy alarm), sprzątanie 30/180 dni.
- **Powiadomienia push** (iPhone/Android/komputer): VAPID, tabela urządzeń, adres dla n8n z hasłem; dzwonek w nagłówku. Format po kilku próbach: **prosty** („przekombinowaliśmy”) — tytuł Au/Ag, kursy, pomysły.
- iPhone: odstęp od paska z aparatem, ładniejszy przycisk powrotu.
- ID credentiali w workflow (import podpina je sam; Header Auth wcześniej trzeba było wybierać ręcznie).
- **Raporty pod godziny rynków:** pn–pt 8:30/17:15/22:15, sobota (podsumowanie tygodnia), niedziela (przed tygodniem); **stan rynków** z danych (trwa / zamknięta / z poprzedniej sesji); „Raport dodatkowy” poza harmonogramem; Stan rynków zwijany na Dziś.
- Kontrola **stanu sesji** (AI napisało „WIG20 zakończył sesję” w trakcie sesji), porządek w przypisach.
- **Przegląd A–Z (kamień milowy):** dane zgodne ze źródłami; poprawione m.in.: raport ginął, gdy lista CERT nie odpowiadała; fałszywe „brak raportu” w weekend; minione wydarzenia w „Co przed nami”; transfer o połowę mniejszy.
- Supabase: wstrzymany przypadkowy projekt Research Page; Arach-Research potwierdzony jako właściwy.

## 01.10 (czwartek) — czat AI
- **Czat AI** w apce: uchwyt ‹ z prawej, panel z prawej (60% wysokości), „Zapytaj o ten raport/podsumowanie”, rozmowa z pamięcią, osobny klucz Gemini (projekt `research-czat`), limit 30/dzień. Test na prawdziwym Gemini: odpowiedzi 1,3–2,4 s, liczby zgodne z danymi.
- Lekcja bezpieczeństwa: klucz trafił najpierw do `.env.local.example` (który jest w repo) — przeniesiony do `.env.local` przed commitem.
- Czat dostał bilans pomysłów (trafione, średnia vs rynek, najlepszy/najsłabszy) i zasadę uczciwej oceny krótkiego okresu.

## 03–04.10 — pierwszy weekend
- Sobota i niedziela zadziałały: stan rynków „ostatnia sesja pt.”, zmiany tygodniowe, bilans pomysłów 5 z 9, kontrola 741 liczb / 0 błędów; w niedzielę kalendarz już z nowym tygodniem (potwierdzone, że Forex Factory przełącza tydzień w niedzielę).

## 07.10 (środa) — poprawki
- **Yahoo usunęło ogólny RSS** (404) → kanał indeksów USA.
- Fałszywy alarm „506.592” (kropka jako separator tysięcy) → kontrola rozumie taki zapis.
- Sobota: pełniejsze „Wyniki pomysłów” i „Co dalej” (wyniki spółek w następnym tygodniu); weekend: „w piątek” zamiast „dzisiaj”.
- Rozmowa o rozwoju dla inwestorów → lista pomysłów w `08-lista-na-pozniej.md` (portfel, alerty, watchlista…).

## 12.10 (poniedziałek) — przeniesienie
- Wszystkie automatyczne raporty 01.10–12.10 zakończone sukcesem (w tym drugi weekend). Kontrola złapała kolejny prawdziwy błąd AI (piątek 22:15: „USD/PLN 39022 zł”).
- Kontrola rozumie też „32.299.946” (kilka grup tysięcy) — 0 fałszywych alarmów na 52 raportach.
- Arek usunął Dockera z komputera — **projekt nie używał Dockera**, nic nie stracone (n8n przez npx, baza w chmurze).
- Zapis całej wiedzy w repo (`CLAUDE.md`, `wiedza/`, `narzedzia/`) przed przeniesieniem wszystkich projektów na inny komputer (dysk D → pendrive).

## Zapis rozmów
Surowe zapisy rozmów z Claude (z obrazkami): `C:\Users\arachowicz\.claude\projects\c--Users-arachowicz-Desktop-ResearchApp\*.jsonl` (rozmowa 28–29.09: `3bf128a6-…`, rozmowa 29.09–12.10: `fb0fbc95-…`). Zawierają stary klucz Gemini — tylko prywatnie.
