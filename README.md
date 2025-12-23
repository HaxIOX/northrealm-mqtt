# MQTT Pro

一款现代化的 MQTT WebSocket 调试工具，支持云同步、主题切换、消息模板等高级功能。

## 桌面版（Windows）与 1883/8883 支持

本项目同时支持：
- **Web 版（浏览器）**：仅支持 `ws://` / `wss://`（WebSocket）连接 MQTT Broker
- **桌面版（Electron/Windows）**：在保留 `ws/wss` 的同时，新增支持 `mqtt://`（1883）与 `mqtts://`（8883）直连

原因说明：浏览器环境无法直接建立 TCP Socket，因此 **无法直连 1883/8883**；要么使用 Broker 提供的 WebSocket 端口（如 8083/8084），要么使用桌面端（Node 能力）。

### 桌面端是如何实现 1883 的
- Electron 主进程创建窗口时指定 `preload` 脚本（`electron/preload.cjs`）。
- `preload` 在 Node 环境中 `require('mqtt')`（Node 原生版 mqtt.js），并注入到 `window.mqtt`，同时写入标记：
  - `window.__MQTT_PRO_DESKTOP__ = true`
  - `window.__MQTT_PRO_MQTT_SOURCE__ = 'native'`
- React 前端保持入口不变，统一使用 `window.mqtt.connect(...)`：
  - 选择 `ws/wss` → 走 WebSocket（可带 path，如 `/mqtt`）
  - 选择 `mqtt/mqtts` → 走 TCP/TLS（不使用 path）

### 常见问题：桌面端显示 “preload 未生效 / 只能用 CDN（仅 ws/wss）”
典型症状：`isElectron=是, preload=否, mqttSource=cdn`，并提示：
> 桌面端未启用 MQTT TCP（preload 未生效）

根因（已修复）：窗口处于 **sandbox 受限环境** 时，`preload` 可能无法使用 Node 的 `require('mqtt')`，导致注入失败，前端回退到 CDN 浏览器版 mqtt（只支持 ws/wss）。

修复要点：在 `electron/main.cjs` 的 `webPreferences` 中显式设置 `sandbox: false`，确保 `preload` 可正常加载 Node 模块。

### 桌面端诊断日志
为便于定位 preload/路径问题，桌面端会写诊断日志到：
- `%TEMP%\\mqtt-pro-diagnostics\\main.log`（主进程：preloadPath、resourcesPath、sandbox 等）
- `%TEMP%\\mqtt-pro-diagnostics\\preload.log`（preload：是否运行、mqtt 是否注入、require 失败原因）

## 功能特性

### 核心功能
- **MQTT 连接管理** - Web 版支持 `ws://` / `wss://`；桌面版额外支持 `mqtt://` / `mqtts://`
- **订阅管理** - 支持多主题订阅，自动重订阅功能
- **消息发布** - 支持 QoS 0/1/2，Retain 标志
- **实时日志** - 消息收发实时显示，支持 TEXT/HEX 视图切换
- **连接诊断** - 智能诊断连接错误，提供解决建议

### 高级功能
- **快捷指令** - 保存常用发布指令，一键发送
- **消息模板变量** - 支持动态变量：`{{timestamp}}`、`{{datetime}}`、`{{random}}`、`{{count}}`、`{{uuid}}`
- **定时发送** - 自定义间隔自动发送消息
- **配置管理** - 保存/加载多个连接配置

### 云同步
- **多设备同步** - 基于 Firebase 的实时云同步
- **Space ID** - 使用相同 Space ID 的设备自动同步配置和快捷指令
- **本地优先** - 无 Firebase 配置时自动降级为本地模式

### 界面特性
- **双主题** - 支持深色/浅色主题切换
- **响应式设计** - 现代化 UI，流畅动画
- **快捷键支持**
  - `Ctrl/Cmd + Enter` - 发送消息
  - `Ctrl/Cmd + K` - 连接/断开
  - `Ctrl/Cmd + D` - 断开连接
  - `Ctrl/Cmd + L` - 清空日志

## 技术栈

- **前端框架**: React 18
- **构建工具**: Vite
- **样式方案**: Tailwind CSS
- **图标库**: Lucide React
- **MQTT 客户端**: mqtt.js v5.3.5
- **云服务**: Firebase (Auth + Firestore)

## 快速开始

### 安装依赖

```bash
npm install
```

### 启动开发服务器

```bash
npm run dev
```

### 启动桌面端开发模式

```bash
npm run desktop:dev
```

### 构建生产版本

```bash
npm run build
```

### 构建桌面端安装包（Windows）

```bash
npm run desktop:build
```

构建产物：
- `release/win-unpacked/`：免安装目录版（直接运行 `MQTT Pro.exe`）
- `release/MQTT Pro Setup <version>.exe`：NSIS 安装包

注意：打包前请关闭正在运行的 `MQTT Pro.exe`，否则可能因文件占用导致 `Access is denied`。

## 使用指南

### 连接 MQTT 服务器

1. 在左侧「连接配置」面板中输入服务器信息
2. 选择协议：Web 版仅 `ws/wss`；桌面版可选 `ws/wss/mqtt/mqtts`，端口会自动适配
3. `ws/wss` 需要填写 Path（通常为 `/mqtt`）；`mqtt/mqtts` 不需要 Path
4. 可选填写用户名和密码
5. 点击「连接」按钮

### 预设公共服务器

| 服务器 | Host | WS 端口 | WSS 端口 | Path |
|--------|------|---------|----------|------|
| EMQX | broker.emqx.io | 8083 | 8084 | /mqtt |
| HiveMQ | broker.hivemq.com | 8000 | 8884 | /mqtt |
| Mosquitto | test.mosquitto.org | 8080 | 8081 | (空) |

### 订阅主题

1. 在「订阅监控」区域输入主题
2. 支持通配符：`#`（多级）、`+`（单级）
3. 点击「订阅」或按 Enter

### 发布消息

1. 在底部发布区域输入 Topic
2. 选择 QoS 等级和 Retain 选项
3. 在文本框中输入消息内容
4. 点击「发送」或按 `Ctrl+Enter`

### 使用消息模板

在消息中使用变量，发送时会自动替换：

```json
{
  "timestamp": {{timestamp}},
  "id": "{{uuid}}",
  "seq": {{count}}
}
```

### 保存快捷指令

1. 配置好要发送的 Topic 和 Payload
2. 点击「存为指令」
3. 输入指令名称（如：开灯、关灯）
4. 在左侧「快捷指令」区域一键发送

### 云同步设置

1. 点击左下角「开启云同步」
2. 输入或生成一个 Space ID
3. 在其他设备使用相同 Space ID 即可同步

## 项目结构

```
MQTT_Pro/
├── src/
│   ├── App.jsx        # 主应用组件
│   ├── main.jsx       # 入口文件
│   └── index.css      # 全局样式
├── public/
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
└── README.md
```

## 环境变量

如需启用云同步功能，需要配置 Firebase：

```javascript
// 在运行环境中定义
__firebase_config = JSON.stringify({
  apiKey: "your-api-key",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  // ...其他配置
});
__app_id = "your-app-id";
```

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！
