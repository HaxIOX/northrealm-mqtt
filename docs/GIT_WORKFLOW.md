# Git 操作流程（上传 / 打包 / GitHub Actions）

本文档面向本项目的日常开发与发版流程，尽量用最少步骤跑通：**本地开发 → 提交 → 推送 → 打包 → 自动发布**。

---

## 0. 前置约定（推荐）

- 默认主分支：`main`
- 功能开发：从 `main` 拉分支（`feat/*`、`fix/*`）
- 提交信息（建议）：`feat: ...` / `fix: ...` / `docs: ...` / `chore: ...`

---

## 1. 第一次克隆与安装依赖

```bash
git clone <repo-url>
cd MQTT_Pro
npm ci
```

> `npm ci` 会严格按 `package-lock.json` 安装，适合 CI 和团队协作（更稳定）。

---

## 2. 日常开发（分支 → 提交 → 推送 → PR）

### 2.1 从 main 拉取最新代码

```bash
git checkout main
git pull
```

### 2.2 创建功能分支

```bash
git checkout -b feat/xxx
```

### 2.3 开发与本地验证（示例）

```bash
npm run dev
# 桌面端联调（并行启动 Vite + Electron）
npm run desktop:dev
```

### 2.4 提交代码

```bash
git status
git add .
git commit -m "feat: xxx"
```

### 2.5 推送到远端（上传）

```bash
git push -u origin feat/xxx
```

随后在 GitHub 上发起 Pull Request（PR），合并到 `main`。

---

## 3. 本地打包（Web / Windows 桌面端）

### 3.1 Web 打包（产物：`dist/`）

```bash
npm run build
```

### 3.2 Windows 桌面端打包（产物：`release/`）

```bash
# 生成安装包（NSIS）
npm run desktop:build
```

### 3.3 生成便携版 Zip（portable）

```bash
npm run desktop:portable
```

常见产物（见 `release/`）：

- 安装包：`*Setup*.exe`
- 便携版：`*portable*.zip`

---

## 4. 发版（Tag → Actions 自动产出 Release）

本项目的 GitHub Actions 配置在：`.github/workflows/`

- `ci.yml`：PR / push 到 `main` 时，执行 `npm ci` + `npm run lint` + `npm run build`
- `pages.yml`：push 到 `main` 时构建并部署 `dist/` 到 GitHub Pages（忽略 `**/*.md`、`electron/**` 等）
- `release.yml`：push `v*` tag 时在 Windows Runner 打包并创建 GitHub Release

### 4.1 推荐的发版步骤

1) 更新版本号与变更记录（建议同步更新 `CHANGELOG.md`）  
2) 打 tag 并推送 tag（触发 `release.yml`）

示例：

```bash
git checkout main
git pull

# 选择其一：手动改 package.json 版本，或用 npm version
npm version patch

git push
git push --tags
```

> `release.yml` 的触发条件是 `tags: 'v*'`，`npm version patch` 会创建形如 `v0.1.4` 的 tag。

---

## 5. GitHub Actions 怎么用（查看 / 手动触发 / 排查）

### 5.1 查看执行结果

GitHub 仓库页面 → `Actions` → 选择对应 Workflow → 打开某次运行 → 查看每个 step 日志。

### 5.2 手动触发（workflow_dispatch）

本项目的 `CI / Pages / Release` 都支持 `workflow_dispatch`：  
GitHub 仓库页面 → `Actions` → 选择 workflow → `Run workflow`。

### 5.3 常见问题排查

- `npm ci` 失败：优先检查 Node 版本、`package-lock.json` 是否与 `package.json` 同步
- Electron 下载超时：本地可配置镜像（见 README 的镜像设置）；CI 侧通常无需处理
- Release 找不到文件：检查 `release/` 下产物命名是否匹配 `release.yml` 的 `files:` 规则

