import { Router, Request, Response } from 'express';
import { query } from '../db/client.js';

const router = Router();

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
        fm.overlay_uri AS "forestOverlayUri"
      FROM observations o
      JOIN aois a ON o.aoi_id = a.id
      LEFT JOIN forest_masks fm ON o.id = fm.observation_id
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

export default router;
