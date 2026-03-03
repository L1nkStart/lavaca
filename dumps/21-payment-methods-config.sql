-- ============================================
-- PAYMENT METHODS CONFIGURATION (ADMIN-MANAGED)
-- ============================================

CREATE TABLE IF NOT EXISTS public.payment_method_configs (
  code text PRIMARY KEY CHECK (code IN ('card', 'crypto', 'zelle', 'pagomovil', 'transfer')),
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT false,
  display_order integer NOT NULL DEFAULT 0,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by uuid REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.payment_method_bank_accounts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  method_code text NOT NULL DEFAULT 'transfer' REFERENCES public.payment_method_configs(code) ON DELETE CASCADE,
  bank_name text NOT NULL,
  account_holder text NOT NULL,
  account_number text NOT NULL,
  account_type text,
  document_id text,
  currency text NOT NULL DEFAULT 'BS',
  instructions text,
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_method_configs_active_order
  ON public.payment_method_configs(is_active, display_order);

CREATE INDEX IF NOT EXISTS idx_payment_method_bank_accounts_method_order
  ON public.payment_method_bank_accounts(method_code, is_active, display_order);

CREATE OR REPLACE FUNCTION public.set_payment_method_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_payment_method_configs_updated_at ON public.payment_method_configs;
CREATE TRIGGER trg_payment_method_configs_updated_at
BEFORE UPDATE ON public.payment_method_configs
FOR EACH ROW
EXECUTE FUNCTION public.set_payment_method_updated_at();

DROP TRIGGER IF EXISTS trg_payment_method_bank_accounts_updated_at ON public.payment_method_bank_accounts;
CREATE TRIGGER trg_payment_method_bank_accounts_updated_at
BEFORE UPDATE ON public.payment_method_bank_accounts
FOR EACH ROW
EXECUTE FUNCTION public.set_payment_method_updated_at();

INSERT INTO public.payment_method_configs (code, name, description, is_active, display_order, settings)
VALUES
  ('card', 'Tarjeta de Crédito/Débito', 'Pago internacional procesado por Stripe', true, 10, '{"provider": "stripe"}'::jsonb),
  ('crypto', 'Binance Pay', 'Pago con criptoactivos usando Binance Pay', true, 20, '{"provider": "binance"}'::jsonb),
  ('zelle', 'Zelle', 'Pago manual por Zelle', true, 30, '{"email": "", "accountName": ""}'::jsonb),
  ('pagomovil', 'Pago Móvil', 'Pago local venezolano', true, 40, '{"bank": "", "phone": "", "cedula": "", "qrImageUrl": ""}'::jsonb),
  ('transfer', 'Transferencia Bancaria', 'Transferencia bancaria manual', true, 50, '{"notes": ""}'::jsonb)
ON CONFLICT (code) DO NOTHING;

ALTER TABLE public.payment_method_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_method_bank_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payment_method_configs_public_read ON public.payment_method_configs;
CREATE POLICY payment_method_configs_public_read
ON public.payment_method_configs
FOR SELECT
TO anon, authenticated
USING (is_active = true);

DROP POLICY IF EXISTS payment_method_configs_admin_manage ON public.payment_method_configs;
CREATE POLICY payment_method_configs_admin_manage
ON public.payment_method_configs
FOR ALL
TO authenticated
USING (auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin'))
WITH CHECK (auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin'));

DROP POLICY IF EXISTS payment_method_bank_accounts_public_read ON public.payment_method_bank_accounts;
CREATE POLICY payment_method_bank_accounts_public_read
ON public.payment_method_bank_accounts
FOR SELECT
TO anon, authenticated
USING (
  is_active = true
  AND EXISTS (
    SELECT 1
    FROM public.payment_method_configs c
    WHERE c.code = payment_method_bank_accounts.method_code
      AND c.is_active = true
  )
);

DROP POLICY IF EXISTS payment_method_bank_accounts_admin_manage ON public.payment_method_bank_accounts;
CREATE POLICY payment_method_bank_accounts_admin_manage
ON public.payment_method_bank_accounts
FOR ALL
TO authenticated
USING (auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin'))
WITH CHECK (auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin'));
