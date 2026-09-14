# Research: JS/TS dependency-graph libraries for studio

> Researched 2026-09-07 against primary sources (npm registry, GitHub repos/releases, official docs). Verbatim claims verified; see per-item sources.

## Summary
**dependency-cruiser** is the best fit: v18.2.0 (2026-08-10, verified via npm registry + GitHub Releases API — not memory), programmatic `cruise()` API returning a schema-backed JSON `modules[]/dependencies[]` graph that maps 1:1 onto xyflow nodes/edges, TS/tsconfig support, `--preserve-symlinks` for pnpm, `--cache`/`--affected` for cheap re-runs, MIT. **dpdm** (v4.3.0) is the lightweight runner-up.

## Findings (all primary-source verified)
1. **dependency-cruiser 18.2.0 (2026-08-10, MIT, very active)** — JSON output with schema; `cruise()` API; tsConfig + preserve-symlinks; `--cache`/`--affected`; no watch mode. Sources: [api.md](https://github.com/sverweij/dependency-cruiser/blob/main/doc/api.md), [output-format.md](https://github.com/sverweij/dependency-cruiser/blob/main/doc/output-format.md). Confidence: high.
2. **dpdm 4.3.0 (2026-07-29, MIT)** — TS-compiler parsing, project references, `Record<string, Dependency[]>` JSON + typed API, `--group-by-package`; no documented cache. Confidence: high.
3. **ts-morph 28.0.0 (2026-04-12, MIT, active)** — API-only; you build the graph; no incremental out of box. Confidence: high.
4. **madge 8.0.0 (last publish 2024-08-05, MIT)** — `.obj()` adjacency API, tsConfig support, but stale dependency chain. Confidence: high.
5. **knip 6.34.0 (2026-08-31, ISC)** — full internal `Map<filePath, FileNode>` module graph documented in-repo (oxc parser, workspace-aware, on-disk cache), but **no user-facing graph output** — CLI is unused-export reporting only. Confidence: high.
6. **Claude Code plugins** (4 audited from primary READMEs): regex static-import mappers (claude-dependency-mapper), madge-wrapped daemon (claude-code.graph), tree-sitter→LadybugDB MCP (Bikach codegraph), agent-driven Mermaid (cartograph). None uses compiler-grade resolution.
7. **Agent repo-map techniques**: aider = tree-sitter tags → networkx personalized PageRank (verified from `repomap.py` source); Continue = content-addressed incremental indexers + tree-sitter; stack-graphs = tree-sitter-graph DSL, now **unmaintained by GitHub**; SCIP = protobuf occurrence index, not import edges.

## Contradictions
None material; dpdm's "madge is inconclusive for TS" recorded as vendor claim.

## Missing evidence
No tool in this space has a watch mode — caching + external watcher is the integration path (inference, documented as such). aider.chat docs page unreachable (claims sourced from code). ts-morph README not fetchable at expected path.
## Addendum: Koala聊开源 推荐过的项目分析工具

Source: koala-oss.app 科技周报数据库 (Supabase `news` 表, 2022–至今), 逐条核过原文.

| 推荐 | 链接 | 与 studio 的关系 |
|---|---|---|
| **Dependency Cruiser 代码架构的守门员** (2026-03) | github.com/sverweij/dependency-cruiser | ✅ 与本报告选型一致; Koala 视角=架构防腐/CI 规则 |
| **Metz 代码设计复杂架构图** | metz.sh | 底层编译器把 TS 描述转成 **ReactFlow 配置**渲染 — 与 studio 的 xyflow 路线同构, 图数据组织可参考 |
| **sem 语义级代码 Diff** | ataraxy-labs.github.io/sem | `sem impact` 跨文件依赖影响分析; 语义 diff 喂 agent 准确率 +2.3× — 直接适用于 plans/<id> 的 graph-edit.diff → agent 任务环节 |
| **Semble Agent 代码检索** | github.com/MinishLab/semble | tree-sitter 语义粒度检索, 索引 250ms/查询 1.5ms — agent 侧理解"为什么改"的上下文检索参考 |
| **autodev-codebase MCP** | github.com/anrgct/autodev-codebase | AST 分块+向量索引+**实时监测代码变化** — /studio-dev 的 watch→增量重分析可参考 |
| GitDiagram / SCAST / Archify | github 链接见周报 | "生成架构图"另一派: LLM 直出(有幻觉) / 代码→Mermaid+D3 / skill 产 HTML — 非编译器级, 不采用但验证了图可视化需求普遍 |
| ast-grep / tree-sitter / Sourcebot / File-check-used | — | 周边工具: AST 搜索 / 解析框架 / 代码搜索 / 死代码检测 |
