-- Raporty generowane przez n8n (NBP, Gemini itd.)
create table if not exists public.reports (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  category    text not null default 'ogolny',   -- np. zloto, gpw, usa, krypto, scamy, ogolny
  title       text not null,
  content     text not null,                    -- treść raportu (tekst od AI)
  data        jsonb not null default '{}'::jsonb -- surowe dane, np. {"cena": 530.05, "data": "2026-09-28"}
);

create index if not exists reports_created_at_idx on public.reports (created_at desc);

-- Jawne uprawnienia (projekt ma wyłączone automatyczne wystawianie tabel):
-- zalogowany użytkownik tylko czyta, n8n (service_role) zapisuje.
revoke all on public.reports from anon, authenticated;
grant select on public.reports to authenticated;
grant select, insert, update, delete on public.reports to service_role;

-- RLS: apka (zalogowany użytkownik) tylko czyta.
-- n8n zapisuje kluczem secret/service_role, który omija RLS.
alter table public.reports enable row level security;

drop policy if exists "reports_select_authenticated" on public.reports;
create policy "reports_select_authenticated"
  on public.reports for select
  to authenticated
  using (true);
