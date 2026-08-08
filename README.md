# Northrealm MQTT

[![Release](https://img.shields.io/github/v/release/HaxIOX/northrealm-mqtt?sort=semver)](https://github.com/HaxIOX/northrealm-mqtt/releases/latest)
[![CI](https://img.shields.io/github/actions/workflow/status/HaxIOX/northrealm-mqtt/ci.yml?branch=main)](https://github.com/HaxIOX/northrealm-mqtt/actions/workflows/ci.yml)
[![License](https://img.shields.io/github/license/HaxIOX/northrealm-mqtt)](LICENSE)
![Web](https://img.shields.io/badge/Web-Vite%20%2B%20React-646CFF)
![Windows](https://img.shields.io/badge/Windows-Electron-47848F)
![MQTT](https://img.shields.io/badge/MQTT-ws%2Fwss%20%7C%20mqtt%2Fmqtts-FF6F00)

[English](README.md) | [简体中文](README.zh-CN.md)

Short name: `NR`.

Northrealm is an MQTT debugger and client for IoT development and testing. It provides:

- Web mode for `ws://` and `wss://`
- Windows desktop mode for `ws://`, `wss://`, `mqtt://`, and `mqtts://`
- Connection profiles, subscriptions, publishing, live logs, quick actions, and scheduled publishing

## Features

- Connection profiles with auto-reconnect and diagnostics
- Subscribe and publish with QoS `0/1/2` and `Retain`
- Topic filtering with wildcard support (`#` and `+`)
- Quick actions for common publish payloads
- Local backup import/export
- Desktop TCP/TLS MQTT support through Electron preload

## Protocol support

- MQTT protocol versions: `3.1`, `3.1.1`, `5.0`
- Web: `ws://`, `wss://`
- Desktop: `ws://`, `wss://`, `mqtt://`, `mqtts://`

Browsers cannot open raw TCP sockets, so the web build supports WebSocket transport only.

## Preview

![image-20251227203752551](assets/image-20251227203752551.png)
![image-20251227203803561](assets/image-20251227203803561.png)
![image-20251227203820626](assets/image-20251227203820626.png)

## Requirements

- Node.js: `^20.19.0 || >=22.12.0`

## Quick start

```bash
npm ci
npm run dev
```

## Recommended verification

Use one verification path consistently:

```bash
# Lint + web build
npm run verify

# Lint + web build + Windows desktop packaging
npm run verify:desktop
```

On Windows PowerShell, if `npm.ps1` is blocked by execution policy, run the same commands with `npm.cmd`:

```powershell
npm.cmd run verify
npm.cmd run verify:desktop
```

## Desktop (Windows)

```bash
# Run Vite + Electron together
npm run desktop:dev

# Build installer to release/
npm run desktop:build

# Stop a running packaged app before build
npm run desktop:build:kill

# Build portable zip
npm run desktop:portable
```

If dependency installation fails while downloading Electron, set mirrors in Windows CMD and retry:

```bat
set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
set ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/
npm ci
```

## Release assets

- Installer: `Northrealm Setup <version>.exe`
- Portable: `Northrealm-portable-<version>-win-x64.zip`

## Workflow doc

See: `docs/GIT_WORKFLOW.md`

## License

- Source code: **GNU AGPL v3** (`AGPL-3.0-only`), see [LICENSE](LICENSE)
- Project name and logo: see [TRADEMARK.md](TRADEMARK.md)
