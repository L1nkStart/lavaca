-- ============================================
-- 34 - FORZAR MODO CRISIS
-- ============================================
-- Cuando crisis_mode_forced = true, TODAS las campañas se crean en modo crisis
-- automaticamente (sin que el creador elija el tipo). Solo el admin lo cambia.
-- Forzar implica el modo crisis maestro encendido.

ALTER TABLE public.admin_config
  ADD COLUMN IF NOT EXISTS crisis_mode_forced boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.admin_config.crisis_mode_forced IS 'Si es true, todas las campanas nuevas nacen en modo crisis sin seleccion del creador. Implica crisis_mode_enabled = true.';
