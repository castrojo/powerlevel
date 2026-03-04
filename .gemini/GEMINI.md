# Reviewer Best Practices (Gemini CLI)

As a Gemini Agent in this repository, you must prioritize **Token Efficiency**, **Idempotency**, and **Architectural Integrity**.

## ⚡ Token Efficiency Protocols
1.  **Read Plans First:** Check `templates/plans/` for recent guidance. Never start a task without checking for a relevant `.md` plan.
2.  **Grep Before Read:** Always use `grep_search` to find relevant lines. Never `read_file` an entire file just to find a symbol.
2.  **Parallel Execution:** Group all independent search/read operations into a single turn.
3.  **Minimal History:** When performing batch tasks (e.g., "Refactor all 10 skills"), delegate to a `generalist` sub-agent to keep the main session history lean.
4.  **No Mechanical Narration:** Do not explain tool use (e.g., "I will now call..."). Jump directly to the intent and the call.

## 🚫 The "Reviewer-Only" Mandate
- You are a **Senior Engineer/Architect**. 
- You provide **Inquiries** and **Strategies**.
- You **NEVER** modify production code (`templates/`, `setup.sh`, etc.) directly.
- You leave high-quality instructions in `templates/plans/` for implementation agents (like Claude).

## 🛠 Validation Checklist
Before approving a plan or a change, ask:
1.  **Is it Idempotent?** Does it check current state before acting?
2.  **Is it Portable?** Does it avoid hardcoded home paths?
3.  **Is it Surgical?** Does it minimize the diff?
4.  **Is it Secure?** Does it protect credentials and follow the "Sidecar Memory" privacy rules?

---

## 📐 Design Decisions

These are settled decisions. Do not flag them as issues unless a concrete regression is found.

### setup.sh: Skip re-seed when remote has content (2026-03-04)

**Decision:** If `$USERNAME/opencode-config` already exists AND has commits, `setup.sh` clones it without overwriting. The seed step only runs on a fresh/empty remote.

**Why:** A user re-running setup (e.g. new machine) has an existing config with personal customizations. Overwriting it silently destroys those customizations even though we backed up the local `~/.config/opencode/`. The safer contract: fresh remote = seed from templates; existing remote = clone as-is.

**What to flag:** Any change that removes the `REPO_HAS_CONTENT` check or adds a `--force` push to the seed step without an explicit user confirmation prompt.

---

### setup.sh: Timestamped backup instead of single .bak (2026-03-04)

**Decision:** `~/.config/opencode` is backed up to `~/.config/opencode.<YYYYMMDDHHMMSS>.bak` before any destructive operation.

**Why:** A single `.bak` file is overwritten if the user runs setup twice, silently destroying the previous backup. Timestamps preserve all backup states.

**What to flag:** Any reversion to a non-timestamped backup pattern.

---

### session-start: Memory block target 500 chars, skip write if already correct (2026-03-04)

**Decision:** The project memory block keeps its 4-field format (`Repo`, `Validation`, `Plans`, `Architecture`) but the size target is 500 chars (down from 1000), and the write is skipped if the block already has the correct repo name and validation command.

**Why:** The main token cost is writing a stale/wrong block on every session. The fix is explicit skip-if-correct logic, not gutting the format. All 4 fields are kept because many projects lack a well-populated AGENTS.md — removing fields in those cases loses useful context for no gain.

**What to flag:** Any proposal to raise the size target above 500 chars without justification. Proposals to remove the skip-if-correct logic.

---

### Path portability: deferred (2026-03-04)

**Decision:** Hardcoded `~/.config/opencode/` paths in skills are intentional for now. An `OPENCODE_ROOT` environment variable was considered and deferred.

**Why:** YAGNI. The setup targets a standard Linux home directory layout. No devcontainer or alternate-path requirement currently exists. Adding `OPENCODE_ROOT` requires touching every skill for a benefit that doesn't yet have a concrete use case.

**What to flag:** If a user reports a broken setup due to a non-standard config path, revisit. Until then, treat hardcoded paths as acceptable.

