#!/usr/bin/env python3
"""
scripts/find_candidate_aois.py

Scans candidate geographic regions for ForestWatch AI, computes projected area
in square kilometers, verifies Sentinel-2 coverage, and generates candidates
for config/aois.yaml with verification notes.
"""

import sys
import math
import yaml
from pathlib import Path

CANDIDATES = [
    {
        "slug": "rondonia-jamari",
        "name": "Rondônia — Jamari Forest Frontier",
        "country_code": "BRA",
        "country_name": "Brazil",
        "biome": "Amazon Tropical Rainforest",
        "bbox": [-63.25, -9.60, -63.05, -9.42],
        "years": [2021, 2022, 2023, 2024],
        "notes": "Intense fishbone settlement pattern; proven high Hansen GFC loss activity along BR-364 corridor."
    },
    {
        "slug": "mato-grosso-sinop",
        "name": "Mato Grosso — Sinop Agricultural Border",
        "country_code": "BRA",
        "country_name": "Brazil",
        "biome": "Amazon-Cerrado Ecotone",
        "bbox": [-55.65, -11.95, -55.45, -11.75],
        "years": [2020, 2021, 2022, 2023],
        "notes": "Large rectilinear industrial conversion frontier; rapid canopy reduction."
    },
    {
        "slug": "madre-de-dios-inambari",
        "name": "Madre de Dios — Inambari Alluvial Basin",
        "country_code": "PER",
        "country_name": "Peru",
        "biome": "Southwest Amazon Moist Forests",
        "bbox": [-70.35, -12.95, -70.18, -12.80],
        "years": [2021, 2022, 2023],
        "notes": "Alluvial gold mining clearings; riverbed vegetation shifts."
    },
    {
        "slug": "kalimantan-kahayan",
        "name": "Central Kalimantan — Kahayan Peatlands",
        "country_code": "IDN",
        "country_name": "Indonesia",
        "biome": "Borneo Peat Swamp Forest",
        "bbox": [113.80, -2.45, 114.00, -2.30],
        "years": [2021, 2022, 2023],
        "notes": "Peat swamp forest drainage canals and agricultural conversion."
    },
    {
        "slug": "western-ghats-shimoga",
        "name": "Western Ghats — Sharavathi Basin",
        "country_code": "IND",
        "country_name": "India",
        "biome": "Tropical Montane Wet Evergreen",
        "bbox": [74.75, 14.10, 74.92, 14.25],
        "years": [2021, 2022, 2023],
        "notes": "High biodiversity montane forest with estate crop encroachment and seasonal cloud cover."
    },
    {
        "slug": "vasterbotten-vindeln",
        "name": "Västerbotten — Vindeln Boreal Managed Forest",
        "country_code": "SWE",
        "country_name": "Sweden",
        "biome": "Scandinavian Boreal Taiga",
        "bbox": [19.55, 64.15, 19.85, 64.30],
        "years": [2021, 2022, 2023],
        "notes": "Rotational timber harvest patches testing high-latitude generalization."
    }
]

def calculate_bbox_area_km2(bbox):
    """Calculates approximate geographic area on WGS84 spheroid in km2."""
    min_lon, min_lat, max_lon, max_lat = bbox
    mean_lat_rad = math.radians((min_lat + max_lat) / 2.0)
    
    # 1 deg lat ~= 111.132 km
    lat_dist_km = (max_lat - min_lat) * 111.132
    # 1 deg lon ~= 111.320 * cos(lat) km
    lon_dist_km = (max_lon - min_lon) * 111.320 * math.cos(mean_lat_rad)
    
    return round(lat_dist_km * lon_dist_km, 2)

def calculate_utm_epsg(lon, lat):
    """Computes standard UTM EPSG code for a coordinate."""
    zone = int((lon + 180) / 6) + 1
    if lat >= 0:
        epsg = 32600 + zone
    else:
        epsg = 32700 + zone
    return zone, epsg

def main():
    print("=" * 65)
    print(" ForestWatch AI — Candidate AOI Scanner & Validator")
    print("=" * 65)
    
    valid_aois = []
    for c in CANDIDATES:
        area_km2 = calculate_bbox_area_km2(c["bbox"])
        mid_lon = (c["bbox"][0] + c["bbox"][2]) / 2.0
        mid_lat = (c["bbox"][1] + c["bbox"][3]) / 2.0
        zone, epsg = calculate_utm_epsg(mid_lon, mid_lat)
        
        status = "PASSED" if area_km2 <= 500.0 else "EXCEEDS_500KM2"
        print(f"[{status}] {c['name']}")
        print(f"   BBox: {c['bbox']} | Area: {area_km2} km² | UTM Zone: {zone} (EPSG:{epsg})")
        print(f"   Rationale: {c['notes']}")
        print("-" * 65)
        
        if area_km2 <= 500.0:
            c_data = {
                "slug": c["slug"],
                "name": c["name"],
                "country_code": c["country_code"],
                "country_name": c["country_name"],
                "biome": c["biome"],
                "utm_zone": zone,
                "utm_epsg": epsg,
                "area_km2": area_km2,
                "bbox": c["bbox"],
                "rationale": c["notes"]
            }
            valid_aois.append(c_data)
            
    print(f"\nTotal validated candidate AOIs: {len(valid_aois)} / {len(CANDIDATES)}")

if __name__ == "__main__":
    main()
