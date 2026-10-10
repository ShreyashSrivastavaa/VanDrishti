# Model Registry, Architecture & Calibration — ForestWatch AI

## 1. Model Lifecycle & Truth in Labeling

Every model in ForestWatch AI is assigned an immutable status:
1. `reference`: External authoritative product used directly without retraining (e.g., ESA WorldCover Tree Cover).
2. `baseline`: Deterministic, rule-based spectral classifier based on calibrated spectral indices (NDVI, NBR, SWIR thresholds). Completely auditable and transparent.
3. `prototype`: Deep learning model trained on training data splits, pending formal spatial hold-out evaluation.
4. `validated`: Model evaluated on geographically held-out test blocks with metrics stored (`metrics.json`, IoU, precision, recall, Expected Calibration Error).

**Rule:** The UI will never claim a model is `validated` unless `evaluate.py` has run on a geographically held-out test set and recorded verifiable metrics.

---

## 2. Spectral Baseline Model (`baseline`)

### Architecture & Formulation
The spectral baseline model classifies Sentinel-2 L2A surface reflectance pixels into forest / non-forest using spectral indices:
- Normalized Difference Vegetation Index (NDVI): `(B08 - B04) / (B08 + B04)`
- Normalized Burn Ratio (NBR): `(B08 - B12) / (B08 + B12)`
- SWIR Ratio: `B11 / B08`

**Classification Rule:**
- Pixel is candidate forest if `NDVI >= 0.65` and `NBR >= 0.40` and `B11 < 0.18`.
- If SCL is cloudy/shadow/water/nodata, probability is `NaN` (unclassified).
- Forest probability `p_forest` is modeled via a smooth sigmoid over normalized index distances, calibrated against ESA WorldCover tree cover masks.

---

## 3. Deep Learning Architecture (`prototype` / `validated`)

### Neural Network Specification
- **Architecture:** U-Net encoder-decoder network.
- **Backbone Encoder:** ResNet-18 or ResNet-34.
- **Input Channels:** 8 spectral bands and indices:
  1. B02 (Blue, 10m)
  2. B03 (Green, 10m)
  3. B04 (Red, 10m)
  4. B08 (Near-Infrared, 10m)
  5. B11 (SWIR 1, resampled to 10m)
  6. B12 (SWIR 2, resampled to 10m)
  7. NDVI = `(B08 - B04) / (B08 + B04)`
  8. NBR = `(B08 - B12) / (B08 + B12)`
- **First Convolution Adaptation:** Initial Conv2d weights extended from 3 RGB channels to 8 channels by preserving RGB filter weights and initializing infrared/index channels with mean weights divided by channel scaling.
- **Loss Function:** Combination of Dice Loss and Binary Cross Entropy with class weighting: `L = 0.5 * L_Dice + 0.5 * L_BCE`.

### Spatial Leakage Prevention & Data Splitting
Spatial autocorrelation can cause severe over-estimation of generalization performance if random pixel- or chip-level train/test splits are used.
- All training chips are assigned to **geographic blocks (10 km x 10 km)** or discrete MGRS tiles.
- Splits are assigned at the block level: 70% Train, 15% Validation, 15% Test.
- A **buffer zone of at least 1 km** separates training blocks from test blocks.
- At least one entire geographic biome is held out exclusively for cross-biome generalization testing.

---

## 4. Calibration & Confidence Scoring

Confidence is never presented as an uncalibrated probability.
- If Expected Calibration Error (ECE) has been computed via temperature scaling or isotonic regression on test chips, the score is labeled as **"Calibrated Confidence (ECE: X.XX)"**.
- If calibration has not been performed, the value is labeled as **"Model Score (Uncalibrated)"** with an explicit user-facing disclaimer.
