/* 节点组件：功能卡片与 group 容器（选中出工具栏：深入/隐藏，聚焦时压暗） */

import React, { useContext } from "react";
import { Handle, Position } from "@xyflow/react";
import { html } from "./html.js";
import { NodeActionsContext, useDim } from "./flow-contexts.js";
import { KIND_CARD_BORDER, KIND_GROUP_BORDER, KIND_TEXT, pickKind } from "./kind-styles.js";

const HIDDEN_HANDLE = { opacity: 0, width: 1, height: 1, minWidth: 1, minHeight: 1, border: "none" };

export function CardNode({ data, selected }) {
	const { dim } = useDim(data.id, false);
	const shellClass = ["relative w-full h-full transition-opacity", dim ? "opacity-25" : "", selected ? "z-10" : ""]
		.filter(Boolean)
		.join(" ");
	const cardClass = [
		"w-full h-full box-border overflow-hidden px-3 py-2 bg-white border rounded-lg shadow-sm",
		"border-l-4",
		pickKind(KIND_CARD_BORDER, data.kind),
		selected ? "ring-2 ring-blue-500/40" : "",
	]
		.filter(Boolean)
		.join(" ");
	return html`
		<div class=${shellClass}>
			${selected ? html`<${NodeToolbar} data=${data} />` : null}
			<${Handle} type="target" position=${Position.Left} style=${HIDDEN_HANDLE} />
			<div class=${cardClass}>
				<div class="font-semibold text-sm truncate" title=${data.label}>${data.label}</div>
				${data.summary ? html`<div class="mt-0.5 text-xs text-zinc-500 truncate" title=${data.summary}>${data.summary}</div>` : null}
			</div>
			<${Handle} type="source" position=${Position.Right} style=${HIDDEN_HANDLE} />
		</div>
	`;
}

export function GroupNode({ data, selected }) {
	const { dim } = useDim(data.id, false);
	const shellClass = ["relative w-full h-full transition-opacity", dim ? "opacity-25" : "", selected ? "z-10" : ""]
		.filter(Boolean)
		.join(" ");
	const groupClass = [
		"w-full h-full box-border rounded-xl border-2 border-dashed bg-zinc-50/80",
		pickKind(KIND_GROUP_BORDER, data.kind),
		selected ? "ring-2 ring-blue-500/40" : "",
	]
		.filter(Boolean)
		.join(" ");
	return html`
		<div class=${shellClass}>
			${selected ? html`<${NodeToolbar} data=${data} />` : null}
			<${Handle} type="target" position=${Position.Left} style=${HIDDEN_HANDLE} />
			<div class=${groupClass}>
				<div class=${"px-3 pt-1.5 text-xs font-semibold " + pickKind(KIND_TEXT, data.kind)}>${data.label}</div>
			</div>
			<${Handle} type="source" position=${Position.Right} style=${HIDDEN_HANDLE} />
		</div>
	`;
}

/* 选中节点的工具栏：浮动在节点上方。「深入」仅对 expandable 节点提供，
 * 「隐藏」对所有节点可用 */
function NodeToolbar({ data }) {
	const { pendingDeepen, requestDeepen, requestHide } = useContext(NodeActionsContext);
	const pending = pendingDeepen.has(data.id);
	return html`<div class="absolute -top-9 left-0 right-0 mx-auto w-fit flex gap-1 rounded-lg bg-zinc-900 px-1 py-1 shadow-lg z-10">
		${data.expandable ? html`<button
			class=${"px-2.5 py-1 text-xs text-zinc-100 rounded-md cursor-pointer hover:bg-white/15 disabled:opacity-50 disabled:cursor-default" + (pending ? " opacity-50" : "")}
			disabled=${pending}
			title=${"对「" + data.label + "」发起细节分析（agent 读代码补全内部结构，完成后图自动更新）"}
			onClick=${(event) => {
				event.stopPropagation();
				if (!pending) requestDeepen(data.id);
			}}
		>${pending ? "分析中…" : "深入"}</button>` : null}
		<button
			class="px-2.5 py-1 text-xs text-zinc-100 rounded-md cursor-pointer hover:bg-white/15"
			title=${"隐藏「" + data.label + "」及其连线（右上角可恢复）"}
			onClick=${(event) => {
				event.stopPropagation();
				requestHide(data.id);
			}}
		>隐藏</button>
	</div>`;
}
