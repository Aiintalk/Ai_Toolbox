# Changelog

记录 Ai_Toolbox 整个项目的重要里程碑和各模块版本变更汇总。

---

## 2026-04-26 (PR3)

### kol-intake / material-library 用户隔离 + 进度 API
- `kol-intake` v2.0.0 → v2.1.0：接入登录、kol 数据隔离、新增 `/api/progress`、提交改为一人一份+部分覆盖、前端「已有提交」提示
- `material-library` v2.0.0 → v2.1.0：接入登录、kol 只能看 / 改自己 username 对应的 persona、新增 `/api/progress`（8 项完成度）、前端 kol 自动选 persona 隐藏切换器
- 两个模块均依赖 `JWT_SECRET`（与 auth-service 一致），共享接口对 persona-writer / qianchuan-writer / seeding-writer 行为兼容

---

## 2026-04-25 (PR2)

### portal 接入登录系统
- `portal` v1.1.1 → v1.2.0：页面加载校验登录态，未登录跳 `/auth/login`，role=kol 跳 `/kol-portal/`
- 顶栏新增用户名展示 + 退出登录按钮
- 本次仅前端兜底，后端 nginx auth_request 守卫由运维侧手动配置（不纳入仓库管理）

---

## 2026-04-25

### 新增模块
- `auth-service` v1.0.0 — 统一登录与用户管理服务（地基 PR）
  - Next.js 14 + SQLite + JWT (HttpOnly Cookie) + bcrypt
  - 三种角色：admin / employee / kol
  - 登录页 `/auth/login`，按 role 跳转到对应 portal
  - 管理后台 `/auth/admin`，支持新增 / 改角色 / 重置密码 / 删除用户
  - 预留 `/api/verify` 接口，供 nginx `auth_request` 模块做路由守卫
  - CLI 脚本：`init-db`（建表 + 种 darenshuo + admin）、`user:add`

### 后续计划（网红版工具箱）
- PR2：nginx 加 auth_request 守卫；员工 portal 加登录跳转
- PR3：kol-intake / material-library 加用户隔离 + 进度 API + 修改功能
- PR4：新建网红 portal（kol-portal，含进度卡片）

---

## 2026-04-19

### 上线
- `portal` 导航页正常运行，已上线 2 个工具入口
- `benchmark-analyzer` 对标分析助手已上线
- `persona-writer-web` 人设脚本仿写助手已上线

### 已开发待接入
- `qianchuan-writer-web` 千川脚本仿写助手开发完成，Portal 导航页待接入
- `seeding-writer-web` 种草内容仿写助手开发完成，Portal 导航页待接入

### 文档
- 新增根目录 `README.md`、`GIT_WORKFLOW.md`
- 新增各子项目 `README.md` 和 `CHANGELOG.md`
- 统一 Git 分支命名规范、版本号管理规则
