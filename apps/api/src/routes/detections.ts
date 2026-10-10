import { Router, Request, Response } from 'express';
import { query } from '../db/client.js';
import { resolveArtifactUrl } from './observations.js';

const router = Router();

// GET /detections/:id
router.get('/:id', async (req: Request, res: Response, next) => {
  try {
    const { id } = req.params;
    const { rows } = await query(`
      SELECT 
        d.id,
        d.analysis_id AS "analysisId",
        d.area_ha AS "areaHa",
        d.mean_p_loss AS "meanPLoss",
        d.mean_ndvi_drop AS "meanNdviDrop",
        d.valid_fraction_t0 AS "validFractionT0",
        d.valid_fraction_t1 AS "validFractionT1",
        d.confirmed_persistent AS "confirmedPersistent",
        d.confidence_score AS "confidenceScore",
        d.confidence_class AS "confidenceClass",
        d.is_calibrated_confidence AS "isCalibratedConfidence",
        d.explanation,
        COALESCE(d.is_demo, false) AS "isDemo",
        d.created_at AS "createdAt",
        ST_AsGeoJSON(d.geom)::json AS geometry,
        ST_AsGeoJSON(d.centroid)::json AS centroid,
        to_char(o0.acquired_at, 'YYYY-MM-DD') AS "dateT0",
        to_char(o1.acquired_at, 'YYYY-MM-DD') AS "dateT1",
        o0.preview_uri AS "previewUriT0",
        o1.preview_uri AS "previewUriT1",
        o0.scene_ids AS "sceneIdsT0",
        o1.scene_ids AS "sceneIdsT1",
        a.slug AS "aoiSlug",
        a.name AS "aoiName",
        mv.status AS "modelStatus",
        mv.name AS "modelName",
        mv.version AS "modelVersion"
      FROM detections d
      JOIN analyses an ON d.analysis_id = an.id
      JOIN aois a ON an.aoi_id = a.id
      JOIN observations o0 ON an.obs_t0 = o0.id
      JOIN observations o1 ON an.obs_t1 = o1.id
      JOIN model_versions mv ON an.model_version_id = mv.id
      WHERE d.id = $1;
    `, [id]);

    if (rows.length === 0) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: `Detection '${id}' not found` }
      });
    }

    const row = rows[0];
    res.json({
      ...row,
      previewUriT0: resolveArtifactUrl(row.previewUriT0),
      previewUriT1: resolveArtifactUrl(row.previewUriT1),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
