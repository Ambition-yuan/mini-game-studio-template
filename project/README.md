# Project Notes

## 环境

- Cocos Creator 3.8.8，基于官方 `empty-2d` 模板初始化。
- TypeScript 领域层不依赖 Cocos API，可以在 Node.js 中独立编译和测试。

## 领域测试

在 `project/` 目录执行：

```powershell
npm run test:domain
```

测试入口会优先使用本地 `typescript`，否则回退到 Cocos Creator 3.8.8 自带的 TypeScript 5.8.2。

当前测试覆盖：

- 配置合法性。
- 顶部连续同类商品识别。
- 同类目标或空货架移动。
- 空位不足时的拆分填满。
- 箱子只能从顶部打开且不能移动。
- 通关判断。
- 满同类主货架锁定与至少一个全空主货架的通关条件。
- 奖励广告 `completed / skipped / unavailable / failed` 结果映射。
- 广告播放期间的输入锁与重复领奖保护。
- 基础关卡无广告完成路径。
- 首页、设置、广告、重开、10 关推进、每关存档和第 10 关边界的联合回归。
- 10 个 MVP 关卡各 100 个随机种子，共 1000 个生成局面的可解回放。

测试结束时会在仓库 `artifacts/phase4-domain-regression.json` 写入结构化结果。

额外压力验证：10 个关卡各 500 个种子，共 5000 个局面全部通过，耗时约 10 秒。

## 手动 Graybox 验证

1. 使用 Cocos Dashboard 打开 `D:\work\mini-game-studio-template\project`。
2. 确认 Creator 版本为 3.8.8，等待首次资源导入完成。
3. 打开 `assets/scenes/Main.scene`。
4. 点击编辑器预览，选择浏览器预览。
5. 预期看到竖屏 Graybox：标题、货架商品、缓冲货架和底部四个按钮。
6. 点击货架应能选择/取消顶部连续商品组，点击合法目标货架应移动商品；点击顶部箱子应拆箱。
7. “加货架”“撤回”“打乱”通过 `RewardAdPort` 调用 `MockRewardAdPort`，默认返回 `completed`；“重开”不消耗广告。

如果 `GameBootstrap` 显示 Missing Script，请保留编辑器生成的 `.meta` 文件，并把 Console 报错和 Scene 截图反馈给 Codex。

Prefab 和正式视觉资源尚未创建。

## 微信小游戏构建元数据

在 `project/` 目录执行完整的微信 Release 构建：

```powershell
npm run wechat:build
```

该命令使用 `debug=false`，执行微信小游戏构建，并自动注入正式 AppID。构建日志写入 `artifacts/cocos-build-wechat-release.*.log`。

如果只需要修正已有构建产物的 AppID，可执行：

```powershell
npm run wechat:apply-appid
```

脚本会读取 `config/wechatgame.json`，并修正 `build/wechatgame/project.config.json`。如需临时覆盖 AppID，可设置环境变量 `WECHAT_APP_ID`。

如果微信开发者工具的 `simulator_screenshot` 工具不可用，可在项目窗口和模拟器已运行时执行：

```powershell
npm run wechat:capture-screenshot
```

该命令通过已注册的运行时自动化导出主画布，并写入 `artifacts/wechat-simulator-initial.png`。

## 微信 PC 端真机批量回归（由用户执行）

本流程属于用户真机测试。用户在微信开发者工具中连接 PC 端真机调试后，在 `project/` 目录执行：

```powershell
npm run wechat:pc-qa
```

脚本通过远程调试端口一次完成：重开、加货架、打乱、合法移动、撤回和 VConsole 检查，并将状态报告写入 `artifacts/wechat-pc-remote-core-regression.json`。脚本内截图可能因远程长连接回收而标记为 `BLOCKED`；此时可用独立短连接补拍 `artifacts/wechat-pc-remote-core-regression.png`，不影响核心功能回归结论。

Codex 只维护脚本和测试步骤，不主动连接、发起或代替用户执行真机测试，也不要求用户回填结果；未收到失败反馈时按 `PASS（用户默认）` 处理。
