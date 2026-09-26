/**
 * graph.json 校验 CLI 的可运行检查：`node --test extensions/studio/validate-graph.test.mjs`
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

/** 迷你仓库：几个真实文件 + 一个候选图 */
function makeRepo() {
	const root = mkdtempSync(join(tmpdir(), "studio-graph-"));
	mkdirSync(join(root, "app/grammar"), { recursive: true });
	writeFileSync(join(root, "app/grammar/page.tsx"), "export default function Page() {}\n");
	mkdirSync(join(root, "modules/tts"), { recursive: true });
	writeFileSync(join(root, "modules/tts/index.ts"), "export const tts = 1;\n");
	return root;
}

function validGraph() {
	return {
		project: "mini",
		generatedAt: "2026-09-26T00:00:00.000Z",
		nodes: [
			{ id: "grammar", kind: "frontend", label: "语法练习", summary: "复习调度", evidence: ["app/grammar/page.tsx"], children: [] },
			{ id: "tts", kind: "backend", label: "语音合成", summary: "句子转音频", evidence: ["modules/tts/index.ts"], children: [] },
			{ id: "db", kind: "database", label: "数据库", summary: "使用 supabase", evidence: [], children: [] },
		],
		edges: [{ from: "grammar", to: "tts", label: "fetch /api/tts" }],
	};
}

function runCli(graph, repoRoot, extraArgs = []) {
	const candidate = join(repoRoot, "graph.candidate.json");
	if (graph !== null) writeFileSync(candidate, JSON.stringify(graph));
	const result = spawnSync(process.execPath, [join(HERE, "validate-graph.mjs"), candidate, "--repo-root", repoRoot, ...extraArgs], {
		encoding: "utf8",
	});
	return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

test("合法图 → exit 0 + OK 概要", () => {
	const repo = makeRepo();
	try {
		const result = runCli(validGraph(), repo);
		assert.equal(result.status, 0, result.stdout + result.stderr);
		assert.ok(result.stdout.includes("OK 3 个节点｜1 条边"));
	} finally {
		rmSync(repo, { recursive: true, force: true });
	}
});

test("坏 kind / 未知字段 / 缺 label → exit 1 带诊断", () => {
	const repo = makeRepo();
	try {
		const graph = validGraph();
		graph.nodes[0].kind = "ui";
		graph.nodes[0].oops = 1;
		delete graph.nodes[1].label;
		const result = runCli(graph, repo);
		assert.equal(result.status, 1);
		const diagnostics = JSON.parse(result.stdout);
		const messages = diagnostics.map((item) => `${item.path}: ${item.message}`).join("\n");
		assert.ok(messages.includes("kind"), messages);
		assert.ok(messages.includes("未知字段"), messages);
		assert.ok(messages.includes("label"), messages);
	} finally {
		rmSync(repo, { recursive: true, force: true });
	}
});

test("evidence 不存在 / 绝对路径 → 诊断点名", () => {
	const repo = makeRepo();
	try {
		const graph = validGraph();
		graph.nodes[0].evidence = ["nope.ts"];
		graph.nodes[1].evidence = ["/abs/path.ts"];
		const result = runCli(graph, repo);
		assert.equal(result.status, 1);
		const messages = JSON.parse(result.stdout).map((item) => item.message).join("\n");
		assert.ok(messages.includes("文件不存在：nope.ts"), messages);
		assert.ok(messages.includes("仓库相对 POSIX"), messages);
	} finally {
		rmSync(repo, { recursive: true, force: true });
	}
});

test("evidence 支持 :行号；边端点必须存在（含 children 里的 id）", () => {
	const repo = makeRepo();
	try {
		const withLine = validGraph();
		withLine.nodes[0].evidence = ["app/grammar/page.tsx:12"];
		assert.equal(runCli(withLine, repo).status, 0, "带行号的 evidence 合法");

		const badEdge = validGraph();
		badEdge.edges[0].to = "ghost";
		const result = runCli(badEdge, repo);
		assert.equal(result.status, 1);
		assert.ok(JSON.parse(result.stdout).some((item) => item.path === "$.edges[0].to"));

		const nested = validGraph();
		nested.nodes[1].children = [{ id: "tts-engine", kind: "backend", label: "引擎", children: [] }];
		nested.edges[0].to = "tts-engine";
		assert.equal(runCli(nested, repo).status, 0, "边可以连到 children 里的节点");
	} finally {
		rmSync(repo, { recursive: true, force: true });
	}
});

test("expandable：boolean 合法 / 非 boolean 报诊断", () => {
	const repo = makeRepo();
	try {
		const ok = validGraph();
		ok.nodes[0].expandable = true;
		ok.nodes[1].children = [{ id: "tts-engine", kind: "backend", label: "引擎", expandable: true, children: [] }];
		assert.equal(runCli(ok, repo).status, 0, "boolean expandable（含嵌套）合法");

		const bad = validGraph();
		bad.nodes[0].expandable = "yes";
		const result = runCli(bad, repo);
		assert.equal(result.status, 1);
		assert.ok(JSON.parse(result.stdout).some((item) => item.path === "$.nodes[0].expandable"));
	} finally {
		rmSync(repo, { recursive: true, force: true });
	}
});

test("children 里的重复 id → 诊断；用法错误 → exit 2", () => {
	const repo = makeRepo();
	try {
		const dup = validGraph();
		dup.nodes[1].children = [{ id: "grammar", kind: "backend", label: "重复", children: [] }];
		const result = runCli(dup, repo);
		assert.equal(result.status, 1);
		assert.ok(JSON.parse(result.stdout).some((item) => item.message.includes("重复")));

		const noArgs = spawnSync(process.execPath, [join(HERE, "validate-graph.mjs")], { encoding: "utf8" });
		assert.equal(noArgs.status, 2);
	} finally {
		rmSync(repo, { recursive: true, force: true });
	}
});
