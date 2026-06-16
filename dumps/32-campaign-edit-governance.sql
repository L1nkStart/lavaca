-- ============================================
-- 32 - GOBERNANZA DE EDICION DE CAMPANAS
-- ============================================
-- Implementa PLAN-EDICION-CAMPANAS.md:
--   * Historial de cambios de meta + meta original (etiqueta de transparencia).
--   * Cola de moderacion de imagenes (shadow editing) sin tocar la campana en
--     vivo hasta que un admin apruebe.
--   * Archivo de multimedia reemplazada (auditoria anti-fraude).
--   * Comentarios del sistema en el muro de la campana.
-- La barra de progreso, donaciones y retiros NO cambian.

-- ============================================
-- 1. META: meta original + historial de cambios
-- ============================================

ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS original_goal_amount_usd numeric;

COMMENT ON COLUMN public.campaigns.original_goal_amount_usd IS 'Meta con la que arranco la campana. Se fija en el primer cambio de meta; alimenta la etiqueta "Meta original".';

CREATE TABLE IF NOT EXISTS public.campaign_goal_history (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  previous_goal numeric NOT NULL,
  new_goal numeric NOT NULL,
  change_type text NOT NULL CHECK (change_type IN ('increase', 'decrease')),
  reason text NOT NULL,
  created_by uuid NOT NULL REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_campaign_goal_history_campaign
  ON public.campaign_goal_history (campaign_id, created_at DESC);

-- ============================================
-- 2. COLA DE MODERACION DE IMAGENES (shadow editing)
-- ============================================

CREATE TABLE IF NOT EXISTS public.campaign_media_changes (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL REFERENCES public.users(id),
  change_type text NOT NULL CHECK (change_type IN ('main_image', 'gallery_add', 'gallery_remove')),
  proposed_url text,
  previous_url text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  review_notes text,
  reviewed_by uuid REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_campaign_media_changes_pending
  ON public.campaign_media_changes (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_campaign_media_changes_campaign
  ON public.campaign_media_changes (campaign_id, status);

COMMENT ON TABLE public.campaign_media_changes IS 'Cola de aprobacion de cambios de portada/galeria. La imagen no toca la campana en vivo hasta aprobarse.';

-- ============================================
-- 3. ARCHIVO DE MULTIMEDIA (auditoria)
-- ============================================

CREATE TABLE IF NOT EXISTS public.campaign_media_archive (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  url text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('main_image', 'gallery')),
  archived_at timestamptz NOT NULL DEFAULT now(),
  reason text
);

CREATE INDEX IF NOT EXISTS idx_campaign_media_archive_campaign
  ON public.campaign_media_archive (campaign_id, archived_at DESC);

COMMENT ON TABLE public.campaign_media_archive IS 'Imagenes reemplazadas o quitadas. NO se borran de Storage: registro visual para casos de fraude.';

-- ============================================
-- 4. COMENTARIOS DEL SISTEMA EN EL MURO
-- ============================================

ALTER TABLE public.campaign_comments
  ADD COLUMN IF NOT EXISTS is_system boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.campaign_comments.is_system IS 'true = comentario automatico del sistema (ej: cambio de meta), se renderiza distinto.';

-- ============================================
-- 5. RLS
-- ============================================

ALTER TABLE public.campaign_goal_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_media_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_media_archive ENABLE ROW LEVEL SECURITY;

-- Historial de meta: lo lee el creador dueno y el admin; escritura via service-role.
DROP POLICY IF EXISTS campaign_goal_history_read ON public.campaign_goal_history;
CREATE POLICY campaign_goal_history_read
ON public.campaign_goal_history
FOR SELECT
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = campaign_id AND c.creator_id = (SELECT auth.uid()))
  OR (SELECT auth.uid()) IN (SELECT id FROM public.users WHERE role = 'admin')
);

-- Cola de moderacion: lectura del creador dueno + admin; el creador puede
-- insertar (pending) cambios de su propia campana; el cambio de estado lo
-- hacen los endpoints admin con service-role.
DROP POLICY IF EXISTS campaign_media_changes_read ON public.campaign_media_changes;
CREATE POLICY campaign_media_changes_read
ON public.campaign_media_changes
FOR SELECT
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = campaign_id AND c.creator_id = (SELECT auth.uid()))
  OR (SELECT auth.uid()) IN (SELECT id FROM public.users WHERE role = 'admin')
);

DROP POLICY IF EXISTS campaign_media_changes_insert ON public.campaign_media_changes;
CREATE POLICY campaign_media_changes_insert
ON public.campaign_media_changes
FOR INSERT
TO authenticated
WITH CHECK (
  requested_by = (SELECT auth.uid())
  AND EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = campaign_id AND c.creator_id = (SELECT auth.uid()))
);

-- Archivo de multimedia: lectura del creador dueno + admin; escritura service-role.
DROP POLICY IF EXISTS campaign_media_archive_read ON public.campaign_media_archive;
CREATE POLICY campaign_media_archive_read
ON public.campaign_media_archive
FOR SELECT
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = campaign_id AND c.creator_id = (SELECT auth.uid()))
  OR (SELECT auth.uid()) IN (SELECT id FROM public.users WHERE role = 'admin')
);
