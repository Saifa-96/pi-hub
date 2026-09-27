# graph.json —— 项目设计结构图契约

图是 agent 维护的活文档：记录「项目有哪些功能块、它们怎么连接」，
不是代码结构。语言/技术栈无关。所有修改必须原地小步进行 + 过校验。

## 文件与生命周期

- 路径：`extensions/studio/data/<项目名>/graph.json`
- 产出流程：写 `graph.candidate.json` → `node validate-graph.mjs <候选> <仓库根>`
  → exit 0 才能复制为 `graph.json`（冻结）；校验不过绝不写 graph.json
- 增量修改同理：以现有 graph.json 为底，只改目标部分，逐字保留其余

## 顶层结构

```jsonc
{
  "project": "speakpal",
  "generatedAt": "<ISO 时间>",
  "nodes": [ /* 节点 */ ],
  "edges": [ /* 边 */ ]
}
```

## 节点

```jsonc
{
  "id": "grammar",                      // 全局唯一 slug（人好认即可，不带类型前缀）
  "kind": "frontend",                   // frontend | backend | database | external
  "label": "语法练习",                    // 图上显示的名字（人话，短）
  "summary": "按遗忘曲线调度复习",         // 一句话说明（database 的如「使用 supabase」）
  "evidence": ["app/grammar/page.tsx"], // 仓库相对路径，可带 :行号，必须真实存在
  "children": [],                       // 任何节点都可以有——深入(deepen)就是填它
  "expandable": true,                   // 可选：内部还有未披露的内部结构，可在 studio 页面发起「深入」；
                                        // 有 children = 已深入过；深入后 agent 重估（更深层仍在则保留 true）
  "io": {                                // 可选：输入/输出明细，只在深入（读过真实代码）后填写；
                                         // 嵌套对象用 fields 递归描述（≤3 层），数组字段名加 []
    "inputs": [
      {
        "name": "body",
        "description": "创建对局的请求体",
        "fields": [
          { "name": "sessionId", "description": "定位对局" },
          { "name": "utterances[]", "description": "逐角色台词", "fields": [
            { "name": "role", "description": "发言角色" }
          ] }
        ]
      }
    ],
    "outputs": [ { "name": "stream", "description": "SSE 事件流，data 为逐角色增量台词" } ]
  }
}
```

| kind | 含义 | 第一版通常给到 |
|---|---|---|
| frontend | 用户交互面（页面、客户端） | 入口清单 + 一句话 |
| backend | 服务端逻辑（API、任务、核心模块） | 模块清单 + 一句话 |
| database | 数据存储 | 技术事实（「使用 supabase」） |
| external | 第三方服务/外部依赖 | 是什么、干什么用 |

## 边

```jsonc
{ "from": "grammar", "to": "tts", "label": "fetch /api/tts", "bidirectional": true }
```

- from/to 必须是已存在的节点 id（含任何节点的 children 里的 id）
- label：2–6 字短语，说明这条线「传的是什么」（如动宾短语「提交答案」、名词短语「用户会话」；具体用词由项目决定），非必填但强烈建议
- bidirectional：可选。请求-响应、读写类双向关系标 true（画双箭头）；纯推送/单向调用不标

## 修改纪律（agent 必须遵守）

1. 只做原地小编辑，三种操作：拆分（节点→children）、填充（summary/evidence）、
   连线/改线（新增边，或把边端点改到更具体的节点——证据支持时）
2. **深入与 kind 无关**：任何节点被深入就是填 children（database 也能深入成
   表/集合，external 也能深入成具体 API 面）
3. **拆分按「可独立命名的职责」**：每个 child 要能用「它负责___」一句话描述，
   且在代码里有清晰边界（路由组/类/模块目录/导出簇）。文件只是证据，不是拆
   分依据——一个 child 常横跨多个文件；只能命名为「某函数做的事」的不拆
4. 禁止整图重写；未被要求深入的节点保持原样（含它的错别字）
5. evidence 只写真实读过的文件路径，禁止发明
6. 每次改完必须跑校验；连续两轮错误数不降就停，如实报告
