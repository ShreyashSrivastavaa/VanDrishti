import { Router, Request, Response } from 'express';
import { query } from '../db/client.js';
import { enqueueJob } from '../services/queueService.js';
import crypto from 'crypto';

const router = Router();

// GET /aois/:slug/analyses - list existing analyses for an AOI
router.get('/aois/:slug/analyses', async (req: Request, res: Response, next) => {
  try {
    const { slug } = req.params;
    const { rows } = await query(`
      SELECT 
        an.id,
        an.aoi_id AS "aoiId",
        an.obs_t0 AS "obsT0Id",
        an.obs_t1 AS "obsT1Id",
        an.model_version_id AS "modelVersionId",
        an.status,
        an.total_loss_ha AS "totalLossHa",
        an.detection_count AS "detectionCount",
        an.warnings,
        an.created_at AS "createdAt",
        an.finished_at AS "finishedAt",
        to_char(o0.acquired_at, 'YYYY-MM-DD') AS "dateT0",
        to_char(o1.acquired_at, 'YYYY-MM-DD') AS "dateT1",
        mv.name AS "modelName",
        mv.version AS "modelVersion",
        mv.status AS "modelStatus"
      FROM analyses an
      JOIN aois a ON an.aoi_id = a.id
      JOIN observations o0 ON an.obs_t0 = o0.id
      JOIN observations o1 ON an.obs_t1 = o1.id
      JOIN model_versions mv ON an.model_version_id = mv.id
      WHERE a.slug = $1
      ORDER BY an.created_at DESC;
    `, [slug]);

    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// POST /aois/:slug/analyses - request analysis
router.post('/aois/:slug/analyses', async (req: Request, res: Response, next) => {
  try {
    const { slug } = req.params;
    const { t0, t1, modelVersionId, params } = req.body;

    if (!t0 || !t1) {
      return res.status(400).json({
        error: { code: 'BAD_REQUEST', message: 'Both t0 and t1 observation IDs are required.' }
      });
    }

    if (t0 === t1) {
      return res.status(400).json({
        error: { code: 'INVALID_PAIR', message: 'Observation t0 and t1 must be distinct observation dates.' }
      });
    }

    // Lookup AOI
    const { rows: aoiRows } = await query(`SELECT id FROM aois WHERE slug = $1`, [slug]);
    if (aoiRows.length === 0) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: `AOI '${slug}' not found` }
      });
    }
    const aoiId = aoiRows[0].id;

    // Verify observations belong to this AOI
    const { rows: obsRows } = await query(`
      SELECT id, acquired_at, usable FROM observations 
      WHERE id IN ($1, $2) AND aoi_id = $3
    `, [t0, t1, aoiId]);

    if (obsRows.length < 2) {
      return res.status(400).json({
        error: { code: 'INVALID_OBSERVATIONS', message: 'Specified observations do not belong to this AOI.' }
      });
    }

    // Ensure earlier observation is t0
    const [obsA, obsB] = obsRows;
    let obsT0Id = t0;
    let obsT1Id = t1;
    if (new Date(obsA.acquired_at) > new Date(obsB.acquired_at)) {
      if (obsA.id === t0) {
        obsT0Id = obsB.id;
        obsT1Id = obsA.id;
      }
    }

    // Active model version if not specified
    let targetModelId = modelVersionId;
    if (!targetModelId) {
      const activeName = process.env.ACTIVE_MODEL_NAME || 'spectral_baseline';
      const { rows: modelRows } = await query(`
        SELECT id FROM model_versions WHERE name = $1 ORDER BY created_at DESC LIMIT 1
      `, [activeName]);
      if (modelRows.length > 0) {
        targetModelId = modelRows[0].id;
      } else {
        const { rows: fallbackModel } = await query(`SELECT id FROM model_versions LIMIT 1`);
        targetModelId = fallbackModel[0].id;
      }
    }

    const analysisParams = {
      tHigh: params?.tHigh ?? 0.70,
      tLow: params?.tLow ?? 0.30,
      minMappingUnitHa: params?.minMappingUnitHa ?? 0.50,
      minNdviDrop: params?.minNdviDrop ?? 0.15,
      minNbrDrop: params?.minNbrDrop ?? 0.10,
      seasonToleranceDays: params?.seasonToleranceDays ?? 45,
    };

    const paramsHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(analysisParams))
      .digest('hex')
      .substring(0, 16);

    // Check if existing analysis already computed
    const { rows: existingRows } = await query(`
      SELECT id, status, total_loss_ha AS "totalLossHa", detection_count AS "detectionCount"
      FROM analyses
      WHERE aoi_id = $1 AND obs_t0 = $2 AND obs_t1 = $3 AND model_version_id = $4 AND params_hash = $5
    `, [aoiId, obsT0Id, obsT1Id, targetModelId, paramsHash]);

    if (existingRows.length > 0) {
      return res.status(200).json(existingRows[0]);
    }

    // Insert new analysis record
    const { rows: newAnalysisRows } = await query(`
      INSERT INTO analyses (
        aoi_id, obs_t0, obs_t1, model_version_id, params, params_hash, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, 'queued')
      RETURNING id, status, created_at AS "createdAt"
    `, [aoiId, obsT0Id, obsT1Id, targetModelId, JSON.stringify(analysisParams), paramsHash]);

    const newAnalysisId = newAnalysisRows[0].id;

    // Enqueue background processing job
    await enqueueJob({
      type: 'run_change_analysis',
      payload: {
        analysis_id: newAnalysisId,
        aoi_id: aoiId,
        obs_t0: obsT0Id,
        obs_t1: obsT1Id,
        model_version_id: targetModelId,
        params: analysisParams,
      },
    });

    res.status(202).json({
      id: newAnalysisId,
      status: 'queued',
      message: 'Analysis job has been enqueued for processing.',
    });
  } catch (err) {
    next(err);
  }
});

// GET /analyses/:id
router.get('/analyses/:id', async (req: Request, res: Response, next) => {
  try {
    const { id } = req.params;
    const { rows } = await query(`
      SELECT 
        an.id,
        an.aoi_id AS "aoiId",
        an.obs_t0 AS "obsT0Id",
        an.obs_t1 AS "obsT1Id",
        an.model_version_id AS "modelVersionId",
        an.status,
        an.params,
        an.error,
        an.total_loss_ha AS "totalLossHa",
        an.detection_count AS "detectionCount",
        an.warnings,
        an.created_at AS "createdAt",
        an.finished_at AS "finishedAt",
        a.slug AS "aoiSlug",
        a.name AS "aoiName",
        a.country_code AS "countryCode",
        a.country_name AS "countryName",
        a.area_km2 AS "areaKm2",
        to_char(o0.acquired_at, 'YYYY-MM-DD') AS "dateT0",
        to_char(o1.acquired_at, 'YYYY-MM-DD') AS "dateT1",
        o0.preview_uri AS "previewUriT0",
        o1.preview_uri AS "previewUriT1",
        o0.preview_bounds AS "previewBoundsT0",
        o1.preview_bounds AS "previewBoundsT1",
        o0.provenance AS "provenanceT0",
        o1.provenance AS "provenanceT1",
        o0.valid_fraction AS "validFractionT0",
        o1.valid_fraction AS "validFractionT1",
        mv.name AS "modelName",
        mv.version AS "modelVersion",
        mv.status AS "modelStatus",
        mv.arch AS "modelArch",
        mv.metrics AS "modelMetrics"
      FROM analyses an
      JOIN aois a ON an.aoi_id = a.id
      JOIN observations o0 ON an.obs_t0 = o0.id
      JOIN observations o1 ON an.obs_t1 = o1.id
      JOIN model_versions mv ON an.model_version_id = mv.id
      WHERE an.id = $1;
    `, [id]);

    if (rows.length === 0) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: `Analysis '${id}' not found` }
      });
    }

    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// GET /analyses/:id/detections - GeoJSON FeatureCollection
router.get('/analyses/:id/detections', async (req: Request, res: Response, next) => {
  try {
    const { id } = req.params;
    const minArea = parseFloat(req.query.minAreaHa as string || '0');
    const confidence = req.query.confidenceClass as string;

    let sql = `
      SELECT 
        id,
        area_ha AS "areaHa",
        mean_p_loss AS "meanPLoss",
        mean_ndvi_drop AS "meanNdviDrop",
        valid_fraction_t0 AS "validFractionT0",
        valid_fraction_t1 AS "validFractionT1",
        confirmed_persistent AS "confirmedPersistent",
        confidence_score AS "confidenceScore",
        confidence_class AS "confidenceClass",
        is_calibrated_confidence AS "isCalibratedConfidence",
        explanation,
        ST_AsGeoJSON(geom)::json AS geometry,
        ST_AsGeoJSON(centroid)::json AS centroid_geo
      FROM detections
      WHERE analysis_id = $1
    `;

    const params: any[] = [id];
    let pIdx = 2;

    if (minArea > 0) {
      sql += ` AND area_ha >= $${pIdx++}`;
      params.push(minArea);
    }
    if (confidence) {
      sql += ` AND confidence_class = $${pIdx++}`;
      params.push(confidence);
    }

    sql += ` ORDER BY area_ha DESC;`;

    const { rows } = await query(sql, params);

    const featureCollection = {
      type: 'FeatureCollection',
      features: rows.map(r => ({
        type: 'Feature',
        id: r.id,
        geometry: r.geometry,
        properties: {
          id: r.id,
          areaHa: parseFloat(r.areaHa),
          meanPLoss: parseFloat(r.meanPLoss),
          meanNdviDrop: parseFloat(r.meanNdviDrop),
          validFractionT0: parseFloat(r.validFractionT0),
          validFractionT1: parseFloat(r.validFractionT1),
          confirmedPersistent: r.confirmedPersistent,
          confidenceScore: parseFloat(r.confidenceScore),
          confidenceClass: r.confidenceClass,
          isCalibratedConfidence: r.isCalibratedConfidence,
          explanation: r.explanation,
          centroid: r.centroid_geo?.coordinates || null,
        },
      })),
    };

    res.json(featureCollection);
  } catch (err) {
    next(err);
  }
});

// GET /analyses/:id/export.geojson - download GeoJSON with complete metadata
router.get('/analyses/:id/export.geojson', async (req: Request, res: Response, next) => {
  try {
    const { id } = req.params;

    const { rows: anRows } = await query(`
      SELECT 
        an.id, an.total_loss_ha, an.detection_count, an.warnings, an.created_at,
        to_char(o0.acquired_at, 'YYYY-MM-DD') AS date_t0,
        to_char(o1.acquired_at, 'YYYY-MM-DD') AS date_t1,
        a.name AS aoi_name, a.slug AS aoi_slug, a.country_code,
        mv.name AS model_name, mv.version AS model_version, mv.status AS model_status
      FROM analyses an
      JOIN aois a ON an.aoi_id = a.id
      JOIN observations o0 ON an.obs_t0 = o0.id
      JOIN observations o1 ON an.obs_t1 = o1.id
      JOIN model_versions mv ON an.model_version_id = mv.id
      WHERE an.id = $1;
    `, [id]);

    if (anRows.length === 0) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Analysis not found' } });
    }

    const analysis = anRows[0];
    const { rows: detRows } = await query(`
      SELECT 
        id, area_ha, mean_p_loss, mean_ndvi_drop, valid_fraction_t0, valid_fraction_t1,
        confirmed_persistent, confidence_score, confidence_class, is_calibrated_confidence,
        explanation, ST_AsGeoJSON(geom)::json AS geometry
      FROM detections
      WHERE analysis_id = $1
      ORDER BY area_ha DESC;
    `, [id]);

    const exportPayload = {
      type: 'FeatureCollection',
      properties: {
        analysisId: analysis.id,
        aoi: analysis.aoi_name,
        aoiSlug: analysis.aoi_slug,
        observationDateT0: analysis.date_t0,
        observationDateT1: analysis.date_t1,
        totalLossHa: parseFloat(analysis.total_loss_ha || 0),
        detectionCount: parseInt(analysis.detection_count || 0, 10),
        modelStatus: analysis.model_status,
        modelVersion: `${analysis.model_name}@${analysis.model_version}`,
        licence: 'Creative Commons Attribution 4.0 International (CC BY 4.0)',
        attribution: 'ForestWatch AI — Contains modified Copernicus Sentinel data [2020-2024]',
        languageDisciplineNotice: 'All detections represent suspected forest loss / spectral change and should not be construed as confirmed legal deforestation without ground validation.',
        generatedAt: new Date().toISOString(),
      },
      features: detRows.map(d => ({
        type: 'Feature',
        id: d.id,
        geometry: d.geometry,
        properties: {
          id: d.id,
          areaHa: parseFloat(d.area_ha),
          meanPLoss: parseFloat(d.mean_p_loss),
          meanNdviDrop: parseFloat(d.mean_ndvi_drop),
          validFractionT0: parseFloat(d.valid_fraction_t0),
          validFractionT1: parseFloat(d.valid_fraction_t1),
          confirmedPersistent: d.confirmed_persistent,
          confidenceScore: parseFloat(d.confidence_score),
          confidenceClass: d.confidence_class,
          isCalibratedConfidence: d.is_calibrated_confidence,
          explanation: d.explanation,
        },
      })),
    };

    res.setHeader('Content-Type', 'application/geo+json');
    res.setHeader('Content-Disposition', `attachment; filename="forestwatch-${analysis.aoi_slug}-${analysis.date_t0}_${analysis.date_t1}.geojson"`);
    res.send(JSON.stringify(exportPayload, null, 2));
  } catch (err) {
    next(err);
  }
});

// GET /analyses/:id/report - printable audit report summary
router.get('/analyses/:id/report', async (req: Request, res: Response, next) => {
  try {
    const { id } = req.params;
    const { rows } = await query(`
      SELECT 
        an.id,
        an.total_loss_ha AS "totalLossHa",
        an.detection_count AS "detectionCount",
        an.warnings,
        an.params,
        an.created_at AS "createdAt",
        an.finished_at AS "finishedAt",
        a.slug AS "aoiSlug",
        a.name AS "aoiName",
        a.country_code AS "countryCode",
        a.country_name AS "countryName",
        a.biome,
        a.area_km2 AS "areaKm2",
        to_char(o0.acquired_at, 'YYYY-MM-DD') AS "dateT0",
        to_char(o1.acquired_at, 'YYYY-MM-DD') AS "dateT1",
        o0.valid_fraction AS "validFractionT0",
        o1.valid_fraction AS "validFractionT1",
        o0.preview_uri AS "previewUriT0",
        o1.preview_uri AS "previewUriT1",
        mv.name AS "modelName",
        mv.version AS "modelVersion",
        mv.status AS "modelStatus",
        mv.metrics AS "modelMetrics"
      FROM analyses an
      JOIN aois a ON an.aoi_id = a.id
      JOIN observations o0 ON an.obs_t0 = o0.id
      JOIN observations o1 ON an.obs_t1 = o1.id
      JOIN model_versions mv ON an.model_version_id = mv.id
      WHERE an.id = $1;
    `, [id]);

    if (rows.length === 0) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Analysis not found' } });
    }

    const analysis = rows[0];

    const { rows: detRows } = await query(`
      SELECT 
        id, area_ha AS "areaHa",
        confidence_class AS "confidenceClass",
        confidence_score AS "confidenceScore",
        mean_ndvi_drop AS "meanNdviDrop",
        explanation,
        ST_Y(centroid) as lat,
        ST_X(centroid) as lon
      FROM detections
      WHERE analysis_id = $1
      ORDER BY area_ha DESC
      LIMIT 25;
    `, [id]);

    res.json({
      ...analysis,
      topDetections: detRows,
      reportGeneratedAt: new Date().toISOString(),
      platformVersion: '0.1.0',
    });
  } catch (err) {
    next(err);
  }
});

export default router;
