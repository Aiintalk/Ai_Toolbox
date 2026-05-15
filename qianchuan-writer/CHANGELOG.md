# Changelog

记录本项目的重要功能变更、问题修复和文档更新。

---

## v2.0.1 - 2026-05-15

### Fixed
- 对照代码审查 README.md，修正 8 处与实际代码不一致的描述
- 修正达人列表来源说明（前端实际跨服务调用 `/material-library/api/personas`）
- 补充多文件批量上传、原创度自检、医美锚定字段、字数校验逻辑等功能描述
- 修正目录结构（移除不存在的 `references/` 子目录，补充 `postcss.config.js`）
- 新增已知问题：`medicalAestheticAnchor` 字段前端未展示
- 测试表新增「原创度自检」测试项

### Notes
- 本次无代码改动，仅文档更新

---

## v2.0.0 - 2026-04-08

### Added
- 初始版本，四步千川脚本仿写流程完整开发
- 支持产品文档上传与结构化卖点提炼（三种卖点顺序）
- 支持抖音视频自动转录（ASR）或手动粘贴文案
- 支持 AI 提取爆款开头并标注类型
- 支持 AI 流式生成千川口播脚本，自动字数校验与压缩
- 支持多轮对话迭代修改
- 新增 `README.md` 和 `CHANGELOG.md` 文档

### Notes
- 达人列表调用 `/material-library/api/personas`，需配合 material-library 服务部署
- OSS Bucket 名称硬编码为 `hersystem-media-tmp`，更换需修改源码
