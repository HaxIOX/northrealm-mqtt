# Changelog

## Unreleased

- UI: compact layout — slimmer sidebar (280px, more compact controls), merged protocol/host/port row, shorter publish bar, simpler top bar
- UI: unified type scale (min 11px) and corner radii; semantic tone colors; remove blur on large surfaces
- UI: pixel-aligned logo and 16/24/32/48px icon frames (crisper title bar / taskbar icon)
- UI: connection errors are now concise single log entries without emoji; error/system logs use a sans-serif font and show their details
- Feature: quick actions — `Ctrl/Cmd+P` opens the panel; `Enter` sends the first match, `Shift+Enter` only fills the publish box; `Shift+click` a quick-action button to fill instead of send; default name when saving an action is the last topic segment
- Fix: subscriptions can now be removed while disconnected; the new-topic box closes on blur / `Esc`
- Fix: `npm run desktop:dev` failed to start Electron on Windows (ENOENT)
- Fix: `npm run desktop:build` failed at the NSIS step on machines that restrict where executables under the user profile can write; build temp files now live in a project-local `.tmp`
- Removed: Firebase cloud sync (it was never enabled in builds; local backup import/export is unchanged) — about 328 KB smaller bundle
- Removed: sent/received/error counters in the sidebar
- UI: saved-connection dropdown redesigned — shows `protocol://host:port`, highlights the active one, delete from the row; the old native select is gone
- Packaging: the installer is now a guided one (choose the install directory, Chinese UI) instead of silent one-click; the zip is named `Northrealm-portable-<version>-win-x64.zip`
- Chore: tidy the repo — `test-mqtt.cjs` moved to `scripts/`, `src/mqtt/` renamed `src/lib/`, brand favicon replaces the default Vite one

## 0.1.7 - 2026-02-27

- UI: set app/window title to `Northrealm`
- Fix: isolate quick-action group collapse state between `置顶` and `全部`

## 0.1.0 - 2025-12-26

- Branding: rename to Northrealm (NR), English-first naming
- Docs: bilingual README, highlights first, roadmap checklist
- Release: GitHub Actions workflow for tagged releases
- Feature: remove message template variables
- Security: remove hard-coded credentials from `test-mqtt.cjs`

## 0.0.3

- Existing release (see git history)
