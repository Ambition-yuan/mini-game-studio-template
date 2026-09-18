# 项目状态

> 这是项目当前阶段的唯一入口。每次完成一个阶段或发生重大决策后更新。

## 当前阶段

Phase 5 — 平台能力（2026-09-18 起）

Phase 4 已于 2026-09-18 退出。退出依据：首页、10 关推进、存档、Mock 奖励广告、撤回、打乱、重开和通关边界完成联合回归，领域测试 20/20，Web-mobile 构建与运行验证通过。

Phase 3 已于 2026-09-17 退出。退出依据：Graybox 领域层、Scene、运行时 UI、Web/微信构建、微信 DevTools 与微信 PC 端核心交互链路均已完成验证，微信 PC 端批量核心回归六项 PASS；用户指示进入 Phase 4。

Phase 0 环境确认已于 2026-09-16 验证通过。

Phase 1 产品定义已于 2026-09-16 通过，`product-brief.md` 和 `gdd.md` 已确认。

Phase 2 技术设计已于 2026-09-16 完成；纯 TypeScript 领域层已实现并通过生成与规则测试。

Phase 4 详细目标、输出、验收标准、非目标和任务拆解见 `docs/tasks/phase-4.md`。`P4-01` 至 `P4-05` 已完成；后续平台能力进入 Phase 5。

## Phase 3 Graybox 验证

| 项目 | 状态 | 已验证信息 |
|---|---|---|
| Cocos Creator 资源导入 | PASS | Cocos Creator 3.8.8 已完成资源库导入，场景与脚本可进入构建流程 |
| Web-mobile 构建 | PASS | `CocosCreator.exe --project ... --build platform=web-mobile;debug=true` 成功生成 `project/build/web-mobile` |
| 首屏渲染 | PASS | 构建产物浏览器运行后显示竖屏 Graybox，Canvas 正常渲染 |
| 核心交互 | PASS | 已验证商品选择、合法移动、撤回、加货架、打乱和重开 |
| 运行时错误 | PASS | 浏览器控制台无 error/warning |
| 第 5 关 `8 x 12` 竖屏布局 | PASS | 在 `712 x 1272` 移动端模拟视口中确认 8 个独立货架列、4 种商品、箱子和底部 4 个按钮完整显示 |
| Cocos 编辑器 GUI 人工预览 | NOT TESTED | 当前 Computer Use 仅提供浏览器控制，未直接操作原生编辑器窗口 |
| 微信小游戏 Debug 构建 | PASS | Cocos Creator 3.8.8 已生成 `project/build/wechatgame`，包含 30 个文件、5.94 MiB；9 个 JSON 可解析，关键运行脚本通过 `node --check` |
| 微信小游戏 Release 构建 | PASS | `npm run wechat:build` 使用 `debug=false`；`cocos-js/cc.js` 1.50MB，构建目录约 1.88MB，已低于 4MB 主包上限 |
| 微信 DevTools `Codex` CLI 授权 | PASS | `wechatide` skill `0.3.9`；`versionRelation=equal`、`loginExpired=false`、`tokenRequired=false` |
| 微信 DevTools 项目导入 | PASS | 正式 AppID `wx71944e18ec668436` 导入成功，项目名 `shelf-organizer` |
| 微信 DevTools 模拟器编译与启动 | PASS | `simulator_refresh` 成功；console 显示基础库 `3.17.2`、Cocos Creator `3.8.8`，成功加载 `Main.scene` |
| 微信构建 AppID 注入 | PASS | `npm run wechat:apply-appid` 读取 `project/config/wechatgame.json`；正常值与非法值校验通过 |
| 微信 DevTools 小游戏自动化 | PASS | `automation_game_action` 画布触点成功；`automation_evaluate` 成功返回 AppID、设备信息和 `sceneLoaded: true` |
| 微信 DevTools 运行时 console | FAIL | Release 构建持续捕获 `[jsbridge] invoke getSystemInfo fail: jsbridge not ready.`；错误总是位于 console 首条且堆栈完全位于 DevTools `WAGame.js`，游戏未中断 |
| 微信 DevTools 主画布截图 | PASS | `npm run wechat:capture-screenshot` 从 `GameGlobal.__gameContextWindow.screencanvas` 导出 `1170 x 2532` PNG，保存到 `artifacts/wechat-simulator-initial.png` |
| 微信 DevTools `simulator_screenshot` 工具 | BLOCKED | 持续返回 `waitForAutomatorReady timeout`；画布截图备选路径已完成，问题隔离在截图工具自身 |
| 微信 PC 端真机调试 | PASS | 2026-09-17 21:13 通过 `automation_viewport_action --action remote --auto` 发起；DevTools 完成打包上传并建立 `RemoteDebugWindow`。CLI 自身返回 `timeout waiting for automator response`，但日志与 CDP 探针确认远程运行已建立：AppID `wx71944e18ec668436`、Windows 微信 `3.9.12`、SDK `3.10.3`、`enableDebug=true`、Cocos Creator `3.8.8`、`Main` 场景加载成功 |
| 微信 PC 端真机核心交互 | PASS | 通过 CDP 触点在远程运行中依次点击 `Shelf-main-1` 和 `Shelf-main-3`；选择状态从 `main-1` 变为 `null`，消息变为“已移动商品。”，`canUndo=true`，商品从 `main-1` 移入 `main-3`。动作期间捕获 7 条 console debug，0 个 error/warning、0 条 Log error；截图保存到 `artifacts/wechat-pc-remote-after-move.png` |
| 微信 PC 端真机撤回 | PASS | 在合法移动后点击“撤回”；状态变为 `selected=null`、消息“已撤回一步。”、`canUndo=false`，商品数量恢复为 `main-1=3`、`main-3=4`，证明棋盘与历史状态正确回滚 |
| 微信 PC 端真机批量核心回归 | PASS | `npm run wechat:pc-qa` 一次完成“重开 → 加货架 → 打乱 → 合法移动 → 撤回 → console”六项检查且全部 PASS；加货架后缓冲货架为 3，打乱后保留缓冲货架且生成新可解布局，移动后 `canUndo=true`，撤回后棋盘签名恢复；清空 VConsole 后新增日志为 0 条。报告保存到 `artifacts/wechat-pc-remote-core-regression.json`，独立截图保存到 `artifacts/wechat-pc-remote-core-regression.png` |

真机执行策略自 2026-09-17 起调整为：用户独立测试，不要求回填证据；未收到失败反馈时按 `PASS（用户默认）` 处理，不阻塞阶段推进。该状态不代表 Codex 已取得可审计的真机验证证据。

验证截图保留在 `artifacts/cocos-preview-*.png`、`artifacts/web-build-*.png`、`artifacts/wechat-simulator-initial.png`、`artifacts/wechat-pc-remote-after-move.png`，构建日志保留在 `artifacts/cocos-build-*.log`。

微信构建日志保留在 `artifacts/cocos-build-wechat-first.*.log` 和 `artifacts/cocos-build-wechat-release.*.log`。Release 构建使用 `debug=false`，裁剪未使用模块，并自动注入正式 AppID；DevTools 模拟器已确认可启动和渲染。

## Phase 0 验证结果

| 项目 | 状态 | 已验证信息 |
|---|---|---|
| Cocos Creator | PASS | 3.8.8，`C:\ProgramData\cocos\editors\Creator\3.8.8\CocosCreator.exe` |
| Node.js | PASS | v20.19.0 |
| npm | PASS | 10.8.2 |
| Git | PASS | 2.47.1.windows.1 |
| VS Code | PASS | `code` 命令可用 |
| 微信开发者工具 | PASS | 2.02.2608070，安装在 `D:\Program Files (x86)\Tencent\微信web开发者工具` |
| 抖音开发者工具 | PASS | 4.5.6，安装在 `D:\Program Files (x86)\@bytedminiprogram-ide` |

说明：开发者工具已核对安装文件与版本，未执行账号登录、上传或平台配置修改。

## 已完成前置

- [x] 微信开发者账号
- [x] 微信小游戏主体
- [x] 抖音开发者账号
- [x] 抖音小游戏主体
- [x] Cocos Creator
- [x] Node.js
- [x] Git
- [x] VS Code
- [x] 微信开发者工具
- [x] 抖音开发者工具
- [x] GitHub 仓库

## 当前待办

- [x] Phase 0 环境确认
- [x] 与 Codex 讨论第一款游戏方向
- [x] 确认 GDD v1
- [x] 完成技术设计
- [x] 做 Graybox 原型（领域层、Scene、运行时 UI、Web 构建和核心交互已验证）
- [x] Phase 4 正式内容开发
- [x] P4-01 关卡推进与通关状态闭环
- [x] P4-02 首页、设置与重开
- [x] P4-03 本地进度与设置存档
- [x] P4-04 奖励广告端口与 Mock 闭环
- [x] P4-05 功能回归与阶段出口
- [ ] Phase 5 平台能力

## 已知产品想法

- 项目名称：货架整理达人。
- 已确认方向：超市货架整理。
- 体验定位：轻解谜加解压，不使用强制倒计时。

## 最近决策

- 2026-09-16：Phase 0 环境确认通过，进入 Phase 1 产品定义与玩法讨论。
- 2026-09-16：第一款游戏确定采用“轻解谜加解压”方向，不使用强制倒计时。
- 2026-09-16：确认通关条件为“每个货架为空或同类”，箱子由关卡内已有商品覆盖生成，广告解锁和重开流程采用推荐方案。
- 2026-09-16：确认一箱对应一个原有商品；商品只能移动到空货架或顶部同类商品之上。
- 2026-09-16：首版第 1 至 4 关采用 4 x 6、6 x 8、6 x 10、8 x 10 渐进教学且不设置箱子；第 5 关起使用 8 x 12、固定 4 种商品和 12、24、24、24 的数量分布。
- 2026-09-16：第 5 至 10 关箱子数量确定为 2、6、10、16、20、24。
- 2026-09-16：确定竖屏为主；8 x 12 关卡使用 8 列 x 12 行布局，每个货架对应一列。
- 2026-09-16：确认目标用户为愿意投入 3 至 8 分钟、喜欢整理、开箱和轻度思考的泛休闲玩家。
- 2026-09-16：确定项目名称为《货架整理达人》。
- 2026-09-16：首版 Must Have、Nice to Have 和 Out of Scope 已确认，Phase 1 通过并进入 Phase 2 技术设计。
- 2026-09-16：Phase 2 技术设计草案已建立，覆盖领域模型、构造式关卡生成、可解性回放、撤回、打乱、UI 和平台接口。
- 2026-09-16：确认点击式移动、打乱生成全新可解布局；缓冲货架最多 8 个，第 3 至 8 个每次解锁完成一次激励视频，广告时长由平台决定。
- 2026-09-16：Phase 2 完成；已初始化 Cocos Creator 3.8.8 工程并实现纯 TypeScript 领域层，进入 Phase 3。
- 2026-09-16：领域测试通过，覆盖 10 个关卡各 100 个种子，共 1000 个生成局面。
- 2026-09-16：生成器压力验证通过，10 个关卡各 500 个种子，共 5000 个局面全部可解。
- 2026-09-16：实现 GameFlowController、Main.scene 和运行时 Graybox UI；领域与 UI 类型检查通过，等待 Cocos 编辑器人工预览。
- 2026-09-16：Cocos Creator 3.8.8 Web-mobile 构建通过；浏览器运行验证首屏、商品移动、撤回、加货架、打乱和重开，控制台无错误或警告。
- 2026-09-16：第 5 关 `8 x 12` 在 `712 x 1272` 移动端模拟视口中通过布局验证；临时验证代码已还原并重新构建最终产物。
- 2026-09-17：完成 `Codex` CLI 授权与微信 DevTools 项目导入；构建产物 AppID 修正为 `wx71944e18ec668436`。
- 2026-09-17：微信模拟器编译与启动通过，console 确认基础库 `3.17.2`、Cocos Creator `3.8.8` 和 `Main.scene` 加载成功。
- 2026-09-17：增加可重复的微信构建 AppID 注入脚本；小游戏画布触点与运行时表达式自动化通过。
- 2026-09-17：固化 `npm run wechat:capture-screenshot` 截图备选路径，导出 `1170 x 2532` PNG；`simulator_screenshot` 工具自身仍为 BLOCKED。
- 2026-09-17：尝试异步 `getSystemInfo` 与下一帧启动门禁，console 的 `jsbridge not ready` 错误不变；堆栈完全位于 DevTools `WAGame.js`，确认不是当前业务代码分支，已回退实验补丁。
- 2026-09-17：裁剪未使用引擎模块并完成 Release 构建；`cc.js` 降至 1.50MB，整包约 1.88MB，真机上传体积阻塞已解除。
- 2026-09-17：当前 Release 包完成微信 PC 端真机调试；确认正式 AppID、Windows 微信运行时、Debug 开启和 `Main` 场景加载。
- 2026-09-17：微信 PC 端真机完成一次真实触点核心移动；选择、合法移动、状态更新与撤回历史均通过，console 无新增 error/warning。
- 2026-09-17：微信 PC 端真机撤回通过，棋盘和历史状态正确回滚；持续 console 采集受远程 WebSocket 中断限制，单独记为 BLOCKED。
- 2026-09-17：新增 `npm run wechat:pc-qa` 批量回归脚本，一次覆盖 PC 端真机重开、加货架、打乱、合法移动、撤回和 console，六项全部 PASS。
- 2026-09-17：明确测试责任边界；从本日起真机测试由用户执行，Codex 不主动发起、控制或代替真机测试，只负责构建、自动化检查、测试说明和证据模板。
- 2026-09-17：确认后续真机项由用户独立测试且不要求回填；未收到失败反馈时按 `PASS（用户默认）` 处理，不再作为阶段推进阻塞。
- 2026-09-17：Phase 3 退出，进入 Phase 4 正式内容开发；首项任务确定为关卡推进与通关状态闭环。
- 2026-09-17：P4-01 完成；流程显式区分 `home / playing / levelComplete`，通关后可进入下一关并处理第 10 关边界。领域测试 9/9 通过，Web-mobile 构建与第 1 关到第 2 关运行回归通过。
- 2026-09-17：P4-02 完成；游戏默认进入首页，对局内可打开设置、继续游戏或返回首页，从首页再次开始和对局内重开都会重新生成当前关卡。领域测试 10/10、Web-mobile 构建和竖屏运行回归通过。
- 2026-09-17：P4-03 完成；新增 `SaveDataV1`、存档校验、`SavePort`、内存存储、本地存储适配器和设置音频开关。领域测试 14/14，Web-mobile 构建和设置开关运行回归通过。
- 2026-09-18：P4-04 前完成规则修订：通关必须有至少一个全空主货架；满同类主货架完成后不可操作；两个默认缓冲货架保留数量 2、容量调整为 1。领域层、生成器、运行时交互、测试和事实文档已同步；`npm run test:domain` 15/15，10 关各 100 个种子验证通过，Web-mobile 构建和构建产物运行验证通过。
- 2026-09-18：P4-04 完成；新增 `RewardAdPort` 和 `MockRewardAdPort`，缓冲货架、撤回和打乱均由广告结果驱动，只有 `completed` 发奖，`skipped / unavailable / failed` 不改变业务状态；加入广告期间输入锁和重复领奖保护。领域测试 19/19，Web-mobile 构建和运行验证通过。
- 2026-09-18：P4-05 完成；新增贯穿首页、设置、撤回、加货架、打乱、重开、10 关推进、每关存档和最终重玩的联合回归，领域测试 20/20，报告写入 `artifacts/phase4-domain-regression.json`；修复打乱可能重复当前布局的问题。Phase 4 退出，进入 Phase 5。

## 风险

- 真机测试由用户独立完成且默认通过，不要求回填证据；因此项目无法保留完整的移动端/抖音真机审计链，发布决策依赖用户接受该风险及后续失败反馈。
- 平台最新审核/资质要求需要在进入发布阶段时重新核验官方文档。
- 微信 DevTools 的 CLI 授权、项目导入、模拟器启动、画布自动化和 PC 端真机链路已验证；移动端 Android/iPhone 真机与抖音链路按 `PASS（用户默认）` 处理，原生 GUI 菜单人工预览仍待验证。
- 激励视频的加载、完成、跳过和失败回调仍需在微信与抖音平台分别验证。
- Cocos Creator 编辑器 GUI 未由当前 Computer Use 原生控制；已用 CLI 构建和浏览器运行替代验证，但原生编辑器人工预览仍为 NOT TESTED。
- Web-mobile 和微信小游戏构建已验证；微信 DevTools 导入、编译、模拟器启动、画布自动化、PC 端真机调试和截图证据已验证；官方截图工具仍不可用，移动端真机和抖音平台运行由用户独立测试并默认通过。
- 原 Debug 构建目录为 5.94MB；Release 构建已降至约 1.88MB，当前无需仅因引擎体积做分包，但正式上传前仍需核对平台实际压缩体积。
- Cocos 微信构建启动器会返回非零退出码 `36`；`npm run wechat:build` 仅在 builder 日志确认生成完成时继续，底层启动器行为仍需后续处理。
- `npm run wechat:build` 已串入 Release 构建和 AppID 注入；CI 自动构建尚未接入。
- 微信 DevTools 的画布自动化和运行时表达式可用，且已有可重复的主画布截图脚本；但 `simulator_screenshot` 的 `waitForAutomatorReady` 路径持续超时，后续应优先修复或升级该工具。
- 微信 PC 端真机调试的 CLI 入口返回 `timeout waiting for automator response`，但 DevTools 日志和 CDP 探针证明远程运行已建立；后续需确认该超时是否可在 `wechatide` 或项目脚本层可靠归类为成功。
- 微信 PC 端真机批量回归的核心检查稳定通过；脚本内的截图动作在长会话末尾仍可能遇到 `WebSocket Aborted`，需通过独立短连接补截图，不影响功能测试结论。
- 微信 DevTools console 存在一条 `jsbridge not ready` 启动错误，虽未阻止场景加载，但错误发生在业务代码之前且无法通过启动门禁消除；后续应通过升级/修复 DevTools 或基础库版本处理，并在移动端真机确认是否复现。
- 生成器仍需在后续预生成关卡池流程中记录失败率和真实设备耗时。
- 生成器的可解回放尚未证明与点击式整组移动完全等价，当前无法排除个别局面只存在“拆分到指定数量”的构造解、但缺少当前 UI 可直接执行路径的风险；列为 P2，必须在 Release Candidate 前增加独立可执行求解或等价验证。
- `8 x 12` 已通过移动端模拟布局验证；触控精度、单格可读性和认知负荷由用户自行在移动端测试，按默认通过处理且不阻塞阶段，但项目不保留对应审计证据。
- 第 10 关箱子占比约 28.6%，可能显著降低可用操作数，必须通过批量生成验证可解率。
- Cocos CLI 构建参数会提示布尔值与压缩类型校验警告，并使用默认值；正式接入自动构建前应修正参数类型。
- 当前 Codex 内置浏览器不提供 `localStorage`，因此无法在自动化浏览器中证明刷新后的持久恢复；`LocalStorageSavePort` 已用注入存储测试，仍需在普通浏览器或 Phase 5 平台存储适配器中验证真实持久化。
