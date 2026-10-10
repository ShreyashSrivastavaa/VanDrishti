import json
from datetime import datetime, date
from typing import Dict, Any, List, Optional
import numpy as np

from .db import get_db_connection
from ..providers.earth_search import EarthSearchProvider
from ..providers.base import STACItemMetadata
from ..preprocessing.masking import create_scl_mask, compute_quality_metrics
from ..preprocessing.indices import compute_ndvi, compute_nbr
from ..preprocessing.preview import render_rgb_preview, render_forest_overlay, render_loss_overlay
from ..preprocessing.density import (
    compute_focal_density,
    render_density_overlay,
    export_density_cog,
    export_density_raw,
)
from ..models.spectral_baseline import SpectralBaselineModel
from ..change.detect import ChangeDetector
from ..change.polygonise import polygonise_components
from ..storage.artifact_store import artifact_store

def handle_ingest_observations(payload: Dict[str, Any]) -> Dict[str, Any]:
    aoi_id = payload["aoi_id"]
    conn = get_db_connection()
    cur = conn.cursor()

    try:
        cur.execute("SELECT id, slug, name, bbox, area_km2 FROM aois WHERE id = %s", (aoi_id,))
        aoi = cur.fetchone()
        if not aoi:
            raise ValueError(f"AOI {aoi_id} not found")

        bbox = tuple(aoi["bbox"])
        provider = EarthSearchProvider()

        # Search real Element 84 Earth Search STAC scenes
        try:
            real_scenes = provider.search_scenes(
                bbox=bbox,
                date_from=date(2022, 1, 1),
                date_to=date(2023, 12, 31),
                max_cloud_cover=75.0,
            )
        except Exception as e:
            print(f"[handle_ingest_observations] Error searching STAC scenes: {e}")
            real_scenes = []

        candidate_scenes: List[STACItemMetadata] = []
        if real_scenes:
            real_scenes.sort(key=lambda s: s.datetime_str)
            seen_months = set()
            for s in real_scenes:
                m_key = s.datetime_str[:7]
                if m_key not in seen_months:
                    seen_months.add(m_key)
                    candidate_scenes.append(s)
                if len(candidate_scenes) >= 4:
                    break
            if len(candidate_scenes) < 2:
                candidate_scenes = real_scenes[:4]

        # In offline/test environments where STAC is unreachable, fall back to mock passes tagged is_demo = True
        is_demo_run = False
        if not candidate_scenes:
            is_demo_run = True
            sample_dates = [date(2022, 1, 15), date(2022, 5, 20), date(2022, 10, 10), date(2023, 3, 5)]
            candidate_scenes = [
                STACItemMetadata(
                    scene_id=f"S2_sim_{aoi['slug']}_{d.strftime('%Y%m%d')}",
                    datetime_str=f"{d.isoformat()}T05:30:00Z",
                    cloud_cover=12.0 if idx != 2 else 72.0,
                    assets={},
                    platform="Sentinel-2B",
                )
                for idx, d in enumerate(sample_dates)
            ]

        model = SpectralBaselineModel()
        cur.execute("SELECT id FROM model_versions WHERE name = 'spectral_baseline' LIMIT 1")
        model_row = cur.fetchone()
        model_version_id = model_row["id"] if model_row else None

        ingested_count = 0
        for scene in candidate_scenes:
            try:
                acquired_at = datetime.fromisoformat(scene.datetime_str.replace("Z", "+00:00")).date()
            except Exception:
                acquired_at = date.fromisoformat(scene.datetime_str[:10])

            # Upsert into scenes table if real scene
            if not is_demo_run and scene.assets:
                cur.execute("""
                    INSERT INTO scenes (
                        provider, provider_scene_id, datetime, tile_id, platform,
                        cloud_cover_scene, assets, processing_baseline
                    )
                    VALUES ('earth-search', %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (provider, provider_scene_id) DO UPDATE SET
                        cloud_cover_scene = EXCLUDED.cloud_cover_scene,
                        assets = EXCLUDED.assets
                """, (
                    scene.scene_id,
                    scene.datetime_str,
                    scene.tile_id,
                    scene.platform,
                    scene.cloud_cover,
                    json.dumps(scene.assets),
                    scene.processing_baseline,
                ))

            bands = provider.fetch_windowed_bands(scene, bbox)

            scl = bands["SCL"]
            masked = create_scl_mask(scl, dilate_px=2)
            quality = compute_quality_metrics(scl, dilate_px=2)

            valid_fraction = float(quality["valid_fraction"])
            cloud_fraction = float(quality["cloud_fraction"])
            is_usable = (valid_fraction >= 0.70) and (cloud_fraction <= 0.20)
            if not is_usable:
                reasons = []
                if cloud_fraction > 0.20:
                    reasons.append(f"{int(round(cloud_fraction * 100))}% cloud/shadow cover")
                if valid_fraction < 0.70:
                    reasons.append(f"insufficient valid pixels ({int(round(valid_fraction * 100))}% valid)")
                unusable_reason = ", ".join(reasons)
            else:
                unusable_reason = None

            obs_is_demo = is_demo_run or not bool(scene.assets)

            # Render previews and overlays
            preview_bytes = render_rgb_preview(bands["B04"], bands["B03"], bands["B02"], masked)
            preview_rel_path = f"observations/{aoi['slug']}/{acquired_at.isoformat()}/preview.png"
            preview_uri = artifact_store.write_bytes(preview_rel_path, preview_bytes)

            # Forest probability
            p_forest = model.predict_probabilities(bands["B04"], bands["B08"], bands["B11"], bands["B12"], masked)
            forest_mask = model.classify(p_forest, threshold=0.50)
            overlay_bytes = render_forest_overlay(forest_mask)
            overlay_rel_path = f"observations/{aoi['slug']}/{acquired_at.isoformat()}/forest_mask.png"
            forest_overlay_uri = artifact_store.write_bytes(overlay_rel_path, overlay_bytes)

            # Compute Tree Cover Density (11x11 moving window focal mean, valid-pixel-aware)
            density = compute_focal_density(forest_mask, ~masked, window_size=11)
            density_overlay_bytes = render_density_overlay(density, ~masked, alpha_val=0.85)
            density_overlay_rel_path = f"observations/{aoi['slug']}/{acquired_at.isoformat()}/density_overlay.png"
            density_overlay_uri = artifact_store.write_bytes(density_overlay_rel_path, density_overlay_bytes)

            density_cog_bytes = export_density_cog(density)
            density_cog_rel_path = f"observations/{aoi['slug']}/{acquired_at.isoformat()}/density.tif"
            density_cog_uri = artifact_store.write_bytes(density_cog_rel_path, density_cog_bytes)

            density_raw_bytes = export_density_raw(density)
            density_raw_rel_path = f"observations/{aoi['slug']}/{acquired_at.isoformat()}/density.raw"
            artifact_store.write_bytes(density_raw_rel_path, density_raw_bytes)

            stats = model.compute_summary_statistics(p_forest)

            preview_bounds = [
                [bbox[0], bbox[3]], # top-left [lon, lat]
                [bbox[2], bbox[3]], # top-right
                [bbox[2], bbox[1]], # bottom-right
                [bbox[0], bbox[1]], # bottom-left
            ]

            provenance = {
                "provider": "earth-search",
                "collection": "sentinel-2-l2a",
                "scene_ids": [scene.scene_id],
                "platform": scene.platform or "Sentinel-2",
                "processed_at": datetime.utcnow().isoformat(),
                "real_cog": bool(scene.assets),
            }

            # Upsert into observations
            cur.execute("""
                INSERT INTO observations (
                    aoi_id, kind, acquired_at, valid_fraction, cloud_fraction,
                    usable, unusable_reason, scene_ids, preview_uri, preview_bounds,
                    provenance, status, is_demo
                )
                VALUES (%s, 'scene', %s, %s, %s, %s, %s, %s, %s, %s, %s, 'ready', %s)
                ON CONFLICT (aoi_id, kind, acquired_at, COALESCE(window_start, '1970-01-01'::DATE))
                DO UPDATE SET
                    valid_fraction = EXCLUDED.valid_fraction,
                    cloud_fraction = EXCLUDED.cloud_fraction,
                    usable = EXCLUDED.usable,
                    unusable_reason = EXCLUDED.unusable_reason,
                    preview_uri = EXCLUDED.preview_uri,
                    preview_bounds = EXCLUDED.preview_bounds,
                    provenance = EXCLUDED.provenance,
                    status = 'ready',
                    is_demo = EXCLUDED.is_demo
                RETURNING id
            """, (
                aoi_id,
                acquired_at,
                valid_fraction,
                cloud_fraction,
                is_usable,
                unusable_reason,
                [scene.scene_id],
                preview_uri,
                json.dumps(preview_bounds),
                json.dumps(provenance),
                obs_is_demo,
            ))
            obs_row = cur.fetchone()
            obs_id = obs_row["id"]

            # Upsert forest mask with density overlay and COG
            if model_version_id:
                cur.execute("""
                    INSERT INTO forest_masks (
                        observation_id, model_version_id, forest_area_ha, forest_fraction,
                        mean_confidence, valid_fraction, overlay_uri, density_overlay_uri, density_cog_uri
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (observation_id, model_version_id)
                    DO UPDATE SET
                        forest_area_ha = EXCLUDED.forest_area_ha,
                        forest_fraction = EXCLUDED.forest_fraction,
                        mean_confidence = EXCLUDED.mean_confidence,
                        valid_fraction = EXCLUDED.valid_fraction,
                        overlay_uri = EXCLUDED.overlay_uri,
                        density_overlay_uri = EXCLUDED.density_overlay_uri,
                        density_cog_uri = EXCLUDED.density_cog_uri
                """, (
                    obs_id,
                    model_version_id,
                    stats["forest_area_ha"],
                    stats["forest_fraction"],
                    stats["mean_confidence"],
                    valid_fraction,
                    forest_overlay_uri,
                    density_overlay_uri,
                    density_cog_uri,
                ))

            ingested_count += 1

        conn.commit()
        return {"status": "succeeded", "ingested_count": ingested_count}
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        cur.close()
        conn.close()

def handle_run_change_analysis(payload: Dict[str, Any]) -> Dict[str, Any]:
    analysis_id = payload["analysis_id"]
    conn = get_db_connection()
    cur = conn.cursor()

    try:
        cur.execute("UPDATE analyses SET status = 'running' WHERE id = %s", (analysis_id,))
        conn.commit()

        cur.execute("""
            SELECT 
                an.id, an.aoi_id, an.obs_t0, an.obs_t1, an.params,
                a.slug AS aoi_slug, a.bbox, a.area_km2,
                o0.acquired_at AS date_t0, o0.valid_fraction AS valid_f0, o0.scene_ids AS scene_ids_t0, o0.is_demo AS is_demo_t0,
                o1.acquired_at AS date_t1, o1.valid_fraction AS valid_f1, o1.scene_ids AS scene_ids_t1, o1.is_demo AS is_demo_t1
            FROM analyses an
            JOIN aois a ON an.aoi_id = a.id
            JOIN observations o0 ON an.obs_t0 = o0.id
            JOIN observations o1 ON an.obs_t1 = o1.id
            WHERE an.id = %s
        """, (analysis_id,))
        an = cur.fetchone()
        if not an:
            raise ValueError(f"Analysis {analysis_id} not found")

        bbox = tuple(an["bbox"])
        provider = EarthSearchProvider()
        model = SpectralBaselineModel()
        params = an["params"] or {}

        # Look up scene metadata for t0 and t1 to use genuine public COGs if present
        def get_scene_metadata(scene_ids: Optional[List[str]], acq_date: date) -> STACItemMetadata:
            if scene_ids and len(scene_ids) > 0:
                cur.execute(
                    "SELECT provider_scene_id, datetime, cloud_cover_scene, assets, tile_id, platform, processing_baseline "
                    "FROM scenes WHERE provider_scene_id = %s LIMIT 1",
                    (scene_ids[0],)
                )
                sc_row = cur.fetchone()
                if sc_row:
                    assets_dict = sc_row["assets"] if isinstance(sc_row["assets"], dict) else json.loads(sc_row["assets"] or "{}")
                    return STACItemMetadata(
                        scene_id=sc_row["provider_scene_id"],
                        datetime_str=sc_row["datetime"].isoformat() if hasattr(sc_row["datetime"], "isoformat") else str(sc_row["datetime"]),
                        cloud_cover=float(sc_row["cloud_cover_scene"] or 0.0),
                        assets=assets_dict,
                        tile_id=sc_row["tile_id"],
                        platform=sc_row["platform"],
                        processing_baseline=sc_row["processing_baseline"],
                    )
            return STACItemMetadata(
                scene_id=f"S2_obs_{acq_date}",
                datetime_str=str(acq_date),
                cloud_cover=10.0,
                assets={},
            )

        meta_t0 = get_scene_metadata(an["scene_ids_t0"], an["date_t0"])
        meta_t1 = get_scene_metadata(an["scene_ids_t1"], an["date_t1"])

        bands_t0 = provider.fetch_windowed_bands(meta_t0, bbox)
        bands_t1 = provider.fetch_windowed_bands(meta_t1, bbox)

        is_demo_analysis = bool(
            an["is_demo_t0"] or an["is_demo_t1"] or not meta_t0.assets or not meta_t1.assets
        )

        mask_t0 = create_scl_mask(bands_t0["SCL"], dilate_px=2)
        mask_t1 = create_scl_mask(bands_t1["SCL"], dilate_px=2)

        p_forest_t0 = model.predict_probabilities(bands_t0["B04"], bands_t0["B08"], bands_t0["B11"], bands_t0["B12"], mask_t0)
        p_forest_t1 = model.predict_probabilities(bands_t1["B04"], bands_t1["B08"], bands_t1["B11"], bands_t1["B12"], mask_t1)

        ndvi_t0 = compute_ndvi(bands_t0["B08"], bands_t0["B04"])
        ndvi_t1 = compute_ndvi(bands_t1["B08"], bands_t1["B04"])
        nbr_t0 = compute_nbr(bands_t0["B08"], bands_t0["B12"])
        nbr_t1 = compute_nbr(bands_t1["B08"], bands_t1["B12"])

        detector = ChangeDetector(
            t_high=params.get("tHigh", 0.70),
            t_low=params.get("tLow", 0.30),
            min_ndvi_drop=params.get("minNdviDrop", 0.15),
            min_nbr_drop=params.get("minNbrDrop", 0.10),
            min_mapping_unit_ha=params.get("minMappingUnitHa", 0.50),
            season_tolerance_days=params.get("seasonToleranceDays", 45),
        )

        loss_mask, labeled_arr, warnings = detector.detect_loss_candidates(
            p_forest_t0, p_forest_t1, ndvi_t0, ndvi_t1, nbr_t0, nbr_t1
        )

        # Check seasonality
        season_warnings = detector.check_seasonality(an["date_t0"], an["date_t1"])
        warnings.extend(season_warnings)

        detections = polygonise_components(
            labeled_arr,
            p_forest_t0,
            p_forest_t1,
            ndvi_t1 - ndvi_t0,
            float(an["valid_f0"]),
            float(an["valid_f1"]),
            bbox,
            an["date_t0"].isoformat(),
            an["date_t1"].isoformat(),
        )

        # Clean existing detections for this analysis if re-running
        cur.execute("DELETE FROM detections WHERE analysis_id = %s", (analysis_id,))

        total_loss_ha = 0.0
        for d in detections:
            total_loss_ha += d["area_ha"]
            geo_json = json.dumps(d["geometry"])
            cur.execute("""
                INSERT INTO detections (
                    analysis_id, geom, centroid, area_ha, mean_p_loss,
                    mean_ndvi_drop, valid_fraction_t0, valid_fraction_t1,
                    confirmed_persistent, confidence_score, confidence_class,
                    is_calibrated_confidence, explanation, is_demo
                )
                VALUES (
                    %s,
                    ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(%s), 4326)),
                    ST_SetSRID(ST_Point(%s, %s), 4326),
                    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
                )
            """, (
                analysis_id,
                geo_json,
                d["centroid"][0], d["centroid"][1],
                d["area_ha"],
                d["mean_p_loss"],
                d["mean_ndvi_drop"],
                d["valid_fraction_t0"],
                d["valid_fraction_t1"],
                d["confirmed_persistent"],
                d["confidence_score"],
                d["confidence_class"],
                d["is_calibrated_confidence"],
                d["explanation"],
                is_demo_analysis,
            ))

        total_loss_ha = round(total_loss_ha, 2)
        cur.execute("""
            UPDATE analyses
            SET status = 'ready',
                total_loss_ha = %s,
                detection_count = %s,
                warnings = %s,
                is_demo = %s,
                finished_at = NOW()
            WHERE id = %s
        """, (total_loss_ha, len(detections), warnings, is_demo_analysis, analysis_id))

        conn.commit()
        return {
            "status": "ready",
            "total_loss_ha": total_loss_ha,
            "detection_count": len(detections),
            "warnings": warnings,
            "is_demo": is_demo_analysis,
        }
    except Exception as e:
        conn.rollback()
        cur.execute("UPDATE analyses SET status = 'failed', error = %s WHERE id = %s", (str(e), analysis_id))
        conn.commit()
        raise e
    finally:
        cur.close()
        conn.close()

