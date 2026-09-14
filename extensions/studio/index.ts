/**
 * Studio — local web interface for the current pi session.
 *
 * /studio starts an in-process HTTP bridge (127.0.0.1, token-gated) plus a
 * Next.js server (./web), then opens the page in your browser. The page shows
 * live session status over SSE. Chat stays in the CLI.
 *
 * Everything is torn down on session_shutdown (quit, /new, /resume, /reload).
 * After those, run /studio again.
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { createServer, type Server, type ServerResponse } from "node:http";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const WEB_DIR = join(dirname(fileURLToPath(import.meta.url)), "web");
const READY_TIMEOUT_MS = 180_000; // next build + start

let bridge: Server | null = null;
let heartbeat: ReturnType<typeof setInterval> | null = null;
let bridgeToken = "";
let nextProc: ChildProcess | null = null;
let nextReadyUrl = "";
const sseClients = new Set<ServerResponse>();
let ctxRef: ExtensionContext | null = null;
let stopping = false;

function push(event: Record<string, unknown>) {
  const data = `data: ${JSON.stringify(event)}\n\n`;
  for (const res of sseClients) res.write(data);
}

function statusEvent() {
  return {
    type: "hello",
    busy: ctxRef ? !ctxRef.isIdle() : false,
    model: ctxRef?.model ? `${ctxRef.model.provider}/${ctxRef.model.id}` : undefined,
    cwd: ctxRef?.cwd,
    session: ctxRef?.sessionManager.getSessionFile() ?? undefined,
  };
}

function json(res: ServerResponse, status: number, payload: unknown) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(payload));
}

function startBridge(pi: ExtensionAPI): Promise<number> {
  bridgeToken = randomBytes(16).toString("hex");
  return new Promise((resolve, reject) => {
    const server = createServer(async (req, res) => {
      const url = new URL(req.url ?? "/", "http://127.0.0.1");
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
      res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
      if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
      }
      if (url.searchParams.get("token") !== bridgeToken) {
        json(res, 401, { error: "invalid token" });
        return;
      }

      const path = url.pathname;
      try {
        if (path === "/events" && req.method === "GET") {
          res.writeHead(200, {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          });
          res.write(`data: ${JSON.stringify(statusEvent())}\n\n`);
          sseClients.add(res);
          req.on("close", () => sseClients.delete(res));
          return;
        }

        json(res, 404, { error: "not found" });
      } catch (err) {
        json(res, 500, { error: err instanceof Error ? err.message : "server error" });
      }
    });

    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        reject(new Error("studio bridge: invalid listen address"));
        return;
      }
      bridge = server;
      heartbeat = setInterval(() => {
        for (const res of sseClients) res.write(": ping\n\n");
      }, 25_000);
      resolve(addr.port);
    });
  });
}

function spawnWeb(
  port: number,
  token: string,
  script: string,
  onReady: (url: string) => void,
  onError: (msg: string) => void,
) {
  stopping = false;
  const isWin = process.platform === "win32";
  nextProc = spawn("pnpm", ["run", script], {
    cwd: WEB_DIR,
    shell: isWin,
    detached: !isWin, // own process group so teardown kills pnpm+sh+next together
    env: {
      ...process.env,
      BRIDGE_URL: `http://127.0.0.1:${port}`,
      BRIDGE_TOKEN: token,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let out = "";
  const onChunk = (chunk: Buffer) => {
    out += chunk.toString();
    const match = out.match(/Local:\s+(https?:\/\/\S+)/);
    if (match && !nextReadyUrl) {
      nextReadyUrl = match[1].replace(/\/+$/, "");
      onReady(nextReadyUrl);
    }
  };
  nextProc.stdout?.on("data", onChunk);
  nextProc.stderr?.on("data", onChunk);
  nextProc.on("error", (err) => {
    // spawn failures (ENOENT etc.) emit 'error'; without a listener Node
    // rethrows it and kills the pi process itself.
    if (!stopping && !nextReadyUrl) onError(`studio web failed to start: ${err.message}`);
  });
  nextProc.on("exit", (code) => {
    if (stopping) return;
    if (!nextReadyUrl) onError(`studio web build/start failed (code ${code}):\n${out.slice(-1000)}`);
    else onError(`studio web server exited (code ${code})`);
  });
  setTimeout(() => {
    if (!nextReadyUrl) onError(`studio web server not ready after ${READY_TIMEOUT_MS / 1000}s:\n${out.slice(-1000)}`);
  }, READY_TIMEOUT_MS);
}

function openBrowser(pi: ExtensionAPI, url: string) {
  const cmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "cmd" : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];
  pi.exec(cmd, args).catch(() => {});
}

export default function (pi: ExtensionAPI) {
  pi.on("session_start", async (_event, ctx) => {
    ctxRef = ctx;
  });

  pi.on("agent_start", async () => push({ type: "busy", busy: true }));
  pi.on("agent_settled", async () => push({ type: "busy", busy: false }));

  pi.registerCommand("studio", {
    description: "Open the studio web interface for this session (production build)",
    handler: async (_args, ctx) => {
      await startStudio(pi, ctx, existsSync(join(WEB_DIR, ".next", "BUILD_ID")) ? "serve" : "start");
    },
  });

  pi.registerCommand("studio-dev", {
    description: "Open the studio web interface in dev mode (hot reload, no build)",
    handler: async (_args, ctx) => {
      await startStudio(pi, ctx, "dev");
    },
  });

  pi.registerCommand("studio-analysis", {
    description: "Analyze this project's module dependencies into web/data/analyzed/",
    handler: async (_args, ctx) => {
      const projectCwd = ctx.cwd;
      let pkg: { name?: string; version?: string } = {};
      try {
        pkg = JSON.parse(readFileSync(join(projectCwd, "package.json"), "utf8"));
      } catch {
        // no package.json — fall back to dir name / 0.0.0
      }
      const name = (pkg.name || basename(projectCwd)).replace(/\//g, "-");
      const version = pkg.version || "0.0.0";
      ctx.ui.setStatus("studio-analysis", `cruising ${name}@${version}…`);
      try {
        const [{ cruise }, extractTSConfig] = await Promise.all([
          import("dependency-cruiser"),
          import("dependency-cruiser/config-utl/extract-ts-config"),
        ]);
        const tsConfigFile = join(projectCwd, "tsconfig.json");
        // ponytail: manual tsconfig.paths → enhanced-resolve alias; cruise's own
        // tsconfig-paths-webpack-plugin needs an enhanced-resolve internal that 5.24 removed.
        const parsed = existsSync(tsConfigFile) ? extractTSConfig.default(tsConfigFile) : undefined;
        const baseUrl = parsed?.options?.baseUrl ? resolve(parsed.options.baseUrl) : undefined;
        const alias: Record<string, string> = {};
        for (const [pattern, targets] of Object.entries(parsed?.options?.paths ?? {})) {
          const target = String((targets as string[])?.[0] ?? "");
          if (pattern.endsWith("/*") && target.endsWith("/*")) {
            const stripped = target.slice(0, -2);
            const abs = baseUrl ? resolve(baseUrl, stripped) : resolve(projectCwd, stripped);
            alias[pattern.slice(0, -2)] = isAbsolute(abs) ? abs : resolve(projectCwd, abs);
          }
        }
        const extras = parsed ? { tsConfig: parsed } : undefined;
        const resolveOptions = Object.keys(alias).length > 0 ? { alias } : undefined;
        const result = await cruise(
          [projectCwd],
          { doNotFollow: { path: "node_modules|\\.next|dist" }, outputType: "json" },
          resolveOptions,
          extras,
        );
        if (typeof result.output !== "string") throw new Error("unexpected cruise output");
        const report = JSON.parse(result.output) as { modules: unknown[]; summary: Record<string, unknown> };
        const digits = new Date().toISOString().replace(/\D/g, "");
        const stamp = `${digits.slice(0, 8)}-${digits.slice(8, 14)}`; // YYYYMMDD-HHMMSS
        const dir = join(WEB_DIR, "data", "analyzed", name, version);
        await mkdir(dir, { recursive: true });
        const file = join(dir, `graph-${stamp}.json`);
        await writeFile(
          file,
          JSON.stringify(
            { project: projectCwd, name, version, generatedAt: new Date().toISOString(), modules: report.modules, summary: report.summary },
            null,
            2,
          ),
        );
        ctx.ui.setStatus("studio-analysis", undefined);
        ctx.ui.notify(`studio-analysis: ${report.summary.totalCruised} modules → ${file}`, "info");
      } catch (err) {
        ctx.ui.setStatus("studio-analysis", undefined);
        ctx.ui.notify(`studio-analysis failed: ${err instanceof Error ? err.message : err}`, "error");
      }
    },
  });

  pi.registerCommand("studio-quit", {
    description: "Stop the studio web server and bridge",
    handler: async (_args, ctx) => {
      if (!bridge && !nextProc) {
        ctx.ui.setStatus("studio", undefined); // clear stale status from a previous run
        ctx.ui.notify("studio is not running", "info");
        return;
      }
      stopStudio();
      ctx.ui.setStatus("studio", undefined);
      ctx.ui.notify("studio stopped — run /studio to start it again", "info");
    },
  });

  pi.on("session_shutdown", async (_event, ctx) => {
    stopStudio();
    ctx.ui.setStatus("studio", undefined);
    ctx.ui.setStatus("studio-analysis", undefined);
  });
}

async function startStudio(pi: ExtensionAPI, ctx: ExtensionContext, script: string) {
  ctxRef = ctx;
  if (bridge && nextReadyUrl) {
    openBrowser(pi, nextReadyUrl);
    return;
  }

  startBridge(pi)
    .then((port) => {
      ctx.ui.setStatus("studio", script === "dev" ? "starting dev server…" : "starting web server…");
      spawnWeb(
        port,
        bridgeToken,
        script,
        (url) => {
          ctx.ui.setStatus("studio", url);
          openBrowser(pi, url);
        },
        (msg) => {
          ctx.ui.setStatus("studio", undefined);
          ctx.ui.notify(msg, "error");
        },
      );
    })
    .catch((err: unknown) => {
      ctx.ui.notify(`studio bridge failed: ${err instanceof Error ? err.message : err}`, "error");
    });
}

function stopStudio() {
  stopping = true;
  if (nextProc && !nextProc.killed) {
    if (process.platform === "win32") {
      spawnSync("taskkill", ["/pid", String(nextProc.pid ?? 0), "/T", "/F"], { shell: true });
    } else if (typeof nextProc.pid === "number") {
      // kill(-0) would SIGTERM pi's own process group — only group-kill a real pid
      try {
        process.kill(-nextProc.pid, "SIGTERM"); // whole process group
      } catch {
        nextProc.kill();
      }
    }
  }
  nextProc = null;
  nextReadyUrl = "";
  if (heartbeat) clearInterval(heartbeat);
  heartbeat = null;
  for (const res of sseClients) res.end();
  sseClients.clear();
  bridge?.close();
  bridge = null;
}
