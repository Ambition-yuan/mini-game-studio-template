# Technical Design

## 1. 技术栈

- Cocos Creator：3.8.x（锁定具体版本）
- TypeScript
- 微信小游戏
- 抖音小游戏

## 2. 逻辑分层

```text
Gameplay / UI / Data
        |
   Services Layer
        |
 Platform Adapter
   /           \\
WeChat       Douyin
```

业务逻辑不得到处直接调用平台 API。

## 3. 推荐代码结构

```text
assets/scripts/
├── core/
├── gameplay/
├── ui/
├── data/
├── platform/
│   ├── IPlatform.ts
│   ├── WeChatPlatform.ts
│   └── DouyinPlatform.ts
└── services/
    ├── SaveService.ts
    ├── AdService.ts
    ├── AudioService.ts
    └── AnalyticsService.ts
```

## 4. 平台接口

最小公共接口建议：

- initialize()
- showRewardAd()
- vibrate()
- getStorage()
- setStorage()
- share()（只有实际需要时实现）

## 5. 配置化

优先配置化：

- 玩家属性
- 关卡
- 敌人
- 道具
- 奖励
- 广告奖励
- 冷却
- 难度
- 文案

## 6. 资源策略

- 首屏只加载必须资源。
- 大量资源使用 Asset Bundle / 分包策略。
- 图集、纹理尺寸和音频格式必须经过实际测量。
- 平台包体限制以当前官方文档为准。

## 7. 存档

首版默认本地存储；只有明确的跨设备/联网需求才引入云存档。

## 8. 错误处理

平台 API 必须考虑：

- 不支持
- 回调失败
- 超时
- 用户取消
- 网络失败
- 生命周期切换

## 9. 日志

开发期日志分为：

- game
- platform
- ad
- save
- analytics
- error

正式版本不得输出敏感信息。
