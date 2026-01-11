-- ============================================================================
-- LaVaca - Helper Functions and Views
-- ============================================================================

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to get campaign stats
CREATE OR REPLACE FUNCTION get_campaign_stats(campaign_id_param UUID)
RETURNS TABLE (
  total_raised_usd DECIMAL,
  total_donors INTEGER,
  donor_count_anonymous INTEGER,
  percentage_funded DECIMAL,
  days_remaining INTEGER,
  is_verified BOOLEAN,
  has_guarantor BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(d.amount_usd), 0),
    COUNT(DISTINCT CASE WHEN d.payment_status = 'approved' THEN d.id END)::INTEGER,
    COUNT(DISTINCT CASE WHEN d.payment_status = 'approved' AND d.is_anonymous THEN d.id END)::INTEGER,
    ROUND((COALESCE(SUM(CASE WHEN d.payment_status = 'approved' THEN d.amount_usd ELSE 0 END), 0) / c.goal_amount_usd * 100), 2),
    EXTRACT(DAY FROM c.ended_at - NOW())::INTEGER,
    (u.kyc_status = 'verified'),
    EXISTS (SELECT 1 FROM campaign_guarantors WHERE campaign_id = campaign_id_param AND status = 'accepted')
  FROM campaigns c
  LEFT JOIN donations d ON c.id = d.campaign_id
  LEFT JOIN users u ON c.creator_id = u.id
  WHERE c.id = campaign_id_param
  GROUP BY c.id, c.goal_amount_usd, u.kyc_status, c.ended_at;
END;
$$ LANGUAGE plpgsql;

-- Function to get creator balance
CREATE OR REPLACE FUNCTION get_creator_balance(creator_id_param UUID)
RETURNS TABLE (
  balance_usd DECIMAL,
  balance_bs DECIMAL,
  pending_usd DECIMAL,
  total_raised_usd DECIMAL
) AS $$
DECLARE
  config_record admin_config%ROWTYPE;
BEGIN
  SELECT * INTO config_record FROM admin_config LIMIT 1;
  
  RETURN QUERY
  WITH approved_donations AS (
    SELECT COALESCE(SUM(d.amount_usd), 0) as total
    FROM donations d
    JOIN campaigns c ON d.campaign_id = c.id
    WHERE c.creator_id = creator_id_param AND d.payment_status = 'approved'
  ),
  pending_donations AS (
    SELECT COALESCE(SUM(d.amount_usd), 0) as total
    FROM donations d
    JOIN campaigns c ON d.campaign_id = c.id
    WHERE c.creator_id = creator_id_param AND d.payment_status = 'pending'
  ),
  withdrawn AS (
    SELECT COALESCE(SUM(amount_usd), 0) as total
    FROM withdrawal_requests
    WHERE creator_id = creator_id_param AND status = 'processed'
  )
  SELECT
    (SELECT total FROM approved_donations) - (SELECT total FROM withdrawn),
    ((SELECT total FROM approved_donations) - (SELECT total FROM withdrawn)) * config_record.bcv_exchange_rate,
    (SELECT total FROM pending_donations),
    (SELECT total FROM approved_donations);
END;
$$ LANGUAGE plpgsql;

-- Function to calculate total commission for admin
CREATE OR REPLACE FUNCTION get_admin_commission()
RETURNS DECIMAL AS $$
DECLARE
  config_record admin_config%ROWTYPE;
BEGIN
  SELECT * INTO config_record FROM admin_config LIMIT 1;
  
  RETURN (
    SELECT COALESCE(SUM(d.amount_usd), 0) * (config_record.platform_commission_percentage / 100)
    FROM donations d
    WHERE d.payment_status = 'approved'
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- MATERIALIZED VIEWS
-- ============================================================================

-- View for campaign analytics (creator dashboard)
CREATE OR REPLACE VIEW campaign_analytics AS
SELECT
  c.id,
  c.title,
  c.creator_id,
  c.status,
  c.goal_amount_usd,
  COALESCE(SUM(CASE WHEN d.payment_status = 'approved' THEN d.amount_usd ELSE 0 END), 0) as raised_usd,
  COUNT(DISTINCT CASE WHEN d.payment_status = 'approved' THEN d.id END) as donor_count,
  COUNT(DISTINCT CASE WHEN d.payment_status = 'approved' AND d.is_anonymous THEN d.id END) as anonymous_count,
  COUNT(DISTINCT CASE WHEN d.payment_status = 'pending' THEN d.id END) as pending_donations,
  c.created_at,
  c.published_at
FROM campaigns c
LEFT JOIN donations d ON c.id = d.campaign_id
GROUP BY c.id, c.title, c.creator_id, c.status, c.goal_amount_usd, c.created_at, c.published_at;

-- View for admin dashboard
CREATE OR REPLACE VIEW admin_dashboard_stats AS
SELECT
  (SELECT COUNT(*) FROM users WHERE role = 'creator') as total_creators,
  (SELECT COUNT(*) FROM users WHERE role = 'creator' AND kyc_status = 'verified') as verified_creators,
  (SELECT COUNT(*) FROM campaigns WHERE status = 'active') as active_campaigns,
  (SELECT COUNT(*) FROM campaigns WHERE status = 'pending_review') as pending_campaigns,
  (SELECT COUNT(*) FROM donations WHERE payment_status = 'approved') as total_donations,
  (SELECT COALESCE(SUM(amount_usd), 0) FROM donations WHERE payment_status = 'approved') as total_raised,
  (SELECT COALESCE(SUM(amount_usd), 0) * (SELECT platform_commission_percentage FROM admin_config LIMIT 1) / 100 FROM donations WHERE payment_status = 'approved') as total_commission,
  (SELECT COUNT(*) FROM donations WHERE payment_status = 'pending') as pending_manual_payments;
