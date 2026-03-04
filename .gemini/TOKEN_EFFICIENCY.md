# Token Efficiency Mandate

Efficiency is not just a preference; it is a primary technical constraint. Every token saved is more context available for complex reasoning.

## 🥇 Priority 1: The "90% Memory Reduction" Rule
- **Standard:** `memory_set` (global memory) must NEVER exceed 200 characters for stable project facts.
- **Implementation:** Move all stable facts (Repo URLs, Validation Commands, Architecture) to the project's `AGENTS.md`. 
- **Efficiency Gain:** Saves ~1,000 tokens *per turn* by eliminating redundant ambient context.

## 🥈 Priority 2: Automated Discovery over Manual Parsing
- **Standard:** Do not `cat` configuration files (`package.json`, etc.) in every session.
- **Implementation:** Use the `project-discovery` pattern to generate a minimal, high-signal report.
- **Efficiency Gain:** Saves ~500–1,500 tokens in the "Research" phase of every session.

## 🥉 Priority 3: Failure-Proof Pathing
- **Standard:** Use `$OPENCODE_ROOT` or relative paths. Never hardcode `/var/home/...`.
- **Implementation:** Standardize environment variables in all `SKILL.md` templates.
- **Efficiency Gain:** Eliminates "Correction Turns," saving 2,000+ tokens per path error.

## 🚀 Execution Strategy for Agents
1.  **Grep First:** Use `grep_search` to find line numbers; use `read_file` with `start_line` and `end_line` for surgical reads.
2.  **Turn Compression:** If you need three pieces of information, get them in one turn using parallel tool calls.
3.  **No Filler:** Avoid conversational filler. High-signal technical output only.
