# livestream-writer-web — 直播间脚本仿写助手

## 1. 项目定位

直播带货讲解脚本的对标仿写工具。上传或粘贴对标直播脚本，AI 按达人风格生成仿写版本。

- **basePath**：`/livestream-writer`
- **端口**：3013
- **服务器路径**：`/opt/livestream-writer/`

## 2. 核心功能

- **文件上传解析**：支持上传对标直播脚本文件（Word/PDF/TXT）
- **AI 仿写生成**：基于上传内容和选定风格生成直播脚本（流式输出）
- **多轮迭代修改**：支持对话式修改优化

## 3. API 路由

| 路由 | 方法 | 功能 |
|------|------|------|
| `/livestream-writer/api/chat` | POST | AI 对话/仿写生成（流式输出） |
| `/livestream-writer/api/parse-file` | POST | 解析上传文件（Word/PDF/TXT → 文本） |

## 4. 目录结构

```
livestream-writer-web/
├── app/
│   ├── page.tsx
│   └── api/
│       ├── chat/route.ts
│       └── parse-file/route.ts
├── lib/
│   └── yunwu.ts
└── next.config.js            ← basePath: '/livestream-writer'
```

## 5. 环境变量

| 变量名 | 说明 |
|--------|------|
| `YUNWU_API_KEY` | 云雾 AI API 密钥 |
| `YUNWU_BASE_URL` | 云雾 AI API 地址 |
