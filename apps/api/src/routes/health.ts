import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { query } from '../db/client.js';

const router = Router();

// GET /api/v1/health - Basic liveness & DB connection check
router.get('/', async (req: Request, res: Response) => {
  try {
    const { rows } = await query('SELECT 1 as live');
    res.json({
      status: 'ok',
      db: rows[0].live === 1 ? 'connected' : 'unresponsive',
      version: '0.1.0',
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(503).json({
      status: 'degraded',
      db: 'disconnected',
      error: err.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// GET /api/v1/health/data - Audit status endpoint (no secrets) reporting observation integrity & storage
router.get('/data', async (req: Request, res: Response) => {
  try {
    const { rows: obsCounts } = await query(`
      SELECT 
        COUNT(*) FILTER (WHERE is_demo = FALSE) as "realCount",
        COUNT(*) FILTER (WHERE is_demo = TRUE) as "demoCount"
      FROM observations
    `);

    const { rows: anCounts } = await query(`
      SELECT 
        COUNT(*) FILTER (WHERE is_demo = FALSE) as "realCount",
        COUNT(*) FILTER (WHERE is_demo = TRUE) as "demoCount"
      FROM analyses
    `);

    const cogUrl = process.env.TREECOVER_COG_URL || null;
    let cogReadable = false;
    let cogConfigured = Boolean(cogUrl);

    const artifactDir = path.resolve(process.cwd(), process.env.ARTIFACT_LOCAL_DIR || './data/artifacts');
    const localCogPath = path.join(artifactDir, 'national_layer', 'india_tree_cover_density.tif');
    const rootCogPath = path.resolve(process.cwd(), '../../data/artifacts/national_layer/india_tree_cover_density.tif');

    if (fs.existsSync(localCogPath) || fs.existsSync(rootCogPath)) {
      cogConfigured = true;
      cogReadable = true;
    } else if (cogUrl) {
      try {
        const resp = await fetch(cogUrl, { method: 'HEAD' });
        cogReadable = resp.ok;
      } catch {
        cogReadable = false;
      }
    }

    res.json({
      status: 'ok',
      observations: {
        realCount: parseInt(obsCounts[0]?.realCount || '0', 10),
        demoCount: parseInt(obsCounts[0]?.demoCount || '0', 10),
      },
      analyses: {
        realCount: parseInt(anCounts[0]?.realCount || '0', 10),
        demoCount: parseInt(anCounts[0]?.demoCount || '0', 10),
      },
      treeCoverCog: {
        configured: cogConfigured,
        readable: cogReadable,
        url: cogUrl,
      },
      artifactStore: {
        type: process.env.ARTIFACT_STORE || 'local',
        publicBaseUrl: process.env.ARTIFACT_PUBLIC_BASE_URL || null,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(500).json({
      error: { code: 'HEALTH_CHECK_FAILED', message: err.message },
    });
  }
});

export default router;
