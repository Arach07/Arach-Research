# 08. Lista na później (backlog) — stan 12.10.2026

Na pytanie „co robimy?” Claude proponuje stąd, **najpierw stabilność**. Apka jest w finalnej formie od 30.09; nowe funkcje tylko na wyraźną decyzję Arka.

## 🛡️ Stabilność i bezpieczeństwo
1. **n8n 24/7 na serwerze** — dziś n8n działa na komputerze (wyłączony = brak raportów). Plan: Oracle Cloud Always Free (niżej, sekcja „Oracle”). Tymczasowo: autostart `start-n8n.cmd` (Win+R → `shell:startup` → skrót).
2. **Zapasowe źródła danych** — Yahoo Finance i Forex Factory to nieoficjalne źródła; już padły: CoinGecko (29.09, 403), RSS Yahoo (07.10, 404), chwilowo RSS Business Insider (12.10). Przygotować zamienniki, zanim padnie coś ważniejszego (kursy Yahoo, kalendarz).
3. **Klucze do powiadomień** — plik z kluczami VAPID/PUSH_SECRET był tylko w katalogu tymczasowym i zniknął; wartości są w Vercelu (nieodczytywalne „Secret”) i w n8n (credential). Działa, ale przy przenoszeniu n8n w wariancie „świeży n8n” trzeba wygenerować nowe `PUSH_SECRET` (instrukcja: `07-przeniesienie.md`). Ewentualnie: zapisać klucze w menedżerze haseł przy najbliższej wymianie.
4. **Stary klucz Gemini** (wklejony kiedyś na czat) — 07.10 na liście AI Studio był tylko jeden klucz raportów (…2KkA), więc najpewniej usunięty. Do potwierdzenia przy okazji.

## 👀 Do obserwacji
5. Wyniki pomysłów po 7 i 30 dniach (pierwsze 7-dniowe od ok. 05.10, 30-dniowe od ok. 28.10) — ocena, czy pomysły AI mają wartość. Uwaga: AI potrafi zmienić zdanie o tej samej spółce (np. Dino ↑ i ↓ 05.10, XTB ↓ 04.10 i ↑ 05.10).

## 💡 Pomysły — największa wartość dla inwestora (rozmowa 07.10, rekomendowana kolejność 1 → 2 → 3)
1. **Mój portfel** — pozycje (spółka, ile, po ile), wartość, zysk/strata dziś i od zakupu, udziały; AI pisze o MOICH spółkach, czat odpowiada „jak mi idzie?”.
2. **Alerty cenowe na telefon** — progi (np. WIG20 < 4000) i duże ruchy (np. Orlen > 3% w dzień); powiadomienia już działają.
3. **Własna watchlista** — wybór spółek zamiast stałych 20 (lista w Supabase, edytowana w apce, n8n czyta przy raporcie).
4. **Kalendarz dywidend GPW** — dzień ustalenia prawa, kwota, stopa; problem: wiarygodne darmowe źródło (Stooq blokuje).
5. **Wyniki spółek: oczekiwania vs rzeczywistość** — EPS prognoza (już z Nasdaq) vs faktyczny, reakcja kursu.
6. **Punkt odniesienia:** obligacje detaliczne (EDO, COI), lokaty; **podatki:** Belka, limity IKE/IKZE.
7. **Moje notatki przy pomysłach** — „obserwuję / kupiłem / pomijam” + notatka; moje decyzje obok wyników AI.
8. **„W 30 sekund”** — 3 zdania na górze Dziś (najważniejsze / co się zmieniło / na co uważać), w tym samym zapytaniu do AI.
9. **Ostatni raport bez internetu** — apka pamięta ostatni raport na telefonie.
10. **Spójność pomysłów** — wykrywać „AI zmieniło zdanie o …” albo kazać AI odnosić się do swoich wcześniejszych pomysłów.
11. **Czat z wiedzą z archiwum** — „co pisałeś o złocie w zeszłym tygodniu?” (wyszukanie raportów w bazie i dołożenie do pytania). Dziś: czat zna najnowsze raporty + jeden wskazany („Zapytaj o ten raport”).
12. **Historia wydarzeń z kalendarza** — minione wydarzenia z odczytami (prognoza vs wynik) i reakcją rynku. Dziś „Co przed nami” = tylko przyszłe (tak zostaje).
13. **Archiwum: „Pokaż starsze”** — dziś lista pokazuje ostatnie 100 wierszy, czyli ok. 11 uruchomień po 9 tematów (ok. 3–4 dni).
14. **Lista ostrzeżeń publicznych KNF** w Scamach i sprawdzaniu linków.
15. **Ekran Ustawienia** (godziny raportów, tematy, watchlista).
16. Model spoza Google na końcu łańcucha (**Groq** — darmowy, modele Llama; uwaga: Groq ≠ Grok/xAI) — 30.09: „mamy tyle modeli, na razie nie ma sensu”. Ewentualnie `gemini-3.8-flash` jako 6. model (decyzja otwarta).

## 🏠 Plany domowe (nauka, krok po kroku)
### VPN na domowym komputerze (Arek chce się tego NAUCZYĆ)
Cel: bezpieczny dostęp do domowego komputera i n8n z zewnątrz (praca, telefon).
- **Krok 0:** publiczne IP czy CGNAT? Zalogować się do routera (zwykle `192.168.1.1` / `192.168.0.1`), odczytać adres WAN i porównać z whatismyip.com. Takie same → **WireGuard** od podstaw (przekierowanie UDP 51820, DuckDNS przy zmiennym IP). Różne (router pokazuje `100.x` / `10.x`) → CGNAT → **Tailscale** (zbudowany na WireGuard, omija CGNAT).
- Nauka po kolei: IP/NAT/porty → klucze publiczne i prywatne → tunel → konfiguracja (peers, AllowedIPs) → router → test z telefonu na danych komórkowych.
- Przygotować: login do routera, telefon, ok. 1 godzinę. Hasło startowe: „jestem w domu, robimy VPN”.
### n8n na Oracle Cloud Always Free (24/7)
1. Konto: oracle.com/cloud/free, **Home Region: Germany Central (Frankfurt)** (nie da się zmienić), karta tylko do weryfikacji.
2. Maszyna: Ubuntu, ARM Ampere A1 (np. 2 rdzenie, 12 GB RAM); przy „out of capacity” ponawiać.
3. Porty 80/443: Security List w Oracle + zapora na maszynie (iptables).
4. Darmowa subdomena na duckdns.org (np. `arach-n8n.duckdns.org`) → IP serwera.
5. Claude przygotuje **docker-compose (n8n + Caddy z automatycznym HTTPS)** i skrypt instalacyjny (Docker działa TYLKO na serwerze).
6. Na serwerze: konto n8n, licencja, credentiale, import workflowu, **Publish** — albo przeniesienie całego `.n8n` (jak w `07-przeniesienie.md`, wariant A).
7. Wyłączyć n8n na komputerze (bez podwójnych raportów).
- Plan B: Mikrus (~75 zł/rok) albo Hetzner (~18 zł/mies.). Docelowo: Oracle + VPN (n8n widoczny tylko przez VPN).
- Hasło startowe: „jestem w domu, robimy Oracle”.
