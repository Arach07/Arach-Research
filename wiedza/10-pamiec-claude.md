# 10. Pamięć Claude'a z tego projektu (kopia)

Claude Code trzyma „pamięć” projektu poza folderem projektu: `C:\Users\arachowicz\.claude\projects\c--Users-arachowicz-Desktop-ResearchApp\memory\`.
Ta pamięć jest przypisana do ŚCIEŻKI folderu — po przeniesieniu projektu (inny dysk/komputer) Claude zaczyna z pustą pamięcią.
Dlatego najważniejsze rzeczy są w `../CLAUDE.md` (czytany automatycznie) i w tym folderze `wiedza/`, a poniżej jest dosłowna kopia pamięci z 12.10.2026.
Uwaga: część wpisów jest historyczna (np. harmonogram 9/14/20, 8/13/18, CoinGecko) — aktualny stan opisują pliki 01–08.

## Preferencje Arka (zebrane z pracy nad projektem)
- Polski, prosty język; krok po kroku przy klikaniu w panelach; Arek wysyła screeny i chce, żeby je dokładnie sprawdzać.
- Chce **rozumieć** (nauka n8n, VPN, serwery) — tłumaczyć, a nie tylko robić.
- Ceni prostotę i rekomendację zamiast wielu opcji; potrafi powiedzieć „przekombinowaliśmy” — wtedy wracamy do prostszej wersji.
- „Narazie piszemy” = tylko rozmowa; „pokaż zanim zmienisz” = najpierw podgląd/próbka.
- Wszystko darmowe; bezpieczeństwo kluczy (żadnych kluczy na czacie).
- Lubi styl Midnight Gold; nie lubi grafitowych ciemnych motywów.
- Woli link do pliku niż kopiowanie do schowka; workflow importuje przez Import from File.


---

## Plik pamięci: `MEMORY.md`

```markdown
- [n8n stock news flow](n8n-stock-news-flow.md) — saved-for-later no-code n8n plan: schedule → RSS/news API → Claude/Gemini → Telegram/WhatsApp
- [Project status note](project-status-note.md) — READ NOTATKA.md in the repo first when resuming; it holds the full status and the TODO list
- [Home setup plan](home-setup-plan.md) — at home: n8n on Oracle Cloud Free (Docker+Caddy+DuckDNS) and learning to set up a VPN on the home PC
- [ResearchApp goal](research-app-goal.md) — user is learning n8n: market/gold/crypto digests + scam-site checker (PWA plan dropped)
```

---

## Plik pamięci: `research-app-goal.md`

```markdown
---
name: research-app-goal
description: "ResearchApp goal — user is learning n8n by building market-news digests (stocks, gold, trends, forecasts) plus a scam-site checker"
metadata:
  node_type: memory
  type: project
  originSessionId: 3bf128a6-5c94-4b63-b4b1-dad18ba86d10
  modified: 2026-09-28T15:00:11.564Z
---

History (2026-09-28): the idea started as a phone app (PWA + Supabase + Claude) for the user's friend. The friend now wants to build their own version, so the PWA plan was DROPPED.

Current goal: the user (Arek) wants to LEARN n8n. Plan is built on [[n8n-stock-news-flow]]. Scope:
- Stock market (GPW, US), gold prices, crypto, trends and forecasts gathered from various news portals.
- Scam checking: many scam investment sites exist, e.g. fake articles with celebrities and "guaranteed returns". Check them against lists like CERT Polska hole.cert.pl, KNF public warnings, Google Safe Browsing, VirusTotal and WHOIS domain age, plus an LLM red-flag analysis. The user does NOT want to paste links by hand: scam detection must be automatic. Plan: a daily scan of new CERT hole.cert.pl domains and new KNF warnings (diffed against the previous day), crt.sh certificate-transparency typosquat monitoring of brands (PKO, Orlen, etc.), Claude web search for scam reports, and running every news source link through the checker as an n8n sub-workflow. News research = trusted-portal RSS whitelist + Claude autonomous web search.

App (decided 2026-09-28): PWA on Vercel, for personal use only (single user, not in any store), usable from anywhere. Architecture: n8n on Oracle Always Free runs on a schedule at hours set in the app (settings table; n8n runs hourly and checks the hour) → Gemini → saves reports to Supabase → PWA reads them and gets Web Push. Auth: Supabase Auth with only the user's email, public sign-ups disabled, RLS on the tables. Budget: the user wants it FREE (asked 2026-09-28). The free stack: self-hosted n8n, the Gemini API free tier instead of the paid Claude API, and free data sources and delivery channels.

Progress (2026-09-28): n8n 2.40.7 runs locally via `npx n8n` at localhost:5678, with a free Community license key. Lesson 1 done: Manual Trigger → HTTP Request to the NBP gold API. Lesson 2 done: Google Gemini node "Message a model" with a free AI Studio key. Working model: `models/gemini-3.5-flash-lite`. `gemini-2.5-*` returns 404 for new users; 3-flash-preview and 3.5-flash kept returning 503 overloaded. Retry On Fail is enabled on the Gemini node. The user rejected mail/SMTP and went straight to the app. The app lives in `web/` (Next.js 16: proxy.ts instead of middleware, email+password login via Supabase, reports list). Schema is in `supabase/schema.sql` (reports table, RLS select for authenticated). n8n will insert rows with the Supabase secret key. DEPLOYED (2026-09-28): GitHub Arach07/Arach-Research (private, `Agents/` gitignored). Vercel project `research-page` with root dir `web`; env vars NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. Watch out: the user once pasted the URL with /rest/v1/. Supabase: org and project both named "Arach-Research". The user also has an unrelated Home-Budget project on both Vercel and Supabase, so don't mix them up. Login works. The n8n Supabase node "Create a row" works (first row id=1, 2026-09-28). Notes: the credential needs Host without /rest/v1 plus the legacy service_role key; the table list fails to load ("[object Object]"), so type `reports` via Expression, although the column list does load. Report v2 (2026-09-28): `n8n/src/*.js` + `node n8n/build-workflow.mjs` generate `n8n/raport-dzienny.json`, which the user pastes into n8n with Ctrl+V. Data sources: NBP (gold, USD) and CoinGecko are OK. Yahoo chart API is OK for US/gold, but WIG20.WA has no history (only the 1-day change). Stooq is BLOCKED (JS challenge). The CERT list is alphabetical with no dates. v3 switched to RSS feeds (bankier, money, parkiet, pb, BI, comparic, cnbc, marketwatch, yahoo, coindesk, cointelegraph, cert, sekurak) because Gemini's Google Search grounding returned 429 "exceeded quota" on the free tier. The Gemini node has onError=continueRegularOutput, so the report falls back to headlines only. The user prefers a file LINK over copying to the clipboard. UPDATE 2026-09-28: the 429s were the DAILY Gemini free quota, not the per-minute one. The workflow now makes ONE combined Gemini call (node "Jeden prompt", jsonOutput, a JSON map category→comment). The loop and pause were removed. Schedule is 9/14/20, because the quota resets around 9:00 PL. Don't go back to per-topic calls. As of 2026-09-28 the chain is 5 models (3.5-flash-lite, 3.5-flash, 3-flash-preview, 3.1-flash-lite, gemma-4-31b-it) with a 10 s pause between models and up to 3 rounds with 60 s pauses. The n8n execution history (read-only via sqlite at ~/.n8n/database.sqlite; helper script in the session scratchpad) showed all failures after 16:30 were 503 "Service unavailable", which looks like a Google-wide outage, not quota. LATER: add a non-Google free LLM at the end of the chain (Groq or OpenRouter; the user said "grok", so clarify that Groq ≠ Grok/xAI). App redesign (2026-09-28): chosen style "Midnight Gold" (mockup in design/makiety.html, variant C: near-black, gold glow at top, diagonal line texture, numbers in a gold gradient). The user dislikes plain graphite dark themes. 4 tabs: Dziś, Rynki (charts), Scamy (link checker against the CERT list), Archiwum. Structured data goes into the reports.data jsonb column. Later: news via, then news via the Gemini Google Search built-in tool.

ROADMAP (decided 2026-09-28): the user wants ALL of the following, but LATER. They explicitly said "don't make changes for now", so don't start unprompted. Details are in NOTATKA.md section 7: watchlist of own stocks (GPW+US, news per stock, edited in the app), events calendar (RPP/Fed/ECB, CPI, NFP, earnings, dividends), rates/bonds/FX/commodities/sentiment (NBP rate, US10Y, EUR/CHF/GBP, Brent, copper, silver, DAX/Nikkei, VIX, crypto Fear&Greed), push alerts, morning≠evening report, portfolio, weekly summary, KNF warning list.

**Why:** the user's goal is learning the tool, not just getting a result.
**How to apply:** teach step by step. Explain each n8n node instead of dumping a finished workflow, but offer importable workflow JSON as a reference.
```

---

## Plik pamięci: `project-status-note.md`

```markdown
---
name: project-status-note
description: "The user's detailed handoff note lives in the repo as NOTATKA.md; read it first when resuming ResearchApp work"
metadata:
  node_type: memory
  type: project
  originSessionId: 3bf128a6-5c94-4b63-b4b1-dad18ba86d10
  modified: 2026-09-30T13:43:16.903Z
---

On 2026-09-28 the user asked for a meticulous note on where the project stopped. It lives at `NOTATKA.md` in the repo root (Desktop\ResearchApp, committed to Arach07/Arach-Research). It covers the architecture, accounts, files, n8n workflow details, known limits, and the TODO list (work-PC n8n switch-over, VPN learning at home, Oracle move).

**Why:** the user wants to know exactly where they left off, in their own words-level detail.
**How to apply:** when resuming ("jestem w domu", "robimy VPN/Oracle", "na czym skończyliśmy"), read NOTATKA.md first and continue from section 6. When the user asks "co robimy?" / "co dalej?", propose items from the "📋 LISTA NA PÓŹNIEJ" block at the top of section 6 (since 2026-09-30 the app is feature-frozen at a milestone; stability items first). Update NOTATKA.md (and commit) whenever a TODO there gets done or the plan changes. Related: [[home-setup-plan]], [[research-app-goal]].
```

---

## Plik pamięci: `home-setup-plan.md`

```markdown
---
name: home-setup-plan
description: "To do at home (planned 2026-09-28): move n8n to Oracle Cloud Always Free, and learn to set up a VPN on the home PC"
metadata:
  node_type: memory
  type: project
  originSessionId: 3bf128a6-5c94-4b63-b4b1-dad18ba86d10
  modified: 2026-09-28T13:00:16.161Z
---

Two tasks the user will do AT HOME (the work PC is used during the day), both step by step, because the user wants to LEARN:

1. **n8n on Oracle Cloud Always Free** (24/7, editor reachable from anywhere):
   - Oracle account (oracle.com/cloud/free), Home Region Germany Central (Frankfurt). Region can't be changed later, and the card is only for verification.
   - Ubuntu VM: ARM Ampere A1 (e.g. 2 OCPU/12 GB). There can be "out of capacity" errors, so retry.
   - Open ports 80/443 (both the Security List and iptables on the VM).
   - Free subdomain on duckdns.org (e.g. arach-n8n.duckdns.org) pointing to the VM IP.
   - Claude prepares docker-compose (n8n + Caddy for automatic HTTPS) and an install script.
   - Then: owner account, free license key, credentials (Gemini, Supabase service_role), import `n8n/raport-dzienny.json`, Publish.
   - Plan B if Oracle doesn't work out: Mikrus (~75 zł/year) or Hetzner.
   - Meanwhile n8n runs on the WORK PC (on 24/7) via `n8n/start-n8n.cmd`. Schedule is 8/13/18. Company IT policy and keys on the work PC were flagged as caveats.

2. **VPN on the home PC**: DECIDED (2026-09-28). The goal is **remote access to the home PC and n8n** from work and from the phone. The user wants to LEARN how it works. Plan: first check at home whether the connection has a public IP or is behind CGNAT (compare the router's WAN IP with an IP-checker site), and whether they have admin access to the router. With a public IP: WireGuard on the home PC plus port forwarding UDP 51820 on the router, keys, and peers (phone, work laptop). The user needs dynamic DNS if the IP changes (DuckDNS). Behind CGNAT: Tailscale (works through NAT, built on WireGuard), explaining the difference. Teach concepts in order: IP/NAT/ports → public/private keys → tunnel → peers/AllowedIPs → tests.

**Why:** the user explicitly asked to remember both tasks for when they're at home.
**How to apply:** when the user says they're home or brings up Oracle/VPN, start from this plan. Teach step by step and don't do everything for them. Related: [[research-app-goal]], [[n8n-stock-news-flow]].
```

---

## Plik pamięci: `n8n-stock-news-flow.md`

```markdown
---
name: n8n-stock-news-flow
description: Saved-for-later plan for a no-code n8n workflow that sends daily AI stock-market news digests to Telegram/WhatsApp
metadata:
  node_type: memory
  type: project
  originSessionId: 3bf128a6-5c94-4b63-b4b1-dad18ba86d10
  modified: 2026-09-28T08:51:54.009Z
---

User (Arek) doesn't know n8n yet and asked (2026-09-28) to keep this plan for later. It's the no-code alternative to the phone app being built in ResearchApp [[research-app-goal]].

Flow in n8n (self-hosted free via Docker/npx, or n8n Cloud):
1. **Schedule Trigger** node: e.g. 8:00 and 17:00 on weekdays.
2. **News sources** (parallel nodes, then Merge):
   - RSS Read node: Bankier, Money.pl, Stooq, Reuters, Yahoo Finance.
   - HTTP Request node to news APIs with free tiers: Finnhub, Alpha Vantage (NEWS_SENTIMENT), NewsAPI.
   - Or skip sources and let the LLM search: Claude API web search tool / Gemini grounding with Google Search.
3. **LLM node** (Anthropic / Google Gemini node, or AI Agent node): prompt like "summarize the key news on tickers X, Y, Z and the market, ALWAYS include source links". Source links matter because LLMs garble numbers/dates.
4. **Send**:
   - Telegram node (recommended): bot via @BotFather, free, no verification; can also chat back with the bot.
   - WhatsApp: Business Cloud API (Meta) or Twilio. Needs a business account, verification and approved message templates for bot-initiated messages. Meta tightened AI-bot rules in 2026, so a personal digest is a grey area. Unofficial libs (whatsapp-web.js) risk a number ban.

**Why:** the user wants to learn n8n later and come back to this.
**How to apply:** when the user brings up n8n or automating news, start from this flow and walk them through it step by step, since they're new to n8n.
```
