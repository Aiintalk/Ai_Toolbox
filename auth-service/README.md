# auth-service · 统一登录服务

Ai_Toolbox 全局登录与用户管理服务，给员工和网红两类账号提供统一登录、JWT 会话发放、管理后台。

- 端口：`3000`
- basePath：`/auth`
- 数据库：SQLite（文件路径 `data/users.db`）
- 会话：HttpOnly Cookie + JWT（HS256）

---

## 目录结构

```
auth-service/
├── app/
│   ├── login/page.tsx              登录页
│   ├── admin/                      管理后台（仅 admin 可见）
│   ├── api/
│   │   ├── login/route.ts          POST /auth/api/login
│   │   ├── logout/route.ts         POST /auth/api/logout
│   │   ├── me/route.ts             GET  /auth/api/me
│   │   ├── verify/route.ts         GET  /auth/api/verify   ← 给 nginx auth_request
│   │   └── admin/users/...         用户增删改查（admin only）
├── lib/
│   ├── db.ts                       SQLite 连接 + 表结构
│   ├── password.ts                 bcrypt 哈希
│   ├── jwt.ts                      签发 / 校验 JWT
│   └── session.ts                  服务端 cookie 读取
├── scripts/
│   ├── init-db.ts                  初始化数据库 + 种子用户
│   └── add-user.ts                 CLI 加用户
└── data/                           SQLite 文件目录（gitignore）
```

---

## 角色

| role       | 含义     | 登录后默认跳转       |
| ---------- | -------- | -------------------- |
| `admin`    | 管理员   | `/auth/admin`        |
| `employee` | 公司员工 | `/portal/`           |
| `kol`      | 网红     | `/kol-portal/`       |

---

## 本地开发

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量
cp .env.local.example .env.local
# 编辑 .env.local，至少修改 JWT_SECRET

# 3. 初始化数据库（建表 + 种子 admin 和 darenshuo）
npm run init-db

# 4. 启动开发服务器
npm run dev
# 浏览器访问 http://localhost:3000/auth/login
```

种子账号：

| 用户名      | 密码           | 角色     | 用途           |
| ----------- | -------------- | -------- | -------------- |
| `admin`     | `admin123`     | admin    | 管理员（默认） |
| `darenshuo` | `darenshuo123` | employee | 测试账号       |

> ⚠️ 生产环境必须用 `ADMIN_PASSWORD` 环境变量覆盖默认 admin 密码。

---

## CLI 加用户

```bash
npm run user:add -- <username> <password> <role>
# 示例
npm run user:add -- zhangsan zhangsan123 employee
npm run user:add -- wanghong wanghong123 kol
```

---

## 接口说明

### POST `/auth/api/login`
```json
{ "username": "darenshuo", "password": "darenshuo123" }
```
成功：
```json
{ "ok": true, "user": { "id": 2, "username": "darenshuo", "role": "employee" }, "redirect": "/portal/" }
```
同时设置 HttpOnly Cookie `auth_token`。

### POST `/auth/api/logout`
清除 Cookie。

### GET `/auth/api/me`
返回当前登录用户。未登录返 401。

### GET `/auth/api/verify`
**给 nginx `auth_request` 用**。Cookie 有效返 200 并附带：
- `X-User-Id`
- `X-User-Name`
- `X-User-Role`

无效返 401，nginx 据此重定向到 `/auth/login`。

### Admin（仅 role=admin）
- `GET    /auth/api/admin/users`         列出所有用户
- `POST   /auth/api/admin/users`         新增用户
- `PATCH  /auth/api/admin/users/:id`     改密码或角色
- `DELETE /auth/api/admin/users/:id`     删除用户

---

## 部署（生产）

1. 服务器装好 Node.js（建议 20+）
2. `cd /opt/auth-service && npm install && npm run build`
3. 配置 `.env.local`（务必设强 JWT_SECRET 和 ADMIN_PASSWORD）
4. `npm run init-db`
5. PM2 启动：`pm2 start npm --name auth-service -- start`
6. nginx 加路由（参考主 nginx.conf）

后续与主 ecosystem.config.js 合并，统一 `pm2 start ecosystem.config.js`。

---

## 后续待办

- [ ] nginx auth_request 集成（在 portal / kol-portal / 各工具的 location 加守卫）
- [ ] 各工具读取 `X-User-*` header，识别当前用户
- [ ] 管理员功能：批量导入 / 导出用户
