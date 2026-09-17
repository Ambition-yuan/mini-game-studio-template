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
- 加载成功
- 加载失败
- 用户取消
- 未完整观看
- 完整观看并领奖
- 重复领奖保护

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
