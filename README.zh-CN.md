# Northrealm（北境）· MQTT 调试器 / MQTT 客户端

[![Release](https://img.shields.io/github/v/release/HaxIOX/northrealm-mqtt?sort=semver)](https://github.com/HaxIOX/northrealm-mqtt/releases/latest)
[![CI](https://img.shields.io/github/actions/workflow/status/HaxIOX/northrealm-mqtt/ci.yml?branch=main)](https://github.com/HaxIOX/northrealm-mqtt/actions/workflows/ci.yml)
[![License](https://img.shields.io/github/license/HaxIOX/northrealm-mqtt)](LICENSE)
![Web](https://img.shields.io/badge/Web-Vite%20%2B%20React-646CFF)
![Windows](https://img.shields.io/badge/Windows-Electron-47848F)
![MQTT](https://img.shields.io/badge/MQTT-ws%2Fwss%20%7C%20mqtt%2Fmqtts-FF6F00)

[English](README.md) | [简体中文](README.zh-CN.md)

简称：**NR**

面向 IoT 开发与测试的 MQTT 工具：**Web 端（浏览器）+ Windows 桌面端（Electron）**，覆盖连接、订阅、发布、日志、快捷指令与定时发送。

## 功能

- 连接管理：多配置保存/切换、自动重连
- 一键导入导出配置：一键备份，迁移，分享
- 快捷指令：保存常用发布，一键发送（避免反复复制粘贴）
- 主题筛选：点击左侧订阅主题可多选筛选，消息日志仅显示匹配所选主题（支持 #/+ 通配符），并可一键取消筛选。
- 定时发送：按设定间隔自动重复发布当前消息到指定 Topic，直到手动停止
- 订阅/发布：QoS0/1/2、Retain、通配符 `#`/`+`
- 日志与视图：收发实时展示、TEXT/HEX 切换

## 支持协议

- ☑ MQTT 协议版本：3.1 / 3.1.1 / 5.0
- ☑ WebSocket：`ws://` / `wss://`
- ☑ TCP：`mqtt://` / `mqtts://`（仅客户端）

## 应用预览

![image-20251227203752551](assets/image-20251227203752551.png)

![image-20251227203803561](assets/image-20251227203803561.png)

![image-20251227203820626](assets/image-20251227203820626.png)

## 环境要求

- Node.js：`^20.19.0 || >=22.12.0`（Vite 7 要求）

## 快速开始

- web端：[nrmqtt.haxio.de](https://nrmqtt.haxio.de/)
- 下载便携式windows客户端：[Release v0.1.3](https://github.com/HaxIOX/northrealm-mqtt/releases/tag/v0.1.3)

安装依赖（推荐 `npm ci`），如遇 Electron 下载超时，可在 Windows CMD 中设置镜像后再执行：

```bat
set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
set ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/
npm ci
```

Web 构建：

```bash
npm run dev
npm run build
```

## 桌面端

```bash
# 桌面端开发：并行启动 Vite + Electron
npm run desktop:dev

# 桌面端打包（Windows）：产物输出到 release/
npm run desktop:build
```

便携版：

```bash
npm run desktop:portable
```

## 贡献

欢迎提交 Issue / PR。建议包含：复现步骤、期望行为、实际行为、截图或日志。

## 许可证

- 本项目源码采用 **GNU AGPL v3**（`AGPL-3.0-only`），详见 `LICENSE`

