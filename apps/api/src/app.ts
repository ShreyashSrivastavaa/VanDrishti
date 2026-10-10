import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import fs from 'fs';

import healthRouter from './routes/health.js';
import configRouter from './routes/config.js';
import geocodeRouter from './routes/geocode.js';
import aoisRouter from './routes/aois.js';
import observationsRouter from './routes/observations.js';
import analysesRouter from './routes/analyses.js';
import detectionsRouter from './routes/detections.js';
import sourcesRouter from './routes/sources.js';
import jobsRouter from './routes/jobs.js';
import { errorHandler } from './middleware/errorHandler.js';

export const app = express();

// Security headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS setup
const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || 'http://localhost:5173')
  .split(',')
  .map(o => o.trim());

app.use(cors({
  origin: (origin, callback) => {
    // allow requests with no origin (like mobile apps, curl, or server-to-server)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV === 'development') {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

// Rate limiter
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
  max: parseInt(process.env.RATE_LIMIT_MAX || '120', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Rate limit exceeded. Please slow down requests.',
    },
  },
});
app.use('/api/', limiter);

// Stricter rate limiter for POST mutations
const mutationLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: {
    error: {
      code: 'TOO_MANY_MUTATIONS',
      message: 'Too many analysis requests. Please wait a minute before requesting another.',
    },
  },
});
app.use('/api/v1/aois/:slug/analyses', (req, res, next) => {
  if (req.method === 'POST') {
    return mutationLimiter(req, res, next);
  }
  next();
});

app.use(express.json({ limit: '1mb' }));

// Static artifact previews and overlays
const artifactDir = path.resolve(process.cwd(), process.env.ARTIFACT_LOCAL_DIR || './data/artifacts');
if (!fs.existsSync(artifactDir)) {
  fs.mkdirSync(artifactDir, { recursive: true });
}
app.use('/artifacts', express.static(artifactDir));

// API v1 Routes
const v1 = express.Router();
v1.use('/health', healthRouter);
v1.use('/config', configRouter);
v1.use('/geocode', geocodeRouter);
v1.use('/aois', aoisRouter);
v1.use('/', observationsRouter);
v1.use('/', analysesRouter);
v1.use('/detections', detectionsRouter);
v1.use('/dataset_sources', sourcesRouter);
v1.use('/jobs', jobsRouter);

app.use('/api/v1', v1);

// 404 handler for undefined API routes
app.use('/api', (req, res) => {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: `Cannot ${req.method} ${req.originalUrl}` }
  });
});

// Centralized error handler
app.use(errorHandler);
