/* 右侧检查面板：展示选中节点的既有字段（label/kind/summary/evidence/expandable），
 * 纯展示无操作（证据项点击复制路径）。非受控模式下由 App 传入图元数据。 */

import React, { useRef, useState } from "react";
import { html } from "./html.js";

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

	function copyPath(path) {
		navigator.clipboard.writeText(path).then(() => {
			setCopiedPath(path);
			clearTimeout(resetTimer.current);
			resetTimer.current = setTimeout(() => setCopiedPath(null), 1200);
		});
	}

	return html`<aside class="inspector">
		<div class=${"inspector-badge kind-" + info.kind}>${info.kind}</div>
		${info.expandable ? html`<div class="inspector-badge expandable">可深入</div>` : null}
		<div class="inspector-label">${info.label}</div>
		<div class="inspector-summary">${info.summary ?? "（无说明）"}</div>
		<div class="inspector-section-title">证据（点击复制路径）</div>
		${evidence.length > 0
			? evidence.map((path) => html`<div
					class="inspector-evidence"
					key=${path}
					title="点击复制路径，粘贴到 VSCode 快速打开"
					onClick=${() => copyPath(path)}
				>
					<span class="inspector-evidence-path">${path}</span>
					${copiedPath === path ? html`<span class="inspector-copied">已复制 ✓</span>` : null}
				</div>`)
			: html`<div class="inspector-evidence">（无）</div>`}
		<div class="inspector-section-title">信息</div>
		<div class="inspector-meta-row">id：${info.id}</div>
		${children.length > 0 ? html`<div class="inspector-meta-row">子节点：${children.length} 个</div>` : null}
	</aside>`;
}
