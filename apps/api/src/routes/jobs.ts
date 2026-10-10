import { Router, Request, Response } from 'express';
import { getJob } from '../services/queueService.js';

const router = Router();

// GET /jobs/:id
router.get('/:id', async (req: Request, res: Response, next) => {
  try {
    const { id } = req.params;
    const job = await getJob(id);
    if (!job) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: `Job '${id}' not found` }
      });
    }
    res.json(job);
  } catch (err) {
    next(err);
  }
});

export default router;
