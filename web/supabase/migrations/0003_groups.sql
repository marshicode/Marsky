-- ============================================================================
-- Marsky — groups: allow up to 8 members per list and tag each list with a
-- kind ('pair' | 'group'). Idempotent: safe to re-run. Apply via the Supabase
-- SQL editor or `supabase db push`.
-- ============================================================================

-- ---------- list kind ----------

-- 'pair' keeps legacy lists unchanged; new groups are tagged at creation.
alter table public.pairs
  add column if not exists kind text not null default 'pair';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'pairs_kind_check'
  ) then
    alter table public.pairs
      add constraint pairs_kind_check check (kind in ('pair', 'group'));
  end if;
end $$;

-- ---------- RLS: widen the join cap from 2 to 8 ----------

-- IMPORTANT (kept from 0002): pair_members.pair_code in the count subquery
-- refers to the NEW row being inserted (the WITH CHECK target). An
-- unqualified pair_code would resolve to pm.pair_code inside the subquery,
-- counting ALL pairs the caller can see instead of just the one being joined.
drop policy if exists "pm insert self" on public.pair_members;
create policy "pm insert self" on public.pair_members
  for insert with check (
    user_id = auth.uid() and
    (select count(*) from public.pair_members pm where pm.pair_code = pair_members.pair_code) < 8
  );

-- ---------- join RPC (atomic, 8-member cap, security definer) ----------

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
  if cnt >= 8 then
    return 'full';
  end if;
  insert into public.pair_members (pair_code, user_id)
  values (join_pair.pair_code, auth.uid())
  on conflict do nothing;
  return 'ok';
end $$;
