# qianchuan-writer-web — 千川脚本仿写助手

## 1. 项目定位

面向千川投流场景，通过四步引导完成投流素材脚本的拼合创作：选人设 → 提炼卖点 → 识别爆款开头 → 生成投流脚本，支持多轮迭代。

## 2. 当前功能

- 加载达人人设（含千川素材库）
- 上传产品文档（PDF / Word / Excel / PPT / TXT），AI 提炼三类卖点结构
- 卖点排列顺序可调整（背书-机制-种草 / 机制-背书-种草 / 背书-种草-机制）
- 输入千川视频链接，AI 识别并提取爆款开头类型
- 拼合最终脚本（爆款开头 + 卖点组合 + 行动号召），支持多轮迭代

## 3. 使用流程

**Step 1 — 选择人设**
1. 从列表中选择达人人设，加载 soul.md 和内容规划

**Step 2 — 提炼卖点**
1. 上传产品文档（支持多种格式）
2. AI 自动按三类卖点结构（背书 / 机制 / 种草）提炼核心卖点
3. 可追加需求调整卖点内容，选择卖点排列顺序
4. 确认卖点后进入下一步

**Step 3 — 识别爆款开头**
1. 输入千川爆款视频分享链接
2. 系统自动转录视频文案
3. AI 识别并提取开头类型与文案
4. 确认开头内容后进入下一步

**Step 4 — 生成脚本**
1. AI 拼合爆款开头 + 卖点组合 + 行动号召，流式生成完整投流脚本
2. 可追加需求进行多轮迭代修改

## 4. 目录结构

```
qianchuan-writer-web/
├── app/
│   ├── page.tsx                      # 主页面（四步引导流程）
│   ├── layout.tsx
│   ├── globals.css
│   └── api/
│       ├── chat/route.ts             # AI 流式对话接口
│       ├── fetch-video/route.ts      # 抖音视频信息抓取
│       ├── parse-product/route.ts    # 产品文档解析（multipart/form-data）
│       ├── transcribe/
│       │   ├── upload/route.ts       # 视频上传 OSS + 提交 ASR
│       │   └── poll/route.ts         # 轮询 ASR 转录结果
│       └── personas/
│           ├── route.ts              # 获取人设列表
│           └── references/route.ts  # 素材库增删接口
├── lib/
│   ├── yunwu.ts
│   ├── tikhub.ts
│   ├── aliyun-oss.ts
│   └── aliyun-asr.ts
├── data/
│   └── personas/{name}/
│       ├── soul.md
│       ├── content-plan.md
│       └── references/
├── next.config.js
├── tailwind.config.js
├── tsconfig.json
└── package.json
```

## 5. 核心接口 / 核心模块

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/chat` | POST | AI 流式输出，body: `{ messages, systemPrompt }` |
| `/api/parse-product` | POST | multipart/form-data，解析上传文档，返回产品信息 JSON |
| `/api/fetch-video` | POST | 抓取抖音视频信息，body: `{ shareUrl }` |
| `/api/transcribe/upload` | POST | 上传视频到 OSS 并提交 ASR，返回 `{ taskId }` |
| `/api/transcribe/poll` | POST | 轮询转录结果，返回 `{ status, text? }` |
| `/api/personas` | GET | 返回人设列表 `{ personas: [...] }` |
| `/api/personas/references` | POST/DELETE | 素材库管理 |

**卖点结构说明：**

| 卖点类型 | 说明 |
|----------|------|
| 背书 | 权威认证、专家推荐、用户口碑 |
| 机制 | 产品原理、成分、技术说明 |
| 种草 | 使用场景、情感价值、生活方式 |

## 6. 环境变量 / 运行要求

```env
YUNWU_API_KEY=               # AI API 密钥
YUNWU_BASE_URL=              # AI API 地址
TIKHUB_API_KEY=              # TikHub API 密钥
ALIYUN_ACCESS_KEY_ID=        # 阿里云 AccessKey
ALIYUN_ACCESS_KEY_SECRET=    # 阿里云 AccessSecret
ALIYUN_APPKEY=               # 阿里云 ASR AppKey
```

**运行：**
```bash
cd qianchuan-writer-web
npm install
npm run dev
```

访问地址：`http://localhost:3000/qianchuan-writer`

## 7. 开发注意事项

- `basePath` 为 `/qianchuan-writer`，所有接口调用需带此前缀
- 产品文档解析接口接收 `multipart/form-data`，支持 PDF/Word/Excel/PPT/TXT 格式
- 千川与种草的核心区别：千川侧重直接转化，种草侧重信任建立，两者卖点逻辑和脚本风格不同
- 素材库与 persona-writer 共用同一 `data/personas/` 目录，修改需注意数据一致性
- OSS 上传后的临时文件不会自动清理（已知技术债）

## 8. 当前状态 / 已知问题

- **完成度**：核心功能完整，已开发（Portal 导航页尚未接入链接）
- **已知问题**：
  - Portal 导航页未显示此工具的跳转入口
  - OSS 临时文件不清理
  - `SimpleMarkdown` 存在 XSS 风险
  - 无身份验证

## 9. 文档更新说明

- **2026-04-19**：初次创建 README，基于当前代码整理
- **2026-04-20**：测试TE0420
