-- ============================================================================
-- Marsky — initial schema (ARCHITECTURE.md §4)
-- Apply in the Supabase SQL editor (or `supabase db push` with the CLI).
-- Requires: Auth "Allow anonymous sign-ins" enabled (Authentication > Providers).
-- ============================================================================

-- ---------- tables ----------

create table if not exists public.users (
  id uuid primary key,
  display_name text not null default 'Me',
  color text not null default '#F97316',
  created_at timestamptz not null default now()
);

create table if not exists public.pairs (
  code text primary key,
  name text not null,
  created_at timestamptz not null default now(),
  rev bigint not null default 1
);

create table if not exists public.pair_members (
  pair_code text not null references public.pairs(code) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (pair_code, user_id)
);

create table if not exists public.items (
  id uuid primary key,
  pair_code text not null references public.pairs(code) on delete cascade,
  text text not null,
  note text,
  created_by uuid not null references public.users(id),
  created_by_name text not null,
  created_at timestamptz not null default now(),
  due_at timestamptz,
  recurring text check (recurring in ('daily', 'weekly') or recurring is null),
  completed boolean not null default false,
  completed_by uuid references public.users(id),
  completed_at timestamptz,
  labels integer[] not null default '{}',
  pinned boolean not null default false,
  attachments jsonb not null default '[]'::jsonb,
  comments jsonb not null default '[]'::jsonb,
  checkin jsonb,
  reminded boolean not null default false,
  rev bigint not null default 1
);

create table if not exists public.history (
  id bigint generated always as identity primary key,
  pair_code text not null references public.pairs(code) on delete cascade,
  actor_id uuid,
  actor_name text not null,
  verb text not null,
  detail text not null,
  at timestamptz not null default now()
);

create index if not exists items_pair_idx on public.items (pair_code);
create index if not exists history_pair_idx on public.history (pair_code, at desc);

-- ---------- helper ----------

-- True when the current auth.uid() is a member of the pair.
create or replace function public.is_member(pair_code text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.pair_members pm
    where pm.pair_code = is_member.pair_code and pm.user_id = auth.uid()
  );
$$;

-- ---------- RLS ----------

alter table public.users enable row level security;
alter table public.pairs enable row level security;
alter table public.pair_members enable row level security;
alter table public.items enable row level security;
alter table public.history enable row level security;

-- users: you may read/update your own row; members of your pairs may read yours.
create policy "users select own" on public.users
  for select using (id = auth.uid());
create policy "users update own" on public.users
  for update using (id = auth.uid());
create policy "users insert own" on public.users
  for insert with check (id = auth.uid());
create policy "users select pair members" on public.users
  for select using (
    exists (
      select 1 from public.pair_members pm
      where pm.user_id = users.id and public.is_member(pm.pair_code)
    )
  );

-- pairs: only members see the pair.
create policy "pairs select member" on public.pairs
  for select using (public.is_member(code));
create policy "pairs insert" on public.pairs
  for insert with check (true);

-- pair_members: read own + pair's members; insert yourself while a seat is free.
create policy "pm select member" on public.pair_members
  for select using (user_id = auth.uid() or public.is_member(pair_code));
-- NOTE: the count subquery must qualify the NEW row as pair_members.pair_code
-- (the table name refers to the row being inserted). An unqualified pair_code
-- resolves to pm.pair_code (always-true join), which counts every membership
-- row visible to the caller across ALL pairs — so anyone in a 2-member pair
-- could never create or join again.
create policy "pm insert self" on public.pair_members
  for insert with check (
    user_id = auth.uid() and
    (select count(*) from public.pair_members pm where pm.pair_code = pair_members.pair_code) < 2
  );

-- items & history: members only, full CRUD (both members are equals).
create policy "items member all" on public.items
  for all using (public.is_member(pair_code)) with check (public.is_member(pair_code));
create policy "history member all" on public.history
  for all using (public.is_member(pair_code)) with check (public.is_member(pair_code));

-- ---------- join RPC (atomic, 2-member cap, security definer) ----------

create or replace function public.join_pair(pair_code text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare cnt int;
begin
  if not exists (select 1 from public.pairs p where p.code = join_pair.pair_code) then
    return 'not_found';
  end if;
  select count(*) into cnt
    from public.pair_members pm where pm.pair_code = join_pair.pair_code;
  if cnt >= 2 then
    return 'full';
  end if;
  insert into public.pair_members (pair_code, user_id)
  values (join_pair.pair_code, auth.uid())
  on conflict do nothing;
  return 'ok';
end $$;

-- ---------- realtime ----------
-- Tables MUST be in the supabase_realtime publication for postgres_changes
-- events to be emitted (Supabase Realtime requirement). Without this, cross-
-- device sync silently never fires.
alter publication supabase_realtime add table public.pairs;
alter publication supabase_realtime add table public.pair_members;
alter publication supabase_realtime add table public.items;
alter publication supabase_realtime add table public.history;

-- Full-row replica identity so jsonb updates (e.g. check-in responses) are
-- delivered with the complete row.
alter table public.items replica identity full;

-- ---------- reminders (optional production path) ----------
-- The Phase-1 web app fires reminders from the client with a guarded UPDATE
-- (only rows where reminded = false), so it works without infra. For the
-- production path in ARCHITECTURE.md §3, schedule this sweep with pg_cron:
--
--   select cron.schedule('marsky-reminders', '* * * * *', $$
--     update public.items
--     set reminded = true,
--         checkin = jsonb_build_object('fired_at', now(), 'responses', '{}'::jsonb)
--     where due_at <= now() and not completed and not reminded;
--   $$);
