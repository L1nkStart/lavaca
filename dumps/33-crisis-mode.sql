-- ============================================
-- 33 - MODO CRISIS
-- ============================================
-- Metodo EXTRA (no reemplaza al actual): el donante paga DIRECTO a la cuenta
-- del creador y el creador confirma esos pagos para subir la barra.
-- Ver PLAN-MODO-CRISIS.md.

-- 1. Toggle global (interruptor maestro)
ALTER TABLE public.admin_config
  ADD COLUMN IF NOT EXISTS crisis_mode_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.admin_config.crisis_mode_enabled IS 'Interruptor maestro del modo crisis. OFF = oculto en toda la plataforma.';

-- 2. Tipo de campana
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS campaign_type text NOT NULL DEFAULT 'normal'
  CHECK (campaign_type IN ('normal', 'crisis'));

COMMENT ON COLUMN public.campaigns.campaign_type IS 'normal = flujo de plataforma; crisis = habilita pago directo al creador (metodo extra).';

-- 3. Cuentas de la campana para recibir directo
CREATE TABLE IF NOT EXISTS public.campaign_crisis_accounts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  account_type text NOT NULL CHECK (account_type IN ('pagomovil', 'zelle', 'transfer', 'crypto')),
  account_holder_name text NOT NULL,
  phone_number text,
  ci_number text,
  bank_name text,
  bank_code text,
  email text,
  account_number text,
  crypto_wallet_address text,
  crypto_network text,
  instructions text,
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crisis_accounts_campaign
  ON public.campaign_crisis_accounts (campaign_id, is_active, display_order);

COMMENT ON TABLE public.campaign_crisis_accounts IS 'Metodos de pago propios de una campana crisis donde el donante paga directo al creador.';

-- 4. Donaciones directas (reusa donations)
ALTER TABLE public.donations
  ADD COLUMN IF NOT EXISTS is_direct boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS crisis_account_id uuid REFERENCES public.campaign_crisis_accounts(id),
  ADD COLUMN IF NOT EXISTS confirmed_by uuid REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz;

COMMENT ON COLUMN public.donations.is_direct IS 'true = pago directo a la cuenta del creador (modo crisis). Sube la barra pero NO genera saldo retirable.';

CREATE INDEX IF NOT EXISTS idx_donations_direct_pending
  ON public.donations (campaign_id, payment_status)
  WHERE is_direct = true;

-- 5. RLS
ALTER TABLE public.campaign_crisis_accounts ENABLE ROW LEVEL SECURITY;

-- Lectura publica: el donante ve las cuentas en la campana (solo activas).
DROP POLICY IF EXISTS crisis_accounts_public_read ON public.campaign_crisis_accounts;
CREATE POLICY crisis_accounts_public_read
ON public.campaign_crisis_accounts
FOR SELECT
TO anon, authenticated
USING (is_active = true);

-- Gestion: el creador dueno de la campana + admin.
DROP POLICY IF EXISTS crisis_accounts_owner_manage ON public.campaign_crisis_accounts;
CREATE POLICY crisis_accounts_owner_manage
ON public.campaign_crisis_accounts
FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = campaign_id AND c.creator_id = (SELECT auth.uid()))
  OR (SELECT auth.uid()) IN (SELECT id FROM public.users WHERE role = 'admin')
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = campaign_id AND c.creator_id = (SELECT auth.uid()))
  OR (SELECT auth.uid()) IN (SELECT id FROM public.users WHERE role = 'admin')
);

DROP TRIGGER IF EXISTS trg_crisis_accounts_updated_at ON public.campaign_crisis_accounts;
CREATE TRIGGER trg_crisis_accounts_updated_at
BEFORE UPDATE ON public.campaign_crisis_accounts
FOR EACH ROW
EXECUTE FUNCTION public.set_payment_method_updated_at();

-- 6. RPC get_campaign_balances: excluir donaciones directas del saldo retirable.
CREATE OR REPLACE FUNCTION public.get_campaign_balances(p_campaign_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller uuid;
  v_creator uuid;
  v_is_admin boolean := false;

  v_donated_bs numeric := 0;
  v_donated_usd numeric := 0;
  v_donated_bs_usd_ref numeric := 0;

  v_withdrawn_bs numeric := 0;
  v_withdrawn_usd numeric := 0;
  v_pending_bs numeric := 0;
  v_pending_usd numeric := 0;
  v_has_pending_bs boolean := false;
  v_has_pending_usd boolean := false;

  v_fx_loss_realized numeric := 0;
  v_avg_entry_rate numeric := NULL;
  v_current_rate numeric := NULL;

  v_saldo_bs numeric := 0;
  v_saldo_usd numeric := 0;
  v_bs_indexed_usd numeric := 0;
  v_fx_loss_unrealized numeric := 0;

  v_last_bs_donation_at timestamptz;
  v_last_bs_withdrawal_at timestamptz;
BEGIN
  v_caller := auth.uid();

  SELECT creator_id INTO v_creator
  FROM public.campaigns
  WHERE id = p_campaign_id;

  IF v_creator IS NULL THEN
    RAISE EXCEPTION 'Campaign not found';
  END IF;

  IF v_caller IS NOT NULL THEN
    SELECT (role = 'admin') INTO v_is_admin
    FROM public.users
    WHERE id = v_caller;

    IF v_caller <> v_creator AND COALESCE(v_is_admin, false) = false THEN
      RAISE EXCEPTION 'Not authorized to read balances for this campaign';
    END IF;
  END IF;

  -- Donaciones completadas por moneda (EXCLUYE las directas de modo crisis).
  SELECT
    COALESCE(SUM(net_amount_bs) FILTER (WHERE currency = 'BS'), 0),
    COALESCE(SUM(net_amount_usd) FILTER (WHERE currency = 'USD'), 0),
    COALESCE(SUM(amount_usd) FILTER (WHERE currency = 'BS'), 0),
    MAX(COALESCE(completed_at, created_at)) FILTER (WHERE currency = 'BS')
  INTO v_donated_bs, v_donated_usd, v_donated_bs_usd_ref, v_last_bs_donation_at
  FROM public.donations
  WHERE campaign_id = p_campaign_id
    AND payment_status = 'completed'
    AND COALESCE(is_direct, false) = false;

  IF v_donated_bs_usd_ref > 0 THEN
    SELECT SUM(amount_bs) / NULLIF(SUM(amount_usd), 0)
    INTO v_avg_entry_rate
    FROM public.donations
    WHERE campaign_id = p_campaign_id
      AND payment_status = 'completed'
      AND COALESCE(is_direct, false) = false
      AND currency = 'BS'
      AND amount_bs IS NOT NULL
      AND amount_usd > 0;
  END IF;

  SELECT
    COALESCE(SUM(CASE WHEN currency = 'BS' THEN COALESCE(amount_bs, 0) ELSE 0 END) FILTER (WHERE status = 'processed'), 0),
    COALESCE(SUM(CASE WHEN currency = 'USD' THEN COALESCE(amount_usd, 0) ELSE 0 END) FILTER (WHERE status = 'processed'), 0),
    COALESCE(SUM(CASE WHEN currency = 'BS' THEN COALESCE(amount_bs, 0) ELSE 0 END) FILTER (WHERE status = 'pending'), 0),
    COALESCE(SUM(CASE WHEN currency = 'USD' THEN COALESCE(amount_usd, 0) ELSE 0 END) FILTER (WHERE status = 'pending'), 0),
    COALESCE(bool_or(currency = 'BS' AND status = 'pending'), false),
    COALESCE(bool_or(currency = 'USD' AND status = 'pending'), false),
    COALESCE(SUM(fx_loss_usd) FILTER (WHERE status = 'processed' AND currency = 'BS'), 0),
    MAX(processed_at) FILTER (WHERE status = 'processed' AND currency = 'BS')
  INTO v_withdrawn_bs, v_withdrawn_usd, v_pending_bs, v_pending_usd,
       v_has_pending_bs, v_has_pending_usd, v_fx_loss_realized, v_last_bs_withdrawal_at
  FROM public.withdrawal_requests
  WHERE campaign_id = p_campaign_id;

  v_saldo_bs := GREATEST(v_donated_bs - v_withdrawn_bs - v_pending_bs, 0);
  v_saldo_usd := GREATEST(v_donated_usd - v_withdrawn_usd - v_pending_usd, 0);

  SELECT rate INTO v_current_rate
  FROM public.exchange_rates
  WHERE is_active = true AND expires_at > now()
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_current_rate IS NULL THEN
    SELECT rate INTO v_current_rate FROM public.exchange_rates ORDER BY created_at DESC LIMIT 1;
  END IF;

  IF v_current_rate IS NULL THEN
    SELECT bcv_exchange_rate INTO v_current_rate FROM public.admin_config LIMIT 1;
  END IF;

  IF v_saldo_bs > 0 AND v_avg_entry_rate IS NOT NULL AND v_avg_entry_rate > 0
     AND v_current_rate IS NOT NULL AND v_current_rate > 0 THEN
    v_bs_indexed_usd := v_saldo_bs / v_avg_entry_rate;
    v_fx_loss_unrealized := (v_saldo_bs / v_avg_entry_rate) - (v_saldo_bs / v_current_rate);
  END IF;

  RETURN jsonb_build_object(
    'campaign_id', p_campaign_id,
    'saldo_bs', ROUND(v_saldo_bs, 2),
    'saldo_usd', ROUND(v_saldo_usd, 2),
    'donated_bs', ROUND(v_donated_bs, 2),
    'donated_usd', ROUND(v_donated_usd, 2),
    'withdrawn_bs', ROUND(v_withdrawn_bs, 2),
    'withdrawn_usd', ROUND(v_withdrawn_usd, 2),
    'pending_bs', ROUND(v_pending_bs, 2),
    'pending_usd', ROUND(v_pending_usd, 2),
    'has_pending_bs', v_has_pending_bs,
    'has_pending_usd', v_has_pending_usd,
    'avg_entry_rate', ROUND(COALESCE(v_avg_entry_rate, 0), 4),
    'current_rate', ROUND(COALESCE(v_current_rate, 0), 4),
    'bs_indexed_usd', ROUND(v_bs_indexed_usd, 2),
    'fx_loss_unrealized', ROUND(v_fx_loss_unrealized, 2),
    'fx_loss_realized', ROUND(v_fx_loss_realized, 2),
    'fx_loss_total', ROUND(v_fx_loss_unrealized + v_fx_loss_realized, 2),
    'last_bs_donation_at', v_last_bs_donation_at,
    'last_bs_withdrawal_at', v_last_bs_withdrawal_at
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_campaign_balances(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_campaign_balances(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_campaign_balances(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_campaign_balances(uuid) TO service_role;
