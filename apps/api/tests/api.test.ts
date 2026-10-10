import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';

describe('ForestWatch API Core Endpoints', () => {
  it('GET /api/v1/health returns ok status and connected DB', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.db).toBe('connected');
    expect(res.body.version).toBe('0.1.0');
  });

  it('GET /api/v1/health/data returns data integrity ledger with observation counts and COG status', async () => {
    const res = await request(app).get('/api/v1/health/data');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body).toHaveProperty('observations');
    expect(res.body.observations).toHaveProperty('realCount');
    expect(res.body.observations).toHaveProperty('demoCount');
    expect(res.body).toHaveProperty('treeCoverCog');
    expect(res.body.treeCoverCog).toHaveProperty('configured');
    expect(res.body.treeCoverCog).toHaveProperty('readable');
    expect(res.body).toHaveProperty('artifactStore');
  });

  it('GET /api/v1/config returns public configuration and attributions', async () => {
    const res = await request(app).get('/api/v1/config');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('attributions');
    expect(Array.isArray(res.body.attributions)).toBe(true);
    expect(res.body.attributions.length).toBeGreaterThan(0);
    expect(res.body).toHaveProperty('enableUserAnalysis');
  });

  it('GET /api/v1/dataset_sources returns verified data sources', async () => {
    const res = await request(app).get('/api/v1/dataset_sources');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(5);
    const copernicus = res.body.find((d: any) => d.key === 'copernicus_sentinel2');
    expect(copernicus).toBeDefined();
    expect(copernicus.licence).toContain('Copernicus');
  });

  it('GET /api/v1/aois returns curated monitoring regions', async () => {
    const res = await request(app).get('/api/v1/aois');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(6);

    const rondonia = res.body.find((a: any) => a.slug === 'rondonia-jamari');
    expect(rondonia).toBeDefined();
    expect(rondonia.countryCode).toBe('BRA');
    expect(rondonia.areaKm2).toBeLessThanOrEqual(500);
    expect(rondonia.geojson).toBeDefined();
  });

  it('GET /api/v1/aois/:slug returns specific AOI detail', async () => {
    const res = await request(app).get('/api/v1/aois/rondonia-jamari');
    expect(res.status).toBe(200);
    expect(res.body.slug).toBe('rondonia-jamari');
    expect(res.body.name).toContain('Jamari');
    expect(res.body.geojson).toBeDefined();
    expect(res.body.geojson.type).toBe('MultiPolygon');
  });

  it('GET /api/v1/aois/non-existent-slug returns 404 with error envelope', async () => {
    const res = await request(app).get('/api/v1/aois/non-existent-slug');
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('GET /api/v1/geocode returns empty array for blank query', async () => {
    const res = await request(app).get('/api/v1/geocode?q=');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(0);
  });
});
