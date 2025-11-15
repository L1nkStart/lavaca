-- ============================================================================
-- Fix for RLS Infinite Recursion - LaVaca Database
-- This script fixes the infinite recursion issue in RLS policies
-- ============================================================================

-- First, drop all existing policies on users table
DROP POLICY IF EXISTS "Users can view their own data" ON users;
DROP POLICY IF EXISTS "Users can update their own data" ON users;
DROP POLICY IF EXISTS "Admins can view all users" ON users;
DROP POLICY IF EXISTS "Anyone can view public user profiles" ON users;

-- Create corrected policies for users table that avoid recursion
CREATE POLICY "users_select_own" ON users
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "users_insert_own" ON users
  FOR INSERT WITH CHECK (id = auth.uid());

CREATE POLICY "users_update_own" ON users
  FOR UPDATE USING (id = auth.uid());

CREATE POLICY "users_select_public" ON users
  FOR SELECT USING (true);

-- Fix campaigns policies to avoid recursion
DROP POLICY IF EXISTS "Anyone can view active campaigns" ON campaigns;
DROP POLICY IF EXISTS "Creators can view their own campaigns" ON campaigns;
DROP POLICY IF EXISTS "Creators can insert campaigns" ON campaigns;
DROP POLICY IF EXISTS "Creators can update their own campaigns" ON campaigns;

CREATE POLICY "campaigns_select_public" ON campaigns
  FOR SELECT USING (status = 'active' OR creator_id = auth.uid());

CREATE POLICY "campaigns_insert_verified_users" ON campaigns
  FOR INSERT WITH CHECK (
    creator_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND kyc_status = 'verified'
    )
  );

CREATE POLICY "campaigns_update_own" ON campaigns
  FOR UPDATE USING (creator_id = auth.uid());

-- Fix campaign_details policies
DROP POLICY IF EXISTS "Anyone can view campaign details for active campaigns" ON campaign_details;
DROP POLICY IF EXISTS "Creators can insert campaign details" ON campaign_details;

CREATE POLICY "campaign_details_select" ON campaign_details
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM campaigns 
      WHERE campaigns.id = campaign_details.campaign_id 
      AND (campaigns.status = 'active' OR campaigns.creator_id = auth.uid())
    )
  );

CREATE POLICY "campaign_details_insert_own" ON campaign_details
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM campaigns 
      WHERE campaigns.id = campaign_details.campaign_id 
      AND campaigns.creator_id = auth.uid()
    )
  );

-- Fix donations policies
DROP POLICY IF EXISTS "Anyone can create donations (anonymous)" ON donations;
DROP POLICY IF EXISTS "Donors can view their own donations" ON donations;  
DROP POLICY IF EXISTS "Creators can view donations to their campaigns" ON donations;
DROP POLICY IF EXISTS "Admins can view all donations" ON donations;

CREATE POLICY "donations_insert_all" ON donations
  FOR INSERT WITH CHECK (true);

CREATE POLICY "donations_select_own_or_public" ON donations
  FOR SELECT USING (
    donor_id = auth.uid() OR 
    is_anonymous = false OR
    campaign_id IN (SELECT id FROM campaigns WHERE creator_id = auth.uid())
  );

-- Fix withdrawal_accounts policies
DROP POLICY IF EXISTS "Creators can view their own accounts" ON withdrawal_accounts;
DROP POLICY IF EXISTS "Creators can insert their own accounts" ON withdrawal_accounts;
DROP POLICY IF EXISTS "Creators can update their own accounts" ON withdrawal_accounts;
DROP POLICY IF EXISTS "Admins can view all accounts" ON withdrawal_accounts;

CREATE POLICY "withdrawal_accounts_all_own" ON withdrawal_accounts
  FOR ALL USING (creator_id = auth.uid())
  WITH CHECK (creator_id = auth.uid());

-- Fix withdrawal_requests policies
DROP POLICY IF EXISTS "Creators can view their own requests" ON withdrawal_requests;
DROP POLICY IF EXISTS "Creators can insert requests" ON withdrawal_requests;
DROP POLICY IF EXISTS "Admins can view all requests" ON withdrawal_requests;
DROP POLICY IF EXISTS "Admins can update requests" ON withdrawal_requests;

CREATE POLICY "withdrawal_requests_select_own" ON withdrawal_requests
  FOR SELECT USING (creator_id = auth.uid());

CREATE POLICY "withdrawal_requests_insert_own" ON withdrawal_requests
  FOR INSERT WITH CHECK (creator_id = auth.uid());

-- Fix campaign_updates policies
DROP POLICY IF EXISTS "Anyone can view updates for active campaigns" ON campaign_updates;
DROP POLICY IF EXISTS "Creators can insert updates to their campaigns" ON campaign_updates;
DROP POLICY IF EXISTS "Creators can update their own updates" ON campaign_updates;

CREATE POLICY "campaign_updates_select_public" ON campaign_updates
  FOR SELECT USING (
    campaign_id IN (SELECT id FROM campaigns WHERE status = 'active')
  );

CREATE POLICY "campaign_updates_insert_own" ON campaign_updates
  FOR INSERT WITH CHECK (
    creator_id = auth.uid() AND
    campaign_id IN (SELECT id FROM campaigns WHERE creator_id = auth.uid())
  );

CREATE POLICY "campaign_updates_update_own" ON campaign_updates
  FOR UPDATE USING (creator_id = auth.uid());

-- Fix guarantors policies
DROP POLICY IF EXISTS "Guarantors can view their own data" ON guarantors;
DROP POLICY IF EXISTS "Admins can view all guarantors" ON guarantors;
DROP POLICY IF EXISTS "Users can become guarantors" ON guarantors;

CREATE POLICY "guarantors_all_own" ON guarantors
  FOR ALL USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Fix campaign_guarantors policies
DROP POLICY IF EXISTS "Anyone can view guarantor links for active campaigns" ON campaign_guarantors;

CREATE POLICY "campaign_guarantors_select_public" ON campaign_guarantors
  FOR SELECT USING (
    campaign_id IN (SELECT id FROM campaigns WHERE status = 'active')
  );

-- Keep these policies simple - no admin-specific policies for now to avoid recursion
-- Admin functionality can be handled at the application level

-- Fix categories (keep simple)
DROP POLICY IF EXISTS "Anyone can read categories" ON categories;
DROP POLICY IF EXISTS "Only admins can insert categories" ON categories;
DROP POLICY IF EXISTS "Only admins can update categories" ON categories;

CREATE POLICY "categories_select_all" ON categories FOR SELECT USING (true);

-- Fix admin_config and audit_logs - completely restrict these for now
DROP POLICY IF EXISTS "Only admins can read config" ON admin_config;
DROP POLICY IF EXISTS "Only admins can update config" ON admin_config;
DROP POLICY IF EXISTS "Only admins can view logs" ON audit_logs;
DROP POLICY IF EXISTS "Only admins can create logs" ON audit_logs;

-- Since we can't safely check admin role without recursion, 
-- these tables will be inaccessible via RLS and managed only by service role
-- This is actually more secure as configuration should only be managed by the application

-- Create a function to safely check if user is admin (using service role)
CREATE OR REPLACE FUNCTION is_admin(user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users 
    WHERE id = user_id AND role = 'admin'
  );
END;
$$;
