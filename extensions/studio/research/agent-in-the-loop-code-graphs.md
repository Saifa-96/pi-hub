Research complete. Written to `sessions/--Users-saifa-96-Documents-Workspace-pi-hub--/subagent-artifacts/outputs/6bccdd78-2fe1-43ac-aab4-bcf92910d33a/extensions/studio/research/agent-in-the-loop-code-graphs.md` (~150 lines). All stars/push dates pulled live from the GitHub API today (2026-09-07); mechanisms verified against READMEs/docs/paper full text.

| Tool | Mechanism | Input → Output | License | Maintenance (verified) | Agent step reusable? | Fit 1–5 |
|---|---|---|---|---|---|---|
| repo-cartographer | **Hybrid by design**: static import graph + facts; LLM refines draft; CI `check` deterministic-only | JS/TS+Python → Mermaid/DOT/HTML + JSON | MIT | New, active CI | MCP + CLI + GH Action, model-agnostic | **5** |
| Archiscape | **Hybrid**: Python AST → NetworkX → community detection → optional GPT-4o-mini layer classifier + LLM narrative | Python → HTML/MD/JSON/GraphML/Mermaid | MIT | 1★, one-day research code (2026-07-26) | Python pkg, `--llm-key`; copy the pattern | **5** |
| ArchAgent (ICASSP'26) | **Hybrid agent**: AST ref graphs → adaptive token grouping → summaries → LLM emits partial Mermaid, merged | Large repos → Mermaid multiview | Paper; CC0 benchmark; **tool code not released** | Prompts public (1★) | Prompts only | 4 |
| GitDiagram | **LLM-only, 2-stage**: tree+README → graph AST → server validates (IDs, paths, connectivity) + retry → deterministic Mermaid | GitHub repo → Mermaid | MIT | 15,959★, pushed 2026-09-02 | Pattern yes; app is a web service | 4 |
| Bikach/codeGraph | **Static + agent consumes**: tree-sitter graph in LadybugDB; MCP queries (`get_module_overview`) | Java/Kotlin/TS/JS → on-disk graph | MIT | 9★, pushed 2026-08-05 | MCP server + Claude Code plugin; 40–50% token-reduction benchmark | 3 |
| Archify | **LLM-only skill**: chat/repo → validated self-contained HTML diagrams | English/repo → HTML | MIT | 51,444★, pushed 2026-09-07 | Skill for Cursor/Claude/Codex/OpenCode | 3 |
| DeepWiki | **Hybrid, proprietary**: cluster-based planning + agentic orchestration | Repo → wiki + arch diagrams | Proprietary | Active hosted service | No — `.devin/wiki.json` steering pattern only | 2 |
| deepwiki-open | OSS DeepWiki clone | Repo → wiki | (not captured) | 17,899★, pushed 2026-09-03 | Self-host, wiki-prose oriented | 3 |
| aider repomap | **Static**: tree-sitter + personalized PageRank, token-budgeted; no LLM clustering | Repo → ranked symbol map | Apache-2.0 | 48,807★, pushed 2026-05-22 | `repomap.py` importable | 3 |
| Continue | Static repo map + embeddings index; no LLM module graph | Workspace → context items | Apache-2.0 | Active | Index pieces only | 2 |
| Cursor / Cody | Embeddings/search retrieval; no module structure exposed | n/a | Proprietary | Active | No | 1 |
| Semble | Code search (~99% token claim), not structure gen | Query → snippets | see repo | Active launch | Retrieval layer only | 2 |
| vaporeyes/cartograph | LLM per-file maps (cheap model), cached, token-budgeted "Lens" | Repo → cached maps | (not captured) | 0★, dormant | Pattern only | 2 |

Key takeaways:

- **Your exact split already exists**: repo-cartographer's README states it verbatim — "The server extracts hard facts. The model does the reasoning." And Archiscape is literally static-graph + community detection + optional LLM naming/narrative (research-grade, 1★).
- **Strongest evidence the hybrid wins**: ArchAgent (arXiv 2601.13007) — dependency context in the LLM prompt raises diagram F1 by +0.11 (p<0.001), and full hybrid beats DeepWiki 0.966 vs 0.860 F1. Tool code unreleased; prompts + benchmark public.
- **Ranked integration for your pipeline**: (1) LLM naming pass over Louvain clusters — summaries only, strict JSON, cheap model (Archiscape pattern); (2) LLM merge/split proposals as a validated graph AST with deterministic cohesion/size gates and retry-with-feedback (GitDiagram + ArchAgent pattern); (3) persist `modules.json` + optional human steering file (`.devin/wiki.json` pattern); (4) expose the graph via MCP for studio agents (Bikach `get_module_overview` pattern).
- Caveats: "cartograph" name is ambiguous (5+ unrelated repos, one 404s); DeepWiki's graph-clustering detail is secondary-source; ArchAgent F1 is self-reported.