# Changelog

记录 Ai_Toolbox 整个项目的重要里程碑和各模块版本变更汇总。

---

## v1.5.0 - 2026-05-16

### Added
- 新增根目录 `AI工具箱开发文档.md`：完整架构说明、14 个服务清单、环境变量矩阵、API 路由清单、数据存储说明、部署操作手册、Nginx 配置参考

### Changed
- 更新 `portal` 导航页：补全 14 个工具的入口卡片

---

## v1.4.0 - 2026-05-12

### Added
- `qianchuan-review-web`：千川脚本复盘工具上线（端口 3012）
- `qianchuan-collection-web`：千川素材收集工具上线（端口 3015）
- `livestream-writer-web`：直播脚本仿写工具上线（端口 3013）
- `livestream-review-web`：直播复盘工具上线（端口 3014）

---

## v1.3.0 - 2026-05-11

### Added
- `selling-point-extractor-web`：产品卖点提取器上线（端口 3011），支持文件上传解析与多轮 AI 追问

---

## v1.2.0 - 2026-04-28

### Added
- `persona-review-web`：人设脚本复盘工具上线（端口 3010）

---

## v1.1.0 - 2026-04-27

### Added
- `tiktok-writer-web`：TikTok 平台脚本仿写工具上线（端口 3009），支持导出 Word

---

## v1.0.0 - 2026-04-19

### Added
首批工具上线，完成项目基础搭建：

- `persona-writer-web`：人设脚本仿写助手（端口 3001）
- `seeding-writer-web`：种草脚本仿写助手（端口 3003）
- `persona-positioning-web`：人设定位 / 对标分析（端口 3004 + 3006，同源双路由）
- `qianchuan-writer-web`：千川脚本仿写助手（端口 3005）
- `kol-intake-web`：红人信息采集（端口 3007）
- `material-library-web`：素材库（端口 3008）
- `portal`：静态 HTML 导航门户

### Notes
- 技术栈确定：Next.js 14 + TypeScript + TailwindCSS + PM2 + Nginx
- 外部依赖接入：云雾 AI（大模型）、TikHub（抖音数据）、阿里云 OSS + ASR（视频转录）
- 数据存储方案确定：文件系统（JSON + Markdown），无数据库
