# Studio

Graph workbench for the current pi session: renders Archify IR snapshots of a
project's code structure, lets you comment on nodes, and sends comments back to
the agent as session messages.

## Usage

- `/studio` — start the in-process server and open the page in the browser.
  Runs again while active just re-opens the browser.
- `/studio-analysis` — dispatches an agent task that uses the `archify` skill
  to produce a fresh graph snapshot, then refresh the page.
- `/studio-quit` — stop the server.

Graph snapshots come from the [archify](https://github.com/tt-a1i/archify)
skill, installed with the official skills CLI — the same way the other skills
in this repo are installed:

```bash
pnpm dlx skills@latest add tt-a1i/archify -s archify    # install
pnpm dlx skills@latest update                          # upgrade later
```

It lands in `.agents/skills/archify` (real copy, symlinked into `.claude/skills`)
and is picked up by pi through the `skills` entry in `settings.json`. Upstream
ships its own test suite, which nothing in the skill reads:

```bash
rm -rf .agents/skills/archify/test   # re-run after `skills update`
```

The server is a listener inside the pi process (127.0.0.1, random port,
token-gated). It closes on `session_shutdown` and cannot outlive pi — killing
pi kills it. There is no idle timeout: the workbench stays available as long
as the session lives.

## Comment flow

1. Click a node → details and source paths show in the side panel.
2. Type a comment and press Enter. The server appends it to the graph
   version's `comments-<graphId>.jsonl`, attaches a code snapshot of the
   node's first source file (head, 300 lines), and injects a user message
   into the session (`followUp`, so it queues while the agent is streaming).
3. The agent locates the code by source path first, falling back to
   fuzzy-matching the snapshot when the file has changed.

## Drill-down

The panel's **下钻** card has two buttons.

**看类型与依赖** inspects the selected node's sources statically (directories are
walked, first 8 source files) and returns, per file,

- **数据格式** — `interface` / `type` / `enum` / `class` declarations, verbatim; pure
  re-export files point at the file holding the real declaration
- **对外契约** — exported function and value signatures, plus `export … from` re-exports
- **依赖 · 项目内 / 外部包** — resolved internal imports (relative and `@/` alias) vs packages
- **被依赖** — which project files import it

**下钻分析** asks the agent to analyse that node with archify and write a drill
snapshot. Each snapshot is one file, `drill-<graphId>-<key>.json`, whose wrapper
records the relationship to the main graph because archify's IR schema is strict
and cannot carry extra fields:

```json
{ "parent": { "graph": "graph-…", "node": "modules" },
  "createdAt": "…", "ir": { …standard archify architecture IR… } }
```

The page polls until the snapshot lands, then the node becomes a **group node** —
a dashed container titled with the node's label, holding the sub-IR's components
and connections. The parent's external connections are re-pointed to the members
that file-level imports actually link (an unresolved connection stays on the
group). Drilling a member inside a group adds *its* members as an indented tree
**inside the same container**; the container grows to fit and a guide rail links
each expanded member to its own children. Collapse with the **收起分组** button or
by clicking the container; groups are restored on reload from the snapshots on
disk.

**Layout re-runs whenever the structure changes** (drill, collapse, 重置布局). Saved
positions act as a starting point, not a lock: a layout with no overlaps is kept
exactly as the user arranged it, but a newly drilled container pushes its
neighbours aside instead of overlapping them. Members inside a container are laid
out from the sub-IR's geometry plus a settling pass that accounts for the
indented trees hanging under them; child positions are owned by the layout (only
component positions are persisted).

Parsing is scanner-based (no compiler in the pi process); the reverse-import
index is cached in-process for 60s.

## Data layout

```
extensions/studio/data/<project-slug>/   (git-ignored)
├── graph-<YYYYMMDD-HHMMSS>.json         # Archify architecture IR snapshots
└── comments-<graphId>.jsonl             # append-only, per graph version
```

Comments belong to their graph version; the history dropdown switches
versions, each with its own comments. Node positions are kept in browser
localStorage per graph version.

## Page

Zero-build static files under `web/` (vendored Drawflow under `web/vendor/`,
ES modules for the app itself). Served by the extension; no CDN, no bundler.
Edges are drawn by an overlay with xy-flow-style floating anchors: each edge
picks the nearest side of both nodes and re-anchors on drag, zoom, and pan.

Edge prominence is computed from the graph, not authored: each node's link
count (degree) is normalised against the busiest node, and an edge takes the
more important of its two endpoints. That weight drives stroke width (1.5–5px)
and opacity (0.3–1.0); `variant` only controls colour and dash pattern.

Zoom: `−` / `+` step through Drawflow's zoom levels, `适配` scales the view to
fit every node (padding 70px), and the percentage next to them tracks the
current level. Ctrl+wheel zooms (Drawflow's own handler); a plain wheel pans
the canvas.

Run the checks with:

```bash
node --test extensions/studio/*.test.mjs
```
