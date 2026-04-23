# persona-writer — 人设脚本仿写助手

## 1. 项目定位

面向短视频运营团队的 AI 辅助创作工具，帮助内容人员以指定达人的人设风格，对标高赞抖音视频完成脚本仿写，并支持多轮迭代直至输出终稿。

## 2. 当前功能

- 从本地 `data/personas/` 加载多个达人的人设档案、内容规划和优质素材库，一键切换风格
- 粘贴抖音分享链接，自动解析视频信息，校验点赞量是否达到门槛（10 万）
- 手动粘贴口播文案，AI 评估开头吸引力（可跳过），自动拆解对标结构
- 支持三种仿写模式：用户输入想法 / AI 智能推荐选题 / 沿用原文主题
- 生成脚本附自检表，支持多轮对话迭代修改
- 向达人素材库添加 / 删除参考内容
- 一键复制终稿到剪贴板

## 3. 使用流程

**Step 1 — 加载风格**
1. 下拉选择达人，预览人设档案与内容规划
2. 确认后点击「下一步：验证对标」

**Step 2 — 对标验证**
1. 粘贴抖音分享链接，点击「解析」，确认点赞量 ≥ 10 万
2. 粘贴外部转写好的视频口播文案，点击「确认使用此文案」
3. 查看 AI 开头吸引力评估，选择「同意」或「不同意」后进入仿写

**Step 3 — 仿写创作**
1. AI 自动拆解对标脚本结构
2. 选择仿写方向（有想法 / 没想法）
3. AI 流式输出第一版脚本（含自检表）
4. 在对话框追加修改意见，多轮迭代
5. 点击「导出终稿」复制到剪贴板

## 4. 目录结构

```
persona-writer/
├── app/
│   ├── page.tsx                      # 主页面（三步流程）
│   ├── layout.tsx
│   ├── globals.css
│   └── api/
│       ├── chat/route.ts             # AI 流式对话接口
│       ├── fetch-video/route.ts      # 抖音视频信息解析
│       ├── transcribe/
│       │   ├── upload/route.ts       # 视频上传 OSS + 提交 ASR
│       │   └── poll/route.ts         # 轮询 ASR 转录结果
│       └── personas/
│           ├── route.ts              # 获取达人列表
│           └── references/route.ts  # 素材库增删
├── lib/
│   ├── yunwu.ts                      # 云雾 AI 封装
│   ├── tikhub.ts                     # TikHub 抖音数据封装
│   ├── aliyun-oss.ts                 # 阿里云 OSS 上传
│   └── aliyun-asr.ts                 # 阿里云语音识别
├── data/
│   └── personas/{达人名}/
│       ├── soul.md                   # 人设档案
│       ├── content-plan.md           # 内容规划
│       └── references/               # 优质素材库
├── next.config.js
├── tailwind.config.js
├── tsconfig.json
└── package.json
```

## 5. 核心接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/chat` | POST | AI 流式对话，body: `{ messages, systemPrompt, model? }` |
| `/api/fetch-video` | POST | 解析抖音视频，body: `{ shareUrl }` |
| `/api/personas` | GET | 返回达人列表及档案 |
| `/api/personas/references` | POST | 添加素材到指定达人 |
| `/api/personas/references` | DELETE | 删除指定素材文件 |
| `/api/transcribe/upload` | POST | 视频上传 OSS + 提交 ASR，返回 `{ taskId }` |
| `/api/transcribe/poll` | POST | 轮询转录结果 |

> **注意**：`page.tsx` 中获取达人列表实际调用 `/material-library/api/personas`（另一服务），而非本服务自身路由，需确保 material-library 服务在线。

## 6. 环境变量

```env
YUNWU_API_KEY=        # 云雾 AI API 密钥
YUNWU_BASE_URL=       # 云雾 AI 接口地址
TIKHUB_API_KEY=       # TikHub API 密钥
ALIYUN_ACCESS_KEY_ID=      # 阿里云 AccessKey ID
ALIYUN_ACCESS_KEY_SECRET=  # 阿里云 AccessKey Secret
ALIYUN_APPKEY=             # 阿里云 ASR AppKey
```

**运行：**
```bash
npm install && npm run dev
```

访问地址：`http://localhost:3001`（部署时 basePath 为 `/persona-writer`）

## 7. 开发注意事项

- `basePath` 为 `/persona-writer`，本地开发时 API 路径以此为前缀
- 当前 UI 版本已改为手动粘贴文案，`transcribe` 接口为备用状态
- `data/personas/` 目录不随代码入库，部署后需手动创建达人档案目录
- AI 默认模型为 `claude-opus-4-6-thinking`，评估任务使用 `qwen-flash`
- `next.config.js` 中已跳过 TypeScript 和 ESLint 检查（`ignoreBuildErrors: true`）

## 8. 当前状态 / 已知问题

- **完成度**：核心三步流程完整，已上线
- **已知问题**：
  - 达人列表跨服务调用 `/material-library/api/personas`，单独部署需调整
  - ASR 转录接口已实现但 UI 未接入，需手动粘贴外部转写文案
  - `data/personas/` 目录需手动维护，不支持在线新建达人
  - OSS Bucket 名称（`hersystem-media-tmp`）硬编码在源码中
  - 无身份验证

## 9. 流程功能测试

| 步骤 | 测试项 | 操作说明 | 预期结果 | 状态 |
|------|--------|----------|----------|------|
| Step 1 | 达人列表加载 | 进入页面，查看下拉列表 | 显示所有可用达人 | ⬜ |
| Step 1 | 切换达人 | 选择不同达人 | 正确加载对应人设档案和内容规划 | ⬜ |
| Step 2 | 视频链接解析 | 输入抖音分享链接，点击解析 | 返回视频信息，点赞量校验正常 | ⬜ |
| Step 2 | 粘贴文案 | 粘贴口播文案并确认 | 触发 AI 开头评估 | ⬜ |
| Step 2 | 跳过评估 | 点击「跳过」 | 直接进入 Step 3 | ⬜ |
| Step 3 | 结构拆解 | 进入 Step 3 | AI 输出对标脚本结构分析 | ⬜ |
| Step 3 | 无想法仿写 | 选择「我没想法」 | AI 直接生成脚本 | ⬜ |
| Step 3 | 有想法仿写 | 输入方向，选择「我有想法」 | AI 按方向生成脚本 | ⬜ |
| Step 3 | 多轮迭代 | 追加修改意见 | AI 按要求修改脚本 | ⬜ |
| Step 3 | 导出终稿 | 点击「导出终稿」 | 内容复制到剪贴板 | ⬜ |

> 状态标记：⬜ 未测试 / ✅ 通过 / ❌ 未通过

## 10. 文档更新说明

- **2026-04-23**：初次创建 README，基于当前代码整理
