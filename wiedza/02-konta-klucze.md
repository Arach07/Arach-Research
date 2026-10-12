# 02. Konta, klucze i zmienne (BEZ wartości kluczy)

Wartości kluczy nie są nigdzie w repo ani w tej notatce. Tu jest tylko: gdzie leży każdy klucz i jak go odtworzyć, gdyby zginął.

## Konta (wszystkie darmowe)
| Usługa | Co tam jest | Uwagi |
|---|---|---|
| **GitHub** | repo `Arach07/Arach-Research` (prywatne), gałąź `main` | folder `Agents/` (prywatne prompty) jest w `.gitignore` |
| **Vercel** | projekt **research-page**, Root Directory `web`, region fra1, adres `web-xi-nine-19.vercel.app` | ⚠️ obok jest osobny projekt **Home-Budget** (zmienne `VITE_…`) — nie mylić |
| **Supabase** | organizacja i projekt **Arach-Research**, URL `https://iknezuouboolldwoahzw.supabase.co`, region eu-central-1 | ⚠️ jest też projekt **Research Page** (eu-west-1) — utworzony przez pomyłkę, pusty, **wstrzymany** (Pause) 30.09. Obok też Home-Budget. |
| **Google AI Studio** | projekt „Default Gemini Project” (klucz …2KkA — raporty n8n) i projekt **research-czat** (klucz czatu w apce) | konto Google z planem PRO, ale API używa osobnego darmowego limitu; bez podpiętej płatności |
| **n8n** | wersja 2.40.x, Community (darmowa licencja), lokalnie `http://localhost:5678` | konto właściciela n8n zakładane przy pierwszym uruchomieniu |

## Gdzie jest każdy klucz
| Klucz / zmienna | Gdzie jest | Do czego | Jak odtworzyć, gdy zginie |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Vercel (research-page), Production | adres bazy dla apki | `https://iknezuouboolldwoahzw.supabase.co` (**bez** `/rest/v1/` — był z tym problem) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Vercel | klucz publiczny (anon) bazy | Supabase → Connect / Project Settings → API |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Vercel | powiadomienia (jawny) | nowa para: `npx web-push generate-vapid-keys` w `web/` → oba klucze na nowo w Vercelu; telefony muszą ponownie włączyć powiadomienia (🔔) |
| `VAPID_PRIVATE_KEY` | Vercel (Secret) | podpis powiadomień | jw. |
| `PUSH_SECRET` | Vercel (Secret) **i** n8n (credential „Powiadomienia (hasło)”, Header Auth, Name `x-push-secret`) | hasło, którym n8n zleca apce wysłanie powiadomienia | dowolny losowy ciąg (np. 32 znaki) wpisany w OBU miejscach identycznie, potem Redeploy w Vercelu |
| `GEMINI_CHAT_KEY` | Vercel (Secret) + lokalnie `web/.env.local` (do testów, ignorowany przez Git) | czat AI w apce | AI Studio → projekt `research-czat` → nowy klucz |
| klucz Gemini raportów | n8n, credential **„Google Gemini(PaLM) Api account”** | raporty | AI Studio → Default Gemini Project |
| klucz `service_role` Supabase | n8n, credential **„Supabase account”** (Host = URL bazy bez `/rest/v1`) | zapis raportów, odczyt urządzeń | Supabase → Project Settings → API Keys → zakładka „Legacy anon, service_role API keys”. **Tylko w n8n** — nigdy w Vercelu ani na czacie |

**Credentiale n8n są zaszyfrowane** w `~/.n8n/database.sqlite` kluczem z pliku `~/.n8n/config` (`encryptionKey`). Przenosząc n8n, trzeba skopiować CAŁY folder `.n8n` (patrz `07-przeniesienie.md`), inaczej credentiale trzeba utworzyć od nowa.

## Bezpieczeństwo
- Supabase: rejestracja nowych użytkowników **wyłączona**, jest tylko konto Arka. RLS: zalogowany tylko czyta raporty; urządzenia do powiadomień — każdy tylko swoje; zapisuje n8n kluczem service_role.
- Apka: wszystkie strony i adresy API za logowaniem (`web/src/proxy.ts`), wyjątki: `sw.js`, ikony, manifest i `/api/push/wyslij` (chroniony hasłem `x-push-secret`, porównanie odporne na ataki czasowe).
- Stary klucz Gemini, wklejony kiedyś na czat: na liście kluczy w AI Studio (07.10) był już tylko jeden klucz raportów (…2KkA), więc stary najpewniej usunięty.
- Zapis rozmów z Claude (`~/.claude/projects/c--Users-arachowicz-Desktop-ResearchApp/*.jsonl`) zawiera stary klucz — nie publikować.
