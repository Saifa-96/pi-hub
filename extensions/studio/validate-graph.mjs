#!/usr/bin/env node
/**
 * graph.json 校验 CLI —— agent 修改图的 fail-closed 闸门。
 * 用法：node validate-graph.mjs <候选.json> [--repo-root <仓库根>]
 * 退出码：0 = 通过；1 = 有诊断（JSON 数组）；2 = 用法/读取错误。
 */

import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";

const KINDS = ["frontend", "backend", "database", "external"];
const NODE_KEYS = ["id", "kind", "label", "summary", "evidence", "children"];
const TOP_KEYS = ["project", "generatedAt", "nodes", "edges"];
const EDGE_KEYS = ["from", "to", "label"];

function usage() {
	console.error("用法: node validate-graph.mjs <候选graph.json> [--repo-root <仓库根目录>]");
	process.exit(2);
}

const args = process.argv.slice(2);
let file = null;
let repoRoot = process.cwd();
for (let i = 0; i < args.length; i++) {
	if (args[i] === "--repo-root") repoRoot = args[++i] ?? usage();
	else if (file === null) file = args[i];
	else usage();
}
if (file === null) usage();

let graph;
try {
	graph = JSON.parse(readFileSync(resolve(file), "utf8"));
} catch (error) {
	console.error(`读取/解析失败（${file}）: ${error.message}`);
	process.exit(2);
}

const diagnostics = [];

function fail(path, message) {
	diagnostics.push({ path, message });
}

function isPlainObject(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function checkKeys(object, allowed, path) {
	for (const key of Object.keys(object)) {
		if (!allowed.includes(key)) fail(`${path}.${key}`, `未知字段（允许：${allowed.join(", ")}）`);
	}
}

/** 去掉可选的 :行号 后缀 */
function stripLine(value) {
	return String(value).replace(/:\d+$/, "");
}

const allIds = new Map(); // id -> path（重复检测 + 边端点收集）

function validateNode(node, path) {
	if (!isPlainObject(node)) {
		fail(path, `必须是对象`);
		return;
	}
	checkKeys(node, NODE_KEYS, path);
	if (typeof node.id !== "string" || node.id === "") {
		fail(`${path}.id`, `必须是非空字符串`);
	} else if (allIds.has(node.id)) {
		fail(`${path}.id`, `id「${node.id}」重复（首次出现于 ${allIds.get(node.id)}）`);
	} else {
		allIds.set(node.id, path);
	}
	if (!KINDS.includes(node.kind)) {
		fail(`${path}.kind`, `必须是 ${KINDS.join(" | ")}，实际：${JSON.stringify(node.kind)}`);
	}
	if (typeof node.label !== "string" || node.label === "") {
		fail(`${path}.label`, `必须是非空字符串`);
	}
	if (node.summary !== undefined && typeof node.summary !== "string") {
		fail(`${path}.summary`, `必须是字符串`);
	}
	if (node.evidence !== undefined) {
		if (!Array.isArray(node.evidence)) {
			fail(`${path}.evidence`, `必须是字符串数组`);
		} else {
			for (const [index, item] of node.evidence.entries()) {
				if (typeof item !== "string" || item === "") {
					fail(`${path}.evidence[${index}]`, `必须是非空字符串`);
					continue;
				}
				const clean = stripLine(item);
				if (isAbsolute(clean) || clean.includes("\\") || clean.split("/").includes("..")) {
					fail(`${path}.evidence[${index}]`, `「${item}」必须是仓库相对 POSIX 路径`);
					continue;
				}
				if (!existsSync(join(repoRoot, clean))) {
					fail(`${path}.evidence[${index}]`, `文件不存在：${clean}`);
				}
			}
		}
	}
	if (node.children !== undefined) {
		if (!Array.isArray(node.children)) {
			fail(`${path}.children`, `必须是数组`);
		} else {
			node.children.forEach((child, index) => validateNode(child, `${path}.children[${index}]`));
		}
	}
}

if (!isPlainObject(graph)) {
	fail("$", "顶层必须是对象");
} else {
	checkKeys(graph, TOP_KEYS, "$");
	if (!Array.isArray(graph.nodes) || graph.nodes.length === 0) {
		fail("$.nodes", "必须是非空节点数组");
	} else {
		graph.nodes.forEach((node, index) => validateNode(node, `$.nodes[${index}]`));
	}
	if (!Array.isArray(graph.edges)) {
		fail("$.edges", "必须是数组（可为空）");
	} else {
		for (const [index, edge] of graph.edges.entries()) {
			const path = `$.edges[${index}]`;
			if (!isPlainObject(edge)) {
				fail(path, "必须是对象");
				continue;
			}
			checkKeys(edge, EDGE_KEYS, path);
			if (typeof edge.from !== "string" || !allIds.has(edge.from)) {
				fail(`${path}.from`, `端点「${edge.from}」不是已知节点 id`);
			}
			if (typeof edge.to !== "string" || !allIds.has(edge.to)) {
				fail(`${path}.to`, `端点「${edge.to}」不是已知节点 id`);
			}
			if (edge.label !== undefined && typeof edge.label !== "string") {
				fail(`${path}.label`, "必须是字符串");
			}
		}
	}
}

if (diagnostics.length > 0) {
	console.log(JSON.stringify(diagnostics, null, "\t"));
	process.exit(1);
}

const nodeCount = [...allIds.keys()].length;
console.log(`OK ${nodeCount} 个节点｜${Array.isArray(graph.edges) ? graph.edges.length : 0} 条边`);
process.exit(0);
