-- ============================================================
-- GetClear: Balance tables
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- Add archived_at to balances (safe if already exists)
ALTER TABLE balances ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

-- ============================================================
-- balance_members: named members of a balance group
-- ============================================================
CREATE TABLE IF NOT EXISTS balance_members (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  balance_id   UUID NOT NULL REFERENCES balances(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  user_id      UUID REFERENCES auth.users(id),
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- balance_entries: individual expense records
-- ============================================================
CREATE TABLE IF NOT EXISTS balance_entries (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  balance_id  UUID NOT NULL REFERENCES balances(id) ON DELETE CASCADE,
  paid_by     UUID NOT NULL REFERENCES balance_members(id) ON DELETE CASCADE,
  amount      NUMERIC(10,2) NOT NULL,
  description TEXT DEFAULT '',
  receipt_url TEXT,
  via_scan    BOOLEAN DEFAULT FALSE,
  created_by  UUID REFERENCES auth.users(id),
  date        DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- balance_closings: archived period snapshots
-- ============================================================
CREATE TABLE IF NOT EXISTS balance_closings (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  balance_id       UUID NOT NULL REFERENCES balances(id) ON DELETE CASCADE,
  settlements      JSONB NOT NULL DEFAULT '[]',
  total_amount     NUMERIC(10,2),
  entries_snapshot JSONB,
  closed_at        TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- balance_approvals: per-member sign-off for closing flow
-- ============================================================
CREATE TABLE IF NOT EXISTS balance_approvals (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  balance_id UUID NOT NULL REFERENCES balances(id) ON DELETE CASCADE,
  member_id  UUID NOT NULL REFERENCES balance_members(id) ON DELETE CASCADE,
  approved_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(balance_id, member_id)
);

-- ============================================================
-- Helper function
-- ============================================================
CREATE OR REPLACE FUNCTION is_balance_owner(bal_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM balances
    WHERE id = bal_id AND user_id = auth.uid()
  )
$$;

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE balance_members  ENABLE ROW LEVEL SECURITY;
ALTER TABLE balance_entries  ENABLE ROW LEVEL SECURITY;
ALTER TABLE balance_closings ENABLE ROW LEVEL SECURITY;
ALTER TABLE balance_approvals ENABLE ROW LEVEL SECURITY;

-- balance_members
DROP POLICY IF EXISTS "bm_select" ON balance_members;
CREATE POLICY "bm_select" ON balance_members FOR SELECT TO authenticated
  USING (is_balance_owner(balance_id));

DROP POLICY IF EXISTS "bm_insert" ON balance_members;
CREATE POLICY "bm_insert" ON balance_members FOR INSERT TO authenticated
  WITH CHECK (is_balance_owner(balance_id));

DROP POLICY IF EXISTS "bm_delete" ON balance_members;
CREATE POLICY "bm_delete" ON balance_members FOR DELETE TO authenticated
  USING (is_balance_owner(balance_id));

-- balance_entries
DROP POLICY IF EXISTS "be_select" ON balance_entries;
CREATE POLICY "be_select" ON balance_entries FOR SELECT TO authenticated
  USING (is_balance_owner(balance_id));

DROP POLICY IF EXISTS "be_insert" ON balance_entries;
CREATE POLICY "be_insert" ON balance_entries FOR INSERT TO authenticated
  WITH CHECK (is_balance_owner(balance_id));

DROP POLICY IF EXISTS "be_update" ON balance_entries;
CREATE POLICY "be_update" ON balance_entries FOR UPDATE TO authenticated
  USING (is_balance_owner(balance_id));

DROP POLICY IF EXISTS "be_delete" ON balance_entries;
CREATE POLICY "be_delete" ON balance_entries FOR DELETE TO authenticated
  USING (is_balance_owner(balance_id));

-- balance_closings
DROP POLICY IF EXISTS "bc_all" ON balance_closings;
CREATE POLICY "bc_all" ON balance_closings FOR ALL TO authenticated
  USING (is_balance_owner(balance_id))
  WITH CHECK (is_balance_owner(balance_id));

-- balance_approvals
DROP POLICY IF EXISTS "ba_select" ON balance_approvals;
CREATE POLICY "ba_select" ON balance_approvals FOR SELECT TO authenticated
  USING (is_balance_owner(balance_id));

DROP POLICY IF EXISTS "ba_insert" ON balance_approvals;
CREATE POLICY "ba_insert" ON balance_approvals FOR INSERT TO authenticated
  WITH CHECK (is_balance_owner(balance_id));

DROP POLICY IF EXISTS "ba_delete" ON balance_approvals;
CREATE POLICY "ba_delete" ON balance_approvals FOR DELETE TO authenticated
  USING (is_balance_owner(balance_id));

-- ============================================================
-- Enable Realtime for live updates
-- Run these in Supabase Dashboard > Database > Replication,
-- or via SQL:
-- ============================================================
-- ALTER PUBLICATION supabase_realtime ADD TABLE balance_entries;
-- ALTER PUBLICATION supabase_realtime ADD TABLE balance_approvals;
-- ALTER PUBLICATION supabase_realtime ADD TABLE balance_members;
