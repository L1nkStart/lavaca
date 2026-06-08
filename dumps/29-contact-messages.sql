-- ============================================================================
-- CONTACT MESSAGES
-- ============================================================================
-- Mensajes que llegan desde /contact. El usuario completa el formulario,
-- guardamos aquí. El admin los revisa luego desde la base (o desde una UI
-- futura). Cuando se conecte Resend / SMTP, también se dispara un email
-- al equipo.

CREATE TABLE IF NOT EXISTS public.contact_messages (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  topic text NOT NULL DEFAULT 'general'
    CHECK (topic IN ('general','campana','donacion','garante','reporte','prensa','otro')),
  name text NOT NULL,
  email text NOT NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'new'
    CHECK (status IN ('new','read','responded','archived','spam')),
  user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ip_address text,
  user_agent text,
  responded_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contact_messages_status
  ON public.contact_messages(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contact_messages_email
  ON public.contact_messages(lower(email));

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_contact_messages_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_contact_messages_updated_at ON public.contact_messages;
CREATE TRIGGER trg_contact_messages_updated_at
BEFORE UPDATE ON public.contact_messages
FOR EACH ROW
EXECUTE FUNCTION public.set_contact_messages_updated_at();

-- RLS
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

-- Inserts: cualquier visitante puede crear un mensaje (es un formulario público).
DROP POLICY IF EXISTS contact_messages_insert ON public.contact_messages;
CREATE POLICY contact_messages_insert
ON public.contact_messages
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Select: sólo admins.
DROP POLICY IF EXISTS contact_messages_admin_read ON public.contact_messages;
CREATE POLICY contact_messages_admin_read
ON public.contact_messages
FOR SELECT
TO authenticated
USING ((SELECT auth.uid()) IN (SELECT id FROM public.users WHERE role = 'admin'));

-- Update / Delete: sólo admins.
DROP POLICY IF EXISTS contact_messages_admin_write ON public.contact_messages;
CREATE POLICY contact_messages_admin_write
ON public.contact_messages
FOR UPDATE
TO authenticated
USING ((SELECT auth.uid()) IN (SELECT id FROM public.users WHERE role = 'admin'))
WITH CHECK ((SELECT auth.uid()) IN (SELECT id FROM public.users WHERE role = 'admin'));

DROP POLICY IF EXISTS contact_messages_admin_delete ON public.contact_messages;
CREATE POLICY contact_messages_admin_delete
ON public.contact_messages
FOR DELETE
TO authenticated
USING ((SELECT auth.uid()) IN (SELECT id FROM public.users WHERE role = 'admin'));

-- Revocar SELECT a anon (no debe leer mensajes ni siquiera via GraphQL).
REVOKE SELECT ON public.contact_messages FROM anon;
