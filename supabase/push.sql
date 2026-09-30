-- Powiadomienia push: urządzenia (telefon, komputer), które włączyły powiadomienia w apce.
-- Uruchom RAZ w Supabase → SQL Editor → Run (ponowne uruchomienie niczego nie psuje).

create table if not exists public.push_subscriptions (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint    text not null unique,   -- adres usługi push przeglądarki (Apple, Google, Mozilla)
  p256dh      text not null,          -- klucze szyfrowania z przeglądarki
  auth        text not null,
  urzadzenie  text                    -- np. "iPhone", "Android", "Komputer" — do podglądu
);

-- Apka (zalogowany użytkownik) zapisuje i usuwa tylko swoje urządzenia; n8n (service_role) czyta wszystkie.
revoke all on public.push_subscriptions from anon, authenticated;
grant select, insert, update, delete on public.push_subscriptions to authenticated;
grant select, insert, update, delete on public.push_subscriptions to service_role;

alter table public.push_subscriptions enable row level security;

drop policy if exists "push_own" on public.push_subscriptions;
create policy "push_own"
  on public.push_subscriptions for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Sprawdzenie:
select count(*) as urzadzenia from public.push_subscriptions;
