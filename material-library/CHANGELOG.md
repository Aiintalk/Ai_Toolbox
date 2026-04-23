# Changelog

记录本项目的重要功能变更、问题修复和文档更新。

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
