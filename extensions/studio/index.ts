/**
 * Studio — minimal shell: /studio starts an in-process static server and opens
 * the workbench page in the browser. The page is a plain xy-flow example with
 * mock data; everything else (graph APIs, analysis pipeline) lives outside
 * this extension by design.
 *
 * /studio      start the server and open the page
 * /studio-quit stop the server
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { openInBrowser, startStudioServer, type StudioServerHandle } from "./studio-server.ts";

const extensionDir = dirname(fileURLToPath(import.meta.url));

export default function studioExtension(pi: ExtensionAPI) {
	let server: StudioServerHandle | null = null;

	pi.registerCommand("studio", {
		description: "Start the studio page server and open it in the browser",
		handler: async (_args, ctx) => {
			if (server !== null) {
				openInBrowser(server.url);
				ctx.ui.notify(`studio already running: ${server.url}`, "info");
				return;
			}
			try {
				server = await startStudioServer({ webDir: join(extensionDir, "web") });
				openInBrowser(server.url);
				ctx.ui.notify(`studio: ${server.url}`, "info");
			} catch (error) {
				ctx.ui.notify(`studio failed to start: ${String(error)}`, "error");
			}
		},
	});

	pi.registerCommand("studio-quit", {
		description: "Stop the studio page server",
		handler: async (_args, ctx) => {
			if (server === null) {
				ctx.ui.notify("studio is not running", "info");
				return;
			}
			server.close();
			server = null;
			ctx.ui.notify("studio stopped", "info");
		},
	});

	pi.on("session_shutdown", () => {
		if (server !== null) {
			server.close();
			server = null;
		}
	});
}
