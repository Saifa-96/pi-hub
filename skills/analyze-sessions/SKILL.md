---
name: analyze-sessions
description: Mine past user prompts from pi session logs for recurring patterns. Use when the user wants to review their prompting history, find repeated corrections worth codifying into AGENTS.md, or dump prompts per project.
---

# Analyze Sessions (prompts)

Dumps historical user prompts from `PI_CODING_AGENT_DIR/sessions/` for pattern
analysis. Prompts longer than `--max-chars` are dropped — they are almost
always pasted context, not actual prompting. Subagent transcripts are excluded
by default: their "user" messages are agent-authored task descriptions.

## Usage

```bash
node scripts/prompts.mjs --since 30d                     # markdown, grouped by project
node scripts/prompts.mjs --since 7d --format jsonl       # machine-readable
node scripts/prompts.mjs --cwd pi-hub --since 30d        # one project
node scripts/prompts.mjs --grep "review" --since 60d     # prompts mentioning a topic
node scripts/prompts.mjs --session 019fe447              # one session (8-char id prefix)
```

## Options

| Flag | Default | Meaning |
| --- | --- | --- |
| `--since` / `--until` | — | `7d`, `2w`, `3h`, `30m`, or ISO date/datetime |
| `--cwd` | — | Comma-separated substrings matched against session cwd |
| `--session` | — | Session id prefix (8 chars usually unique) |
| `--grep` | — | Case-insensitive substring on the session's user prompts |
| `--max-chars` | `2000` | Drop prompts longer than this; `0` = no limit |
| `--min-chars` | `1` | Drop prompts shorter than this |
| `--format` | `md` | `md` or `jsonl` |
| `--self-test` | — | Assert-based smoke check |

## Pattern-mining workflow

1. Run `--since 30d` and read the output.
2. Group by recurring themes: the same correction repeated across projects,
   the same setup question, the same complaint.
3. Propose additions to global `AGENTS.md` or project instructions.

Read-only: the script never modifies session files.

## Self-check

```bash
node scripts/prompts.mjs --self-test
```
