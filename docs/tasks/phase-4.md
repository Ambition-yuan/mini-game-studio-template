# Phase 4 — 正式内容开发

> 状态：进行中
>
> 进入日期：2026-09-17
>
> 本文件保存 Phase 4 的范围、验收标准和跨会话任务拆解。具体任务可同步映射到 GitHub Issues。

## 目标

把已经通过 Graybox 验证的核心棋盘原型补成功能完整的首版单机游戏闭环：玩家可以从首页开始或继续当前关卡，完成 10 个关卡、处理通关和下一关、保存本地进度，并在 Mock 奖励广告环境下正确使用缓冲货架、撤回和打乱。

Phase 4 结束时，游戏核心功能应已完成并可通过纯逻辑测试、Cocos/Web 构建和自动化回归验证；真实微信/抖音平台适配、正式美术音频和发布级性能优化不在本阶段完成。

## 输入

- `docs/product-brief.md` 与 `docs/gdd.md` 中冻结的产品规则、关卡表、广告规则和首版范围。
- `docs/technical-design.md` 中的分层架构、状态流转、服务接口、存档模型和测试策略。
- `project/assets/scripts/game` 下现有的领域层、生成器、流程控制器和 Graybox UI。
- `project/scripts/verify-domain.mjs` 与现有构建/回归脚本。
- `docs/status.md` 中记录的 Phase 3 已通过项、已知风险和未验证项。

## 输出

- 10 个已配置关卡可从第 1 关推进到第 10 关，并正确判定通关和下一关。
- 首页、对局 HUD、设置、重开、通关和下一关流程具备完整状态闭环。
- 本地进度保存与读取可恢复当前关卡、最高解锁关卡和已完成关卡。
- 奖励广告通过稳定的 `RewardAdPort` 接入业务逻辑，并提供可测试的 Mock 实现。
- 缓冲货架解锁、撤回、打乱均由广告结果驱动，不依赖平台全局 API。
- 关键流程具备自动化测试或可重复的 Web/Cocos 验证证据。
- `docs/status.md`、本任务文件和必要测试记录在阶段出口前更新。

## 验收标准

- 从首页开始游戏会重新生成当前选中关卡；从设置返回首页后再次开始，行为符合 GDD。
- 第 1 至 10 关均能生成可解局面，规则、箱子数量和商品总数符合配置。
- 完成一关后进入通关状态，可继续下一关；第 10 关完成后停留在可重复访问的已通关状态。
- 本地存档包含 `schemaVersion`、最高解锁关卡、当前选中关卡、已完成关卡和音频设置。
- 模拟广告返回 `completed` 时才发放奖励；`skipped`、`unavailable`、`failed` 均不改变业务状态。
- 两个容量为 1 的基础缓冲货架始终可用；第 3 至 8 个缓冲货架、撤回和打乱遵守已确认的奖励规则。
- Domain 层不引用 Cocos、微信或抖音 API；平台差异只存在于适配层。
- 相关纯逻辑测试、TypeScript 检查和可执行的构建/运行验证通过。

## 非目标

- 不接入真实微信/抖音激励广告、平台存储或平台生命周期 API；这些进入 Phase 5。
- 不制作正式商品图、货架图、音效、音乐或商店发布素材；这些进入 Phase 6。
- 不进行发布级性能、内存、分包和包体优化；这些进入 Phase 8。
- 不增加账号、社交、排行榜、内购、经济系统或联网存档。
- 不重做已被 Phase 3 验证的 Scene/Prefab/Meta 关系，除非任务明确要求并验证影响。

## 任务拆解

### P4-01 关卡推进与通关状态闭环

状态：已完成（2026-09-17）

交付：

- 明确 `Home / Playing / LevelComplete` 的流程状态。
- 通关后支持下一关，处理第 10 关边界。
- 关卡切换时清理选择、历史、缓冲货架和临时消息。
- 为流程状态和关卡边界补充纯逻辑测试。

验证：

- `npm run test:domain`：PASS，9/9。
- Cocos Creator `web-mobile` 构建：PASS，builder 日志记录完成。
- Web 运行回归：PASS，完成第 1 关后显示“下一关”，点击后进入第 2 关；console warn/error 为 0。
- 证据：`artifacts/phase4-web-initial.png`、`artifacts/phase4-web-level-complete.png`、`artifacts/phase4-web-level-2.png`、`artifacts/cocos-build-phase4.stdout.log`。

### P4-02 首页、设置与重开

状态：已完成（2026-09-17）

交付：

- 首页开始游戏入口。
- 对局设置入口、返回首页和重新开始当前关卡。
- 未完成关卡离开后再次开始时重新生成当前关卡的规则。

验证：

- `npm run test:domain`：PASS，10/10。
- 流程状态测试：PASS，覆盖初始首页、开始游戏、设置阻断输入、关闭设置、返回首页、再次开始和对局内重开。
- Cocos Creator `web-mobile` 构建：PASS，builder 日志记录完成。
- Web 竖屏运行回归：PASS，首页开始、设置面板、继续游戏、设置返回首页、再次开始和对局内重开均可见且可操作。
- 布局重生成：PASS，从首页再次开始和对局内重开后的棋盘均发生变化。
- Web 运行 console warn/error：PASS，0 条。
- 证据：`artifacts/phase4-p402-home.png`、`artifacts/phase4-p402-playing-1.png`、`artifacts/phase4-p402-settings.png`、`artifacts/phase4-p402-home-returned.png`、`artifacts/phase4-p402-playing-2.png`、`artifacts/phase4-p402-restarted.png`、`artifacts/cocos-build-phase4-p402.stdout.log`。

### P4-03 本地进度与设置存档

状态：已完成（2026-09-17）

交付：

- `SaveDataV1`、`SavePort` 和可替换的实现。
- 最高解锁关卡、选中关卡、完成关卡和音频设置的读写。
- 未知版本存档的保护和默认值处理。

验证：

- `npm run test:domain`：PASS，14/14。
- 存档编解码：PASS，覆盖缺失、合法、非法 JSON、越界值和未知版本。
- `MemorySavePort`：PASS。
- `LocalStorageSavePort`：PASS，使用注入式键值存储验证真实适配器读写。
- 控制器集成：PASS，恢复选中关卡、音频设置保存和通关进度保存。
- Web-mobile 构建：PASS，builder 日志记录完成。
- 设置音频开关：PASS，关闭并重新打开设置后状态保持。
- 真实浏览器刷新恢复：BLOCKED，当前自动化内置浏览器不提供 `localStorage`。
- 证据：`artifacts/phase4-p403-settings-before.png`、`artifacts/phase4-p403-settings-after.png`、`artifacts/phase4-p403-settings-reopened.png`、`artifacts/cocos-build-phase4-p403.stdout.log`。

### P4-04 奖励广告端口与 Mock 闭环

状态：已完成（2026-09-18）

交付：

- `RewardAdPort`、奖励原因和结果类型。
- Mock 的 `completed / skipped / unavailable / failed` 分支。
- 缓冲货架、撤回和打乱的业务奖励规则。
- 缓冲货架使用容量 1，并保留“至少一个主货架全空”和“完成主货架锁定”规则。

验证：

- `npm run test:domain`：PASS，19/19。
- Mock 覆盖 `completed / skipped / unavailable / failed`：PASS。
- 奖励结果映射：只有 `completed` 增加缓冲货架、恢复撤回历史或替换打乱棋盘；其余结果不改变业务状态。
- 广告播放期间重复操作与棋盘输入锁：PASS。
- 基础关卡无广告完成：PASS。
- Web-mobile 构建：PASS，builder 日志记录 `build Task (web-mobile) Finished`。
- Web 运行：PASS，首页可进入对局，console warn/error 为 0。
- 证据：`artifacts/p404-preview-start.png`、`artifacts/p404-preview-playing.png`、`artifacts/cocos-build-p404.stdout.log`。

### P4-04 前置规则修订

状态：已完成（2026-09-18）

交付：

- 通关新增“至少一个主货架全空”。
- 满同类主货架完成后锁定，不可再作为移动来源。
- 两个默认缓冲货架保留数量 2，容量从 2 调整为 1；后续解锁的缓冲货架同样使用容量 1。
- 生成器拒绝不兼容完成货架锁定的可解路径，并换种子重新构造。
- GDD、Product Brief、技术设计和领域测试同步更新。

验证：

- `npm run test:domain`：PASS，15/15。
- 10 个关卡各 100 个种子的生成与可解性验证：PASS。
- Web-mobile 构建：PASS，builder 日志记录 `build Task (web-mobile) Finished`。
- 构建产物运行：PASS，首页与对局画面均非空且切换后画面发生变化，console warn/error 为 0。
- 证据：`artifacts/rule-revision-preview.png`、`artifacts/rule-revision-playing.png`、`artifacts/cocos-build-rule-revision.stdout.log`。

### P4-05 功能回归与阶段出口

状态：已完成（2026-09-18）

交付：

- 覆盖首页、10 关推进、存档、广告 Mock、重开和通关的回归清单。
- Web/Cocos 可执行验证记录。
- Phase 4 完成状态、剩余风险和 Phase 5 输入清单。

验证：

- `npm run test:domain`：PASS，20/20；JSON 报告为 `artifacts/phase4-domain-regression.json`。
- 全流程回归：PASS，覆盖首页、设置、撤回、加货架、打乱、重开、10 关推进、每关存档、第 10 关边界和最终重玩。
- 真实 10 关 MVP 配置：各 100 个种子完成生成、数量约束和可解回放验证。
- 打乱防重复：PASS，候选布局与当前主货架布局相同时不会展示广告或替换棋盘。
- Web-mobile 构建：PASS，builder 日志记录 `build Task (web-mobile) Finished`。
- Web 运行：PASS，首页可进入对局，进入前后画面变化 46.12%，console warn/error 为 0。
- 关键流程无已确认的 P0/P1 缺陷。
- 证据：`artifacts/p405-preview-home.png`、`artifacts/p405-preview-playing.png`、`artifacts/cocos-build-p405.stdout.log`。

阶段出口：

- Phase 4 于 2026-09-18 退出。
- 剩余 P2：生成器的回放验证尚未证明与点击式整组移动完全等价；自动化验证的是构造式可解路径，未独立证明每个局面都存在可由当前 UI 直接执行的解法。该风险不阻塞进入 Phase 5，但必须在 Release Candidate 前关闭。
- Phase 5 输入：真实微信/抖音 `RewardAdPort`、平台存储、生命周期/系统 API 适配，以及继续隔离业务层与平台 API。
