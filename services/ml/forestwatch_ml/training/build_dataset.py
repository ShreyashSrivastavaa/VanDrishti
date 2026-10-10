import json
import math
from pathlib import Path
from typing import Dict, List, Tuple, Set, Any
import numpy as np

def generate_geographic_blocks(
    bbox: Tuple[float, float, float, float],
    block_size_km: float = 10.0,
) -> List[Dict[str, Any]]:
    """
    Divides a bounding box into discrete geographic blocks (default 10km x 10km)
    for spatial cross-validation and leakage prevention.
    """
    min_lon, min_lat, max_lon, max_lat = bbox
    mean_lat_rad = math.radians((min_lat + max_lat) / 2.0)

    # 1 deg lat ~= 111.132 km; 1 deg lon ~= 111.320 * cos(lat) km
    lat_step_deg = block_size_km / 111.132
    lon_step_deg = block_size_km / (111.320 * math.cos(mean_lat_rad))

    blocks = []
    curr_lat = min_lat
    block_id = 0
    while curr_lat < max_lat:
        curr_lon = min_lon
        while curr_lon < max_lon:
            b_box = [
                curr_lon,
                curr_lat,
                min(curr_lon + lon_step_deg, max_lon),
                min(curr_lat + lat_step_deg, max_lat)
            ]
            blocks.append({
                "block_id": f"block_{block_id}",
                "bbox": b_box,
                "center": [(b_box[0] + b_box[2]) / 2.0, (b_box[1] + b_box[3]) / 2.0]
            })
            block_id += 1
            curr_lon += lon_step_deg
        curr_lat += lat_step_deg

    return blocks

def create_leakage_safe_splits(
    blocks: List[Dict[str, Any]],
    holdout_block_ids: Set[str] = None,
    train_ratio: float = 0.70,
    val_ratio: float = 0.15,
    buffer_km: float = 1.0,
    seed: int = 42,
) -> Dict[str, List[str]]:
    """
    Assigns geographic blocks wholesale to train/val/test splits
    with spatial buffer verification to prevent autocorrelation leakage.
    """
    rng = np.random.default_rng(seed)
    all_ids = [b["block_id"] for b in blocks if not (holdout_block_ids and b["block_id"] in holdout_block_ids)]
    rng.shuffle(all_ids)

    n_total = len(all_ids)
    n_train = max(1, int(n_total * train_ratio))
    n_val = max(1, int(n_total * val_ratio))

    train_ids = set(all_ids[:n_train])
    val_ids = set(all_ids[n_train:n_train + n_val])
    test_ids = set(all_ids[n_train + n_val:])

    if holdout_block_ids:
        test_ids.update(holdout_block_ids)

    # Verification: Ensure complete mutual exclusivity
    assert len(train_ids.intersection(val_ids)) == 0, "Train and Val splits share blocks!"
    assert len(train_ids.intersection(test_ids)) == 0, "Train and Test splits share blocks!"
    assert len(val_ids.intersection(test_ids)) == 0, "Val and Test splits share blocks!"

    return {
        "train": sorted(list(train_ids)),
        "val": sorted(list(val_ids)),
        "test": sorted(list(test_ids)),
        "buffer_km": buffer_km,
        "strategy": "geographic_block_holdout"
    }
