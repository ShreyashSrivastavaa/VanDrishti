import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import fs from 'fs';
import path from 'path';
import { fromUrl, fromFile, GeoTIFF, GeoTIFFImage } from 'geotiff';

const router = Router();

// Rate limiter for national layer pixel sampling
const sampleLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Tree-cover sampling rate limit exceeded. Please wait a moment before sending more requests.',
    },
  },
});

// India envelope: [min_lon, min_lat, max_lon, max_lat]
const INDIA_BBOX = {
  minLon: 68.0,
  minLat: 6.0,
  maxLon: 98.0,
  maxLat: 38.0,
};

// Cached GeoTIFF image handle
let cachedTiffImage: {
  image: GeoTIFFImage;
  bbox: [number, number, number, number];
  width: number;
  height: number;
  sourceKey: string;
} | null = null;

async function getTreeCoverTiffImage(): Promise<{
  image: GeoTIFFImage;
  bbox: [number, number, number, number];
  width: number;
  height: number;
} | null> {
  const cogUrl = process.env.TREECOVER_COG_URL;
  const artifactDir = path.resolve(process.cwd(), process.env.ARTIFACT_LOCAL_DIR || './data/artifacts');
  let localCogPath = path.join(artifactDir, 'national_layer', 'india_tree_cover_density.tif');
  if (!fs.existsSync(localCogPath)) {
    const fallbackPath = path.resolve(process.cwd(), '../../data/artifacts/national_layer/india_tree_cover_density.tif');
    if (fs.existsSync(fallbackPath)) {
      localCogPath = fallbackPath;
    }
  }

  const currentSourceKey = cogUrl || (fs.existsSync(localCogPath) ? localCogPath : '');
  if (!currentSourceKey) {
    return null;
  }

  if (cachedTiffImage && cachedTiffImage.sourceKey === currentSourceKey) {
    return cachedTiffImage;
  }

  try {
    let tiff: GeoTIFF;
    if (cogUrl) {
      tiff = await fromUrl(cogUrl);
    } else {
      tiff = await fromFile(localCogPath);
    }

    const image = await tiff.getImage();
    const bbox = image.getBoundingBox() as [number, number, number, number];
    const width = image.getWidth();
    const height = image.getHeight();

    cachedTiffImage = {
      image,
      bbox,
      width,
      height,
      sourceKey: currentSourceKey,
    };

    return cachedTiffImage;
  } catch (err) {
    console.warn('[TreeCover] Failed to open COG:', err);
    return null;
  }
}

// GET /api/v1/tree-cover/sample?lat=...&lon=...
router.get('/sample', sampleLimiter, async (req: Request, res: Response) => {
  const latStr = req.query.lat as string;
  const lonStr = req.query.lon as string;

  if (!latStr || !lonStr) {
    return res.status(400).json({
      error: {
        code: 'MISSING_COORDINATES',
        message: 'Both lat and lon query parameters are required.',
      },
    });
  }

  const lat = parseFloat(latStr);
  const lon = parseFloat(lonStr);

  if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return res.status(400).json({
      error: {
        code: 'INVALID_COORDINATES',
        message: 'Coordinates must be valid numbers with latitude in [-90, 90] and longitude in [-180, 180].',
      },
    });
  }

  // Check if within India geographic envelope
  if (
    lat < INDIA_BBOX.minLat ||
    lat > INDIA_BBOX.maxLat ||
    lon < INDIA_BBOX.minLon ||
    lon > INDIA_BBOX.maxLon
  ) {
    return res.json({
      lat,
      lon,
      treeCoverSharePercent: null,
      isCovered: false,
      reason: 'Coordinates fall outside the India national reference coverage envelope.',
      source: 'ESA WorldCover 2021',
      year: '2021',
    });
  }

  // Attempt reading exclusively from the real georeferenced COG
  const tiffData = await getTreeCoverTiffImage();

  if (!tiffData) {
    return res.status(503).json({
      error: {
        code: 'DATASET_UNAVAILABLE',
        message: 'National tree-cover reference COG is currently unavailable. No synthetic fallback is permitted.',
      },
    });
  }

  const { image, bbox, width, height } = tiffData;
  const [minX, minY, maxX, maxY] = bbox;

  if (lon < minX || lon > maxX || lat < minY || lat > maxY) {
    return res.json({
      lat,
      lon,
      treeCoverSharePercent: null,
      isCovered: false,
      reason: 'Coordinates fall outside reference raster coverage bounds.',
      source: 'ESA WorldCover 2021 (10 m aggregated to ~30 m)',
      year: '2021',
    });
  }

  try {
    const col = Math.floor(((lon - minX) / (maxX - minX)) * width);
    const row = Math.floor(((maxY - lat) / (maxY - minY)) * height);

    const clampedCol = Math.min(width - 1, Math.max(0, col));
    const clampedRow = Math.min(height - 1, Math.max(0, row));

    const [raster] = await image.readRasters({
      window: [clampedCol, clampedRow, clampedCol + 1, clampedRow + 1],
    });

    const rawVal = Number((raster as any)[0]);

    // In ESA WorldCover aggregated density:
    // 255 = nodata (water/ocean/outside data)
    // 0..100 = real tree-cover density percentage
    if (rawVal === 255 || isNaN(rawVal)) {
      return res.json({
        lat,
        lon,
        treeCoverSharePercent: null,
        isCovered: false,
        reason: 'Water body, nodata, or outside classified tree cover.',
        source: 'ESA WorldCover 2021 (10 m aggregated to ~30 m)',
        year: '2021',
      });
    }

    const percentage = Math.min(100, Math.max(0, Math.round(rawVal)));

    return res.json({
      lat,
      lon,
      treeCoverSharePercent: percentage,
      isCovered: true,
      source: 'ESA WorldCover 2021 (10 m aggregated to ~30 m)',
      year: '2021',
    });
  } catch (err: any) {
    console.error('[TreeCover] Raster window read error:', err);
    return res.status(500).json({
      error: {
        code: 'SAMPLE_READ_FAILED',
        message: 'Failed to sample reference raster at the specified coordinates.',
      },
    });
  }
});

export default router;
