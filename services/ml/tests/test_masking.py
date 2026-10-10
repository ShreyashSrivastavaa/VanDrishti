import numpy as np
import pytest
from forestwatch_ml.preprocessing.masking import (
    create_scl_mask,
    compute_quality_metrics,
    SCL_VEGETATION,
    SCL_CLOUD_MEDIUM,
    SCL_CLOUD_SHADOW,
    SCL_NOT_VEGETATED,
)

def test_scl_mask_classes():
    # Grid with 1 vegetation pixel, 1 cloud pixel, 1 shadow pixel, 1 soil pixel
    scl = np.array([
        [SCL_VEGETATION, SCL_NOT_VEGETATED],
        [SCL_CLOUD_MEDIUM, SCL_CLOUD_SHADOW]
    ], dtype=np.uint8)

    mask = create_scl_mask(scl, dilate_px=0)
    assert not mask[0, 0] # vegetation clear
    assert not mask[0, 1] # soil clear
    assert mask[1, 0]     # cloud masked
    assert mask[1, 1]     # shadow masked

def test_scl_dilation():
    # 5x5 grid with single cloud pixel in center
    scl = np.full((5, 5), SCL_VEGETATION, dtype=np.uint8)
    scl[2, 2] = SCL_CLOUD_MEDIUM

    mask_undilated = create_scl_mask(scl, dilate_px=0)
    assert np.count_nonzero(mask_undilated) == 1

    mask_dilated = create_scl_mask(scl, dilate_px=1)
    # 1 pixel dilated with 3x3 footprint -> 9 pixels
    assert np.count_nonzero(mask_dilated) == 9

def test_quality_metrics():
    scl = np.array([
        [SCL_VEGETATION, SCL_VEGETATION],
        [SCL_VEGETATION, SCL_CLOUD_MEDIUM]
    ], dtype=np.uint8)

    quality = compute_quality_metrics(scl, dilate_px=0)
    assert quality["total_pixels"] == 4
    assert quality["valid_pixels"] == 3
    assert quality["valid_fraction"] == 0.75
    assert quality["cloud_fraction"] == 0.25
