# Agent Coding Defaults

These defaults are mandatory whenever writing code in this repository.

## Skills-based coding rules

- Before starting code changes, follow both coding standards: `code-organization` and `coding-style`.

## Assess before editing

- For code-change requests, report before touching code: what to change, which files it involves, how large the difference is, and the proposed approach.
- Wait for the user's confirmation before applying the change.
- Skip this only for trivial, unambiguous fixes the user fully spelled out (typos, one-line changes).

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

## Library APIs and versions

- Before calling a library's API, check its version first.
- If the version is newer than your training data, do NOT rely on training knowledge — check the official documentation and treat it as the source of truth.
- If the official documentation cannot be found, tell the user; only read the library's source code after the user agrees.

## Problems and blockers

- When you hit a problem (error, unexpected behavior, missing access, conflicting requirements), do NOT silently work around it.
- Stop, describe the problem to the user, and present possible options with trade-offs.
- Wait for the user's choice before proceeding. Only proceed without asking when the fix is obvious, safe, and reversible.
