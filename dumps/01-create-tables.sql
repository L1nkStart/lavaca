-- ============================================================================
-- LaVaca - Complete Database Schema with RLS (Row Level Security)
-- ============================================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================================================
-- 1. ENUM TYPES
-- ============================================================================

CREATE TYPE user_role AS ENUM ('donor', 'creator', 'guarantor', 'admin');
CREATE TYPE kyc_status AS ENUM ('pending', 'verified', 'rejected');
CREATE TYPE campaign_status AS ENUM ('draft', 'pending_review', 'active', 'closed', 'rejected');
CREATE TYPE payment_method AS ENUM ('card', 'paypal', 'pagomovil', 'zelle', 'transfer', 'crypto');
CREATE TYPE payment_status AS ENUM ('pending', 'approved', 'rejected', 'completed');
CREATE TYPE withdrawal_status AS ENUM ('pending', 'processed', 'failed');

-- ============================================================================
-- 2. AUTH & USERS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  full_name TEXT NOT NULL,
  avatar_url TEXT,
  bio TEXT,
  role user_role NOT NULL DEFAULT 'donor',
  kyc_status kyc_status NOT NULL DEFAULT 'pending',
  kyc_document_url TEXT,
  kyc_document_type TEXT, -- 'cedula' or 'rif'
  kyc_rejected_reason TEXT,
  location TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Enable RLS on users
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 3. CAMPAIGNS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  location TEXT,
  featured_image_url TEXT NOT NULL,
  goal_amount_usd DECIMAL(12, 2) NOT NULL,
  current_amount_usd DECIMAL(12, 2) NOT NULL DEFAULT 0,
  status campaign_status NOT NULL DEFAULT 'draft',
  rejected_reason TEXT,
  days_duration INTEGER NOT NULL DEFAULT 30,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  published_at TIMESTAMP WITH TIME ZONE,
  ended_at TIMESTAMP WITH TIME ZONE,
  is_featured BOOLEAN NOT NULL DEFAULT FALSE
);

-- Indexes for campaigns
CREATE INDEX IF NOT EXISTS idx_campaigns_creator_id ON campaigns(creator_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_category ON campaigns(category);
CREATE INDEX IF NOT EXISTS idx_campaigns_is_featured ON campaigns(is_featured);
CREATE INDEX IF NOT EXISTS idx_campaigns_created_at ON campaigns(created_at DESC);

-- Enable RLS on campaigns
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 4. CAMPAIGN DETAILS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS campaign_details (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID NOT NULL UNIQUE REFERENCES campaigns(id) ON DELETE CASCADE,
  full_story TEXT NOT NULL,
  gallery_images TEXT[] NOT NULL DEFAULT '{}',
  videos_urls TEXT[] NOT NULL DEFAULT '{}',
  support_documents_urls TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Enable RLS on campaign_details
ALTER TABLE campaign_details ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 5. CATEGORIES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  icon_emoji TEXT,
  order_index INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Insert default categories
INSERT INTO categories (name, description, icon_emoji, order_index) VALUES
  ('Salud', 'Campañas médicas y de salud', '🏥', 1),
  ('Educación', 'Becas y apoyo educativo', '📚', 2),
  ('Emprendimiento', 'Negocios y startups', '💼', 3),
  ('Comunitaria', 'Proyectos comunitarios', '🤝', 4),
  ('Vivienda', 'Apoyo de vivienda', '🏠', 5),
  ('Emergencias', 'Situaciones de emergencia', '🆘', 6)
ON CONFLICT (name) DO NOTHING;

-- Enable RLS on categories
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 6. GUARANTORS (VEEDORES) TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS guarantors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  organization_name TEXT,
  rif_number TEXT,
  profession_field TEXT,
  credential_document_url TEXT,
  kyc_status kyc_status NOT NULL DEFAULT 'pending',
  kyc_rejected_reason TEXT,
  biography TEXT,
  verification_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Enable RLS on guarantors
ALTER TABLE guarantors ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 7. CAMPAIGN GUARANTOR LINKS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS campaign_guarantors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  guarantor_id UUID NOT NULL REFERENCES guarantors(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, accepted, rejected
  accepted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(campaign_id, guarantor_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_campaign_guarantors_campaign_id ON campaign_guarantors(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_guarantors_guarantor_id ON campaign_guarantors(guarantor_id);

-- Enable RLS on campaign_guarantors
ALTER TABLE campaign_guarantors ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 8. DONATIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS donations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  donor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  amount_usd DECIMAL(10, 2) NOT NULL,
  amount_bs DECIMAL(15, 2),
  payment_method payment_method NOT NULL,
  payment_status payment_status NOT NULL DEFAULT 'pending',
  is_anonymous BOOLEAN NOT NULL DEFAULT FALSE,
  donor_name TEXT,
  stripe_payment_id TEXT,
  paypal_transaction_id TEXT,
  reference_number TEXT,
  crypto_transaction_hash TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  approved_at TIMESTAMP WITH TIME ZONE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_donations_campaign_id ON donations(campaign_id);
CREATE INDEX IF NOT EXISTS idx_donations_donor_id ON donations(donor_id);
CREATE INDEX IF NOT EXISTS idx_donations_payment_status ON donations(payment_status);
CREATE INDEX IF NOT EXISTS idx_donations_created_at ON donations(created_at DESC);

-- Enable RLS on donations
ALTER TABLE donations ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 9. WITHDRAWAL ACCOUNTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS withdrawal_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_type TEXT NOT NULL, -- 'bank_bs', 'pagomovil', 'zelle', 'paypal', 'crypto'
  account_holder_name TEXT NOT NULL,
  account_number TEXT,
  phone_number TEXT,
  ci_number TEXT,
  bank_code TEXT,
  zelle_email TEXT,
  paypal_email TEXT,
  crypto_wallet_address TEXT,
  crypto_network TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_withdrawal_accounts_creator_id ON withdrawal_accounts(creator_id);

-- Enable RLS on withdrawal_accounts
ALTER TABLE withdrawal_accounts ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 10. WITHDRAWAL REQUESTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS withdrawal_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  account_id UUID NOT NULL REFERENCES withdrawal_accounts(id),
  amount_usd DECIMAL(12, 2) NOT NULL,
  amount_bs DECIMAL(15, 2),
  status withdrawal_status NOT NULL DEFAULT 'pending',
  exchange_rate_used DECIMAL(10, 4),
  reference_number TEXT,
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_creator_id ON withdrawal_requests(creator_id);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_status ON withdrawal_requests(status);

-- Enable RLS on withdrawal_requests
ALTER TABLE withdrawal_requests ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 11. CAMPAIGN UPDATES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS campaign_updates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_campaign_updates_campaign_id ON campaign_updates(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_updates_created_at ON campaign_updates(created_at DESC);

-- Enable RLS on campaign_updates
ALTER TABLE campaign_updates ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 12. ADMIN CONFIGURATION TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS admin_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  platform_commission_percentage DECIMAL(5, 2) NOT NULL DEFAULT 5.0,
  bcv_exchange_rate DECIMAL(10, 4) NOT NULL DEFAULT 1,
  bcv_last_updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  auto_update_exchange_rate BOOLEAN NOT NULL DEFAULT FALSE,
  stripe_public_key TEXT,
  stripe_secret_key TEXT,
  paypal_client_id TEXT,
  zelle_email TEXT,
  zelle_phone TEXT,
  bank_account_bs TEXT,
  crypto_wallet_address TEXT,
  crypto_network TEXT,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Enable RLS on admin_config
ALTER TABLE admin_config ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 13. AUDIT LOG TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  target_table TEXT NOT NULL,
  target_id UUID,
  changes JSONB,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_admin_id ON audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- Enable RLS on audit_logs
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================================

-- Users Table RLS
ALTER TABLE users FORCE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own data" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own data" ON users
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admins can view all users" ON users
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Anyone can view public user profiles" ON users
  FOR SELECT USING (role != 'admin');

-- Campaigns Table RLS
ALTER TABLE campaigns FORCE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active campaigns" ON campaigns
  FOR SELECT USING (
    status = 'active' OR 
    (status = 'draft' AND creator_id = auth.uid()) OR
    (auth.uid() IN (SELECT id FROM users WHERE role = 'admin'))
  );

CREATE POLICY "Creators can view their own campaigns" ON campaigns
  FOR SELECT USING (creator_id = auth.uid() OR auth.uid() IN (SELECT id FROM users WHERE role = 'admin'));

CREATE POLICY "Creators can insert campaigns" ON campaigns
  FOR INSERT WITH CHECK (
    creator_id = auth.uid() AND
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND kyc_status = 'verified' AND role = 'creator')
  );

CREATE POLICY "Creators can update their own campaigns" ON campaigns
  FOR UPDATE USING (
    creator_id = auth.uid() OR auth.uid() IN (SELECT id FROM users WHERE role = 'admin')
  );

-- Campaign Details Table RLS
ALTER TABLE campaign_details FORCE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view campaign details for active campaigns" ON campaign_details
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM campaigns 
      WHERE campaigns.id = campaign_details.campaign_id 
      AND (campaigns.status = 'active' OR campaigns.creator_id = auth.uid())
    ) OR
    auth.uid() IN (SELECT id FROM users WHERE role = 'admin')
  );

CREATE POLICY "Creators can insert campaign details" ON campaign_details
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM campaigns 
      WHERE campaigns.id = campaign_details.campaign_id 
      AND campaigns.creator_id = auth.uid()
    )
  );

-- Donations Table RLS
ALTER TABLE donations FORCE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can create donations (anonymous)" ON donations
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Donors can view their own donations" ON donations
  FOR SELECT USING (donor_id = auth.uid() OR is_anonymous = FALSE);

CREATE POLICY "Creators can view donations to their campaigns" ON donations
  FOR SELECT USING (
    campaign_id IN (SELECT id FROM campaigns WHERE creator_id = auth.uid()) OR
    auth.uid() IN (SELECT id FROM users WHERE role = 'admin')
  );

CREATE POLICY "Admins can view all donations" ON donations
  FOR SELECT USING (auth.uid() IN (SELECT id FROM users WHERE role = 'admin'));

-- Withdrawal Accounts Table RLS
ALTER TABLE withdrawal_accounts FORCE ROW LEVEL SECURITY;

CREATE POLICY "Creators can view their own accounts" ON withdrawal_accounts
  FOR SELECT USING (creator_id = auth.uid());

CREATE POLICY "Creators can insert their own accounts" ON withdrawal_accounts
  FOR INSERT WITH CHECK (creator_id = auth.uid());

CREATE POLICY "Creators can update their own accounts" ON withdrawal_accounts
  FOR UPDATE USING (creator_id = auth.uid());

CREATE POLICY "Admins can view all accounts" ON withdrawal_accounts
  FOR SELECT USING (auth.uid() IN (SELECT id FROM users WHERE role = 'admin'));

-- Withdrawal Requests Table RLS
ALTER TABLE withdrawal_requests FORCE ROW LEVEL SECURITY;

CREATE POLICY "Creators can view their own requests" ON withdrawal_requests
  FOR SELECT USING (creator_id = auth.uid());

CREATE POLICY "Creators can insert requests" ON withdrawal_requests
  FOR INSERT WITH CHECK (creator_id = auth.uid());

CREATE POLICY "Admins can view all requests" ON withdrawal_requests
  FOR SELECT USING (auth.uid() IN (SELECT id FROM users WHERE role = 'admin'));

CREATE POLICY "Admins can update requests" ON withdrawal_requests
  FOR UPDATE USING (auth.uid() IN (SELECT id FROM users WHERE role = 'admin'));

-- Campaign Updates Table RLS
ALTER TABLE campaign_updates FORCE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view updates for active campaigns" ON campaign_updates
  FOR SELECT USING (
    campaign_id IN (SELECT id FROM campaigns WHERE status = 'active') OR
    auth.uid() IN (SELECT id FROM users WHERE role = 'admin')
  );

CREATE POLICY "Creators can insert updates to their campaigns" ON campaign_updates
  FOR INSERT WITH CHECK (
    creator_id = auth.uid() AND
    campaign_id IN (SELECT id FROM campaigns WHERE creator_id = auth.uid())
  );

CREATE POLICY "Creators can update their own updates" ON campaign_updates
  FOR UPDATE USING (creator_id = auth.uid());

-- Categories Table RLS (Public read, admin write)
ALTER TABLE categories FORCE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read categories" ON categories
  FOR SELECT USING (true);

CREATE POLICY "Only admins can insert categories" ON categories
  FOR INSERT WITH CHECK (auth.uid() IN (SELECT id FROM users WHERE role = 'admin'));

CREATE POLICY "Only admins can update categories" ON categories
  FOR UPDATE USING (auth.uid() IN (SELECT id FROM users WHERE role = 'admin'));

-- Guarantors Table RLS
ALTER TABLE guarantors FORCE ROW LEVEL SECURITY;

CREATE POLICY "Guarantors can view their own data" ON guarantors
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Admins can view all guarantors" ON guarantors
  FOR SELECT USING (auth.uid() IN (SELECT id FROM users WHERE role = 'admin'));

CREATE POLICY "Users can become guarantors" ON guarantors
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Campaign Guarantors Links RLS
ALTER TABLE campaign_guarantors FORCE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view guarantor links for active campaigns" ON campaign_guarantors
  FOR SELECT USING (
    campaign_id IN (SELECT id FROM campaigns WHERE status = 'active' AND status = 'active') OR
    auth.uid() IN (SELECT id FROM users WHERE role = 'admin')
  );

-- Admin Config Table RLS
ALTER TABLE admin_config FORCE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can read config" ON admin_config
  FOR SELECT USING (auth.uid() IN (SELECT id FROM users WHERE role = 'admin'));

CREATE POLICY "Only admins can update config" ON admin_config
  FOR UPDATE USING (auth.uid() IN (SELECT id FROM users WHERE role = 'admin'));

-- Audit Logs RLS
ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can view logs" ON audit_logs
  FOR SELECT USING (auth.uid() IN (SELECT id FROM users WHERE role = 'admin'));

CREATE POLICY "Only admins can create logs" ON audit_logs
  FOR INSERT WITH CHECK (auth.uid() IN (SELECT id FROM users WHERE role = 'admin'));

-- ============================================================================
-- TRIGGERS & FUNCTIONS
-- ============================================================================

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON campaigns FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_campaign_details_updated_at BEFORE UPDATE ON campaign_details FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_withdrawal_accounts_updated_at BEFORE UPDATE ON withdrawal_accounts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_campaign_updates_updated_at BEFORE UPDATE ON campaign_updates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_admin_config_updated_at BEFORE UPDATE ON admin_config FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-create guarantor profile when user_role is set to guarantor
CREATE OR REPLACE FUNCTION create_guarantor_profile()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role = 'guarantor' AND NOT EXISTS (SELECT 1 FROM guarantors WHERE user_id = NEW.id) THEN
    INSERT INTO guarantors (user_id, kyc_status) VALUES (NEW.id, 'pending');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_create_guarantor AFTER UPDATE ON users FOR EACH ROW EXECUTE FUNCTION create_guarantor_profile();

-- ============================================================================
-- INITIAL ADMIN CONFIG
-- ============================================================================

INSERT INTO admin_config (
  platform_commission_percentage,
  bcv_exchange_rate
) VALUES (5.0, 1.0)
ON CONFLICT DO NOTHING;
