# qianchuan-writer — 千川脚本仿写助手

## 1. 项目定位

面向抖音千川投流团队的 AI 辅助工具，通过四步引导流程，帮助运营人员基于爆款视频开头和产品卖点，快速生成符合千川投放规范的口播脚本。

## 2. 当前功能

- 从本地 `data/personas/` 加载达人风格档案，支持多达人切换
- 上传产品文档（PDF / Word / Excel / PPT / TXT），AI 结构化提取产品信息
- AI 按「背书 → 机制 → 种草」优先级对话式提炼卖点，支持三种卖点顺序
- 支持抖音视频链接自动转录（ASR）或手动粘贴文案
- AI 提取并标注爆款开头类型（好奇型 / 痛点型 / 反常识型 / 利益型 / 身份筛选型）
- 生成完整千川口播脚本（含自检表），自动检测字数超标并压缩
- 支持多轮对话迭代修改，一键导出终稿

**千川 vs 种草的核心区别：**

| 维度 | 千川（qianchuan） | 种草（seeding） |
|------|-------------------|-----------------|
| 目标 | 直接转化，促下单 | 种草，建立信任 |
| 卖点逻辑 | 背书 → 机制 → 种草 | 情绪冲击 > 体验描写 > 价格锚定 |
| 脚本风格 | 利益驱动，行动号召明确 | 真实体验感、五感描写、自然植入 |

## 3. 使用流程

**Step 1 — 选达人**
1. 下拉选择达人，确认后进入下一步

**Step 2 — 提炼卖点**
1. 上传产品文档（可选），AI 自动提取结构化产品信息
2. 选择卖点顺序（背书-机制-种草 / 机制-背书-种草 / 背书-种草-机制）
3. AI 启动卖点提炼对话，可多轮追加需求
4. 点击「采用卖点到表单」确认，进入下一步

**Step 3 — 爆款开头**
1. 方式 A：粘贴抖音视频分享链接 → 自动转录文案（最长等待 5 分钟）
2. 方式 B：直接粘贴视频文案
3. AI 提取并分析爆款开头，可手动编辑后重新提取
4. 确认开头后锁定，进入下一步

**Step 4 — 拼合脚本**
1. AI 自动以「锁定开头 + 卖点 + 达人风格」生成完整脚本
2. 自动校验字数，超标时触发 AI 自动压缩
3. 多轮对话迭代修改
4. 点击「导出终稿」复制到剪贴板

## 4. 目录结构

```
qianchuan-writer/
├── app/
│   ├── page.tsx                      # 主页面（四步向导）
│   ├── layout.tsx
│   ├── globals.css
│   └── api/
│       ├── chat/route.ts             # AI 流式对话接口
│       ├── fetch-video/route.ts      # 抖音视频信息获取
│       ├── parse-product/route.ts    # 产品文档解析
│       ├── transcribe/
│       │   ├── upload/route.ts       # 视频上传 OSS + 提交 ASR
│       │   └── poll/route.ts         # 轮询 ASR 转录结果
│       └── personas/
│           ├── route.ts              # 获取达人列表
│           └── references/route.ts  # 素材库增删
├── lib/
│   ├── yunwu.ts
│   ├── tikhub.ts
│   ├── aliyun-oss.ts
│   └── aliyun-asr.ts
├── data/
│   └── personas/{达人名}/
│       ├── soul.md
│       ├── content-plan.md
│       └── references/
├── next.config.js
├── tailwind.config.js
├── tsconfig.json
└── package.json
```

## 5. 核心接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/chat` | POST | AI 流式对话，body: `{ messages, systemPrompt, model? }` |
| `/api/parse-product` | POST | multipart/form-data，解析产品文档，返回结构化产品信息 JSON |
| `/api/fetch-video` | POST | 解析抖音视频，body: `{ shareUrl }` |
| `/api/transcribe/upload` | POST | 下载视频 → 上传 OSS → 提交 ASR，返回 `{ taskId }` |
| `/api/transcribe/poll` | POST | 轮询 ASR 结果，body: `{ taskId }` |
| `/api/personas` | GET | 返回达人列表及档案 |
| `/api/personas/references` | POST/DELETE | 素材库管理 |

> **注意**：`page.tsx` 中达人列表调用 `/material-library/api/personas`，需配合 material-library 服务部署。

## 6. 环境变量

```env
YUNWU_API_KEY=               # 云雾 AI API 密钥
YUNWU_BASE_URL=              # 云雾 AI 接口地址
TIKHUB_API_KEY=              # TikHub API 密钥
ALIYUN_ACCESS_KEY_ID=        # 阿里云 AccessKey ID
ALIYUN_ACCESS_KEY_SECRET=    # 阿里云 AccessKey Secret
ALIYUN_APPKEY=               # 阿里云 ASR AppKey
```

**运行：**
```bash
npm install && npm run dev
```

访问地址：`http://localhost:3000`（部署时 basePath 为 `/qianchuan-writer`，端口 3005）

## 7. 开发注意事项

- `basePath` 为 `/qianchuan-writer`，部署时反向代理需正确转发
- 达人列表跨服务调用 `/material-library/api/personas`，单独部署需调整
- 前端轮询转录结果每 5 秒一次，最多 300 秒（60 次）
- OSS Bucket 名称 `hersystem-media-tmp` 硬编码在 `lib/aliyun-oss.ts` 中
- 默认 AI 模型为 `claude-opus-4-6-thinking`

## 8. 当前状态 / 已知问题

- **完成度**：核心四步流程完整，已上线
- **已知问题**：
  - 达人列表跨服务调用，单独部署需调整源码
  - OSS Bucket 硬编码，更换需改代码
  - `data/personas/` 目录需手动维护，不支持在线创建达人
  - 无身份验证

## 9. 流程功能测试

| 步骤 | 测试项 | 操作说明 | 预期结果 | 状态 |
|------|--------|----------|----------|------|
| Step 1 | 达人列表加载 | 进入页面查看下拉列表 | 显示所有可用达人 | ⬜ |
| Step 2 | 上传产品文档 | 上传 PDF / Word 文件 | AI 返回结构化产品信息 | ⬜ |
| Step 2 | 卖点提炼对话 | 查看 AI 提炼的卖点 | 按背书-机制-种草逻辑输出 3 个卖点 | ⬜ |
| Step 2 | 采用卖点 | 点击「采用卖点到表单」 | 卖点写入表单，进入 Step 3 | ⬜ |
| Step 3 | 视频链接转录 | 输入抖音分享链接 | 自动转录并返回完整文案 | ⬜ |
| Step 3 | 手动粘贴文案 | 直接粘贴文案后确认 | 触发 AI 开头提取 | ⬜ |
| Step 3 | 开头提取 | 查看 AI 提取结果 | 显示开头文本及类型标注 | ⬜ |
| Step 4 | 脚本生成 | 自动生成 | AI 流式输出完整千川脚本 | ⬜ |
| Step 4 | 字数校验 | 查看字数提示 | 超标时自动触发压缩 | ⬜ |
| Step 4 | 多轮迭代 | 追加修改意见 | AI 按要求修改脚本 | ⬜ |
| Step 4 | 导出终稿 | 点击「导出终稿」 | 内容复制到剪贴板 | ⬜ |

> 状态标记：⬜ 未测试 / ✅ 通过 / ❌ 未通过

## 10. 文档更新说明

- **2026-04-23**：初次创建 README，基于当前代码整理
