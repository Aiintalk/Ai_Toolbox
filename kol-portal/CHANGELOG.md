# kol-portal CHANGELOG

## v1.0.0 — 红人专属门户初始版本

- 新建 Next.js 服务，端口 `3009`，basePath `/kol-portal`
- 仅 `kol` 角色可访问；未登录跳 `/auth/login?next=/kol-portal`；员工/admin 重定向回 `/`
- 首页根据当前 `session.username` 渲染三张工具卡：
  - 我的问卷 → `/kol-intake`
  - 我的素材库 → `/material-library?persona={username}`
  - 人设定位报告 → `/persona-positioning`
- 通过 `transpilePackages: ['@ai-toolbox/auth-shared']` 直接消费同仓共享包源码

## 后续待办（不阻塞本服务运行）

- nginx.conf 增加 `location /kol-portal/` proxy 到 `127.0.0.1:3009`（PR 后续补）
- ecosystem.config.js 增加 kol-portal 进程（PR 后续补）
- kol-intake / material-library 改用 `@ai-toolbox/auth-shared`（独立 PR 处理）
