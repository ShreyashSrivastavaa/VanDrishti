import { Router, Request, Response } from 'express';
import { query } from '../db/client.js';

const router = Router();

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

export default router;
