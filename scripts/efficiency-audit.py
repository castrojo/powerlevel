#!/usr/bin/env python3
"""
efficiency-audit.py — Weekly system efficiency audit for castrojo/powerlevel.

Audits the powerlevel setup to ensure:
  1. All computation happens in GitHub Actions (not client-side).
  2. Weapon levels in powerlevel-data.json match skill-levels.json (no level drift).
  3. Every weapon in powerlevel-data.json has a corresponding skill-levels.json entry.
  4. Triumph IDs referenced in seals.json exist in triumphs.json.
  5. The powerlevel-events.jsonl contains only valid triumph IDs.
  6. Stats have been exported recently (not stale).

For each problem found, a GitHub issue is filed with:
  - kind:quality-violation
  - priority:p2  (data integrity) or priority:p3 (advisory)
  - source:automation

Required env vars:
  GH_TOKEN  — a GitHub token with issues:write permission
  REPO      — e.g. "castrojo/powerlevel"

Exit 0 always (audit failures are filed as issues, not script errors).
"""

import json
import os
import subprocess
import sys
from datetime import datetime, timezone, timedelta

REPO = os.environ.get("REPO", "")
GH_TOKEN = os.environ.get("GH_TOKEN", "")

LABELS_P2 = "kind:quality-violation,priority:p2,source:automation"
LABELS_P3 = "kind:quality-violation,priority:p3,source:automation"

STALE_STATS_DAYS = 14  # Flag stats older than this many days


def gh(*args):
    """Run a gh CLI command, returning stdout as a string."""
    env = os.environ.copy()
    if GH_TOKEN:
        env["GH_TOKEN"] = GH_TOKEN
    result = subprocess.run(
        ["gh", *args],
        capture_output=True,
        text=True,
        env=env,
    )
    if result.returncode != 0:
        print(f"  gh command failed: {' '.join(args)}", file=sys.stderr)
        print(f"  stderr: {result.stderr.strip()}", file=sys.stderr)
    return result


def get_open_issue_titles(repo):
    """Return a set of titles of currently open issues."""
    result = gh(
        "issue", "list",
        "--repo", repo,
        "--state", "open",
        "--limit", "500",
        "--json", "title",
    )
    if result.returncode != 0:
        return set()
    issues = json.loads(result.stdout)
    return {issue["title"] for issue in issues}


def file_issue(repo, title, body, labels, existing_titles, dry_run=False):
    """File a GitHub issue if one with this exact title isn't already open."""
    if title in existing_titles:
        print(f"  SKIP (already open): {title}")
        return False

    if dry_run:
        print(f"  DRY-RUN would file: {title}")
        return False

    result = gh(
        "issue", "create",
        "--repo", repo,
        "--title", title,
        "--body", body,
        "--label", labels,
    )
    if result.returncode == 0:
        print(f"  Filed: {title}")
        return True
    else:
        print(f"  ERROR filing issue: {title}", file=sys.stderr)
        return False


# ── Audit checks ──────────────────────────────────────────────────────────────

def check_level_drift(pl_data, skill_levels, repo, open_titles, dry_run):
    """Check: weapon levels in powerlevel-data.json do not match skill-levels.json."""
    issues_filed = 0
    for skill, level in skill_levels.items():
        weapon = pl_data.get("weapons", {}).get(skill)
        if weapon is None:
            continue
        current = weapon.get("level")
        if current != level:
            title = f"[efficiency-audit] Level drift detected for skill: {skill}"
            body = (
                f"## Level Drift Detected\n\n"
                f"**Skill:** `{skill}`\n"
                f"**Expected level** (from `data/skill-levels.json`): `{level}`\n"
                f"**Actual level** (in `data/powerlevel-data.json`): `{current}`\n\n"
                f"### Impact\n"
                f"The powerlevel computation pipeline has not synced this skill's level. "
                f"The website will show an incorrect level until `compute.yml` runs and "
                f"commits updated data.\n\n"
                f"### Resolution\n"
                f"1. Verify `data/skill-levels.json` is correct.\n"
                f"2. Trigger the [Compute Powerlevel]"
                f"(https://github.com/{repo}/actions/workflows/compute.yml) workflow.\n"
                f"3. Confirm `data/powerlevel-data.json` is updated and re-deployed.\n\n"
                f"_Filed automatically by the weekly efficiency audit._"
            )
            if file_issue(repo, title, body, LABELS_P2, open_titles, dry_run):
                open_titles.add(title)
                issues_filed += 1
    return issues_filed


def check_untracked_weapons(pl_data, skill_levels, repo, open_titles, dry_run):
    """Check: weapons in powerlevel-data.json have no entry in skill-levels.json."""
    weapon_keys = set(pl_data.get("weapons", {}).keys())
    skill_keys = set(skill_levels.keys())
    untracked = sorted(weapon_keys - skill_keys)
    if not untracked:
        return 0

    title = "[efficiency-audit] Weapons missing from skill-levels.json"
    body = (
        f"## Untracked Weapons Detected\n\n"
        f"The following weapons exist in `data/powerlevel-data.json` but have **no entry** "
        f"in `data/skill-levels.json`. Their levels cannot be updated via the compute "
        f"pipeline and will remain static.\n\n"
        f"| Weapon/Skill |\n"
        f"|--------------|\n"
        + "".join(f"| `{w}` |\n" for w in untracked)
        + f"\n### Impact\n"
        f"Agents leveling up these skills will update `SKILL.md` but the powerlevel "
        f"computation pipeline won't pick up the new level — the website will be stale.\n\n"
        f"### Resolution\n"
        f"Add each missing weapon to `data/skill-levels.json` with its current level, "
        f"then trigger the [Compute Powerlevel]"
        f"(https://github.com/{repo}/actions/workflows/compute.yml) workflow.\n\n"
        f"_Filed automatically by the weekly efficiency audit._"
    )
    if file_issue(repo, title, body, LABELS_P2, open_titles, dry_run):
        open_titles.add(title)
        return 1
    return 0


def check_orphan_skills(pl_data, skill_levels, repo, open_titles, dry_run):
    """Check: entries in skill-levels.json that have no matching weapon in powerlevel-data.json."""
    weapon_keys = set(pl_data.get("weapons", {}).keys())
    skill_keys = set(skill_levels.keys())
    orphans = sorted(skill_keys - weapon_keys)
    if not orphans:
        return 0

    title = "[efficiency-audit] Orphan entries in skill-levels.json"
    body = (
        f"## Orphan Skill Entries Detected\n\n"
        f"The following entries exist in `data/skill-levels.json` but have **no matching "
        f"weapon** in `data/powerlevel-data.json`. The compute pipeline reads these levels "
        f"but has nowhere to write them — the data is dead weight.\n\n"
        f"| Skill | Level |\n"
        f"|-------|-------|\n"
        + "".join(f"| `{s}` | {skill_levels[s]} |\n" for s in orphans)
        + f"\n### Resolution\n"
        f"Either:\n"
        f"- Add matching weapon entries to `data/powerlevel-data.json`, **or**\n"
        f"- Remove the orphan entries from `data/skill-levels.json`.\n\n"
        f"_Filed automatically by the weekly efficiency audit._"
    )
    if file_issue(repo, title, body, LABELS_P3, open_titles, dry_run):
        open_titles.add(title)
        return 1
    return 0


def check_seal_triumph_refs(seals_data, all_triumph_ids, repo, open_titles, dry_run):
    """Check: seals reference triumph IDs that don't exist in triumphs.json."""
    issues_filed = 0
    for seal in seals_data.get("seals", []):
        bad_ids = [
            tid for tid in seal.get("required_triumph_ids", [])
            if tid not in all_triumph_ids
        ]
        if not bad_ids:
            continue

        title = f"[efficiency-audit] Seal '{seal['id']}' references unknown triumph IDs"
        body = (
            f"## Invalid Triumph References in Seal\n\n"
            f"**Seal:** `{seal['id']}` ({seal.get('name', '')})\n\n"
            f"The following triumph IDs are listed as requirements for this seal but do "
            f"**not exist** in `data/triumphs.json`:\n\n"
            + "".join(f"- `{tid}`\n" for tid in bad_ids)
            + f"\n### Impact\n"
            f"The seal's completion tracking is broken — it can never be marked earned "
            f"even when all valid triumphs are completed.\n\n"
            f"### Resolution\n"
            f"Either add the missing triumph definitions to `data/triumphs.json`, or "
            f"remove the invalid IDs from `data/seals.json`.\n\n"
            f"_Filed automatically by the weekly efficiency audit._"
        )
        if file_issue(repo, title, body, LABELS_P2, open_titles, dry_run):
            open_titles.add(title)
            issues_filed += 1
    return issues_filed


def check_events_triumph_refs(events_path, all_triumph_ids, repo, open_titles, dry_run):
    """Check: powerlevel-events.jsonl references triumph IDs not in triumphs.json."""
    if not os.path.exists(events_path):
        return 0

    bad_refs = []
    with open(events_path) as f:
        for lineno, line in enumerate(f, 1):
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            try:
                event = json.loads(line)
                if event.get("type") == "triumph_earned":
                    tid = event.get("triumph_id", "")
                    if tid and tid not in all_triumph_ids:
                        bad_refs.append((lineno, tid))
            except json.JSONDecodeError:
                pass

    if not bad_refs:
        return 0

    title = "[efficiency-audit] powerlevel-events.jsonl references unknown triumph IDs"
    body = (
        f"## Invalid Triumph IDs in Events Log\n\n"
        f"The following `triumph_earned` events in `data/powerlevel-events.jsonl` "
        f"reference triumph IDs that do **not exist** in `data/triumphs.json`. "
        f"These triumphs will never be marked as earned.\n\n"
        f"| Line | Triumph ID |\n"
        f"|------|------------|\n"
        + "".join(f"| {ln} | `{tid}` |\n" for ln, tid in bad_refs)
        + f"\n### Resolution\n"
        f"Either add the missing triumph definitions to `data/triumphs.json`, or "
        f"correct the triumph IDs in `data/powerlevel-events.jsonl`.\n\n"
        f"_Filed automatically by the weekly efficiency audit._"
    )
    if file_issue(repo, title, body, LABELS_P2, open_titles, dry_run):
        open_titles.add(title)
        return 1
    return 0


def check_stale_stats(pl_data, repo, open_titles, dry_run):
    """Check: stats have not been exported for longer than STALE_STATS_DAYS days."""
    stale = []
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(days=STALE_STATS_DAYS)

    stats = pl_data.get("stats", {})
    for stat_name, stat in stats.items():
        exported_at_str = stat.get("exported_at")
        if not exported_at_str:
            stale.append((stat_name, "never exported"))
            continue
        try:
            # Parse ISO 8601 UTC timestamp (e.g. "2026-03-20T02:12:42Z")
            exported_at = datetime.strptime(exported_at_str, "%Y-%m-%dT%H:%M:%SZ").replace(
                tzinfo=timezone.utc
            )
            if exported_at < cutoff:
                age_days = (now - exported_at).days
                stale.append((stat_name, f"{age_days} days ago"))
        except ValueError:
            stale.append((stat_name, f"unparseable timestamp: {exported_at_str}"))

    if not stale:
        return 0

    title = "[efficiency-audit] Stats export is stale — run `just refresh` locally"
    body = (
        f"## Stale Stats Detected\n\n"
        f"The following stats in `data/powerlevel-data.json` have not been refreshed "
        f"for more than **{STALE_STATS_DAYS} days**. Stats are exported from the local "
        f"`session-store.db` and must be run manually at session end.\n\n"
        f"| Stat | Last Exported |\n"
        f"|------|---------------|\n"
        + "".join(f"| `{s}` | {age} |\n" for s, age in stale)
        + f"\n### Impact\n"
        f"The website displays outdated session metrics. This does not affect powerlevel "
        f"calculation (which uses `skill-levels.json`) but makes the stat bars inaccurate.\n\n"
        f"### Resolution\n"
        f"Run locally at the end of your next session:\n"
        f"```bash\n"
        f"just refresh   # = export-stats + build-site + commit + push\n"
        f"```\n\n"
        f"_Filed automatically by the weekly efficiency audit._"
    )
    if file_issue(repo, title, body, LABELS_P3, open_titles, dry_run):
        open_titles.add(title)
        return 1
    return 0


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    repo = os.environ.get("REPO", "")
    dry_run = os.environ.get("AUDIT_DRY_RUN", "").lower() in ("1", "true", "yes")

    if not repo:
        print("ERROR: REPO env var is required (e.g. 'castrojo/powerlevel')", file=sys.stderr)
        sys.exit(1)

    print(f"=== Powerlevel Efficiency Audit ===")
    print(f"Repo: {repo}")
    print(f"Dry run: {dry_run}")
    print()

    # Load data files
    with open("data/skill-levels.json") as f:
        skill_levels = json.load(f)
    with open("data/powerlevel-data.json") as f:
        pl_data = json.load(f)
    with open("data/triumphs.json") as f:
        triumphs_data = json.load(f)
    with open("data/seals.json") as f:
        seals_data = json.load(f)

    all_triumph_ids = {
        tr["id"]
        for cat in triumphs_data.get("categories", [])
        for tr in cat.get("triumphs", [])
    }

    # Fetch existing open issues to avoid duplicates
    print("Fetching existing open issues...")
    open_titles = get_open_issue_titles(repo)
    print(f"  Found {len(open_titles)} open issues")
    print()

    total_filed = 0

    print("Check 1: Level drift (skill-levels.json vs powerlevel-data.json)...")
    n = check_level_drift(pl_data, skill_levels, repo, open_titles, dry_run)
    total_filed += n
    print(f"  → {n} issue(s) filed")

    print("Check 2: Weapons missing from skill-levels.json...")
    n = check_untracked_weapons(pl_data, skill_levels, repo, open_titles, dry_run)
    total_filed += n
    print(f"  → {n} issue(s) filed")

    print("Check 3: Orphan entries in skill-levels.json...")
    n = check_orphan_skills(pl_data, skill_levels, repo, open_titles, dry_run)
    total_filed += n
    print(f"  → {n} issue(s) filed")

    print("Check 4: Seal triumph ID references...")
    n = check_seal_triumph_refs(seals_data, all_triumph_ids, repo, open_titles, dry_run)
    total_filed += n
    print(f"  → {n} issue(s) filed")

    print("Check 5: Events log triumph ID references...")
    n = check_events_triumph_refs(
        "data/powerlevel-events.jsonl", all_triumph_ids, repo, open_titles, dry_run
    )
    total_filed += n
    print(f"  → {n} issue(s) filed")

    print("Check 6: Stale stats export...")
    n = check_stale_stats(pl_data, repo, open_titles, dry_run)
    total_filed += n
    print(f"  → {n} issue(s) filed")

    print()
    print(f"=== Audit complete. {total_filed} new issue(s) filed. ===")


if __name__ == "__main__":
    main()
