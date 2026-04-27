# Changelog

记录本项目的重要功能变更、问题修复和文档更新。

---

## v1.1.0 - 2026-04-28

### Added
- 接入 `@ai-toolbox/auth-shared`：`api/kol-submissions` 增加 `getSession` 校验
- KOL 仅能看到自己的 KOL 提交（`userId === session.username`），员工/管理员看全部

---

## v2.0.0 - 2026-04-23

### Added
- 初始版本，三步人设定位流程完整开发（V2.0 新增工具）
- 支持抖音账号数据自动抓取（TikHub），提取点赞 TOP10 文案
- 支持上传达人采集表（Word / PDF / TXT / MD）进行文件解析
- 支持从 kol-intake 已采集数据中直接导入达人信息
- 支持上传对标账号人格档案 / 内容规划作为生成参考
- AI 流式生成人格档案与内容规划（`claude-sonnet-4-6`）
- 支持结果复制与 Word 导出
- 提供达人入职信息采集表模板下载
- 新增 `README.md` 和 `CHANGELOG.md` 文档

### Notes
- `/api/kol-submissions` 硬编码读取 `/opt/kol-intake/data/` 目录，需与 kol-intake 同机部署
- 文件解析截断 8000 字，超长文档需注意拆分
