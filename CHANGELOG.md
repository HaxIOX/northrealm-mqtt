# Changelog

## Unreleased

## 0.1.16

- Merge: Windows desktop and Android now live on a single code line; one tag produces the installer, portable zip and signed APK
- Desktop: restore the 0.1.15 Windows look on top of the componentized code (blue accent, narrow sidebar, local Inter / JetBrains Mono fonts); mobile layout and theme unchanged
- Desktop: "订阅主题" with a pinned New Topic, self-drawn config picker, no message counters, All/RX/TX filter, countdown for scheduled publish, `Ctrl/Cmd+P` quick actions
- Desktop: default window 985x700, minimum 985x650
- Remove: Firebase cloud sync (never enabled in builds); the backup / import dialog stays on mobile and desktop
- Build: add `timerNextSendAt` to the publish workspace; share saved-config and common-action logic between mobile and desktop

## Earlier changes (unreleased before 0.1.16)

- Refactor: extract monolithic App.jsx into modular components and contexts (ThemeContext, MqttContext, AppDataContext, Sidebar, LogArea, PublishBar, ConnectionPanel, etc.)
- Feature: template quick actions — use `{{varName}}` placeholders in topic/payload, fill form at send time with history autocomplete
- Feature: template variable rendering — variables displayed as highlighted tags instead of raw `{{}}` braces
- Feature: "fill to send area" for template actions — resolves empty vars, positions cursor at first variable slot
- Feature: topic input autocomplete in publish bar — dropdown from session log topics with segment-aware matching
- Feature: edit quick action fields (name, topic, payload, QoS, retain) via inline form
- Feature: filter retained messages — suppress broker retained messages by default, add "show Retained" toggle in advanced settings
- Feature: retained message badge — `⚠️ Retained` indicator on received messages when "show Retained" is enabled
- Fix: auto-correct protocol/port mismatch in connection config
- Fix: duplicate message/log suppression and duplicate subscription prevention

## 0.1.6 - 2026-02-07

- Feature: multicast publish targets (select/manage multiple topics, one-click apply, bulk send current payload)
- Feature: persist quick action group collapse state
- Sync: include multicast targets in cloud sync

## 0.1.5 - 2026-01-05

- Feature: topic filter for message logs (multi-select subscription topics, supports `#`/`+`, one-click clear)
- Fix: scheduled publish interval input is now freely editable
- Feature: export message logs (filtered/all) as JSON
- Docs: sync English README with latest CN README

## 0.1.4 - 2025-12-31

- Fix: fallback to bundled MQTT SDK when desktop preload is missing (no CDN dependency)
- Fix: validate connection params (host/port/path/clientId) to prevent common connection mistakes

## 0.1.3 - 2025-12-26

- Fix: avoid showing MQTT handshake failure diagnostics when the user manually disconnects

## 0.1.2 - 2025-12-26

- Fix: `npm run desktop:dev` on Windows (avoid `spawn electron ENOENT` by resolving the Electron binary path)

## 0.1.1 - 2025-12-26

- Docs: remove naming inspiration line
- Docs: add badges (release/ci/license + tech badges)
- CI: add PR checks (lint + web build)
- Cleanup: remove `.claude` and `houtai.html` (UI mock)

## 0.1.0 - 2025-12-26

- Branding: rename to Northrealm (NR), English-first naming
- Docs: bilingual README, highlights first, roadmap checklist
- Release: GitHub Actions workflow for tagged releases
- Feature: remove message template variables
- Security: remove hard-coded credentials from `test-mqtt.cjs`

## 0.0.3

- Existing release (see git history)
