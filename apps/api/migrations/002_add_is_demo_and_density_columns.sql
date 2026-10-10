-- 002_add_is_demo_and_density_columns.sql
-- Add is_demo tracking and density columns to observations, forest_masks, analyses, and detections

ALTER TABLE observations ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE analyses ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE detections ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE forest_masks ADD COLUMN IF NOT EXISTS density_overlay_uri TEXT;
ALTER TABLE forest_masks ADD COLUMN IF NOT EXISTS density_cog_uri TEXT;

-- Flag existing synthetic rows as DEMO
UPDATE observations 
SET is_demo = TRUE 
WHERE scene_ids::text LIKE '%S2_%' 
   OR provenance->>'collection' = 'sentinel-2-l2a' AND array_to_string(scene_ids, ',') LIKE '%S2_%';

UPDATE analyses 
SET is_demo = TRUE 
WHERE obs_t0 IN (SELECT id FROM observations WHERE is_demo = TRUE) 
   OR obs_t1 IN (SELECT id FROM observations WHERE is_demo = TRUE);

UPDATE detections 
SET is_demo = TRUE 
WHERE analysis_id IN (SELECT id FROM analyses WHERE is_demo = TRUE);
