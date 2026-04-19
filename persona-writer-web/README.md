# persona-writer-web — 人设脚本仿写助手

## 1. 项目定位

基于选定的达人人设风格，通过对标视频转录和 AI 评估，三步完成人设内容脚本的仿写创作，支持多轮迭代修改。

## 2. 当前功能

- 加载并切换达人人设（soul.md + content-plan.md + 素材库）
- 支持素材库管理：新增/删除爆款文案、喜欢的内容、风格参考等素材
- 输入抖音视频链接，自动转录视频文案
- AI 评估视频开头吸引力（质量门：点赞 ≥ 10 万）
- AI 拆解对标视频结构，提供主题选择（沿用 / 自定义 / AI 推荐）
- 流式生成仿写脚本，支持多轮追加需求迭代

## 3. 使用流程

**Step 1 — 加载风格**
1. 选择人设，查看 soul.md 和 content-plan.md
2. 可在素材库中添加参考内容（爆款文案 / 风格参考等）

**Step 2 — 对标验证**
1. 输入抖音视频分享链接
2. 系统自动下载视频、上传 OSS、调用阿里云 ASR 转录文案
3. 确认转录文案（可手动编辑）
4. AI 评估开头吸引力，判断是否达标（点赞 ≥ 10 万）

**Step 3 — 仿写创作**
1. AI 分析对标视频结构
2. 选择主题：沿用原视频 / 自定义 / AI 推荐
3. AI 流式生成仿写脚本
4. 可追加需求进行多轮迭代修改

## 4. 目录结构

```
persona-writer-web/
├── app/
│   ├── page.tsx                      # 主页面（三步引导流程）
│   ├── layout.tsx
│   ├── globals.css
│   └── api/
│       ├── chat/route.ts             # AI 流式对话接口
│       ├── fetch-video/route.ts      # 抖音视频信息抓取
│       ├── transcribe/
│       │   ├── upload/route.ts       # 视频上传 OSS + 提交 ASR 任务
│       │   └── poll/route.ts         # 轮询 ASR 转录结果
│       └── personas/
│           ├── route.ts              # 获取所有人设列表
│           └── references/route.ts  # 素材库增删接口
├── lib/
│   ├── yunwu.ts                      # AI API 封装
│   ├── tikhub.ts                     # TikHub API 封装
│   ├── aliyun-oss.ts                 # 阿里云 OSS 封装
│   └── aliyun-asr.ts                 # 阿里云 ASR 封装
├── data/
│   └── personas/{name}/
│       ├── soul.md                   # 人设人格档案
│       ├── content-plan.md           # 内容规划文档
│       └── references/               # 素材库（*.md，YAML frontmatter）
├── next.config.js
├── tailwind.config.js
├── tsconfig.json
└── package.json
```

## 5. 核心接口 / 核心模块

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/chat` | POST | AI 流式输出，body: `{ messages, systemPrompt }` |
| `/api/fetch-video` | POST | 抓取抖音视频信息，body: `{ shareUrl }` |
| `/api/transcribe/upload` | POST | 上传视频到 OSS 并提交 ASR，返回 `{ taskId }` |
| `/api/transcribe/poll` | POST | 轮询转录结果，返回 `{ status, text? }` |
| `/api/personas` | GET | 读取所有人设，返回 `{ personas: [...] }` |
| `/api/personas/references` | POST | 新增素材到人设素材库 |
| `/api/personas/references` | DELETE | 删除指定素材 |

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
cd persona-writer-web
npm install
npm run dev
```

访问地址：`http://localhost:3000`（basePath 为根路径）

## 7. 开发注意事项

- `basePath` 为根路径 `/`，接口调用不需要前缀
- 人设数据存储在 `data/personas/` 文件系统，不使用数据库，禁止随意修改 `soul.md` / `content-plan.md`
- 素材库文件使用 YAML frontmatter 格式，新增素材时需遵循现有格式
- 转录流程：视频下载 → 上传 OSS → 提交 ASR → 前端轮询结果，任一步骤失败均需给出明确错误提示
- `素材删除`接口存在已知 Bug（`__index_N__` 文件名问题），修复前请勿依赖删除功能
- Step 2 质量门（点赞 ≥ 10 万）当前有 `|| true` 绕过逻辑（line 816），生产环境需移除

## 8. 当前状态 / 已知问题

- **完成度**：核心功能完整，已上线
- **已知问题**：
  - 素材删除接口存在 Bug，`__index_N__` 文件名生成错误
  - Step 2 质量门被 `|| true` 绕过，未强制执行
  - OSS 上传后的临时文件不会自动清理
  - `SimpleMarkdown` 使用 `dangerouslySetInnerHTML`，存在 XSS 风险
  - 无身份验证

## 9. 文档更新说明

- **2026-04-19**：初次创建 README，基于当前代码整理
