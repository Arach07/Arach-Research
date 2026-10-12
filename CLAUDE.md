# Research — instrukcja dla Claude'a (czytana automatycznie na początku każdej rozmowy)

Prywatna aplikacja Arka (jedyny użytkownik): raporty rynkowe z n8n + Gemini, zapis do Supabase, apka Next.js na Vercelu (PWA na iPhonie).
**Pełna wiedza o projekcie jest w folderze `wiedza/`** — przy wznawianiu pracy zacznij od `wiedza/README.md` i `NOTATKA.md` (aktualny stan i lista na później).
Historia wszystkich decyzji: `wiedza/09-historia.md`. Projekt przenoszony między komputerami: `wiedza/07-przeniesienie.md`.

## Jak pracować z Arkiem
- Rozmowa **po polsku**, prosto, bez żargonu; trudne pojęcia wyjaśniaj („po ludzku”). Arek uczy się n8n i chce rozumieć, co się dzieje.
- **Krok po kroku**, gdy Arek ma coś kliknąć (Vercel, Supabase, n8n, AI Studio): numerowane kroki, dokładne nazwy przycisków; Arek wysyła screeny — oceniaj je dokładnie (zdarzyło się: klucz w złym polu „Note” zamiast „Value”, klucz w `.env.local.example` zamiast `.env.local`, zły projekt w Vercelu).
- **„Narazie piszemy / rozmawiamy”** = tylko rozmowa, NIE zmieniaj kodu. „Pokaż zanim zmienisz” = najpierw podgląd (np. próbne powiadomienie), potem wdrożenie.
- **Prostota wygrywa**: przy powiadomieniach „przekombinowaliśmy” — wrócono do prostej wersji. Proponuj rekomendację, nie listę 10 opcji.
- Apka jest od 30.09.2026 w **finalnej formie (kamień milowy)**; nowe funkcje tylko na wyraźną prośbę. Na pytanie „co robimy?” proponuj z listy na później (`NOTATKA.md` / `wiedza/08-lista-na-pozniej.md`), najpierw stabilność.
- Mów uczciwie, czego nie sprawdziłeś (np. wyglądu na telefonie, bo apka wymaga logowania Arka).

## Zasady bezpieczeństwa (twarde)
- **Kluczy nigdy na czat ani do repo.** Lokalny klucz czatu tylko w `web/.env.local` (ignorowany przez Git). Nigdy nie wpisuj kluczy do `.env.local.example` (jest w repo).
- Klucze: Vercel (zmienne „Secret”), n8n (credentiale, zaszyfrowane w `~/.n8n`). Opis bez wartości: `wiedza/02-konta-klucze.md`.
- Zapis rozmów Claude'a (`~/.claude/projects/.../*.jsonl`) zawiera stary klucz Gemini — nie wrzucać do repo ani nikomu nie wysyłać.
- Projekt **nie używa Dockera lokalnie** (n8n przez `npx`, baza w chmurze Supabase).

## Jak wprowadzać zmiany
- **n8n:** kod klocków jest w `n8n/src/*.js`, NIE edytuj `n8n/raport-dzienny.json` ręcznie. Po zmianie: `node n8n/build-workflow.mjs`, test lokalny (`narzedzia/`), commit + push, a Arek importuje w n8n: Ctrl+A → Delete → ⋯ → Import from File → `n8n/raport-dzienny.json` → Ctrl+S → **Publish** (bez Publish harmonogram dalej uruchamia starą wersję!). Credentiale podpinają się same dzięki `CREDENTIALE` w `build-workflow.mjs` (ID z bieżącej instancji n8n — po przeniesieniu n8n trzeba je zaktualizować, patrz `wiedza/07-przeniesienie.md`).
- **Apka (`web/`):** Next.js 16 — przed pisaniem kodu zajrzyj do `web/node_modules/next/dist/docs/` (zmiany względem starszych wersji, np. `proxy.ts` zamiast middleware). Sprawdzenie: `npx tsc --noEmit && npx eslint src && npx next build` w `web/`. Push na `main` = automatyczny deploy na Vercelu.
- **Testy przed wdrożeniem:** `narzedzia/README.md` (lokalny test klocków n8n, kontrola liczb na całej historii, audyt danych ze źródłami, test czatu na prawdziwym Gemini). Po zmianie kontroli liczb zawsze uruchom `node narzedzia/kontrola-historia.cjs` — liczba niezgodnych nie może rosnąć.
- Commity po polsku, krótki opis zmiany; na końcu `Co-Authored-By` zgodnie z przypomnieniem systemowym.
- Styl kodu: polskie nazwy zmiennych i komentarze (tak jak w całym projekcie), komentarze tłumaczą „dlaczego”.
- Po każdej istotnej zmianie zaktualizuj `NOTATKA.md` / odpowiedni plik w `wiedza/` i zrób commit.
