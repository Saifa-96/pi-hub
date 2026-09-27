/* flow 内的共享 context 与钩子。
 * 非受控模式下节点的 data/样式在挂载时冻结，跨帧状态（深入 pending、
 * 选中突出）只能经 context 驱动组件重渲染。 */

import { createContext, useCallback, useContext } from "react";
import { useOnSelectionChange } from "@xyflow/react";

export const NodeActionsContext = createContext({
	pendingDeepen: new Set(),
	requestDeepen: () => {},
	requestHide: () => {},
});

export const HighlightContext = createContext({ active: false, nodeIds: null, edgeIds: null });

/**
 * 监听选中变化（必须是 <ReactFlow> 子组件）；仅单选时上报焦点节点 id。
 */
export function SelectionWatcher({ onSelect }) {
	const onChange = useCallback(({ nodes }) => onSelect(nodes.length === 1 ? nodes[0].id : null), [onSelect]);
	useOnSelectionChange({ onChange });
	return null;
}

/**
 * 当前节点/边是否处于压暗态（焦点聚焦时不在连通集内）。
 */
export function useDim(id, isEdge) {
	const hl = useContext(HighlightContext);
	if (!hl.active) return { dim: false, emphasized: false };
	const ids = isEdge ? hl.edgeIds : hl.nodeIds;
	return { dim: !ids.has(id), emphasized: isEdge && ids.has(id) };
}
