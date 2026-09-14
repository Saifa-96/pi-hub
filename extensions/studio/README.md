# pi studio

Local web interface for the current pi session.

## Usage

1. `cd web && pnpm install` (once; the repo is a pnpm workspace — never npm here)
2. In pi, run `/studio` (production) or `/studio-dev` (hot reload, for working on the UI)
3. `/studio-quit` stops the web server and bridge (`/studio` starts a fresh one)

Starts an in-process token-gated HTTP bridge (127.0.0.1) and a production
Next.js server (`web/`, port 3777; `next build && next start`), then opens the
browser. The page shows session
history, streams live messages (SSE), and sends user messages back to the
session (`POST /send`; queued as follow-up while the agent is streaming).

## Bridge API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/events?token=` | GET | SSE: `hello`, `busy` |

Chat stays in the CLI; the web page is a status/canvas surface only.

## Data layout

`web/data/` is studio's runtime data store (git-ignored), readable directly
by the Next.js server via relative paths:

```
web/data/
├── analyzed/                  # /studio-analysis output
│   └── <name>/<version>/graph-<YYYYMMDD-HHMMSS>.json   # name/version from the target's package.json; multiple graphs coexist
└── plans/<id>/                # cross-project intent + graph edits (intent.md, *.diff)
```

Analysis is user-triggered (`/studio-analysis` in the session of the project to
analyze); the web app only reads `analyzed/`. Task dispatch to other sessions goes over pi-intercom messages carrying a
pointer to the plan dir — sessions read the intent file, nothing is pushed.

## Notes

- Everything is torn down on `session_shutdown` (quit, `/new`, `/resume`,
  `/fork`, `/reload`). Run `/studio` again afterwards.
- Bridge binds to 127.0.0.1 only; token is per-run and lives in the page URL
  params only via env injection (never sent to third parties).
- `/studio` runs `next build && next start` (first run ~30s); if `web/.next`
  already contains a build it skips straight to `next start` (~1s). To pick up
  UI changes, rebuild (`pnpm build` in `web/`) or use `/studio-dev` while
  iterating — it runs `next dev` with hot reload on the same port, so quit the
  production server first (`/studio-quit`).
