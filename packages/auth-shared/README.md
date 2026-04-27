# @ai-toolbox/auth-shared

仓库内共享的鉴权工具，供 kol-intake / material-library / kol-portal 等 Next.js 服务复用。

## 导出

- `getSession(req)`：从 NextRequest 的 `auth_token` cookie 解析 JWT，返回 `SessionPayload | null`
- `canSeeAll(session)`：admin / employee 返回 true
- `canAccessPersona(session, personaName)`：admin / employee 全通过；kol 仅同名 persona
- `COOKIE_NAME = 'auth_token'`
- 类型 `SessionPayload`、`Role`

## 消费方式

各 Next.js 服务在 `next.config.js` 加 `transpilePackages: ['@ai-toolbox/auth-shared']`，
在 `tsconfig.json` 加 paths 别名：

```json
{
  "compilerOptions": {
    "paths": {
      "@ai-toolbox/auth-shared": ["../packages/auth-shared/src/index.ts"]
    }
  }
}
```

无需 build 步骤，Next.js 会直接消费 TS 源码。

## 后续接入计划

- [ ] kol-intake/lib/auth.ts → 改为 `export * from '@ai-toolbox/auth-shared'`
- [ ] material-library/lib/auth.ts → 同上
- [x] kol-portal 已直接使用
