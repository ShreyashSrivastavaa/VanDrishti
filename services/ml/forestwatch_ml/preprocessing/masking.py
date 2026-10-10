import numpy as np
from scipy.ndimage import binary_dilation

# SCL class definitions
SCL_NO_DATA = 0
SCL_SATURATED = 1
SCL_DARK_AREA = 2
SCL_CLOUD_SHADOW = 3
SCL_VEGETATION = 4
SCL_NOT_VEGETATED = 5
SCL_WATER = 6
SCL_UNCLASSIFIED = 7
SCL_CLOUD_MEDIUM = 8
SCL_CLOUD_HIGH = 9
SCL_THIN_CIRRUS = 10
SCL_SNOW_ICE = 11

MASKED_SCL_CLASSES = {
    SCL_NO_DATA,
    SCL_SATURATED,
    SCL_CLOUD_SHADOW,
    SCL_CLOUD_MEDIUM,
    SCL_CLOUD_HIGH,
    SCL_THIN_CIRRUS,
    SCL_SNOW_ICE,
}

def create_scl_mask(scl: np.ndarray, dilate_px: int = 2) -> np.ndarray:
    """
    Creates a boolean mask where True indicates masked (cloud, shadow, invalid, snow) pixels.
    Dilates the mask by `dilate_px` to safeguard against cloud edge leakage.
    """
    masked = np.isin(scl, list(MASKED_SCL_CLASSES))
    if dilate_px > 0:
        struct = np.ones((dilate_px * 2 + 1, dilate_px * 2 + 1), dtype=bool)
        masked = binary_dilation(masked, structure=struct)
    return masked

def compute_quality_metrics(scl: np.ndarray, dilate_px: int = 2) -> dict:
    """
    Calculates valid land fraction and cloud/shadow fraction over the AOI grid.
    """
    total = scl.size
    if total == 0:
        return {"valid_fraction": 0.0, "cloud_fraction": 1.0, "usable": False}

    no_data_count = np.count_nonzero(scl == SCL_NO_DATA)
    cloud_count = np.count_nonzero(np.isin(scl, [SCL_CLOUD_SHADOW, SCL_CLOUD_MEDIUM, SCL_CLOUD_HIGH, SCL_THIN_CIRRUS]))
    
    masked = create_scl_mask(scl, dilate_px=dilate_px)
    valid_count = np.count_nonzero(~masked)

    valid_fraction = round(float(valid_count / total), 4)
    cloud_fraction = round(float(cloud_count / total), 4)

    return {
        "valid_fraction": valid_fraction,
        "cloud_fraction": cloud_fraction,
        "total_pixels": total,
        "valid_pixels": valid_count,
        "cloud_pixels": cloud_count,
    }
