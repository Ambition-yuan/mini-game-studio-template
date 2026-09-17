---
name: qa-testing
description: 对小游戏进行功能、真机、平台、生命周期、广告、数据、性能回归，并产出可追踪的缺陷与测试结论。
---

# QA Testing

## 测试顺序

Codex 负责：编辑器 → 微信 DevTools → 抖音 DevTools → 自动化与静态检查。

用户负责：微信 PC/移动端真机 → 抖音 PC/移动端真机 → 低性能/长时间运行。

Codex 不主动发起、控制或代替用户执行真机测试，也不根据 DevTools 或模拟器结果推断真机 PASS。

真机项不要求用户回填，也不要求 Codex 反复确认。未收到用户失败反馈时，记为 `PASS（用户默认）`；用户报告失败时改为 `FAIL` 或 `BLOCKED`。

## 每次测试

1. 读取 `docs/gdd.md` 确认预期行为。
2. 读取 `docs/qa-checklist.md`。
3. 区分 Codex 可自动执行项和用户真机项。
4. 先覆盖关键路径，再覆盖边界场景。
5. Codex 只实际运行授权范围内的检查；真机项交给用户独立测试，不要求提交结果或证据。
6. 将 Codex 结果记录为 PASS/FAIL/BLOCKED/NOT TESTED；用户真机项默认记录为 `PASS（用户默认）`，收到失败反馈后改为 FAIL/BLOCKED。

## 缺陷等级

- P0：无法启动/数据严重损坏/安全或发布阻断。
- P1：核心玩法不可用/广告或存档严重故障/主要平台不可用。
- P2：非核心功能明显问题。
- P3：一般体验或视觉问题。

Release Candidate 默认要求 P0/P1 清零。
