# National Tree Cover Reference Layer — VanDrishti

This document describes the architecture, data lineage, build process, legal cartographic considerations, and deployment of VanDrishti's nationwide tree-cover reference layer for India.

---

## 1. Architectural Motivation & Product Role

VanDrishti operates a dual-tier data architecture:
1. **Curated Monitored Regions (AOIs):** Dynamic Sentinel-2 Level-2A imagery, spectral index stacks, custom U-Net/spectral forest masks, and bi-temporal change detection computed by VanDrishti's Python worker.
2. **National Reference Layer (All of India):** A pre-computed, static raster tile layer derived from an authoritative international open reference product (ESA WorldCover 10 m).

### Why a Static Reference Layer?
- **Scale:** India spans ~3.287 million km². Running raw 10 m Sentinel-2 multi-spectral windowed ingestion across the entire subcontinent on demand is neither viable nor cost-effective for a public-interest project.
- **Monsoon Cloud Dynamics:** Persistent monsoon cloud cover requires multi-month compositing across thousands of tiles.
- **Zero Request-Time Latency:** Served as pre-rendered vector/raster tiles via Cloudflare R2 / CDN using HTTP Range requests (`pmtiles://`), requiring zero database or worker compute during map browsing.

---

## 2. Legal Cartographic Notice (Indian Border Regulations)

> [!IMPORTANT]
> **Strict Non-Depiction of Country Borders:**
> The Criminal Law Amendment (Amending) Act, 2016 and the National Geospatial Policy of India govern the publication and depiction of the international borders of India.
> 
> To comply fully with all applicable regulations:
> - **VanDrishti DOES NOT clip data to any national polygon or administrative border.**
> - **VanDrishti DOES NOT depict, alter, or render international boundary lines.**
> - Processing is executed strictly within an open geographic bounding box envelope:
>   - **Longitude:** `68.0° E` to `98.0° E`
>   - **Latitude:** `6.0° N` to `38.0° N`
> - Base map cartography and international boundaries are rendered entirely by the neutral third-party vector basemap provider.

---

## 3. Data Lineage & Aggregation Methodology

- **Primary Source:** **ESA WorldCover 10 m (2021 v200)**.
- **Data License:** Creative Commons Attribution 4.0 International (CC BY 4.0).
- **Mandatory Attribution:** *"Contains modified Copernicus Sentinel data processed by the ESA WorldCover consortium (© ESA WorldCover project)"*.
- **Target Classes:**
  - Class `10`: Tree cover (woody vegetation ≥ 2 m height).
  - Class `95`: Mangroves (coastal tree formations).
- **Spatial Aggregation:**
  - $3 \times 3$ pixel blocks of the 10 m classification are aggregated to a ~30 m grid.
  - The cell value represents **Tree Cover Share (0–100 %)** as a `uint8` integer.
  - Water, invalid pixels, and nodata are excluded from the denominator.
  - Cells with zero valid pixels are preserved as `255` (nodata / transparent), **never 0**.
- **Caveat & Honesty:**
  - Labeled in the UI as **"Tree cover"**, never "Natural forest".
  - ESA WorldCover includes agroforestry, tea/coffee estates, timber plantations, orchards, and urban trees outside designated forests.

---

## 4. Sequential Monotonic Colour Ramp

To guarantee accessible visual hierarchy on top of the base cartography without saturated neon hues, VanDrishti applies a monotonic sequential ramp:

| Density Range | Hex Code | Visual Meaning |
|---|---|---|
| **0 – 10 %** | `transparent` | Open fields, bare ground, urban areas, and water bodies |
| **10 – 25 %** | `#DDE5B8` | Sparse tree cover, open scrub, sparse agroforestry |
| **25 – 45 %** | `#B5CC84` | Moderate tree cover, orchard borders, open woodlands |
| **45 – 65 %** | `#7FA65A` | Substantial tree cover, deciduous forests, plantations |
| **65 – 80 %** | `#3F7D43` | Dense forest canopy |
| **80 – 90 %** | `#1F5A32` | Very dense evergreen canopy |
| **90 – 100 %** | `#0F3A22` | Maximum density intact forest (Western Ghats, NE Hills) |

*Alpha value:* $\approx 0.85$ (scaled interactively by the user opacity slider, default 75%).

---

## 5. Build Commands & Pipeline Workflow

### Step 1: Run the Builder Script
```bash
# Fast test/dry-run mode (generates local reference COG and metadata)
python scripts/build_india_tree_cover.py --dry-run

# Full subcontinental build (streams ESA WorldCover AWS S3 tiles)
python scripts/build_india_tree_cover.py \
  --output-dir ./data/artifacts/national_layer \
  --max-zoom 12 \
  --resume
```

### Step 2: Build Raster Tiles with GDAL
```bash
# Generate 256x256 WebP or PNG tile pyramid with average resampling
gdal2tiles.py \
  --zoom=0-12 \
  --resampling=average \
  --tilesize=256 \
  --webp \
  --processes=4 \
  ./data/artifacts/national_layer/india_tree_cover_density.tif \
  ./data/artifacts/national_layer/tiles
```

### Step 3: Convert to PMTiles
```bash
# Convert MBTiles / tile pyramid to single-file PMTiles archive
pmtiles convert \
  ./data/artifacts/national_layer/tiles \
  ./data/artifacts/national_layer/india_tree_cover.pmtiles
```

---

## 6. Hosting & Range-Request CDN Configuration

Upload `india_tree_cover.pmtiles` and `india_tree_cover_density.tif` to Cloudflare R2 or Backblaze B2:
```bash
# Example rclone / aws-cli sync
aws s3 cp ./data/artifacts/national_layer/india_tree_cover.pmtiles \
  s3://vandrishti-public/layers/india_tree_cover.pmtiles \
  --endpoint-url https://<account_id>.r2.cloudflarestorage.com
```

### CORS Configuration on the Bucket:
```json
[
  {
    "AllowedOrigins": ["*"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["range", "content-type"],
    "ExposeHeaders": ["Content-Range", "Accept-Ranges", "Content-Length"],
    "MaxAgeSeconds": 86400
  }
]
```

### Client Environment Variable:
In `.env` or deployment variables:
```env
VITE_TREECOVER_PMTILES_URL=https://cdn.vandrishti.org/layers/india_tree_cover.pmtiles
TREECOVER_COG_URL=https://cdn.vandrishti.org/layers/india_tree_cover_density.tif
```

---

## 7. Pixel Sampling Endpoint (`GET /api/v1/tree-cover/sample`)

The API exposes a rate-limited endpoint for coordinate sampling without guessing from screen pixels:
- **Request:** `GET /api/v1/tree-cover/sample?lat=14.15&lon=74.85`
- **Response:**
```json
{
  "lat": 14.15,
  "lon": 74.85,
  "treeCoverSharePercent": 84,
  "isCovered": true,
  "source": "ESA WorldCover 2021 (10 m aggregated to ~30 m)",
  "year": "2021"
}
```
If outside the envelope:
```json
{
  "lat": 51.50,
  "lon": -0.12,
  "treeCoverSharePercent": null,
  "isCovered": false,
  "reason": "Coordinates fall outside the India national reference coverage envelope.",
  "source": "ESA WorldCover 2021",
  "year": "2021"
}
```
