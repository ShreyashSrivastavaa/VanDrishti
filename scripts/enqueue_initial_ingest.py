#!/usr/bin/env python3
"""
scripts/enqueue_initial_ingest.py

Enqueues 'ingest_observations' jobs for all curated AOIs in the database.
"""

import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from services.ml.forestwatch_ml.worker.db import get_db_connection
import psycopg2.extras

def main():
    conn = get_db_connection()
    cur = conn.cursor()

    cur.execute("SELECT id, slug, name FROM aois WHERE kind = 'curated'")
    aois = cur.fetchall()

    print(f"Found {len(aois)} curated AOIs. Enqueuing ingestion jobs...")

    for a in aois:
        cur.execute("""
            INSERT INTO jobs (type, payload, status)
            VALUES ('ingest_observations', %s, 'queued')
            RETURNING id
        """, (psycopg2.extras.Json({"aoi_id": str(a["id"]), "aoi_slug": a["slug"]}),))
        job = cur.fetchone()
        print(f"  [Enqueued] Job {job['id']} for AOI {a['name']}")

    conn.commit()
    cur.close()
    conn.close()
    print("Done enqueuing ingestion jobs.")

if __name__ == "__main__":
    main()
