#!/usr/bin/env node
// Deterministic prep: graph-*.json -> clusters.json (Louvain, seeded, resolution 0.8)
// Usage: node extract-clusters.mjs <path/to/graph-*.json>   (cwd: extensions/studio/web)
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const req = createRequire(new URL("../../../extensions/studio/web/package.json", import.meta.url));
const Graph = req("graphology");
const louvain = req("graphology-communities-louvain");

const graphFile = process.argv[2];
if (!graphFile) {
  console.error("usage: extract-clusters.mjs <graph-*.json>");
  process.exit(1);
}
const report = JSON.parse(readFileSync(graphFile, "utf8"));
const modules = report.modules.filter(
  (m) =>
    (m.source.startsWith(".") || m.source.startsWith("/")) &&
    !m.source.startsWith("@") &&
    !m.source.includes("node_modules/") &&
    !m.source.includes("/.next/"),
);

function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function commonDirPrefix(paths) {
  if (paths.length === 0) return "";
  let prefix = paths[0].substring(0, paths[0].lastIndexOf("/") + 1) || "/";
  for (const p of paths) {
    let i = 0;
    const end = Math.min(prefix.length, p.length);
    while (i < end && prefix[i] === p[i]) i++;
    prefix = prefix.slice(0, i);
    const cut = prefix.lastIndexOf("/");
    prefix = cut === -1 ? "" : prefix.slice(0, cut + 1);
    if (prefix === "") break;
  }
  return prefix;
}
const prefix = commonDirPrefix(modules.map((m) => m.source));
const tagOf = (src) => {
  const rel = src.startsWith(prefix) ? src.slice(prefix.length) : src;
  const segs = rel.split("/").filter((s) => s !== "." && s !== "..");
  if (segs.length <= 1) return "(root)";
  return segs[0] === "src" && segs.length > 2 ? segs[1] : segs[0];
};

const inProject = new Set(modules.map((m) => m.source));
const pairWeight = new Map();
const g = new Graph({ multi: false, type: "undirected" });
for (const m of modules) g.addNode(m.source);
for (const m of modules) {
  for (const d of m.dependencies ?? []) {
    if (d.couldNotResolve || !inProject.has(d.resolved) || d.resolved === m.source) continue;
    const key = [m.source, d.resolved].sort().join("\u0000");
    pairWeight.set(key, (pairWeight.get(key) ?? 0) + 1);
  }
}
for (const [key, w] of pairWeight) {
  const [a, b] = key.split("\u0000");
  g.mergeEdge(a, b, { weight: w });
}

const communities = louvain(g, { rng: mulberry32(42), getEdgeWeight: "weight", resolution: 0.8 });

const filesBy = new Map();
for (const [src, cid] of Object.entries(communities)) {
  (filesBy.get(cid) ?? filesBy.set(cid, []).get(cid)).push(src);
}
const clusters = [...filesBy.entries()]
  .map(([cid, files], i) => {
    const tags = {};
    for (const f of files) tags[tagOf(f)] = (tags[tagOf(f)] ?? 0) + 1;
    return { id: i, clusterIdsRaw: cid, files: files.sort(), dominantTags: Object.entries(tags).sort((a, b) => b[1] - a[1]).slice(0, 4) };
  })
  .sort((a, b) => b.files.length - a.files.length);

const cidToIdx = new Map(clusters.map((c) => [c.clusterIdsRaw, c.id]));
const idxOfFile = new Map();
for (const c of clusters) for (const f of c.files) idxOfFile.set(f, c.id);
for (const c of clusters) {
  c.internalEdges = 0;
  c.crossEdges = [];
  const cross = new Map();
  for (const [key, w] of pairWeight) {
    const [a, b] = key.split("\u0000");
    if (!idxOfFile.has(a) || !idxOfFile.has(b)) continue;
    const ca = idxOfFile.get(a);
    const cb = idxOfFile.get(b);
    if (ca === c.id && cb === c.id) c.internalEdges += w;
    else if (ca === c.id || cb === c.id) {
      const other = ca === c.id ? cb : ca;
      cross.set(other, (cross.get(other) ?? 0) + w);
    }
  }
  c.crossEdges = [...cross.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([to, w]) => ({ to, w }));
  delete c.clusterIdsRaw;
}

const out = join(dirname(graphFile), "clusters.json");
writeFileSync(
  out,
  JSON.stringify({ basedOn: graphFile.split("/").pop(), generatedAt: new Date().toISOString(), algorithm: "louvain/0.8/seed42", files: modules.map((m) => m.source).sort(), clusters }, null, 2),
);
console.log(`clusters: ${clusters.length} files: ${modules.length} -> ${out}`);
