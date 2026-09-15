# Mini Game Studio Template

用于以 **Codex + Cocos Creator + TypeScript + GitHub** 的方式，从 0 到 1 完成微信小游戏与抖音小游戏，并逐步沉淀成可复制的生产模板。

## 目标

第一款产品完成完整闭环：

创意 → 产品讨论 → GDD → 技术设计 → Graybox 原型 → 正式开发 → 素材/UI/音频 → 平台能力 → QA → 性能/包体 → 资质/合规 → 双平台提审 → 上线 → 数据验证。

## 当前阶段

以 `docs/status.md` 为准。

## Codex 工作入口

第一次打开仓库时：

1. 读取根目录 `AGENTS.md`。
2. 读取与当前任务相关的 Skill。
3. 读取 `docs/status.md` 和相关项目文档。
4. 先做最小可验证工作，再修改代码。

推荐第一条指令见 `CODEX_START.md`。

## 目录

```text
.
├── AGENTS.md
├── README.md
├── CODEX_START.md
├── docs/
│   ├── status.md
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
├── .codex/skills/
│   ├── product-design/
│   ├── cocos-development/
│   ├── game-art/
│   ├── platform-wechat/
│   ├── platform-douyin/
│   ├── qa-testing/
│   └── release/
├── .github/
│   ├── ISSUE_TEMPLATE/
│   └── PULL_REQUEST_TEMPLATE/
├── assets/
├── project/
└── scripts/
```

## 原则

- 一个仓库一个真实项目事实来源。
- AGENTS 定长期规则，Skills 定可复用工作流，Docs 记项目事实，GitHub Issues 管任务。
- 产品重大决定由人确认；代码和机械性工作尽量让 Codex 自动完成。
- 平台发布动作保留人工确认。
