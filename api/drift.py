"""Population Stability Index (PSI) drift over predicted class distributions.

Reference distribution comes from the eval-set support counts ingested at
deploy time (`model_metrics.per_class[*].support`); current distribution
comes from a daily window of `cases.predicted_class` via the
`class_distribution(start, end)` RPC.

PSI bands (industry standard):
    < 0.10 — stable
    0.10–0.25 — monitor
    > 0.25 — alert
"""
from __future__ import annotations

import math
from datetime import datetime, timedelta, timezone
from typing import Optional

from api.metrics import _get_metric, _rpc

EPSILON = 1e-4
WINDOW_DAYS = 30


def psi(reference: dict, current: dict) -> float:
    """Compute PSI between two categorical distributions.

    Both inputs are class -> count dicts. Returns 0.0 if either is empty.
    """
    classes = set(reference) | set(current)
    if not classes:
        return 0.0
    ref_total = sum(reference.values()) or 1
    cur_total = sum(current.values()) or 1
    score = 0.0
    for cls in classes:
        p = max(reference.get(cls, 0) / ref_total, EPSILON)
        q = max(current.get(cls, 0) / cur_total, EPSILON)
        score += (q - p) * math.log(q / p)
    return float(round(max(score, 0.0), 4))


def _reference_from_per_class(version_id: str) -> Optional[dict]:
    rows = _get_metric(version_id, "per_class")
    if not isinstance(rows, list):
        return None
    out: dict[str, int] = {}
    for row in rows:
        full = row.get("full") or row.get("code")
        support = row.get("support") or 0
        if full and support:
            out[full] = int(support)
    return out or None


def compute_drift_window(version_id: str, days: int = WINDOW_DAYS) -> Optional[dict]:
    """For each of the last `days` days, compute PSI vs. reference.

    Returns None if no reference distribution can be assembled — caller
    should fall back to synthetic.
    """
    reference = _reference_from_per_class(version_id)
    if reference is None:
        return None

    end = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    values: list[float] = []
    for i in range(days, 0, -1):
        day_start = end - timedelta(days=i)
        day_end = end - timedelta(days=i - 1)
        dist = _rpc(
            "class_distribution",
            {
                "window_start": day_start.isoformat(),
                "window_end": day_end.isoformat(),
            },
        )
        current = dist if isinstance(dist, dict) else {}
        values.append(psi(reference, current))

    return {"window": days, "values": values}


def band_for(value: float) -> str:
    if value < 0.10:
        return "stable"
    if value < 0.25:
        return "monitor"
    return "alert"
