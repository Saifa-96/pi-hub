# Studio

设计结构图工作台：agent 分析当前代码库产出「设计结构图」（graph.json），
页面渲染为可交互的结构图，用户按需对节点发起「深入」分析——图是 agent
维护的活文档，理解代码库的运行逻辑靠下钻而不是读源码。

## 命令

- `/studio` — 启动进程内服务并打开页面（再次运行只重开浏览器）
- `/studio-analyze` — 派发分析任务给前台 sub-agent（ESC 可中断），产出第一版骨架图
- `/studio-quit` — 停止服务

服务是 pi 进程内的监听器（127.0.0.1 随机端口，token 门控），随会话关闭。

## 页面交互

- **选中节点** → 相连节点/边突出，其余压暗；右侧面板显示详情（kind、label、
  summary、输入/输出明细、证据路径——点击复制）
- **深入**（工具栏，仅 expandable 节点）→ agent 读真实代码补全该节点的内部
  结构（children + io 字段），完成后图自动更新（SSE 推送，无轮询）
- **隐藏**（工具栏，所有节点）→ 连同子树和相关连线一起隐藏；右上角
  「已隐藏节点（N）」芯片可逐个或全部恢复
- 边方向 = **提供方 → 消费方**：读作「from 向 to 提供〈label〉」；全出箭头
  的是基础模块，全入箭头的是业务节点；双向关系（请求-响应、读写）画双箭头

## 数据

```
extensions/studio/data/<project-slug>/
├── graph.json           # 设计结构图（agent 维护，见 SCHEMA.md 契约）
├── graph.candidate.json # agent 的候选稿，校验通过后复制为 graph.json
└── ui-state.json        # 页面视口状态（隐藏节点等），agent 不读写
```

graph.json 是活文档：修改必须走「候选 → `validate-graph.mjs` 校验 exit 0 →
冻结」流程；拆分按「可独立命名的职责」，io 只在深入（读过真实代码）后提取。

## 技术栈

零构建静态页（`web/`，Tailwind CSS 浏览器版 + ELK 分层布局 + xy-flow 渲染）。
ELK layered（RIGHT + 正交路由）负责坐标与连线避让；xy-flow 非受控模式负责
交互；server 对 graph.json 做 fs.watch，变更经 SSE 推送到页面。

跑检查：

```bash
node --test extensions/studio/*.test.mjs
```
