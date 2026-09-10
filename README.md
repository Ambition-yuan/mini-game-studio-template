# Mini Game Studio Template

用于在 Codex 协助下，从 0 到 1 完成第一款小游戏，并逐步沉淀为可复制的小游戏生产模板。

## 当前目标

- 引擎：Cocos Creator 3.8.x
- 语言：TypeScript
- 平台：微信小游戏、抖音小游戏
- 开发方式：Codex 辅助 + 人工产品决策 + 真机验证
- 第一款产品原则：小而完整、短局、低后端依赖、先上线再扩展

## 文档入口

1. `AGENTS.md`：长期规则，Codex 每次工作前应读取。
2. `docs/product-brief.md`：产品一句话定义和边界。
3. `docs/gdd.md`：完整游戏设计。
4. `docs/roadmap.md`：阶段计划和当前进度。
5. `docs/technical-design.md`：技术架构与平台适配。
6. `docs/qa-checklist.md`：测试清单。
7. `docs/release-checklist.md`：发布前清单。
8. `docs/ops-and-metrics.md`：上线后的数据指标与迭代方式。
9. `docs/changelog.md`：版本变更记录。
10. `docs/decisions/`：重要决策记录。

## 开工方式

把本仓库放入 GitHub 后，在 Codex 中打开仓库根目录，先发送：

> 阅读 `AGENTS.md`、`README.md` 和 `docs/roadmap.md`。先只做项目现状检查，不修改代码。输出当前阶段、已满足的前置条件、缺失项、下一项最小任务和验证方法。

## 目录

```text
.
├── AGENTS.md
├── README.md
├── docs/
│   ├── product-brief.md
│   ├── gdd.md
│   ├── roadmap.md
│   ├── technical-design.md
│   ├── qa-checklist.md
│   ├── release-checklist.md
│   ├── ops-and-metrics.md
│   ├── changelog.md
│   ├── decisions/
│   └── tasks/
├── .codex/
│   └── skills/
├── assets/
├── project/
└── scripts/
```

## 原则

规则与任务分离；任务与代码分离；平台差异集中封装；所有关键结论尽量有证据；所有发布动作保留人工确认。
