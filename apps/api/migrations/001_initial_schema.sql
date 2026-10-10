-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. AOIs (Areas of Interest)
CREATE TABLE IF NOT EXISTS aois (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    country_code VARCHAR(3) NOT NULL,
    country_name TEXT,
    biome TEXT,
    geom GEOMETRY(MultiPolygon, 4326) NOT NULL,
    bbox JSONB NOT NULL,
    area_km2 NUMERIC(10, 2) NOT NULL,
    kind VARCHAR(20) NOT NULL DEFAULT 'curated' CHECK (kind IN ('curated', 'user')),
    is_demo BOOLEAN NOT NULL DEFAULT FALSE,
    created_by_ip_hash TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS aois_geom_gist ON aois USING GIST (geom);
CREATE INDEX IF NOT EXISTS aois_slug_idx ON aois (slug);

-- 2. Scenes
CREATE TABLE IF NOT EXISTS scenes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider TEXT NOT NULL,
    provider_scene_id TEXT NOT NULL,
    datetime TIMESTAMPTZ NOT NULL,
    tile_id TEXT,
    platform TEXT,
    cloud_cover_scene NUMERIC(5, 2),
    footprint GEOMETRY(Polygon, 4326),
    assets JSONB DEFAULT '{}'::jsonb,
    processing_baseline TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_scenes_provider_id UNIQUE (provider, provider_scene_id)
);

CREATE INDEX IF NOT EXISTS scenes_footprint_gist ON scenes USING GIST (footprint);

-- 3. Observations
CREATE TABLE IF NOT EXISTS observations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aoi_id UUID NOT NULL REFERENCES aois(id) ON DELETE CASCADE,
    kind VARCHAR(20) NOT NULL DEFAULT 'scene' CHECK (kind IN ('scene', 'composite')),
    acquired_at DATE NOT NULL,
    window_start DATE,
    window_end DATE,
    valid_fraction NUMERIC(5, 4) NOT NULL,
    cloud_fraction NUMERIC(5, 4) NOT NULL,
    usable BOOLEAN NOT NULL DEFAULT TRUE,
    unusable_reason TEXT,
    scene_ids TEXT[] DEFAULT ARRAY[]::TEXT[],
    bands_uri TEXT,
    preview_uri TEXT,
    preview_bounds JSONB,
    provenance JSONB DEFAULT '{}'::jsonb,
    status VARCHAR(20) NOT NULL DEFAULT 'ready' CHECK (status IN ('pending', 'processing', 'ready', 'failed')),
    error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_obs_aoi_kind_dates 
ON observations (aoi_id, kind, acquired_at, COALESCE(window_start, '1970-01-01'::DATE));

CREATE INDEX IF NOT EXISTS obs_aoi_acquired_idx ON observations (aoi_id, acquired_at);

-- 4. Model Versions
CREATE TABLE IF NOT EXISTS model_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    version TEXT NOT NULL,
    arch TEXT NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('reference', 'baseline', 'prototype', 'validated')),
    weights_uri TEXT,
    config JSONB DEFAULT '{}'::jsonb,
    train_regions JSONB DEFAULT '[]'::jsonb,
    metrics JSONB,
    ece NUMERIC(6, 5),
    git_sha TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_model_name_version UNIQUE (name, version)
);

-- 5. Forest Masks
CREATE TABLE IF NOT EXISTS forest_masks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    observation_id UUID NOT NULL REFERENCES observations(id) ON DELETE CASCADE,
    model_version_id UUID NOT NULL REFERENCES model_versions(id) ON DELETE CASCADE,
    forest_area_ha NUMERIC(12, 2) NOT NULL,
    forest_fraction NUMERIC(5, 4) NOT NULL,
    mean_confidence NUMERIC(5, 4) NOT NULL,
    valid_fraction NUMERIC(5, 4) NOT NULL,
    prob_uri TEXT,
    mask_uri TEXT,
    overlay_uri TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_forest_mask_obs_model UNIQUE (observation_id, model_version_id)
);

-- 6. Analyses
CREATE TABLE IF NOT EXISTS analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aoi_id UUID NOT NULL REFERENCES aois(id) ON DELETE CASCADE,
    obs_t0 UUID NOT NULL REFERENCES observations(id) ON DELETE CASCADE,
    obs_t1 UUID NOT NULL REFERENCES observations(id) ON DELETE CASCADE,
    model_version_id UUID NOT NULL REFERENCES model_versions(id) ON DELETE CASCADE,
    params JSONB NOT NULL DEFAULT '{}'::jsonb,
    params_hash TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'ready', 'failed')),
    error TEXT,
    total_loss_ha NUMERIC(12, 2),
    detection_count INTEGER,
    warnings TEXT[] DEFAULT ARRAY[]::TEXT[],
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMPTZ,
    CONSTRAINT uq_analysis_unique_pair UNIQUE (aoi_id, obs_t0, obs_t1, model_version_id, params_hash)
);

CREATE INDEX IF NOT EXISTS analyses_aoi_idx ON analyses (aoi_id);

-- 7. Detections
CREATE TABLE IF NOT EXISTS detections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    analysis_id UUID NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
    geom GEOMETRY(MultiPolygon, 4326) NOT NULL,
    centroid GEOMETRY(Point, 4326) NOT NULL,
    area_ha NUMERIC(10, 2) NOT NULL,
    mean_p_loss NUMERIC(5, 4) NOT NULL,
    mean_ndvi_drop NUMERIC(5, 4) NOT NULL,
    valid_fraction_t0 NUMERIC(5, 4) NOT NULL,
    valid_fraction_t1 NUMERIC(5, 4) NOT NULL,
    confirmed_persistent BOOLEAN,
    confidence_score NUMERIC(5, 4) NOT NULL,
    confidence_class VARCHAR(10) NOT NULL CHECK (confidence_class IN ('low', 'medium', 'high')),
    is_calibrated_confidence BOOLEAN NOT NULL DEFAULT FALSE,
    explanation TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS detections_geom_gist ON detections USING GIST (geom);
CREATE INDEX IF NOT EXISTS detections_centroid_gist ON detections USING GIST (centroid);
CREATE INDEX IF NOT EXISTS detections_analysis_id_idx ON detections (analysis_id);

-- 8. Analysis Validation
CREATE TABLE IF NOT EXISTS analysis_validation (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    analysis_id UUID NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
    dataset TEXT NOT NULL,
    dataset_version TEXT,
    metrics JSONB NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. Jobs
CREATE TABLE IF NOT EXISTS jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(40) NOT NULL CHECK (type IN ('ingest_observations', 'compute_forest_mask', 'run_change_analysis')),
    payload JSONB NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 3,
    locked_by TEXT,
    locked_at TIMESTAMPTZ,
    run_after TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    error TEXT,
    result JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS jobs_status_run_after_idx ON jobs (status, run_after) WHERE status = 'queued';

-- 10. Dataset Sources
CREATE TABLE IF NOT EXISTS dataset_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    version TEXT,
    licence TEXT NOT NULL,
    attribution TEXT NOT NULL,
    url TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. Materialized View for AOI Timeseries
CREATE OR REPLACE VIEW aoi_timeseries AS
SELECT 
    o.aoi_id,
    o.acquired_at,
    o.kind AS observation_kind,
    o.usable,
    fm.forest_area_ha,
    fm.forest_fraction,
    mv.status AS model_status,
    mv.version AS model_version
FROM observations o
JOIN forest_masks fm ON o.id = fm.observation_id
JOIN model_versions mv ON fm.model_version_id = mv.id
ORDER BY o.aoi_id, o.acquired_at ASC;
