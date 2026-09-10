# Game Design Document

> 状态：DRAFT

## 1. 游戏概述

### 核心玩法

TBD

### 玩家目标

TBD

### 一局流程

```text
Start → Tutorial（如有）→ Play → Result → Reward → Retry
```

## 2. 操作

| 操作 | 输入 | 结果 |
|---|---|---|
| TBD | TBD | TBD |

## 3. 游戏状态机

```text
Boot
 ↓
Home
 ↓
Playing
 ├─ Paused
 └─ GameOver
      ↓
    Result
      ↓
    Home / Retry
```

## 4. 规则

### 胜利条件
TBD

### 失败条件
TBD

### 得分
TBD

### 奖励
TBD

## 5. 数值

所有首版关键数值优先配置化。

| 参数 | 初始值 | 范围 | 说明 |
|---|---:|---:|---|
| TBD | 0 | TBD | TBD |

## 6. UI

- Home
- HUD
- Pause
- Result
- Settings（如需要）

## 7. 新手引导

原则：尽量用实际交互教会玩家，而不是长段文字说明。

## 8. 商业化

首版优先考虑：

- 激励广告复活
- 激励广告额外奖励

广告必须有失败、取消、断网和重复领奖保护。

## 9. 音频

| 事件 | 音效 |
|---|---|
| 点击 | TBD |
| 成功 | TBD |
| 失败 | TBD |

## 10. 首版内容边界

明确列出不进入 1.0 的内容，防止范围膨胀。
