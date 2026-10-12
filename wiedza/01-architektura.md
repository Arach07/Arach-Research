# 01. Architektura i kluczowe decyzje

## Schemat
```
┌──────────────── n8n (komputer, http://localhost:5678, uruchamiany: n8n/start-n8n.cmd) ────────────────┐
│ Harmonogram (pn–pt 8:30 / 17:15 / 22:15, sob 10:00, niedz 18:00; strefa Europe/Warsaw)                  │
│   → Dane i tematy   : twarde dane (NBP, Yahoo, Forex Factory, Nasdaq, alternative.me, CERT)            │
│                       + newsy (RSS 14 portali, Google News per spółka) + stan rynków + typ raportu       │
│   → Jeden prompt    : wszystkie 9 tematów w JEDNYM zapytaniu do AI (oszczędza dzienny limit Gemini)    │
│   → Gemini 1…4, Gemma 5 (łańcuch; przy odmowie pauza 10 s i następny model; do 3 rund co 60 s)         │
│   → Weryfikacja źródeł : CERT (odrzuca linki z listy oszustw), kontrola liczb i stanu sesji,          │
│                          porządki w przypisach, pomysły, pamięć tygodnia                                │
│   → Zapis do apki (Supabase, tabela reports, 9 wierszy) → Treść powiadomienia → Urządzenia →          │
│     Wyślij powiadomienie (POST do apki /api/push/wyslij z hasłem)                                       │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────┘
                     │ zapis (klucz service_role)                     │ push
                     ▼                                                ▼
            Supabase (chmura, Frankfurt)                     Apka na Vercelu (Next.js 16, region fra1)
            tabele: reports, push_subscriptions  ◄── czyta ──  https://web-xi-nine-19.vercel.app
            sprzątanie pg_cron (30/180 dni)                     • kursy na żywo (Yahoo/NBP) co 20 s, bez bazy
                                                                • co minutę sprawdza, czy jest nowy raport
                                                                • czat AI (/api/czat → Gemini, osobny klucz)
                                                                • powiadomienia web push (VAPID) → iPhone
```

## Dlaczego tak (decyzje, które warto pamiętać)
| Decyzja | Powód |
|---|---|
| **Twarde dane z API, AI tylko komentuje** | 28.09 AI napisało, że złoto jest „wysoko”, a spadało. Liczby muszą pochodzić z API, AI je opisuje i cytuje źródła. |
| **RSS zamiast wyszukiwarki Google w Gemini** | Darmowy Gemini z Google Search zwracał 429 (limit); RSS jest darmowy, bez limitów i daje prawdziwe linki. |
| **Jedno zapytanie do AI na raport** | Błędy 429 to był DZIENNY limit darmowego Gemini; 6 zapytań × 3 raporty to za dużo. Teraz 1 zapytanie na raport. Nie wracać do zapytań per temat. |
| **Łańcuch 5 modeli + rundy** | Każdy model ma osobny limit; 28.09 wszystkie 5 modeli Google dawało 503 (przeciążenie) — pauzy i rundy pomagają. |
| **Raport powstaje nawet bez AI** | Klocki Gemini mają „continue on error”: zapisują się dane i nagłówki z dopiskiem „Komentarz AI niedostępny”. |
| **Lista CERT Polska przy każdym linku** | Projekt ma też funkcję ostrzegania przed oszustwami; żaden link z listy niebezpiecznych domen nie trafia do apki. |
| **Kontrola liczb AI** | AI gubi przecinki („ASML +329%” zamiast 3,29%, „USD/PLN 39022 zł”) — każda liczba z komentarza jest porównywana z danymi i newsami. |
| **Stan rynków z danych (Yahoo meta, data NBP)** | Godzin sesji nie wpisujemy na sztywno — święta, weekendy i zmiana czasu wychodzą same. AI dostaje wprost, czy sesja trwa, czy jest zamknięta, czy dane są z poprzedniego dnia. |
| **Godziny pod wydarzenia rynkowe** | Każdy raport opisuje coś zamkniętego: 8:30 pełna sesja USA z wczoraj, 17:15 pełny dzień GPW, 22:15 pełny dzień USA. |
| **Kursy na żywo w przeglądarce, nie z bazy** | `/api/kursy` pobiera Yahoo/NBP bez dotykania Supabase — nie zużywa limitu transferu bazy. |
| **Darmowy stos** | Wymaganie Arka: zero kosztów. |
| **Osobny klucz Gemini dla czatu** | Pytania w czacie nie zjadają limitu, z którego n8n robi raporty. |

## Gdzie co działa
| Element | Gdzie | Uwagi |
|---|---|---|
| n8n | komputer (dziś: komputer w pracy), `npx n8n`, dane w `~/.n8n` | wyłączony komputer = brak raportów (apka ostrzeże). Docelowo serwer 24/7 (Oracle) — `08-lista-na-pozniej.md` |
| Baza | Supabase, projekt **Arach-Research** (eu-central-1, Frankfurt) | |
| Apka | Vercel, projekt **research-page** (Root Directory `web`) | deploy automatyczny po pushu na `main` |
| Kod | GitHub `Arach07/Arach-Research` + lokalny folder projektu | |
| AI | Google AI Studio: projekt domyślny (klucz raportów n8n) + projekt `research-czat` (klucz czatu) | |
