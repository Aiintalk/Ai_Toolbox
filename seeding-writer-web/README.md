# seeding-writer-web — 种草脚本仿写助手

## 1. 项目定位

基于产品信息和对标视频，仿写种草带货短视频口播脚本。与人设脚本仿写不同，本工具以**产品**为核心输入，需要先填写或上传产品信息。

- **basePath**：`/seeding-writer`
- **端口**：3003
- **服务器路径**：`/opt/seeding-writer/`

## 2. 使用流程

**第一步：加载产品与风格**
- 填写产品信息（名称、品类、价格、卖点、目标人群、使用场景），或上传产品 Brief 文件（Word/PDF/Excel）自动解析
- 选择达人风格（从素材库读取）

**第二步：对标验证**
- 粘贴抖音分享链接解析对标视频（需点赞量 ≥ 10 万）
- 粘贴或转录视频口播文案

**第三步：仿写创作**
- AI 结合产品信息与对标结构生成种草脚本
- 支持多轮迭代修改

## 3. API 路由

| 路由 | 方法 | 功能 |
|------|------|------|
| `/seeding-writer/api/chat` | POST | AI 对话/仿写生成（流式输出） |
| `/seeding-writer/api/fetch-video` | POST | 通过 TikHub 解析抖音视频信息 |
| `/seeding-writer/api/parse-product` | POST | 解析上传的产品文件（Word/PDF/Excel → 结构化产品信息） |
| `/seeding-writer/api/personas` | GET | 读取达人列表（代理素材库 API） |
| `/seeding-writer/api/personas/references` | POST/DELETE | 添加/删除达人参考素材 |
| `/seeding-writer/api/transcribe/upload` | POST | 上传视频到 OSS 并提交转录任务 |
| `/seeding-writer/api/transcribe/poll` | POST | 轮询转录结果 |

## 4. 目录结构

```
seeding-writer-web/
├── app/
│   ├── page.tsx              ← 主页面
│   └── api/
│       ├── chat/route.ts
│       ├── fetch-video/route.ts
│       ├── parse-product/route.ts
│       ├── personas/route.ts
│       ├── personas/references/route.ts
│       └── transcribe/upload & poll
├── lib/
│   ├── yunwu.ts
│   ├── tikhub.ts
│   ├── aliyun-oss.ts
│   └── aliyun-asr.ts
└── next.config.js            ← basePath: '/seeding-writer'
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
