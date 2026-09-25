/**
 * In-process studio server: serves the static workbench page on a random free
 * 127.0.0.1 port. No API, no token — the page is self-contained with mock
 * data. Lives exactly as long as the pi process.
 */

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createReadStream } from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";

export interface StudioServerDeps {
	webDir: string;
}

export interface StudioServerHandle {
	url: string;
	port: number;
	close: () => void;
}

const STATIC_ROUTES: Record<string, { filePath: string; contentType: string }> = {
	"/": { filePath: "index.html", contentType: "text/html; charset=utf-8" },
	"/app.js": { filePath: "app.js", contentType: "text/javascript; charset=utf-8" },
	"/studio.css": { filePath: "studio.css", contentType: "text/css; charset=utf-8" },
};

function sendStaticFile(res: ServerResponse, webDir: string, route: { filePath: string; contentType: string }): void {
	const stream = createReadStream(join(webDir, route.filePath));
	res.writeHead(200, { "content-type": route.contentType, "cache-control": "no-store" });
	stream.on("error", () => {
		res.statusCode = 404;
		res.end("not found");
	});
	stream.pipe(res);
}

/**
 * Start the studio server on a random free localhost port.
 */
export function startStudioServer(deps: StudioServerDeps): Promise<StudioServerHandle> {
	const server = createServer((req: IncomingMessage, res: ServerResponse) => {
		const pathname = new URL(req.url ?? "/", "http://127.0.0.1").pathname;
		const route = STATIC_ROUTES[pathname];
		if (req.method === "GET" && route !== undefined) {
			sendStaticFile(res, deps.webDir, route);
			return;
		}
		res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
		res.end("not found");
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
				url: `http://127.0.0.1:${address.port}/`,
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
