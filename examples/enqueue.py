#!/usr/bin/env python3
"""Python client for the Fireworks fine-tuning scheduler.

Usage:
    export SUPABASE_URL=https://<ref>.supabase.co
    export SFTQ_API_KEY=sftq_...
    python examples/enqueue.py

The payload for `kind` SFT or DPO is the same shape you would have sent
directly to Fireworks — the scheduler passes it through verbatim when it
admits the job.
"""

from __future__ import annotations

import json
import os
import sys
import urllib.request

Kind = str  # "SFT" or "DPO"


def _base() -> str:
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SFTQ_API_KEY")
    if not url or not key:
        print("SUPABASE_URL and SFTQ_API_KEY must be set", file=sys.stderr)
        sys.exit(2)
    return url.rstrip("/")


def _req(method: str, path: str, body: dict | None = None) -> dict:
    url = f"{_base()}/functions/v1/jobs-api{path}"
    headers = {
        "Authorization": f"Bearer {os.environ['SFTQ_API_KEY']}",
        "Content-Type": "application/json",
    }
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode())


def enqueue(kind: Kind, payload: dict, *, display_name: str | None = None, gpu_count: int = 4) -> dict:
    body = {"kind": kind, "fireworks_payload": payload, "gpu_count": gpu_count}
    if display_name:
        body["display_name"] = display_name
    return _req("POST", "/jobs", body)


def list_jobs(state: str | None = None, kind: Kind | None = None) -> list[dict]:
    q = []
    if state:
        q.append(f"state={state}")
    if kind:
        q.append(f"kind={kind}")
    qs = ("?" + "&".join(q)) if q else ""
    return _req("GET", f"/jobs{qs}")


def get_job(job_id: str) -> dict:
    return _req("GET", f"/jobs/{job_id}")


def cancel(job_id: str) -> dict:
    return _req("DELETE", f"/jobs/{job_id}")


if __name__ == "__main__":
    # Smoke test: list the caller's QUEUED jobs.
    print(json.dumps(list_jobs(state="QUEUED"), indent=2))
