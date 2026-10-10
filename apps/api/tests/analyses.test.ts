import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';

describe('ForestWatch Analyses and Observations Endpoints', () => {
  it('GET /api/v1/aois/:slug/observations returns real satellite passes with quality metrics', async () => {
    const res = await request(app).get('/api/v1/aois/rondonia-jamari/observations');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(4);

    const first = res.body[0];
    expect(first).toHaveProperty('validFraction');
    expect(first).toHaveProperty('cloudFraction');
    expect(first).toHaveProperty('usable');
    expect(first).toHaveProperty('previewUri');
  });

  it('GET /api/v1/aois/:slug/analyses returns computed bi-temporal change analyses', async () => {
    const res = await request(app).get('/api/v1/aois/rondonia-jamari/analyses');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);

    const analysis = res.body[0];
    expect(analysis.status).toBe('ready');
    expect(Number(analysis.totalLossHa)).toBeGreaterThan(0);
    expect(Number(analysis.detectionCount)).toBeGreaterThan(0);
  });

  it('GET /api/v1/analyses/:id/detections returns valid GeoJSON FeatureCollection', async () => {
    const listRes = await request(app).get('/api/v1/aois/rondonia-jamari/analyses');
    const analysisId = listRes.body[0].id;

    const res = await request(app).get(`/api/v1/analyses/${analysisId}/detections`);
    expect(res.status).toBe(200);
    expect(res.body.type).toBe('FeatureCollection');
    expect(Array.isArray(res.body.features)).toBe(true);
    expect(res.body.features.length).toBeGreaterThan(0);

    const feat = res.body.features[0];
    expect(feat.type).toBe('Feature');
    expect(feat.geometry).toBeDefined();
    expect(feat.properties.areaHa).toBeGreaterThan(0);
    expect(feat.properties.confidenceClass).toMatch(/^(low|medium|high)$/);
  });

  it('GET /api/v1/analyses/:id/export.geojson returns downloadable GeoJSON with attribution', async () => {
    const listRes = await request(app).get('/api/v1/aois/rondonia-jamari/analyses');
    const analysisId = listRes.body[0].id;

    const res = await request(app).get(`/api/v1/analyses/${analysisId}/export.geojson`);
    expect(res.status).toBe(200);
    expect(res.header['content-type']).toContain('application/geo+json');
    expect(res.body.type).toBe('FeatureCollection');
    expect(res.body.properties.attribution).toContain('Copernicus Sentinel');
    expect(res.body.properties.licence).toContain('Creative Commons');
  });

  it('GET /api/v1/analyses/:id/report returns structured printable audit report', async () => {
    const listRes = await request(app).get('/api/v1/aois/rondonia-jamari/analyses');
    const analysisId = listRes.body[0].id;

    const res = await request(app).get(`/api/v1/analyses/${analysisId}/report`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(analysisId);
    expect(res.body).toHaveProperty('aoiName');
    expect(res.body).toHaveProperty('reportGeneratedAt');
    expect(Array.isArray(res.body.topDetections)).toBe(true);
  });
});
