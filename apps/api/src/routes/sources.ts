import { Router, Request, Response } from 'express';
import { query } from '../db/client.js';

const router = Router();

// GET /dataset_sources
router.get('/', async (req: Request, res: Response, next) => {
  try {
    const { rows } = await query(`
      SELECT 
        id,
        key,
        name,
        version,
        licence,
        attribution,
        url,
        description,
        created_at AS "createdAt"
      FROM dataset_sources
      ORDER BY name ASC;
    `);

    res.json(rows);
  } catch (err) {
    next(err);
  }
});

export default router;
