import io
import struct
from typing import Optional, Tuple
import numpy as np
from PIL import Image
from scipy.ndimage import convolve

# Defined color stops for the Tree Cover Density continuous ramp:
# 10%:  #DDE5B8 (221, 229, 184)
# 25%:  #B5CC84 (181, 204, 132)
# 45%:  #7FA65A (127, 166, 90)
# 65%:  #3F7D43 (63, 125, 67)
# 80%:  #1F5A32 (31, 90, 50)
# 90%:  #174A2A (intermediate transition to 100%)
# 100%: #0F3A22 (15, 58, 34)
RAMP_STOPS = [
    (10.0, (221, 229, 184)),
    (25.0, (181, 204, 132)),
    (45.0, (127, 166, 90)),
    (65.0, (63, 125, 67)),
    (80.0, (31, 90, 50)),
    (90.0, (23, 74, 42)),
    (100.0, (15, 58, 34)),
]

def _build_density_lut(alpha_val: float = 0.85) -> np.ndarray:
    """
    Builds a 256x4 RGBA lookup table for continuous density mapping [0..100].
    Values < 10% are completely transparent.
    Values 10-100% are smoothly interpolated.
    Values > 100 (e.g. 255 for nodata) are completely transparent.
    """
    lut = np.zeros((256, 4), dtype=np.uint8)
    alpha_int = int(np.clip(round(255 * alpha_val), 0, 255))

    for val in range(10, 101):
        # Find enclosing stops
        for i in range(len(RAMP_STOPS) - 1):
            p0, c0 = RAMP_STOPS[i]
            p1, c1 = RAMP_STOPS[i + 1]
            if p0 <= val <= p1:
                t = (val - p0) / (p1 - p0) if p1 > p0 else 0.0
                r = int(round((1.0 - t) * c0[0] + t * c1[0]))
                g = int(round((1.0 - t) * c0[1] + t * c1[1]))
                b = int(round((1.0 - t) * c0[2] + t * c1[2]))
                lut[val] = [r, g, b, alpha_int]
                break

    return lut

def compute_focal_density(
    forest_mask: np.ndarray,
    valid_mask: np.ndarray,
    window_size: int = 11,
) -> np.ndarray:
    """
    Computes moving window tree cover density as the percentage of valid forest pixels
    within an 11x11 pixel moving window (~110m at 10m resolution).
    
    Cloud/nodata pixels are excluded from both the numerator and the denominator.
    If the center pixel is invalid or no valid pixels exist in the window,
    the output pixel is set to 255 (nodata).
    
    Returns uint8 array of shape matching forest_mask:
    - 0-100: valid percentage
    - 255: cloud/nodata
    """
    if forest_mask.shape != valid_mask.shape:
        raise ValueError("forest_mask and valid_mask must have identical shapes")

    h, w = forest_mask.shape
    kernel = np.ones((window_size, window_size), dtype=np.float32)

    # Boolean to float for convolution
    valid_b = valid_mask.astype(bool)
    forest_valid = (forest_mask.astype(bool) & valid_b).astype(np.float32)
    valid_float = valid_b.astype(np.float32)

    # Valid-pixel-aware moving window counts
    num = convolve(forest_valid, kernel, mode="constant", cval=0.0)
    den = convolve(valid_float, kernel, mode="constant", cval=0.0)

    # Output array initialized to 255 (nodata)
    density = np.full((h, w), 255, dtype=np.uint8)

    # Only valid pixels with at least one valid neighbor get a score
    compute_mask = valid_b & (den > 0.0)
    if np.any(compute_mask):
        pct = np.clip(np.round((num[compute_mask] / den[compute_mask]) * 100.0), 0.0, 100.0)
        density[compute_mask] = pct.astype(np.uint8)

    return density

def render_density_overlay(
    density: np.ndarray,
    valid_mask: Optional[np.ndarray] = None,
    alpha_val: float = 0.85,
) -> bytes:
    """
    Renders an RGBA PNG overlay for the tree cover density layer using the
    continuous, sequential, color-blind safe green ramp.
    """
    lut = _build_density_lut(alpha_val=alpha_val)
    rgba = lut[density]

    if valid_mask is not None:
        invalid = ~valid_mask.astype(bool)
        rgba[invalid] = [0, 0, 0, 0]

    # Explicitly ensure nodata (255) is transparent
    rgba[density == 255] = [0, 0, 0, 0]

    img = Image.fromarray(rgba, mode="RGBA")
    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    return buf.getvalue()

def export_density_cog(density: np.ndarray) -> bytes:
    """
    Exports the uint8 density raster (0-100, 255 nodata) as a TIFF artifact.
    """
    img = Image.fromarray(density, mode="L")
    buf = io.BytesIO()
    img.save(buf, format="TIFF", compression="raw")
    return buf.getvalue()

def export_density_raw(density: np.ndarray) -> bytes:
    """
    Exports a binary format [uint32 width, uint32 height, bytes] for sub-millisecond
    lat/lon sampling in backend APIs without decompression overhead.
    """
    h, w = density.shape
    header = struct.pack(">II", w, h)
    return header + density.tobytes()
