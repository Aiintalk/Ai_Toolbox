# Ai_Toolbox

面向**短视频内容创作与营销投放**场景的 AI 辅助工具集合，包含对标分析、脚本仿写、种草内容创作等功能模块。

---

## 项目概览

| 子项目                 | 工具名称          |
| ---------------------- | ----------------- 
| `portal`               | AI 工具箱导航主页 
| `benchmark-analyzer`   | 对标分析助手      
| `persona-writer-web`   | 人设脚本仿写助手 
| `qianchuan-writer-web` | 千川脚本仿写助手 
| `seeding-writer-web`   | 种草内容仿写助手 

规划中：人设复盘助手、直播间脚本仿写/复盘助手

---

## 技术栈

| 层级       | 技术                            |
| ---------- | ------------------------------- |
| 框架       | Next.js 14.2.x（App Router）    |
| 语言       | TypeScript                      |
| UI         | React 18 + Tailwind CSS 3       |
| AI 接口    | OpenAI 兼容协议，流式输出       |
| 视频数据   | TikHub API（抖音视频/账号数据） |
| 音频转文字 | 阿里云 ASR                      |
| 文件存储   | 阿里云 OSS                      |

---

## 环境变量配置

复制 `.env.example` 并填写以下变量：

```env
YUNWU_API_KEY=              # AI API Key
YUNWU_BASE_URL=             # AI Base URL（OpenAI 兼容）
TIKHUB_API_KEY=             # TikHub API Key（抖音数据）
ALIYUN_ACCESS_KEY_ID=       # 阿里云 Access Key ID
ALIYUN_ACCESS_KEY_SECRET=   # 阿里云 Access Key Secret
ALIYUN_APPKEY=              # 阿里云 ASR AppKey
ALIYUN_OSS_BUCKET=          # 阿里云 OSS Bucket 名称
ALIYUN_OSS_REGION=          # 阿里云 OSS Region（如 oss-cn-shanghai）
BENCHMARK_DATA_DIR=         # benchmark-analyzer 历史数据目录
```

---

## 子项目说明

### benchmark-analyzer — 对标分析助手

输入抖音账号 → 自动抓取视频数据 → AI 生成人格档案和内容规划 → 导出 Word

**工作流程：**

1. 输入抖音号或主页链接，自动拉取 TOP10 + 近30天视频数据
2. AI 流式生成「人格档案」与「内容规划」两份文档
3. 支持历史记录保存与恢复
4. 一键导出 Word 文档

---

### persona-writer-web — 人设脚本仿写助手

选定达人人设 → 找对标视频转录 → AI 评估开头 → 流式生成仿写脚本

**工作流程（3步）：**

1. **加载风格**：选择人设，维护素材库（爆款文案 / 喜欢的内容 / 风格参考）
2. **对标验证**：输入抖音视频链接，转录文案，AI 评估开头吸引力（质量门：点赞 ≥ 10万）
3. **仿写创作**：AI 拆解结构，选主题（沿用/自定义/AI推荐），流式生成脚本，支持多轮迭代

---

### qianchuan-writer-web — 千川脚本仿写助手

选达人 → 上传产品资料提炼卖点 → 找千川爆款开头 → 生成投流脚本

**工作流程（4步）：**

1. 选择人设（含千川素材库）
2. 上传产品文档（支持 PDF/Word/Excel/PPT/TXT），AI 按三类卖点结构提炼
3. 输入千川视频链接，AI 识别开头类型
4. 拼合脚本（爆款开头 + 卖点 + 行动号召），支持多轮迭代

---

### seeding-writer-web — 种草内容仿写助手

与千川仿写流程类似，侧重种草内容的真实感和消费者情绪表达。

| 维度     | 千川（qianchuan）      | 种草（seeding）                |
| -------- | ---------------------- | ------------------------------ |
| 目标     | 直接转化，促下单       | 种草，建立信任                 |
| 卖点逻辑 | 背书→机制→种草三类     | 价格锚定>情绪冲击>数据精选     |
| 脚本风格 | 利益驱动，行动号召明确 | 真实体验感、五感描写、自然植入 |

---

## 数据目录结构

```
benchmark-analyzer/
└── data/                          # 历史分析记录（每条一个 JSON 文件）

persona-writer-web/
└── data/
    └── personas/{persona-name}/
        ├── soul.md                # 灵魂档案
        ├── content-plan.md        # 内容计划
        └── references/            # 参考资料（可为空）
```

---

## 前端架构特点

1. **步骤式引导**：每步有明确完成条件才能进入下一步
2. **流式 AI 输出**：通过 `ReadableStream` 实时展示，避免等待
3. **多轮对话**：最后步骤均支持追加需求、多轮迭代修改
4. **动态 Prompt 构建**：根据当前人设数据、素材库动态拼接
5. **无全局状态库**：仅使用 `useState` / `useRef`，无 Redux/Zustand
