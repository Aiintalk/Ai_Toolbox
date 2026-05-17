# qianchuan-writer-web — 千川脚本仿写助手

## 1. 项目定位

千川投流素材的对标仿写工具。基于产品信息和对标视频文案，生成适合投放的千川短视频脚本。

- **basePath**：`/qianchuan-writer`
- **端口**：3005
- **服务器路径**：`/opt/qianchuan-writer/`

## 2. 使用流程

**第一步：填写产品信息**
- 手动填写产品名称、品类、价格、卖点等，或上传产品文件（Word/PDF/Excel）自动解析

**第二步：对标验证**
- 粘贴抖音分享链接，解析对标千川视频信息
- 粘贴或转录口播文案

**第三步：仿写创作**
- AI 结合产品信息与对标结构生成千川脚本
- 支持多轮迭代修改

## 3. API 路由

| 路由 | 方法 | 功能 |
|------|------|------|
| `/qianchuan-writer/api/chat` | POST | AI 对话/脚本生成（流式输出） |
| `/qianchuan-writer/api/fetch-video` | POST | 通过 TikHub 解析抖音视频信息 |
| `/qianchuan-writer/api/parse-file` | POST | 解析上传文件（通用文档解析） |
| `/qianchuan-writer/api/parse-product` | POST | 解析产品 Brief 文件 |
| `/qianchuan-writer/api/personas` | GET | 读取达人列表 |
| `/qianchuan-writer/api/transcribe/upload` | POST | 上传视频并提交 ASR 转录 |
| `/qianchuan-writer/api/transcribe/poll` | POST | 轮询转录结果 |

## 4. 目录结构

```
qianchuan-writer-web/
├── app/
│   ├── page.tsx
│   └── api/
│       ├── chat/route.ts
│       ├── fetch-video/route.ts
│       ├── parse-file/route.ts
│       ├── parse-product/route.ts
│       ├── personas/route.ts
│       └── transcribe/upload & poll
├── lib/
│   ├── yunwu.ts
│   ├── tikhub.ts
│   ├── aliyun-oss.ts
│   └── aliyun-asr.ts
└── next.config.js            ← basePath: '/qianchuan-writer'
```

## 5. 环境变量

| 变量名 | 说明 |
|--------|------|
| `YUNWU_API_KEY` | 云雾 AI API 密钥 |
| `YUNWU_BASE_URL` | 云雾 AI API 地址 |
| `TIKHUB_API_KEY` | TikHub 抖音数据 API 密钥 |
| `ALIYUN_ACCESS_KEY_ID` | 阿里云 AccessKey ID |
| `ALIYUN_ACCESS_KEY_SECRET` | 阿里云 AccessKey Secret |
| `ALIYUN_APPKEY` | 阿里云语音识别 AppKey |
