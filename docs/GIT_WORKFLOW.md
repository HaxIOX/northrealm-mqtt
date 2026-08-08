# Git And Verification Workflow

This file defines the single recommended local workflow for this repository.

## Prerequisites

- Node.js: `^20.19.0 || >=22.12.0`
- Install dependencies with:

```bash
npm ci
```

If Windows PowerShell blocks `npm.ps1`, run the same commands with `npm.cmd`.

## Daily development

```bash
# Web
npm run dev

# Desktop
npm run desktop:dev
```

## Recommended verification path

Use these commands in order:

```bash
# Lint + web build
npm run verify

# Lint + web build + Windows desktop packaging
npm run verify:desktop
```

Meaning:

- `npm run verify` = `npm run lint` + `npm run build`
- `npm run verify:desktop` = `npm run verify` + `npm run desktop:build`

## Desktop packaging

```bash
# Build installer
npm run desktop:build

# Stop a running desktop process before build
npm run desktop:build:kill

# Build portable zip
npm run desktop:portable
```

Output directories:

- Web build: `dist/`
- Desktop packaging: `release/`

## Release prep

Before tagging a release, run:

1. `npm run verify`
2. `npm run verify:desktop` when a Windows installer is required

## CI alignment

The stable local baseline matches the repo scripts:

- lint
- web build

Desktop packaging remains an explicit extra verification step for Windows deliverables.
