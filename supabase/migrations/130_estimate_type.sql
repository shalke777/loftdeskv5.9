-- Add estimate_type column to cost_estimates
-- 'preliminary' (wstępna) → shows informational disclaimer on PDF
-- 'final'       (właściwa) → disclaimer hidden on PDF
ALTER TABLE cost_estimates
  ADD COLUMN IF NOT EXISTS estimate_type VARCHAR(20) NOT NULL DEFAULT 'preliminary'
    CHECK (estimate_type IN ('preliminary', 'final'));
