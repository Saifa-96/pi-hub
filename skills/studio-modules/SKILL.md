---
name: studio-modules
description: Turn studio's deterministic dependency clusters (clusters.json) into named logical modules (modules.json). Use when the user wants agent naming/merge/split of code modules after /studio-analysis, or says "name the modules" / "refine modules".
---

# studio-modules

Deterministic facts are already computed (dependency-cruiser graph + Louvain
clusters). Your ONLY job: reason over the cluster summary and emit
`modules.json` — module names, summaries, merges, splits. You never touch the
source code and never invent files.

## Workflow

1. Read the target `clusters.json` (path given by the user or the newest under
   `extensions/studio/web/data/analyzed/<name>/<version>/`).
2. For each cluster: infer its business purpose from file paths and dominant
   tags. Give it a domain name, not a path name — "grammar-practice", not
   "app-features".
3. You MAY merge clusters that belong to one concern, MAY split a cluster that
   mixes concerns, MAY move individual files between clusters. The evidence is
   `crossEdges` (strong cross-cluster coupling suggests merging) and file paths.
4. Write `modules.json` next to `clusters.json` (same directory), following the
   Output Contract below EXACTLY.
5. Validate: `node <this-skill>/scripts/validate-modules.mjs <clusters.json> <modules.json>`
   (run with cwd `extensions/studio/web/` so deps resolve). If it fails, read
   the reasons, fix, re-validate. Maximum 3 attempts; then stop and report.
6. Report: module list (name · files · one-line summary) and what you merged/split and why.

## Output Contract (modules.json)

```json
{
  "basedOn": "<clusters.json file name>",
  "generatedAt": "<ISO 8601>",
  "state": "trial",
  "modules": [
    {
      "id": "<kebab-case-slug>",
      "name": "<Human Readable Name>",
      "summary": "<一句话（中文）说明这个模块是什么>",
      "files": ["<exact path from clusters.json files>"],
      "clusterIds": [0]
    }
  ]
}
```

Hard rules:
- `files` across all modules must cover EVERY file in clusters.json — no
  missing, no extra, no duplicates. Coverage is validated, not trusted.
- `id`: lowercase kebab-case, unique. `name`: non-empty. `clusterIds`:
  provenance clusters the files came from (best effort).
- Keep 1–60 modules. Do not emit any other top-level keys.
- Names describe responsibility ("spaced-repetition-scheduler"), never
  location ("src-helpers").

## Privacy rule

Work ONLY from clusters.json (paths, tags, edge counts). Never request the full
repository, never paste whole files into your reasoning.
