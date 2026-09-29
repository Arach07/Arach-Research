-- Automatyczne sprzątanie: codziennie o 3:00 (czasu UTC, czyli 4:00/5:00 w Polsce)
-- usuwa raporty tematów starsze niż 30 dni, a podsumowania dnia starsze niż 180 dni
-- (z podsumowań apka liczy wyniki pomysłów po 7 i 30 dniach; 180 dni to ok. 14 MB).
-- Uruchom w Supabase → SQL Editor → Run (ponowne uruchomienie nadpisuje zadanie).

-- 1. Włącz wbudowany harmonogram zadań bazy (pg_cron)
create extension if not exists pg_cron;

-- 2. Zadanie (jeśli już istnieje, zostanie nadpisane)
select cron.schedule(
  'usun-stare-raporty',
  '0 3 * * *',
  $$ delete from public.reports
     where (category <> 'dzien' and created_at < now() - interval '30 days')
        or created_at < now() - interval '180 days' $$
);

-- Sprawdzenie, czy zadanie jest zapisane:
select jobid, jobname, schedule, command from cron.job;

-- Gdybyś chciał zmienić okres — zmień liczby dni i uruchom ponownie krok 2.
-- Gdybyś chciał wyłączyć sprzątanie:
--   select cron.unschedule('usun-stare-raporty');
