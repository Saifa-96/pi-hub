# Agent Work Manual

These rules are mandatory for all work in this repository. Every task runs this loop:

## 1. Assess

- Before touching code, report: what to change, which files it involves, how large the difference is, and the proposed approach.
- Before calling a library's API, check its version first. If the version is newer than your training data, do NOT rely on training knowledge — check the official documentation and treat it as the source of truth. If the documentation cannot be found, tell the user; only read the library's source code after the user agrees.

## 2. Ask

- Always ask for explicit approval before starting to write code — every time, even when the fix seems trivial. Approval is the signal to start.

## 3. Execute

Work within these boundaries:

- Source code edits are allowed. Configuration files (build config, lint/format config, dependency manifests, workspace config, `.env*`) need explicit approval first.
- Never start dev servers, watchers, or long-running services — the user owns process lifecycle. If verification needs a running app, ask the user to start it and provide the URL. One-shot commands that exit on their own are allowed (lint, type-check, tests, build).
- If you hit a problem (error, unexpected behavior, missing access, conflicting requirements): stop — do NOT silently work around it. Describe the problem, present options with trade-offs, and wait for the user's choice. Proceed without asking only when the fix is obvious, safe, and reversible.

## 4. Deliver

- Never push or run remote-impacting git commands without explicit confirmation.

## Browser Tooling

Two browser backends are available. Pick by intent, not familiarity:

- **`playwright-cli`** (bash) — the default for *driving* a page: navigate, click, fill, scrape JS-rendered sites, E2E-verify a running web app, mock network requests (`route`), record user actions as code (`recording-start`), reuse login state (`state-save` / `state-load`). Cross-browser (Chromium/Firefox/WebKit), and sessions are stateful — they survive between commands. Typical loop: `playwright-cli open <url>` → `snapshot` → `find <text>` → act on the returned `ref=e…` → `close-all` when done. Light inspection also lives here: `requests`, `console`.
- **chrome-devtools MCP** (tools) — for *debugging* a page in Chrome: performance traces with LCP/INP/CLS insights, deep network/console inspection, heap snapshots, device emulation. Chrome-only; no network mocking, not a test runner.

Do not open a browser for static pages or documentation — use built-in fetch/web search first, and spin one up only when the target is JS-rendered or interactive.
