#!/usr/bin/env python3
"""Append a model dispatch entry to ~/.copilot/model-log.jsonl."""
import json
import datetime
import os
import sys


def main():
    if len(sys.argv) < 3:
        print("Usage: log-model.py <task> <model1,model2,...>", file=sys.stderr)
        sys.exit(1)
    task = sys.argv[1]
    models = [m.strip() for m in sys.argv[2].split(",") if m.strip()]
    entry = {
        "timestamp": datetime.datetime.now(datetime.timezone.utc).strftime(
            "%Y-%m-%dT%H:%M:%SZ"
        ),
        "task": task,
        "models": models,
    }
    path = os.path.expanduser("~/.copilot/model-log.jsonl")
    with open(path, "a") as f:
        f.write(json.dumps(entry) + "\n")
    print(f"Logged: {task} -> {', '.join(models)}")


if __name__ == "__main__":
    main()
