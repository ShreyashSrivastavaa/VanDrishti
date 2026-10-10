import pytest
import numpy as np
from PIL import Image
import io

from forestwatch_ml.preprocessing.density import (
    compute_focal_density,
    render_density_overlay,
    export_density_cog,
    export_density_raw,
    RAMP_STOPS,
)

def test_focal_density_uniform_fields():
    # 25x25 grid
    h, w = 25, 25
    valid_mask = np.ones((h, w), dtype=bool)

    # 1. 100% forest
    forest_100 = np.ones((h, w), dtype=bool)
    density_100 = compute_focal_density(forest_100, valid_mask, window_size=11)
    # Interior pixels (away from borders) should be exactly 100
    assert np.all(density_100[5:-5, 5:-5] == 100)

    # 2. 0% forest
    forest_0 = np.zeros((h, w), dtype=bool)
    density_0 = compute_focal_density(forest_0, valid_mask, window_size=11)
    assert np.all(density_0[5:-5, 5:-5] == 0)

def test_focal_density_checkerboard_interior():
    h, w = 31, 31
    valid_mask = np.ones((h, w), dtype=bool)
    # Checkerboard pattern
    y, x = np.ogrid[:h, :w]
    checkerboard = (x + y) % 2 == 0

    density = compute_focal_density(checkerboard, valid_mask, window_size=11)
    # Interior pixels in an 11x11 window have 61 or 60 ones out of 121 (approx 50%)
    center_val = density[15, 15]
    assert 48 <= center_val <= 52

def test_focal_density_excludes_nodata_and_clouds():
    h, w = 21, 21
    # Right half is valid forest, left half is cloud/nodata
    forest_mask = np.ones((h, w), dtype=bool)
    valid_mask = np.zeros((h, w), dtype=bool)
    valid_mask[:, 10:] = True # only columns 10 to 20 are valid

    density = compute_focal_density(forest_mask, valid_mask, window_size=11)

    # Left half (invalid) must be 255 (nodata)
    assert np.all(density[:, :10] == 255)

    # Right half interior: since all valid pixels in the window are forest,
    # and invalid pixels on the left are EXCLUDED from the window,
    # the density must be 100% (not diluted by invalid pixels)!
    center_valid = density[10, 15]
    assert center_valid == 100

def test_render_density_overlay_ramp_and_transparency():
    # Synthetic array with tests for [0, 5, 10, 25, 45, 65, 80, 100, 255]
    density = np.array([
        [0, 5, 9],
        [10, 25, 45],
        [65, 80, 100],
        [255, 255, 255],
    ], dtype=np.uint8)

    png_bytes = render_density_overlay(density, alpha_val=0.85)
    img = Image.open(io.BytesIO(png_bytes))
    arr = np.array(img)

    # Check shape (4, 3, 4)
    assert arr.shape == (4, 3, 4)

    # 0%, 5%, 9% must be completely transparent (alpha = 0)
    assert arr[0, 0, 3] == 0
    assert arr[0, 1, 3] == 0
    assert arr[0, 2, 3] == 0

    # 10% must be visible with expected tint and alpha ~217
    assert arr[1, 0, 3] == 217
    assert arr[1, 0, 0] == 221 # R of #DDE5B8
    assert arr[1, 0, 1] == 229 # G of #DDE5B8
    assert arr[1, 0, 2] == 184 # B of #DDE5B8

    # 100% must be dark forest green #0F3A22
    assert arr[2, 2, 3] == 217
    assert arr[2, 2, 0] == 15
    assert arr[2, 2, 1] == 58
    assert arr[2, 2, 2] == 34

    # 255 (nodata) must be completely transparent
    assert arr[3, 0, 3] == 0
    assert arr[3, 1, 3] == 0
    assert arr[3, 2, 3] == 0

def test_export_density_cog_and_raw():
    density = np.zeros((10, 15), dtype=np.uint8)
    density[2:5, 3:7] = 75
    density[8, 8] = 255

    cog_bytes = export_density_cog(density)
    assert len(cog_bytes) > 0
    # Can be re-opened as TIFF image
    re_img = Image.open(io.BytesIO(cog_bytes))
    assert re_img.size == (15, 10)

    raw_bytes = export_density_raw(density)
    # 8-byte header + 150 bytes
    assert len(raw_bytes) == 8 + (10 * 15)
