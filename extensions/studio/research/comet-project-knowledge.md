# Comet (rpamis/comet) — Project Knowledge 子系统调研

> 调研日期 2026-09-07，来源为仓库源码直读（master），非二手文章。
> rpamis/comet ≈2.3k★，Node.js 工作流/Skill 编排平台。

## 定位

Comet 不是画图工具。它的 codebase 理解 = `domains/project-knowledge/`：
给 agent 用的、带来源和信任生命周期的可检索记忆层。

## 架构（四层）

### 1. 双知识模型
- **Project Model**：topology / fact / dependency —— 代码是什么（确定性事实）
- **Project Policy**：decision / pattern / procedure / constraint / failure-resolution —— 怎么对待它（习得策略）
- 铁律（AGENTS.md）："当前源码、配置、测试和 Runtime 状态是项目事实直接来源；
  Project Knowledge 是带来源的可检索理解，不是第二套 Rule 系统"

### 2. 确定性提取器（deterministic-extractors.ts，有硬预算）
- 模块根限定 app/domains/platform/src/packages；解析 import → 依赖事实
- 预算：单文件 64KB / 1.5s deadline / ≤64 模块 / ≤512 文件
- Record 结构：sources 锚点（file:line）、applicablePaths、conclusions、
  relations、verification

### 3. Record 信任状态机（最独到）
- trial → proven → enforced → superseded（+active 计数）
- applicationCount / successCount / failureCount 随使用累积
- 修正 mutation：correct / supersede / feedback / verify(带命令) / refresh
- 原则：知识靠验证使用挣得信任，可审计可纠正，不静默覆盖

### 4. 存储与隐私
- local：sqlite，按 repository identity 跨 worktree 归组，workspace 隔离可重建
- remote 红线：不发完整仓库/完整 diff/凭据/原始日志；remote 失败不静默降级 local
- corpus 同时索引自身工作流产物（native/classic specs、archives、superpowers 文档）

## 对 studio 的可偷之处

| Comet 设计 | studio 动作 |
|---|---|
| Model/Policy 二分 | 验证 analyzed/(事实) vs plans/(意图) 的数据设计 |
| trial→proven 生命周期 | agent 命名 pass 输出为 trial 态 Record；xy-flow 手动改名 = correct/supersede |
| 有界确定性提取 | /studio-analysis 保持确定性+便宜；agent 步只是叠加层 |
| remote 隐私红线 | agent pass 只发簇摘要+文件清单，永不发全仓库 |
| repository identity 跨 worktree | encoded-cwd "搬家即孤儿"天花板的升级路径 |

## 对比结论

studio 强在结构分析轴（dependency-cruiser + Louvain 精细）；
Comet 强在知识生命周期轴（信任/修正/审计）。
它补的正是 studio "agent 产出如何被信任和修正" 的空白。

## 源码索引

- domains/project-knowledge/{types,records,deterministic-extractors,learning,local-provider,remote-provider,sqlite,query}.ts
- .claude/rules/70-project-knowledge.md（领域规则全文）
- docs/comet/archive/2026-08-*-project-knowledge-*（OpenSpec 变更归档，含 brief/spec/verification）
