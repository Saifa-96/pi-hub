/**
 * Studio — 设计结构图工作台：/studio 启动进程内服务并打开页面。
 *
 * /studio          start the server and open the page
 * /studio-analyze  派发分析任务：sendUserMessage 触发 turn（官方 send-user-message
 *                  示例模式），主 agent 在 turn 内前台调用 pi-subagents 的
 *                  subagent 工具 → ESC 可中断
 * /studio-quit     stop the server
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { openInBrowser, startStudioServer, type StudioServerHandle } from "./studio-server.ts";

const extensionDir = dirname(fileURLToPath(import.meta.url));

/** 数据目录：extensions/studio/data/<项目名>/（项目名取 package.json name，退化到目录名） */
function projectDataDir(cwd: string): string {
	let name = "";
	try {
		const parsed: unknown = JSON.parse(readFileSync(join(cwd, "package.json"), "utf8"));
		if (typeof parsed === "object" && parsed !== null && "name" in parsed) {
			const value = (parsed as { name?: unknown }).name;
			if (typeof value === "string" && value !== "") name = value;
		}
	} catch {
		// 无 package.json 或不可读
	}
	if (name === "") name = cwd.split(/[\\/]/).filter(Boolean).pop() ?? "project";
	const slug = name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "project";
	return join(extensionDir, "data", slug);
}

/** 分析任务文本（传给 worker 的完整指令，路径全部绝对化） */
function buildAnalyzeTask(projectRoot: string): string {
	const schema = join(extensionDir, "SCHEMA.md");
	const validator = join(extensionDir, "validate-graph.mjs");
	const dataDir = projectDataDir(projectRoot);
	return [
		"任务：分析当前代码库，产出第一版「设计结构图」骨架（graph.json）。",
		"",
		"## 先读契约",
		`1. 读 ${schema}——图的结构、kind 含义（frontend/backend/database/external）、修改纪律全在里面，必须遵守`,
		"",
		"## 分析步骤",
		"2. 探测技术栈（package.json / pyproject.toml / go.mod / Cargo.toml / requirements.txt…），不要假设是前端或 TS 项目",
		"3. 枚举入口与功能块：页面/路由/CLI/服务入口、核心模块、数据存储、外部服务（从依赖清单和 client 实例化处找证据）",
		"4. 按 kind 归类；第一版深度 = 入口清单 + 每节点一句话 summary（database/external 给技术事实即可，如「使用 supabase」）",
		"5. 边：从调用点 / 路由 / 依赖关系提取。label 只写 2–6 字的短语，能说明这条线「传的是什么」即可（形式如动宾短语「提交答案」或名词短语「用户会话」，具体用词由项目决定）；不要完整句子、不罗列多个路径、不带 HTTP 方法等实现细节",
		"6. evidence 必须指向你真实读过的文件，禁止发明路径",
		"",
		"## 产出纪律",
		`7. 写候选：${join(dataDir, "graph.candidate.json")}（目录已存在）`,
		`8. 每改一次就校验：node "${validator}" "${join(dataDir, "graph.candidate.json")}" --repo-root "${projectRoot}"`,
		"9. 只修诊断点，别顺手重构；连续两轮错误数不降就停，如实报告",
		`10. 校验 exit 0 后，把候选原样复制为 ${join(dataDir, "graph.json")}（冻结）；没过校验绝不写 graph.json`,
		"",
		"完成后回报：节点数、边数、各 kind 数量、校验轮次。不要改动项目代码。",
	].join("\n");
}

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
				server = await startStudioServer({
					webDir: join(extensionDir, "web"),
					dataDir: projectDataDir(process.cwd()),
					projectRoot: process.cwd(),
				});
				openInBrowser(server.url);
				ctx.ui.notify(`studio: ${server.url}`, "info");
			} catch (error) {
				ctx.ui.notify(`studio failed to start: ${String(error)}`, "error");
			}
		},
	});

	pi.registerCommand("studio-analyze", {
		description: "Analyze the current repo into a skeleton graph.json (delegated to a foreground sub-agent; ESC cancels)",
		handler: async (_args, ctx) => {
			const dataDir = projectDataDir(process.cwd());
			if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
			const task = buildAnalyzeTask(process.cwd());
			// 官方 send-user-message 示例模式：空闲时 sendUserMessage 触发一个 turn；
			// 忙时排队为 followUp。主 agent 在 turn 内前台调 subagent 工具，ESC 可中断。
			const delegation = [
				"用 subagent 工具派**一个前台单任务**（不要 async/--bg，保持 turn 内前台运行以便 ESC 可中断）：agent=worker，执行以下任务（原样传递）：",
				"",
				"---",
				"",
				task,
			].join("\n");
			if (ctx.isIdle()) pi.sendUserMessage(delegation);
			else pi.sendUserMessage(delegation, { deliverAs: "followUp" });
			ctx.ui.notify("studio analyze delegated (sub-agent, ESC 可中断)", "info");
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
