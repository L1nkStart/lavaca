-- ============================================
-- 37 - CREAR CAMPANA SIN VERIFICACION + AUTO-CREATOR
-- ============================================
-- Cualquier usuario autenticado puede crear SU PROPIA campana, sin requerir
-- KYC verificado. La campana nace en pending_review y NO se activa hasta que
-- el admin la aprueba (ahi se valida la verificacion del creador).
-- Antes la politica RLS exigia kyc_status = 'verified' para insertar, lo que
-- bloqueaba a los usuarios sin verificar.

DROP POLICY IF EXISTS "campaigns_insert_verified_users" ON public.campaigns;
DROP POLICY IF EXISTS "campaigns_insert_own" ON public.campaigns;
CREATE POLICY "campaigns_insert_own" ON public.campaigns
  FOR INSERT TO authenticated
  WITH CHECK (creator_id = (SELECT auth.uid()));

-- Al crear una campana, el usuario pasa de 'donor' a 'creator' automaticamente.
-- Asi se elimina el paso manual "Convertirse en creador".
CREATE OR REPLACE FUNCTION public.promote_to_creator_on_campaign()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.users
  SET role = 'creator', updated_at = now()
  WHERE id = NEW.creator_id AND role = 'donor';
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_promote_to_creator ON public.campaigns;
CREATE TRIGGER trg_promote_to_creator
AFTER INSERT ON public.campaigns
FOR EACH ROW EXECUTE FUNCTION public.promote_to_creator_on_campaign();
