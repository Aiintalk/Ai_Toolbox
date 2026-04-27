# kol-portal CHANGELOG

## v1.1.0 - 2026-04-27

### Added
- 工具入口扩展为 7 个，分 3 组展示：我的资料 / 顶层设计 / 内容仿写
  - 新增：对标分析助手、人设定位助手、人设脚本仿写、千川脚本仿写、种草仿写
  - 所有工具 href 自动带 `?persona={username}`，为下一阶段 KOL 锁定逻辑铺路
- 退出登录改为调用 `/auth/api/logout`

### Changed
- `package.json` 新增 `@ai-toolbox/auth-shared` 作为 file 依赖（之前只在 tsconfig paths 映射，导致 jose 解析失败）
- `next.config.js` 新增 `webpack.resolve.symlinks = false`，配合 transpilePackages 兼容 monorepo

### Notes
- `packages/auth-shared/package.json` 把 jose / next 同时放入 peerDependencies + devDependencies；clone 后需要在 `packages/auth-shared/` 也执行 `npm install`，否则 transpilePackages 会找不到 jose

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
