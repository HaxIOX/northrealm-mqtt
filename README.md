# Northrealm (北境) · MQTT 调试器 / MQTT 客户端 🚀

[![Release](https://img.shields.io/github/v/release/HaxIOX/northrealm-mqtt?sort=semver)](https://github.com/HaxIOX/northrealm-mqtt/releases/latest)
[![CI](https://img.shields.io/github/actions/workflow/status/HaxIOX/northrealm-mqtt/ci.yml?branch=main)](https://github.com/HaxIOX/northrealm-mqtt/actions/workflows/ci.yml)
[![License](https://img.shields.io/github/license/HaxIOX/northrealm-mqtt)](LICENSE)
![Web](https://img.shields.io/badge/Web-Vite%20%2B%20React-646CFF)
![Windows](https://img.shields.io/badge/Windows-Electron-47848F)
![MQTT](https://img.shields.io/badge/MQTT-ws%2Fwss%20%7C%20mqtt%2Fmqtts-FF6F00)

[简体中文](README.md) | [English](README.en.md)

简称：`NR`。

面向 IoT 开发/测试的 MQTT 工具：**Web 端（浏览器）+ Windows 桌面端（Electron）**，覆盖连接、订阅、发布、日志、快捷指令与定时发送。✨

## 亮点  ⭐

- 配置可导入/导出：一键备份，迁移/分享更省心（可选“含密码导出”，**明文**，请妥善保管）
- 快捷指令：保存常用发布，一键发送（不用来回复制粘贴）
- 双端覆盖：Web 端（`ws/wss`）+ Windows 桌面端（额外支持 `mqtt/mqtts` 直连 1883/8883）

## 功能

- 连接管理：多配置保存/切换、自动重连、连接诊断
- 本地备份：配置/快捷指令一键导入/导出（可选“含密码导出”，明文）
- 订阅/发布：QoS 0/1/2、Retain、通配符 `#`/`+`
- 日志与视图：收发实时展示、TEXT/HEX 切换
- 快捷指令：保存常用发布，一键发送

## 技术栈

- Web：Vite + React + Tailwind CSS
- Windows：Electron（`electron/main.cjs` + `electron/preload.cjs`）
- MQTT：mqtt.js

## Web / 桌面：协议支持差异  🪟🌐

| 平台 | 支持协议 | 说明 |
|---|---|---|
| Web（浏览器） | `ws://` / `wss://` | 浏览器无法直连 TCP，因此不支持 `mqtt://`/`mqtts://` |
| Windows 桌面端（Electron） | `ws://` / `wss://` / `mqtt://` / `mqtts://` | `preload` 在 Node 环境 `require('mqtt')` 并注入到 `window.mqtt` |

桌面端诊断日志：
- `%TEMP%\\mqtt-pro-diagnostics\\main.log`
- `%TEMP%\\mqtt-pro-diagnostics\\preload.log`

## 环境要求

- Node.js：`^20.19.0 || >=22.12.0`（Vite 7 要求）

## 快速开始

```bash
# 安装依赖
npm ci

# Web 开发（http://localhost:5173）
npm run dev

# Web 构建（产物：dist/）
npm run build
```

### 安装依赖失败（Electron 下载超时）怎么办？

你遇到的 `connect ETIMEDOUT ...:443` 通常是 **Electron 二进制下载被网络阻断/超时**，不是命令写错。

在 Windows PowerShell 里先设置镜像，再安装：

```powershell
$env:ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"
$env:ELECTRON_BUILDER_BINARIES_MIRROR="https://npmmirror.com/mirrors/electron-builder-binaries/"
npm ci
```

如果你想永久生效（需要重新打开终端）：

```powershell
setx ELECTRON_MIRROR "https://npmmirror.com/mirrors/electron/"
setx ELECTRON_BUILDER_BINARIES_MIRROR "https://npmmirror.com/mirrors/electron-builder-binaries/"
```

### Windows 桌面端（开发/打包）

```bash
# 桌面端开发：并行启动 Vite + Electron
npm run desktop:dev

# 桌面端打包（Windows）：产物输出到 release/
npm run desktop:build
```

> 说明：打包后的 Windows 程序显示名来自 `package.json` 的 `build.productName`（当前为 `Northrealm`）。后续如需进一步统一图标/签名等，可再补齐。

## 公共 Broker 预设（示例）

| 服务商 | Host | WS | WSS | Path |
|---|---:|---:|---:|---|
| EMQX | broker.emqx.io | 8083 | 8084 | /mqtt |
| HiveMQ | broker.hivemq.com | 8000 | 8884 | /mqtt |
| Mosquitto | test.mosquitto.org | 8080 | 8081 | (空) |

## Release（开源建议） 📦

为了让用户不必自己装环境，建议用 GitHub Release 分发：

- 版本号：`vMAJOR.MINOR.PATCH`（例如 `v0.1.0`）
- 打 Tag：`git tag v0.1.0 && git push origin v0.1.0`
- GitHub Actions：本仓库提供 `.github/workflows/release.yml`，在打 Tag 后自动打包并上传安装包

## 贡献

欢迎提交 Issue / PR。建议包含：复现步骤、期望行为、实际行为、截图或日志。

## 路线图（时间轴） 🧭

> 说明：以下为预计计划，可能根据优先级调整。

- [x] 2025-12-25：项目起步（Web + Windows 桌面端）
- [x] 2025-12-26：品牌与桌面端显示名统一为 “Northrealm（北境）”（已同步 `productName/appId`）
- [ ] 2026-Q1：连接配置/订阅列表体验打磨（导入导出备份、搜索过滤、日志性能）
- [ ] 2026-Q2：移动端（计划中，技术栈待定）
- [ ] 2026-Q3：云同步（计划中：可选 Firebase / 自建后端方案二选一）

## 许可证

- 本项目源码采用 **GNU AGPL v3**（`AGPL-3.0-only`），详见 `LICENSE`
- 项目名称与 Logo 不在许可证授权范围内，详见 `TRADEMARK.md`
