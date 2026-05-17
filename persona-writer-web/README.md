# persona-writer-web — 人设脚本仿写助手

## 1. 项目定位

基于对标视频和达人风格档案，三步完成人设短视频口播脚本仿写。

- **basePath**：`/persona-writer`
- **端口**：3001
- **服务器路径**：`/opt/persona-writer/`

## 2. 使用流程

**第一步：加载风格**
- 从素材库（`/material-library`）读取已有达人列表
- 选择目标达人，加载其人格档案（soul.md）、内容规划（content-plan.md）和参考素材

**第二步：对标验证**
- 粘贴抖音分享链接，调用 TikHub API 解析视频点赞量（需 ≥ 10 万才通过质量门）
- 用外部工具转写文案后粘贴到文本框，或自动调用阿里云 ASR 转录
- AI 评估开头吸引力（通过/不通过）

**第三步：仿写创作**
- AI 拆解对标结构，生成结构分析
- 用户选择仿写方向：「我有想法」（自定义选题）或「AI 直接写」
- 流式输出脚本，支持图片上传和多轮迭代修改
- 预览终稿、手动替换开头后导出 Word 文档

## 3. API 路由

| 路由 | 方法 | 功能 |
|------|------|------|
| `/persona-writer/api/chat` | POST | AI 对话/仿写生成（流式输出） |
| `/persona-writer/api/export-word` | POST | 导出 Word 文档 |
| `/persona-writer/api/fetch-video` | POST | 通过 TikHub 解析抖音视频信息 |
| `/persona-writer/api/personas` | GET | 从素材库读取达人列表（代理请求） |
| `/persona-writer/api/personas/references` | POST/DELETE | 添加/删除达人参考素材 |
| `/persona-writer/api/transcribe/upload` | POST | 上传视频到 OSS 并提交转录任务 |
| `/persona-writer/api/transcribe/poll` | POST | 轮询阿里云 ASR 转录结果 |

## 4. 目录结构

```
persona-writer-web/
├── app/
│   ├── page.tsx              ← 主页面（三步流程全部在此，单文件组件）
│   ├── layout.tsx
│   ├── globals.css
│   └── api/
│       ├── chat/route.ts
│       ├── export-word/route.ts
│       ├── fetch-video/route.ts
│       ├── personas/route.ts
│       ├── personas/references/route.ts
│       └── transcribe/upload/route.ts & poll/route.ts
├── lib/
│   ├── yunwu.ts              ← 云雾 AI 流式调用封装
│   ├── tikhub.ts             ← TikHub 抖音数据 API
│   ├── aliyun-oss.ts         ← 阿里云 OSS 上传
│   └── aliyun-asr.ts         ← 阿里云语音转录
├── data/                     ← 本地开发用数据目录（生产环境在 material-library 服务下）
├── next.config.js            ← basePath: '/persona-writer'
└── .env.local                ← YUNWU_API_KEY / TIKHUB_API_KEY / ALIYUN_*
```

## 5. 环境变量

| 变量名 | 说明 |
|--------|------|
| `YUNWU_API_KEY` | 云雾 AI API 密钥 |
| `YUNWU_BASE_URL` | 云雾 AI API 地址（`https://api.yunwu.ai/v1`） |
| `TIKHUB_API_KEY` | TikHub 抖音数据 API 密钥 |
| `ALIYUN_ACCESS_KEY_ID` | 阿里云 AccessKey ID |
| `ALIYUN_ACCESS_KEY_SECRET` | 阿里云 AccessKey Secret |
| `ALIYUN_APPKEY` | 阿里云语音识别 AppKey |

## 6. 注意事项

- 达人档案数据存储在 `material-library` 服务的文件系统中（`/opt/material-library/data/personas/`），本工具通过跨服务 API 调用读取
- 仿写 prompt 硬编码在 `page.tsx` 中，调整写作风格需直接修改 system prompt
- 默认 AI 模型为 `claude-opus-4-6-thinking`，可通过 `model` 参数覆盖
