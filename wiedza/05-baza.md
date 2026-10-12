# 05. Baza danych (Supabase, projekt Arach-Research)

## Tabele
| Tabela | Co trzyma | Kto pisze | Kto czyta |
|---|---|---|---|
| `reports` | raporty: `category` (temat), `title`, `content` (pełny tekst — zapas/archiwum), `data` (jsonb: komentarz, instrumenty z `sesja`, newsy, kontrola, problemy, typRaportu, stanRynkow, pomysly, ceny, tydzien…) | n8n (service_role), 9 wierszy na uruchomienie | apka (zalogowany, tylko odczyt) |
| `push_subscriptions` | urządzenia z włączonymi powiadomieniami (endpoint, klucze przeglądarki, nazwa urządzenia) | apka (zalogowany, tylko swoje) | n8n (service_role) |

SQL (już uruchomione, ponowne uruchomienie niczego nie psuje): `supabase/schema.sql` (reports + RLS), `supabase/push.sql` (push_subscriptions + RLS), `supabase/cleanup.sql` (sprzątanie).

## Sprzątanie (pg_cron, zadanie `usun-stare-raporty`, codziennie 3:00 UTC)
- raporty tematów starsze niż **30 dni** — usuwane,
- podsumowania dnia (`dzien`) — trzymane **180 dni** (z nich apka liczy wyniki pomysłów po 7 i 30 dniach).
Uruchomione 28.09, wersja 30/180 dni od 30.09.

## Rozmiary i limity darmowego planu
- 1 uruchomienie ≈ 156 KB (9 wierszy; spółki ~45 KB, podsumowanie ~30 KB). Przy 17 raportach tygodniowo + sprzątaniu: baza ~kilkadziesiąt MB z limitu **500 MB**. Stan 30.09: 29 MB z 500 MB, transfer 0,05 GB z 5 GB.
- Transfer: kursy na żywo nie idą przez bazę; lista najnowszych raportów bez pełnego tekstu → kilkaset MB miesięcznie przy normalnym używaniu, limit **5 GB**.
- Darmowy plan: **2 aktywne projekty** naraz (wstrzymane się nie liczą) i **wstrzymanie projektu po ok. 7 dniach bez aktywności** — Arach-Research nie grozi, dopóki n8n zapisuje raporty; gdyby n8n stał tydzień, projekt może zostać wstrzymany (przywrócenie: panel Supabase → Restore).

## Inne projekty w Supabase (nie mylić)
- **Research Page** (eu-west-1) — utworzony przez pomyłkę 28.09, pusty, wstrzymany 30.09. Połączony z repo na GitHubie (integracja Supabase) — można usunąć.
- **Home-Budget** — osobny projekt Arka.
