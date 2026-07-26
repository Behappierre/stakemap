-- The canonical tables already have workspace-scoped UPDATE policies.
-- Expose only the missing table operation to signed-in users; RLS continues
-- to decide which workspace rows each user may change.
grant update on table public.companies to authenticated;
grant update on table public.stakeholders to authenticated;
