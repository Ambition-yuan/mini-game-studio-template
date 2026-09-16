# QA Checklist

状态值：PASS / FAIL / BLOCKED / NOT TESTED

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
- 微信 DevTools：NOT TESTED
- 抖音 DevTools：NOT TESTED
- 微信/抖音真机：NOT TESTED

## 启动
- 首次启动
- 二次启动
- 升级后启动
- 冷启动资源加载

## 核心流程
- 新手引导
- 开始
- 暂停/继续
- 核心玩法
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
- 微信 Android 真机
- 微信 iPhone 真机
- 抖音 DevTools
- 抖音 Android 真机
- 抖音 iPhone 真机（若支持/可测）

## 性能
- 低性能设备
- 长时间运行
- 内存峰值
- 首屏时间
- 卡顿/掉帧

## 发布前规则
任何 P0/P1 缺陷未关闭时，不应进入 Release Candidate。
