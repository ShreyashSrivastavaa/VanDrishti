import io
import numpy as np
from PIL import Image

def render_rgb_preview(
    b04: np.ndarray,
    b03: np.ndarray,
    b02: np.ndarray,
    masked: np.ndarray,
    p2: float = 0.02,
    p98: float = 0.25,
) -> bytes:
    """
    Renders Sentinel-2 true-color preview (B04 Red, B03 Green, B02 Blue)
    using 2-98 percentile stretch and alpha masking over invalid/cloud pixels.
    """
    height, width = b04.shape

    # Contrast stretch: normalize [p2, p98] -> [0, 255]
    def stretch(band: np.ndarray) -> np.ndarray:
        valid_vals = band[~masked] if np.any(~masked) else band
        low = np.percentile(valid_vals, 2) if len(valid_vals) > 0 else p2
        high = np.percentile(valid_vals, 98) if len(valid_vals) > 0 else p98
        if high <= low:
            high = low + 0.1
        normalized = np.clip((band - low) / (high - low), 0.0, 1.0)
        return (normalized * 255).astype(np.uint8)

    r = stretch(b04)
    g = stretch(b03)
    b = stretch(b02)

    # Alpha channel: 0 where masked, 255 where clear
    alpha = np.where(masked, 0, 255).astype(np.uint8)

    rgba = np.stack([r, g, b, alpha], axis=-1)
    img = Image.fromarray(rgba, mode="RGBA")

    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    return buf.getvalue()

def render_forest_overlay(forest_mask: np.ndarray, alpha_val: float = 0.45) -> bytes:
    """Renders RGBA forest mask overlay: olive tint (#6E7541)."""
    height, width = forest_mask.shape
    r = np.full((height, width), 110, dtype=np.uint8)
    g = np.full((height, width), 117, dtype=np.uint8)
    b = np.full((height, width), 65, dtype=np.uint8)
    a = np.where(forest_mask, int(255 * alpha_val), 0).astype(np.uint8)

    rgba = np.stack([r, g, b, a], axis=-1)
    img = Image.fromarray(rgba, mode="RGBA")

    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    return buf.getvalue()

def render_loss_overlay(loss_mask: np.ndarray, alpha_val: float = 0.65) -> bytes:
    """Renders RGBA suspected loss overlay: red-orange tint (#B5402B)."""
    height, width = loss_mask.shape
    r = np.full((height, width), 181, dtype=np.uint8)
    g = np.full((height, width), 64, dtype=np.uint8)
    b = np.full((height, width), 43, dtype=np.uint8)
    a = np.where(loss_mask, int(255 * alpha_val), 0).astype(np.uint8)

    rgba = np.stack([r, g, b, a], axis=-1)
    img = Image.fromarray(rgba, mode="RGBA")

    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    return buf.getvalue()
