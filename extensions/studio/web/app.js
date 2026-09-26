/* Studio 页面：加载 graph.json 并渲染。
 * 布局：按 kind 分列（frontend → backend → database → external），列内自上而下；
 * 有 children 的节点渲染为 group 容器（子节点纵向排布，位置相对容器）。
 * 节点不可拖动（nodesDraggable=false），坐标全部由布局函数算出。 */

import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import htm from "htm";
import {
	ReactFlow,
	Background,
	BackgroundVariant,
	Controls,
	Handle,
	MarkerType,
	Position,
} from "@xyflow/react";
import { api } from "./api.js";

const html = htm.bind(React.createElement);

const KIND_ORDER = ["frontend", "backend", "database", "external"];
const KIND_LABEL = { frontend: "前端", backend: "后端", database: "数据", external: "外部" };
const NODE_WIDTH = 230;
const NODE_HEIGHT = 74;
const MEMBER_WIDTH = 200;
const MEMBER_HEIGHT = 64;
const COLUMN_GAP = 120;
const ROW_GAP = 36;
const GROUP_PADDING = 18;
const GROUP_HEADER = 32;
const ORIGIN = { x: 60, y: 80 };

/* ── 布局：纯函数，返回 { nodes, edges }（xy-flow 数据） ── */
function layout(graph) {
	const flowNodes = [];
	const flowEdges = [];
	const ids = new Set();

	/* 先量树再放：父节点必须先于子节点进入数组（React Flow 的 parentId 约束） */
	function subtreeSize(node, isRoot) {
		const children = Array.isArray(node.children) ? node.children : [];
		const base = isRoot ? { width: NODE_WIDTH, height: NODE_HEIGHT } : { width: MEMBER_WIDTH, height: MEMBER_HEIGHT };
		if (children.length === 0) return base;
		let innerWidth = 0;
		let innerHeight = 0;
		for (const child of children) {
			const size = subtreeSize(child, false);
			innerWidth = Math.max(innerWidth, size.width);
			innerHeight += size.height + 16;
		}
		return { width: innerWidth + GROUP_PADDING * 2, height: GROUP_HEADER + innerHeight - 16 + GROUP_PADDING };
	}

	function placeNode(node, x, y, parentId) {
		ids.add(node.id);
		const children = Array.isArray(node.children) ? node.children : [];
		const isRoot = parentId === undefined;
		const size = subtreeSize(node, isRoot);
		if (children.length === 0) {
			flowNodes.push({
				id: node.id,
				type: "card",
				parentId: parentId,
				extent: parentId === undefined ? undefined : "parent",
				position: { x: x, y: y },
				data: { kind: node.kind, label: node.label, summary: node.summary ?? "" },
				style: { width: size.width, height: size.height },
				draggable: false,
			});
			return size;
		}
		// group 容器先入数组，子节点紧随其后
		flowNodes.push({
			id: node.id,
			type: "group",
			parentId: parentId,
			extent: parentId === undefined ? undefined : "parent",
			position: { x: x, y: y },
			data: { label: node.label, kind: node.kind },
			style: { width: size.width, height: size.height },
			draggable: false,
		});
		let cursor = y + GROUP_HEADER;
		for (const child of children) {
			// 子节点坐标必须相对父容器（React Flow parentId 语义）
			placeNode(child, GROUP_PADDING, cursor - y, node.id);
			cursor += subtreeSize(child, false).height + 16;
		}
		return size;
	}

	const columns = new Map(KIND_ORDER.map((kind) => [kind, []]));
	for (const node of graph.nodes ?? []) {
		(columns.get(node.kind) ?? columns.get("backend")).push(node);
	}
	let columnX = ORIGIN.x;
	for (const kind of KIND_ORDER) {
		const items = columns.get(kind);
		if (items === undefined || items.length === 0) continue;
		let cursorY = ORIGIN.y;
		let columnWidth = 0;
		for (const node of items) {
			const size = placeNode(node, columnX, cursorY, undefined);
			cursorY += size.height + ROW_GAP;
			columnWidth = Math.max(columnWidth, size.width);
		}
		// 列头
		flowNodes.push({
			id: `column:${kind}`,
			type: "columnHeader",
			position: { x: columnX, y: ORIGIN.y - GROUP_HEADER },
			data: { label: `${KIND_LABEL[kind]}（${items.length}）` },
			draggable: false,
			selectable: false,
			connectable: false,
		});
		columnX += columnWidth + COLUMN_GAP;
	}

	for (const [index, edge] of (graph.edges ?? []).entries()) {
		if (!ids.has(edge.from) || !ids.has(edge.to)) continue;
		flowEdges.push({
			id: `e${index}`,
			source: edge.from,
			target: edge.to,
			label: edge.label,
			type: "default",
			markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14 },
		});
	}
	return { nodes: flowNodes, edges: flowEdges };
}

/* ── 自定义节点 ── */
const HIDDEN_HANDLE = { opacity: 0, width: 1, height: 1, minWidth: 1, minHeight: 1, border: "none" };

function Card({ data }) {
	return html`
		<${Handle} type="target" position=${Position.Left} style=${HIDDEN_HANDLE} />
		<div class=${"graph-card kind-" + data.kind}>
			<div class="graph-card-label" title=${data.label}>${data.label}</div>
			${data.summary ? html`<div class="graph-card-summary" title=${data.summary}>${data.summary}</div>` : null}
		</div>
		<${Handle} type="source" position=${Position.Right} style=${HIDDEN_HANDLE} />
	`;
}

function Group({ data }) {
	return html`<div class=${"graph-group kind-" + data.kind}><div class="graph-group-title">${data.label}</div></div>`;
}

function ColumnHeader({ data }) {
	return html`<div class="graph-column-header">${data.label}</div>`;
}

const NODE_TYPES = { card: Card, group: Group, columnHeader: ColumnHeader };

/* ── 页面 ── */
function App() {
	const [graph, setGraph] = useState(null);
	const [state, setState] = useState("loading"); // loading | ready | empty | error

	useEffect(() => {
		api("/api/graph")
			.then((payload) => {
				if (payload.graph === null || payload.graph === undefined) {
					setState("empty");
					return;
				}
				setGraph(payload.graph);
				setState("ready");
			})
			.catch(() => setState("error"));
	}, []);

	const view = useMemo(() => (graph === null ? { nodes: [], edges: [] } : layout(graph)), [graph]);

	if (state !== "ready") {
		const hint =
			state === "empty"
				? "还没有 graph.json。在 pi 会话中运行 /studio-analyze 生成第一版设计结构图。"
				: state === "error"
					? "图加载失败：服务器可能已停止（/studio 重新启动）。"
					: "加载中…";
		return html`<div class="graph-placeholder">${hint}</div>`;
	}

	return html`
		<${ReactFlow}
			nodes=${view.nodes}
			edges=${view.edges}
			nodeTypes=${NODE_TYPES}
			nodesDraggable=${false}
			nodesConnectable=${false}
			elementsSelectable=${false}
			fitView
			proOptions=${{ hideAttribution: true }}
		>
			<${Controls} showInteractive=${false} />
			<${Background} variant=${BackgroundVariant.Dots} gap=${12} size=${1} />
		<//>
	`;
}

createRoot(document.getElementById("root")).render(html`<${App} />`);
