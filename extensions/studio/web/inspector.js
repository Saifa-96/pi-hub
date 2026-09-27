/* 右侧检查面板：展示选中节点的既有字段。输入/输出区块只在节点带 io
 * （agent 深入时从真实代码提取）时出现；证据项点击复制路径。 */

import React, { useRef, useState } from "react";
import { html } from "./html.js";
import { KIND_BADGE, KIND_TEXT, pickKind } from "./kind-styles.js";

/**
 * 深入节点的结构化 I/O 字段：递归渲染嵌套 fields，子级缩进 + 引导线。
 */
function IoField({ item }) {
	return html`<div class="mb-2">
		<div class="text-sm font-semibold break-all">${item.name}</div>
		<div class="text-xs text-zinc-500 leading-relaxed">${item.description}</div>
		${item.fields && item.fields.length > 0
			? html`<div class="my-1 ml-1 pl-3 border-l border-zinc-200">
				${item.fields.map((child) => html`<${IoField} item=${child} key=${child.name} />`)}
			</div>`
			: null}
	</div>`;
}

function IoList({ items }) {
	return items.map((item) => html`<${IoField} item=${item} key=${item.name} />`);
}

function SectionTitle({ children }) {
	return html`<div class="text-[11px] uppercase tracking-wider text-zinc-400 font-semibold mt-3.5 mb-1.5">${children}</div>`;
}

export function InspectorPanel({ node, meta }) {
	const [copiedPath, setCopiedPath] = useState(null);
	const resetTimer = useRef(null);
	const info = meta ?? {
		id: node.id,
		label: node.label,
		summary: node.summary,
		kind: node.kind,
		expandable: node.expandable,
		evidence: [],
	};
	const children = meta?.children ?? [];
	const evidence = info.evidence ?? [];
	const io = meta?.io ?? null;

	function copyPath(path) {
		navigator.clipboard.writeText(path).then(() => {
			setCopiedPath(path);
			clearTimeout(resetTimer.current);
			resetTimer.current = setTimeout(() => setCopiedPath(null), 1200);
		});
	}

	return html`<aside class="w-[300px] shrink-0 border-l border-zinc-200 bg-white p-4 overflow-y-auto">
		<div class=${"inline-block text-[11px] tracking-wide px-2 py-0.5 border rounded-full mr-1.5 mb-2 " + pickKind(KIND_BADGE, info.kind)}>${info.kind}</div>
		${info.expandable ? html`<div class="inline-block text-[11px] tracking-wide px-2 py-0.5 border border-rose-500 text-rose-600 rounded-full mb-2">可深入</div>` : null}
		<div class="font-semibold text-[15px] mb-1.5">${info.label}</div>
		<div class="text-xs text-zinc-500 leading-relaxed">${info.summary ?? "（无说明）"}</div>
		${io ? html`
		<${SectionTitle}>输入<//>
		${(io.inputs ?? []).length > 0 ? html`<${IoList} items=${io.inputs} />` : html`<div class="text-xs text-zinc-400">（无）</div>`}
		<${SectionTitle}>输出<//>
		${(io.outputs ?? []).length > 0 ? html`<${IoList} items=${io.outputs} />` : html`<div class="text-xs text-zinc-400">（无）</div>`}
		` : null}
		<${SectionTitle}>证据（点击复制路径）<//>
		${evidence.length > 0
			? evidence.map((path) => html`<div
					class="text-xs py-0.5 break-all cursor-pointer flex justify-between gap-2 rounded px-1 -mx-1 hover:bg-zinc-100"
					key=${path}
					title="点击复制路径，粘贴到 VSCode 快速打开"
					onClick=${() => copyPath(path)}
				>
					<span>${path}</span>
					${copiedPath === path ? html`<span class="text-xs text-emerald-600 shrink-0">已复制 ✓</span>` : null}
				</div>`)
			: html`<div class="text-xs text-zinc-400">（无）</div>`}
		<${SectionTitle}>信息<//>
		<div class="text-xs text-zinc-500 py-0.5">id：${info.id}</div>
		${children.length > 0 ? html`<div class="text-xs text-zinc-500 py-0.5">子节点：${children.length} 个</div>` : null}
	</aside>`;
}
