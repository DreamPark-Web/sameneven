-- ============================================================
-- GetClear: Member permission policies
-- Run this in the Supabase SQL editor (Dashboard > SQL Editor)
-- ============================================================

-- Helper: is the current user owner/admin of a given household?
CREATE OR REPLACE FUNCTION is_household_owner(hh_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM household_members
    WHERE household_id = hh_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
  )
$$;

-- Helper: is the current user any member of a given household?
CREATE OR REPLACE FUNCTION is_household_member(hh_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM household_members
    WHERE household_id = hh_id
      AND user_id = auth.uid()
  )
$$;

-- ============================================================
-- households table
-- ============================================================

-- Enable RLS (idempotent)
ALTER TABLE households ENABLE ROW LEVEL SECURITY;

-- All members can read their own households
DROP POLICY IF EXISTS "members_can_read_households" ON households;
CREATE POLICY "members_can_read_households"
  ON households FOR SELECT
  TO authenticated
  USING (is_household_member(id));

-- Only owners/admins can update household (name, invite_code, etc.)
DROP POLICY IF EXISTS "owners_can_update_households" ON households;
CREATE POLICY "owners_can_update_households"
  ON households FOR UPDATE
  TO authenticated
  USING (is_household_owner(id))
  WITH CHECK (is_household_owner(id));

-- Only owners/admins can delete the household
DROP POLICY IF EXISTS "owners_can_delete_households" ON households;
CREATE POLICY "owners_can_delete_households"
  ON households FOR DELETE
  TO authenticated
  USING (is_household_owner(id));

-- Any authenticated user can create a new household (for picker)
DROP POLICY IF EXISTS "users_can_insert_households" ON households;
CREATE POLICY "users_can_insert_households"
  ON households FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ============================================================
-- household_members table
-- ============================================================

ALTER TABLE household_members ENABLE ROW LEVEL SECURITY;

-- All members can read members of their household
DROP POLICY IF EXISTS "members_can_read_household_members" ON household_members;
CREATE POLICY "members_can_read_household_members"
  ON household_members FOR SELECT
  TO authenticated
  USING (is_household_member(household_id));

-- Any authenticated user can insert themselves (joining via invite)
DROP POLICY IF EXISTS "users_can_join_households" ON household_members;
CREATE POLICY "users_can_join_households"
  ON household_members FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Only owners/admins can update role or slot of any member
DROP POLICY IF EXISTS "owners_can_update_members" ON household_members;
CREATE POLICY "owners_can_update_members"
  ON household_members FOR UPDATE
  TO authenticated
  USING (is_household_owner(household_id))
  WITH CHECK (is_household_owner(household_id));

-- A member can delete their own row (leave), owners can delete anyone
DROP POLICY IF EXISTS "members_can_leave_owners_can_remove" ON household_members;
CREATE POLICY "members_can_leave_owners_can_remove"
  ON household_members FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR is_household_owner(household_id)
  );

-- ============================================================
-- household_data table
-- All members can read and write financial data.
-- Theme/name restrictions are enforced at the UI level.
-- ============================================================

ALTER TABLE household_data ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members_can_read_household_data" ON household_data;
CREATE POLICY "members_can_read_household_data"
  ON household_data FOR SELECT
  TO authenticated
  USING (is_household_member(household_id));

DROP POLICY IF EXISTS "members_can_write_household_data" ON household_data;
CREATE POLICY "members_can_write_household_data"
  ON household_data FOR INSERT
  TO authenticated
  WITH CHECK (is_household_member(household_id));

DROP POLICY IF EXISTS "members_can_update_household_data" ON household_data;
CREATE POLICY "members_can_update_household_data"
  ON household_data FOR UPDATE
  TO authenticated
  USING (is_household_member(household_id))
  WITH CHECK (is_household_member(household_id));
