import fs from 'fs';
import path from 'path';
import yaml from 'yaml';
import { pool } from './client.js';

interface AoiConfig {
  slug: string;
  name: string;
  country_code: string;
  country_name: string;
  biome: string;
  area_km2: number;
  bbox: [number, number, number, number];
  rationale: string;
}

export async function seedDatabase() {
  console.log('Seeding initial datasets, models, and curated AOIs...');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Seed Dataset Sources
    const datasetSources = [
      {
        key: 'copernicus_sentinel2',
        name: 'Copernicus Sentinel-2 Level-2A',
        version: 'MSI L2A BOA',
        licence: 'Copernicus Open Access / EU Regulation No 1159/2013',
        attribution: 'Contains modified Copernicus Sentinel data [2020-2024]',
        url: 'https://sentinels.copernicus.eu/web/sentinel/missions/sentinel-2',
        description: 'Multi-spectral optical surface reflectance imagery at 10m and 20m spatial resolution.'
      },
      {
        key: 'esa_worldcover',
        name: 'ESA WorldCover 10 m',
        version: 'v200 (2021)',
        licence: 'Creative Commons Attribution 4.0 International (CC BY 4.0)',
        attribution: '© ESA WorldCover project 2021 / Contains modified Copernicus Sentinel data',
        url: 'https://esa-worldcover.org',
        description: 'Global 10m land cover map featuring tree cover classification.'
      },
      {
        key: 'hansen_gfc',
        name: 'Hansen Global Forest Change (UMD/GLAD)',
        version: 'GFC-2023-v1.11',
        licence: 'Creative Commons Attribution 4.0 International (CC BY 4.0)',
        attribution: 'Hansen, Potapov, Moore, Hancher et al. (University of Maryland / Google / USGS / NASA)',
        url: 'https://earthenginepartners.appspot.com/science-2013-global-forest-change',
        description: 'Global 30m resolution multi-year forest loss observations.'
      },
      {
        key: 'osm_nominatim',
        name: 'OpenStreetMap Nominatim',
        version: 'Current',
        licence: 'Open Database License (ODbL)',
        attribution: '© OpenStreetMap contributors',
        url: 'https://nominatim.openstreetmap.org',
        description: 'Geographic place search and geocoding services.'
      },
      {
        key: 'openfreemap',
        name: 'OpenFreeMap Positron',
        version: 'v1.0',
        licence: 'OpenStreetMap data under ODbL; open-source cartographic styling',
        attribution: 'Map data © OpenStreetMap contributors, rendered via OpenFreeMap',
        url: 'https://openfreemap.org',
        description: 'Keyless vector tile basemap service for GIS applications.'
      }
    ];

    for (const ds of datasetSources) {
      await client.query(`
        INSERT INTO dataset_sources (key, name, version, licence, attribution, url, description)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (key) DO UPDATE SET
          name = EXCLUDED.name,
          version = EXCLUDED.version,
          licence = EXCLUDED.licence,
          attribution = EXCLUDED.attribution,
          url = EXCLUDED.url,
          description = EXCLUDED.description;
      `, [ds.key, ds.name, ds.version, ds.licence, ds.attribution, ds.url, ds.description]);
    }
    console.log(`Seeded ${datasetSources.length} dataset sources.`);

    // 2. Seed Initial Model Versions (Truthful registry)
    const initialModels = [
      {
        name: 'esa_worldcover_ref',
        version: '2021.1',
        arch: 'reference',
        status: 'reference',
        config: { source: 'ESA WorldCover 10m Class 10 (Tree Cover)' },
        metrics: null,
        ece: null,
        git_sha: null,
      },
      {
        name: 'spectral_baseline',
        version: '1.0.0',
        arch: 'spectral_rule_based',
        status: 'baseline',
        config: {
          indices: ['NDVI', 'NBR', 'SWIR'],
          t_high: 0.70,
          t_low: 0.30,
          min_ndvi_drop: 0.15,
          min_mapping_unit_ha: 0.50
        },
        metrics: {
          note: 'Rule-based spectral baseline calibrated against WorldCover on training blocks'
        },
        ece: null,
        git_sha: null,
      },
      {
        name: 'unet_resnet34',
        version: '0.1.0',
        arch: 'unet',
        status: 'prototype',
        config: {
          encoder: 'resnet34',
          in_channels: 8,
          bands: ['B02', 'B03', 'B04', 'B08', 'B11', 'B12', 'NDVI', 'NBR'],
          chip_size: 256
        },
        metrics: null,
        ece: null,
        git_sha: null,
      }
    ];

    for (const model of initialModels) {
      await client.query(`
        INSERT INTO model_versions (name, version, arch, status, config, metrics, ece, git_sha)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (name, version) DO UPDATE SET
          arch = EXCLUDED.arch,
          status = EXCLUDED.status,
          config = EXCLUDED.config;
      `, [
        model.name,
        model.version,
        model.arch,
        model.status,
        JSON.stringify(model.config),
        model.metrics ? JSON.stringify(model.metrics) : null,
        model.ece,
        model.git_sha
      ]);
    }
    console.log(`Seeded ${initialModels.length} model registry entries.`);

    // 3. Seed Curated AOIs from config/aois.yaml
    let aoisYamlPath = path.resolve(process.cwd(), 'config/aois.yaml');
    if (!fs.existsSync(aoisYamlPath)) {
      aoisYamlPath = path.resolve(process.cwd(), '../../config/aois.yaml');
    }
    if (!fs.existsSync(aoisYamlPath)) {
      throw new Error(`AOI config not found at: ${aoisYamlPath}`);
    }

    const aoisConfig = yaml.parse(fs.readFileSync(aoisYamlPath, 'utf-8')) as { aois: AoiConfig[] };
    for (const aoi of aoisConfig.aois) {
      const [minLon, minLat, maxLon, maxLat] = aoi.bbox;
      await client.query(`
        INSERT INTO aois (
          slug, name, description, country_code, country_name, biome,
          geom, bbox, area_km2, kind, is_demo
        )
        VALUES (
          $1, $2, $3, $4, $5, $6,
          ST_Multi(ST_SetSRID(ST_MakeEnvelope($7, $8, $9, $10), 4326)),
          $11, $12, 'curated', FALSE
        )
        ON CONFLICT (slug) DO UPDATE SET
          name = EXCLUDED.name,
          description = EXCLUDED.description,
          country_code = EXCLUDED.country_code,
          country_name = EXCLUDED.country_name,
          biome = EXCLUDED.biome,
          geom = EXCLUDED.geom,
          bbox = EXCLUDED.bbox,
          area_km2 = EXCLUDED.area_km2;
      `, [
        aoi.slug,
        aoi.name,
        aoi.rationale,
        aoi.country_code,
        aoi.country_name,
        aoi.biome,
        minLon, minLat, maxLon, maxLat,
        JSON.stringify(aoi.bbox),
        aoi.area_km2
      ]);
    }
    console.log(`Seeded ${aoisConfig.aois.length} curated AOIs from config/aois.yaml.`);

    await client.query('COMMIT');
    console.log('Database seeding completed successfully without fake detections.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seeding failed:', err);
    throw err;
  } finally {
    client.release();
  }
}

if (process.argv[1] && process.argv[1].includes('seed')) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
