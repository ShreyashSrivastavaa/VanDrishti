import numpy as np
import pytest
from forestwatch_ml.models.spectral_baseline import SpectralBaselineModel

def test_utm_area_calculation_10x10_square():
    """
    Test area calculation with known synthetic square:
    10x10 pixels at 10m grid = 100 pixels * 100 m² = 10,000 m² = exactly 1.0 hectare.
    """
    model = SpectralBaselineModel()

    # 20x20 grid, 10x10 sub-block of forest probability 0.90
    p_forest = np.full((20, 20), 0.10, dtype=np.float32)
    p_forest[5:15, 5:15] = 0.90 # exactly 10x10 = 100 pixels

    stats = model.compute_summary_statistics(p_forest, pixel_size_m=10.0)

    assert stats["forest_pixels"] == 100
    assert stats["forest_area_ha"] == 1.00 # 1.00 ha
    assert stats["forest_fraction"] == 100 / 400 # 0.25

def test_spectral_baseline_classification():
    model = SpectralBaselineModel()

    # Synthetic canopy spectral reflectance
    b04 = np.array([[0.04]], dtype=np.float32) # low red
    b08 = np.array([[0.75]], dtype=np.float32) # high NIR
    b11 = np.array([[0.10]], dtype=np.float32) # low SWIR
    b12 = np.array([[0.08]], dtype=np.float32) # low SWIR
    masked = np.array([[False]], dtype=bool)

    prob = model.predict_probabilities(b04, b08, b11, b12, masked)
    assert prob[0, 0] > 0.70

    # Masked pixel should be NaN
    masked_true = np.array([[True]], dtype=bool)
    prob_masked = model.predict_probabilities(b04, b08, b11, b12, masked_true)
    assert np.isnan(prob_masked[0, 0])
