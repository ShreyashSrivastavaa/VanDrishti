import numpy as np
from scipy.ndimage import binary_opening, binary_closing, label
from typing import Dict, Any, List, Tuple
from datetime import date
from ..preprocessing.indices import compute_ndvi, compute_nbr

class ChangeDetector:
    def __init__(
        self,
        t_high: float = 0.70,
        t_low: float = 0.30,
        min_ndvi_drop: float = 0.15,
        min_nbr_drop: float = 0.10,
        min_mapping_unit_ha: float = 0.50,
        season_tolerance_days: int = 45,
    ):
        self.t_high = t_high
        self.t_low = t_low
        self.min_ndvi_drop = min_ndvi_drop
        self.min_nbr_drop = min_nbr_drop
        self.min_mapping_unit_ha = min_mapping_unit_ha
        self.season_tolerance_days = season_tolerance_days

    def detect_loss_candidates(
        self,
        p_forest_t0: np.ndarray,
        p_forest_t1: np.ndarray,
        ndvi_t0: np.ndarray,
        ndvi_t1: np.ndarray,
        nbr_t0: np.ndarray,
        nbr_t1: np.ndarray,
        pixel_size_m: float = 10.0,
    ) -> Tuple[np.ndarray, np.ndarray, List[str]]:
        """
        Executes bi-temporal change detection pipeline.
        Returns:
            - binary_loss_mask (2D boolean array)
            - labeled_components (2D int array, 0 is background)
            - warnings (List[str])
        """
        warnings: List[str] = []

        # 1. Valid in both passes
        valid_both = ~np.isnan(p_forest_t0) & ~np.isnan(p_forest_t1)

        # 2. Hysteresis classification
        candidate = valid_both & (p_forest_t0 >= self.t_high) & (p_forest_t1 <= self.t_low)

        # 3. Spectral sanity checks
        delta_ndvi = ndvi_t1 - ndvi_t0
        delta_nbr = nbr_t1 - nbr_t0
        spectral_pass = candidate & (delta_ndvi <= -self.min_ndvi_drop) & (delta_nbr <= -self.min_nbr_drop)

        # 4. Morphological noise filtering
        # Opening removes salt-and-pepper spikes
        struct = np.ones((3, 3), dtype=bool)
        cleaned = binary_opening(spectral_pass, structure=struct)
        cleaned = binary_closing(cleaned, structure=struct)

        # 5. Connected component labeling & MMU threshold
        labeled_arr, num_features = label(cleaned, structure=struct)
        final_loss = np.zeros_like(cleaned, dtype=bool)
        final_labeled = np.zeros_like(labeled_arr, dtype=np.int32)

        # 1 pixel at 10m = 0.01 ha. Minimum pixels for MMU:
        min_pixels = int(np.ceil(self.min_mapping_unit_ha / ((pixel_size_m * pixel_size_m) / 10000.0)))

        next_label = 1
        for comp_id in range(1, num_features + 1):
            comp_mask = labeled_arr == comp_id
            comp_size = np.count_nonzero(comp_mask)
            if comp_size >= min_pixels:
                final_loss[comp_mask] = True
                final_labeled[comp_mask] = next_label
                next_label += 1

        return final_loss, final_labeled, warnings

    def check_seasonality(self, date_t0: date, date_t1: date) -> List[str]:
        """Flags potential seasonal phenology mismatch."""
        warnings: List[str] = []
        doy0 = date_t0.timetuple().tm_yday
        doy1 = date_t1.timetuple().tm_yday
        doy_diff = abs(doy0 - doy1)
        if doy_diff > 182:
            doy_diff = 365 - doy_diff

        if doy_diff > self.season_tolerance_days and date_t0.year != date_t1.year:
            warnings.append(
                f"Seasonality Warning: Observation day-of-year difference is {doy_diff} days (exceeds {self.season_tolerance_days}-day tolerance). "
                "Seasonal dry-season leaf drop may contribute to spectral change. Prefer anniversary comparisons."
            )
        return warnings
