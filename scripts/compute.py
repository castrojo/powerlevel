#!/usr/bin/env python3
"""
GHA compute script — reads data/skill-levels.json + data/powerlevel-events.jsonl,
updates data/powerlevel-data.json and data/triumphs.json in place.

Run from the repo root. Exit 0 = changes written. Exit 2 = nothing changed.
"""

import json
import os
import sys


def main():
    changed = False

    # ── 1. Load skill levels ──────────────────────────────────────────────────
    with open("data/skill-levels.json") as f:
        skill_levels = json.load(f)
    print(f"Read {len(skill_levels)} skill levels from data/skill-levels.json")

    # ── 2. Update weapon levels in powerlevel-data.json ───────────────────────
    with open("data/powerlevel-data.json") as f:
        pl_data = json.load(f)

    for skill, level in skill_levels.items():
        weapon = pl_data.get("weapons", {}).get(skill)
        if weapon is None:
            continue
        current = weapon.get("level")
        if current != level:
            print(f"  {skill}: {current} → {level}")
            weapon["level"] = level
            changed = True

    if changed:
        with open("data/powerlevel-data.json", "w") as f:
            json.dump(pl_data, f, indent=2)
            f.write("\n")

    # ── 3. Read events log → update triumphs.json ─────────────────────────────
    earned_ids = set()
    events_path = "data/powerlevel-events.jsonl"
    if os.path.exists(events_path):
        with open(events_path) as f:
            for lineno, line in enumerate(f, 1):
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                try:
                    event = json.loads(line)
                    if event.get("type") == "triumph_earned":
                        earned_ids.add(event["triumph_id"])
                except json.JSONDecodeError as e:
                    print(f"Warning: line {lineno}: {e}", file=sys.stderr)

    print(f"Found {len(earned_ids)} earned triumph IDs in events log")

    if earned_ids:
        with open("data/triumphs.json") as f:
            triumphs_data = json.load(f)

        triumph_changed = False
        run_id = os.environ.get("GITHUB_RUN_ID", "unknown")
        for category in triumphs_data.get("categories", []):
            for triumph in category.get("triumphs", []):
                if triumph["id"] in earned_ids and not triumph.get("earned"):
                    triumph["earned"] = True
                    triumph.setdefault("earned_at", run_id)
                    print(f"  Marked triumph earned: {triumph['id']}")
                    triumph_changed = True

        if triumph_changed:
            with open("data/triumphs.json", "w") as f:
                json.dump(triumphs_data, f, indent=2)
                f.write("\n")
            changed = True

    # Write result to GITHUB_OUTPUT so the workflow can gate the commit step
    output_file = os.environ.get("GITHUB_OUTPUT", "")
    if output_file:
        with open(output_file, "a") as f:
            f.write(f"changed={'true' if changed else 'false'}\n")

    if not changed:
        print("No changes — weapon levels and triumphs are already current.")
    else:
        print("Compute complete.")
    sys.exit(0)


if __name__ == "__main__":
    main()
