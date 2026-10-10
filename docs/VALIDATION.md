# Validation Protocol & False Positive Analysis — ForestWatch AI

## 1. Automated Validation against Hansen Global Forest Change

The change detection pipeline automatically cross-references detected forest loss polygons with the Hansen/UMD Global Forest Change (`lossyear`) product.

### Validation Methodology
1. **Intersection Calculation:** Detections are overlaid against Hansen 30m pixels corresponding to the years between `t0` and `t1`.
2. **Agreement Score:** 
   $$\text{Agreement} = \frac{\text{Area of detection intersecting Hansen loss pixels}}{\text{Total detection area}}$$
3. **Caveats & Resolution Differences:**
   - Sentinel-2 detection runs at 10m spatial resolution; Hansen GFC runs at 30m resolution.
   - Small-scale clearings (< 0.5 ha) visible in Sentinel-2 may fall beneath the 30m detection envelope of Hansen.
   - Hansen's loss is reported on an annual calendar basis, whereas ForestWatch AI detects changes between specific intra-annual satellite pass dates.

---

## 2. False Positive Taxonomy & User-Facing Caveats

Detected spectral shifts from "forest-like" to "non-forest-like" do not necessarily indicate anthropogenic deforestation. ForestWatch AI surfaces explicit warnings for the following common confounds:

| Confound | Mechanism | Mitigation / Detection Rule |
|---|---|---|
| **Seasonal Leaf-Off** | Deciduous canopy phenology during dry or winter season causes steep NDVI drop. | Seasonality Guard checks day-of-year delta. If delta > 45 days, warning is attached. |
| **Cloud Shadow Remnants** | Cloud shadows darken NIR/SWIR and mimic vegetation clearing if undetected by SCL. | SCL mask dilation (2-3px); multi-temporal confirmation across subsequent cloud-free passes. |
| **Wildfire & Burn Scars** | Fires scorch vegetation rapidly; NBR drops precipitously without human tree felling. | Labeled as "Suspected Loss (Potential Burn Scar)" if SWIR/NBR drop is extreme. |
| **Plantation Harvest Cycles** | Oil palm, eucalyptus, or pine harvest and replanting cycles. | Platform caveats note that tree plantations exhibit cyclical clearing. |
| **Riparian & Flood Dynamics** | Riverbed shifts and seasonal river swelling submerge banks. | Water body masking via SCL water class and NDWI thresholds. |

---

## 3. Ground Truth Protocol for Human Review

For field research and academic verification, a stratified sample of detected polygons can be verified:
1. Sample 50 detections stratified by confidence class (Low, Medium, High).
2. Human analyst reviews high-resolution imagery (Planet / Sentinel-2 true-color B04-B03-B02 and false-color B08-B04-B03).
3. Record determination: True Canopy Loss, Phenological Shift, Agriculture/Pasture Cycle, Shadow/Artifact, or Unclear.
4. Precision metrics published in `analysis_validation` records.
