# 04. Apka (Next.js 16 na Vercelu)

Adres: **https://web-xi-nine-19.vercel.app** · kod: `web/` · deploy: automatycznie po pushu na `main` (Vercel, projekt research-page, region fra1).
Styl **Midnight Gold** (makiety: `design/makiety.html` wariant C, `design/makieta-v2.html`): prawie czarne tło, złota łuna u góry, ukośna faktura, liczby w złotym gradiencie, zielone/czerwone zmiany. Arek nie lubi grafitowych ciemnych motywów.
Next.js 16: middleware nazywa się `proxy.ts`; dokumentacja wersji w `web/node_modules/next/dist/docs/`.

## Zakładki i ekrany
| Ekran | Co pokazuje | Plik |
|---|---|---|
| 📊 **Dziś** (`/`) | nagłówek z nazwą raportu (np. „🌅 Przed sesją”) i datą w drugiej linijce; 🔔 dzwonek powiadomień; ostrzeżenia (źródło nie odpowiada / brak raportu z harmonogramu); kursy na żywo; **📌 Stan rynków** (zwinięty: same ikony, po stuknięciu całość); 🧠 podsumowanie dnia (zwijane do pół ekranu) z ✓ kontrolą liczb, linkami „Podsumowanie ze źródłami”, „💡 Jak wyszły wcześniejsze pomysły?” i „💬 Zapytaj o to podsumowanie”; karty tematów | `web/src/app/(app)/page.tsx` |
| 🔎 **Rynki** (`/rynki`) | przełącznik Przegląd / Spółki / Makro / Kalendarz (wszystkie 4 widoki od razu w przeglądarce — przełączanie natychmiastowe) | `rynki/page.tsx`, `components/view-tabs.tsx`, `components/market-views.tsx` |
| Raport tematu (`/rynki/[temat]`) | pełny raport: komentarz AI z klikalnymi przypisami, ✓ kontrola, kursy z wykresami, CERT, źródła, „💬 Zapytaj o ten raport”, poprzednie raporty | `rynki/[kategoria]/page.tsx`, `components/report-view.tsx` |
| Strona spółki (`/spolki/[symbol]`) | wykres, roczny zakres, analiza techniczna „po ludzku” (RSI, średnie 50/200, od szczytu), rekomendacje analityków, newsy o spółce | `spolki/[symbol]/page.tsx` |
| 🛡️ **Scamy** (`/scamy`) | „Sprawdź link” (🔴 lista CERT / 🟡 podejrzana / 🟢 oficjalna / ⚪ brak na liście), porady, najnowsze ostrzeżenia | `scamy/*`, `lib/cert.ts` |
| 📁 **Archiwum** (`/archiwum`) | ostatnie 100 raportów po dniach + wyszukiwarka; pojedynczy raport `/archiwum/[id]` | `archiwum/*` |
| 💡 **Wyniki pomysłów** (`/pomysly`) | każdy pomysł z raportów: cena wtedy, zmiana do dziś, po 7 i po 30 dniach na tle WIG20 / S&P 500; bilans „trafione X z N” | `pomysly/page.tsx`, `lib/pomysly.ts`, `lib/pomysly-wyniki.ts` |
| Logowanie (`/login`) | e-mail + hasło (Supabase Auth, tylko konto Arka) | `app/login/*` |

## Najważniejsze mechanizmy
- **Kursy na żywo** (`lib/quotes.ts`, `/api/kursy`): przeglądarka co 20 s pobiera NBP/Yahoo przez apkę — **bez dotykania bazy**. Kafelki pokazują plakietkę sesji (🟢 trwa / ✅ zamknięcie / ⏳ wt. 06.10 / ✅ dzisiejszy). Gdy źródło nie odpowie, zostają kursy z raportu.
- **Nowy raport:** co minutę lekkie zapytanie `/api/najnowszy-raport` (sama data); gdy jest nowy — strona odświeża się sama.
- **Stan sesji** w apce: `lib/sesja.ts` (ta sama logika co w n8n).
- **Ostrzeżenie „brak raportu”:** `lib/harmonogram.ts` zna harmonogram (pn–pt 8:30/17:15/22:15, sob 10:00, niedz 18:00) i ostrzega tylko, gdy nie przyszedł raport, który powinien już być (30 min zapasu) — bez fałszywych alarmów w weekend.
- **Zapytania do bazy:** najnowsze raporty bez pełnego tekstu `content` i tylko z ostatniego uruchomienia (`lib/reports.ts`, `latestReports`) — mniej transferu.
- **Kontrola AI** pod komentarzem: `components/source-status.tsx` (`NumberCheck`): ✓ „X z Y liczb zgodne” albo ⚠️ lista (liczby i stan sesji).
- **PWA:** `app/manifest.ts`, ikony `public/icon-192.png`, `icon-512.png`, `app/apple-icon.png`; odstęp od paska z aparatem iPhone'a (`safe-area-inset-top` w `(app)/layout.tsx`); przycisk powrotu `components/back-link.tsx`.

## Powiadomienia push
- Włączanie: 🔔 w nagłówku Dziś → Włącz → „Wyślij test”. Każde urządzenie osobno. **iPhone: tylko w apce dodanej do ekranu początkowego i otwartej z ikony (iOS 16.4+).**
- `public/sw.js` (service worker, bez cache), `components/push-toggle.tsx`, `app/(app)/push-actions.ts` (zapis/usunięcie urządzenia, test), `lib/push.ts` (wysyłka, klucze VAPID), `app/api/push/wyslij/route.ts` (adres dla n8n, hasło `x-push-secret`).
- Urządzenia w tabeli `push_subscriptions` (RLS: każdy swoje). n8n czyta listę kluczem service_role i woła `/api/push/wyslij`.

## Czat AI (od 01.10)
- **Wygląd:** uchwyt **‹** przy prawej krawędzi (nad dolnym menu) → panel wysuwany z prawej (ok. 85% szerokości, **60% wysokości**, przy dole ekranu; podnosi się nad klawiaturę iPhone'a). Zamykanie: ✕, przesunięcie w prawo, stuknięcie obok, Esc. Gotowe pytania, „Nowa” rozmowa, stopka „AI może się mylić · informacja, nie porada inwestycyjna”.
- **Gdzie:** uchwyt na każdej stronie; „💬 Zapytaj o ten raport” pod każdym pełnym raportem (także w Archiwum — czat dostaje wtedy ten stary raport); „💬 Zapytaj o to podsumowanie” na Dziś.
- **Rozmowa:** AI pamięta wcześniejsze pytania; jedna rozmowa w całej apce, trwa do zamknięcia apki (`sessionStorage`); limit 30 pytań dziennie na urządzenie (`localStorage`).
- **Co wie:** najnowsze raporty ze wszystkich 9 tematów (komentarze z nazwami portali zamiast numerów przypisów, kalendarz, rekomendacje, CERT), kursy na żywo, stan rynków, pomysły z bilansem (trafione, średnia vs rynek, najlepszy/najsłabszy, ile dni danych). Nie zna starszych raportów (chyba że przez „Zapytaj o ten raport”).
- **Zasady dla AI** (`lib/czat-kontekst.ts`, funkcja `instrukcja`): liczby z danych, „(wiedza ogólna)” przy definicjach, szanuje stan sesji, portale przy newsach, prosto i krótko, bez formatowania; przy „czy kupić” zaczyna od „Nie doradzam kupna ani sprzedaży, ale oto, co mówią dane:”; przy pomysłach podaje bilans i uczciwie ocenia, czy okres wystarcza.
- **Technicznie:** `components/czat.tsx` (UI + stan), `app/api/czat/route.ts` (tylko po zalogowaniu; zbiera dane, wysyła do Gemini), `lib/czat-gemini.ts` (strumień SSE, zapasowe modele: 3.5-flash-lite → 3.1-flash-lite → 3.5-flash → 3-flash-preview, czytelne błędy 429/503/klucz). Klucz `GEMINI_CHAT_KEY` (osobny projekt AI Studio `research-czat`).
- Odpowiedzi w testach: 1,3–2,4 s.

## Mapa `web/src/lib`
`reports.ts` (typy danych raportu, zapytania), `quotes.ts` (kursy na żywo, lista `SPOLKI`), `sesja.ts`, `tech.ts` (RSI, średnie), `format.ts`, `harmonogram.ts`, `cert.ts`, `pomysly.ts` + `pomysly-wyniki.ts`, `push.ts`, `czat-kontekst.ts`, `czat-gemini.ts`, `supabase/server.ts` + `env.ts` (czyści wklejone wartości zmiennych).
