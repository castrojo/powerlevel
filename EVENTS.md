# EVENTS.md — Powerlevel Event Log Schema

## Purpose

`data/powerlevel-events.jsonl` is the **single source of truth** for all earned
state in the powerlevel system. It is an append-only log: one JSON object per
line. GHA reads it; agents write to it; no one edits existing lines.

```
earned state = what the event log says, full stop
```

The GHA compute job (`compute.yml`) reads this file on every run and
regenerates `triumphs.json` earned fields from scratch. Agents must never
directly mutate `triumphs.json` earned state — they append an event and let GHA
propagate it.

---

## File Format

- File: `data/powerlevel-events.jsonl`
- Encoding: UTF-8
- Line endings: LF (`\n`)
- Lines beginning with `#` are comments and are skipped by the GHA reader
- All other lines must be valid JSON objects (one object per line)
- The file must end with a trailing newline

---

## Event Types

### `triumph_earned`

Records that a triumph has been completed and verified by a human.

| Field        | Type   | Required | Description                                                      |
|--------------|--------|----------|------------------------------------------------------------------|
| `type`       | string | ✅        | Always `"triumph_earned"`                                        |
| `triumph_id` | string | ✅        | Must match the `id` field of an entry in `data/triumphs.json`   |
| `timestamp`  | string | ✅        | ISO 8601 UTC — e.g. `"2026-03-19T00:00:00Z"`                   |
| `note`       | string | ❌        | Optional human-readable context about how the triumph was earned |

**Example:**
```json
{"type":"triumph_earned","triumph_id":"first_light","timestamp":"2026-03-19T14:22:00Z","note":"Merged first PR on the project"}
```

---

### `level_noted`

Records an observed skill level at a point in time. Used to track progression
history; does not gate any triumph unlocks.

| Field       | Type    | Required | Description                                      |
|-------------|---------|----------|--------------------------------------------------|
| `type`      | string  | ✅        | Always `"level_noted"`                           |
| `skill`     | string  | ✅        | Skill name matching a category in triumphs.json  |
| `level`     | integer | ✅        | Level reached (e.g. `2`)                         |
| `timestamp` | string  | ✅        | ISO 8601 UTC                                     |

**Example:**
```json
{"type":"level_noted","skill":"workflow","level":2,"timestamp":"2026-03-19T14:22:00Z"}
```

---

### `seal_earned`

Records that a seal (a milestone badge) has been unlocked.

| Field       | Type    | Required | Description                                                      |
|-------------|---------|----------|------------------------------------------------------------------|
| `type`      | string  | ✅        | Always `"seal_earned"`                                           |
| `seal_id`   | string  | ✅        | Must match the `id` field of an entry in `data/seals.json`      |
| `timestamp` | string  | ✅        | ISO 8601 UTC                                                     |
| `gilded`    | boolean | ✅        | `true` if all triumphs in the seal were completed; `false` if partial completion unlocked the seal |

**Example:**
```json
{"type":"seal_earned","seal_id":"cursebreaker","timestamp":"2026-03-19T14:22:00Z","gilded":false}
```

---

## Rules

1. **Append-only.** Never edit or delete existing lines. The log is immutable
   history. If a line was written in error, append a corrective note in a `#`
   comment immediately after it — do not remove or alter the original.

2. **One event per line.** No multi-line JSON. No arrays. No blank lines between
   events (blank lines are allowed at the end of the file).

3. **ISO 8601 UTC timestamps.** All `timestamp` values must be in
   `YYYY-MM-DDTHH:MM:SSZ` format (UTC, `Z` suffix). No local offsets.

4. **`triumph_id` must be valid.** The value must match an `id` field present in
   `data/triumphs.json`. GHA will warn (and skip) unknown IDs.

5. **Human verification required.** A `triumph_earned` event must only be
   appended after a human (the user, not an agent acting alone) has confirmed
   the completion. Auto-detection by agents is not allowed. See Anti-Gaming
   below.

---

## How Agents Append Events

Agents use `jq -n` to construct a well-formed JSON object and append it:

```bash
# Append a triumph_earned event
jq -n \
  --arg tid "first_light" \
  --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --arg note "Merged first PR" \
  '{"type":"triumph_earned","triumph_id":$tid,"timestamp":$ts,"note":$note}' \
  >> data/powerlevel-events.jsonl

# Append a seal_earned event (no note field)
jq -n \
  --arg sid "cursebreaker" \
  --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  '{"type":"seal_earned","seal_id":$sid,"timestamp":$ts,"gilded":false}' \
  >> data/powerlevel-events.jsonl
```

Always verify the appended line is valid JSON before committing:

```bash
tail -1 data/powerlevel-events.jsonl | jq .
```

---

## How GHA Reads Events

The GHA compute job (`compute.yml`) runs on push to `main` and on a scheduled
cron. It:

1. Reads `data/powerlevel-events.jsonl` line by line.
2. Skips lines starting with `#`.
3. Parses each remaining line as JSON.
4. Aggregates `triumph_earned` events to determine which triumph IDs are earned.
5. Aggregates `seal_earned` events to determine which seals are unlocked.
6. Writes the result back into `data/triumphs.json` and `data/seals.json`
   (updating the `earned` / `earned_at` / `gilded` fields).
7. Commits the updated JSON files if anything changed.

GHA is the only writer to the `earned` fields in the JSON data files. Agents
must not write to those fields directly.

---

## Anti-Gaming Policy

`triumph_earned` events represent real accomplishments. The following are
prohibited:

- **No self-certification.** An agent must not append a `triumph_earned` event
  based solely on its own judgment. A human must confirm the completion first.
- **No retroactive bulk grants.** Do not append many `triumph_earned` events at
  once without each being individually verified.
- **No fabricated timestamps.** Timestamps must reflect when the event actually
  occurred, not a convenient past date.

Violation of these rules undermines the integrity of the powerlevel system and
will result in events being reverted.

---

## Reference

- Event log: `data/powerlevel-events.jsonl`
- Triumph definitions: `data/triumphs.json`
- Seal definitions: `data/seals.json`
- GHA compute job: `.github/workflows/compute.yml`
