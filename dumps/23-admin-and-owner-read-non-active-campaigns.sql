-- ============================================================================
-- 22. ADMIN/OWNER READ ACCESS FOR NON-ACTIVE CAMPAIGNS
-- ============================================================================
-- Goal:
-- - Keep public access limited to active campaigns.
-- - Allow campaign owner to read own campaign-related data in any status.
-- - Allow admins to read campaign-related data in any status.

-- ----------------------------------------------------------------------------
-- CAMPAIGNS
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins can view all campaigns" ON campaigns;

CREATE POLICY "Admins can view all campaigns"
ON campaigns
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM users
    WHERE users.id = auth.uid()
      AND users.role = 'admin'
  )
);

-- ----------------------------------------------------------------------------
-- CAMPAIGN_DETAILS
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Owners and admins can view campaign details" ON campaign_details;

CREATE POLICY "Owners and admins can view campaign details"
ON campaign_details
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM campaigns
    WHERE campaigns.id = campaign_details.campaign_id
      AND (
        campaigns.creator_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM users
          WHERE users.id = auth.uid()
            AND users.role = 'admin'
        )
      )
  )
);

-- ----------------------------------------------------------------------------
-- CAMPAIGN_UPDATES
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Owners and admins can view campaign updates" ON campaign_updates;

CREATE POLICY "Owners and admins can view campaign updates"
ON campaign_updates
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM campaigns
    WHERE campaigns.id = campaign_updates.campaign_id
      AND (
        campaigns.creator_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM users
          WHERE users.id = auth.uid()
            AND users.role = 'admin'
        )
      )
  )
);

-- Optional verification query:
-- SELECT schemaname, tablename, policyname, cmd, qual
-- FROM pg_policies
-- WHERE tablename IN ('campaigns', 'campaign_details', 'campaign_updates')
-- ORDER BY tablename, policyname;