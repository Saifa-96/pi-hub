Research complete. Report written to the authoritative output path (220 lines). Key facts verified live against npm registry + GitHub API (survey date 2026-09-07); notable discoveries: LSIF-TS was renamed to scip-typescript, SCIP moved to scip-code org, LadybugDB is real and very active (Kuzu successor), topoCode is an Electron app (not a library), and no off-the-shelf JS module-clustering library exists — our graphology glue is state of the practice.

## Comparison table

| Name | Category | Latest ver / date | License | API | Replaces (studio pipeline part) | Fit |
|---|---|---|---|---|---|---|
| dependency-cruiser | Dep engine | 18.2.0 / 2026-08-10 | MIT | Node `cruise()` + CLI | cruise + **tsconfig alias conversion** (config-utl `extractTSConfig`) | 5 |
| skott | Dep engine | 0.35.11 / pushed 2026-04-27 | MIT | Node `skott()` graph API + CLI | cruise + filtering (alternative engine) | 4 |
| dpdm | Dep engine | 4.3.0 / pushed 2026-07-29 | MIT | Node (usage-as-package) + CLI | cruise + alias (TS path mapping built-in) | 3 |
| madge | Dep engine | 8.0.0 / pushed 2026-01-21 | MIT | Node `require('madge')` + CLI | cruise (weaker TS story) | 2 |
| knip | Issues/dead-code | 6.34.0 / 2026-08-31 | ISC | CLI + `--reporter json` (no public graph API) | none; enriches graph (cycles, unused, dupes) | 3 |
| topoCode | Module clustering | n/a — app, not on npm (verified 404) | Apache-2.0 | Electron/Vue + Python app | nothing directly (validates Louvain/Leiden approach) | 1 |
| scip-typescript | Symbol index | 0.4.0 / tag 2025-10-02, commits → 2026-09-04 | Apache-2.0 | CLI only | cruise → derived symbol-level edges (heavy) | 2 |
| scip (scip-code org) | Symbol index toolbox | pushed 2026-09-03 | Apache-2.0 | Go CLI | none; SCIP post-processing | 2 |
| Kythe | Symbol index | pushed 2026-07-16 | Apache-2.0 | CLI/servers, Bazel-heavy | none realistic | 1 |
| Meta Glean | Symbol index | pushed 2026-09-06 | NOASSERTION (GitHub API) | server/thrift | none | 1 |
| Semble | Repo-map/retrieval | v0.5.6 / 2026-09-05 | MIT | Python + MCP + CLI | none for dep graph; optional naming aid | 2 |
| aider repomap | Repo-map | in-app; aider pushed 2026-05-22 | Apache-2.0 | not extractable (3rd-party clones tiny) | naming/ranking pattern only | 2 |
| Bikach/codeGraph | tree-sitter→graph MCP | no releases; pushed 2026-08-05 | MIT | MCP server + Claude plugin | none; reference architecture | 2 |
| LadybugDB | Graph storage | v0.20.2 / 2026-09-02 | MIT | Embedded Cypher; Node `@ladybugdb/ladybug` + WASM | graph persistence/serving (if ever needed) | 3 |
| CodeCharta | Viz + data model | ana 2.0.x; pushed 2026-09-07 | BSD-3-Clause | Java `ccsh` CLI + Web Studio | interchange format (cc.json) → free 3D viz | 3 |
| Nx project graph | Project-level graph | pushed 2026-09-06 | MIT | Node `createProjectGraphAsync()` | project-level layer, not module-level | 2 |
| Turborepo graph | Project-level graph | pushed 2026-09-07 | MIT | `turbo query` GraphQL (experimental CLI) | package-level only | 1 |
| graphology (keep) | Graph lib | 0.26.0 | MIT | Node | already ours; no official serializer pkg | 5 |

**Bottom line:** adopt (1) dependency-cruiser's `extractTSConfig` + `{ tsConfig }` cruise option to delete the hand-rolled alias-conversion stage; (2) keep graphology Louvain/dagre/naming glue — nothing surveyed replaces it as a library; (3) optionally layer knip's JSON reporter for cycles/unused and emit CodeCharta cc.json as a free extra viz format. Watch skott and LadybugDB; skip the rest.