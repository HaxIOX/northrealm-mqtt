# Changelog

## Unreleased

- (TBD)

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
