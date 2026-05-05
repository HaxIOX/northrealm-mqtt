# 修复报告：协议/端口不匹配问题

## 问题描述

Web 端应用 (https://nrmqtt.haxio.de/) 显示以下错误：

```
ERROR: 你正在用 ws/wss 连接 1883/8883（这是 MQTT TCP/TLS 端口，不是 WebSocket 端口）。
浏览器请改用 8083/8084 + /mqtt，或使用桌面版的 mqtt/mqtts。
```

## 根本原因

用户保存的配置中存在**协议与端口不匹配**的问题：
- 使用 `wss://` (WebSocket Secure) 协议
- 连接到 `8883` 端口（这是 MQTT TLS 端口，不是 WebSocket 端口）

### 端口说明

| 协议 | 正确端口 | 说明 |
|------|---------|------|
| `ws://` | 8083 | WebSocket 未加密 |
| `wss://` | 8084 | WebSocket SSL 加密 |
| `mqtt://` | 1883 | MQTT TCP（仅桌面版支持） |
| `mqtts://` | 8883 | MQTT TLS（仅桌面版支持） |

## 解决方案

### 1. 自动修正功能

添加了 `validateAndFixConfig()` 函数，在以下场景自动修正配置：

#### 场景 A：WebSocket 协议 + MQTT TCP 端口
- **浏览器环境**：自动切换到正确的 WebSocket 端口
  - `wss://host:8883` → `wss://host:8084`
  - `ws://host:1883` → `ws://host:8083`
- **桌面环境**：自动切换到 MQTT TCP 协议
  - `wss://host:8883` → `mqtts://host:8883`
  - `ws://host:1883` → `mqtt://host:1883`

#### 场景 B：MQTT TCP 协议 + WebSocket 端口
- **浏览器环境**：自动切换到 WebSocket 协议
  - `mqtt://host:8083` → `ws://host:8083`
  - `mqtts://host:8084` → `wss://host:8084`
- **桌面环境**：自动切换到正确的 MQTT TCP 端口
  - `mqtt://host:8084` → `mqtt://host:1883`
  - `mqtts://host:8083` → `mqtts://host:8883`

### 2. 应用位置

自动修正功能在以下三个位置生效：

1. **加载配置时** (`handleLoadConfig`)
   - 用户从下拉菜单选择保存的配置时
   - 显示系统日志提示用户配置已被修正

2. **从 localStorage 加载时** (应用启动)
   - 应用启动时自动验证并修正所有保存的配置
   - 自动更新 localStorage 中的配置

3. **从云同步加载时** (`applyPayload`)
   - 从 Firebase 云同步加载配置时
   - 自动验证并修正后保存到 localStorage

### 3. 用户提示

当配置被自动修正时，会在日志中显示：
```
⚠️ 已自动修正协议：wss://8883 → wss://8084
提示：浏览器不支持 MQTT TCP 端口 (1883/8883)，已改用 WebSocket 端口
```

或：
```
⚠️ 已自动修正端口：wss://8883 → wss://8084
```

## 修改的文件

- `src/App.jsx`
  - 添加 `validateAndFixConfig()` 函数 (第 737-779 行)
  - 修改 `handleLoadConfig()` 函数 (第 938-980 行)
  - 修改 localStorage 加载逻辑 (第 503-520 行)
  - 修改云同步加载逻辑 (第 548-566 行)

## 测试建议

### 对于当前部署的 Web 应用

1. **清除浏览器缓存和 localStorage**
   - 打开浏览器开发者工具 (F12)
   - Application → Local Storage → 删除所有 `mqtt_*` 键
   - 刷新页面

2. **重新部署修复后的版本**
   ```bash
   npm run build
   # 将 dist/ 目录部署到服务器
   ```

3. **验证修复**
   - 访问 https://nrmqtt.haxio.de/
   - 检查默认配置是否为 `wss://broker.emqx.io:8084/mqtt`
   - 尝试连接，应该不再显示错误

### 对于已有错误配置的用户

用户只需：
1. 刷新页面（加载新版本）
2. 重新选择保存的配置
3. 系统会自动修正并显示提示信息

## 预防措施

建议添加以下功能（可选）：

1. **配置保存时验证**
   - 在 `handleSaveConfig()` 中添加验证
   - 阻止保存不匹配的配置

2. **UI 提示**
   - 当用户选择 `wss://` 时，自动建议端口 8084
   - 当用户选择 `mqtt://` 时，检查是否为桌面环境

3. **预设服务器模板**
   - 提供正确的预设配置模板
   - 避免用户手动输入错误配置

## 总结

此修复确保了：
- ✅ 自动检测并修正协议/端口不匹配
- ✅ 在多个加载点应用验证逻辑
- ✅ 向用户提供清晰的修正提示
- ✅ 兼容浏览器和桌面环境
- ✅ 不影响现有正确的配置

用户无需手动操作，系统会自动修正错误配置。
