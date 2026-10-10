import numpy as np
from ..preprocessing.indices import compute_ndvi, compute_nbr

class SpectralBaselineModel:
    """
    Transparent, rule-based spectral classifier for Sentinel-2 Level-2A.
    Calibrated against ESA WorldCover tree cover class 10.
    """

    def __init__(
        self,
        ndvi_threshold: float = 0.65,
        nbr_threshold: float = 0.38,
        swir_max: float = 0.18,
    ):
        self.ndvi_threshold = ndvi_threshold
        self.nbr_threshold = nbr_threshold
        self.swir_max = swir_max

    def predict_probabilities(
        self,
        b04: np.ndarray,
        b08: np.ndarray,
        b11: np.ndarray,
        b12: np.ndarray,
        masked: np.ndarray,
    ) -> np.ndarray:
        """
        Computes continuous forest probability p_forest in [0.0, 1.0].
        Where masked is True, returns NaN.
        """
        ndvi = compute_ndvi(b08, b04)
        nbr = compute_nbr(b08, b12)

        # Distance from threshold decision boundary
        d_ndvi = (ndvi - self.ndvi_threshold) / 0.15
        d_nbr = (nbr - self.nbr_threshold) / 0.15
        d_swir = (self.swir_max - b11) / 0.10

        composite_score = (0.50 * d_ndvi + 0.35 * d_nbr + 0.15 * d_swir)

        # Smooth sigmoid mapping
        p_forest = 1.0 / (1.0 + np.exp(-3.0 * composite_score))
        p_forest = np.clip(p_forest, 0.0, 1.0)

        # Set masked/cloud pixels to NaN
        p_forest[masked] = np.nan
        return p_forest

    def classify(
        self,
        p_forest: np.ndarray,
        threshold: float = 0.50,
    ) -> np.ndarray:
        """Binary forest mask: True where p_forest >= threshold and not NaN."""
        return np.where(np.isnan(p_forest), False, p_forest >= threshold)

    def compute_summary_statistics(
        self,
        p_forest: np.ndarray,
        pixel_size_m: float = 10.0,
    ) -> dict:
        """
        Calculates forest area in hectares (in projected UTM CRS),
        forest fraction over clear pixels, and mean confidence.
        """
        valid_mask = ~np.isnan(p_forest)
        valid_pixels = np.count_nonzero(valid_mask)

        if valid_pixels == 0:
            return {
                "forest_area_ha": 0.0,
                "forest_fraction": 0.0,
                "mean_confidence": 0.0,
                "valid_fraction": 0.0,
            }

        forest_mask = self.classify(p_forest, threshold=0.50)
        forest_pixels = np.count_nonzero(forest_mask)

        # 1 pixel at 10m = 100 m² = 0.01 hectares
        pixel_area_ha = (pixel_size_m * pixel_size_m) / 10000.0
        forest_area_ha = round(float(forest_pixels * pixel_area_ha), 2)
        forest_fraction = round(float(forest_pixels / valid_pixels), 4)

        # Mean confidence over predicted class
        conf = np.where(forest_mask, p_forest, 1.0 - p_forest)
        mean_confidence = round(float(np.nanmean(conf)), 4)

        return {
            "forest_area_ha": forest_area_ha,
            "forest_fraction": forest_fraction,
            "mean_confidence": mean_confidence,
            "forest_pixels": forest_pixels,
            "valid_pixels": valid_pixels,
        }
