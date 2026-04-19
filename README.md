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

在开始任何开发任务前，AI **必须先阅读本 README**，了解整个项目的基本情况和模块结构；随后再继续阅读根目录 `GIT_WORKFLOW.md`，按其中的标准流程完成 Git 检查、更新主分支、创建任务分支、提交、推送和分支清理等动作。如果无法完成 Git 创建分支以及准备开发环境，请及时反馈。

### 3. 文档阅读顺序

AI 在开始开发前，请按以下顺序阅读：

1. `README.md` — 了解整个项目的基本情况、模块结构和协作入口
2. `GIT_WORKFLOW.md` — 了解并执行 Git 标准流程

### 4. 开发启动流程（AI 执行步骤）

在执行任何功能开发前，不要直接修改代码，必须按以下步骤完成环境准备：

**第一步：检查开发环境**

依次运行以下命令，逐项确认环境是否就绪：

```bash
# 1. 检查 Git 是否安装
git --version

# 2. 检查 Git 用户信息是否配置
git config user.name
git config user.email

# 3. 检查当前仓库远程地址是否正确
git remote -v

# 4. 检查 GitHub CLI 是否安装
gh --version

# 5. 检查 GitHub CLI 是否已登录
gh auth status

# 6. 检查 Node.js 是否安装
node --version
```

**判断规则：**

| 检查项 | 异常情况 | Windows 处理方式 | Mac 处理方式 |
|--------|----------|------------------|--------------|
| `git --version` 报错 | Git 未安装 | 下载安装 [git-scm.com](https://git-scm.com) | `brew install git` |
| `user.name` / `user.email` 为空 | 提交信息无署名 | `git config --global user.name "名字"` | 同左 |
| `git remote -v` 地址不是本项目 | 仓库目录错误 | 切换到正确的项目目录 | 同左 |
| `gh --version` 报错 | GitHub CLI 未安装 | `winget install GitHub.cli` | `brew install gh` |
| `gh auth status` 未登录 | 无法推送和创建 PR | `gh auth login` | 同左 |
| `node --version` 报错 | Node.js 未安装 | 下载安装 [nodejs.org](https://nodejs.org) | `brew install node` |

所有检查项均正常后，再继续执行第二步。

**第二步：切换到 main 并拉取最新代码**

```bash
git checkout main
git pull origin main
```

确保本地 `main` 分支与远程保持一致，避免基于旧代码开发。

**第三步：创建任务分支**

按以下规则命名并创建分支：

- 格式：`姓名缩写月份日期`
- 示例：`yh0419`

```bash
git checkout -b 姓名缩写月份日期
```

**第四步：确认并告知开发人员**

完成以上步骤后，AI 需要向开发人员输出以下确认信息：

```
✅ 开发环境已准备完成

- 当前分支：xxx（根据实际分支名填写）
- 基于：main 最新代码
- 分支已创建完成，可以开发啦！
```

如果任何步骤出现错误，请停止操作并将错误信息反馈给开发人员。

