import numpy as np
import pytest
from datetime import date
from forestwatch_ml.change.detect import ChangeDetector

def test_hysteresis_and_mmu_filter():
    detector = ChangeDetector(
        t_high=0.70,
        t_low=0.30,
        min_ndvi_drop=0.15,
        min_nbr_drop=0.10,
        min_mapping_unit_ha=0.50, # 50 pixels at 10m
    )

    # 40x40 grid (1600 pixels)
    p0 = np.full((40, 40), 0.85, dtype=np.float32)
    p1 = np.full((40, 40), 0.85, dtype=np.float32)

    ndvi0 = np.full((40, 40), 0.75, dtype=np.float32)
    ndvi1 = np.full((40, 40), 0.75, dtype=np.float32)

    nbr0 = np.full((40, 40), 0.60, dtype=np.float32)
    nbr1 = np.full((40, 40), 0.60, dtype=np.float32)

    # 1. Inject a below-MMU noise patch: 4x4 = 16 pixels (< 50 pixels threshold)
    p1[2:6, 2:6] = 0.15
    ndvi1[2:6, 2:6] = 0.20
    nbr1[2:6, 2:6] = 0.10

    # 2. Inject an above-MMU real clearing: 10x8 = 80 pixels (>= 50 pixels threshold = 0.8 ha)
    p1[15:25, 15:23] = 0.15
    ndvi1[15:25, 15:23] = 0.20
    nbr1[15:25, 15:23] = 0.10

    # 3. Inject a boundary flicker patch: p1=0.45 (rejected by t_low=0.30 hysteresis)
    p1[30:38, 30:38] = 0.45
    ndvi1[30:38, 30:38] = 0.20
    nbr1[30:38, 30:38] = 0.10

    loss_mask, labeled_arr, warnings = detector.detect_loss_candidates(
        p0, p1, ndvi0, ndvi1, nbr0, nbr1, pixel_size_m=10.0
    )

    # Below-MMU patch (4x4) should be removed
    assert not np.any(loss_mask[2:6, 2:6])

    # Boundary flicker (p1=0.45) should be rejected
    assert not np.any(loss_mask[30:38, 30:38])

    # Above-MMU patch (80 pixels) should be retained
    assert np.count_nonzero(loss_mask[15:25, 15:23]) > 0

def test_cloud_masked_pixels_excluded():
    detector = ChangeDetector()

    p0 = np.full((10, 10), 0.85, dtype=np.float32)
    p1 = np.full((10, 10), 0.10, dtype=np.float32)
    # Mark as cloudy at t1 (NaN)
    p1[0:5, 0:5] = np.nan

    ndvi0 = np.full((10, 10), 0.75, dtype=np.float32)
    ndvi1 = np.full((10, 10), 0.20, dtype=np.float32)
    nbr0 = np.full((10, 10), 0.60, dtype=np.float32)
    nbr1 = np.full((10, 10), 0.10, dtype=np.float32)

    loss_mask, labeled, _ = detector.detect_loss_candidates(
        p0, p1, ndvi0, ndvi1, nbr0, nbr1
    )

    # Cloudy region must be excluded
    assert not np.any(loss_mask[0:5, 0:5])

def test_seasonality_guard():
    detector = ChangeDetector(season_tolerance_days=45)

    # Non-consecutive years with 120-day DOY delta
    d0 = date(2021, 2, 1)  # DOY ~32
    d1 = date(2023, 7, 15) # DOY ~196 (delta ~164 days > 45)

    warnings = detector.check_seasonality(d0, d1)
    assert len(warnings) == 1
    assert "Seasonality Warning" in warnings[0]

    # Anniversary dates (same DOY window)
    d2 = date(2021, 8, 15)
    d3 = date(2023, 8, 20)
    warnings_anniv = detector.check_seasonality(d2, d3)
    assert len(warnings_anniv) == 0
