# Data Sources & Licenses — ForestWatch AI

This document enumerates the external datasets, APIs, and satellite missions leveraged by ForestWatch AI, along with their licenses, terms of use, and attribution requirements.

---

## 1. Satellite Imagery

### Sentinel-2 MSI (Level-2A Surface Reflectance)
- **Custodian:** European Space Agency (ESA) & European Commission Copernicus Programme.
- **Access Points:**
  - Element 84 Earth Search AWS STAC API (`https://earth-search.aws.element84.com/v1`, collection: `sentinel-2-l2a`)
  - Copernicus Data Space Ecosystem (CDSE, `https://catalogue.dataspace.copernicus.eu/stac`)
- **License:** Free, full, and open data access under EU Regulation No 1159/2013.
- **Attribution Notice:** "Contains modified Copernicus Sentinel data [year]".
- **Technical Specifications:**
  - Spectral Bands: B02 (490 nm, 10m), B03 (560 nm, 10m), B04 (665 nm, 10m), B08 (842 nm, 10m), B11 (1610 nm, 20m), B12 (2190 nm, 20m).
  - Ancillary: SCL (Scene Classification Layer, 20m).
  - Revisit Rate: ~5 days at equator (combined Sentinel-2A & 2B under nominal orbital operations). Cloud-free observation intervals vary significantly by climatic zone and cloud cover.

---

## 2. Land Cover & Forest Reference Data

### ESA WorldCover 10 m (2020 / 2021)
- **Custodian:** European Space Agency & WorldCover Consortium (VITO Remote Sensing).
- **License:** Creative Commons Attribution 4.0 International (CC BY 4.0).
- **Class Reference:** Class 10 (Tree Cover), defined as tree canopy cover >= 10% and tree height >= 3–4m.
- **Role in Platform:** Serves as baseline land cover reference and pseudo-ground-truth targets for calibration.
- **Attribution Notice:** "© ESA WorldCover project 2020 / 2021 / Contains modified Copernicus Sentinel data".

### Hansen Global Forest Change (UMD / GLAD)
- **Custodian:** University of Maryland, Google, USGS, NASA.
- **Dataset Version:** GFC-2023-v1.11 (or latest available).
- **License:** Creative Commons Attribution 4.0 International (CC BY 4.0).
- **Layers:** `treecover2000`, `lossyear` (annual forest loss 2001–2023).
- **Role in Platform:** Independent validation of detected loss events; candidate AOI discovery.
- **Caveats:** 30m spatial resolution (vs 10m Sentinel-2); does not distinguish natural primary forest from commercial timber plantations or tree crop replanting cycles.

---

## 3. Basemaps & Geocoding

### OpenStreetMap & Nominatim
- **Custodian:** OpenStreetMap Foundation.
- **License:** Open Database License (ODbL).
- **Usage Compliance:** Geocoding queries are routed through a server-side proxy with caching, rate-limited to <= 1 request per second, with explicit `User-Agent: ForestWatchAI/0.1`.
- **Attribution Notice:** "© OpenStreetMap contributors".

### OpenFreeMap / Vector Basemaps
- **License:** OpenStreetMap data, styled via open-source MapLibre GL JSON styles.
