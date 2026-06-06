-- ============================================================================
-- Segunda pasada de fixes para los advisors de la migración 25.
-- Aplicar después de 27. Idempotente.
-- ============================================================================
-- Cierra:
--   * pg_graphql_anon_table_exposed (guarantor_invitations)
--   * multiple_permissive_policies (guarantor_invitations SELECT)
--   * unindexed_foreign_keys (responded_by)
--   * function_search_path_mutable (set_guarantor_invitations_updated_at)

-- 1. Revocar SELECT a anon sobre guarantor_invitations.
REVOKE SELECT ON public.guarantor_invitations FROM anon;

-- 2. Consolidar las 3 policies de SELECT en una sola con OR.
DROP POLICY IF EXISTS guarantor_invitations_invitee_read ON public.guarantor_invitations;
DROP POLICY IF EXISTS guarantor_invitations_owner_read   ON public.guarantor_invitations;
DROP POLICY IF EXISTS guarantor_invitations_admin_read   ON public.guarantor_invitations;

CREATE POLICY guarantor_invitations_read
ON public.guarantor_invitations
FOR SELECT
TO authenticated
USING (
  lower(invited_email) = lower(coalesce(((SELECT auth.jwt()) ->> 'email')::text, ''))
  OR invited_by = (SELECT auth.uid())
  OR (SELECT auth.uid()) IN (SELECT id FROM public.users WHERE role = 'admin')
);

-- 3. Índice sobre responded_by (FK sin índice cobertor).
CREATE INDEX IF NOT EXISTS idx_guarantor_invitations_responded_by
  ON public.guarantor_invitations(responded_by);

-- 4. Trigger function inmune a search_path injection.
CREATE OR REPLACE FUNCTION public.set_guarantor_invitations_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
