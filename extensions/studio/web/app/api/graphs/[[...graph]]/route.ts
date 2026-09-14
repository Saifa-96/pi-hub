import { readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ANALYZED_DIR = join(process.cwd(), "data", "analyzed");
const SAFE_SEG = /^[a-zA-Z0-9@._-]+$/;
const SAFE_FILE = /^graph-\d{8}-\d{6}\.json$/;

// GET /api/graphs                          → list all analyzed graphs
// GET /api/graphs/<name>/<version>/<file>  → one graph JSON
export async function GET(_req: Request, { params }: { params: Promise<{ graph?: string[] }> }) {
  const { graph } = await params;

  if (!graph || graph.length === 0) {
    const out: { key: string; name: string; version: string; file: string; generatedAt: string }[] = [];
    for (const name of await readdir(ANALYZED_DIR).catch(() => [] as string[])) {
      if (!SAFE_SEG.test(name)) continue;
      for (const version of await readdir(join(ANALYZED_DIR, name)).catch(() => [] as string[])) {
        if (!SAFE_SEG.test(version)) continue;
        for (const file of await readdir(join(ANALYZED_DIR, name, version)).catch(() => [] as string[])) {
          if (!SAFE_FILE.test(file)) continue;
          const full = join(ANALYZED_DIR, name, version, file);
          out.push({
            key: `${name}/${version}/${file}`,
            name,
            version,
            file,
            generatedAt: (await stat(full)).mtime.toISOString(),
          });
        }
      }
    }
    out.sort((a, b) => b.generatedAt.localeCompare(a.generatedAt));
    return Response.json({ graphs: out });
  }

  const [name, version, file] = graph;
  if (!name || !version || !file || !SAFE_SEG.test(name) || !SAFE_SEG.test(version) || !SAFE_FILE.test(file)) {
    return Response.json({ error: "bad graph path" }, { status: 400 });
  }
  try {
    const raw = await readFile(join(ANALYZED_DIR, name, version, file), "utf8");
    const parsed = JSON.parse(raw);
    return Response.json({ name, version, file, modules: parsed.modules, summary: parsed.summary });
  } catch {
    return Response.json({ error: "graph not found" }, { status: 404 });
  }
}
