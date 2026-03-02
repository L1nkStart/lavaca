-- ============================================
-- COMPLIANCE & UNDERWRITING HARDENING (2Checkout readiness)
-- ============================================

-- 1) Expand KYC enum to support submission lifecycle
ALTER TYPE kyc_status ADD VALUE IF NOT EXISTS 'submitted';

-- 2) Expand campaign status enum to support underwriting lifecycle
ALTER TYPE campaign_status ADD VALUE IF NOT EXISTS 'under_review';
ALTER TYPE campaign_status ADD VALUE IF NOT EXISTS 'suspended';
ALTER TYPE campaign_status ADD VALUE IF NOT EXISTS 'completed';

-- 3) Users: legal acceptance + normalized KYC document fields
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS terms_version_accepted TEXT,
  ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS kyc_doc_type TEXT,
  ADD COLUMN IF NOT EXISTS kyc_doc_url TEXT;

-- Backfill normalized KYC doc fields from legacy columns when present
UPDATE public.users
SET
  kyc_doc_type = COALESCE(kyc_doc_type, kyc_document_type),
  kyc_doc_url = COALESCE(kyc_doc_url, kyc_document_url)
WHERE kyc_doc_type IS NULL OR kyc_doc_url IS NULL;

-- Backfill legal acceptance for legacy users to preserve audit continuity
UPDATE public.users
SET
  terms_version_accepted = COALESCE(terms_version_accepted, 'v1.0-legacy'),
  terms_accepted_at = COALESCE(terms_accepted_at, created_at)
WHERE terms_version_accepted IS NULL OR terms_accepted_at IS NULL;

-- 4) Campaigns: underwriting metadata and risk scoring
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS risk_score INTEGER,
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS review_notes TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

ALTER TABLE public.campaigns
  DROP CONSTRAINT IF EXISTS campaigns_risk_score_check;

ALTER TABLE public.campaigns
  ADD CONSTRAINT campaigns_risk_score_check
  CHECK (risk_score IS NULL OR (risk_score >= 0 AND risk_score <= 100));

CREATE INDEX IF NOT EXISTS idx_campaigns_reviewed_by ON public.campaigns(reviewed_by);

-- Normalize legacy statuses to the underwriting model (safe text casts)
UPDATE public.campaigns
SET status = 'under_review'::campaign_status
WHERE status::text = 'pending_review';

UPDATE public.campaigns
SET status = 'suspended'::campaign_status
WHERE status::text IN ('paused', 'rejected');

UPDATE public.campaigns
SET status = 'completed'::campaign_status
WHERE status::text = 'closed';

-- 5) Guardrail: campaigns cannot move to active without review metadata
CREATE OR REPLACE FUNCTION public.enforce_campaign_underwriting()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status::text = 'active' THEN
    NEW.status = 'under_review'::campaign_status;
  END IF;

  IF TG_OP = 'UPDATE'
    AND OLD.status::text <> 'active'
    AND NEW.status::text = 'active'
    AND NEW.reviewed_by IS NULL THEN
    RAISE EXCEPTION 'Campaigns require reviewed_by before becoming active';
  END IF;

  IF NEW.reviewed_by IS NOT NULL AND NEW.reviewed_at IS NULL THEN
    NEW.reviewed_at = NOW();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_enforce_campaign_underwriting ON public.campaigns;
CREATE TRIGGER trigger_enforce_campaign_underwriting
BEFORE INSERT OR UPDATE ON public.campaigns
FOR EACH ROW
EXECUTE FUNCTION public.enforce_campaign_underwriting();
