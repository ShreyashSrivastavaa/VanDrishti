# API Reference — ForestWatch AI

The ForestWatch AI API is a RESTful JSON API providing data on curated areas of interest, satellite observations, forest cover, suspected change analyses, and geocoding.

Base URL: `/api/v1`

---

## Response Structure & Error Envelope

All successful responses return JSON payloads directly or keyed by object.
Errors always follow a consistent structure:
```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "Detailed error message",
    "details": {}
  }
}
```

---

## Endpoints

### System & Configuration
- `GET /health`
  - Health check & database connection probe.
  - Returns: `{ "status": "ok", "db": "connected", "version": "0.1.0", "timestamp": "..." }`
- `GET /config`
  - Returns public runtime configuration and attribution info.
  - Returns: `{ "supportUrl": string | null, "enableUserAnalysis": boolean, "attributions": [...] }`

### Geocoding
- `GET /geocode?q=<search_query>`
  - Cached, rate-limited proxy to OpenStreetMap Nominatim.
  - Returns: `[ { "label": string, "lat": number, "lon": number, "bbox": [minLon, minLat, maxLon, maxLat] } ]`

### Areas of Interest (AOIs)
- `GET /aois`
  - Lists curated monitoring regions.
  - Returns: `[ { "id": "uuid", "slug": "string", "name": "string", "countryCode": "string", "areaKm2": number, "latestObservationDate": "string", "observationCount": number, "analysisCount": number } ]`
- `GET /aois/:slug`
  - Retrieves detailed metadata, boundary GeoJSON, and summary statistics.
- `GET /aois/:slug/observations?usable=true&from=&to=`
  - Returns list of Sentinel-2 satellite observations with cloud and valid pixel fractions, preview URLs, and usability flags.
- `GET /aois/:slug/timeseries`
  - Time-series data points of forest area and fraction over time, keyed by model version.
- `GET /aois/:slug/analyses`
  - Returns list of completed change analyses for date pairs in this AOI.

### Analyses & Detections
- `POST /aois/:slug/analyses`
  - Request or queue change detection between observation dates `t0` and `t1`.
- `GET /analyses/:id`
  - Change analysis summary, total suspected loss (ha), warnings, and parameter provenance.
- `GET /analyses/:id/detections?minAreaHa=&confidenceClass=`
  - Returns GeoJSON FeatureCollection of suspected forest loss polygons.
- `GET /detections/:id`
  - Full details for an individual detection polygon, including area, confidence score, spectral drop, and explanation text.
- `GET /analyses/:id/export.geojson`
  - Direct download of the GeoJSON FeatureCollection with embedded metadata and licensing.
- `GET /analyses/:id/report`
  - Structured summary data for printable PDF/audit report.
