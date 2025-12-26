# 贡献指南（Contributing）

感谢你对 Northrealm（简称：NR）的兴趣！🎉

## 提交前检查

- 先搜索 Issue，避免重复
- 尽量提供：复现步骤、期望行为、实际行为、截图/日志
- 若涉及安全问题，请不要公开贴出密钥/密码/私有 Broker 地址

## 开发与验证

```bash
npm ci
npm run dev
npm run build
npm run lint
```

桌面端（Windows）：

```bash
npm run desktop:dev
npm run desktop:build
```

## 分支与提交

- 建议从新分支开发（例如 `fix/xxx`、`feat/xxx`）
- 提交信息尽量简洁明确（中文或英文均可）

## Pull Request

- PR 描述请说明：改动点、验证方式、是否影响兼容性
- 尽量保持改动聚焦（KISS / YAGNI）

## English (brief)

- Please open an Issue first for non-trivial changes.
- Keep changes focused and include how you tested them.

