# Research — baza wiedzy

Stan na **12.10.2026**. Wszystko, co wiadomo o projekcie: jak działa, gdzie co jest, dlaczego tak, jak testować, jak przenieść na inny komputer i co dalej.

## W 2 minuty
- **Co to jest:** prywatna apka (tylko dla Arka) z raportami rynkowymi: złoto, GPW, USA, 20 dużych spółek, makro, kalendarz, krypto, ostrzeżenia przed oszustwami, podsumowanie dnia/tygodnia. Na telefonie jako PWA (iPhone, ikona na ekranie głównym), z powiadomieniami i czatem AI.
- **Jak działa:** n8n (na komputerze, `npx n8n`) o stałych godzinach pobiera twarde dane (NBP, Yahoo Finance, Forex Factory, Nasdaq, CERT Polska) i newsy (RSS 14 portali + Google News) → jedno zapytanie do darmowego Gemini (łańcuch 5 modeli) → kontrola (lista CERT, kontrola liczb i stanu sesji) → zapis do Supabase → powiadomienie push na telefon. Apka na Vercelu czyta raporty z Supabase i dociąga kursy na żywo.
- **Harmonogram:** pn–pt 8:30 (Przed sesją), 17:15 (Po sesji GPW), 22:15 (Po sesji w USA); sobota 10:00 (Podsumowanie tygodnia); niedziela 18:00 (Przed tygodniem).
- **Adres apki:** https://web-xi-nine-19.vercel.app · **Repo:** github.com/Arach07/Arach-Research (prywatne, gałąź `main`).
- **Koszt:** 0 zł (darmowe plany: Vercel Hobby, Supabase Free, Gemini Free, n8n Community).
- **Stan:** kamień milowy 30.09.2026 (pełny przegląd kodu i danych), od tego czasu drobne poprawki + czat AI. Działa stabilnie: wszystkie automatyczne raporty od 30.09 do 12.10 zakończone sukcesem.

## Spis
| Plik | Co jest w środku |
|---|---|
| [01-architektura.md](01-architektura.md) | schemat całości, przepływ danych, kluczowe decyzje i dlaczego |
| [02-konta-klucze.md](02-konta-klucze.md) | konta (GitHub, Vercel, Supabase, AI Studio, n8n), gdzie jest każdy klucz (bez wartości), jak go odtworzyć |
| [03-n8n.md](03-n8n.md) | workflow „Raport dzienny”: klocki, harmonogram, modele, źródła, stan rynków, kontrola, pamięć tygodnia, powiadomienia, jak zmieniać |
| [04-apka.md](04-apka.md) | apka Next.js: zakładki, funkcje, mapa plików, kursy na żywo, pomysły, push, czat AI |
| [05-baza.md](05-baza.md) | Supabase: tabele, RLS, sprzątanie, limity darmowego planu |
| [06-testy.md](06-testy.md) | jak testujemy (narzędzia w `narzedzia/`), co sprawdzać po zmianach |
| [07-przeniesienie.md](07-przeniesienie.md) | **przeniesienie na inny komputer / pendrive** — co skopiować, jak uruchomić, pułapki |
| [08-lista-na-pozniej.md](08-lista-na-pozniej.md) | backlog: stabilność, pomysły, plany domowe (VPN, Oracle) |
| [09-historia.md](09-historia.md) | chronologia 28.09–12.10.2026: decyzje, awarie, poprawki |
| [10-pamiec-claude.md](10-pamiec-claude.md) | kopia pamięci Claude'a z tego projektu + preferencje Arka |

Dla Claude'a: instrukcje pracy są w [`../CLAUDE.md`](../CLAUDE.md) (czytany automatycznie).
