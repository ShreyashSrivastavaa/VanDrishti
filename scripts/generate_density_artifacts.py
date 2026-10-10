#!/usr/bin/env python3
"""
scripts/generate_density_artifacts.py

Generates continuous tree cover density overlay PNGs, GeoTIFFs, and binary sampling grids
for all existing observations in data/artifacts/observations.
"""

import sys
from pathlib import Path
import numpy as np
from PIL import Image

# Add project root to sys.path
root_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(root_dir))

from services.ml.forestwatch_ml.preprocessing.density import (
    compute_focal_density,
    render_density_overlay,
    export_density_cog,
    export_density_raw,
)

def process_all_observations():
    artifacts_dir = root_dir / "data" / "artifacts" / "observations"
    if not artifacts_dir.exists():
        print(f"Artifacts directory {artifacts_dir} does not exist.")
        return

    processed = 0
    for aoi_dir in artifacts_dir.iterdir():
        if not aoi_dir.is_dir():
            continue
        aoi_slug = aoi_dir.name
        for date_dir in aoi_dir.iterdir():
            if not date_dir.is_dir():
                continue

            preview_path = date_dir / "preview.png"
            forest_mask_path = date_dir / "forest_mask.png"

            if not forest_mask_path.exists():
                continue

            print(f"Processing AOI: {aoi_slug}, Date: {date_dir.name}...")

            # Load forest mask
            forest_img = Image.open(forest_mask_path).convert("RGBA")
            forest_arr = np.array(forest_img)
            # Alpha channel > 0 indicates forest pixel
            forest_mask = forest_arr[:, :, 3] > 0

            # Load valid mask from preview if available, else all True
            if preview_path.exists():
                preview_img = Image.open(preview_path).convert("RGBA")
                preview_arr = np.array(preview_img)
                valid_mask = preview_arr[:, :, 3] > 0
            else:
                valid_mask = np.ones(forest_mask.shape, dtype=bool)

            # Compute 11x11 focal density
            density = compute_focal_density(forest_mask, valid_mask, window_size=11)

            # Render overlay PNG
            overlay_bytes = render_density_overlay(density, valid_mask, alpha_val=0.85)
            with open(date_dir / "density_overlay.png", "wb") as f:
                f.write(overlay_bytes)

            # Export COG TIFF
            cog_bytes = export_density_cog(density)
            with open(date_dir / "density.tif", "wb") as f:
                f.write(cog_bytes)

            # Export raw sampling grid
            raw_bytes = export_density_raw(density)
            with open(date_dir / "density.raw", "wb") as f:
                f.write(raw_bytes)

            processed += 1
            print(f"  [OK] Saved density_overlay.png, density.tif, density.raw ({density.shape[1]}x{density.shape[0]})")

    print(f"\nSuccessfully generated density artifacts for {processed} observation passes.")

if __name__ == "__main__":
    process_all_observations()
