-- ============================================================================
-- Update Campaigns Table Schema - LaVaca Database
-- This script updates the campaigns table to match the create-campaign-form expectations
-- ============================================================================

-- Add missing columns to campaigns table
ALTER TABLE campaigns 
ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES categories(id),
ADD COLUMN IF NOT EXISTS story TEXT,
ADD COLUMN IF NOT EXISTS main_image_url TEXT,
ADD COLUMN IF NOT EXISTS slug TEXT,
ADD COLUMN IF NOT EXISTS urgency_level TEXT DEFAULT 'medium';

-- Create unique index for slug
CREATE UNIQUE INDEX IF NOT EXISTS idx_campaigns_slug ON campaigns(slug);

-- Copy data from old columns to new ones if they exist
UPDATE campaigns SET 
  story = description,
  main_image_url = featured_image_url
WHERE story IS NULL OR main_image_url IS NULL;

-- Update category references - match category names to IDs
UPDATE campaigns SET category_id = (
  SELECT c.id FROM categories c 
  WHERE LOWER(c.name) = LOWER(campaigns.category) 
  LIMIT 1
) WHERE category_id IS NULL;

-- Set a default category for any campaigns without a valid category
UPDATE campaigns SET category_id = (
  SELECT id FROM categories ORDER BY order_index LIMIT 1
) WHERE category_id IS NULL;

-- Make the new columns required after data migration
-- Note: You might want to run these separately after verifying data migration
-- ALTER TABLE campaigns ALTER COLUMN category_id SET NOT NULL;
-- ALTER TABLE campaigns ALTER COLUMN story SET NOT NULL;
-- ALTER TABLE campaigns ALTER COLUMN main_image_url SET NOT NULL;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_campaigns_category_id ON campaigns(category_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_urgency_level ON campaigns(urgency_level);

-- ============================================================================
-- Update Campaign Details Table Schema
-- ============================================================================

-- Add missing column needed by the form
ALTER TABLE campaign_details 
ADD COLUMN IF NOT EXISTS support_documents TEXT[] DEFAULT '{}';

-- Copy data from old column to new one if it exists
UPDATE campaign_details SET 
  support_documents = support_documents_urls
WHERE support_documents IS NULL AND support_documents_urls IS NOT NULL;

-- Note: The form expects 'gallery_images' and 'support_documents' columns
-- The existing 'gallery_images' column should work as is
-- We added 'support_documents' above

-- Optional: Drop old columns after migration (run these manually when ready)
-- ALTER TABLE campaign_details DROP COLUMN IF EXISTS support_documents_urls;

-- ============================================================================
-- Optional: Drop old columns after migration (run these manually when ready)
-- ============================================================================
-- ALTER TABLE campaigns DROP COLUMN IF EXISTS category;
-- ALTER TABLE campaigns DROP COLUMN IF EXISTS description; 
-- ALTER TABLE campaigns DROP COLUMN IF EXISTS featured_image_url;
