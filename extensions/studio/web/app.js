/* Studio 页面入口：加载 graph.json → ELK 布局 → xy-flow 渲染。
 * 非受控模式（defaultNodes + key 重挂载），选中原生生效；
 * 跨帧状态经 context 下发（见 flow-contexts.js）。 */

import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
	ReactFlow,
	Background,
	BackgroundVariant,
	Controls,
} from "@xyflow/react";
import ELK from "elkjs";
import { html } from "./html.js";
import { api } from "./api.js";
import { deriveView, findNodeById, toElkGraph } from "./graph-view.js";
import { CardNode, GroupNode } from "./flow-nodes.js";
import { EDGE_DEFAULTS, RoutedEdge } from "./flow-edges.js";
import { DeepenContext, HighlightContext, SelectionWatcher } from "./flow-contexts.js";
import { InspectorPanel } from "./inspector.js";

const elk = new ELK();

const NODE_TYPES = { card: CardNode, group: GroupNode };
const EDGE_TYPES = { routed: RoutedEdge };

function App() {
	const [graph, setGraph] = useState(null);
	const [state, setState] = useState("loading");
	const [layoutResult, setLayoutResult] = useState(null);
	const [epoch, setEpoch] = useState(0);
	const [pendingDeepen, setPendingDeepen] = useState(() => new Set());
	const [focus, setFocus] = useState({ id: null, epoch: -1 });
	// 渲染期赋值（非 effect 镜像），供 onSelect 捕获当前轮次
	const epochRef = useRef(epoch);
	epochRef.current = epoch;
	const graphRef = useRef(graph);
	graphRef.current = graph;

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

	// 轮询：graph.json 变化（深入完成或重生成）→ 换图重排
	useEffect(() => {
		if (state !== "ready") return;
		let last = JSON.stringify(graphRef.current);
		const timer = setInterval(() => {
			api("/api/graph")
				.then((payload) => {
					if (payload.graph === null) return;
					const next = JSON.stringify(payload.graph);
					if (next !== last) {
						last = next;
						setGraph(payload.graph);
						setPendingDeepen(new Set());
					}
				})
				.catch(() => {});
		}, 2000);
		return () => clearInterval(timer);
	}, [state]);

	useEffect(() => {
		if (state !== "ready" || graph === null) return;
		elk.layout(toElkGraph(graph)).then((result) => {
			setLayoutResult(result);
			setEpoch((value) => value + 1);
		});
	}, [state, graph]);

	const requestDeepen = useCallback(async (nodeId) => {
		setPendingDeepen((prev) => {
			const next = new Set(prev);
			next.add(nodeId);
			return next;
		});
		try {
			await api("/api/deepen", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ nodeId }),
			});
		} catch {
			setPendingDeepen((prev) => {
				const next = new Set(prev);
				next.delete(nodeId);
				return next;
			});
		}
	}, []);

	// 非受控：defaultNodes + key 重挂载（换图时新实例重新 fitView），选中原生生效
	const view = useMemo(
		() => (layoutResult === null ? { nodes: [], edges: [] } : deriveView(graph, layoutResult)),
		[state, graph, layoutResult],
	);

	// 单选焦点 → 连通节点/边集合（含焦点自身）；多选/无选中 = 无突出
	const focusId = focus.epoch === epoch ? focus.id : null;
	const highlight = useMemo(() => {
		if (focusId === null) return { active: false, nodeIds: null, edgeIds: null };
		const nodeIds = new Set([focusId]);
		const edgeIds = new Set();
		for (const edge of view.edges) {
			if (edge.source === focusId || edge.target === focusId) {
				edgeIds.add(edge.id);
				nodeIds.add(edge.source);
				nodeIds.add(edge.target);
			}
		}
		return { active: true, nodeIds, edgeIds };
	}, [focusId, view]);

	const onSelect = useCallback((id) => setFocus({ id, epoch: epochRef.current }), []);

	const focusMeta = useMemo(
		() => (focusId === null || graph === null ? null : findNodeById(graph, focusId)),
		[focusId, graph],
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

	const focusNode = focusId === null ? null : view.nodes.find((n) => n.id === focusId);

	return html`
		<${HighlightContext.Provider} value=${highlight}>
		<${DeepenContext.Provider} value=${{ pendingDeepen, requestDeepen }}>
		<div class="app-layout">
			<div class="app-canvas">
		<${ReactFlow}
			key=${"layout-" + epoch}
			defaultNodes=${view.nodes}
			defaultEdges=${view.edges}
			nodeTypes=${NODE_TYPES}
			edgeTypes=${EDGE_TYPES}
			defaultEdgeOptions=${EDGE_DEFAULTS}
			nodesDraggable=${false}
			nodesConnectable=${false}
			elementsSelectable=${true}
			fitView
			fitViewOptions=${{ padding: 0.08, maxZoom: 1.1 }}
			proOptions=${{ hideAttribution: true }}
		>
			<${SelectionWatcher} onSelect=${onSelect} />
			<${Controls} showInteractive=${false} />
			<${Background} variant=${BackgroundVariant.Dots} gap=${12} size=${1} />
		<//>
			</div>
			${focusNode === null ? null : html`<${InspectorPanel} node=${focusNode} meta=${focusMeta} />`}
		</div>
		<//>
		<//>
	`;
}

createRoot(document.getElementById("root")).render(html`<${App} />`);
