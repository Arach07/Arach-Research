# Research — stan projektu

**Stan na: poniedziałek 12.10.2026** (przed przeniesieniem na inny komputer)
Pełna wiedza: **[`wiedza/README.md`](wiedza/README.md)** · Przeniesienie krok po kroku: **[`wiedza/07-przeniesienie.md`](wiedza/07-przeniesienie.md)** · Instrukcje dla Claude'a: [`CLAUDE.md`](CLAUDE.md)
(Poprzednia, długa wersja tej notatki jest w historii Gita; jej treść jest rozpisana i zaktualizowana w `wiedza/`.)

## Co działa
- **Raporty automatyczne** (n8n na komputerze): pn–pt 8:30 🌅 / 17:15 🇵🇱 / 22:15 🇺🇸, sobota 10:00 📆, niedziela 18:00 🔭. Wszystkie od 30.09 do 12.10 zakończone sukcesem.
- **Apka** https://web-xi-nine-19.vercel.app — Dziś, Rynki (Przegląd/Spółki/Makro/Kalendarz), strony spółek, Scamy, Archiwum, Wyniki pomysłów, **czat AI** (uchwyt ‹ z prawej), **powiadomienia** na iPhonie.
- **Wiarygodność:** dane z API, AI tylko komentuje; lista CERT przy każdym linku; kontrola liczb i stanu sesji (0 fałszywych alarmów na 52 raportach, łapie zgubione przecinki AI); ostrzeżenia, gdy źródło nie odpowiada albo raport nie przyszedł.

## Do zrobienia przy najbliższej okazji
1. **Zaimportować workflow w n8n** (zmiana z 12.10: kontrola rozumie liczby typu „32.299.946”): Ctrl+A → Delete → ⋯ → Import from File → `n8n/raport-dzienny.json` → Ctrl+S → **Publish**. Można zrobić już na nowym komputerze.
2. **Przeniesienie** na nowy komputer — `wiedza/07-przeniesienie.md` (najważniejsze: skopiować folder projektu **i** folder `C:\Users\arachowicz\.n8n` przy zatrzymanym n8n; nie uruchamiać n8n na dwóch komputerach naraz).

## Lista na później (skrót — całość w `wiedza/08-lista-na-pozniej.md`)
- **Stabilność:** n8n 24/7 na serwerze (Oracle), zapasowe źródła danych (Yahoo/Forex Factory są nieoficjalne), klucze powiadomień w menedżerze haseł.
- **Pomysły (07.10), kolejność:** 1. mój portfel → 2. alerty cenowe → 3. własna watchlista; dalej: dywidendy GPW, wyniki spółek vs oczekiwania, notatki przy pomysłach, „W 30 sekund”, czat z wiedzą z archiwum, spójność pomysłów, KNF, ustawienia.
- **Dom (nauka):** VPN („jestem w domu, robimy VPN”) i n8n na Oracle („jestem w domu, robimy Oracle”).
