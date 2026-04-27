# Changelog

记录本项目的重要功能变更、问题修复和文档更新。

---

## v2.1.0 - 2026-04-26

### Added
- 接入 auth-service 登录系统：所有 API 加 cookie 鉴权（jose 验证 JWT）
- 用户隔离：kol 角色只能看 / 改自己的提交记录；employee / admin 可见全部
- 新增 `/api/progress` 接口：返回当前 kol 是否答完（completed / percent: 0|100）
- 提交逻辑改为「一人一份 + 部分覆盖」：再次提交时沿用旧 id，已答字段覆盖、未答字段保留
- 前端：进入页面时拉取自己的 submission，已有则显示提示「重新填写会在原有答案上覆盖」
- `Submission` 数据结构新增 `userId` 字段

### Changed
- `/api/submissions` GET：按角色过滤
- `/api/submissions/[id]` GET：kol 越权访问返回 403

### Notes
- 依赖环境变量 `JWT_SECRET`（必须与 auth-service 一致），未配置时使用 dev 默认值
- 历史 submission 没有 `userId` 字段，会被 kol 视为「不属于自己」而过滤掉；employee / admin 仍可见
- Admin 页（`/kol-intake/admin`）当前无角色限制，仍依赖路由守卫层（nginx 或前端跳转）保护

---

## v2.0.0 - 2026-04-23

### Added
- 初始版本，AI 对话式 KOL 入职信息采集完整开发（V2.0 新增工具）
- 支持约 23 道结构化问题，拟人化对话引导，含进度条
- 支持文本、长文本、多条循环收集三种题型
- 每题回答后 AI 生成自然过渡语（bridge 接口）
- 提交后自动生成人格分析报告（claude-opus-4-6 + extended thinking）
- 支持报告在线展示和下载为 .txt 文件
- 管理后台（/admin）展示所有提交，支持查看详情和导出 Word 文档
- 新增 `README.md` 和 `CHANGELOG.md` 文档

### Notes
- Admin 页面无鉴权，生产环境需自行添加访问控制
- 数据存储在本地 `data/` 目录，迁移环境时需手动复制该目录
