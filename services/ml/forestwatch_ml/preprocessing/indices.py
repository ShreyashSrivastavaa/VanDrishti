import numpy as np

def compute_ndvi(b08: np.ndarray, b04: np.ndarray, eps: float = 1e-6) -> np.ndarray:
    """Normalized Difference Vegetation Index: (NIR - Red) / (NIR + Red)"""
    denom = b08 + b04
    denom = np.where(np.abs(denom) < eps, eps, denom)
    ndvi = (b08 - b04) / denom
    return np.clip(ndvi, -1.0, 1.0)

def compute_nbr(b08: np.ndarray, b12: np.ndarray, eps: float = 1e-6) -> np.ndarray:
    """Normalized Burn Ratio: (NIR - SWIR2) / (NIR + SWIR2)"""
    denom = b08 + b12
    denom = np.where(np.abs(denom) < eps, eps, denom)
    nbr = (b08 - b12) / denom
    return np.clip(nbr, -1.0, 1.0)

def compute_ndwi(b03: np.ndarray, b08: np.ndarray, eps: float = 1e-6) -> np.ndarray:
    """Normalized Difference Water Index (McFeeters): (Green - NIR) / (Green + NIR)"""
    denom = b03 + b08
    denom = np.where(np.abs(denom) < eps, eps, denom)
    ndwi = (b03 - b08) / denom
    return np.clip(ndwi, -1.0, 1.0)

def scale_reflectance(
    band: np.ndarray,
    scale_factor: float = 0.0001,
    offset: float = 0.0,
    clip_min: float = 0.0,
    clip_max: float = 1.0,
) -> np.ndarray:
    """
    Applies Sentinel-2 BOA scale factor and baseline offset.
    For post-Jan 2022 Sentinel-2 baseline 04.00+, BOA_ADD_OFFSET is -1000 DN.
    reflectance = (DN + offset) * scale_factor
    """
    refl = (band.astype(np.float32) + offset) * scale_factor
    return np.clip(refl, clip_min, clip_max)
