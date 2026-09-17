# Technical Design: 货架整理达人

> 当前阶段：Phase 2 技术设计
>
> 本文档承接已确认的 `product-brief.md` 和 `gdd.md`，定义第一阶段可实施架构。
> 未经验证的数字和性能假设必须通过原型、测试或官方文档确认。

## 1. 目标

- 游戏规则与 Cocos 渲染解耦，核心逻辑可在纯 TypeScript 环境测试。
- 关卡生成具备可复现随机种子，并保证生成结果可解。
- 微信和抖音差异集中在平台适配层。
- 支持 Graybox 原型快速验证 4 x 6 至 8 x 12 的布局和操作。
- 首版不引入服务器、登录、好友、经济或复杂存档系统。

## 2. 非目标

- 不在运行时依赖后端求解服务。
- 不把广告、存储或平台 API 直接写入玩法逻辑。
- 不为未确认的特殊商品、特殊箱子或长期运营系统预留过度抽象。

## 3. 总体架构

```text
Cocos Scene / Prefab
        ↓
Presentation Layer
  BoardView / InputController / HUD
        ↓
Application Layer
  GameFlowController / CommandDispatcher
        ↓
Domain Layer
  BoardState / RuleEngine / LevelGenerator / SolvabilityVerifier
        ↓
Service Ports
  RewardAdPort / SavePort / AudioPort / PlatformPort
        ↓
Platform Adapters
  WeChat / Douyin / EditorMock
```

依赖方向只能向下，Domain 层不得引用 Cocos、微信或抖音 API。

## 4. 核心数据模型

```ts
type ItemTypeId = string;

interface SlotContent {
  itemTypeId: ItemTypeId;
  hidden: boolean;
}

type Slot = SlotContent | null;

interface ShelfState {
  id: string;
  kind: 'main' | 'buffer';
  capacity: number;
  slots: Slot[];
}

interface BoardState {
  levelId: string;
  shelves: ShelfState[];
}
```

约束：

- `slots` 固定长度等于 `capacity`，索引 `0` 为底部，索引 `capacity - 1` 为顶部。
- 非空商品必须从底部连续排列，不允许中间出现空槽。
- `hidden: true` 表示该位置是箱子，底层仍保存真实 `itemTypeId`。
- 一个箱子只对应一个原有商品，不改变商品数量或容量。
- 主货架和缓冲货架使用同一 `ShelfState` 结构，通过 `kind` 区分。

## 5. 规则引擎

### 5.1 拆箱

`openBox(board, shelfId)` 仅在以下条件成立时成功：

- 货架顶部槽位存在内容。
- 顶部内容为 `hidden: true`。
- 当前游戏状态允许操作。

成功后只把 `hidden` 改为 `false`，位置和商品类型不变。

### 5.2 顶部连续组

`getTopGroup(board, shelfId)` 从顶部向下扫描可见商品：

- 箱子会中断连续组。
- 只返回顶部连续的同一 `itemTypeId` 商品。
- 空货架返回空组。

### 5.3 移动

`moveTopGroup(board, fromShelfId, toShelfId)`：

1. 获取来源货架顶部连续商品组。
2. 若目标货架非空，目标顶部必须为相同 `itemTypeId`。
3. 若目标货架为空，允许接收本次操作能够放入的数量。
4. `moveCount = min(sourceGroupLength, targetFreeSlots)`。
5. `moveCount` 必须大于 0。
6. 目标空位不足时允许拆分，只移动 `moveCount` 个；剩余商品留在来源货架。
7. 成功移动后执行通关检查。

### 5.4 通关

满足以下全部条件时通关：

- 所有箱子均已打开。
- 所有主货架为空或只包含一种商品。
- 所有缓冲货架为空。

同一种商品可以占据多个主货架。

## 6. 状态流转

```text
Boot
  ↓
Home
  ↓ 开始游戏
PrepareLevel
  ↓
Playing
  ├── 打开箱子
  ├── 移动/拆分商品
  ├── 广告解锁缓冲货架
  ├── 广告撤回
  ├── 广告打乱
  └── 设置 → Home
  ↓
LevelComplete
  ↓
NextLevel / Home
```

使用明确的 `GameFlowState` 控制输入，禁止在动画或广告回调期间重复提交操作。

## 7. 关卡配置

```ts
interface LevelConfig {
  id: number;
  shelfCount: number;
  capacity: number;
  itemCounts: Array<{
    itemTypeId: ItemTypeId;
    count: number;
  }>;
  boxCount: number;
  tutorialRule?: 'NO_BOX' | 'TOP_BOX' | 'SPLIT_MOVE';
  generationSeed?: number;
}
```

配置校验必须满足：

- `itemCounts` 总和等于 `(shelfCount - 1) * capacity`。
- 商品类型数量小于 `shelfCount`。
- 每种商品数量是 `capacity` 的整数倍。
- `boxCount` 小于等于商品总数。
- 前 4 关的 `boxCount` 必须为 0。

## 8. 关卡生成与可解性

### 8.1 生成原则

不使用“先随机、再盲目等待求解器找到解”的纯随机方案。推荐使用可解路径构造：

1. 生成已完成状态，每种商品连续占满对应货架，并保留一个空货架。
2. 使用受控逆操作打乱布局，并记录逆操作序列。
3. 逆操作序列反向执行时，必须是一组合法的正向移动。
4. 随机选择 N 个已有商品替换为箱子。
5. 验证商品数量、空位数量、箱子数量和可解路径。
6. 生成成功后保存随机种子、布局和验证记录。

### 8.2 逆操作生成

一次逆操作把某个货架顶部的连续同类商品组移动到另一个有空位的货架：

- 来源货架移除该组后，新的顶部必须为空或仍为同一商品类型。
- 该限制保证逆向执行时，移动回来源货架符合“空货架或顶部同类”规则。
- 随机控制操作次数、来源货架、组长度和目标货架。
- 记录完整序列，用于独立校验器回放。

### 8.3 箱子覆盖

箱子由已经放在货架上的商品原位替换生成：

- 不新增商品。
- 不改变槽位高度。
- 不改变商品类型的总数量。
- 箱内商品类型由生成种子决定，并在关卡生命周期内保持不变。

### 8.4 可解性验证

生成后必须执行两层验证：

1. **回放验证**：按逆操作的反序执行正向操作，必要时先打开对应箱子，最终必须到达通关状态。
2. **独立验证**：开发工具中使用 DFS/A* 或等价搜索器，对小规模关卡进行独立求解检查。

移动端首版优先使用回放验证，避免在大规格关卡中执行高成本全量搜索。

## 9. 随机数

- 使用项目内确定性伪随机数生成器，不使用不可复现的平台随机源直接生成关卡。
- 每关保存 `generationSeed`。
- 同一个关卡配置和种子必须生成完全相同的棋盘。
- Graybox 阶段记录失败种子，便于稳定复现问题。

## 10. 撤回与打乱

### 10.1 撤回

- 使用不可变棋盘快照实现，不反向推算业务规则。
- 每次成功移动或拆箱前压入快照。
- 撤回恢复最近一次操作前的完整棋盘。
- 广告解锁的缓冲货架不属于棋盘快照，撤回不会撤销已解锁的缓冲货架。
- 历史记录设置上限，首版建议最多保存 100 步。

### 10.2 打乱

打乱采用以下默认语义：

- 使用当前关卡配置重新生成一个可解布局。
- 保留当前关卡和箱子数量。
- 清空所有缓冲货架。
- 清空撤回历史。
- 打乱前先完成生成和验证，只有生成成功才展示激励广告。

该行为作为首版技术默认值，Graybox 试玩后确认是否需要保留当前棋盘内容。

## 11. UI 与渲染

### 11.1 场景组织

首版建议一个主场景加独立 UI 面板，减少小游戏场景切换成本：

```text
MainScene
├── BackgroundLayer
├── BoardLayer
│   ├── MainShelfGrid
│   ├── BufferShelfRow
│   └── EffectLayer
├── HudLayer
└── PopupLayer
    ├── SettingsPopup
    ├── RewardPopup
    └── LevelCompletePopup
```

### 11.2 网格布局

- 竖屏设计基准优先使用 750 x 1334 逻辑尺寸。
- `8 x 12` 使用 8 列 x 12 行的主货架网格。
- 每个货架是一列，槽位从底部向上排列。
- 4 x 6、6 x 8、6 x 10、8 x 10 使用同一布局算法，只改变行列数。
- 布局计算必须考虑平台安全区。

### 11.3 操作

首版推荐点击式操作，避免 8 列布局下拖拽目标过窄：

- 点击顶部箱子：拆箱。
- 第一次点击顶部连续商品组：选中并高亮。
- 第二次点击合法目标货架：执行移动。
- 点击非法目标或空白区域：取消选中。

拖拽可作为后续增强，不进入首版必做范围。

### 11.4 节点管理

- 商品节点使用对象池复用。
- View 只消费棋盘快照和领域事件，不直接修改棋盘。
- 动画播放期间锁定当前操作。
- 箱子与商品共享基础视觉节点，通过状态切换表现。

## 12. 服务接口

```ts
interface RewardAdPort {
  isAvailable(reason: RewardReason): Promise<boolean>;
  show(reason: RewardReason): Promise<RewardAdResult>;
}

type RewardReason =
  | 'UNLOCK_BUFFER'
  | 'UNDO'
  | 'SHUFFLE';

interface SavePort {
  load(): Promise<SaveData | null>;
  save(data: SaveData): Promise<void>;
}
```

奖励结果至少区分：

- `completed`
- `skipped`
- `unavailable`
- `failed`

业务层根据结果执行奖励，不得假设平台广告一定成功。

## 13. 广告规则

缓冲货架：

- 第 3 至 8 个缓冲货架每次解锁需要完成一次激励视频。
- 单关最多解锁到第 8 个缓冲货架。
- 游戏不规定激励视频时长。

撤回和打乱每次使用需要完成一次激励视频。

约束：

- 激励视频时长完全由平台和广告源决定。
- 游戏只依据平台回调判断 `completed`、`skipped`、`unavailable` 或 `failed`。
- 广告不可用或播放失败时不发放奖励。
- 基础关卡必须在完全不使用广告的情况下存在通关路径。
- 编辑器和浏览器环境使用 `MockRewardAdPort`，不调用真实广告。

## 14. 本地存档

```ts
interface SaveDataV1 {
  schemaVersion: 1;
  highestUnlockedLevel: number;
  selectedLevel: number;
  completedLevels: number[];
  soundEnabled: boolean;
  musicEnabled: boolean;
}
```

规则：

- 首版只保存关卡进度和设置，不保存进行中的随机棋盘。
- 关卡完成后立即保存。
- 离开进行中的关卡后再次开始，默认重新生成当前关卡。
- 存档必须包含版本号，后续迁移不得直接覆盖未知版本数据。

## 15. 目录规划

```text
assets/scripts/
├── core/
│   ├── random/
│   └── collections/
├── game/
│   ├── domain/
│   ├── generator/
│   ├── commands/
│   └── flow/
├── presentation/
│   ├── board/
│   ├── animation/
│   └── input/
├── ui/
│   ├── home/
│   ├── game/
│   └── popup/
├── data/
│   ├── levels/
│   └── config/
├── platform/
│   ├── wechat/
│   ├── douyin/
│   └── mock/
└── services/
    ├── ads/
    ├── save/
    └── audio/
```

## 16. 测试策略

### 16.1 纯逻辑测试

- 顶部连续组识别。
- 空货架和同类顶部移动。
- 拆分填满规则。
- 箱子不可移动和顶部拆箱。
- 通关条件。
- 商品计数和容量不变量。

### 16.2 生成器测试

- 批量生成大量关卡并验证数量约束。
- 校验逆操作回放能够通关。
- 校验随机关卡不存在不可达或无效状态。
- 对失败种子保存完整输入，保证可复现。

### 16.3 Cocos 集成测试

- 不同分辨率下的安全区与网格布局。
- 操作锁、动画、对象池和快速连点。
- 中途返回首页、重新开始和应用前后台切换。

### 16.4 平台测试

Codex 可执行：

- 微信开发者工具和抖音开发者工具中的构建、启动、自动化与日志检查。
- 激励视频和本地存储在 Mock 或工具环境中的分支检查。

用户执行：

- 微信/抖音 PC 端运行和 Android/iPhone 真机回归。
- 激励视频成功、跳过、失败和不可用状态。
- 本地存储写入、读取、版本迁移及异常退出恢复。
- 低性能设备、锁屏、前后台、网络切换和长时间运行。

Codex 不主动发起、控制或代替用户执行真机测试。用户真机项不要求回填证据，未收到失败反馈时按 `PASS（用户默认）` 处理；该状态不构成可审计的真机验证证据。

## 17. 性能与包体基线

- 首版优先控制商品节点数量和对象池规模。
- 不引入大型 UI 框架或第三方运行时依赖。
- Graybox 阶段在目标低端设备记录帧率、内存和启动时间。
- 包体、分包和平台限制必须在接近发布时依据两家平台当前官方文档重新核验。

## 18. Phase 2 出口条件

- 已确认规则均有对应领域接口和状态转换。
- 关卡配置和生成器可以复现同一局面。
- 可解性回放验证方案明确。
- 微信、抖音和编辑器 Mock 的平台边界明确。
- 首版 UI 交互方案通过 Graybox 前的技术评审。
- 未决项已转为任务，不再停留在聊天记录。
