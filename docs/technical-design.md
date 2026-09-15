# Technical Design

## 1. 架构目标

核心游戏逻辑跨平台复用；平台差异集中封装。

## 2. 推荐目录

```text
assets/
├── scenes/
├── prefabs/
├── textures/
├── animations/
├── audio/
├── resources/
└── scripts/
    ├── core/
    ├── gameplay/
    ├── ui/
    ├── data/
    ├── platform/
    └── services/
```

## 3. 平台抽象

```text
PlatformManager
 ├── WeChatPlatform
 └── DouyinPlatform
```

## 4. 数据

关卡、奖励、数值、广告奖励等可调参数应配置化。

## 5. 存档

首版优先本地存储；若产品确有跨设备/云存档需求，再评估平台云能力。

## 6. 广告

统一业务接口，例如：

```text
RewardAdService.showRewardAd(reason): Promise<RewardResult>
```

业务层不得直接散落平台广告 API。

## 7. 构建/分包

具体包体与分包策略以当前 Cocos + 微信 + 抖音官方文档和实际构建产物为准。

## 8. 日志

开发期可记录状态与回调；正式版本不得输出密钥、Token 等敏感信息。
