/* Studio 页面：React + xy-flow 官方示例形态（mock 数据，可拖拽/连线） */

import React, { useCallback, useState } from "react";
import { createRoot } from "react-dom/client";
import htm from "htm";
import {
	ReactFlow,
	Background,
	BackgroundVariant,
	Controls,
	MiniMap,
	applyNodeChanges,
	applyEdgeChanges,
	addEdge,
} from "@xyflow/react";

const html = htm.bind(React.createElement);

/* ── mock 数据（普通 xy-flow 示例）────────────────────── */
const initialNodes = [
	{ id: "1", position: { x: 0, y: 0 }, data: { label: "输入" } },
	{ id: "2", position: { x: 0, y: 100 }, data: { label: "处理" } },
	{ id: "3", position: { x: 200, y: 50 }, data: { label: "输出" } },
];

const initialEdges = [
	{ id: "e1-2", source: "1", target: "2" },
	{ id: "e2-3", source: "2", target: "3" },
];

/* ── 官方示例的受控流：节点可拖、边可连 ───────────────── */
function Flow() {
	const [nodes, setNodes] = useState(initialNodes);
	const [edges, setEdges] = useState(initialEdges);

	const onNodesChange = useCallback(
		(changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
		[],
	);
	const onEdgesChange = useCallback(
		(changes) => setEdges((eds) => applyEdgeChanges(changes, eds)),
		[],
	);
	const onConnect = useCallback(
		(connection) => setEdges((eds) => addEdge(connection, eds)),
		[],
	);

	return html`
		<${ReactFlow}
			nodes=${nodes}
			edges=${edges}
			onNodesChange=${onNodesChange}
			onEdgesChange=${onEdgesChange}
			onConnect=${onConnect}
			fitView
			proOptions=${{ hideAttribution: true }}
		>
			<${Controls} />
			<${MiniMap} pannable zoomable />
			<${Background} variant=${BackgroundVariant.Dots} gap=${12} size=${1} />
		<//>
	`;
}

createRoot(document.getElementById("root")).render(html`<${Flow} />`);
