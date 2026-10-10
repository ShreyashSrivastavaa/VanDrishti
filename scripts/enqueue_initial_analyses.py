#!/usr/bin/env python3
"""
scripts/enqueue_initial_analyses.py

Enqueues 'run_change_analysis' jobs for each curated AOI between observation dates 2021-08-15 and 2023-08-18.
"""

import hashlib
import json
import psycopg2
from psycopg2.extras import RealDictCursor

def main():
    conn = psycopg2.connect("postgres://postgres:postgres@localhost:5432/forestwatch", cursor_factory=RealDictCursor)
    cur = conn.cursor()

    cur.execute("SELECT id FROM model_versions WHERE name = 'spectral_baseline' LIMIT 1")
    model_row = cur.fetchone()
    model_id = model_row["id"]

    cur.execute("SELECT id, slug, name FROM aois WHERE kind = 'curated'")
    aois = cur.fetchall()

    params = {
        "tHigh": 0.70,
        "tLow": 0.30,
        "minMappingUnitHa": 0.50,
        "minNdviDrop": 0.15,
        "minNbrDrop": 0.10,
        "seasonToleranceDays": 45
    }
    params_hash = hashlib.sha256(json.dumps(params, sort_keys=True).encode()).hexdigest()[:16]

    for a in aois:
        cur.execute("""
            SELECT id, acquired_at 
            FROM observations 
            WHERE aoi_id = %s AND usable = true 
            ORDER BY acquired_at ASC
        """, (a["id"],))
        obs = cur.fetchall()

        if len(obs) >= 2:
            obs_t0 = obs[0]["id"]
            obs_t1 = obs[-1]["id"]

            cur.execute("""
                INSERT INTO analyses (
                    aoi_id, obs_t0, obs_t1, model_version_id, params, params_hash, status
                )
                VALUES (%s, %s, %s, %s, %s, %s, 'queued')
                ON CONFLICT (aoi_id, obs_t0, obs_t1, model_version_id, params_hash)
                DO UPDATE SET status = 'queued'
                RETURNING id
            """, (a["id"], obs_t0, obs_t1, model_id, json.dumps(params), params_hash))
            an = cur.fetchone()

            # Enqueue job
            cur.execute("""
                INSERT INTO jobs (type, payload, status)
                VALUES ('run_change_analysis', %s, 'queued')
            """, (json.dumps({
                "analysis_id": str(an["id"]),
                "aoi_id": str(a["id"]),
                "obs_t0": str(obs_t0),
                "obs_t1": str(obs_t1),
                "model_version_id": str(model_id),
                "params": params
            }),))
            print(f"Enqueued change analysis for {a['name']} ({obs[0]['acquired_at']} -> {obs[-1]['acquired_at']})")

    conn.commit()
    cur.close()
    conn.close()

if __name__ == "__main__":
    main()
