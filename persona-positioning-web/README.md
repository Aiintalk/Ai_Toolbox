# persona-positioning-web — 人设定位助手 / 对标分析助手

## 1. 项目定位

对标账号的系统化拆解与分析工具，输出达人人格档案与内容规划。本项目同时承担两个路由：

- `/persona-positioning`（端口 3006）— 当前主路由，功能完整版
- `/benchmark-analyzer`（端口 3004）— 旧版路由，服务器上同源部署

- **服务器路径**：`/opt/persona-positioning/` 和 `/opt/benchmark-analyzer/`

## 2. 核心功能

- **抓取对标账号**：输入抖音号或账号链接，通过 TikHub API 抓取达人信息和 Top10 视频
- **AI 生成人格档案**：基于账号信息和视频数据，流式生成达人人格档案 + 内容规划（使用 `claude-opus-4-6-thinking` 模型）
- **AI 对话迭代**：支持多轮对话优化输出结果
- **历史记录**：支持保存、查看、删除历史生成记录（存储在服务器文件系统）
- **导出文档**：导出 Word 文档（人格档案）和问卷文件
- **同步素材库**：一键将生成的人格档案同步到素材库（供其他工具使用）
- **文件解析**：支持上传 Word/PDF/TXT 作为补充资料

## 3. API 路由

| 路由 | 方法 | 功能 |
|------|------|------|
| `/persona-positioning/api/generate` | POST | AI 生成人格档案 + 内容规划（流式输出） |
| `/persona-positioning/api/chat` | POST | AI 对话（优化迭代，流式输出） |
| `/persona-positioning/api/fetch-account` | POST | 通过 TikHub 抓取达人信息和 Top10 视频 |
| `/persona-positioning/api/parse-file` | POST | 解析上传文件（Word/PDF/TXT → 文本） |
| `/persona-positioning/api/history` | GET | 获取历史记录列表，`?id=xxx` 获取单条 |
| `/persona-positioning/api/history` | POST | 保存历史记录 |
| `/persona-positioning/api/history` | DELETE | 删除历史记录 `?id=xxx` |
| `/persona-positioning/api/sync-to-library` | POST | 同步人格档案到素材库 |
| `/persona-positioning/api/export-word` | POST | 导出 Word 文档 |
| `/persona-positioning/api/export-questionnaire` | POST | 导出问卷 |
| `/persona-positioning/api/kol-submissions` | GET | 获取红人采集表提交列表 |
| `/persona-positioning/api/benchmark-list` | GET | 获取素材库中已有对标达人列表 |

## 4. 数据存储

- 历史记录：`/opt/persona-positioning/data/history/*.json`（每条记录一个 JSON 文件）

## 5. 目录结构

```
persona-positioning-web/
├── app/
│   ├── page.tsx              ← 主页面
│   └── api/
│       ├── generate/route.ts
│       ├── chat/route.ts
│       ├── fetch-account/route.ts
│       ├── parse-file/route.ts
│       ├── history/route.ts
│       ├── sync-to-library/route.ts
│       ├── export-word/route.ts
│       ├── export-questionnaire/route.ts
│       ├── kol-submissions/route.ts
│       └── benchmark-list/route.ts
├── lib/
│   ├── yunwu.ts
│   └── tikhub.ts
├── data/history/             ← 历史记录存储目录
└── next.config.js            ← basePath: '/persona-positioning'
```

## 6. 环境变量

| 变量名 | 说明 |
|--------|------|
| `YUNWU_API_KEY` | 云雾 AI API 密钥 |
| `YUNWU_BASE_URL` | 云雾 AI API 地址 |
| `TIKHUB_API_KEY` | TikHub 抖音数据 API 密钥 |

## 7. 注意事项

- AI 生成使用 `claude-opus-4-6-thinking` 模型（extended thinking），内容较长，Nginx 的 `proxy_read_timeout` 需设为 600s
- `sync-to-library` 接口直接写入 material-library 服务的文件系统，需确保两个服务部署在同一台机器
