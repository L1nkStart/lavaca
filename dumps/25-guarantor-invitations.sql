-- ============================================================================
-- GUARANTOR INVITATIONS
-- ============================================================================
-- Permite al creador de una campaña invitar a un tercero (por email) a ser
-- garante (veedor) de la campaña. El invitado:
--   * Si ya tiene cuenta → ve la invitación en /guarantor/dashboard.
--   * Si no tiene cuenta → debe registrarse y completar su perfil de garante.
-- Cuando acepta:
--   * Se asegura que exista la fila en `guarantors` para ese usuario
--     (kyc_status='pending' por defecto).
--   * Se crea/actualiza la fila en `campaign_guarantors` con status='accepted'.
--   * Una sola campaña puede tener N garantes (todos suman).

CREATE TABLE IF NOT EXISTS public.guarantor_invitations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  invited_by uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  invited_email text NOT NULL,
  invited_name text,
  message text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled', 'expired')),
  rejection_reason text,
  responded_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  responded_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT guarantor_invitations_unique_pending
    UNIQUE NULLS NOT DISTINCT (campaign_id, invited_email, status)
);

CREATE INDEX IF NOT EXISTS idx_guarantor_invitations_campaign
  ON public.guarantor_invitations(campaign_id);
CREATE INDEX IF NOT EXISTS idx_guarantor_invitations_email_status
  ON public.guarantor_invitations(lower(invited_email), status);
CREATE INDEX IF NOT EXISTS idx_guarantor_invitations_invited_by
  ON public.guarantor_invitations(invited_by);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_guarantor_invitations_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guarantor_invitations_updated_at ON public.guarantor_invitations;
CREATE TRIGGER trg_guarantor_invitations_updated_at
BEFORE UPDATE ON public.guarantor_invitations
FOR EACH ROW
EXECUTE FUNCTION public.set_guarantor_invitations_updated_at();

-- ============================================================================
-- RLS
-- ============================================================================
ALTER TABLE public.guarantor_invitations ENABLE ROW LEVEL SECURITY;

-- Invitee puede ver las invitaciones a su email (case-insensitive).
DROP POLICY IF EXISTS guarantor_invitations_invitee_read ON public.guarantor_invitations;
CREATE POLICY guarantor_invitations_invitee_read
ON public.guarantor_invitations
FOR SELECT
TO authenticated
USING (
  lower(invited_email) = lower(coalesce((auth.jwt() ->> 'email')::text, ''))
);

-- Creador puede ver sus propias invitaciones.
DROP POLICY IF EXISTS guarantor_invitations_owner_read ON public.guarantor_invitations;
CREATE POLICY guarantor_invitations_owner_read
ON public.guarantor_invitations
FOR SELECT
TO authenticated
USING (invited_by = auth.uid());

-- Admin puede ver todas.
DROP POLICY IF EXISTS guarantor_invitations_admin_read ON public.guarantor_invitations;
CREATE POLICY guarantor_invitations_admin_read
ON public.guarantor_invitations
FOR SELECT
TO authenticated
USING (auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin'));

-- Las escrituras se hacen vía API server-side con service role (no se otorgan
-- aquí policies de INSERT/UPDATE para el rol authenticated; el endpoint
-- valida ownership y luego inserta con createAdminClient).

-- ============================================================================
-- Función pública (SECURITY DEFINER) para aceptar invitación
-- ============================================================================
-- Crea el registro de garante si no existe, marca la invitación como aceptada
-- y crea/actualiza la fila en campaign_guarantors.
CREATE OR REPLACE FUNCTION public.accept_guarantor_invitation(
  p_invitation_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_user_email text := lower(coalesce((auth.jwt() ->> 'email')::text, ''));
  v_invitation public.guarantor_invitations%ROWTYPE;
  v_guarantor_id uuid;
  v_campaign_guarantor_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  SELECT * INTO v_invitation
  FROM public.guarantor_invitations
  WHERE id = p_invitation_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitación no encontrada';
  END IF;

  IF v_invitation.status <> 'pending' THEN
    RAISE EXCEPTION 'Invitación no está pendiente (estado: %)', v_invitation.status;
  END IF;

  IF v_invitation.expires_at IS NOT NULL AND v_invitation.expires_at < now() THEN
    UPDATE public.guarantor_invitations
       SET status = 'expired'
     WHERE id = p_invitation_id;
    RAISE EXCEPTION 'Invitación expirada';
  END IF;

  IF lower(v_invitation.invited_email) <> v_user_email THEN
    RAISE EXCEPTION 'Esta invitación es para otro correo';
  END IF;

  -- Asegurar que exista el registro guarantor para este usuario.
  SELECT id INTO v_guarantor_id
  FROM public.guarantors
  WHERE user_id = v_user_id;

  IF v_guarantor_id IS NULL THEN
    INSERT INTO public.guarantors (user_id, kyc_status)
    VALUES (v_user_id, 'pending')
    RETURNING id INTO v_guarantor_id;
  END IF;

  -- Promover el rol del usuario a 'guarantor' si todavía es donor.
  UPDATE public.users
     SET role = 'guarantor'
   WHERE id = v_user_id AND role = 'donor';

  -- Crear/actualizar campaign_guarantors.
  INSERT INTO public.campaign_guarantors (campaign_id, guarantor_id, status, accepted_at)
  VALUES (v_invitation.campaign_id, v_guarantor_id, 'accepted', now())
  ON CONFLICT (campaign_id, guarantor_id)
  DO UPDATE SET status = 'accepted', accepted_at = now()
  RETURNING id INTO v_campaign_guarantor_id;

  -- Marcar la invitación como aceptada.
  UPDATE public.guarantor_invitations
     SET status = 'accepted',
         responded_by = v_user_id,
         responded_at = now()
   WHERE id = p_invitation_id;

  RETURN v_campaign_guarantor_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_guarantor_invitation(uuid) TO authenticated;

-- ============================================================================
-- Función para rechazar
-- ============================================================================
CREATE OR REPLACE FUNCTION public.reject_guarantor_invitation(
  p_invitation_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_user_email text := lower(coalesce((auth.jwt() ->> 'email')::text, ''));
  v_invitation public.guarantor_invitations%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  SELECT * INTO v_invitation
  FROM public.guarantor_invitations
  WHERE id = p_invitation_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitación no encontrada';
  END IF;

  IF v_invitation.status <> 'pending' THEN
    RAISE EXCEPTION 'Invitación no está pendiente';
  END IF;

  IF lower(v_invitation.invited_email) <> v_user_email THEN
    RAISE EXCEPTION 'Esta invitación es para otro correo';
  END IF;

  UPDATE public.guarantor_invitations
     SET status = 'rejected',
         rejection_reason = p_reason,
         responded_by = v_user_id,
         responded_at = now()
   WHERE id = p_invitation_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reject_guarantor_invitation(uuid, text) TO authenticated;

-- ============================================================================
-- Unique constraint en campaign_guarantors para evitar duplicados
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'campaign_guarantors_campaign_guarantor_unique'
  ) THEN
    ALTER TABLE public.campaign_guarantors
      ADD CONSTRAINT campaign_guarantors_campaign_guarantor_unique
      UNIQUE (campaign_id, guarantor_id);
  END IF;
END
$$;
