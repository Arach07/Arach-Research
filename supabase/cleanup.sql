-- Automatyczne sprzątanie: codziennie o 3:00 (czasu UTC, czyli 4:00/5:00 w Polsce)
-- usuwa raporty starsze niż 30 dni. Uruchom RAZ w Supabase → SQL Editor → Run.

-- 1. Włącz wbudowany harmonogram zadań bazy (pg_cron)
create extension if not exists pg_cron;

-- 2. Zadanie (jeśli już istnieje, zostanie nadpisane tym samym)
select cron.schedule(
  'usun-stare-raporty',
  '0 3 * * *',
  $$ delete from public.reports where created_at < now() - interval '30 days' $$
);

-- Sprawdzenie, czy zadanie jest zapisane:
select jobid, jobname, schedule, command from cron.job;

-- Gdybyś chciał zmienić okres (np. na 90 dni) — uruchom ponownie krok 2 z inną liczbą.
-- Gdybyś chciał wyłączyć sprzątanie:
--   select cron.unschedule('usun-stare-raporty');
