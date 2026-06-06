-- ============================================================================
-- Fix de los advisors de Supabase para los objetos creados en la migración 25.
-- Aplicar después de 25. Es idempotente (todo va con IF EXISTS / GRANT/REVOKE).
-- ============================================================================
-- Issues que arregla:
--   * duplicate_index: el `campaign_guarantors_campaign_guarantor_unique` que
--     creó la migración 25 duplica al `campaign_guarantors_campaign_id_guarantor_id_key`
--     ya presente en el schema base (01-create-tables.sql lo crea como UNIQUE).
--   * anon_security_definer_function_executable:
--     PostgreSQL otorga EXECUTE a PUBLIC por defecto, lo que permite que `anon`
--     llame a las RPCs SECURITY DEFINER pese al GRANT explícito a authenticated.
--   * auth_rls_initplan: las policies originales evaluaban auth.uid() / auth.jwt()
--     por cada fila. Envueltas en SELECT subquery se evalúan una sola vez.

-- 1. Quitar el unique constraint duplicado en campaign_guarantors.
ALTER TABLE public.campaign_guarantors
  DROP CONSTRAINT IF EXISTS campaign_guarantors_campaign_guarantor_unique;

-- 2. Endurecer permisos de las RPCs SECURITY DEFINER.
REVOKE EXECUTE ON FUNCTION public.accept_guarantor_invitation(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.reject_guarantor_invitation(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_guarantor_invitation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_guarantor_invitation(uuid, text) TO authenticated;

-- 3. Recrear las RLS policies envolviendo auth.uid() y auth.jwt() en subquery.
DROP POLICY IF EXISTS guarantor_invitations_invitee_read ON public.guarantor_invitations;
CREATE POLICY guarantor_invitations_invitee_read
ON public.guarantor_invitations
FOR SELECT
TO authenticated
USING (
  lower(invited_email) = lower(coalesce(((SELECT auth.jwt()) ->> 'email')::text, ''))
);

DROP POLICY IF EXISTS guarantor_invitations_owner_read ON public.guarantor_invitations;
CREATE POLICY guarantor_invitations_owner_read
ON public.guarantor_invitations
FOR SELECT
TO authenticated
USING (invited_by = (SELECT auth.uid()));

DROP POLICY IF EXISTS guarantor_invitations_admin_read ON public.guarantor_invitations;
CREATE POLICY guarantor_invitations_admin_read
ON public.guarantor_invitations
FOR SELECT
TO authenticated
USING ((SELECT auth.uid()) IN (SELECT id FROM public.users WHERE role = 'admin'));
