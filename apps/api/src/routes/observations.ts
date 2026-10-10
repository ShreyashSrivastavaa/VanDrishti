import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import fs from 'fs';
import path from 'path';
import { query } from '../db/client.js';

const router = Router();

// Rate limiter for sampling endpoint
const sampleLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Density sampling rate limit exceeded. Please wait a moment before sending more requests.',
    },
  },
});

// GET /aois/:slug/observations
router.get('/aois/:slug/observations', async (req: Request, res: Response, next) => {
  try {
    const { slug } = req.params;
    const usableOnly = req.query.usable === 'true';
    const fromDate = req.query.from as string;
    const toDate = req.query.to as string;

    let sql = `
      SELECT 
        o.id,
        o.aoi_id AS "aoiId",
        o.kind,
        to_char(o.acquired_at, 'YYYY-MM-DD') AS "acquiredAt",
        to_char(o.window_start, 'YYYY-MM-DD') AS "windowStart",
        to_char(o.window_end, 'YYYY-MM-DD') AS "windowEnd",
        o.valid_fraction AS "validFraction",
        o.cloud_fraction AS "cloudFraction",
        o.usable,
        o.unusable_reason AS "unusableReason",
        o.scene_ids AS "sceneIds",
        o.bands_uri AS "bandsUri",
        o.preview_uri AS "previewUri",
        o.preview_bounds AS "previewBounds",
        o.provenance,
        o.status,
        fm.forest_area_ha AS "forestAreaHa",
        fm.forest_fraction AS "forestFraction",
        fm.overlay_uri AS "forestOverlayUri",
        CASE WHEN fm.overlay_uri IS NOT NULL THEN REPLACE(fm.overlay_uri, 'forest_mask.png', 'density_overlay.png') ELSE NULL END AS "densityOverlayUri",
        CASE WHEN fm.overlay_uri IS NOT NULL THEN REPLACE(fm.overlay_uri, 'forest_mask.png', 'density.tif') ELSE NULL END AS "densityCogUri",
        mv.name AS "modelName",
        mv.status AS "modelStatus"
      FROM observations o
      JOIN aois a ON o.aoi_id = a.id
      LEFT JOIN forest_masks fm ON o.id = fm.observation_id
      LEFT JOIN model_versions mv ON fm.model_version_id = mv.id
      WHERE a.slug = $1
    `;

    const params: any[] = [slug];
    let paramIndex = 2;

    if (usableOnly) {
      sql += ` AND o.usable = true`;
    }
    if (fromDate) {
      sql += ` AND o.acquired_at >= $${paramIndex++}`;
      params.push(fromDate);
    }
    if (toDate) {
      sql += ` AND o.acquired_at <= $${paramIndex++}`;
      params.push(toDate);
    }

    sql += ` ORDER BY o.acquired_at ASC;`;

    const { rows } = await query(sql, params);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// GET /observations/:id
router.get('/observations/:id', async (req: Request, res: Response, next) => {
  try {
    const { id } = req.params;
    const { rows } = await query(`
      SELECT 
        o.id,
        o.aoi_id AS "aoiId",
        o.kind,
        to_char(o.acquired_at, 'YYYY-MM-DD') AS "acquiredAt",
        o.valid_fraction AS "validFraction",
        o.cloud_fraction AS "cloudFraction",
        o.usable,
        o.unusable_reason AS "unusableReason",
        o.scene_ids AS "sceneIds",
        o.preview_uri AS "previewUri",
        o.preview_bounds AS "previewBounds",
        o.provenance,
        o.status,
        fm.forest_area_ha AS "forestAreaHa",
        fm.forest_fraction AS "forestFraction",
        fm.overlay_uri AS "forestOverlayUri",
        COALESCE(
          fm.density_overlay_uri,
          CASE WHEN fm.overlay_uri IS NOT NULL THEN REPLACE(fm.overlay_uri, 'forest_mask.png', 'density_overlay.png') ELSE NULL END
        ) AS "densityOverlayUri",
        COALESCE(
          fm.density_cog_uri,
          CASE WHEN fm.overlay_uri IS NOT NULL THEN REPLACE(fm.overlay_uri, 'forest_mask.png', 'density.tif') ELSE NULL END
        ) AS "densityCogUri",
        mv.name AS "modelName",
        mv.version AS "modelVersion",
        mv.status AS "modelStatus"
      FROM observations o
      LEFT JOIN forest_masks fm ON o.id = fm.observation_id
      LEFT JOIN model_versions mv ON fm.model_version_id = mv.id
      WHERE o.id = $1;
    `, [id]);

    if (rows.length === 0) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: `Observation with id '${id}' not found` }
      });
    }

    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// GET /observations/:id/sample - Samples density % at lat/lon from the stored density raster
router.get('/observations/:id/sample', sampleLimiter, async (req: Request, res: Response, next) => {
  try {
    const { id } = req.params;
    const lat = parseFloat(req.query.lat as string);
    const lon = parseFloat(req.query.lon as string);

    if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      return res.status(400).json({
        error: { code: 'INVALID_COORDINATES', message: 'Valid lat (-90..90) and lon (-180..180) are required.' }
      });
    }

    const { rows } = await query(`
      SELECT 
        o.id,
        to_char(o.acquired_at, 'YYYY-MM-DD') AS "acquiredAt",
        o.preview_bounds AS "previewBounds",
        a.slug AS "aoiSlug",
        a.bbox,
        mv.name AS "modelName",
        mv.status AS "modelStatus"
      FROM observations o
      JOIN aois a ON o.aoi_id = a.id
      LEFT JOIN forest_masks fm ON o.id = fm.observation_id
      LEFT JOIN model_versions mv ON fm.model_version_id = mv.id
      WHERE o.id = $1;
    `, [id]);

    if (rows.length === 0) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: `Observation with id '${id}' not found` }
      });
    }

    const obs = rows[0];
    const bbox = obs.bbox || [
      obs.previewBounds[0][0],
      obs.previewBounds[2][1],
      obs.previewBounds[1][0],
      obs.previewBounds[0][1],
    ];
    const [minLon, minLat, maxLon, maxLat] = bbox;

    if (lon < minLon || lon > maxLon || lat < minLat || lat > maxLat) {
      return res.json({
        lat,
        lon,
        density: null,
        isCloudOrNodata: true,
        acquiredAt: obs.acquiredAt,
        modelName: obs.modelName || 'spectral_baseline',
        modelStatus: obs.modelStatus || 'baseline',
        message: 'Point is outside observation bounds.'
      });
    }

    const artifactDir = path.resolve(process.cwd(), process.env.ARTIFACT_LOCAL_DIR || './data/artifacts');
    let rawPath = path.join(artifactDir, 'observations', obs.aoiSlug, obs.acquiredAt, 'density.raw');
    if (!fs.existsSync(rawPath)) {
      rawPath = path.resolve(process.cwd(), '../../data/artifacts/observations', obs.aoiSlug, obs.acquiredAt, 'density.raw');
    }

    let density: number | null = null;
    let isCloudOrNodata = false;

    if (fs.existsSync(rawPath)) {
      const buffer = fs.readFileSync(rawPath);
      if (buffer.length >= 8) {
        const width = buffer.readUInt32BE(0);
        const height = buffer.readUInt32BE(4);
        const x = Math.min(width - 1, Math.max(0, Math.floor(((lon - minLon) / (maxLon - minLon)) * width)));
        const y = Math.min(height - 1, Math.max(0, Math.floor(((maxLat - lat) / (maxLat - minLat)) * height)));
        const val = buffer.readUInt8(8 + (y * width + x));
        if (val === 255) {
          density = null;
          isCloudOrNodata = true;
        } else {
          density = val;
          isCloudOrNodata = false;
        }
      }
    } else {
      density = null;
      isCloudOrNodata = true;
    }

    return res.json({
      lat,
      lon,
      density,
      isCloudOrNodata,
      acquiredAt: obs.acquiredAt,
      modelName: obs.modelName || 'spectral_baseline',
      modelStatus: obs.modelStatus || 'baseline',
    });
  } catch (err) {
    next(err);
  }
});

export default router;
