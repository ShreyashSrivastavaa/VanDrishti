# Deployment Guide — ForestWatch AI

This guide describes how to deploy the ForestWatch AI stack to staging or production environments.

---

## Architecture Overview

```
                      Internet
                         │
                         ▼
             ┌────────────────────────┐
             │    Caddy Web Server    │ (Automatic HTTPS, Reverse Proxy)
             └───────────┬────────────┘
                         │
        ┌────────────────┼────────────────┐
        │ /api/*         │ /* (SPA)       │ /artifacts/*
        ▼                ▼                ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────────┐
│ Express API  │ │  Vite / Nginx│ │ Local Volume or  │
│  (Port 4000) │ │  Static Web  │ │ Cloudflare R2/B2 │
└───────┬──────┘ └──────────────┘ └──────────────────┘
        │
        ├────────────────────────────────┐
        ▼                                ▼
┌──────────────┐                 ┌──────────────┐
│  PostgreSQL  │                 │ Python Worker│
│  + PostGIS   │◄────────────────┤(Job Consumer)│
└──────────────┘ (jobs queue)    └──────────────┘
```

---

## 1. Hosting Requirements (MVP)

- **Compute:** 1 x Virtual Private Server (VPS) with >= 2 vCPUs, >= 4 GB RAM, >= 40 GB NVMe storage (e.g. Hetzner CX22/CX32, DigitalOcean Basic Droplet, or Fly.io).
- **OS:** Ubuntu 22.04 LTS or Debian 12.
- **Docker & Compose:** Docker Engine 24+ and Docker Compose v2.

---

## 2. Environment Configuration

1. Clone repository to server:
   ```bash
   git clone https://github.com/YourOrg/forestwatch-ai.git /opt/forestwatch-ai
   cd /opt/forestwatch-ai
   ```
2. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
3. Edit `.env` with production secrets:
   - `DATABASE_URL=postgres://forestwatch:SECURE_PASSWORD@postgis:5432/forestwatch`
   - `PUBLIC_WEB_ORIGIN=https://forestwatch.example.org`
   - `CORS_ALLOWED_ORIGINS=https://forestwatch.example.org`
   - `IP_HASH_SALT=RANDOM_HEX_STRING`
   - `ARTIFACT_STORE=s3` (or `local` with persistent Docker volume)
   - `S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com`
   - `S3_BUCKET=forestwatch-artifacts`
   - `S3_ACCESS_KEY_ID=...`
   - `S3_SECRET_ACCESS_KEY=...`
   - `VITE_API_BASE_URL=https://forestwatch.example.org/api/v1`
   - `VITE_SUPPORT_URL=https://buymeacoffee.com/forestwatch` (optional)

---

## 3. Starting Services with Docker Compose

Run the production compose setup:
```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Verify service status:
```bash
docker compose ps
docker compose logs -f api
docker compose logs -f worker
```

Run database migrations:
```bash
docker compose exec api npm run migrate:up
```

Seed initial dataset sources and curated AOIs:
```bash
docker compose exec api npm run seed
```

---

## 4. Database Backups

Nightly database dump to S3 or persistent volume:
```bash
docker compose exec -T postgis pg_dump -U forestwatch -Fc forestwatch > /backup/forestwatch-$(date +%F).dump
```

To restore:
```bash
docker compose exec -T postgis pg_restore -U forestwatch -d forestwatch --clean < backup_file.dump
```

---

## 5. Cloud Platform Deployment (Vercel & Render)

For cloud deployments spanning Vercel (Frontend) and Render (Backend API + ML Worker):

### Render (API & Background Worker)
Set the following Environment Variables in the Render dashboard:
- `DATABASE_URL`: Managed PostgreSQL connection string (with PostGIS enabled).
- `CORS_ALLOWED_ORIGINS`: `https://vandrishti-v4sx.vercel.app` (or custom domain).
- `ARTIFACT_STORE`: `s3` (Render ephemeral disk wipes `./data/artifacts` on restarts/re-deploys).
- `S3_ENDPOINT`: Cloudflare R2 or AWS S3 endpoint URL (e.g. `https://<account-id>.r2.cloudflarestorage.com`).
- `S3_BUCKET`: `vandrishti-artifacts`
- `S3_ACCESS_KEY_ID`: Your S3/R2 access key ID.
- `S3_SECRET_ACCESS_KEY`: Your S3/R2 secret access key.
- `ARTIFACT_PUBLIC_BASE_URL`: Public HTTPS URL or CDN domain serving artifacts (e.g. `https://artifacts.vandrishti.org` or `https://pub-<id>.r2.dev`).
- `TREECOVER_COG_URL`: Direct HTTPS URL to the India National Tree Cover Cloud-Optimized GeoTIFF (`india_tree_cover_density.tif`).

### Vercel (Web Frontend)
Set the following Environment Variables in Vercel project settings:
- `VITE_API_BASE_URL`: `https://vandrishti.onrender.com/api/v1`
- `VITE_TREECOVER_PMTILES_URL`: `https://artifacts.vandrishti.org/national_layer/india_tree_cover.pmtiles`
- `VITE_MAPTILER_API_KEY`: (Optional) Free MapTiler vector basemap key.
