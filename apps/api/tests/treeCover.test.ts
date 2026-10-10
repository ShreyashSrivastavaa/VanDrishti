import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';

describe('Tree Cover National Layer Sampling API', () => {
  it('rejects requests with missing coordinates (400)', async () => {
    const res = await request(app).get('/api/v1/tree-cover/sample');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('MISSING_COORDINATES');
  });

  it('rejects invalid or non-numeric coordinates (400)', async () => {
    const res = await request(app).get('/api/v1/tree-cover/sample?lat=invalid&lon=foo');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_COORDINATES');
  });

  it('returns null and isCovered=false for coordinates outside the India envelope', async () => {
    // London coordinates
    const res = await request(app).get('/api/v1/tree-cover/sample?lat=51.5074&lon=-0.1278');
    expect(res.status).toBe(200);
    expect(res.body.isCovered).toBe(false);
    expect(res.body.treeCoverSharePercent).toBeNull();
    expect(res.body.reason).toContain('outside');
  });

  it('samples ocean point (Arabian Sea) and returns null tree cover with isCovered=false', async () => {
    // lat 15.0, lon 70.0 is open Arabian Sea within the India bbox
    const res = await request(app).get('/api/v1/tree-cover/sample?lat=15.0&lon=70.0');
    expect(res.status).toBe(200);
    expect(res.body.isCovered).toBe(false);
    expect(res.body.treeCoverSharePercent).toBeNull();
    expect(res.body.reason).toContain('Water body');
  });

  it('samples Thar desert point and returns tree cover near 0-2%', async () => {
    // lat 27.0, lon 71.5 is in Thar desert
    const res = await request(app).get('/api/v1/tree-cover/sample?lat=27.0&lon=71.5');
    expect(res.status).toBe(200);
    expect(res.body.isCovered).toBe(true);
    expect(typeof res.body.treeCoverSharePercent).toBe('number');
    expect(res.body.treeCoverSharePercent).toBeLessThanOrEqual(2);
  });

  it('samples dense Western Ghats forest point and returns high tree cover (>= 50%)', async () => {
    // Western Ghats dense canopy
    const res = await request(app).get('/api/v1/tree-cover/sample?lat=14.0&lon=75.0');
    expect(res.status).toBe(200);
    expect(res.body.isCovered).toBe(true);
    expect(typeof res.body.treeCoverSharePercent).toBe('number');
    expect(res.body.treeCoverSharePercent).toBeGreaterThanOrEqual(50);
    expect(res.body.source).toContain('ESA WorldCover');
  });
});
