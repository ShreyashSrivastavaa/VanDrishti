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
