/* htm 标签模板绑定与工具类拼接：所有组件文件共用 */

import React from "react";
import htm from "htm";

export const html = htm.bind(React.createElement);

/**
 * 连接条件类名（react.md 工具类规则）：传入任意多段字符串/假值，过滤后拼接。
 */
export function cn(...parts) {
	return parts.filter(Boolean).join(" ");
}
