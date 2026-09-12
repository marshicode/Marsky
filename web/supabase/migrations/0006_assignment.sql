-- ============================================================================
-- Marsky — task assignment: an item can name the member it's for, so group
-- lists (2–8 people) can answer "whose turn is it?". Stores the member's
-- auth uuid (same id space as items.created_by / pair_members.user_id).
-- Idempotent: safe to re-run. Apply via the Supabase SQL editor or
-- `supabase db push`.
-- ============================================================================

alter table public.items
  add column if not exists assignee text;
