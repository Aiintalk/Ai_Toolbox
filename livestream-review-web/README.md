# livestream-review-web — 直播间脚本复盘助手

## 1. 项目定位

直播带货内容的数据复盘与优化分析工具。上传直播脚本或相关数据，AI 分析表现并给出改进建议。

- **basePath**：`/livestream-review`
- **端口**：3014
- **服务器路径**：`/opt/livestream-review/`

## 2. 核心功能

- **文件上传解析**：支持上传直播脚本或数据文件（Word/PDF/TXT/Excel）
- **AI 复盘分析**：分析直播内容表现，输出复盘报告（流式输出）
- **多轮追问**：支持深入分析
- **复盘报告**：保存分析结果，支持历史查看

## 3. API 路由

| 路由 | 方法 | 功能 |
|------|------|------|
| `/livestream-review/api/chat` | POST | AI 对话/复盘分析（流式输出） |
| `/livestream-review/api/parse-file` | POST | 解析上传文件 |
| `/livestream-review/api/reports` | GET | 获取历史复盘报告 |
| `/livestream-review/api/reports` | POST | 保存复盘报告 |

## 4. 目录结构

```
livestream-review-web/
├── app/
│   ├── page.tsx
│   └── api/
│       ├── chat/route.ts
│       ├── parse-file/route.ts
│       └── reports/route.ts
├── lib/
│   └── yunwu.ts
└── next.config.js            ← basePath: '/livestream-review'
```

## 5. 环境变量

| 变量名 | 说明 |
|--------|------|
| `YUNWU_API_KEY` | 云雾 AI API 密钥 |
| `YUNWU_BASE_URL` | 云雾 AI API 地址 |
