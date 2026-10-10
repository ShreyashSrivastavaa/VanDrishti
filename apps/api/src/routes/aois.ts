import { Router, Request, Response } from 'express';
import { query } from '../db/client.js';
import crypto from 'crypto';

const router = Router();

// GET /aois - list all AOIs with summary counts
router.get('/', async (req: Request, res: Response, next) => {
  try {
    const { rows } = await query(`
      SELECT 
        a.id,
        a.slug,
        a.name,
        a.description,
        a.country_code AS "countryCode",
        a.country_name AS "countryName",
        a.biome,
        a.bbox,
        a.area_km2::float AS "areaKm2",
        a.kind,
        a.is_demo AS "isDemo",
        a.created_at AS "createdAt",
        ST_AsGeoJSON(a.geom)::json AS geojson,
        (
          SELECT acquired_at 
          FROM observations 
          WHERE aoi_id = a.id AND usable = true 
          ORDER BY acquired_at DESC 
          LIMIT 1
        ) AS "latestObservationDate",
        (
          SELECT count(*)::int 
          FROM observations 
          WHERE aoi_id = a.id
        ) AS "observationCount",
        (
          SELECT count(*)::int 
          FROM analyses 
          WHERE aoi_id = a.id AND status = 'ready'
        ) AS "analysisCount",
        (
          SELECT COALESCE(SUM(total_loss_ha), 0)::numeric(12, 2)
          FROM analyses
          WHERE aoi_id = a.id AND status = 'ready'
        ) AS "totalLossHa"
      FROM aois a
      ORDER BY a.name ASC;
    `);

    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// GET /aois/:slug - single AOI detail
router.get('/:slug', async (req: Request, res: Response, next) => {
  try {
    const { slug } = req.params;
    const { rows } = await query(`
      SELECT 
        a.id,
        a.slug,
        a.name,
        a.description,
        a.country_code AS "countryCode",
        a.country_name AS "countryName",
        a.biome,
        a.bbox,
        a.area_km2::float AS "areaKm2",
        a.kind,
        a.is_demo AS "isDemo",
        a.created_at AS "createdAt",
        ST_AsGeoJSON(a.geom)::json AS geojson,
        (
          SELECT acquired_at 
          FROM observations 
          WHERE aoi_id = a.id AND usable = true 
          ORDER BY acquired_at DESC 
          LIMIT 1
        ) AS "latestObservationDate",
        (
          SELECT count(*)::int 
          FROM observations 
          WHERE aoi_id = a.id
        ) AS "observationCount",
        (
          SELECT count(*)::int 
          FROM analyses 
          WHERE aoi_id = a.id AND status = 'ready'
        ) AS "analysisCount"
      FROM aois a
      WHERE a.slug = $1;
    `, [slug]);

    if (rows.length === 0) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: `AOI with slug '${slug}' not found` }
      });
    }

    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// GET /aois/:slug/timeseries - history time series
router.get('/:slug/timeseries', async (req: Request, res: Response, next) => {
  try {
    const { slug } = req.params;
    const { rows } = await query(`
      SELECT 
        t.acquired_at AS "acquiredAt",
        t.forest_area_ha AS "forestAreaHa",
        t.forest_fraction AS "forestFraction",
        t.usable,
        t.model_status AS "modelStatus",
        t.model_version AS "modelVersion",
        t.observation_kind AS "observationKind"
      FROM aoi_timeseries t
      JOIN aois a ON t.aoi_id = a.id
      WHERE a.slug = $1
      ORDER BY t.acquired_at ASC;
    `, [slug]);

    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// POST /aois - user AOI creation (feature-flagged)
router.post('/', async (req: Request, res: Response, next) => {
  try {
    if (process.env.ENABLE_USER_ANALYSIS !== 'true') {
      return res.status(403).json({
        error: {
          code: 'FEATURE_DISABLED',
          message: 'User-drawn AOI analysis is currently disabled by administrator configuration.'
        }
      });
    }

    const { name, geojson } = req.body;
    if (!name || !geojson) {
      return res.status(400).json({
        error: { code: 'BAD_REQUEST', message: 'Name and GeoJSON polygon are required.' }
      });
    }

    // IP Rate check
    const salt = process.env.IP_HASH_SALT || 'salt';
    const clientIp = (req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || 'unknown');
    const ipHash = crypto.createHash('sha256').update(clientIp + salt).digest('hex');

    const maxKm2 = parseFloat(process.env.MAX_USER_AOI_KM2 || '100');

    // Calculate area and validate geometry with PostGIS
    const geojsonStr = JSON.stringify(geojson);
    const { rows: valRows } = await query(`
      SELECT 
        ST_IsValid(ST_GeomFromGeoJSON($1)) as is_valid,
        ROUND((ST_Area(ST_GeomFromGeoJSON($1)::geography) / 1000000.0)::numeric, 2) as area_km2
    `, [geojsonStr]);

    if (!valRows[0]?.is_valid) {
      return res.status(400).json({
        error: { code: 'INVALID_GEOMETRY', message: 'Submitted polygon is self-intersecting or invalid.' }
      });
    }

    const areaKm2 = parseFloat(valRows[0].area_km2);
    if (areaKm2 > maxKm2) {
      return res.status(400).json({
        error: {
          code: 'AOI_TOO_LARGE',
          message: `AOI area (${areaKm2} km²) exceeds maximum allowed user size of ${maxKm2} km².`
        }
      });
    }

    const slug = `user-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const { rows: aoiRows } = await query(`
      INSERT INTO aois (
        slug, name, country_code, geom, bbox, area_km2, kind, is_demo, created_by_ip_hash
      )
      VALUES (
        $1, $2, 'USR',
        ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON($3), 4326)),
        (SELECT json_build_array(ST_XMin(geom), ST_YMin(geom), ST_XMax(geom), ST_YMax(geom)) FROM (SELECT ST_GeomFromGeoJSON($3) as geom) sub),
        $4, 'user', FALSE, $5
      )
      RETURNING id, slug, name, area_km2 AS "areaKm2", created_at AS "createdAt"
    `, [slug, name, geojsonStr, areaKm2, ipHash]);

    res.status(201).json(aoiRows[0]);
  } catch (err) {
    next(err);
  }
});

export default router;
