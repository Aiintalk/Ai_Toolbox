# Changelog

## v1.0.0 - 2026-04-25

### Added
- 初始化 auth-service 模块（Next.js 14 + SQLite + JWT + bcrypt）
- 登录 / 登出 / 当前会话查询 接口
- 给 nginx auth_request 用的 `/api/verify` 接口（返 X-User-Id / X-User-Name / X-User-Role headers）
- 管理后台 `/auth/admin`：列出用户、新增、删除、改密码、改角色（仅 admin 可见）
- CLI 脚本：`init-db` 初始化表 + 种子用户，`user:add` 新增用户
- 角色分类：admin / employee / kol，登录后按角色路由

### Notes
- 种子账号：admin/admin123（管理员）、darenshuo/darenshuo123（员工，测试用）
- 生产环境务必通过 `ADMIN_PASSWORD` 和 `JWT_SECRET` 环境变量覆盖默认值
- 当前未集成到 nginx 和其他工具，下个 PR 处理
