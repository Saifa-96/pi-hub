"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import dagre from "@dagrejs/dagre";
import Graph from "graphology";
import louvain from "graphology-communities-louvain";
import { Background, BackgroundVariant, Controls, MiniMap, ReactFlow, type Edge, type Node, type NodeTypes } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import "./graph-view.css";
import { ModuleNode } from "./module-node";

const nodeTypes: NodeTypes = { moduleNode: ModuleNode };

interface GraphMeta {
  key: string;
  name: string;
  version: string;
  file: string;
  generatedAt: string;
}

interface CruiseModule {
  source: string;
  dependencies?: { resolved: string; couldNotResolve?: boolean }[];
}

// Logical modules via community detection (Louvain) on the file-level dependency
// graph — files that are densely connected internally / loosely coupled
// externally form one module, independent of folder layout. (topoCode's approach)
// ponytail: undirected modularity; resolution tuning when projects need finer split
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function toFlow(modules: CruiseModule[]): { nodes: Node[]; edges: Edge[] } {
  const projectModules = modules.filter(
    (m) =>
      (m.source.startsWith(".") || m.source.startsWith("/")) &&
      !m.source.startsWith("@") &&
      !m.source.includes("node_modules/") &&
      !m.source.includes("/.next/"),
  );
  const prefix = commonDirPrefix(projectModules.map((m) => m.source));
  const tagOf = (src: string): string => {
    const rel = src.startsWith(prefix) ? src.slice(prefix.length) : src;
    const segs = rel.split("/").filter((s) => s !== "." && s !== "..");
    if (segs.length <= 1) return "(root)";
    return segs[0] === "src" && segs.length > 2 ? segs[1] : segs[0];
  };

  const inProject = new Set(projectModules.map((m) => m.source));
  const pairWeight = new Map<string, number>();
  const g = new Graph({ multi: false, type: "undirected" });
  for (const m of projectModules) g.addNode(m.source);
  for (const m of projectModules) {
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

  const tagOf2 = (src: string): string => {
    const rel = src.startsWith(prefix) ? src.slice(prefix.length) : src;
    const segs = rel.split("/").filter((s) => s !== "." && s !== "..");
    if (segs.length <= 1) return "(root)";
    const first = segs[0] === "src" && segs.length > 2 ? segs[1] : segs[0];
    return segs.length > 1 ? `${first}/${segs[segs.length - 2]}` : first;
  };

  // group files per community; name by dominant dir tag, deeper tag on collision
  const filesBy = new Map<number, string[]>();
  for (const [src, cid] of Object.entries(communities)) {
    (filesBy.get(cid) ?? filesBy.set(cid, []).get(cid)!).push(src);
  }
  const usedNames = new Map<string, number>();
  const nameOf = new Map<number, string>();
  for (const [cidStr, files] of [...filesBy].sort((a, b) => b[1].length - a[1].length)) {
    const counts = new Map<string, number>();
    for (const f of files) counts.set(tagOf(f), (counts.get(tagOf(f)) ?? 0) + 1);
    let best = "";
    let n = -1;
    for (const [tag, c] of counts) if (c > n) { n = c; best = tag; }
    const seen = (usedNames.get(best) ?? 0) + 1;
    usedNames.set(best, seen);
    nameOf.set(cidStr, seen > 1 ? tagOf2(files[0]) : best);
  }

  const moduleOf = new Map<string, string>();
  for (const [src, cid] of Object.entries(communities)) moduleOf.set(src, nameOf.get(cid) ?? "?");

  const fileCount = new Map<string, number>();
  for (const name of moduleOf.values()) fileCount.set(name, (fileCount.get(name) ?? 0) + 1);

  const edgeSet = new Map<string, Edge>();
  for (const [key] of pairWeight) {
    const [a, b] = key.split("\u0000");
    const from = moduleOf.get(a)!;
    const to = moduleOf.get(b)!;
    if (from === to) continue;
    const id = `${from}->${to}`;
    if (!edgeSet.has(id)) edgeSet.set(id, { id, source: from, target: to });
  }

  const nodes: Node[] = [...fileCount.keys()].map((mod) => ({
    id: mod,
    type: "moduleNode",
    position: { x: 0, y: 0 },
    data: { title: mod, files: fileCount.get(mod) ?? 0 },
  }));
  const edges = [...edgeSet.values()];

  // dagre layered layout (LR), keeps crossings + rank spacing sane
  const NODE_W = 220;
  const NODE_H = 64;
  const dg = new dagre.graphlib.Graph();
  dg.setGraph({ rankdir: "LR", nodesep: 50, ranksep: 160, marginx: 20, marginy: 20 });
  dg.setDefaultEdgeLabel(() => ({}));
  for (const n of nodes) dg.setNode(n.id, { width: NODE_W, height: NODE_H });
  for (const e of edges) dg.setEdge(e.source, e.target);
  dagre.layout(dg);
  for (const n of nodes) {
    const p = dg.node(n.id);
    n.position = { x: p.x - NODE_W / 2, y: p.y - NODE_H / 2 };
  }

  return { nodes, edges };
}

function commonDirPrefix(paths: string[]): string {
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

export function GraphView() {
  const [picked, setPicked] = useState<string | null>(null);

  const listQuery = useQuery({
    queryKey: ["graphs"],
    queryFn: async (): Promise<GraphMeta[]> => {
      const r = await fetch("/api/graphs");
      if (!r.ok) throw new Error(`list ${r.status}`);
      const d = (await r.json()) as { graphs?: GraphMeta[] };
      return d.graphs ?? [];
    },
  });
  const list = listQuery.data ?? [];
  // picked=null means "follow the newest graph"; user choice wins once made.
  const selected = picked ?? list[0]?.key ?? "";

  const graphQuery = useQuery({
    queryKey: ["graph", selected],
    queryFn: async (): Promise<CruiseModule[]> => {
      const r = await fetch(`/api/graphs/${selected}`);
      if (!r.ok) throw new Error(`load ${r.status}`);
      const d = (await r.json()) as { modules?: CruiseModule[] };
      return d.modules ?? [];
    },
    enabled: selected !== "",
  });

  const flow = useMemo(() => toFlow(graphQuery.data ?? []), [graphQuery.data]);

  if (listQuery.isError) return <p className="p-4 text-sm text-destructive">{String(listQuery.error)}</p>;
  if (listQuery.isLoading) return <p className="p-4 text-sm text-muted-foreground">loading graphs…</p>;
  if (list.length === 0)
    return <p className="p-4 text-sm text-muted-foreground">No analyzed graphs — run /studio-analysis in a session first.</p>;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b px-4 py-2">
        <select
          className="rounded-md border bg-background px-2 py-1 text-xs"
          value={selected}
          onChange={(e) => setPicked(e.target.value)}
        >
          {list.map((g) => (
            <option key={g.key} value={g.key}>
              {g.name}@{g.version} · {g.file.replace(/^graph-|\.json$/g, "")}
            </option>
          ))}
        </select>
        <span className="text-xs text-muted-foreground">
          {graphQuery.isLoading
            ? "loading…"
            : graphQuery.isError
              ? String(graphQuery.error)
              : `${flow.nodes.length} modules · ${flow.edges.length} edges`}
        </span>
      </div>
      <div className="min-h-0 flex-1">
        <ReactFlow nodes={flow.nodes} edges={flow.edges} nodeTypes={nodeTypes} fitView minZoom={0.05} proOptions={{ hideAttribution: true }} defaultEdgeOptions={{ type: "smoothstep" }}>
          <Background variant={BackgroundVariant.Dots} gap={24} size={1.5} color="var(--border)" />
          <Controls />
          <MiniMap pannable zoomable nodeColor="var(--primary)" maskColor="color-mix(in oklab, var(--background) 85%, transparent)" style={{ backgroundColor: "var(--card)" }} />
        </ReactFlow>
      </div>
    </div>
  );
}
