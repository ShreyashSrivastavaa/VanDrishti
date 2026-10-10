import sys
import time
import json
import argparse
from datetime import datetime
from .db import get_db_connection
from .handlers import handle_ingest_observations, handle_run_change_analysis

def process_next_job() -> bool:
    """
    Fetches and locks one queued job using SELECT FOR UPDATE SKIP LOCKED.
    Returns True if a job was processed, False if queue is empty.
    """
    conn = get_db_connection()
    cur = conn.cursor()

    try:
        # Lock next job
        cur.execute("""
            SELECT id, type, payload, attempts, max_attempts
            FROM jobs
            WHERE status = 'queued' AND run_after <= NOW()
            ORDER BY created_at ASC
            FOR UPDATE SKIP LOCKED
            LIMIT 1
        """)
        job = cur.fetchone()
        if not job:
            conn.commit()
            return False

        job_id = job["id"]
        job_type = job["type"]
        payload = job["payload"] if isinstance(job["payload"], dict) else json.loads(job["payload"])
        attempts = job["attempts"] + 1

        print(f"[{datetime.utcnow().isoformat()}] Processing job {job_id} ({job_type}, attempt {attempts})...")

        cur.execute("""
            UPDATE jobs
            SET status = 'running',
                attempts = %s,
                locked_by = 'python_worker',
                locked_at = NOW(),
                updated_at = NOW()
            WHERE id = %s
        """, (attempts, job_id))
        conn.commit()

        # Execute handler
        result = None
        error_msg = None
        try:
            if job_type == "ingest_observations":
                result = handle_ingest_observations(payload)
            elif job_type == "run_change_analysis":
                result = handle_run_change_analysis(payload)
            else:
                raise ValueError(f"Unknown job type: {job_type}")
        except Exception as ex:
            error_msg = str(ex)
            print(f"[{datetime.utcnow().isoformat()}] Job {job_id} failed: {ex}")

        # Update job status
        if error_msg is None:
            cur.execute("""
                UPDATE jobs
                SET status = 'succeeded',
                    result = %s,
                    error = NULL,
                    updated_at = NOW()
                WHERE id = %s
            """, (json.dumps(result), job_id))
            print(f"[{datetime.utcnow().isoformat()}] Job {job_id} completed successfully.")
        else:
            final_status = "failed" if attempts >= job["max_attempts"] else "queued"
            cur.execute("""
                UPDATE jobs
                SET status = %s,
                    error = %s,
                    updated_at = NOW()
                WHERE id = %s
            """, (final_status, error_msg, job_id))

        conn.commit()
        return True
    except Exception as e:
        conn.rollback()
        print(f"Queue error: {e}")
        return False
    finally:
        cur.close()
        conn.close()

def main():
    parser = argparse.ArgumentParser(description="ForestWatch AI Worker")
    parser.add_argument("--once", action="store_true", help="Process pending jobs and exit")
    args = parser.parse_args()

    print("ForestWatch AI Worker started. Listening for jobs...")

    if args.once:
        processed_any = False
        while process_next_job():
            processed_any = True
        print("Queue drained.")
        return

    while True:
        had_job = process_next_job()
        if not had_job:
            time.sleep(2.0)

if __name__ == "__main__":
    main()
