/* Studio 页面入口：加载 graph.json → ELK 布局 → xy-flow 渲染。
 * 非受控模式（defaultNodes + key 重挂载），选中原生生效；
 * 跨帧状态经 context 下发（见 flow-contexts.js）。
 * 更新通道：server 对 graph.json 做 fs.watch，变更经 SSE 推送，
 * 页面收到「changed」后重拉图——事件驱动，无轮询。 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
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
	// 渲染期赋值（非 effect 镜像），供异步回调捕获当前轮次/集合
	const epochRef = useRef(epoch);
	epochRef.current = epoch;
	const graphRef = useRef(graph);
	graphRef.current = graph;
	const hiddenRef = useRef(hiddenIds);
	hiddenRef.current = hiddenIds;
	const pendingRef = useRef(pendingDeepen);
	pendingRef.current = pendingDeepen;

	const persistHidden = useCallback((next) => {
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

	// 修剪式对账：state 中已不存在于图里的 id 直接删除（agent 重新分析会舍弃节点）
	const reconcileHidden = useCallback((graphData) => {
		const next = pruneHiddenState(graphData, hiddenRef.current);
		if (next === null) return;
		hiddenRef.current = next;
		setHiddenIds(next);
		persistHidden(next);
	}, []);

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

	const applyHidden = useCallback((next) => {
		hiddenRef.current = next;
		setHiddenIds(next);
		setFocus({ id: null, epoch: epochRef.current });
		setHiddenListOpen(false);
		persistHidden(next);
	}, [persistHidden]);

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

	const onSelect = useCallback((id) => setFocus({ id, epoch: epochRef.current }), []);

	// 挂载：先图后状态（顺序保证 state 的孤儿修剪基于最新图）
	useEffect(() => {
		let cancelled = false;
		(async () => {
			try {
				const graphPayload = await api("/api/graph");
				if (cancelled) return;
				if (graphPayload.graph === null || graphPayload.graph === undefined) {
					// 解析失败与缺图是两回事：前者指向文件问题，别误导用户去重新分析
					setState(graphPayload.parseError === true ? "parse-error" : "empty");
					return;
				}
				graphRef.current = graphPayload.graph;
				setGraph(graphPayload.graph);
				const statePayload = await api("/api/state").catch(() => ({}));
				if (cancelled) return;
				if (Array.isArray(statePayload.hidden)) {
					const loaded = new Set(statePayload.hidden);
					const pruned = pruneHiddenState(graphPayload.graph, loaded);
					hiddenRef.current = pruned ?? loaded;
					setHiddenIds(hiddenRef.current);
					if (pruned !== null) persistHidden(hiddenRef.current);
				}
				setState("ready");
			} catch (error) {
				console.error("初始加载失败:", error && error.message);
				if (!cancelled) setState("error");
			}
		})();
		return () => {
			cancelled = true;
		};
	}, []);

	// SSE：agent 改写 graph.json → server 推送 changed → 拉新图（EventSource 断线自动重连）
	useEffect(() => {
		if (state !== "ready") return;
		const token = new URLSearchParams(location.search).get("token") ?? "";
		const source = new EventSource("/api/events?token=" + encodeURIComponent(token));
		source.addEventListener("changed", () => {
			api("/api/graph")
				.then((payload) => {
					if (payload.graph === null) return;
					reconcileHidden(payload.graph);
					setGraph(payload.graph);
					setPendingDeepen(resolvedPending(payload.graph, pendingRef.current));
				})
				.catch((error) => console.error("更新拉取失败，保留当前图", error));
		});
		return () => source.close();
	}, [state, reconcileHidden]);

	// 过滤隐藏节点（含其子树）及其相连边；集合变化 → 重布局 → key 重挂载
	const filteredGraph = useMemo(() => {
		if (graph === null || hiddenIds.size === 0) return graph;
		const isHidden = createHiddenPredicate(graph, hiddenIds);
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
		const isHidden = createHiddenPredicate(graph, hiddenIds);
		let total = 0;
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

	// 布局：过滤后的图变化（首次加载 / 隐藏变化 / agent 重写）时重排
	useEffect(() => {
		if (state !== "ready" || filteredGraph === null) return;
		elk.layout(toElkGraph(filteredGraph))
			.then((result) => {
				setLayoutResult(result);
				setEpoch((value) => value + 1);
			})
			.catch((error) => console.error("ELK 布局失败", error));
	}, [state, filteredGraph]);

	// 单选焦点 → 连通节点/边集合（含焦点自身）；多选/无选中 = 无突出
	const view = useMemo(
		() => (layoutResult === null ? { nodes: [], edges: [] } : deriveView(filteredGraph, layoutResult)),
		[state, filteredGraph, layoutResult],
	);

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

	const focusNode = focusId === null ? null : view.nodes.find((n) => n.id === focusId);

	if (state !== "ready") {
		const hint =
			state === "empty"
				? "还没有 graph.json。在 pi 会话中运行 /studio-analyze 生成第一版设计结构图。"
				: state === "parse-error"
					? "graph.json 解析失败：文件损坏（agent 可能写坏了候选），检查 data/<项目>/graph.json。"
					: state === "error"
						? "图加载失败：服务器可能已停止（/studio 重新启动）。"
						: "加载中…";
		return html`<div class="h-full flex items-center justify-center text-sm text-zinc-500">${hint}</div>`;
	}

	return html`
		<${HighlightContext.Provider} value=${highlight}>
		<${NodeActionsContext.Provider} value=${{ pendingDeepen, requestDeepen, requestHide }}>
		<div class="flex h-full w-full">
			<div class="relative flex-1 min-w-0 h-full">
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
			${saveFailed || hiddenCount > 0 ? html`<${Panel} position="top-right">
				<div class=${"relative border text-[11px] px-2.5 py-1 rounded-full cursor-pointer shadow-sm " + (saveFailed ? "border-rose-500 text-rose-600 bg-white" : "border-zinc-300 bg-white/90 text-zinc-600 hover:bg-white")} title=${saveFailed ? "隐藏状态保存失败：请重启 pi 会话后重试" : undefined} onClick=${() => setHiddenListOpen((open) => !open)}>
					已隐藏节点（${hiddenCount}）${saveFailed ? " · 未保存" : ""}
				</div>
				${hiddenListOpen ? html`<div class="absolute right-0 top-full mt-1.5 w-56 max-h-80 overflow-y-auto bg-white border border-zinc-200 rounded-lg shadow-lg p-1.5 z-30">
					${hiddenEntries.map((entry) => html`<div class="flex items-center justify-between gap-2.5 px-2 py-1 rounded-md hover:bg-zinc-100" key=${entry.id}>
						<span class="text-sm text-zinc-800 truncate" title=${entry.label}>${entry.label}</span>
						<span class="text-xs text-blue-600 cursor-pointer shrink-0" onClick=${() => restoreHidden(entry.id)}>恢复</span>
					</div>`)}
					<div class="flex items-center justify-end gap-2.5 px-2 py-1 border-t border-zinc-200 mt-1 pt-1.5">
						<span class="text-xs text-blue-600 cursor-pointer" onClick=${restoreAllHidden}>全部恢复</span>
					</div>
				</div>` : null}
			<//>` : null}
			<${Controls} showInteractive=${false} />
			<${Background} variant=${BackgroundVariant.Dots} gap=${16} size=${1} color="#d4d4d8" />
		<//>
			</div>
			${focusNode === null ? null : html`<${InspectorPanel} node=${focusNode} meta=${focusMeta} />`}
		</div>
		<//>
		<//>
	`;
}

createRoot(document.getElementById("root")).render(html`<${App} />`);

/**
 * 构造「自身或任一祖先在隐藏集内」的判定函数（隐藏 group 会连带整个子树）。
 */
function createHiddenPredicate(graphData, hiddenIds) {
	const parentOf = new Map();
	for (const top of graphData.nodes ?? []) {
		(function reg(n, p) { parentOf.set(n.id, p); for (const c of n.children ?? []) reg(c, n.id); })(top, null);
	}
	return (id) => {
		let x = id;
		while (x) {
			if (hiddenIds.has(x)) return true;
			x = parentOf.get(x);
		}
		return false;
	};
}

/**
 * 修剪式对账：state 中已不存在于图里的 id 直接删除。无变化返回 null。
 */
function pruneHiddenState(graphData, currentHidden) {
	if (!graphData || !Array.isArray(graphData.nodes)) return null;
	const graphIds = new Set();
	(function reg(nodes) {
		const list = nodes ?? [];
		for (const node of list) {
			graphIds.add(node.id);
			reg(node.children);
		}
	})(graphData.nodes);
	const next = new Set([...currentHidden].filter((id) => graphIds.has(id)));
	return next.size === currentHidden.size ? null : next;
}

/**
 * 深入完成后清理 pending：已长出 children 或 io 的节点不再等待；其余保留。
 */
function resolvedPending(graphData, pending) {
	if (pending.size === 0) return pending;
	const nodeById = new Map();
	(function reg(nodes) {
		const list = nodes ?? [];
		for (const node of list) {
			nodeById.set(node.id, node);
			reg(node.children);
		}
	})(graphData.nodes);
	return new Set([...pending].filter((id) => {
		const node = nodeById.get(id);
		return node !== undefined && (node.children ?? []).length === 0 && node.io === undefined;
	}));
}
