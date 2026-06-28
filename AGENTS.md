# Agent Workflow Guardrails

These guardrails are mandatory for this repository.

## Configuration files

- Do not edit configuration files without explicit user approval.
- This includes build config, lint/format config, dependency manifests (scripts/deps), workspace config, and environment files (`.env*`).
- Source code edits are allowed; tooling and environment changes require approval first.

## Dev servers and long-running services

- Never start dev servers, watchers, or backend long-running services on your own.
- The user owns process lifecycle and should start/stop these in their own terminal.
- If verification needs a running app, ask the user to start it and provide the URL.
- One-shot commands that exit on their own are allowed (lint, type-check, tests, build).

## Git and commits

- Never commit unless the user explicitly asks.
- Never push or run remote-impacting git commands without explicit confirmation.
