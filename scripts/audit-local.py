#!/usr/bin/env python3
"""Local pipeline health audit — mirrors GHA audit.yml checks."""

import json
from datetime import datetime, timezone, timedelta

with open("data/powerlevel-data.json") as f:
    d = json.load(f)

stats = d.get("stats", {})
ts = [
    s.get("exported_at")
    for s in stats.values()
    if isinstance(s, dict) and s.get("exported_at")
]

if ts:
    age = (
        datetime.now(timezone.utc)
        - datetime.fromisoformat(max(ts).replace("Z", "+00:00"))
    ).days
    print(f"  Data freshness: {age} day(s) old")
else:
    print("  Data freshness: no timestamps found")
