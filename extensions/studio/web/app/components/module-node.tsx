"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import "./module-node.css";

export type ModuleNodeData = { title: string; files: number };

export function ModuleNode({ data }: NodeProps) {
  const { title, files } = data as unknown as ModuleNodeData;
  return (
    <div className="inner">
      <Handle type="target" position={Position.Left} />
      <div className="title">{title}</div>
      <div className="subline">module</div>
      <div className="badge">{files}</div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
