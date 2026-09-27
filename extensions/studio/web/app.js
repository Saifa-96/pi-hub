/* Studio 页面入口：加载 graph.json → ELK 布局 → xy-flow 渲染。
 * 非受控模式（defaultNodes + key 重挂载），选中原生生效；
 * 跨帧状态经 context 下发（见 flow-contexts.js）。 */

import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
	ReactFlow,
	Panel,
	useOnSelectionChange,
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
import { NodeActionsContext, HighlightContext, SelectionWatcher } from "./flow-contexts.js";
import { InspectorPanel } from "./inspector.js";

const elk = new ELK();

const NODE_TYPES = { card: CardNode, cluster: GroupNode };
const EDGE_TYPES = { routed: RoutedEdge };

function App() {
	const [graph, setGraph] = useState(null);
	const [state, setState] = useState("loading");
	const [layoutResult, setLayoutResult] = useState(null);
	const [epoch, setEpoch] = useState(0);
	const [pendingDeepen, setPendingDeepen] = useState(() => new Set());
	const [focus, setFocus] = useState({ id: null, epoch: -1 });
	const [hiddenIds, setHiddenIds] = useState(() => new Set());
	const [hiddenListOpen, setHiddenListOpen] = useState(false);
	const [saveFailed, setSaveFailed] = useState(false);
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

	// 轮询：graph.json 变化（深入完成或重生成）→ 换图重排；启动时同步隐藏状态
	useEffect(() => {
		if (state !== "ready") return;
		api("/api/state")
			.then((s) => { if (Array.isArray(s.hidden)) setHiddenIds(new Set(s.hidden)); })
			.catch(() => {});
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

	const onSelect = useCallback((id) => setFocus({ id, epoch: epochRef.current }), []);

	// 隐藏状态：存 ui-state.json（服务端持久化，跨会话有效）；渲染期赋值供回调取最新集合
	const hiddenRef = useRef(hiddenIds);
	hiddenRef.current = hiddenIds;

	const applyHidden = useCallback((next) => {
		hiddenRef.current = next;
		setHiddenIds(next);
		setFocus({ id: null, epoch: epochRef.current });
		setHiddenListOpen(false);
		api("/api/state", {
			method: "PUT",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ hidden: [...next] }),
		})
			.then(() => setSaveFailed(false))
			.catch((error) => {
				// 保存失败必须可见（通常是会话未重启、server 缺少 /api/state）
				setSaveFailed(true);
				console.error("隐藏状态保存失败，重启 pi 会话后重试", error);
			});
	}, []);

	const requestHide = useCallback((nodeId) => {
		const next = new Set(hiddenRef.current);
		next.add(nodeId);
		applyHidden(next);
	}, [applyHidden]);

	const restoreHidden = useCallback((nodeId) => {
		const next = new Set(hiddenRef.current);
		next.delete(nodeId);
		applyHidden(next);
	}, [applyHidden]);

	const restoreAllHidden = useCallback(() => applyHidden(new Set()), [applyHidden]);

	// 过滤隐藏节点（含其子树）及其相连边；集合变化 → 重布局 → key 重挂载
	const filteredGraph = useMemo(() => {
		if (graph === null || hiddenIds.size === 0) return graph;
		const parentOf = new Map();
		for (const top of graph.nodes ?? []) {
			(function reg(n, p) { parentOf.set(n.id, p); for (const c of n.children ?? []) reg(c, n.id); })(top, null);
		}
		const isHidden = (id) => {
			let x = id;
			while (x) {
				if (hiddenIds.has(x)) return true;
				x = parentOf.get(x);
			}
			return false;
		};
		function prune(node) {
			const children = (node.children ?? []).filter((c) => !isHidden(c.id)).map(prune);
			const copy = { ...node };
			if (node.children !== undefined) copy.children = children;
			return copy;
		}
		return {
			...graph,
			nodes: (graph.nodes ?? []).filter((n) => !isHidden(n.id)).map(prune),
			edges: (graph.edges ?? []).filter((e) => !isHidden(e.from) && !isHidden(e.to)),
		};
	}, [graph, hiddenIds]);

	// 右上角计数：当前图中被隐藏的节点总数（含子树）
	const hiddenCount = useMemo(() => {
		if (graph === null) return 0;
		let total = 0;
		const parentOf = new Map();
		for (const top of graph.nodes ?? []) {
			(function reg(n, p) { parentOf.set(n.id, p); for (const c of n.children ?? []) reg(c, n.id); })(top, null);
		}
		const isHidden = (id) => {
			let x = id;
			while (x) {
				if (hiddenIds.has(x)) return true;
				x = parentOf.get(x);
			}
			return false;
		};
		for (const top of graph.nodes ?? []) {
			(function count(n) { if (isHidden(n.id)) total++; for (const c of n.children ?? []) count(c); })(top);
		}
		return total;
	}, [graph, hiddenIds]);

	const hiddenEntries = useMemo(() => {
		const entries = [];
		for (const id of hiddenIds) {
			const meta = graph === null ? null : findNodeById(graph, id);
			if (meta !== null) entries.push({ id: id, label: meta.label ?? id });
		}
		return entries;
	}, [hiddenIds, graph]);

	useEffect(() => {
		if (state !== "ready" || filteredGraph === null) return;
		elk.layout(toElkGraph(filteredGraph)).then((result) => {
			setLayoutResult(result);
			setEpoch((value) => value + 1);
		});
	}, [state, filteredGraph]);

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
		() => (layoutResult === null ? { nodes: [], edges: [] } : deriveView(filteredGraph, layoutResult)),
		[state, filteredGraph, layoutResult],
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

	const focusMeta = useMemo(
		() => (focusId === null || filteredGraph === null ? null : findNodeById(filteredGraph, focusId)),
		[focusId, filteredGraph],
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
		<${NodeActionsContext.Provider} value=${{ pendingDeepen, requestDeepen, requestHide }}>
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
			${hiddenCount > 0 ? html`<${Panel} position="top-right">
				<div class=${"hidden-chip" + (saveFailed ? " save-failed" : "")} title=${saveFailed ? "隐藏状态保存失败：请重启 pi 会话后重试" : undefined} onClick=${() => setHiddenListOpen((open) => !open)}>
					已隐藏节点（${hiddenCount}）${saveFailed ? " · 未保存" : ""}
				</div>
				${hiddenListOpen ? html`<div class="hidden-popup">
					${hiddenEntries.map((entry) => html`<div class="hidden-popup-row" key=${entry.id}>
						<span class="hidden-popup-label" title=${entry.label}>${entry.label}</span>
						<span class="hidden-popup-restore" onClick=${() => restoreHidden(entry.id)}>恢复</span>
					</div>`)}
					<div class="hidden-popup-row hidden-popup-all">
						<span class="hidden-popup-restore" onClick=${restoreAllHidden}>全部恢复</span>
					</div>
				</div>` : null}
			<//>` : null}
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
