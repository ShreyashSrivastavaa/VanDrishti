import { Router, Request, Response } from 'express';
import { searchPlaces } from '../services/geocodingService.js';

const router = Router();

router.get('/', async (req: Request, res: Response, next) => {
  try {
    const q = req.query.q as string;
    if (!q || q.trim().length === 0) {
      return res.json([]);
    }
    const results = await searchPlaces(q);
    res.json(results);
  } catch (err) {
    next(err);
  }
});

export default router;
