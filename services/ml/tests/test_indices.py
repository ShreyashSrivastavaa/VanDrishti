import numpy as np
import pytest
from forestwatch_ml.preprocessing.indices import (
    compute_ndvi,
    compute_nbr,
    compute_ndwi,
    scale_reflectance,
)

def test_compute_ndvi_basic():
    # Dense vegetation: NIR=0.8, Red=0.1 -> (0.8 - 0.1) / (0.8 + 0.1) = 0.7 / 0.9 ~= 0.7778
    b08 = np.array([0.8], dtype=np.float32)
    b04 = np.array([0.1], dtype=np.float32)
    ndvi = compute_ndvi(b08, b04)
    assert pytest.approx(ndvi[0], 0.001) == 0.7778

def test_compute_ndvi_water_bare_soil():
    # Water: NIR=0.05, Red=0.15 -> negative NDVI
    b08 = np.array([0.05], dtype=np.float32)
    b04 = np.array([0.15], dtype=np.float32)
    ndvi = compute_ndvi(b08, b04)
    assert ndvi[0] < 0.0

def test_compute_ndvi_zero_division():
    # Avoid zero division with epsilon
    b08 = np.array([0.0], dtype=np.float32)
    b04 = np.array([0.0], dtype=np.float32)
    ndvi = compute_ndvi(b08, b04)
    assert not np.isnan(ndvi[0])
    assert not np.isinf(ndvi[0])

def test_compute_nbr():
    # Unburnt healthy canopy: NIR=0.7, SWIR2=0.1 -> NBR = 0.6 / 0.8 = 0.75
    b08 = np.array([0.7], dtype=np.float32)
    b12 = np.array([0.1], dtype=np.float32)
    nbr = compute_nbr(b08, b12)
    assert pytest.approx(nbr[0], 0.001) == 0.75

def test_scale_reflectance():
    # 10000 DN with 0.0001 scale -> 1.0
    dn = np.array([10000, 5000, 0], dtype=np.int32)
    refl = scale_reflectance(dn, scale_factor=0.0001)
    assert pytest.approx(refl[0], 0.001) == 1.0
    assert pytest.approx(refl[1], 0.001) == 0.5
    assert pytest.approx(refl[2], 0.001) == 0.0
