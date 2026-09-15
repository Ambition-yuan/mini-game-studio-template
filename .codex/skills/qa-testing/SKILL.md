---
name: qa-testing
description: 对小游戏进行功能、真机、平台、生命周期、广告、数据、性能回归，并产出可追踪的缺陷与测试结论。
---

# QA Testing

## 测试顺序

编辑器 → 微信 DevTools → 微信真机 → 抖音 DevTools → 抖音真机 → 低性能/长时间运行。

## 每次测试

1. 读取 `docs/gdd.md` 确认预期行为。
2. 读取 `docs/qa-checklist.md`。
3. 先覆盖关键路径，再覆盖边界场景。
4. 任何可实际验证的问题尽量实际运行。
5. 将结果记录为 PASS/FAIL/BLOCKED/NOT TESTED。

## 缺陷等级

- P0：无法启动/数据严重损坏/安全或发布阻断。
- P1：核心玩法不可用/广告或存档严重故障/主要平台不可用。
- P2：非核心功能明显问题。
- P3：一般体验或视觉问题。

Release Candidate 默认要求 P0/P1 清零。
