import { Router, Request, Response } from 'express';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  res.json({
    supportUrl: process.env.VITE_SUPPORT_URL || null,
    enableUserAnalysis: process.env.ENABLE_USER_ANALYSIS === 'true',
    maxUserAoiKm2: parseInt(process.env.MAX_USER_AOI_KM2 || '100', 10),
    siteContactEmail: process.env.VITE_SITE_CONTACT_EMAIL || 'info@forestwatch.org',
    attributions: [
      'Contains modified Copernicus Sentinel data [2020-2024]',
      '© ESA WorldCover project 2021',
      'Hansen/UMD/GLAD Global Forest Change',
      'Map data © OpenStreetMap contributors, OpenFreeMap',
    ],
  });
});

export default router;
