-- ============================================================================
-- Create Storage Buckets for Campaign Files - LaVaca Database
-- This script creates the necessary storage buckets for campaigns
-- ============================================================================

-- Create campaigns bucket for images
INSERT INTO storage.buckets (id, name, public)
VALUES ('campaigns', 'campaigns', true)
ON CONFLICT (id) DO NOTHING;

-- Create campaign-support bucket for documents  
INSERT INTO storage.buckets (id, name, public)
VALUES ('campaign-support', 'campaign-support', false)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- Storage Policies for campaigns bucket (public images)
-- ============================================================================

-- Allow anyone to view campaign images (public bucket)
CREATE POLICY "Public Access" ON storage.objects 
FOR SELECT USING (bucket_id = 'campaigns');

-- Allow authenticated users to upload to campaigns bucket
CREATE POLICY "Authenticated users can upload campaign images" ON storage.objects 
FOR INSERT WITH CHECK (
  bucket_id = 'campaigns' 
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] IN ('main-images', 'gallery')
);

-- Allow users to update their own campaign images
CREATE POLICY "Users can update own campaign images" ON storage.objects 
FOR UPDATE USING (
  bucket_id = 'campaigns' 
  AND auth.uid()::text = (storage.foldername(name))[2]
);

-- Allow users to delete their own campaign images
CREATE POLICY "Users can delete own campaign images" ON storage.objects 
FOR DELETE USING (
  bucket_id = 'campaigns' 
  AND auth.uid()::text = (storage.foldername(name))[2]
);

-- ============================================================================
-- Storage Policies for campaign-support bucket (private documents)
-- ============================================================================

-- Allow users to view their own support documents
CREATE POLICY "Users can view own support documents" ON storage.objects 
FOR SELECT USING (
  bucket_id = 'campaign-support'
  AND auth.uid()::text = (storage.foldername(name))[2]
);

-- Allow authenticated users to upload support documents
CREATE POLICY "Authenticated users can upload support documents" ON storage.objects 
FOR INSERT WITH CHECK (
  bucket_id = 'campaign-support' 
  AND auth.role() = 'authenticated'
  AND auth.uid()::text = (storage.foldername(name))[2]
);

-- Allow users to update their own support documents
CREATE POLICY "Users can update own support documents" ON storage.objects 
FOR UPDATE USING (
  bucket_id = 'campaign-support' 
  AND auth.uid()::text = (storage.foldername(name))[2]
);

-- Allow users to delete their own support documents
CREATE POLICY "Users can delete own support documents" ON storage.objects 
FOR DELETE USING (
  bucket_id = 'campaign-support' 
  AND auth.uid()::text = (storage.foldername(name))[2]
);

-- ============================================================================
-- Additional Functions for Storage Management
-- ============================================================================

-- Function to get campaign images
CREATE OR REPLACE FUNCTION get_campaign_images(campaign_uuid UUID)
RETURNS TABLE (
  image_url TEXT,
  image_type TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    CASE 
      WHEN c.main_image_url IS NOT NULL THEN c.main_image_url
      ELSE NULL
    END as image_url,
    'main'::TEXT as image_type,
    c.created_at
  FROM campaigns c
  WHERE c.id = campaign_uuid
  AND c.main_image_url IS NOT NULL
  
  UNION ALL
  
  SELECT 
    unnest(cd.gallery_images) as image_url,
    'gallery'::TEXT as image_type,
    cd.created_at
  FROM campaign_details cd
  WHERE cd.campaign_id = campaign_uuid
  AND cd.gallery_images IS NOT NULL
  AND array_length(cd.gallery_images, 1) > 0;
END;
$$;

-- Function to clean up orphaned files (run periodically)
CREATE OR REPLACE FUNCTION cleanup_orphaned_campaign_files()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER := 0;
  file_record RECORD;
BEGIN
  -- This function should be called periodically to clean up files
  -- that are no longer referenced by any campaigns
  
  -- Note: Actual implementation would require more complex logic
  -- to safely identify truly orphaned files
  
  RAISE LOG 'Cleanup function called. Manual inspection recommended.';
  RETURN deleted_count;
END;
$$;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION get_campaign_images(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_orphaned_campaign_files() TO service_role;
