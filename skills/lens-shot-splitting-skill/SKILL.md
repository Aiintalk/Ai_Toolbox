---
name: lens-shot-splitting-offline
short-description: 只做镜头切片，不做分类与评分（独立配置驱动）
description: "Split Lens Analysis videos into candidate and semantic shot clips only. Do not output shot category or quality scores."
metadata:
  short-description: 镜头拆分（仅切片）离线技能
---

# 镜头拆分（仅切片）离线技能

本技能用于把 Lens Analysis 的“分镜模块”做成可分发的独立运行包：

- 先做环境检测（Python、ffmpeg、ffprobe、依赖）
- 自动安装/同步依赖
- 自动执行 scan 与 final_shot（只切片）
- 只改 `split_only.config.env`，命令不需要改

> 该包默认使用自身目录下的 `backend/` 与 `config/`，不依赖外部项目路径。

调用时直接使用：

```bash
bash run_split_only.sh [--config path/to/your/config.env] [--check-only]
```

默认配置文件：`split_only.config.env`
