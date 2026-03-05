# Skill: project-discovery

## When to use

When you need to know how to build, validate, or test a project and the answer is not
already in the project memory block or `AGENTS.md`.

Do NOT use this if the memory block already has a `Validation:` line — read it instead.

---

## Steps

### 1. Run all detection in one parallel bash call

```bash
just --list 2>/dev/null | head -3 && echo "JUST_OK" || echo "JUST_ABSENT"
ls Makefile 2>/dev/null && echo "MAKE_OK" || echo "MAKE_ABSENT"
ls package.json 2>/dev/null && echo "NPM_OK" || echo "NPM_ABSENT"
ls Cargo.toml 2>/dev/null && echo "RUST_OK" || echo "RUST_ABSENT"
ls go.mod 2>/dev/null && echo "GO_OK" || echo "GO_ABSENT"
ls pyproject.toml requirements.txt setup.py 2>/dev/null | head -1 && echo "PY_OK" || echo "PY_ABSENT"
node --version 2>/dev/null || echo "NODE_ABSENT"
go version 2>/dev/null || echo "GO_VER_ABSENT"
rustc --version 2>/dev/null || echo "RUST_VER_ABSENT"
python3 --version 2>/dev/null || echo "PY_VER_ABSENT"
```

### 2. Derive the validation command

Priority order:
1. `just check` / `just test` / `just lint` (if Justfile present)
2. `make test` / `make check` (if Makefile present, no Justfile)
3. `npm test` / `cargo test` / `go test ./...` / `pytest` (language fallback)
4. `bash -n <main-script>.sh` (shell-only repos)

If no clear command exists, report "unknown — inspect manually".

### 3. Emit a Discovery Report

```
=== Discovery Report: <repo-name> ===
Build tool:  <just / make / npm / cargo / go / python / shell>
Validate:    <exact command>
Language:    <Node X.Y / Rust X.Y / Go X.Y / Python X.Y / Shell>
Key files:   <Justfile / Makefile / package.json / Cargo.toml / go.mod / *.sh>
```

### 4. Update the project memory block

If the memory block is missing the `Validation:` line, add it now via `memory_replace`.
Do not rewrite the entire block — surgical edit only.

---

## Constraints

- All detection in step 1 runs as a **single bash call** — no sequential probing
- Output is fixed-width structured text, not prose
- Do not run the validation command — just discover it
- Do not install missing tools

Base directory for this skill: PLACEHOLDER
