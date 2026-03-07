-- LoftDesk v4.8 RLS smoke checklist
-- Run manually in staging after migrations 001-009

-- 1. owner sees own company estimates
-- set local role authenticated;
-- select auth.uid();
-- select * from public.cost_estimates limit 5;

-- 2. worker cannot delete estimates
-- delete from public.cost_estimates where id = '<estimate-id>';

-- 3. pending invitations visible only for same company
-- select * from public.company_invitations;

-- 4. accept invitation function
-- select public.accept_company_invitation('invite-token-here');
