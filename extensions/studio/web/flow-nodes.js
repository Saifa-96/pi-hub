/* 节点组件：功能卡片与 group 容器（选中出「深入」工具栏，聚焦时压暗） */

import React, { useContext } from "react";
import { Handle, Position } from "@xyflow/react";
import { html } from "./html.js";
import { DeepenContext, useDim } from "./flow-contexts.js";

const HIDDEN_HANDLE = { opacity: 0, width: 1, height: 1, minWidth: 1, minHeight: 1, border: "none" };

export function CardNode({ data, selected }) {
	const { dim } = useDim(data.id, false);
	return html`
		<div class=${"node-shell" + (selected ? " selected" : "") + (dim ? " dimmed" : "")}>
			${selected && data.expandable ? html`<${NodeToolbar} data=${data} />` : null}
			<${Handle} type="target" position=${Position.Left} style=${HIDDEN_HANDLE} />
			<div class=${"graph-card kind-" + data.kind}>
				<div class="graph-card-label" title=${data.label}>${data.label}</div>
				${data.summary ? html`<div class="graph-card-summary" title=${data.summary}>${data.summary}</div>` : null}
			</div>
			<${Handle} type="source" position=${Position.Right} style=${HIDDEN_HANDLE} />
		</div>
	`;
}

export function GroupNode({ data, selected }) {
	const { dim } = useDim(data.id, false);
	return html`
		<div class=${"node-shell" + (selected ? " selected" : "") + (dim ? " dimmed" : "")}>
			${selected && data.expandable ? html`<${NodeToolbar} data=${data} />` : null}
			<${Handle} type="target" position=${Position.Left} style=${HIDDEN_HANDLE} />
			<div class=${"graph-group kind-" + data.kind}>
				<div class="graph-group-title">${data.label}</div>
			</div>
			<${Handle} type="source" position=${Position.Right} style=${HIDDEN_HANDLE} />
		</div>
	`;
}

/* 选中节点的工具栏：浮动在节点上方，「深入」向 agent 发起该节点的细节分析 */
function NodeToolbar({ data }) {
	const { pendingDeepen, requestDeepen } = useContext(DeepenContext);
	const pending = pendingDeepen.has(data.id);
	return html`<div class="node-toolbar">
		<button
			class=${"toolbar-btn" + (pending ? " pending" : "")}
			disabled=${pending}
			title=${"对「" + data.label + "」发起细节分析（agent 读代码补全内部结构，完成后图自动更新）"}
			onClick=${(event) => {
				event.stopPropagation();
				if (!pending) requestDeepen(data.id);
			}}
		>${pending ? "分析中…" : "深入"}</button>
	</div>`;
}
