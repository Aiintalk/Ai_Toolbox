# kol-portal

红人（KOL）专属工作台。

- **端口**：3009
- **路径**：`/kol-portal`
- **角色**：仅 `kol`；员工/admin 会被重定向回主门户
- **依赖共享包**：`@ai-toolbox/auth-shared`（位于 `../packages/auth-shared`，通过 `transpilePackages` 直接消费 TS 源码）

## 本地开发

```bash
cd kol-portal
npm install
JWT_SECRET="..." npm run dev
# 访问 http://localhost:3009/kol-portal
```

## 生产部署

加入 PM2 ecosystem.config.js：

```js
{
  name: 'kol-portal',
  cwd: './kol-portal',
  script: 'npm',
  args: 'start',
  env: { PORT: 3009, JWT_SECRET: process.env.JWT_SECRET }
}
```

nginx：

```
location /kol-portal/ {
  proxy_pass http://127.0.0.1:3009;
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
}
```
