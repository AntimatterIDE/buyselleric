-- BuySellEric buyer accounts, saved homes, Talk to Eric, and appointments.
-- Run this in the Supabase SQL Editor after the core schema.
-- In Authentication → Providers, keep Email enabled. For instant login after
-- signup, turn off "Confirm email" or buyers will have to verify first.

create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Profile (one row per auth user)
-- preferences jsonb: { maxPrice, minBeds, minBaths, areas[], mustHaves[] }
-- -----------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  email text not null default '',
  phone text not null default '',
  wishes text not null default '',
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_buyer()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_buyer on auth.users;
create trigger on_auth_user_created_buyer
  after insert on auth.users
  for each row execute function public.handle_new_buyer();

-- -----------------------------------------------------------------------------
-- Saved homes
-- -----------------------------------------------------------------------------
create table if not exists public.saved_homes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  source text not null check (source in ('mls', 'manual')),
  listing_key text not null,
  title text not null default '',
  path text not null default '',
  created_at timestamptz not null default now(),
  unique (user_id, source, listing_key)
);

create index if not exists saved_homes_user_idx on public.saved_homes (user_id, created_at desc);

-- -----------------------------------------------------------------------------
-- Talk to Eric
-- -----------------------------------------------------------------------------
create table if not exists public.eric_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists eric_conversations_set_updated_at on public.eric_conversations;
create trigger eric_conversations_set_updated_at
  before update on public.eric_conversations
  for each row execute function public.set_updated_at();

create table if not exists public.eric_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.eric_conversations (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null default '',
  tool_payload jsonb,
  created_at timestamptz not null default now()
);

create index if not exists eric_messages_conversation_idx
  on public.eric_messages (conversation_id, created_at);

-- -----------------------------------------------------------------------------
-- Appointments (requests until an admin confirms)
-- -----------------------------------------------------------------------------
create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null check (type in ('virtual_call', 'appointment', 'in_person_showing')),
  status text not null default 'requested'
    check (status in ('requested', 'confirmed', 'declined', 'cancelled', 'completed')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  listing_source text not null default '',
  listing_key text not null default '',
  listing_title text not null default '',
  listing_address text not null default '',
  listing_path text not null default '',
  notes text not null default '',
  google_event_id text,
  google_meet_url text,
  admin_note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists appointments_user_idx on public.appointments (user_id, starts_at desc);
create index if not exists appointments_starts_idx on public.appointments (starts_at);
create index if not exists appointments_status_idx on public.appointments (status, starts_at);

drop trigger if exists appointments_set_updated_at on public.appointments;
create trigger appointments_set_updated_at
  before update on public.appointments
  for each row execute function public.set_updated_at();

-- Weekly hours cartoon Eric may offer. weekday: 0 Sunday … 6 Saturday.
-- start_min / end_min are minutes from midnight in `timezone`.
create table if not exists public.agent_availability (
  id integer primary key default 1 check (id = 1),
  timezone text not null default 'America/New_York',
  windows jsonb not null default '[
    {"weekday":1,"startMin":540,"endMin":1020},
    {"weekday":2,"startMin":540,"endMin":1020},
    {"weekday":3,"startMin":540,"endMin":1020},
    {"weekday":4,"startMin":540,"endMin":1020},
    {"weekday":5,"startMin":540,"endMin":1020}
  ]'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.agent_availability (id)
values (1)
on conflict (id) do nothing;

-- Server-only. No policies for anon/authenticated. Service role only.
create table if not exists public.google_calendar_connection (
  id integer primary key default 1 check (id = 1),
  refresh_token text not null,
  calendar_id text not null default 'primary',
  email text not null default '',
  connected_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.saved_homes enable row level security;
alter table public.eric_conversations enable row level security;
alter table public.eric_messages enable row level security;
alter table public.appointments enable row level security;
alter table public.agent_availability enable row level security;
alter table public.google_calendar_connection enable row level security;

drop policy if exists "Buyers read own profile" on public.profiles;
create policy "Buyers read own profile"
  on public.profiles for select to authenticated
  using (auth.uid() = id);

drop policy if exists "Buyers insert own profile" on public.profiles;
create policy "Buyers insert own profile"
  on public.profiles for insert to authenticated
  with check (auth.uid() = id);

drop policy if exists "Buyers update own profile" on public.profiles;
create policy "Buyers update own profile"
  on public.profiles for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "Buyers read own saved homes" on public.saved_homes;
create policy "Buyers read own saved homes"
  on public.saved_homes for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Buyers insert own saved homes" on public.saved_homes;
create policy "Buyers insert own saved homes"
  on public.saved_homes for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Buyers delete own saved homes" on public.saved_homes;
create policy "Buyers delete own saved homes"
  on public.saved_homes for delete to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Buyers read own eric thread" on public.eric_conversations;
create policy "Buyers read own eric thread"
  on public.eric_conversations for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Buyers insert own eric thread" on public.eric_conversations;
create policy "Buyers insert own eric thread"
  on public.eric_conversations for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Buyers update own eric thread" on public.eric_conversations;
create policy "Buyers update own eric thread"
  on public.eric_conversations for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Buyers read own eric messages" on public.eric_messages;
create policy "Buyers read own eric messages"
  on public.eric_messages for select to authenticated
  using (
    exists (
      select 1 from public.eric_conversations c
      where c.id = conversation_id and c.user_id = auth.uid()
    )
  );

drop policy if exists "Buyers insert own eric messages" on public.eric_messages;
create policy "Buyers insert own eric messages"
  on public.eric_messages for insert to authenticated
  with check (
    exists (
      select 1 from public.eric_conversations c
      where c.id = conversation_id and c.user_id = auth.uid()
    )
  );

drop policy if exists "Buyers read own appointments" on public.appointments;
create policy "Buyers read own appointments"
  on public.appointments for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Buyers request own appointments" on public.appointments;
create policy "Buyers request own appointments"
  on public.appointments for insert to authenticated
  with check (auth.uid() = user_id and status = 'requested');

drop policy if exists "Buyers cancel own appointments" on public.appointments;
create policy "Buyers cancel own appointments"
  on public.appointments for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id and status = 'cancelled');

drop policy if exists "Buyers read office hours" on public.agent_availability;
create policy "Buyers read office hours"
  on public.agent_availability for select to authenticated
  using (true);

revoke all on public.google_calendar_connection from anon, authenticated;

grant select, insert, update on public.profiles to authenticated;
grant select, insert, delete on public.saved_homes to authenticated;
grant select, insert, update on public.eric_conversations to authenticated;
grant select, insert on public.eric_messages to authenticated;
grant select, insert, update on public.appointments to authenticated;
grant select on public.agent_availability to authenticated;

comment on table public.profiles is 'Buyer account profile and home wishes.';
comment on table public.saved_homes is 'Homes a buyer saved from search or Talk to Eric.';
comment on table public.appointments is 'Call and showing requests. Confirmed only from admin.';
