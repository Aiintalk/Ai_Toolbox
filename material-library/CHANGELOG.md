# Changelog

记录本项目的重要功能变更、问题修复和文档更新。

---

## v2.1.0 - 2026-04-26

### Added
- 接入 auth-service 登录系统：所有 API 加 cookie 鉴权（jose 验证 JWT）
- 用户隔离：kol 角色只能看 / 改与自己 username 同名的 persona 目录；employee / admin 可见全部
- 新增 `/api/progress` 接口：按 8 项（soul + content-plan + 6 类素材）计算当前 kol 完成度
- 前端：kol 角色自动选定自己的 persona、隐藏达人切换器
- 前端：kol 首次进入时若 persona 目录不存在，本地 fabricate 空档案以便编辑创建

### Changed
- `/api/personas` GET：按角色过滤返回的 personas 列表
- `/api/personas` PUT：kol 越权修改返回 403
- `/api/personas/references` POST/DELETE：加鉴权
- `lib/auth.ts` 新增 `canSeeAll` / `canAccessPersona` 工具函数

### Notes
- 依赖环境变量 `JWT_SECRET`（必须与 auth-service 一致），未配置时使用 dev 默认值
- 共享接口 `/api/personas` 仍被 persona-writer / qianchuan-writer / seeding-writer 调用：
  - employee 浏览器访问 → 拿到全部 personas（行为不变）
  - kol 浏览器访问 → 只拿到自己的 persona（即用户隔离）
- 进度计算的 6 类素材类型与前端 `uploadGroups` 配置一致

---

## v2.0.0 - 2026-04-23

### Added
- 初始版本，达人素材库管理功能完整开发（V2.0 新增工具）
- 支持多达人档案管理（人格档案 + 内容规划在线编辑与保存）
- 支持 6 类素材分类管理（添加、展示、删除）
- 支持抖音视频信息抓取（TikHub）+ 语音转文字（阿里云 ASR）
- 支持 AI 流式对话，以达人档案和素材为上下文生成仿写文案
- 提供 `/api/personas` 接口作为其他仿写工具的共享达人数据源
- 新增 `README.md` 和 `CHANGELOG.md` 文档

### Notes
- 本服务的 `/api/personas` 被 persona-writer、qianchuan-writer、seeding-writer 依赖，需优先保证服务在线
- `data/personas/` 目录需手动在服务器创建达人子目录，前端无法新建达人
- `YUNWU_API_KEY` 和 `YUNWU_BASE_URL` 无默认值，未配置时运行时报错
