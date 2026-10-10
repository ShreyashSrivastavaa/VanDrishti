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

  it('returns accurate tree cover share percent for valid coordinates within India', async () => {
    // Western Ghats (dense tree canopy)
    const res = await request(app).get('/api/v1/tree-cover/sample?lat=14.15&lon=74.85');
    expect(res.status).toBe(200);
    expect(res.body.isCovered).toBe(true);
    expect(typeof res.body.treeCoverSharePercent).toBe('number');
    expect(res.body.treeCoverSharePercent).toBeGreaterThanOrEqual(10);
    expect(res.body.treeCoverSharePercent).toBeLessThanOrEqual(100);
    expect(res.body.source).toContain('ESA WorldCover');
    expect(res.body.year).toBe('2021');
  });

  it('handles northern subcontinent coordinates within envelope', async () => {
    // Delhi / North India
    const res = await request(app).get('/api/v1/tree-cover/sample?lat=28.61&lon=77.20');
    expect(res.status).toBe(200);
    expect(res.body.isCovered).toBe(true);
    expect(typeof res.body.treeCoverSharePercent).toBe('number');
  });
});
