# qianchuan-review-web — 千川脚本复盘助手

## 1. 项目定位

千川投流素材的数据复盘与效果分析工具。上传投放数据或文案，AI 分析哪些脚本跑量好、哪些需要优化。

- **basePath**：`/qianchuan-review`
- **端口**：3012
- **服务器路径**：`/opt/qianchuan-review/`

## 2. 核心功能

- **文件上传解析**：支持上传千川后台导出的数据文件（Excel/CSV/Word/PDF）
- **AI 复盘分析**：分析脚本表现，输出优化建议（流式输出）
- **多轮对话**：支持深入追问
- **复盘报告**：保存分析结果，支持历史查看

## 3. API 路由

| 路由 | 方法 | 功能 |
|------|------|------|
| `/qianchuan-review/api/chat` | POST | AI 对话/复盘分析（流式输出） |
| `/qianchuan-review/api/parse-file` | POST | 解析上传文件 |
| `/qianchuan-review/api/reports` | GET | 获取历史复盘报告 |
| `/qianchuan-review/api/reports` | POST | 保存复盘报告 |

## 4. 目录结构

```
qianchuan-review-web/
├── app/
│   ├── page.tsx
│   └── api/
│       ├── chat/route.ts
│       ├── parse-file/route.ts
│       └── reports/route.ts
├── lib/
│   └── yunwu.ts
└── next.config.js            ← basePath: '/qianchuan-review'
```

## 5. 环境变量

| 变量名 | 说明 |
|--------|------|
| `YUNWU_API_KEY` | 云雾 AI API 密钥 |
| `YUNWU_BASE_URL` | 云雾 AI API 地址 |
