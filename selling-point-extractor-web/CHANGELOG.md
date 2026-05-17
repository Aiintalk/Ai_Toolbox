# Changelog — selling-point-extractor-web

## v1.1.0 - 2026-05-16

### Added
- 支持上传 `.pages` 文件（Apple Pages 格式，依赖 jszip + snappyjs 解析）
- 分析完成后新增"和AI聊聊"对话入口，支持多轮追问
- 新增"最终卖点卡"展示块，支持一键复制及下载（文件名：极致卖点卡.md）

### Removed
- 移除"去写千川脚本"跳转按钮

### Dependencies
- 新增 jszip ^3.10.1
- 新增 snappyjs ^0.7.0

## v1.0.0 - 2026-05-11

### Added
- 初始版本上线
- 支持上传多份产品 Brief 和达人文案（Word/PDF/TXT）
- AI 沿四个固定维度分析卖点：机制分析 / 产品优势 / 使用场景 / 社会认证
- 多轮追问对话支持
- 历史记录保存、查看、删除（文件系统存储）
