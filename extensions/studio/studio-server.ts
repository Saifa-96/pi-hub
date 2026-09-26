/**
 * In-process studio server: serves the static workbench page on a random free
 * 127.0.0.1 port, plus one token-gated API (GET /api/graph) that reads the
 * project's graph.json. Lives exactly as long as the pi process.
 */

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createReadStream, existsSync, readFileSync } from "node:fs";
import { createHash, randomBytes } from "node:crypto";
import { join } from "node:path";
import { spawn } from "node:child_process";

export interface StudioServerDeps {
	webDir: string;
	dataDir: string;
	projectRoot: string;
}

export interface StudioServerHandle {
	url: string;
	port: number;
	close: () => void;
}

const STATIC_ROUTES: Record<string, { filePath: string; contentType: string }> = {
	"/": { filePath: "index.html", contentType: "text/html; charset=utf-8" },
	"/app.js": { filePath: "app.js", contentType: "text/javascript; charset=utf-8" },
	"/api.js": { filePath: "api.js", contentType: "text/javascript; charset=utf-8" },
	"/studio.css": { filePath: "studio.css", contentType: "text/css; charset=utf-8" },
};

function sendJson(res: ServerResponse, status: number, body: unknown): void {
	const payload = JSON.stringify(body);
	res.writeHead(status, {
		"content-type": "application/json; charset=utf-8",
		"content-length": Buffer.byteLength(payload),
		"cache-control": "no-store",
	});
	res.end(payload);
}

function sendStaticFile(res: ServerResponse, webDir: string, route: { filePath: string; contentType: string }): void {
	const stream = createReadStream(join(webDir, route.filePath));
	res.writeHead(200, { "content-type": route.contentType, "cache-control": "no-store" });
	stream.on("error", () => {
		res.statusCode = 404;
		res.end("not found");
	});
	stream.pipe(res);
}

function tokenMatches(provided: string | null, expected: string): boolean {
	if (provided === null || provided === "") return false;
	const a = Buffer.from(provided);
	const b = Buffer.from(expected);
	return a.length === b.length && createHash("sha256").update(a).digest().equals(createHash("sha256").update(b).digest());
}

/**
 * Start the studio server on a random free localhost port.
 */
export function startStudioServer(deps: StudioServerDeps): Promise<StudioServerHandle> {
	const token = randomBytes(16).toString("hex");
	const server = createServer((req: IncomingMessage, res: ServerResponse) => {
		const url = new URL(req.url ?? "/", "http://127.0.0.1");
		const route = STATIC_ROUTES[url.pathname];

		// 静态资源免 token（浏览器不会把页面 query 转发给子资源）；API 需要。
		if (req.method === "GET" && route !== undefined) {
			sendStaticFile(res, deps.webDir, route);
			return;
		}

		if (!tokenMatches(url.searchParams.get("token"), token)) {
			sendJson(res, 401, { error: "unauthorized" });
			return;
		}

		if (url.pathname === "/api/graph" && req.method === "GET") {
			const file = join(deps.dataDir, "graph.json");
			if (!existsSync(file)) {
				// 缺图不是错误：页面据此提示先跑 /studio-analyze
				sendJson(res, 200, { graph: null });
				return;
			}
			try {
				sendJson(res, 200, { graph: JSON.parse(readFileSync(file, "utf8")) });
			} catch {
				sendJson(res, 200, { graph: null });
			}
			return;
		}

		sendJson(res, 404, { error: "not found" });
	});

	return new Promise((resolveListen, rejectListen) => {
		server.once("error", rejectListen);
		server.listen(0, "127.0.0.1", () => {
			const address = server.address();
			if (address === null || typeof address === "string") {
				server.close();
				rejectListen(new Error("no port assigned"));
				return;
			}
			resolveListen({
				url: `http://127.0.0.1:${address.port}/?token=${token}`,
				port: address.port,
				close: () => server.close(),
			});
		});
	});
}

/**
 * Open a URL in the platform browser, detached so pi never waits on it.
 */
export function openInBrowser(url: string): void {
	if (process.platform === "darwin") {
		spawn("open", [url], { detached: true, stdio: "ignore" }).unref();
		return;
	}
	if (process.platform === "win32") {
		spawn("cmd.exe", ["/c", "start", "", url], { detached: true, stdio: "ignore" }).unref();
		return;
	}
	spawn("xdg-open", [url], { detached: true, stdio: "ignore" }).unref();
}
