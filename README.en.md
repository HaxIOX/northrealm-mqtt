# Northrealm (北境) · MQTT Debugger / MQTT Client 🚀

[![Release](https://img.shields.io/github/v/release/HaxIOX/northrealm-mqtt?sort=semver)](https://github.com/HaxIOX/northrealm-mqtt/releases/latest)
[![CI](https://img.shields.io/github/actions/workflow/status/HaxIOX/northrealm-mqtt/ci.yml?branch=main)](https://github.com/HaxIOX/northrealm-mqtt/actions/workflows/ci.yml)
[![License](https://img.shields.io/github/license/HaxIOX/northrealm-mqtt)](LICENSE)
![Web](https://img.shields.io/badge/Web-Vite%20%2B%20React-646CFF)
![Windows](https://img.shields.io/badge/Windows-Electron-47848F)
![MQTT](https://img.shields.io/badge/MQTT-ws%2Fwss%20%7C%20mqtt%2Fmqtts-FF6F00)

[简体中文](README.md) | [English](README.en.md)

Short name: `NR`.

An MQTT tool for IoT development/testing: **Web (browser) + Windows Desktop (Electron)**. Connect, subscribe, publish, inspect logs, and schedule publishes. ✨

Name/Logo usage rules: `TRADEMARK.md`.

## Highlights ⭐

- Backup import/export: export configs with one click (optional “export with passwords” — **plaintext**, handle carefully)
- Quick actions: save common publishes and send in one click (no more repetitive copy/paste)
- Web + Windows: Web uses `ws/wss`; Desktop additionally supports `mqtt/mqtts` (1883/8883)

## At a glance

- What it is: an **MQTT debugger/client**
- Platforms: Web (`ws/wss`) + Windows Desktop (`ws/wss` + `mqtt/mqtts`)
- Store subtitle suggestions: `MQTT Debugger` / `MQTT Client`

## Features

- Connection profiles, auto-reconnect, connection diagnostics
- Local backup: one-click import/export (optional “export with passwords” in plaintext)
- Subscribe/publish: QoS 0/1/2, Retain, wildcards `#` / `+`
- Live logs, TEXT/HEX view
- Quick actions: save common publishes and send with one click

## Tech stack

- Web: Vite + React + Tailwind CSS
- Windows: Electron (`electron/main.cjs` + `electron/preload.cjs`)
- MQTT: mqtt.js

## Protocol support (Web vs Desktop) 🪟🌐

| Platform | Protocols | Notes |
|---|---|---|
| Web | `ws://` / `wss://` | Browsers can't open raw TCP sockets |
| Windows Desktop | `ws://` / `wss://` / `mqtt://` / `mqtts://` | Preload injects `mqtt` into `window.mqtt` |

Desktop diagnostics logs:
- `%TEMP%\\mqtt-pro-diagnostics\\main.log`
- `%TEMP%\\mqtt-pro-diagnostics\\preload.log`

## Requirements

- Node.js: `^20.19.0 || >=22.12.0` (required by Vite 7)

## Quick start

```bash
npm ci
npm run dev
```

### Install fails (Electron download timeout)

If you see `connect ETIMEDOUT ...:443`, it’s usually a **network timeout while downloading Electron binaries**, not a wrong command.

On Windows PowerShell, set mirrors and retry:

```powershell
$env:ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"
$env:ELECTRON_BUILDER_BINARIES_MIRROR="https://npmmirror.com/mirrors/electron-builder-binaries/"
npm ci
```

To make it persistent (restart your terminal):

```powershell
setx ELECTRON_MIRROR "https://npmmirror.com/mirrors/electron/"
setx ELECTRON_BUILDER_BINARIES_MIRROR "https://npmmirror.com/mirrors/electron-builder-binaries/"
```

## Desktop (Windows)

```bash
npm run desktop:dev
npm run desktop:build
```

## Roadmap 🧭

> Note: dates are estimates and may change.

- [x] 2025-12-25: Project kickoff (Web + Windows Desktop)
- [x] 2025-12-26: Align desktop display name as “Northrealm (北境)” (productName/appId)
- [ ] 2026-Q1: UX improvements (backup import/export, search/filter, log performance)
- [ ] 2026-Q2: Mobile app (planned; tech stack TBD)
- [ ] 2026-Q3: Cloud sync (planned: optional Firebase or self-hosted backend)

## License

- Source code is licensed under **GNU AGPL v3** (`AGPL-3.0-only`), see `LICENSE`
- Project name and logo are not covered by the license, see `TRADEMARK.md`
