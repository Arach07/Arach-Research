# 07. Przeniesienie na inny komputer (dysk D → pendrive → nowy komputer)

## Co jest w chmurze i NIE wymaga przenoszenia
Apka (Vercel), baza (Supabase), kod (GitHub), klucze w Vercelu, klucze w AI Studio, powiadomienia na telefonie (urządzenie jest zapisane w bazie, wysyłka idzie przez Vercel) — działają niezależnie od komputera.
**Jedyne, co działa na komputerze, to n8n** (raporty o 8:30/17:15/22:15, sob 10:00, niedz 18:00). Projekt **nie używa Dockera** lokalnie.

## A. Co skopiować ze starego komputera
| Co | Skąd | Uwagi |
|---|---|---|
| **1. Folder projektu** | `C:\Users\arachowicz\Desktop\ResearchApp` | razem z ukrytym `.git`, plikiem `web\.env.local` (klucz czatu) i folderem `Agents\` (prywatne prompty, nie ma ich na GitHubie). Można pominąć `web\node_modules`, `web\.next`, `narzedzia\node_modules`, `narzedzia\dane` (odtwarzalne, duże) |
| **2. Folder n8n** | `C:\Users\arachowicz\.n8n` | **najważniejszy**: workflow, zaszyfrowane credentiale + klucz do nich (`config`), historia raportów, pamięć tygodnia (pomysły, statystyki). **Najpierw zatrzymaj n8n** (zamknij okno „n8n - raporty Research (nie zamykaj)”), dopiero potem kopiuj — inaczej baza może się skopiować niespójnie (plik `database.sqlite-wal`). Kopiuj cały folder z wszystkimi plikami |
| **3. Ustawienia Claude Code** | `C:\Users\arachowicz\.claude` | agenci (Jarvis, Friday, GSD), skille, ustawienia, pluginy, pamięć i zapis rozmów wszystkich projektów (`projects\`). **Bez** pliku `.credentials.json` (logowanie — na nowym komputerze zaloguj się od nowa). Niepotrzebne: `cache`, `sessions`, `session-env`, `shell-snapshots`, `ide` |
| **4. Pamięć innych projektów** | folder z eksportem (patrz `10-pamiec-claude.md`) | pamięć projektów, których folderów nie ma już na tym komputerze |

⚠️ Pendrive z folderami 2 i 3 zawiera dane wrażliwe (credentiale n8n, zapis rozmów ze starym kluczem Gemini) — trzymać prywatnie, nie wrzucać do chmury publicznej.
⚠️ Po skopiowaniu n8n może dalej działać na starym komputerze (uruchom `n8n/start-n8n.cmd`), aż nowy będzie gotowy — ale **nigdy na dwóch komputerach naraz** (podwójne raporty i powiadomienia).

## B. Nowy komputer — krok po kroku
1. **Programy:** Node.js LTS (min. 22.6, najlepiej 24), Git, VS Code + rozszerzenie Claude Code. Zaloguj się do Claude i do GitHuba (Git).
2. **Folder projektu:** wklej np. do `D:\Projekty\ResearchApp`. Sprawdzenie w terminalu w tym folderze: `git status` (bez błędów) i `git remote -v` (`Arach07/Arach-Research`).
   (Alternatywa: `git clone` z GitHuba — wtedy trzeba osobno skopiować `web\.env.local` i `Agents\`, których nie ma w repo.)
3. **Biblioteki:** w `web\`: `npm install`; w `narzedzia\`: `npm install`.
4. **Klucz czatu lokalnie:** sprawdź, czy jest `web\.env.local` z linijką `GEMINI_CHAT_KEY=…` (potrzebny tylko do testów czatu; apka na Vercelu ma własny).
5. **n8n — wariant A (zalecany, wszystko zostaje):**
   - skopiuj folder `.n8n` z pendrive'a do folderu użytkownika: `C:\Users\<nazwa>\.n8n` (= `%USERPROFILE%\.n8n`) **zanim** pierwszy raz uruchomisz n8n,
   - uruchom `n8n\start-n8n.cmd` (pobierze n8n przez `npx`; okno zostaw otwarte), wejdź na `http://localhost:5678`, zaloguj się kontem właściciela n8n (to samo co wcześniej),
   - sprawdź: workflow „Raport dzienny” jest opublikowany (Published), credentiale są (Gemini, Supabase account, Powiadomienia (hasło)), w Executions widać starą historię,
   - ID credentiali się nie zmieniają, więc `CREDENTIALE` w `n8n/build-workflow.mjs` pasują bez zmian.
6. **n8n — wariant B (świeży n8n, gdy folderu `.n8n` nie ma):**
   - uruchom `n8n\start-n8n.cmd`, załóż konto właściciela, aktywuj darmową licencję Community (klucz przychodzi mailem),
   - utwórz 3 credentiale: **Google Gemini(PaLM) Api account** (klucz z AI Studio, Default Gemini Project), **Supabase account** (Host `https://iknezuouboolldwoahzw.supabase.co`, klucz service_role), **Powiadomienia (hasło)** (typ Header Auth, Name `x-push-secret`, Value = nowe losowe hasło — wpisz je też w Vercelu jako `PUSH_SECRET` i zrób Redeploy, bo starej wartości nie da się odczytać),
   - odczytaj ID nowych credentiali (w adresie strony credentiala w n8n) i wpisz je do `CREDENTIALE` w `n8n/build-workflow.mjs` → `node n8n/build-workflow.mjs` → Import from File `n8n/raport-dzienny.json` → Ctrl+S → **Publish**,
   - historia i pamięć tygodnia zaczną się od zera (sobotnie podsumowanie pierwszego tygodnia będzie uboższe).
7. **Wyłącz n8n na starym komputerze** (zamknij jego okno), gdy nowy działa.
8. **Autostart (opcjonalnie):** Win+R → `shell:startup` → wklej skrót do `n8n\start-n8n.cmd`, żeby n8n startował z Windowsem.
9. **Sprawdzenie po pierwszym zaplanowanym raporcie:** `node narzedzia\uruchomienia.cjs` (w folderze projektu), w apce nowy raport, na telefonie powiadomienie.
10. **Claude Code:** otwórz folder projektu w VS Code. Plik `CLAUDE.md` Claude czyta sam; na start napisz np. „przeczytaj CLAUDE.md i wiedza/README.md, przeniosłem projekt na nowy komputer”.

## C. Pułapki
- **Komputer musi być włączony** o godzinach raportów (także w nocy o 22:15 i w weekend). Wyłączony = brak raportu; apka pokaże „Brak raportu z …”. Docelowe rozwiązanie: n8n na serwerze 24/7 (Oracle, `08-lista-na-pozniej.md`).
- **Supabase wstrzymuje projekt po ok. 7 dniach bez aktywności** — jeśli n8n nie będzie działał przez tydzień, przywróć projekt w panelu Supabase (Restore).
- **Inna nazwa użytkownika Windows** na nowym komputerze: folder n8n to `%USERPROFILE%\.n8n`; w `C:\Users\<nazwa>\.claude\settings.json` mogą być ścieżki ze starą nazwą (np. hooki) — trzeba je poprawić.
- **Wersja n8n:** `npx --yes n8n` pobiera najnowszą wersję; baza n8n zaktualizuje się sama (cofnięcie do starszej wersji nie jest możliwe). Po aktualizacji sprawdź jeden ręczny przebieg (Execute workflow) i `node narzedzia\uruchomienia.cjs`.
- **Claude Code — pamięć projektu** jest przypisana do ścieżki folderu; po zmianie ścieżki zaczyna się „od zera”, dlatego cała wiedza jest w `CLAUDE.md` i `wiedza/`.
