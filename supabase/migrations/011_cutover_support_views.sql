-- 011_cutover_support_views.sql
-- View requires legacy tables (clients, cost_estimates, invoices, projects).
-- On fresh bootstrap these don't exist yet — skip silently.
DO $$
BEGIN
  IF to_regclass('public.clients') IS NOT NULL
     AND to_regclass('public.cost_estimates') IS NOT NULL
     AND to_regclass('public.invoices') IS NOT NULL
     AND to_regclass('public.projects') IS NOT NULL
  THEN
    EXECUTE $sql$
      CREATE OR REPLACE VIEW company_health_view AS
      SELECT
        c.id AS company_id,
        c.name,
        c.plan,
        COUNT(DISTINCT cm.user_id) AS members_count,
        COUNT(DISTINCT cli.id)     AS clients_count,
        COUNT(DISTINCT ce.id)      AS estimates_count,
        COUNT(DISTINCT inv.id)     AS invoices_count,
        COUNT(DISTINCT pr.id)      AS projects_count
      FROM companies c
      LEFT JOIN company_members cm ON cm.company_id = c.id
      LEFT JOIN clients cli        ON cli.company_id = c.id
      LEFT JOIN cost_estimates ce  ON ce.company_id  = c.id
      LEFT JOIN invoices inv        ON inv.company_id  = c.id
      LEFT JOIN projects pr         ON pr.company_id   = c.id
      GROUP BY c.id, c.name, c.plan
    $sql$;
  END IF;
END
$$;
