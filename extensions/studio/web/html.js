/* htm 标签模板绑定：所有组件文件共用同一个 React.createElement 绑定 */

import React from "react";
import htm from "htm";

export const html = htm.bind(React.createElement);
