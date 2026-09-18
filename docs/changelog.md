# Changelog

## Unreleased

- 初始化 Codex 小游戏工作室生产骨架。
- 生成首个微信小游戏 Debug 构建，并完成构建产物的 JSON 与关键脚本静态校验。
- 完成微信开发者工具 `Codex` CLI 授权与项目导入，将构建产物 AppID 修正为 `wx71944e18ec668436`。
- 微信模拟器编译通过，基础库 `3.17.2`、Cocos Creator `3.8.8`，成功加载 `Main.scene`。
- 增加 `npm run wechat:apply-appid`，可从 `project/config/wechatgame.json` 可重复注入正式 AppID。
- 小游戏画布触点与运行时表达式自动化通过；`simulator_screenshot` 工具仍返回 `waitForAutomatorReady timeout`。
- 增加 `npm run wechat:capture-screenshot`，使用运行时主画布导出 `1170 x 2532` PNG 到 `artifacts/wechat-simulator-initial.png`。
- console 捕获到一条 `jsbridge not ready` 启动错误。
- 尝试异步 `getSystemInfo` 和下一帧启动门禁，错误不变；确认堆栈来自 DevTools `WAGame.js` 初始化运行时，未保留项目侧补丁。
- 裁剪未使用的音频、Spine、DragonBones、粒子、物理、TiledMap、Video、WebView、WebGL2 模块，并新增 `npm run wechat:build` Release 一键构建。
- Release 构建将 `cocos-js/cc.js` 降至 1.50MB，微信构建目录降至约 1.88MB，低于 4MB 主包上限。
- 当前 Release 包完成微信 PC 端真机调试：正式 AppID、Windows 微信运行时、`enableDebug=true`、Cocos `3.8.8` 与 `Main` 场景加载均通过 CDP 探针确认；CLI 的 `automator` 响应超时待后续处理。
- 微信 PC 端真机完成一次真实触点合法移动，选择/移动状态与撤回历史正确；动作期间 console 无新增 error/warning，截图保存为 `artifacts/wechat-pc-remote-after-move.png`。
- 微信 PC 端真机撤回通过，棋盘与历史状态正确恢复；撤回 console 的持续采集因远程 WebSocket 中断记为 BLOCKED，VConsole 中的 `Error 3804` 已确认来自 QA 探针而非产品代码。
- 新增 `npm run wechat:pc-qa` 批量回归脚本，一次覆盖微信 PC 端真机重开、加货架、打乱、合法移动、撤回和 console；六项全部通过，报告写入 `artifacts/wechat-pc-remote-core-regression.json`。
- 明确真机测试责任边界：从 2026-09-17 起真机测试由用户执行并回填，Codex 不主动发起、控制或代替真机测试。
- 调整真机验收策略：用户独立测试且不要求回填，未收到失败反馈时按 `PASS（用户默认）` 处理，不阻塞阶段推进。
- 进入 Phase 4 正式内容开发；完成 `P4-01` 流程状态、通关、下一关和第 10 关边界，补领域测试并完成 Web-mobile 运行回归。
- 完成 `P4-02` 首页、对局设置、继续游戏、返回首页和对局内重开；从首页再次开始与重开会重新生成当前关卡。
- 完成 `P4-03` 版本化本地存档、进度保存、设置音频开关、内存与本地存储端口；自动化浏览器不支持 `localStorage` 的限制已记录。
- 修订核心规则：通关必须有至少一个全空主货架；满同类主货架完成后不可操作；两个默认缓冲货架容量调整为 1。
- 完成 `P4-04` 奖励广告端口与 Mock 闭环；缓冲货架、撤回和打乱只在广告返回 `completed` 时发奖，并加入播放期间输入锁与重复领奖保护。
- 完成 `P4-05` Phase 4 全流程回归与阶段出口；新增 10 关推进、存档、Mock 广告与重开联合回归，修复打乱可能重复当前布局的问题，并记录生成器回放与点击整组移动等价的 P2 验证缺口。
