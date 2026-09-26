/* Studio 页面：加载 graph.json，ELK layered 布局（正交路由，节点不重叠、
 * 边走层间通道绕开节点），xy-flow 只负责渲染。
 * 坐标语义：ELK 子节点坐标相对父节点，xy-flow parentId 也是相对坐标——直通。
 * 边渲染：ELK 的 ORTHOGONAL 路由给的是真实折线点，roundedPath 圆角化后
 * 交给 BaseEdge 的 path（xyflow 文档的 Custom SVG edge paths 方式）。 */

import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import htm from "htm";
import ELK from "elkjs";
import {
	ReactFlow,
	Background,
	BackgroundVariant,
	Controls,
	Handle,
	Position,
	MarkerType,
	BaseEdge,
} from "@xyflow/react";
import { api } from "./api.js";

const html = htm.bind(React.createElement);

const elk = new ELK();

const LAYOUT_OPTIONS = {
	"elk.algorithm": "layered",
	"elk.direction": "RIGHT",
	"elk.edgeRouting": "ORTHOGONAL",
	"elk.hierarchyHandling": "INCLUDE_CHILDREN",
	"elk.spacing.nodeNode": "48",
	"elk.layered.spacing.nodeNodeBetweenLayers": "100",
	"elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
	"elk.padding": "[top=44,left=44,bottom=44,right=44]",
};

const HIDDEN_HANDLE = { opacity: 0, width: 1, height: 1, minWidth: 1, minHeight: 1, border: "none" };

function hasChildren(node) {
	return Array.isArray(node.children) && node.children.length > 0;
}

/* graph.json → ELK 输入（层级结构；节点尺寸给 ELK 做布局用） */
function toElkGraph(graph) {
	function convert(node) {
		const children = node.children ?? [];
		const base = {
			id: node.id,
			layoutOptions: children.length > 0 ? { "elk.padding": "[top=34,left=16,bottom=16,right=16]" } : undefined,
			width: children.length > 0 ? 240 : 230,
			height: children.length > 0 ? 80 : 70,
		};
		if (children.length > 0) base.children = children.map(convert);
		return base;
	}
	return {
		id: "root",
		layoutOptions: LAYOUT_OPTIONS,
		children: (graph.nodes ?? []).map(convert),
		edges: (graph.edges ?? []).map((edge, index) => ({
			id: `e${index}`,
			sources: [edge.from],
			targets: [edge.to],
			labels: edge.label ? [{ text: edge.label, width: Math.min(220, edge.label.length * 12 + 12), height: 18 }] : [],
		})),
	};
}

/* ELK 结果 → xy-flow 节点/边。
 * ELK 子节点坐标相对父节点，xy-flow parentId 同为相对坐标——直通。
 * 标签位置由 ELK 给出（带避让），透传给边。 */
function deriveView(graph, layoutResult) {
	const metaById = new Map((graph.nodes ?? []).map((node) => [node.id, node]));
	const nodes = [];

	// 根容器本身不渲染（只是 ELK 的坐标系）；子节点坐标已相对根原点
	const rootOffset = { x: layoutResult.x ?? 0, y: layoutResult.y ?? 0 };

	function walk(elkNode, parentId) {
		const meta = metaById.get(elkNode.id) ?? {};
		const isGroup = hasChildren(meta);
		nodes.push({
			id: elkNode.id,
			type: isGroup ? "group" : "card",
			parentId: parentId ?? undefined,
			extent: parentId ? "parent" : undefined,
			position: { x: elkNode.x ?? 0, y: elkNode.y ?? 0 },
			data: {
				label: meta.label ?? elkNode.id,
				summary: meta.summary ?? "",
				kind: meta.kind ?? "backend",
			},
			style: { width: elkNode.width ?? 230, height: elkNode.height ?? 70 },
			draggable: false,
		});
		for (const child of elkNode.children ?? []) walk(child, elkNode.id);
	}
	for (const child of layoutResult.children ?? []) {
		const shifted = { ...child, x: (child.x ?? 0) - rootOffset.x, y: (child.y ?? 0) - rootOffset.y };
		walk(shifted, null);
	}

	const edgeById = new Map((graph.edges ?? []).map((edge, index) => [`e${index}`, edge]));
	const edges = (layoutResult.edges ?? []).map((routed) => {
		const original = edgeById.get(routed.id) ?? {};
		const label = routed.labels?.[0];
		return {
			id: routed.id,
			source: routed.sources?.[0],
			target: routed.targets?.[0],
			label: original.label,
			type: "routed",
			data: { points: sectionPoints(routed), labelX: label?.x, labelY: label?.y },
			markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14, color: "#9a8f82" },
		};
	});
	return { nodes: nodes, edges: edges };
}

function sectionPoints(edge) {
	const section = edge.sections?.[0];
	if (!section) return null;
	return [section.startPoint, ...(section.bendPoints ?? []), section.endPoint];
}

/* ── 自定义边：ELK 折线 + 圆角 ── */
function roundedPath(points, radius) {
	if (!points || points.length < 2) return "M 0 0 L 0 0";
	if (points.length === 2) return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
	const commands = [`M ${points[0].x} ${points[0].y}`];
	for (let i = 1; i < points.length - 1; i++) {
		const prev = points[i - 1];
		const cur = points[i];
		const next = points[i + 1];
		const prevLen = Math.hypot(cur.x - prev.x, cur.y - prev.y);
		const nextLen = Math.hypot(next.x - cur.x, next.y - cur.y);
		const r = Math.min(radius, prevLen / 2, nextLen / 2);
		if (r < 1) {
			commands.push(`L ${cur.x} ${cur.y}`);
			continue;
		}
		commands.push(`L ${cur.x - ((cur.x - prev.x) / prevLen) * r} ${cur.y - ((cur.y - prev.y) / prevLen) * r}`);
		commands.push(`Q ${cur.x} ${cur.y} ${cur.x + ((next.x - cur.x) / nextLen) * r} ${cur.y + ((next.y - cur.y) / nextLen) * r}`);
	}
	commands.push(`L ${points.at(-1).x} ${points.at(-1).y}`);
	return commands.join(" ");
}

function RoutedEdge({ id, data, label, labelStyle, labelShowBg, labelBgStyle, labelBgPadding, labelBgBorderRadius, markerEnd, interactionWidth, style }) {
	const points = data?.points;
	const path = roundedPath(points, 10);
	const labelPoint = data?.labelX !== undefined ? { x: data.labelX, y: data.labelY } : null;
	return html`<${BaseEdge}
		id=${id}
		path=${path}
		label=${label}
		labelX=${labelPoint?.x ?? 0}
		labelY=${labelPoint?.y ?? 0}
		labelStyle=${labelStyle}
		labelShowBg=${labelShowBg}
		labelBgStyle=${labelBgStyle}
		labelBgPadding=${labelBgPadding}
		labelBgBorderRadius=${labelBgBorderRadius}
		markerEnd=${markerEnd}
		interactionWidth=${interactionWidth}
		style=${style}
	/>`;
}

const EDGE_DEFAULTS = {
	type: "routed",
	interactionWidth: 16,
	style: { stroke: "#9a8f82", strokeWidth: 1.6 },
	labelStyle: { fill: "#2a2622", fontSize: 11, fontFamily: "inherit" },
	labelShowBg: true,
	labelBgStyle: { fill: "#fffdf9", fillOpacity: 0.92 },
	labelBgPadding: [5, 2],
	labelBgBorderRadius: 4,
};

const NODE_TYPES = { card: CardNode, group: GroupNode };
const EDGE_TYPES = { routed: RoutedEdge };

function CardNode({ data }) {
	return html`
		<${Handle} type="target" position=${Position.Left} style=${HIDDEN_HANDLE} />
		<div class=${"graph-card kind-" + data.kind}>
			<div class="graph-card-label" title=${data.label}>${data.label}</div>
			${data.summary ? html`<div class="graph-card-summary" title=${data.summary}>${data.summary}</div>` : null}
		</div>
		<${Handle} type="source" position=${Position.Right} style=${HIDDEN_HANDLE} />
	`;
}

function GroupNode({ data }) {
	return html`
		<${Handle} type="target" position=${Position.Left} style=${HIDDEN_HANDLE} />
		<div class=${"graph-group kind-" + data.kind}>
			<div class="graph-group-title">${data.label}</div>
		</div>
		<${Handle} type="source" position=${Position.Right} style=${HIDDEN_HANDLE} />
	`;
}

/* ── 页面 ── */
function App() {
	const [graph, setGraph] = useState(null);
	const [state, setState] = useState("loading");
	const [layoutResult, setLayoutResult] = useState(null);

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

	useEffect(() => {
		if (state !== "ready" || graph === null) return;
		elk.layout(toElkGraph(graph)).then((result) => setLayoutResult(result));
	}, [state, graph]);

	const view = useMemo(
		() => (layoutResult === null ? { nodes: [], edges: [] } : deriveView(graph, layoutResult)),
		[state, graph, layoutResult],
	);

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
			edgeTypes=${EDGE_TYPES}
			defaultEdgeOptions=${EDGE_DEFAULTS}
			nodesDraggable=${false}
			nodesConnectable=${false}
			elementsSelectable=${false}
			fitView
			fitViewOptions=${{ padding: 0.08, maxZoom: 1.1 }}
			proOptions=${{ hideAttribution: true }}
		>
			<${Controls} showInteractive=${false} />
			<${Background} variant=${BackgroundVariant.Dots} gap=${12} size=${1} />
		<//>
	`;
}


createRoot(document.getElementById("root")).render(html`<${App} />`);
