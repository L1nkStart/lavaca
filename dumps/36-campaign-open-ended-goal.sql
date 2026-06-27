-- ============================================
-- 36 - CAMPANAS SIN MONTO (META ABIERTA)
-- ============================================
-- Para causas beneficas donde el objetivo es ayudar, no alcanzar una cifra.
-- is_open_ended = true: no se muestra barra ni objetivo, sin limite. Las
-- donaciones funcionan igual. goal_amount_usd se ignora (se guarda 0).

ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS is_open_ended boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.campaigns.is_open_ended IS 'true = campana sin meta fija: no se muestra barra ni objetivo, sin limite. goal_amount_usd se ignora (0).';
