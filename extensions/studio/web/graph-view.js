/* ELK 布局适配层：graph.json ↔ ELK 输入/输出转换。
 * 坐标语义：ELK 子节点坐标相对父节点，xy-flow parentId 也是相对坐标——直通。
 * 边的 section 坐标属于「源/目标最近公共祖先（LCA）容器」的坐标系，
 * deriveView 内部按 LCA 查帧原点表做偏移。 */

import { MarkerType } from "@xyflow/react";

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

/**
 * graph.json → ELK 输入（层级结构；节点尺寸给 ELK 做布局用）。
 */
export function toElkGraph(graph) {
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

/**
 * ELK 布局结果 → xy-flow 节点/边。标签位置由 ELK 给出（带避让），透传给边。
 */
export function deriveView(graph, layoutResult) {
	const metaById = new Map();
	for (const node of graph.nodes ?? []) registerMeta(metaById, node);
	const nodes = [];

	// 根容器本身不渲染（只是 ELK 的坐标系）；子节点坐标已相对根原点
	const rootOffset = { x: layoutResult.x ?? 0, y: layoutResult.y ?? 0 };

	// 帧原点表：每个节点的坐标系在 flow 空间的原点
	const frameOf = new Map();
	const parentOf = new Map();
	(function indexFrames(elkNode, ox, oy, parentId) {
		parentOf.set(elkNode.id, parentId);
		frameOf.set(elkNode.id, { x: ox, y: oy });
		for (const child of elkNode.children ?? []) indexFrames(child, ox + (child.x ?? 0), oy + (child.y ?? 0), elkNode.id);
	})(layoutResult, -rootOffset.x, -rootOffset.y, null);

	function lcaFrame(a, b) {
		const fallback = { x: -rootOffset.x, y: -rootOffset.y };
		if (!a || !b) return fallback;
		const chainB = new Set();
		for (let x = b; x; x = parentOf.get(x)) chainB.add(x);
		for (let x = a; x; x = parentOf.get(x)) if (chainB.has(x)) return frameOf.get(x) ?? fallback;
		return fallback;
	}

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
				id: elkNode.id,
				label: meta.label ?? elkNode.id,
				summary: meta.summary ?? "",
				kind: meta.kind ?? "backend",
				expandable: meta.expandable === true,
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
	const collected = [];
	collectRoutedEdges(layoutResult, collected);
	const edges = collected.map((routed) => {
		const original = edgeById.get(routed.id) ?? {};
		const label = routed.labels?.[0];
		const points = sectionPoints(routed);
		const frame = lcaFrame(routed.sources?.[0], routed.targets?.[0]);
		return {
			id: routed.id,
			source: routed.sources?.[0],
			target: routed.targets?.[0],
			label: original.label,
			type: "routed",
			data: {
				points: points === null ? null : points.map((point) => ({ x: point.x + frame.x, y: point.y + frame.y })),
				labelX: label === undefined ? undefined : label.x + frame.x,
				labelY: label === undefined ? undefined : label.y + frame.y,
			},
			markerStart: original.bidirectional === true ? { type: MarkerType.ArrowClosed, width: 14, height: 14, color: "#9a8f82", orient: "auto-start-reverse" } : undefined,
			markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14, color: "#9a8f82" },
		};
	});
	return { nodes: nodes, edges: edges };
}

function hasChildren(node) {
	return Array.isArray(node.children) && node.children.length > 0;
}

/**
 * 递归注册元数据（含 children 里的嵌套节点）。
 */
function registerMeta(map, node) {
	map.set(node.id, node);
	for (const child of node.children ?? []) registerMeta(map, child);
}

/**
 * 递归收集 ELK 各层的边（实测 elkjs 全部挂在根部，此处仅防御嵌套）。
 */
function collectRoutedEdges(elkNode, into) {
	for (const routed of elkNode.edges ?? []) into.push(routed);
	for (const child of elkNode.children ?? []) collectRoutedEdges(child, into);
}

function sectionPoints(edge) {
	const section = edge.sections?.[0];
	if (!section) return null;
	return [section.startPoint, ...(section.bendPoints ?? []), section.endPoint];
}
