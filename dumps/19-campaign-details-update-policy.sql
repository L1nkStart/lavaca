-- ============================================================================
-- Allow creators/admins to update campaign_details (including support documents)
-- ============================================================================

DROP POLICY IF EXISTS "Creators can update their own campaign details" ON campaign_details;

CREATE POLICY "Creators can update their own campaign details" ON campaign_details
  FOR UPDATE USING (
    EXISTS (
      SELECT 1
      FROM campaigns
      WHERE campaigns.id = campaign_details.campaign_id
        AND (
          campaigns.creator_id = auth.uid()
          OR auth.uid() IN (SELECT id FROM users WHERE role = 'admin')
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM campaigns
      WHERE campaigns.id = campaign_details.campaign_id
        AND (
          campaigns.creator_id = auth.uid()
          OR auth.uid() IN (SELECT id FROM users WHERE role = 'admin')
        )
    )
  );
