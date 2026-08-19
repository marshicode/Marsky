-- ============================================================================
-- Marsky — corrective migration: re-apply all RLS policies and functions
-- safely with DROP IF EXISTS so it works whether the old version was applied
-- or not. Apply via the Supabase SQL editor or `supabase db push`.
-- ============================================================================

-- ---------- helper functions ----------

-- True when the current auth.uid() is a member of the pair.
-- SECURITY DEFINER so it can read pair_members even under RLS.
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

-- ---------- RLS: drop + recreate policies ----------

-- users
drop policy if exists "users select own" on public.users;
drop policy if exists "users update own" on public.users;
drop policy if exists "users insert own" on public.users;
drop policy if exists "users select pair members" on public.users;

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

-- pairs
drop policy if exists "pairs select member" on public.pairs;
drop policy if exists "pairs insert" on public.pairs;

create policy "pairs select member" on public.pairs
  for select using (public.is_member(code));
create policy "pairs insert" on public.pairs
  for insert with check (true);

-- pair_members
drop policy if exists "pm select member" on public.pair_members;
drop policy if exists "pm insert self" on public.pair_members;

create policy "pm select member" on public.pair_members
  for select using (user_id = auth.uid() or public.is_member(pair_code));
-- IMPORTANT: pair_members.pair_code in the count subquery refers to the NEW
-- row being inserted (the WITH CHECK target). An unqualified pair_code would
-- resolve to pm.pair_code inside the subquery, counting ALL pairs the caller
-- can see instead of just the pair being joined — breaking the 2-member cap.
create policy "pm insert self" on public.pair_members
  for insert with check (
    user_id = auth.uid() and
    (select count(*) from public.pair_members pm where pm.pair_code = pair_members.pair_code) < 2
  );

-- items
drop policy if exists "items member all" on public.items;

create policy "items member all" on public.items
  for all using (public.is_member(pair_code))
  with check (public.is_member(pair_code));

-- history
drop policy if exists "history member all" on public.history;

create policy "history member all" on public.history
  for all using (public.is_member(pair_code))
  with check (public.is_member(pair_code));

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

-- ---------- realtime publication ----------

-- Ensure all tables are in the supabase_realtime publication so
-- postgres_changes events fire for cross-device sync.
-- ALTER PUBLICATION ... ADD TABLE is idempotent in Supabase.
alter publication supabase_realtime add table public.pairs;
alter publication supabase_realtime add table public.pair_members;
alter publication supabase_realtime add table public.items;
alter publication supabase_realtime add table public.history;

-- Full-row replica identity so jsonb updates are delivered with the
-- complete row (needed for check-in responses, comments, etc.).
alter table public.items replica identity full;
