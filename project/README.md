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
- 10 个 MVP 关卡各 100 个随机种子，共 1000 个生成局面的可解回放。

额外压力验证：10 个关卡各 500 个种子，共 5000 个局面全部通过，耗时约 10 秒。

## 手动 Graybox 验证

1. 使用 Cocos Dashboard 打开 `D:\work\mini-game-studio-template\project`。
2. 确认 Creator 版本为 3.8.8，等待首次资源导入完成。
3. 打开 `assets/scenes/Main.scene`。
4. 点击编辑器预览，选择浏览器预览。
5. 预期看到竖屏 Graybox：标题、货架商品、缓冲货架和底部四个按钮。
6. 点击货架应能选择/取消顶部连续商品组，点击合法目标货架应移动商品；点击顶部箱子应拆箱。
7. “加货架”“撤回”“打乱”“重开”当前使用直接调用的 Mock，不调用真实广告。

如果 `GameBootstrap` 显示 Missing Script，请保留编辑器生成的 `.meta` 文件，并把 Console 报错和 Scene 截图反馈给 Codex。

Prefab 和正式视觉资源尚未创建。
