-- ============================================================================
-- PAYMENT CAPTURES (comprobantes de pago manual)
-- ============================================================================
-- El donante puede adjuntar una imagen del comprobante (Zelle, transferencia,
-- cripto, etc.) cuando reporta un pago manual. El admin la revisa desde
-- /admin/payments y la usa para aprobar o rechazar la donación.

-- 1. Columna en donations para guardar la URL del comprobante
ALTER TABLE public.donations
  ADD COLUMN IF NOT EXISTS capture_url text;

-- 2. Bucket privado para los comprobantes
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-captures', 'payment-captures', false)
ON CONFLICT (id) DO NOTHING;

-- 3. Policies del bucket
-- 3a. Usuarios autenticados pueden subir su propio comprobante.
DROP POLICY IF EXISTS "Auth users can upload payment captures" ON storage.objects;
CREATE POLICY "Auth users can upload payment captures"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'payment-captures'
  AND auth.role() = 'authenticated'
);

-- 3b. Anónimos también pueden subir (donantes invitados). Restrincción por size
-- y mime se aplica en el cliente. Se acepta la subida para no bloquear el
-- flujo de checkout del donante invitado.
DROP POLICY IF EXISTS "Anon can upload payment captures" ON storage.objects;
CREATE POLICY "Anon can upload payment captures"
ON storage.objects
FOR INSERT
TO anon
WITH CHECK (bucket_id = 'payment-captures');

-- 3c. Solo el dueño autenticado y los admins pueden leer.
DROP POLICY IF EXISTS "Owner can read own payment captures" ON storage.objects;
CREATE POLICY "Owner can read own payment captures"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'payment-captures'
  AND (owner = auth.uid())
);

DROP POLICY IF EXISTS "Admin can read all payment captures" ON storage.objects;
CREATE POLICY "Admin can read all payment captures"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'payment-captures'
  AND EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
  )
);
