# 短视频字幕提取工具

达人说AI工具箱子应用，支持抖音视频字幕提取、Excel批量处理和AI思维导图生成。

## 功能

- **单条提取**：粘贴抖音分享链接，自动解析视频并提取字幕文案
- **Excel批量**：上传包含抖音链接的Excel，批量提取字幕并下载结果
- **AI思维导图**：基于字幕内容，AI生成运营视角的内容结构导图
- **一键下载**：上传Excel后自动完成提取并触发下载，无需手动操作

## 技术栈

- **框架**：Next.js 14（App Router）
- **语言**：TypeScript
- **样式**：Tailwind CSS
- **视频解析**：TikHub API
- **语音转写**：阿里云 ASR + 阿里云 OSS
- **AI生成**：云雾 AI（兼容OpenAI协议）
- **任务存储**：本地文件系统（`data/batch-jobs/`）

## 目录结构

```
subtitle-extractor-web/
├── app/
│   ├── api/
│   │   ├── parse-video/         # 视频解析接口
│   │   ├── transcribe/
│   │   │   ├── upload/          # 上传OSS + 提交ASR
│   │   │   └── poll/            # 轮询ASR结果
│   │   ├── mindmap/             # AI思维导图生成
│   │   └── batch/
│   │       ├── import/          # Excel批量上传
│   │       ├── status/          # 任务进度查询
│   │       └── export/          # 下载结果Excel
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── lib/
│   ├── tikhub.ts                # TikHub视频解析
│   ├── aliyun-asr.ts            # 阿里云语音识别
│   ├── aliyun-oss.ts            # 阿里云对象存储
│   ├── yunwu.ts                 # 云雾AI调用
│   └── batch-store.ts           # 批量任务文件读写
├── data/
│   └── batch-jobs/              # 批量任务状态文件（JSON）
├── API_CONTRACT.md              # 接口格式文档
└── package.json
```

## 环境变量

复制 `../env.template` 为 `.env.local`，以下变量均为必填：

```env
# TikHub（视频解析）
TIKHUB_API_KEY=

# 阿里云（语音转写 + 文件存储）
ALIYUN_ACCESS_KEY_ID=
ALIYUN_ACCESS_KEY_SECRET=
ALIYUN_APPKEY=

# 云雾 AI（思维导图生成）
YUNWU_API_KEY=
YUNWU_BASE_URL=https://api.yunwu.ai/v1
```

## 本地开发

```bash
# 安装依赖
npm install

# 启动开发服务器（端口 3012）
npm run dev
```

访问 `http://localhost:3012/subtitle-extractor`

## 生产部署

本应用通过根目录的 `deploy-all.sh` 统一部署，已自动包含在部署流程中。

如需单独部署：

```bash
# 1. 复制代码到服务器
cp -r subtitle-extractor-web /opt/subtitle-extractor

# 2. 配置环境变量
cp ../env.template /opt/subtitle-extractor/.env.local
# 编辑 .env.local，填入真实 Key

# 3. 安装依赖并构建
cd /opt/subtitle-extractor
npm install
npm run build

# 4. 用 PM2 启动
pm2 start npm --name "subtitle-extractor" -- start
pm2 save
```

Nginx 代理规则已在 `../nginx-portal.conf` 中配置，访问路径为 `/subtitle-extractor`。

## 接口文档

详见 [API_CONTRACT.md](./API_CONTRACT.md)，包含全部7个接口的请求/响应格式示例。

## 注意事项

- Excel 文件要求：A列为抖音链接，首行为标题行自动跳过，单次最多 200 条
- 批量任务状态持久化在 `data/batch-jobs/` 目录，PM2重启后可继续查询历史结果
- 单条ASR轮询间隔3秒，批量任务轮询间隔5秒
- 思维导图结果在前端缓存，同一视频切换时不重复调用AI
