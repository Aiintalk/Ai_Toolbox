# Ai_Toolbox

面向**短视频内容创作与营销投放**场景的 AI 辅助工具集合，包含对标分析、脚本仿写、种草内容创作等功能模块。

---

## 一、项目基本信息

### 1. 项目定位

Ai_Toolbox 用于沉淀公司内部的 AI 辅助创作能力，帮助团队在短视频内容分析、脚本生成、投流内容仿写、种草内容创作等场景中提升效率。

### 2. 当前功能板块

| 子项目                 | 工具名称          | 功能说明 |
| ---------------------- | ----------------- | -------- |
| `portal`               | AI 工具箱导航主页 | 用于统一进入各个工具模块 |
| `benchmark-analyzer`   | 对标分析助手      | 输入抖音账号，抓取视频数据并生成内容分析结果 |
| `persona-writer-web`   | 人设脚本仿写助手  | 基于达人风格、参考视频和脚本结构生成仿写内容 |
| `qianchuan-writer-web` | 千川脚本仿写助手  | 上传产品资料、识别卖点并拼合投流脚本 |
| `seeding-writer-web`   | 种草内容仿写助手  | 生成偏种草风格、强调真实感和情绪表达的内容 |

规划中：人设复盘助手、直播间脚本仿写 / 复盘助手

### 3. 技术栈

| 层级       | 技术                              |
| ---------- | --------------------------------- |
| 框架       | Next.js 14.2.x（App Router）      |
| 语言       | TypeScript                        |
| UI         | React 18 + Tailwind CSS 3         |
| AI 接口    | OpenAI 兼容协议，流式输出         |
| 视频数据   | TikHub API（抖音视频 / 账号数据） |
| 音频转文字 | 阿里云 ASR                        |
| 文件存储   | 阿里云 OSS                        |

### 4. 环境变量配置

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

### 5. 数据目录结构

```text
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

## 二、开发环境准备与 Git 流程入口

### 1. 开发环境准备

在开始任何开发任务前，AI 或开发者需要先确认以下内容：

1. 当前电脑中已安装 Git
2. 当前项目目录为正确的 Ai_Toolbox 仓库目录
3. 当前仓库可以正常连接 GitHub 远程仓库
4. 已准备好对应的环境变量文件（如 `.env.local`）
5. 已明确本次任务属于哪个功能模块

### 2. AI 开发入口

本项目采用 **GitHub + 分支开发 + AI 执行 + PR 审核** 的协作方式。

在开始任何开发任务前，AI **必须先阅读本 README**，了解整个项目的基本情况和模块结构；随后再继续阅读根目录 `GIT_WORKFLOW.md`，按其中的标准流程完成 Git 检查、更新主分支、创建任务分支、提交、推送和分支清理等动作。如果无法完成GIT创建分支已经准备开发环境请反馈。

### 3. 文档阅读顺序

AI 在开始开发前，请按以下顺序阅读：

1. `README.md`
   - 了解整个项目的基本情况、模块结构和协作入口
2. `GIT_WORKFLOW.md`
   - 了解并执行 Git 标准流程

### 4. 开发启动要求

在执行任何功能开发前，不要直接修改代码，必须先根据 `GIT_WORKFLOW.md` 完成以下动作：

1. 检查本地 Git 状态
2. 切换到 `main`
3. 拉取 GitHub 最新代码
4. 创建并切换到本次任务分支。

