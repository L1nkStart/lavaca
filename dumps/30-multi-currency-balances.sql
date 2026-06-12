-- ============================================
-- 30 - SEPARACION DE SALDOS BS / USD
-- ============================================
-- Implementa el modelo multi-moneda descrito en PLAN-MULTIMONEDA.md:
--   * Donaciones clasificadas por moneda (BS: pagomovil/transfer/chinchin,
--     USD: card/paypal/zelle/crypto) con fee de pasarela y monto neto.
--   * Retiros clasificados por moneda segun el tipo de cuenta destino,
--     con desglose (comision plataforma + fee de pasarela + neto) y
--     perdida cambiaria congelada al procesar retiros en Bs.
--   * Tabla de fees de retiro configurable por el admin.
--   * RPC get_campaign_balances: saldos, reservas y perdida cambiaria
--     calculados on-the-fly (sin triggers duplicados que se desincronicen).
--
-- La barra de progreso publica (campaigns.current_amount_usd) NO cambia:
-- sigue alimentada por el trigger existente con el monto bruto indexado.

-- ============================================
-- 1. DONATIONS: moneda, fees y montos netos
-- ============================================

ALTER TABLE public.donations
  ADD COLUMN IF NOT EXISTS currency text CHECK (currency IN ('USD', 'BS')),
  ADD COLUMN IF NOT EXISTS gateway_fee_usd numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fee_covered_by_donor boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS net_amount_usd numeric,
  ADD COLUMN IF NOT EXISTS net_amount_bs numeric;

COMMENT ON COLUMN public.donations.currency IS 'Moneda real del dinero recibido: BS (pagomovil/transfer/chinchin) o USD (resto)';
COMMENT ON COLUMN public.donations.gateway_fee_usd IS 'Fee de pasarela estimado en USD al momento de donar';
COMMENT ON COLUMN public.donations.fee_covered_by_donor IS 'true si el donante pago el fee aparte para que la campana reciba el monto completo';
COMMENT ON COLUMN public.donations.net_amount_usd IS 'Monto que acredita al saldo USD de la campana (solo donaciones USD)';
COMMENT ON COLUMN public.donations.net_amount_bs IS 'Monto que acredita al saldo Bs de la campana (solo donaciones BS)';

-- Backfill historico: la moneda se deriva del metodo; el neto es el monto
-- completo (no se recalculan fees retroactivos).
UPDATE public.donations
SET currency = CASE
  WHEN payment_method IN ('pagomovil', 'transfer', 'chinchin') THEN 'BS'
  ELSE 'USD'
END
WHERE currency IS NULL;

UPDATE public.donations
SET net_amount_usd = amount_usd
WHERE net_amount_usd IS NULL AND currency = 'USD';

UPDATE public.donations
SET net_amount_bs = amount_bs,
    net_amount_usd = amount_usd
WHERE net_amount_bs IS NULL AND currency = 'BS';

CREATE INDEX IF NOT EXISTS idx_donations_campaign_currency_completed
  ON public.donations (campaign_id, currency)
  WHERE payment_status = 'completed';

-- ============================================
-- 2. WITHDRAWAL_REQUESTS: moneda y desglose
-- ============================================

ALTER TABLE public.withdrawal_requests
  ADD COLUMN IF NOT EXISTS currency text CHECK (currency IN ('USD', 'BS')),
  ADD COLUMN IF NOT EXISTS platform_fee numeric,
  ADD COLUMN IF NOT EXISTS gateway_fee numeric,
  ADD COLUMN IF NOT EXISTS net_amount numeric,
  ADD COLUMN IF NOT EXISTS indexed_usd_value numeric,
  ADD COLUMN IF NOT EXISTS fx_loss_usd numeric;

COMMENT ON COLUMN public.withdrawal_requests.currency IS 'Moneda del retiro segun el tipo de cuenta destino';
COMMENT ON COLUMN public.withdrawal_requests.platform_fee IS 'Comision LaVaca en la moneda del retiro';
COMMENT ON COLUMN public.withdrawal_requests.gateway_fee IS 'Fee bancario/pasarela en la moneda del retiro';
COMMENT ON COLUMN public.withdrawal_requests.net_amount IS 'Lo que recibe el creador en la moneda del retiro';
COMMENT ON COLUMN public.withdrawal_requests.indexed_usd_value IS 'Solo retiros BS: valor indexado en USD al costo promedio, congelado al procesar';
COMMENT ON COLUMN public.withdrawal_requests.fx_loss_usd IS 'Solo retiros BS: perdida cambiaria congelada al procesar (nunca se recalcula)';

-- Backfill historico: la moneda viene del tipo de cuenta, pero los retiros
-- viejos solo guardaron amount_usd; si no hay amount_bs los dejamos como USD
-- para que la resta de saldos siga cuadrando con el modelo anterior.
UPDATE public.withdrawal_requests wr
SET currency = CASE
  WHEN wa.account_type IN ('bank_bs', 'pagomovil') AND wr.amount_bs IS NOT NULL THEN 'BS'
  ELSE 'USD'
END
FROM public.withdrawal_accounts wa
WHERE wa.id = wr.account_id
  AND wr.currency IS NULL;

UPDATE public.withdrawal_requests
SET currency = 'USD'
WHERE currency IS NULL;

-- Retiros historicos: sin fees registrados, el neto es el monto completo.
UPDATE public.withdrawal_requests
SET platform_fee = 0,
    gateway_fee = 0,
    net_amount = CASE WHEN currency = 'BS' THEN amount_bs ELSE amount_usd END
WHERE net_amount IS NULL;

CREATE INDEX IF NOT EXISTS idx_withdrawals_campaign_currency_status
  ON public.withdrawal_requests (campaign_id, currency, status);

-- ============================================
-- 3. FEES DE RETIRO CONFIGURABLES
-- ============================================

CREATE TABLE IF NOT EXISTS public.withdrawal_fee_configs (
  account_type text PRIMARY KEY CHECK (account_type IN ('bank_bs', 'pagomovil', 'zelle', 'paypal', 'crypto')),
  currency text NOT NULL CHECK (currency IN ('USD', 'BS')),
  fee_percent numeric NOT NULL DEFAULT 0 CHECK (fee_percent >= 0 AND fee_percent <= 100),
  fee_fixed numeric NOT NULL DEFAULT 0 CHECK (fee_fixed >= 0),
  is_active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.withdrawal_fee_configs IS 'Fee de pasarela/banco por tipo de cuenta de retiro. fee_fixed esta en la moneda del retiro.';

INSERT INTO public.withdrawal_fee_configs (account_type, currency, fee_percent, fee_fixed)
VALUES
  ('bank_bs',   'BS',  0,   0),
  ('pagomovil', 'BS',  0.3, 0),
  ('zelle',     'USD', 0,   0),
  ('paypal',    'USD', 3,   0),
  ('crypto',    'USD', 0,   1)
ON CONFLICT (account_type) DO NOTHING;

ALTER TABLE public.withdrawal_fee_configs ENABLE ROW LEVEL SECURITY;

-- Lectura publica: alimenta la pagina /fees y el desglose del retiro.
DROP POLICY IF EXISTS withdrawal_fee_configs_public_read ON public.withdrawal_fee_configs;
CREATE POLICY withdrawal_fee_configs_public_read
ON public.withdrawal_fee_configs
FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS withdrawal_fee_configs_admin_manage ON public.withdrawal_fee_configs;
CREATE POLICY withdrawal_fee_configs_admin_manage
ON public.withdrawal_fee_configs
FOR ALL
TO authenticated
USING ((SELECT auth.uid()) IN (SELECT id FROM public.users WHERE role = 'admin'))
WITH CHECK ((SELECT auth.uid()) IN (SELECT id FROM public.users WHERE role = 'admin'));

DROP TRIGGER IF EXISTS trg_withdrawal_fee_configs_updated_at ON public.withdrawal_fee_configs;
CREATE TRIGGER trg_withdrawal_fee_configs_updated_at
BEFORE UPDATE ON public.withdrawal_fee_configs
FOR EACH ROW
EXECUTE FUNCTION public.set_payment_method_updated_at();

-- ============================================
-- 4. FEES DE DONACION (en payment_method_configs.settings)
-- ============================================
-- Valores iniciales sugeridos; el admin los puede cambiar desde
-- /admin/payment-methods sin tocar codigo.

UPDATE public.payment_method_configs
SET settings = settings || jsonb_build_object(
  'donation_fee_percent', CASE code
    WHEN 'card' THEN 2.9
    WHEN 'paypal' THEN 5.4
    WHEN 'pagomovil' THEN 0.3
    ELSE 0
  END,
  'donation_fee_fixed_usd', CASE code
    WHEN 'card' THEN 0.30
    WHEN 'paypal' THEN 0.30
    ELSE 0
  END
)
WHERE NOT (settings ? 'donation_fee_percent');

-- ============================================
-- 5. MINIMOS DE RETIRO POR MONEDA
-- ============================================

ALTER TABLE public.admin_config
  ADD COLUMN IF NOT EXISTS min_withdrawal_usd numeric NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS min_withdrawal_bs numeric NOT NULL DEFAULT 500;

-- ============================================
-- 6. RPC: get_campaign_balances
-- ============================================
-- Devuelve los dos saldos, reservas y la perdida cambiaria de una campana.
-- Contabilidad FX: costo promedio ponderado
--   tasa_promedio = SUM(amount_bs) / SUM(amount_usd) de donaciones BS completadas
--   no realizada  = (saldo_bs / tasa_promedio) - (saldo_bs / tasa_hoy)
--   realizada     = SUM(fx_loss_usd) de retiros BS procesados (congelada)
-- Solicitudes pendientes RESERVAN fondos (se restan del disponible);
-- las rechazadas (failed) los liberan automaticamente.

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
  v_donated_bs_usd_ref numeric := 0; -- USD indexado de las donaciones BS (para tasa promedio)

  v_withdrawn_bs numeric := 0;       -- procesados
  v_withdrawn_usd numeric := 0;
  v_pending_bs numeric := 0;         -- solicitudes pendientes (reservan)
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
  -- Autorizacion: creador de la campana, admin, o service role (auth.uid() null)
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

  -- Donaciones completadas por moneda
  SELECT
    COALESCE(SUM(net_amount_bs) FILTER (WHERE currency = 'BS'), 0),
    COALESCE(SUM(net_amount_usd) FILTER (WHERE currency = 'USD'), 0),
    COALESCE(SUM(amount_usd) FILTER (WHERE currency = 'BS'), 0),
    MAX(COALESCE(completed_at, created_at)) FILTER (WHERE currency = 'BS')
  INTO v_donated_bs, v_donated_usd, v_donated_bs_usd_ref, v_last_bs_donation_at
  FROM public.donations
  WHERE campaign_id = p_campaign_id
    AND payment_status = 'completed';

  -- Tasa promedio ponderada de entrada de los Bs (bruto/bruto: es una tasa)
  IF v_donated_bs_usd_ref > 0 THEN
    SELECT SUM(amount_bs) / NULLIF(SUM(amount_usd), 0)
    INTO v_avg_entry_rate
    FROM public.donations
    WHERE campaign_id = p_campaign_id
      AND payment_status = 'completed'
      AND currency = 'BS'
      AND amount_bs IS NOT NULL
      AND amount_usd > 0;
  END IF;

  -- Retiros: procesados descuentan, pendientes reservan, failed liberan
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

  -- Tasa de hoy: activa y vigente; fallback a la mas reciente; luego admin_config
  SELECT rate INTO v_current_rate
  FROM public.exchange_rates
  WHERE is_active = true AND expires_at > now()
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_current_rate IS NULL THEN
    SELECT rate INTO v_current_rate
    FROM public.exchange_rates
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;

  IF v_current_rate IS NULL THEN
    SELECT bcv_exchange_rate INTO v_current_rate
    FROM public.admin_config
    LIMIT 1;
  END IF;

  -- Perdida cambiaria no realizada del saldo Bs vivo
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

-- Hardening (mismo patron de migraciones 27/28): nada de PUBLIC ni anon
REVOKE EXECUTE ON FUNCTION public.get_campaign_balances(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_campaign_balances(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_campaign_balances(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_campaign_balances(uuid) TO service_role;
