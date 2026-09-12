-- ============================================================================
-- Marsky — list deletion: allow a member to delete an entire list. The
-- items / history / pair_members rows are removed by ON DELETE CASCADE.
-- Idempotent: safe to re-run. Apply via the Supabase SQL editor or
-- `supabase db push`.
-- ============================================================================

drop policy if exists "pairs delete member" on public.pairs;
create policy "pairs delete member" on public.pairs
  for delete using (public.is_member(code));
