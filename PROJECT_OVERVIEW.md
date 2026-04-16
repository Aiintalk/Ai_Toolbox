# AI 工具箱_项目文档

> 本文档供 AI 助手在新对话中快速了解项目全貌，包含架构、功能、核心代码逻辑和关键实现细节。

---

## 一、项目整体定位

这是一套面向**短视频内容创作和营销投放**场景的 AI 辅助工具集合，服务于内部内容团队。

- 部署方式：公网服务器（`47.110.82.137`），各子项目独立部署
- 入口：`portal/index.html` 静态导航页
- 规划工具数：8 个（目前已上线 4 个，其余开发中）

---

## 二、子项目清单

| 子项目目录 | 工具名称 | 状态 | 访问路径 |
|-----------|---------|------|---------|
| `portal` | AI 工具箱导航主页 | 已上线 | `http://47.110.82.137/` |
| `benchmark-analyzer` | 对标分析助手 | 已上线 | `http://47.110.82.137/benchmark-analyzer/` |
| `persona-writer-web` | 人设脚本仿写助手 | 已上线 | `http://47.110.82.137/persona-writer/` |
| `qianchuan-writer-web` | 千川脚本仿写助手 | 已上线 | 已上线`http://47.110.82.137/qianchuan-writer/` |
| `seeding-writer-web` | 种草内容仿写助手 | 已上线 | `http://47.110.82.137/seeding-writer/` |

规划中（未开发）：人设复盘助手、直播间脚本仿写/复盘助手

---

## 三、通用技术栈

所有 web 子项目共用相同技术栈：

| 层级 | 技术 |
|------|------|
| 框架 | Next.js 14.2.x（App Router） |
| 语言 | TypeScript |
| UI | React 18 + Tailwind CSS 3 |
| AI 接口 | Yunwu（Yunwu）AI，OpenAI 兼容协议，流式输出 |
| AI 模型 | `claude-sonnet-4-6` |
| 视频数据 | TikHub API（抖音视频/账号数据） |
| 音频转文字 | 阿里云 ASR（filetrans.cn-shanghai.aliyuncs.com） |
| 文件存储 | 阿里云 OSS（hersystem-media-tmp，oss-cn-shanghai） |

### 环境变量（所有项目共用）

```env
YUNWU_API_KEY=              # Yunwu AI API Key
YUNWU_BASE_URL=             # Yunwu AI Base URL（OpenAI 兼容）
TIKHUB_API_KEY=             # TikHub API Key（抖音数据）
ALIYUN_ACCESS_KEY_ID=
ALIYUN_ACCESS_KEY_SECRET=
ALIYUN_APPKEY=              # 阿里云 ASR AppKey（注意：ASR 额外需要此字段）
ALIYUN_OSS_BUCKET=          # 固定值：hersystem-media-tmp
ALIYUN_OSS_REGION=          # 固定值：oss-cn-shanghai
BENCHMARK_DATA_DIR=         # benchmark-analyzer 专用，历史数据目录
```

### next.config.js 各项目 basePath 配置

| 子项目 | basePath |
|--------|----------|
| `benchmark-analyzer` | `/benchmark-analyzer` |
| `persona-writer-web` | /persona-writer |
| `qianchuan-writer-web` | `/qianchuan-writer` |
| `seeding-writer-web` | /seeding-writer |

> 所有项目均设置 `typescript.ignoreBuildErrors: true` 和 `eslint.ignoreDuringBuilds: true`

---

## 四、通用 lib 工具库

### `lib/yunwu.ts` — AI 流式调用封装

```typescript
// 函数签名
chatStream(messages: ChatMessage[], systemPrompt: string, model?: string): ReadableStream<Uint8Array>
```

- 调用 `${YUNWU_BASE_URL}/chat/completions`，模型默认 `claude-sonnet-4-6`
- 解析 SSE 流，逐 token 推送到 `ReadableStream`
- 支持传入可选 `model` 参数覆盖默认模型

### `lib/tikhub.ts` — 抖音数据抓取

```typescript
resolveSecUserId(input: string)        // 支持抖音号或链接，返回 sec_user_id + nickname
fetchUserVideos(secUserId, maxPages)   // 翻页拉取所有视频（默认最多10页×20条）
getTop10(videos)                       // 按点赞数取 TOP10
getRecent30Days(videos)                // 过滤最近30天
formatVideos(videos, label)            // 格式化为文本（供 Prompt 使用）
```

- 使用 TikHub API：`https://api.tikhub.io/api/v1/douyin/web`
- 支持解析抖音号（unique_id）和主页分享链接两种输入格式

### `lib/aliyun-asr.ts` — 语音转文字

- **服务端点**：`https://filetrans.cn-shanghai.aliyuncs.com`
- **API 版本**：`2018-08-17`，签名方式：HMAC-SHA1
- **环境变量依赖**：`ALIYUN_ACCESS_KEY_ID`、`ALIYUN_ACCESS_KEY_SECRET`、`ALIYUN_APPKEY`

```typescript
submitTranscription(videoUrl: string): Promise<string>
// 提交转录任务，返回 taskId
// Task 参数：appkey、file_link、version="4.0"、enable_words=false

pollTranscription(taskId: string): Promise<{ status: 'processing' | 'done'; text?: string }>
// 轮询任务结果
// StatusCode 21050000 = 完成，返回 Sentences[].Text 拼接
// StatusCode 21050001/21050002/21050003 = 处理中
// 其他 = 抛出异常
```

### `lib/aliyun-oss.ts` — 文件上传

- **Bucket**：`hersystem-media-tmp`（硬编码）
- **端点**：`oss-cn-shanghai.aliyuncs.com`
- **签名**：HMAC-SHA1，直接 PUT 方式上传

```typescript
uploadToOSS(buffer: Buffer, objectKey: string, contentType?: string): Promise<void>
// PUT https://hersystem-media-tmp.oss-cn-shanghai.aliyuncs.com/{objectKey}

getSignedUrl(objectKey: string, expireSeconds: number): string
// 生成带 OSSAccessKeyId + Expires + Signature 的临时访问 URL
```

### `lib/history.ts`（仅 benchmark-analyzer）

```typescript
saveAnalysis(entry)      // 保存分析结果为 JSON 文件
listAnalyses()           // 列出所有历史记录（按时间倒序）
getAnalysis(id)          // 按 ID 读取完整记录
```

- 数据存储在本地文件系统的 `data/` 目录（每条记录一个 JSON 文件）
- 文件名格式：`{createdAt}_{secUserId}.json`

---

## 五、子项目详细说明

---

### 5.1 benchmark-analyzer — 对标分析助手

**功能：** 输入抖音账号 → 自动抓取视频数据 → AI 生成人格档案和内容规划 → 导出 Word

**访问地址：** `http://47.110.82.137/benchmark-analyzer/`

#### 工作流程

```
输入抖音号或链接
    ↓
/api/fetch-account  →  tikhub 解析 sec_user_id → 翻页拉取全部视频
                        → 筛选 TOP10 + 最近30天 → 格式化文本
    ↓
手动编辑文案（可选）
    ↓
/api/analyze  →  Yunwu AI 流式生成（System Prompt 见下）
                → 返回流以 ===SPLIT=== 分隔两份文档
    ↓
前端实时展示（人格档案 / 内容规划 Tab 切换）
    ↓
自动保存到 /api/history（JSON 文件）
    ↓
导出 Word（/api/export-word，使用 docx 库）
```

#### API 路由

| 路由 | 方法 | 功能 |
|------|------|------|
| `/api/fetch-account` | POST | 解析账号，返回格式化视频文案 |
| `/api/analyze` | POST | AI 分析，流式返回两份文档 |
| `/api/export-word` | POST | 生成 .docx 文件下载 |
| `/api/history` | GET | 列出历史记录 |
| `/api/history` | POST | 保存新记录 |
| `/api/history/[id]` | GET | 读取单条历史记录 |

#### System Prompt 结构（analyze 接口）

分析师角色，要求输出两份文档并用 `===SPLIT===` 分隔：
1. **人格档案**：基本信息、人生经历、说话风格（语气特征+常用句式+禁用表达）、人设内核、内容品味
2. **内容规划**：人设定位、内容体系（树状图）、爆款规律、更新频率

> 关键约定：所有分析必须基于实际文案，引用原文为证，不编造

#### 前端状态机

```
step: 'input' → 'result'
tab: 'profile' | 'plan'
```

历史记录在页面加载时自动获取，点击可直接恢复上次分析结果。

---

### 5.2 persona-writer-web — 人设脚本仿写助手

**功能：** 选定达人人设 → 找对标视频转录 → AI 评估开头 → 流式生成仿写脚本

**访问地址：** `http://47.110.82.137/persona-writer/`

#### 工作流程（3步）

```
Step 1「加载风格」
    选择人设（人设数据来自 /api/personas，读取 data/personas/ 目录）
    展示：人设定位 / 灵魂档案 / 内容计划
    维护素材库：爆款文案 / 喜欢的内容 / 风格参考（支持增删）
    ↓
Step 2「对标验证」
    输入抖音视频链接 → /api/fetch-video → 获取视频信息
    上传/转录 → /api/transcribe/upload + /api/transcribe/poll（轮询）
    或直接粘贴文案
    AI 评估开头吸引力（调用 /api/chat）
    质量门：点赞 ≥ 10万 AND 开头评估通过 → 可进入下一步
    ↓
Step 3「仿写创作」
    AI 拆解对标视频结构
    选主题：沿用对标 / 自定义 / AI 推荐3个
    调用 /api/chat 流式生成脚本
    支持多轮迭代对话（追加需求）
    导出终稿
```

#### API 路由

| 路由 | 方法 | 功能 |
|------|------|------|
| `/api/personas` | GET | 列出所有人设 |
| `/api/personas/[id]` | GET | 读取单个人设完整数据 |
| `/api/fetch-video` | POST | 用 TikHub 获取视频信息（点赞、标题等） |
| `/api/transcribe/upload` | POST | 上传视频到 OSS，提交 ASR 任务 |
| `/api/transcribe/poll` | GET | 轮询转录任务状态，返回文稿 |
| `/api/chat` | POST | 通用 AI 聊天接口（流式） |

#### /api/chat 接口设计

```typescript
// 请求体
{ messages: ChatMessage[], systemPrompt: string, model?: string }
// 响应：text/plain 流式
```

System Prompt 由前端根据当前步骤动态构建，传入接口。

#### 数据结构

```typescript
interface Persona {
  id: string;
  name: string;
  positioning: string;    // 人设定位
  soulDoc: string;        // 灵魂档案（完整文本，来自 soul.md）
  contentPlan: string;    // 内容计划（来自 content-plan.md）
  materials: {            // 素材库
    hotVideos: string[];
    likedContent: string[];
    styleRef: string[];
  };
}
```

人设数据文件存放在 `data/personas/{persona-name}/` 目录，每个人设目录含：
- `soul.md` — 灵魂档案
- `content-plan.md` — 内容计划
- `references/` — 参考资料（可为空）

---

### 5.3 qianchuan-writer-web — 千川脚本仿写助手

**功能：** 选达人 → 上传产品资料提炼卖点 → 找千川爆款开头 → 生成投流脚本

**访问地址：** `http://47.110.82.137/qianchuan-writer/`（开发中，尚未上线）

#### 工作流程（4步）

```
Step 1「选达人」
    选择人设（含千川素材库：千川爆款/对标千川/爆款开头）
    ↓
Step 2「提炼卖点」
    填写产品基本信息
    上传产品文档（支持 PDF/Word/Excel/PPT/TXT）→ /api/parse-product
    AI 按三类卖点结构多轮讨论：
      - 背书类卖点（专业性、认证等）
      - 机制类卖点（成分、原理等）
      - 种草类卖点（使用感受、情绪价值等）
    支持三种卖点排序：转化优先 / 信任优先 / 差异化优先
    ↓
Step 3「爆款开头」
    输入千川视频链接 → 解析+转录
    AI 识别开头类型：好奇型/痛点型/反常识型/利益型/身份筛选型
    确认开头作为脚本起点
    ↓
Step 4「拼合脚本」
    结构：爆款开头 + 卖点1 + 卖点2 + 卖点3 + 行动号召（下单/加购）
    调用 /api/chat 流式生成完整脚本
    支持多轮迭代修改
```

#### 额外依赖（相比 persona-writer）

```json
"mammoth": "^1.8.0",   // Word 文档解析
"unpdf": "^1.4.0",     // PDF 解析
"xlsx": "^0.18.5",     // Excel 解析
"jszip": "^3.10.1"     // ZIP 处理
```

#### 产品文档解析（/api/parse-product）

- 根据文件扩展名分发处理：`.pdf` → unpdf，`.docx/.doc` → mammoth，`.xlsx/.xls` → xlsx
- 提取纯文本后交给 AI 识别卖点

---

### 5.4 seeding-writer-web — 种草内容仿写助手

**功能：** 与千川仿写类似，但侧重种草内容的真实感和消费者情绪

**访问地址：** `http://47.110.82.137/seeding-writer/`（开发中，尚未上线）

#### 与千川仿写的核心差异

| 维度 | 千川（qianchuan） | 种草（seeding） |
|------|-----------------|----------------|
| 目标 | 直接转化，促下单 | 种草，建立信任 |
| 卖点提炼逻辑 | 背书→机制→种草三类 | 价格锚定>情绪冲击>数据精选 |
| 开头标准 | 识别类型，匹配转化 | 找「种草力强」的真实体验开头 |
| 脚本写法 | 利益驱动，行动号召明确 | 真实体验感、五感描写、自然植入 |
| 卖点铁律 | 无 | 禁止把消费者语言改回成分/技术语言 |

---

### 5.5 portal — 导航主页

纯静态 HTML（`portal/index.html`），展示所有工具入口卡片，已上线工具有链接，开发中工具显示为灰色禁用状态。

**访问地址：** `http://47.110.82.137/`

---

## 六、数据目录结构

```
benchmark-analyzer/
└── data/                          # 历史分析记录（每条一个 JSON 文件）
    └── {timestamp}_{secUserId}.json

persona-writer-web/
└── data/
    └── personas/                  # 人设数据文件
        └── {persona-name}/
            ├── soul.md
            ├── content-plan.md
            └── references/        # 参考资料（可为空）

qianchuan-writer-web/
└── data/
    └── personas/                  # 与 persona-writer 结构相同
        └── {persona-name}/
            ├── soul.md
            ├── content-plan.md
            └── references/

seeding-writer-web/
└── data/
    └── personas/                  # 与 persona-writer 结构相同
        └── {persona-name}/
            ├── soul.md
            ├── content-plan.md
            └── references/
```

---

## 七、前端共用模式

所有 web 应用遵循相同的前端设计模式：

1. **步骤式引导**：Step 1 → Step 2 → Step 3/4，每步有明确的完成条件才能进入下一步
2. **流式 AI 输出**：所有 AI 生成内容均通过 `ReadableStream` 实时展示，避免等待
3. **多轮对话**：Step 最后一步均支持追加需求、多轮迭代修改
4. **System Prompt 由前端构建**：根据当前人设数据、素材库内容、已填写信息动态拼接 Prompt，传给 `/api/chat`
5. **无全局状态库**：全部用 `useState` / `useRef` 管理，无 Redux/Zustand

---

## 八、服务器部署信息

### 部署环境

| 项目 | 访问地址 | 部署状态 |
|------|---------|---------|
| portal（导航主页） | `http://47.110.82.137/` | 已上线 |
| benchmark-analyzer | `http://47.110.82.137/benchmark-analyzer/` | 已上线 |
| persona-writer-web | `http://47.110.82.137/persona-writer/` | 已上线 |
| qianchuan-writer-web | `http://47.110.82.137/qianchuan-writer/` | 已上线 |
| seeding-writer-web | `http://47.110.82.137/seeding-writer/` | 已上线 |

---

## 九、功能测试清单

### 9.1 通用基础测试

| 测试项 | 测试方法 | 预期结果 | 结  果 |
|--------|---------|---------|---------|
| 导航主页加载 | 访问 `http://47.110.82.137/` | 显示工具卡片列表，已上线工具可点击，开发中工具灰色禁用 | ✅️正常 |
| 已上线工具入口跳转 | 点击「对标分析助手」「人设脚本仿写助手」卡片 | 正确跳转到对应子项目页面 | ✅️正常 |
| AI 流式输出 | 任意触发 AI 生成 | 内容逐字实时显示，无白屏等待 | ✅️正常 |
| 页面响应速度 | 刷新各页面 | 页面正常加载，无 404/500 错误 | ✅️正常 |

### 9.2 benchmark-analyzer — 对标分析助手

| 测试项 | 测试步骤 | 预期结果 | 结  果 |
|--------|---------|---------|---------|
| 抖音号解析 | 输入有效抖音号，点击「获取数据」 | 成功返回账号视频列表，显示 TOP10 + 近30天数据 | ✅️正常 |
| 链接解析 | 输入抖音主页分享链接 | 同上，正确解析 sec_user_id | ✅️正常 |
| AI 流式分析 | 点击「开始分析」 | 流式输出人格档案 + 内容规划，以 Tab 切换展示 | ✅️正常 |
| ===SPLIT=== 分隔 | 观察 AI 输出分段情况 | 两份文档正确分割，Tab 切换正常 | ✅️正常 |
| 历史记录保存 | 完成分析后 | 自动保存，历史列表出现新记录 | ✅️正常 |
| 历史记录恢复 | 点击历史记录条目 | 恢复上次分析结果，无需重新请求 | ✅️正常 |
| Word 导出 | 点击「导出 Word」 | 下载 .docx 文件，内容格式正确 | ✅️正常 |
| 异常账号处理 | 输入不存在的抖音号 | 显示友好错误提示，不崩溃 | ✅️正常 |

### 9.3 persona-writer-web — 人设脚本仿写助手

| 测试项 | 测试步骤 | 预期结果 | 结  果 |
|--------|---------|---------|---------|
| Step 1：加载人设列表 | 页面加载 | 正确读取 `data/personas/` 下所有人设 | ✅️正常 |
| Step 1：选择人设 | 点击任意人设 | 展示人设定位、灵魂档案、内容计划 | ✅️正常 |
| Step 1：素材库管理 | 添加/删除爆款文案条目 | 实时更新，刷新后数据持久化 | ✅️正常 |
| Step 2：视频链接解析 | 输入高赞抖音视频链接 | 返回视频标题、点赞数 | ❗️异常 |
| Step 2：视频转录 | 上传视频文件 | OSS 上传成功，ASR 任务提交，轮询完成后显示文稿 | ❗️异常 |
| Step 2：直接粘贴文案 | 粘贴文案文本 | 跳过转录，直接进入评估 |  |
| Step 2：开头吸引力评估 | 提交转录文稿 | AI 输出开头评估结果 |  |
| Step 2：质量门控 | 使用点赞 < 10万 的视频 | 无法进入 Step 3，提示不达标 | ✅️正常 |
| Step 3：AI 拆解结构 | 进入 Step 3 | AI 自动拆解对标视频结构 | ✅️正常 |
| Step 3：主题选择 | 分别测试「沿用对标」「自定义」「AI 推荐」 | 三种方式均可正常选择 |  |
| Step 3：流式生成脚本 | 确认主题后触发生成 | 流式输出完整仿写脚本 |  |
| Step 3：多轮迭代 | 在对话框追加修改需求 | AI 根据追加需求调整脚本 |  |
| Step 3：导出终稿 | 点击导出 | 正确导出脚本内容 |  |

### 9.4 AI 模型相关测试

| 测试项 | 测试方法 | 预期结果 |
|--------|---------|---------|
| 模型连通性 | 触发任意 AI 生成 | Yunwu AI（`claude-sonnet-4-6`）响应正常，无超时 |
| 流式输出稳定性 | 触发长文本生成（如完整脚本） | 全程流式输出，无中断，token 逐字到达 |
| System Prompt 生效 | 检查 AI 输出是否符合角色设定 | 输出内容符合人设风格，格式正确 |
| 多轮对话上下文 | 在 Step 3 发起多轮对话 | AI 保持上下文，后续修改基于前次输出 |
| 模型参数覆盖 | 若有 `model` 参数 | 使用指定模型，否则默认 `claude-sonnet-4-6` |

### 9.5 第三方服务测试

| 服务 | 测试项 | 预期结果 |
|------|--------|---------|
| TikHub API | 解析有效抖音账号/视频链接 | 正确返回视频列表/视频信息 |
| 阿里云 OSS | 上传视频文件 | 文件上传至 `hersystem-media-tmp` bucket |
| 阿里云 ASR | 提交转录任务 + 轮询 | StatusCode=21050000 时返回完整文稿 |
| ASR 轮询异常 | 模拟长时间处理中 | 前端持续轮询，不超时崩溃 |

### 9.6 异常与边界测试

| 测试项 | 测试方法 | 预期结果 |
|--------|---------|---------|
| 网络断开时 AI 调用 | 模拟断网后触发 AI 生成 | 显示错误提示，不白屏 |
| 无效抖音链接 | 输入非抖音链接 | 友好报错，不崩溃 |
| 视频点赞数为 0 | 使用新发布视频 | 不崩溃，正常展示数据 |
| 人设数据目录为空 | 清空 personas 目录 | 界面提示无人设可选，不报错 |
| 大文件上传 | 上传超大视频 | OSS 上传超时或大小限制提示 |
| 并发 AI 请求 | 快速多次点击生成 | 不产生重复请求或状态混乱 |

