---
name: cocos-development
description: 在 Cocos Creator 3.8.8 + TypeScript 中实现小游戏功能、场景、Prefab、UI、动画、数据与性能优化。
---

# Cocos Development

## 开始前

读取：`AGENTS.md`、`docs/status.md`、`docs/gdd.md`、`docs/technical-design.md`，再阅读相关源码。

## 实现原则

- 固定项目当前 Cocos 版本，不主动升级。
- 优先最小改动。
- Scene/Prefab/Meta/UUID 关系必须保持稳定。
- GameManager 不承载所有逻辑。
- 通过清晰接口隔离平台差异。
- 可调数值配置化。

## 代码结构

优先遵循：

```text
core/       通用框架
 game/      核心玩法
ui/         UI
 data/      配置与数据
platform/   微信/抖音适配
services/   广告、存档、音频等
```

## 验证

至少运行与本次修改相关的：
- TypeScript/编译检查
- Cocos 编辑器运行
- 构建验证（任务需要时）

涉及视觉变化时，优先实际打开场景或构建预览确认。
