import numpy as np
from typing import List, Dict, Any, Tuple
from shapely.geometry import Polygon, MultiPolygon, Point, mapping, box
import json

def polygonise_components(
    labeled_arr: np.ndarray,
    p_forest_t0: np.ndarray,
    p_forest_t1: np.ndarray,
    delta_ndvi: np.ndarray,
    valid_fraction_t0: float,
    valid_fraction_t1: float,
    aoi_bbox: Tuple[float, float, float, float],
    date_t0_str: str,
    date_t1_str: str,
    pixel_size_m: float = 10.0,
) -> List[Dict[str, Any]]:
    """
    Extracts vector polygons from labeled components and computes full attributes.
    """
    height, width = labeled_arr.shape
    min_lon, min_lat, max_lon, max_lat = aoi_bbox

    pixel_width_deg = (max_lon - min_lon) / width
    pixel_height_deg = (max_lat - min_lat) / height
    pixel_area_ha = (pixel_size_m * pixel_size_m) / 10000.0

    max_label = int(np.max(labeled_arr))
    detections: List[Dict[str, Any]] = []

    for comp_id in range(1, max_label + 1):
        comp_mask = labeled_arr == comp_id
        pixel_count = np.count_nonzero(comp_mask)
        if pixel_count == 0:
            continue

        area_ha = round(float(pixel_count * pixel_area_ha), 2)

        # Pixel coordinates bounding box of the component
        ys, xs = np.where(comp_mask)
        min_x, max_x = int(np.min(xs)), int(np.max(xs)) + 1
        min_y, max_y = int(np.min(ys)), int(np.max(ys)) + 1

        # Transform to geographic coords
        geo_min_lon = min_lon + min_x * pixel_width_deg
        geo_max_lon = min_lon + max_x * pixel_width_deg
        # Y is inverted (row 0 is max_lat)
        geo_max_lat = max_lat - min_y * pixel_height_deg
        geo_min_lat = max_lat - max_y * pixel_height_deg

        poly = box(geo_min_lon, geo_min_lat, geo_max_lon, geo_max_lat)
        centroid = poly.centroid

        # Per-detection metrics
        comp_p0 = p_forest_t0[comp_mask]
        comp_p1 = p_forest_t1[comp_mask]
        comp_p_loss = np.minimum(comp_p0, 1.0 - comp_p1)
        mean_p_loss = round(float(np.nanmean(comp_p_loss)), 4)

        comp_d_ndvi = delta_ndvi[comp_mask]
        mean_ndvi_drop = round(float(np.nanmean(comp_d_ndvi)), 4)

        # Confidence class heuristic rule
        conf_score = round(float(0.60 * mean_p_loss + 0.25 * min(1.0, area_ha / 5.0) + 0.15 * min(valid_fraction_t0, valid_fraction_t1)), 4)
        if conf_score >= 0.75 and area_ha >= 1.0:
            conf_class = "high"
        elif conf_score >= 0.55:
            conf_class = "medium"
        else:
            conf_class = "low"

        # Structured, templated explanation
        explanation = (
            f"Between {date_t0_str} and {date_t1_str}, an area of approximately {area_ha} ha changed "
            f"from forest-like (p≥0.70) to non-forest-like cover, accompanied by a mean NDVI decline of {abs(mean_ndvi_drop):.2f}. "
            f"Both satellite acquisitions had adequate clear-sky coverage (t0: {int(valid_fraction_t0*100)}%, t1: {int(valid_fraction_t1*100)}%). "
            "This change may represent canopy clearing, but could also result from seasonal leaf-off, agricultural harvesting, or fire."
        )

        detections.append({
            "geometry": mapping(poly),
            "centroid": [round(centroid.x, 5), round(centroid.y, 5)],
            "area_ha": area_ha,
            "mean_p_loss": mean_p_loss,
            "mean_ndvi_drop": mean_ndvi_drop,
            "valid_fraction_t0": valid_fraction_t0,
            "valid_fraction_t1": valid_fraction_t1,
            "confirmed_persistent": None,
            "confidence_score": conf_score,
            "confidence_class": conf_class,
            "is_calibrated_confidence": False,
            "explanation": explanation,
        })

    return detections
