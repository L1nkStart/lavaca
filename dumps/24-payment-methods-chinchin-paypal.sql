-- ============================================
-- Habilita ChinChin y PayPal como métodos de pago
-- ============================================
-- Notas:
--   * `payment_method` (enum de donations) ya incluye 'paypal'. Se agrega
--     'chinchin' al enum.
--   * `payment_method_configs.code` tiene un CHECK constraint que se
--     reemplaza para aceptar 'paypal' y 'chinchin'.
--   * Se insertan filas inactivas para que el admin pueda activar los
--     métodos desde /admin/payment-methods una vez que tenga credenciales.

-- 1. Ampliar el enum payment_method para aceptar 'chinchin'
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'payment_method'
      AND e.enumlabel = 'chinchin'
  ) THEN
    ALTER TYPE payment_method ADD VALUE 'chinchin';
  END IF;
END
$$;

-- 2. Recrear el CHECK constraint de payment_method_configs.code
ALTER TABLE public.payment_method_configs
  DROP CONSTRAINT IF EXISTS payment_method_configs_code_check;

ALTER TABLE public.payment_method_configs
  ADD CONSTRAINT payment_method_configs_code_check
  CHECK (code IN ('card', 'crypto', 'zelle', 'pagomovil', 'transfer', 'paypal', 'chinchin'));

-- 3. Sembrar filas (desactivadas) para PayPal y ChinChin
INSERT INTO public.payment_method_configs (code, name, description, is_active, display_order, settings)
VALUES
  (
    'paypal',
    'PayPal',
    'Pago internacional vía PayPal (requiere credenciales de PayPal Orders v2)',
    false,
    15,
    '{"provider": "paypal"}'::jsonb
  ),
  (
    'chinchin',
    'ChinChin',
    'Pasarela venezolana ChinChin (C2P). Stub: activar cuando se tengan credenciales del comercio.',
    false,
    25,
    '{"provider": "chinchin"}'::jsonb
  )
ON CONFLICT (code) DO NOTHING;
