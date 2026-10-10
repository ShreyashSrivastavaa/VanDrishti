import numpy as np
import pytest
from shapely.geometry import shape
from forestwatch_ml.change.polygonise import polygonise_components

def test_polygonise_roundtrip():
    # 50x50 grid with one labeled component of 100 pixels (10x10)
    labeled = np.zeros((50, 50), dtype=np.int32)
    labeled[10:20, 10:20] = 1 # 100 pixels = 1.0 ha

    p0 = np.full((50, 50), 0.85, dtype=np.float32)
    p1 = np.full((50, 50), 0.15, dtype=np.float32)
    d_ndvi = np.full((50, 50), -0.30, dtype=np.float32)

    bbox = (-63.25, -9.60, -63.05, -9.42)
    detections = polygonise_components(
        labeled, p0, p1, d_ndvi,
        valid_fraction_t0=0.92,
        valid_fraction_t1=0.88,
        aoi_bbox=bbox,
        date_t0_str="2021-08-15",
        date_t1_str="2023-08-18",
        pixel_size_m=10.0
    )

    assert len(detections) == 1
    det = detections[0]
    assert pytest.approx(det["area_ha"], 0.05) == 1.00
    assert det["confidence_class"] in ["medium", "high"]
    assert "explanation" in det
    assert len(det["explanation"]) > 20

    # Verify geometry is valid Shapely polygon
    geom = shape(det["geometry"])
    assert geom.is_valid
    assert not geom.is_empty
    # Centroid must be within bbox bounds
    assert bbox[0] <= geom.centroid.x <= bbox[2]
    assert bbox[1] <= geom.centroid.y <= bbox[3]
