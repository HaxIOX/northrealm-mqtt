# Northrealm (北境) · MQTT Debugger / MQTT Client

[![Release](https://img.shields.io/github/v/release/HaxIOX/northrealm-mqtt?sort=semver)](https://github.com/HaxIOX/northrealm-mqtt/releases/latest)
[![CI](https://img.shields.io/github/actions/workflow/status/HaxIOX/northrealm-mqtt/ci.yml?branch=main)](https://github.com/HaxIOX/northrealm-mqtt/actions/workflows/ci.yml)
[![License](https://img.shields.io/github/license/HaxIOX/northrealm-mqtt)](LICENSE)
![Web](https://img.shields.io/badge/Web-Vite%20%2B%20React-646CFF)
![Windows](https://img.shields.io/badge/Windows-Electron-47848F)
![MQTT](https://img.shields.io/badge/MQTT-ws%2Fwss%20%7C%20mqtt%2Fmqtts-FF6F00)

[English](README.md) | [简体中文](README.zh-CN.md)

Short name: `NR`.

An MQTT tool for IoT development/testing: **Web (browser) + Windows Desktop (Electron)**. Connect, subscribe, publish, inspect logs, filter by topic, and schedule publishes.

## Highlights

- Backup import/export: export configs with one click (optional “export with passwords” — **plaintext**, handle carefully)
- Quick actions: save common publishes and send in one click (no more repetitive copy/paste)
- Web + Windows: Web uses `ws/wss`; Desktop additionally supports `mqtt/mqtts` (1883/8883)

## Features

- Connection profiles, auto-reconnect, connection diagnostics
- Local backup: one-click import/export (optional “export with passwords” in plaintext)
- Subscribe/publish: QoS 0/1/2, Retain, wildcards `#` / `+`
- Topic filter: click subscription topics in the left panel to multi-select filters; message logs only show topics that match (supports `#` / `+`), and can be cleared with one click
- Scheduled publish: repeatedly publish the current message to the target topic at the configured interval until stopped
- Live logs, TEXT/HEX view
- Quick actions: save common publishes and send with one click

## Protocol support (Web vs Desktop)

- ☑ MQTT protocol versions: 3.1 / 3.1.1 / 5.0
- ☑ WebSocket: `ws://` / `wss://` (Web & Desktop)
- ☑ TCP: `mqtt://` / `mqtts://` (Desktop only)

Notes:

- Browsers can’t open raw TCP sockets, so the Web build only supports `ws/wss`.

## Preview

![image-20251227203752551](assets/image-20251227203752551.png)

![image-20251227203803561](assets/image-20251227203803561.png)

![image-20251227203820626](assets/image-20251227203820626.png)

## Requirements

- Node.js: `^20.19.0 || >=22.12.0` (required by Vite 7)

## Quick start

- Web: [nrmqtt.haxio.de](https://nrmqtt.haxio.de/)
- Download portable Windows client: [Release v0.1.3](https://github.com/HaxIOX/northrealm-mqtt/releases/tag/v0.1.3)

```bash
npm ci
npm run dev
```

### If install fails (Electron download timeout)

If you see `connect ETIMEDOUT ...:443`, it’s usually a **network timeout while downloading Electron binaries**, not a wrong command.

On Windows CMD, set mirrors and retry:

```bat
set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
set ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/
npm ci
```

## Desktop (Windows)

```bash
# Run Vite + Electron together
npm run desktop:dev

# Build installer (outputs to release/)
npm run desktop:build
```

Portable zip:

```bash
npm run desktop:portable
```

## Android

```bash
npx vite build
npx cap sync android
cd android && ./gradlew assembleDebug
```

APK output: `android/app/build/outputs/apk/debug/app-debug.apk`

## Release assets (Windows)

- Installer: `Northrealm Setup <version>.exe`
- Portable: `Northrealm-portable-<version>-win-x64.zip`

## Git / Packaging / Actions doc

See: `docs/GIT_WORKFLOW.md`

## License

- Source code is licensed under **GNU AGPL v3** (`AGPL-3.0-only`), see `LICENSE`
- Project name and logo are not covered by the license, see `TRADEMARK.md`
