# Northrealm MQTT

[![Release](https://img.shields.io/github/v/release/HaxIOX/northrealm-mqtt?sort=semver)](https://github.com/HaxIOX/northrealm-mqtt/releases/latest)
[![CI](https://img.shields.io/github/actions/workflow/status/HaxIOX/northrealm-mqtt/ci.yml?branch=main)](https://github.com/HaxIOX/northrealm-mqtt/actions/workflows/ci.yml)
[![License](https://img.shields.io/github/license/HaxIOX/northrealm-mqtt)](LICENSE)
![Web](https://img.shields.io/badge/Web-Vite%20%2B%20React-646CFF)
![Windows](https://img.shields.io/badge/Windows-Electron-47848F)
![MQTT](https://img.shields.io/badge/MQTT-ws%2Fwss%20%7C%20mqtt%2Fmqtts-FF6F00)

[English](README.md) | [简体中文](README.zh-CN.md)

简称：`NR`

Northrealm 是一个面向 IoT 开发与调试的 MQTT 工具，提供：

- Web 模式：支持 `ws://`、`wss://`
- Windows 桌面模式：支持 `ws://`、`wss://`、`mqtt://`、`mqtts://`
- 连接配置、订阅发布、实时日志、快捷指令、定时发送等常用能力

## 功能

- 连接配置管理、自动重连与诊断
- 支持 QoS `0/1/2` 和 `Retain` 的订阅与发布
- 支持 `#`、`+` 通配符的主题过滤
- 常用发布内容可保存为快捷指令
- 本地备份导入与导出
- 桌面端通过 Electron preload 支持 MQTT TCP/TLS 直连

## 协议支持

- MQTT 协议版本：`3.1`、`3.1.1`、`5.0`
- Web：`ws://`、`wss://`
- Desktop：`ws://`、`wss://`、`mqtt://`、`mqtts://`

浏览器不能直接打开原始 TCP Socket，因此 Web 版本只支持 WebSocket 传输。

## 预览

![image-20251227203752551](assets/image-20251227203752551.png)
![image-20251227203803561](assets/image-20251227203803561.png)
![image-20251227203820626](assets/image-20251227203820626.png)

## 环境要求

- Node.js：`^20.19.0 || >=22.12.0`

## 快速开始

```bash
npm ci
npm run dev
```

## 推荐验证路径

统一按下面这套命令执行：

```bash
# lint + Web 构建
npm run verify

# lint + Web 构建 + Windows 桌面打包
npm run verify:desktop
```

如果 Windows PowerShell 因执行策略阻止 `npm.ps1`，改用：

```powershell
npm.cmd run verify
npm.cmd run verify:desktop
```

## 桌面端（Windows）

```bash
# 同时启动 Vite 和 Electron
npm run desktop:dev

# 打包安装程序到 release/
npm run desktop:build

# 打包前自动结束正在运行的桌面程序
npm run desktop:build:kill

# 生成便携版 zip
npm run desktop:portable
```

如果安装依赖时 Electron 下载超时，可在 Windows CMD 中设置镜像后重试：

```bat
set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
set ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/
npm ci
```

## 发布产物

- 安装包：`Northrealm Setup <version>.exe`
- 便携版：`Northrealm-portable-<version>-win-x64.zip`

## 工作流文档

参见：`docs/GIT_WORKFLOW.md`

## 许可证

- 源代码：**GNU AGPL v3**（`AGPL-3.0-only`），见 [LICENSE](LICENSE)
- 项目名称与图标：见 [TRADEMARK.md](TRADEMARK.md)
