# ForestWatch AI

> A free, public-interest web platform for exploring forest cover and monitoring *suspected* forest loss using Copernicus Sentinel-2 satellite imagery and machine learning.

[![CI](https://github.com/ShreyashSrivastavaa/VanDrishti/actions/workflows/ci.yml/badge.svg)](https://github.com/ShreyashSrivastavaa/VanDrishti/actions)
[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](LICENSE)
[![Sentinel-2](https://img.shields.io/badge/Imagery-Copernicus_Sentinel--2_L2A-forestgreen)](https://dataspace.copernicus.eu/)
[![PostGIS](https://img.shields.io/badge/Spatial_DB-PostgreSQL_16%2B_%2F_PostGIS_3-336791)](https://postgis.net/)

---

## 1. Mission & Non-Negotiable Rules

ForestWatch AI is designed to make environmental satellite monitoring transparent, scientifically grounded, and freely accessible to researchers, conservationists, journalists, and the public.

1. **Data Integrity Above Everything:** Zero fabricated satellite observations, deforestation statistics, or simulated model metrics. Every number shown in the UI originates from real database rows computed by the geospatial pipeline.
2. **Honest Model Registry:** Every model in ForestWatch AI operates under an explicit status:
   - `reference`: Independent external reference product used as-is (e.g., ESA WorldCover 10m).
   - `baseline`: Transparent spectral & rule-based classifier (NDVI, NBR, SWIR thresholds).
   - `prototype`: Trained model without full geographical holdout validation.
   - `validated`: Evaluated on geographically held-out spatial blocks with stored test metrics and Expected Calibration Error (ECE).
3. **Language Discipline:** ForestWatch AI uses *"suspected forest loss"*, *"possible change"*, or *"detected change"*. Spectral change is **not** definitive proof of legal deforestation; fire scars, rotational timber harvesting, deciduous leaf-off, and agricultural cycles can also cause sudden vegetation loss.
4. **Uncompromising Research Aesthetic:** No neon gradients, no emoji icons, no stock cards, and no glassmorphism. Built with a warm ivory paper background (`#F6F3EA`), near-black charcoal text (`#1B201C`), deep forest green (`#1E3A2A`), and dark-red loss highlights (`#B5402B`). All color pairings exceed WCAG AA contrast (4.5:1), and loss polygons feature diagonal hatch fills with 2px outlines for color-blind safety.
5. **Completely Free:** No paywalls, user accounts, gated features, or trackers. An optional voluntary support link appears only if configured via `VITE_SUPPORT_URL`.

---

## 2. System Architecture

```
                       ┌──────────────────────────────────────────────┐
                       │          Client (React 18 + Vite)            │
                       │   MapLibre GL · TanStack Query · Zustand     │
                       └──────────────────────┬───────────────────────┘
                                              │ HTTP / JSON
                                              ▼
                       ┌──────────────────────────────────────────────┐
                       │       Express API (Node 20 + TypeScript)      │
                       │   Zod Validation · Rate Limiting · Nominatim  │
                       └───────┬──────────────────────────────┬───────┘
                               │                              │
                    Raw SQL    ▼                              ▼  Job Queue (SKIP LOCKED)
           ┌───────────────────────────────┐     ┌───────────────────────────────────┐
           │   PostgreSQL 16 + PostGIS 3   │     │  Python ML Worker (forestwatch_ml)│
           │  Geometries · Jobs · Metadata │     │   Rasterio · PyTorch · Shapely    │
           └───────────────────────────────┘     └─────────────────┬─────────────────┘
                                                                   │
                                                STAC Range Reads   ▼
                                         ┌───────────────────────────────────────────┐
                                         │  Element 84 Earth Search (Sentinel-2 L2A) │
                                         │  Local / S3 Artifact Store (PNG/COG/Geo)  │
                                         └───────────────────────────────────────────┘
```

| Layer | Technology | Rationale |
|---|---|---|
| **Frontend** | Vite + React 18 + TypeScript + Tailwind CSS | Map-first Single Page App with fast client rendering and zero SSR baggage. |
| **Mapping Engine** | MapLibre GL JS | Open-source vector and raster mapping with client-side layer manipulation. |
| **Compare Engine** | Custom synced dual-map swipe divider | Frame-accurate synchronised zoom/pan with full keyboard accessibility. |
| **Backend API** | Node 20 + Express + TypeScript + Zod | Type-safe REST orchestration, caching proxy for OSM Nominatim, and GeoJSON export. |
| **Spatial Database** | PostgreSQL 16+ with PostGIS 3 | Spatial indexing (GiST), area calculation in UTM projections, and PostGIS views. |
| **Job Queue** | Postgres-backed queue (`SELECT FOR UPDATE SKIP LOCKED`) | Eliminates Redis dependency in MVP while preserving crash-resilience and idempotency. |
| **Geospatial & ML** | Python 3.11 (`rasterio`, `shapely`, `torch`, `scikit-image`) | Windowed COG range requests, SCL cloud dilation, and 8-band U-Net segmentation. |
| **Artifact Store** | Abstracted `ArtifactStore` (`local` / `s3`) | High-resolution previews, forest masks, COGs, and model weights stored off-database. |

---

## 3. Curated Monitoring Regions (AOIs)

Each curated AOI was verified using real Global Forest Change loss dynamics and Copernicus Sentinel-2 tile coverage. All regions are strictly $\le 500\text{ km}^2$:

1. **Rondônia — Jamari Border, Brazil** (`rondonia-jamari`): Active deforestation frontier and agricultural expansion in the southwestern Amazon basin (282.8 km²).
2. **Northern Mato Grosso — Peixoto de Azevedo, Brazil** (`mato-grosso-peixoto`): Transition zone between dense Amazon rainforest and intensive Cerrado soy farming (296.2 km²).
3. **Madre de Dios — Tambopata Buffer, Peru** (`madre-de-dios-tambopata`): Alluvial gold mining and road-associated forest loss along the Interoceanic Highway (312.4 km²).
4. **Kalimantan — Ketapang Peatland, Indonesia** (`kalimantan-ketapang`): Tropical peat-swamp forest adjacent to oil palm concessions (274.6 km²).
5. **Western Ghats — Uttara Kannada, India** (`western-ghats-uttara`): Moist deciduous and evergreen forest canopy disturbance in a global biodiversity hotspot (280.9 km²).
6. **Västerbotten Forestry, Sweden** (`vasterbotten-boreal`): High-latitude boreal forest clear-cut and rotational harvesting testbed for model generalisation (245.5 km²).

---

## 4. Quick Start & Local Setup

### Prerequisites
- **Node.js** v20.x or higher and `npm` v10+
- **Python** 3.11+
- **PostgreSQL 16+** with the **PostGIS 3** extension installed and running

### Step 1: Clone and Configure Environment
```bash
git clone https://github.com/ShreyashSrivastavaa/VanDrishti.git
cd VanDrishti
cp .env.example .env
```
Ensure your `.env` contains valid connection details:
```ini
DATABASE_URL=postgres://postgres:password@localhost:5432/forestwatch
API_PORT=4000
PUBLIC_WEB_ORIGIN=http://localhost:5173
ARTIFACT_STORE=local
ARTIFACT_LOCAL_DIR=./data/artifacts
VITE_API_BASE_URL=http://localhost:4000/api/v1
```

### Step 2: Install Dependencies
```bash
# Install npm monorepo workspaces (@forestwatch/shared, @forestwatch/api, @forestwatch/web)
npm install

# Install Python ML dependencies
cd services/ml
pip install -r requirements.txt
cd ../..
```

### Step 3: Run Database Migrations & Seeds
```bash
# Run SQL schema migrations (tables, spatial GiST indexes, timeseries views)
npm run migrate --workspace=@forestwatch/api

# Seed curated AOIs, dataset source attributions, and initial model registry entries
npm run seed --workspace=@forestwatch/api
```

### Step 4: Run the Geospatial Ingestion & Analysis Pipeline
To populate the database with real satellite observations and bi-temporal change analyses:
```bash
# Ingest Sentinel-2 observations and render true-color previews + forest masks
python -m services.ml.forestwatch_ml.worker.main

# Compute change detections and polygonise to PostGIS
python -c "from services.ml.forestwatch_ml.worker.main import run_baseline_analyses; run_baseline_analyses()"

# Validate change detections against Hansen Global Forest Change (stored in analysis_validation)
python scripts/validate_against_hansen.py
```

### Step 5: Start the Development Servers
```bash
# Terminal 1: Start Express API (http://localhost:4000)
npm run dev --workspace=@forestwatch/api

# Terminal 2: Start Vite Web Client (http://localhost:5173)
npm run dev --workspace=@forestwatch/web
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 5. Running with Docker Compose

To run the complete production stack (PostGIS, Node API, Caddy reverse proxy, and Web):
```bash
docker compose up --build -d
```
The application will be accessible at `http://localhost`.

---

## 6. Machine Learning Pipeline & Training

ForestWatch AI incorporates an end-to-end deep learning segmentation pipeline based on a modified ResNet-34 U-Net adapted for 8-channel multispectral input `[B02, B03, B04, B08, B11, B12, NDVI, NBR]`.

### Geographically Blocked Splits
To prevent spatial autocorrelation leakage, chips are partitioned into $10\text{ km} \times 10\text{ km}$ spatial blocks separated by a $\ge 1\text{ km}$ spatial exclusion buffer. The Västerbotten boreal biome is held out as an unseen generalisation domain.

### Train & Evaluate
```bash
# Build training chips with spatial blocking
python services/ml/forestwatch_ml/training/build_dataset.py --small

# Train 8-channel U-Net with Dice + BCE loss
python services/ml/forestwatch_ml/training/train.py --small

# Evaluate on geographically held-out test split, compute ECE, and register metrics
python services/ml/forestwatch_ml/training/evaluate.py
```
Outputs:
- Stored model weights: `data/artifacts/models/unet_resnet34/model.pt`
- Transparent model card: `data/artifacts/models/unet_resnet34/model_card.json`
- Test metrics & calibration: `data/artifacts/models/unet_resnet34/metrics.json`
- Model registry status: Automatically updated to `validated` in the `model_versions` table.

---

## 7. Automated Testing Suite

All tests can be executed locally and run automatically in GitHub Actions CI:

```bash
# 1. Run all Node.js tests (API endpoints, Zod schemas, Web UI components)
npm test

# 2. Run TypeScript typecheck across all workspaces
npm run typecheck

# 3. Run Python unit tests (SCL masking, UTM area, hysteresis change, metrics, leakage)
python -m pytest services/ml/tests -v

# 4. Production build validation
npm run build
```

---

## 8. Data Sources & Attributions

ForestWatch AI acknowledges and attributes the following scientific data providers:

- **Copernicus Sentinel-2:** Contains modified Copernicus Sentinel data [2021–2024], processed via Element 84 Earth Search and ESA CDSE under the free, full, and open Copernicus Data Policy.
- **ESA WorldCover 10m:** Zanaga, D. et al. (2021, 2022). ESA WorldCover 10m 2020/2021. Licensed under Creative Commons Attribution 4.0 International (CC BY 4.0).
- **Hansen Global Forest Change:** Hansen, M. C. et al. (2013). High-Resolution Global Maps of 21st-Century Forest Cover Change. Science 342 (6160): 850–853. Licensed under CC BY 4.0.
- **OpenStreetMap & OpenFreeMap:** Map data © OpenStreetMap contributors under the Open Database License (ODbL). Vector tile styles by OpenFreeMap.
- **OSM Nominatim:** Place search proxied via OpenStreetMap Nominatim under the OSMF acceptable use policy.

---

## 9. Documentation Index

For in-depth architectural, cartographic, and algorithmic specifications, consult:

- [`docs/DECISIONS.md`](docs/DECISIONS.md) — Architecture decisions, library choices, and external API verifications.
- [`docs/DESIGN.md`](docs/DESIGN.md) — Design system tokens, typography rules, and WCAG AA contrast audits.
- [`docs/DATA_SOURCES.md`](docs/DATA_SOURCES.md) — Satellite provider specifications, band offsets, and cloud masks.
- [`docs/MODEL.md`](docs/MODEL.md) — 8-channel U-Net architecture, training losses, and label noise handling.
- [`docs/VALIDATION.md`](docs/VALIDATION.md) — Spatial validation protocols against Hansen GFC and stratification guidelines.
- [`docs/API.md`](docs/API.md) — Comprehensive OpenAPI/REST endpoint specifications.
- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — Low-cost production deployment guide (VPS + Caddy + Object Storage).

---

## 10. License

Code released under the **GNU Affero General Public License v3.0 (AGPL-3.0)**. See [LICENSE](LICENSE) for details. Satellite imagery and land-cover reference datasets retain their respective open licenses.
