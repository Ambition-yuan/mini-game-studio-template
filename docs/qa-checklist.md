# QA Checklist

状态值：PASS / FAIL / BLOCKED / NOT TESTED / PASS（用户默认）

> 真机执行策略（2026-09-17 起）：微信/抖音 PC 端运行、Android/iPhone 真机和设备级测试由用户独立完成。Codex 不主动发起、控制或代替真机测试，也不要求用户回填证据或反复确认。未收到失败反馈时，真机项按 `PASS（用户默认）` 处理，不阻塞阶段推进；用户报告失败时改为 `FAIL` 或 `BLOCKED`。

`PASS（用户默认）` 是用户自行测试并接受风险的工作状态，不代表 Codex 已验证真机或拥有可审计证据。已有 PC 端记录保留为历史证据。

## Graybox 原型（Cocos Web）

- Cocos Creator 3.8.8 资源导入：PASS
- Web-mobile 构建：PASS
- 首屏渲染：PASS
- 商品选择：PASS
- 合法移动：PASS
- 撤回：PASS
- 加货架：PASS
- 打乱：PASS
- 重开：PASS
- 运行时控制台错误/警告：PASS
- 第 5 关 `8 x 12` 移动端模拟布局：PASS，使用 `712 x 1272` 逻辑视口
- Cocos 编辑器 GUI 人工预览：NOT TESTED
- 微信小游戏构建：PASS，产物位于 `project/build/wechatgame`，正式 AppID 为 `wx71944e18ec668436`
- 微信小游戏 Release 构建：PASS，`debug=false`，`cocos-js/cc.js` 1.50MB，构建目录约 1.88MB
- 微信构建 AppID 注入脚本：PASS，`npm run wechat:apply-appid` 返回正确 AppID，非法值会被拒绝
- 微信构建产物 JSON 解析：PASS，9 个 JSON 文件
- 微信构建关键脚本语法：PASS，`game.js`、`application.js`、`engine-adapter.js`、主 bundle
- 微信 DevTools `Codex` CLI 授权：PASS，`versionRelation=equal`、`loginExpired=false`、`tokenRequired=false`
- 微信 DevTools 项目导入：PASS，已导入 `project/build/wechatgame`，项目名 `shelf-organizer`
- 微信 DevTools 模拟器编译/启动：PASS，基础库 `3.17.2`、Cocos Creator `3.8.8`，成功加载 `Main.scene`
- 微信 DevTools 小游戏自动化：PASS，画布触点执行成功，`wx.getSystemInfoSync()` 返回正确 AppID 和设备信息
- 微信 DevTools 运行时 console：FAIL，存在 `[jsbridge] invoke getSystemInfo fail: jsbridge not ready.`；错误位于 DevTools `WAGame.js` 启动运行时，游戏仍继续启动
- 微信 DevTools 主画布截图：PASS，`npm run wechat:capture-screenshot` 导出 `1170 x 2532` PNG，保存到 `artifacts/wechat-simulator-initial.png`
- 微信 DevTools `simulator_screenshot` 工具：BLOCKED，持续返回 `waitForAutomatorReady timeout`
- 微信 DevTools：FAIL，导入、编译、启动、自动化和截图证据通过；console 有一条启动错误，截图工具路径不可用
- 微信 PC 端真机调试：PASS，Release 包上传并建立 `RemoteDebugWindow`；CDP 确认 AppID `wx71944e18ec668436`、Windows 微信 `3.9.12`、SDK `3.10.3`、`enableDebug=true`、Cocos `3.8.8`、`Main` 场景加载
- 微信 PC 端真机调试 CLI 返回：FAIL，`automation_viewport_action --action remote --auto` 返回 `timeout waiting for automator response`；DevTools 日志和调试端口仍证明远程运行已建立
- 微信 PC 端真机核心交互：PASS，CDP 触点选择 `Shelf-main-1`、移动到 `Shelf-main-3`；消息变为“已移动商品。”，`canUndo=true`，截图保存到 `artifacts/wechat-pc-remote-after-move.png`
- 微信 PC 端真机 console：PASS，本次核心交互捕获 7 条 debug、0 个 error/warning、0 条 Log error
- 微信 PC 端真机撤回：PASS，棋盘恢复为 `main-1=3`、`main-3=4`，选择清空，消息“已撤回一步。”，`canUndo=false`
- 微信 PC 端真机批量核心回归：PASS，`npm run wechat:pc-qa` 一次完成重开、加货架、打乱、合法移动、撤回；报告保存到 `artifacts/wechat-pc-remote-core-regression.json`
- 微信 PC 端真机批量 console：PASS，清空 VConsole 后执行完整核心回归，新增日志 0 条、问题 0 条
- 微信 PC 端真机批量截图：BLOCKED，脚本内长会话截图被远程端回收；独立短连接截图已成功保存到 `artifacts/wechat-pc-remote-core-regression.png`
- 微信移动端真机：PASS（用户默认），由用户独立测试；PC 端验证不覆盖 Android/iPhone 触控、性能和生命周期
- 抖音 DevTools：NOT TESTED
- 抖音真机：PASS（用户默认），由用户独立测试

## Phase 4 正式内容

- 流程状态与下一关领域测试：PASS，`npm run test:domain` 9/9
- `home / playing / levelComplete` 状态边界：PASS
- 最后一关边界：PASS，停留在已完成状态且不重新生成棋盘
- Web-mobile 构建：PASS，Cocos builder 完成 `web-mobile` 任务
- Web 运行：第 1 关通关后显示“下一关”：PASS
- Web 运行：点击“下一关”进入第 2 关并隐藏该按钮：PASS
- Web 运行 console warn/error：PASS，0 条
- P4-01 截图证据：`artifacts/phase4-web-initial.png`、`artifacts/phase4-web-level-complete.png`、`artifacts/phase4-web-level-2.png`
- P4-02 流程测试：PASS，10/10
- 初始首页与开始游戏：PASS
- 设置面板阻断棋盘输入：PASS
- 设置继续游戏：PASS
- 设置返回首页：PASS
- 首页再次开始重新生成未完成关卡：PASS
- 对局内重开重新生成当前关卡：PASS
- P4-02 Web-mobile 构建：PASS
- P4-02 Web 运行 console warn/error：PASS，0 条
- P4-02 截图证据：`artifacts/phase4-p402-home.png`、`artifacts/phase4-p402-playing-1.png`、`artifacts/phase4-p402-settings.png`、`artifacts/phase4-p402-home-returned.png`、`artifacts/phase4-p402-playing-2.png`、`artifacts/phase4-p402-restarted.png`
- P4-03 存档编解码与版本保护测试：PASS
- P4-03 内存存档端口测试：PASS
- P4-03 本地存储适配器注入测试：PASS
- P4-03 控制器进度与设置保存测试：PASS
- P4-03 音频设置开关运行回归：PASS
- P4-03 Web-mobile 构建：PASS
- P4-03 自动化浏览器刷新持久恢复：BLOCKED，内置浏览器不提供 `localStorage`
- P4-03 截图证据：`artifacts/phase4-p403-settings-before.png`、`artifacts/phase4-p403-settings-after.png`、`artifacts/phase4-p403-settings-reopened.png`
- P4-04 前置规则领域测试：PASS，`npm run test:domain` 15/15
- 通关必须有至少一个全空主货架：PASS
- 满同类主货架锁定与部分同类货架可移动：PASS
- 默认及解锁后的缓冲货架容量为 1：PASS
- 规则修订后 10 关各 100 个种子的生成与可解性验证：PASS
- 规则修订 Web-mobile 构建：PASS，builder 完成 `web-mobile` 任务
- 规则修订构建运行：PASS，首页与对局画面非空且切换后发生变化，console warn/error 为 0
- 规则修订截图证据：`artifacts/rule-revision-preview.png`、`artifacts/rule-revision-playing.png`
- P4-04 奖励广告与业务规则领域测试：PASS，`npm run test:domain` 19/19
- Mock 广告四结果：PASS，覆盖 `completed / skipped / unavailable / failed`
- 奖励结果映射：PASS，仅 `completed` 发放缓冲货架、撤回和打乱奖励
- 缓冲货架奖励上限：PASS，最多 8 个且达到上限后不再请求广告
- 广告输入锁与重复领奖保护：PASS
- 基础关卡无广告完成：PASS
- P4-04 Web-mobile 构建：PASS，builder 完成 `web-mobile` 任务
- P4-04 Web 运行：PASS，首页可进入对局，console warn/error 为 0
- P4-04 截图证据：`artifacts/p404-preview-start.png`、`artifacts/p404-preview-playing.png`
- P4-05 领域回归：PASS，`npm run test:domain` 20/20，UI TypeScript 检查 PASS
- P4-05 全流程回归：PASS，首页、设置、撤回、加货架、打乱、重开和 10 关推进均通过
- P4-05 每关存档：PASS，每关完成后 `completedLevels` 和最高解锁关卡正确更新
- P4-05 第 10 关边界：PASS，完成后保持通关状态且不重新生成棋盘
- P4-05 打乱布局变化：PASS，极小关卡也会预检候选布局并在找不到不同布局时拒绝发奖
- P4-05 真实 MVP 配置生成：PASS，10 关各 100 个种子的数量约束和可解回放通过
- P4-05 Web-mobile 构建：PASS，builder 完成 `web-mobile` 任务
- P4-05 Web 运行：PASS，首页进入对局后画面变化 46.12%，console warn/error 为 0
- P4-05 领域报告：`artifacts/phase4-domain-regression.json`
- P4-05 截图证据：`artifacts/p405-preview-home.png`、`artifacts/p405-preview-playing.png`
- 生成器回放与点击整组移动等价性：BLOCKED，P2，需在 Release Candidate 前增加独立可执行路径求解或等价验证

## 启动
- 首次启动
- 二次启动
- 升级后启动
- 冷启动资源加载

## 核心流程
- 新手引导
- 开始：微信 PC 端真机 PASS
- 暂停/继续
- 核心玩法：Web PASS；微信 PC 端真机批量核心回归 PASS
- 成功
- 失败
- 重试

## 数据
- 存档写入
- 存档读取
- 异常退出恢复

## 广告
- Mock 加载成功/失败/不可用：PASS
- Mock 用户取消与未完整观看：PASS，统一按未发奖处理
- Mock 完整观看并领奖：PASS
- 重复领奖保护与播放期间输入锁：PASS
- 微信真实激励视频：NOT TESTED，Phase 5 接入后验证
- 抖音真实激励视频：NOT TESTED，Phase 5 接入后验证

## 生命周期
- 切后台
- 回前台
- 网络断开/恢复
- 设备锁屏/解锁（适用时）

## 平台
- 微信 DevTools
- 微信 PC 端真机：PASS（历史记录；后续回归由用户执行）
- 微信 Android 真机：PASS（用户默认）
- 微信 iPhone 真机：PASS（用户默认）
- 抖音 DevTools
- 抖音 Android 真机：PASS（用户默认）
- 抖音 iPhone 真机：PASS（用户默认；若支持/可测）

## 性能
- 低性能设备：PASS（用户默认）
- 长时间运行：PASS（用户默认）
- 内存峰值：PASS（用户默认）
- 首屏时间：PASS（用户默认）
- 卡顿/掉帧：PASS（用户默认）

## 发布前规则
任何 P0/P1 缺陷未关闭时，不应进入 Release Candidate。
