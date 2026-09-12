-- ============================================================================
-- Marsky — sections: multiple named sub-lists inside ONE list code, so
-- everyone with the code sees every sub-list without joining again.
-- Idempotent: safe to re-run. Apply via the Supabase SQL editor or
-- `supabase db push`.
-- ============================================================================

-- Named sub-lists live on the pair; items point at one by name.
alter table public.pairs
  add column if not exists sections jsonb not null default '[]'::jsonb;

alter table public.items
  add column if not exists section text;
