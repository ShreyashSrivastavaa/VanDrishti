# Architectural Decisions Record — VanDrishti (वन दृष्टि)

This document records architectural, algorithmic, geospatial, and infrastructure decisions made for VanDrishti, including verifications of external APIs, data licenses, quotas, and library versions.

---

## 1. Monorepo and Technology Stack

- **Monorepo Structure:** 
  - `apps/web`: Vite + React 18 + TypeScript + Tailwind CSS + MapLibre GL JS
  - `apps/api`: Node 20 + Express + TypeScript + `pg` (PostGIS raw SQL queries)
  - `packages/shared`: Shared TypeScript definitions and Zod schemas (syncing types across API and Web)
  - `services/ml`: Python 3.11 geospatial processing and ML pipeline (`forestwatch_ml`), covering STAC queries, COG windowing, spectral indices, U-Net inference, polygonisation, and worker queue consumption.
- **Rationale for Separate Worker:** Raster processing on Sentinel-2 10 m grids requires NumPy/rasterio/PyTorch memory headroom (2–4 GB). Isolating heavy computations into Python queue workers keeps the Node.js API lean, responsive, and low-latency.
- **Database:** PostgreSQL 16+ with PostGIS 3. PostGIS provides standard spatial predicates (`ST_Intersects`, `ST_Area(geography)`, `ST_AsGeoJSON`, `ST_SimplifyPreserveTopology`). We deliberately avoid Prisma because Prisma does not natively support advanced PostGIS types and functions without messy raw SQL workarounds. Plain SQL migrations with Node `pg` client provide clean, transparent schema management.
- **Queue System:** PostgreSQL table-based queue (`jobs` table with `SELECT ... FOR UPDATE SKIP LOCKED`).
  - *Rationale:* Avoids introducing Redis / Celery / BullMQ dependencies for the MVP workload (tens of jobs/day). A clean `JobQueue` abstraction allows dropping in Redis or Cloud Tasks in the future without changing job handler logic.

---

## 2. Satellite Imagery & Providers

### 2.1 Element 84 Earth Search (AWS STAC)
- **Endpoint:** `https://earth-search.aws.element84.com/v1`
- **Collection:** `sentinel-2-l2a`
- **License / Terms:** Open and free. Copernicus data terms apply: "Contains modified Copernicus Sentinel data [year]".
- **Authentication:** Zero credentials required for STAC queries and HTTP range requests against public Cloud-Optimized GeoTIFFs (COGs).
- **Access Pattern:** HTTP GET Range requests for windowed reads of only the bounding box covering each Area of Interest (AOI). Whole scenes (~500MB each) are never downloaded.
- **Resolution:** 10m bands (B02 Blue, B03 Green, B04 Red, B08 NIR); 20m bands (B11 SWIR1, B12 SWIR2, SCL Scene Classification Layer) bilinearly resampled to 10m grid.

### 2.2 Copernicus Data Space Ecosystem (CDSE)
- **STAC Endpoint:** `https://catalogue.dataspace.copernicus.eu/stac`
- **Authentication:** OAuth2 Client Credentials (`https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token`).
- **Quota/Rate Limits:** Free tier allows interactive processing; quotas apply for bulk downloads. Configured as secondary provider activated via `CDSE_CLIENT_ID` and `CDSE_CLIENT_SECRET`.

### 2.3 Cloud Handling & Quality Filtering
- Scene-level filter: `eo:cloud_cover <= 60%`
- SCL (Scene Classification Layer) Pixel Masking:
  - Masked values: 0 (No Data), 1 (Saturated/Defective), 3 (Cloud Shadow), 8 (Cloud Medium Prob), 9 (Cloud High Prob), 10 (Thin Cirrus), 11 (Snow/Ice).
  - Mask dilation: 2-3 pixels to catch cloud and shadow edges.
  - Usable threshold: An observation is deemed usable only if valid (clear land) pixel fraction >= 0.70 (70%). Unusable observations are preserved in the database with reasons recorded and shown disabled in UI date pickers.

---

## 3. Reference Datasets & Licenses

1. **ESA WorldCover 10 m (2020 / 2021):**
   - *Role:* Baseline tree cover reference and pseudo-ground-truth labels for spectral calibration.
   - *License:* Creative Commons Attribution 4.0 International (CC BY 4.0).
   - *Attribution:* "© ESA WorldCover project 2020/2021 / Contains modified Copernicus Sentinel data".
2. **Hansen / UMD / GLAD Global Forest Change:**
   - *Role:* Validation of detected forest loss events and candidate AOI discovery.
   - *License:* CC BY 4.0.
   - *Caveat:* 30 m spatial resolution; defines "tree cover" regardless of land-use intent (includes timber plantations).
3. **OpenStreetMap / Nominatim:**
   - *Role:* Place geocoding search.
   - *License:* ODbL / OpenStreetMap contributors.
   - *Policy compliance:* Custom User-Agent (`ForestWatchAI/0.1`), debounced requests, server-side caching, <= 1 request/sec limit.
4. **Basemap:**
   - OpenFreeMap / CartoDB Positron / OSM keyless vector tiles for vector base layer.
   - Satellite imagery displayed over AOIs is ForestWatch's own processed Sentinel-2 L2A composite previews, not third-party satellite tiles.

---

## 4. Model Registry and Lifecycle

Every model prediction must be tagged with one of four statuses:
1. `reference`: Direct external reference product (e.g., ESA WorldCover 2020/2021 class 10 Tree Cover).
2. `baseline`: Transparent, rule-based spectral classifier (NDVI, NBR, SWIR thresholds calibrated against WorldCover on training tiles). Enables change detection before deep model weights are trained.
3. `prototype`: Deep learning model (U-Net) trained on training splits, but not yet evaluated on geographically held-out test sets.
4. `validated`: Model evaluated on geographically held-out test blocks with metrics stored (`metrics.json`, ECE, IoU, confusion matrix).

No unverified or fabricated accuracy metrics are ever displayed.

---

## 5. UI and Design Standards

- **Palette:** Strict adherence to research/observatory palette (`--paper: #F6F3EA`, `--surface: #FBF9F3`, `--forest-900: #1E3A2A`, `--loss-600: #B5402B`, etc.).
- **Typography:** Self-hosted `Source Serif 4` (editorial headings), `IBM Plex Sans` (UI text), `IBM Plex Mono` (tabular numbers and coordinates).
- **Cartographic Encoding:** Color-blind safe representation. Forest loss polygons feature distinct stroke weight (2px dark red outline) and diagonal hatch fill, never relying on red vs green color distinction alone.
- **Language Discipline:** "Suspected forest loss", "detected change", "possible vegetation loss". Never "proven deforestation" or "illegal logging".

---

## 6. National Reference Tree Cover Layer (All of India)

- **Static Reference Pre-computation:** Subcontinental coverage (~3.3M km²) is decoupled from request-time worker computation. Pre-aggregated to a ~30 m grid (from 10 m ESA WorldCover classes 10 & 95) holding uint8 percentage density (0–100%).
- **Boundary Policy & Legal Cartography:** The layer strictly adheres to the geographic bounding box envelope [68.0–98.0° E, 6.0–38.0° N]. Data is never clipped to national boundary polygons; political border depiction is strictly delegated to the neutral vector basemap provider in compliance with Indian geospatial regulations.
- **Delivery:** Hosted as a single PMTiles archive on Cloudflare R2 / S3-compatible storage with HTTP Range request support and CORS enabled.
- **Sampling API:** Rate-limited `GET /api/v1/tree-cover/sample?lat=&lon=` reads the stored COG or envelope grid, returning exact tree-cover percentage and source metadata.

