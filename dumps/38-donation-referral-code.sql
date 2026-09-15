-- ============================================
-- 38 - CODIGO DE REFERIDO EN DONACIONES
-- ============================================
-- Los enlaces que se comparten desde la plataforma llevan ?ref=<codigo>
-- (los 8 primeros caracteres del id del usuario que compartio, o "anon").
-- La pagina de la campana guarda el codigo en el navegador (7 dias) y al
-- donar (checkout normal o pago directo) se registra en la donacion.
-- Solo sirve para medir quien trae donantes; no cambia dinero ni permisos.

ALTER TABLE public.donations
  ADD COLUMN IF NOT EXISTS referral_code text;

COMMENT ON COLUMN public.donations.referral_code IS 'Codigo ?ref= del enlace por el que llego el donante (quien compartio). Solo medicion.';

CREATE INDEX IF NOT EXISTS idx_donations_referral_code
  ON public.donations (referral_code)
  WHERE referral_code IS NOT NULL;

-- Nota operativa (2026-09-14): la campana propia de LaVaca
-- (0f483058-a627-4ae0-ac91-8f431ffb4013) se paso a "sin meta" y destacada:
--   update campaigns set is_open_ended = true, goal_amount_usd = 0,
--     original_goal_amount_usd = coalesce(original_goal_amount_usd, goal_amount_usd),
--     is_featured = true where id = '0f483058-a627-4ae0-ac91-8f431ffb4013';
