/* 边组件：ELK 正交折线的忠实渲染（圆角化）+ 聚焦态样式 */

import { BaseEdge } from "@xyflow/react";
import { html } from "./html.js";
import { useDim } from "./flow-contexts.js";

export const EDGE_DEFAULTS = {
	type: "routed",
	interactionWidth: 16,
	style: { stroke: "#a1a1aa", strokeWidth: 1.5 },
	labelStyle: { fill: "#3f3f46", fontSize: 11 },
	labelShowBg: true,
	labelBgStyle: { fill: "#ffffff", fillOpacity: 0.9 },
	labelBgPadding: [4, 2],
	labelBgBorderRadius: 4,
};

export function RoutedEdge({ id, data, label, labelStyle, labelShowBg, labelBgStyle, labelBgPadding, labelBgBorderRadius, markerStart, markerEnd, interactionWidth, style }) {
	const points = data?.points;
	const path = roundedPath(points, 10);
	const labelPoint = data?.labelX !== undefined ? { x: data.labelX, y: data.labelY } : null;
	const { dim, emphasized } = useDim(id, true);
	const edgeStyle = Object.assign({}, style, { opacity: dim ? 0.12 : undefined, strokeWidth: emphasized ? 2.2 : undefined });
	const dimmedLabelStyle = dim ? Object.assign({}, labelStyle, { opacity: 0.12 }) : labelStyle;
	return html`<${BaseEdge}
		id=${id}
		path=${path}
		label=${label}
		labelX=${labelPoint?.x ?? 0}
		labelY=${labelPoint?.y ?? 0}
		labelStyle=${dimmedLabelStyle}
		labelShowBg=${labelShowBg}
		labelBgStyle=${labelBgStyle}
		labelBgPadding=${labelBgPadding}
		labelBgBorderRadius=${labelBgBorderRadius}
		markerStart=${markerStart}
		markerEnd=${markerEnd}
		interactionWidth=${interactionWidth}
		style=${edgeStyle}
	/>`;
}

/**
 * 折线转 SVG path：相邻线段夹角处用二次贝塞尔圆角化，线段过短时直角直连。
 */
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
