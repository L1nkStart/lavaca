-- ============================================================================
-- Allow campaign documents under campaigns/documents/<campaignId>/<userId>_*
-- ============================================================================

-- Existing policy "Public Access" on campaigns bucket already allows SELECT.
-- These policies only enable INSERT/UPDATE/DELETE for campaign documents.

DROP POLICY IF EXISTS "Authenticated users can upload campaign documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own campaign documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own campaign documents" ON storage.objects;

CREATE POLICY "Authenticated users can upload campaign documents"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'campaigns'
  AND auth.role() = 'authenticated'
  AND name LIKE 'documents/%/%'
  AND split_part(name, '/', 3) LIKE auth.uid()::text || '_%'
  AND EXISTS (
    SELECT 1
    FROM public.campaigns c
    WHERE c.id::text = split_part(name, '/', 2)
      AND c.creator_id = auth.uid()
  )
);

CREATE POLICY "Users can update own campaign documents"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'campaigns'
  AND name LIKE 'documents/%/%'
  AND split_part(name, '/', 3) LIKE auth.uid()::text || '_%'
  AND EXISTS (
    SELECT 1
    FROM public.campaigns c
    WHERE c.id::text = split_part(name, '/', 2)
      AND c.creator_id = auth.uid()
  )
);

CREATE POLICY "Users can delete own campaign documents"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'campaigns'
  AND name LIKE 'documents/%/%'
  AND split_part(name, '/', 3) LIKE auth.uid()::text || '_%'
  AND EXISTS (
    SELECT 1
    FROM public.campaigns c
    WHERE c.id::text = split_part(name, '/', 2)
      AND c.creator_id = auth.uid()
  )
);
