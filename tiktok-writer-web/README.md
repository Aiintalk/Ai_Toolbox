# tiktok-writer-web — TikTok 脚本仿写助手

## 1. 项目定位

TikTok 平台短视频脚本的对标仿写工具。用户手动输入 TikTok 视频链接和文案，选择达人风格后由 AI 生成仿写脚本。

- **basePath**：`/tiktok-writer`
- **端口**：3009
- **服务器路径**：`/opt/tiktok-writer/`

## 2. 使用流程

**第一步：输入对标信息**
- 粘贴 TikTok 视频链接（目前需手动输入点赞数，TikHub 暂不直接支持 TikTok 数据抓取）
- 粘贴视频口播文案

**第二步：开头验证 + 选择风格**
- AI 评估视频开头吸引力
- 从素材库选择目标达人风格

**第三步：仿写创作**
- AI 分析对标结构并生成仿写脚本
- 支持多轮迭代修改
- 导出 Word 文档

## 3. API 路由

| 路由 | 方法 | 功能 |
|------|------|------|
| `/tiktok-writer/api/chat` | POST | AI 对话/脚本生成（流式输出） |
| `/tiktok-writer/api/export-word` | POST | 导出 Word 文档 |

## 4. 目录结构

```
tiktok-writer-web/
├── app/
│   ├── page.tsx
│   └── api/
│       ├── chat/route.ts
│       └── export-word/route.ts
├── lib/
│   └── yunwu.ts
└── next.config.js            ← basePath: '/tiktok-writer'
```

## 5. 环境变量

| 变量名 | 说明 |
|--------|------|
| `YUNWU_API_KEY` | 云雾 AI API 密钥 |
| `YUNWU_BASE_URL` | 云雾 AI API 地址 |

## 6. 注意事项

- 与抖音仿写类工具不同，本工具**无视频自动解析**功能，文案需用户手动获取粘贴
- 无阿里云 ASR 依赖，无 TikHub 依赖
