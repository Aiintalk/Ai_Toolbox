# seeding-writer-web — 种草内容仿写助手

## 1. 项目定位

面向种草内容场景，通过四步引导完成偏真实感、情绪表达的种草脚本仿写创作：选人设 → 提炼卖点 → 对标视频转录 → 生成种草脚本，支持多轮迭代。

## 2. 当前功能

- 加载达人人设（含种草素材库）
- 上传产品文档（PDF / Word / Excel / PPT / TXT），AI 提炼种草向卖点
- 输入种草视频链接，自动转录文案并分析内容结构
- AI 生成强调真实体验感和消费者情绪的种草脚本
- 支持多轮追加需求迭代

**千川 vs 种草的核心区别：**

| 维度 | 千川（qianchuan） | 种草（seeding） |
|------|-------------------|-----------------|
| 目标 | 直接转化，促下单 | 种草，建立信任 |
| 卖点逻辑 | 背书 → 机制 → 种草 | 价格锚定 > 情绪冲击 > 数据精选 |
| 脚本风格 | 利益驱动，行动号召明确 | 真实体验感、五感描写、自然植入 |

## 3. 使用流程

**Step 1 — 选择人设**
1. 从列表中选择达人人设，加载 soul.md 和内容规划

**Step 2 — 提炼卖点**
1. 上传产品文档
2. AI 按种草逻辑提炼卖点（侧重情绪价值、使用体验、价格锚定）
3. 可追加需求调整卖点，确认后进入下一步

**Step 3 — 对标视频转录**
1. 输入种草视频分享链接
2. 系统自动转录视频文案
3. AI 分析对标视频结构
4. 选择主题：沿用 / 自定义 / AI 推荐

**Step 4 — 生成脚本**
1. AI 流式生成种草风格脚本
2. 可追加需求进行多轮迭代修改

## 4. 目录结构

```
seeding-writer-web/
├── app/
│   ├── page.tsx                      # 主页面（四步引导流程）
│   ├── layout.tsx
│   ├── globals.css
│   └── api/
│       ├── chat/route.ts             # AI 流式对话接口
│       ├── fetch-video/route.ts      # 抖音视频信息抓取
│       ├── parse-product/route.ts    # 产品文档解析
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
│       └── references/               # 素材库（含种草文案类型）
├── next.config.js
├── tailwind.config.js
├── tsconfig.json
└── package.json
```

## 5. 核心接口 / 核心模块

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/chat` | POST | AI 流式输出，body: `{ messages, systemPrompt }` |
| `/api/parse-product` | POST | multipart/form-data，解析产品文档，返回产品信息 JSON |
| `/api/fetch-video` | POST | 抓取抖音视频信息，body: `{ shareUrl }` |
| `/api/transcribe/upload` | POST | 上传视频到 OSS 并提交 ASR，返回 `{ taskId }` |
| `/api/transcribe/poll` | POST | 轮询转录结果，返回 `{ status, text? }` |
| `/api/personas` | GET | 返回人设列表 `{ personas: [...] }` |
| `/api/personas/references` | POST/DELETE | 素材库管理 |

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
cd seeding-writer-web
npm install
npm run dev
```

访问地址：`http://localhost:3000`（basePath 为根路径）

## 7. 开发注意事项

- `basePath` 为根路径 `/`，接口调用路径以 `/seeding-writer` 为 basePath（部署时）
- 种草素材库中的素材类型默认为「种草文案」，与千川素材库在同一目录结构下
- `parse-product` 接口依赖 `mammoth` 库解析 Word 文档，该依赖存在缺失风险（已知技术债），部署前需确认已安装
- 脚本风格与千川不同，Prompt 构建时需强调真实感、五感描写、自然植入，避免硬广感
- OSS 上传后的临时文件不会自动清理（已知技术债）

## 8. 当前状态 / 已知问题

- **完成度**：核心功能完整，已开发（Portal 导航页尚未接入链接）
- **已知问题**：
  - **`mammoth` 依赖缺失**：DOCX 解析功能在未安装 `mammoth` 时会直接 crash，部署前必须确认
  - Portal 导航页未显示此工具的跳转入口
  - OSS 临时文件不清理
  - `SimpleMarkdown` 存在 XSS 风险
  - 无身份验证

## 9. 文档更新说明

- **2026-04-19**：初次创建 README，基于当前代码整理
