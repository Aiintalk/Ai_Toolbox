# material-library-web — 素材库

## 1. 项目定位

达人档案和参考素材的集中管理工具。是整个工具箱的**底层数据中心**，人设脚本仿写、种草仿写、千川仿写等工具均通过调用本服务的 API 获取达人风格数据。

- **basePath**：`/material-library`
- **端口**：3008
- **服务器路径**：`/opt/material-library/`

## 2. 核心功能

- **达人管理**：创建、编辑、删除达人档案（包含人格档案 soul.md 和内容规划 content-plan.md）
- **参考素材管理**：为每个达人添加参考文案（标题、点赞数、分类、内容），支持删除
- **AI 对话**：在素材库界面直接与 AI 对话，辅助整理和分析素材
- **视频转录**：通过 TikHub 获取视频信息，通过阿里云 ASR 转录视频文案后保存为参考素材
- **红人采集联动**：自动读取 kol-intake 服务的提交记录，展示在对应达人档案中

## 3. 数据存储

文件系统存储，目录结构：

```
/opt/material-library/data/personas/
├── {达人名}/
│   ├── soul.md            ← 人格档案
│   ├── content-plan.md    ← 内容规划
│   └── references/
│       ├── 001_xxx.md     ← 参考素材（按文件名排序）
│       └── 002_xxx.md
└── _deleted.json          ← 已删除达人名单（软删除标记）
```

## 4. API 路由

| 路由 | 方法 | 功能 |
|------|------|------|
| `/material-library/api/personas` | GET | 获取所有达人列表（含档案内容、参考素材、采集报告） |
| `/material-library/api/personas` | POST | 创建新达人 |
| `/material-library/api/personas` | PUT | 更新达人档案字段（soul 或 contentPlan） |
| `/material-library/api/personas` | DELETE | 删除达人（软删除，写入 `_deleted.json`） |
| `/material-library/api/personas/references` | POST | 为达人添加参考素材 |
| `/material-library/api/personas/references` | DELETE | 删除参考素材 |
| `/material-library/api/chat` | POST | AI 对话（流式输出） |
| `/material-library/api/fetch-video` | POST | 通过 TikHub 获取视频信息 |
| `/material-library/api/transcribe/upload` | POST | 上传视频到 OSS 并提交转录 |
| `/material-library/api/transcribe/poll` | POST | 轮询转录结果 |

## 5. 目录结构

```
material-library-web/
├── app/
│   ├── page.tsx
│   └── api/
│       ├── personas/route.ts         ← CRUD + 联动 kol-intake
│       ├── personas/references/route.ts
│       ├── chat/route.ts
│       ├── fetch-video/route.ts
│       └── transcribe/upload & poll
├── lib/
│   ├── yunwu.ts
│   ├── tikhub.ts
│   ├── aliyun-oss.ts
│   └── aliyun-asr.ts
├── data/personas/            ← 本地开发用数据
└── next.config.js            ← basePath: '/material-library'
```

## 6. 环境变量

| 变量名 | 说明 |
|--------|------|
| `YUNWU_API_KEY` | 云雾 AI API 密钥 |
| `YUNWU_BASE_URL` | 云雾 AI API 地址 |
| `TIKHUB_API_KEY` | TikHub 抖音数据 API 密钥 |
| `ALIYUN_ACCESS_KEY_ID` | 阿里云 AccessKey ID |
| `ALIYUN_ACCESS_KEY_SECRET` | 阿里云 AccessKey Secret |
| `ALIYUN_APPKEY` | 阿里云语音识别 AppKey |

## 7. 注意事项

- 本服务是其他工具的数据依赖，**需最先启动**
- personas GET 接口会同时读取 `/opt/kol-intake/data/` 目录，两个服务需部署在同一台机器
- 删除达人采用软删除（写入 `_deleted.json`），不立即删除文件
