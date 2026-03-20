#!/usr/bin/env python3
"""
label-triage.py — Auto-remediation label enforcement
Modes (set via LABEL_TRIAGE_MODE env var):
  triage  — process a single issue (from GitHub Actions event)
  sweep   — weekly sweep of all open issues

Required env vars:
  GH_TOKEN, REPO
  ISSUE_NUMBER (triage mode only)
"""

import subprocess
import json
import os
import sys


def get_labels(repo, issue_num):
    result = subprocess.run(
        ["gh", "issue", "view", issue_num, "--repo", repo, "--json", "labels"],
        capture_output=True, text=True, check=True
    )
    return [lbl["name"] for lbl in json.loads(result.stdout)["labels"]]


def apply_defaults(repo, issue_num):
    """Apply default labels to a single issue if required labels are missing."""
    labels = get_labels(repo, issue_num)

    has_kind = any(lbl.startswith("kind:") for lbl in labels)
    has_priority = any(lbl.startswith("priority:") for lbl in labels)
    has_source = any(lbl.startswith("source:") for lbl in labels)

    to_add = []
    missing = []

    if not has_kind:
        to_add.append("kind:task")
        missing.append("kind")
    if not has_priority:
        to_add.append("priority:p3")
        missing.append("priority")
    if not has_source:
        to_add.append("source:manual")
        missing.append("source")

    if not to_add:
        print(f"  #{issue_num}: All required labels present -- no action needed")
        return

    to_add.append("needs-triage")
    label_arg = ",".join(to_add)

    subprocess.run(
        ["gh", "issue", "edit", issue_num, "--repo", repo, "--add-label", label_arg],
        check=True
    )

    kind_opts = "`kind:improvement`, `kind:bug`, `kind:epic`, `kind:task`, `kind:quality-violation`"
    guidance_lines = []
    for m in missing:
        if m == "kind":
            guidance_lines.append(f"- **kind:** choose from {kind_opts}")
        else:
            guidance_lines.append(f"- **{m}:** see label list")
    guidance = "\n".join(guidance_lines)

    applied_list = ", ".join(f"`{lbl}`" for lbl in to_add)
    comment = (
        "🏷️ **Auto-labeled with defaults** (required labels were missing).\n\n"
        f"Applied: {applied_list}\n\n"
        "Please update the following labels to reflect the actual issue:\n"
        f"{guidance}\n\n"
        "Remove `needs-triage` once the labels are correct."
    )

    subprocess.run(
        ["gh", "issue", "comment", issue_num, "--repo", repo, "--body", comment],
        check=True
    )
    print(f"  #{issue_num}: Applied defaults: {to_add}")


def sweep_all(repo):
    """Weekly sweep: flag any open issues still missing required labels."""
    result = subprocess.run(
        [
            "gh", "issue", "list", "--repo", repo,
            "--state", "open", "--limit", "200",
            "--json", "number,labels"
        ],
        capture_output=True, text=True, check=True
    )
    issues = json.loads(result.stdout)

    flagged = 0
    for issue in issues:
        labels = [lbl["name"] for lbl in issue["labels"]]
        has_kind = any(lbl.startswith("kind:") for lbl in labels)
        has_priority = any(lbl.startswith("priority:") for lbl in labels)
        has_source = any(lbl.startswith("source:") for lbl in labels)

        if not (has_kind and has_priority and has_source):
            subprocess.run(
                [
                    "gh", "issue", "edit", str(issue["number"]),
                    "--repo", repo, "--add-label", "needs-triage"
                ],
                capture_output=True
            )
            flagged += 1
            print(f"  Flagged issue #{issue['number']}")

    print(f"Weekly sweep: {flagged}/{len(issues)} open issues flagged with needs-triage")


def main():
    mode = os.environ.get("LABEL_TRIAGE_MODE", "triage")
    repo = os.environ["REPO"]

    if mode == "triage":
        issue_num = os.environ["ISSUE_NUMBER"]
        apply_defaults(repo, issue_num)
    elif mode == "sweep":
        sweep_all(repo)
    else:
        print(f"Unknown mode: {mode}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
