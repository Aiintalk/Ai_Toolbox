# persona-review-web — 人设脚本复盘助手

## 1. 项目定位

对已发布的人设短视频进行数据复盘和风格校准，帮助分析哪些内容表现好、哪些需要改进。

- **basePath**：`/persona-review`
- **端口**：3010
- **服务器路径**：`/opt/persona-review/`

## 2. 核心功能

- **视频列表获取**：通过 TikHub 抓取指定账号的视频列表及数据
- **AI 复盘分析**：基于视频数据和文案进行 AI 分析，输出复盘报告
- **复盘报告管理**：保存和查看历史复盘报告

## 3. API 路由

| 路由 | 方法 | 功能 |
|------|------|------|
| `/persona-review/api/chat` | POST | AI 对话/复盘分析（流式输出） |
| `/persona-review/api/fetch-videos` | POST | 通过 TikHub 获取账号视频列表 |
| `/persona-review/api/reports` | GET | 获取历史复盘报告列表 |
| `/persona-review/api/reports` | POST | 保存复盘报告 |

## 4. 目录结构

```
persona-review-web/
├── app/
│   ├── page.tsx
│   └── api/
│       ├── chat/route.ts
│       ├── fetch-videos/route.ts
│       └── reports/route.ts
├── lib/
│   ├── yunwu.ts
│   └── tikhub.ts
└── next.config.js            ← basePath: '/persona-review'
```

## 5. 环境变量

| 变量名 | 说明 |
|--------|------|
| `YUNWU_API_KEY` | 云雾 AI API 密钥 |
| `YUNWU_BASE_URL` | 云雾 AI API 地址 |
| `TIKHUB_API_KEY` | TikHub 抖音数据 API 密钥 |
