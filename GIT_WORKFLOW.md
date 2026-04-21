



# GIT_WORKFLOW.md

本文件为 Ai_Toolbox 项目的标准开发协作流程文件。

当 AI 读取本文件后，必须像执行 Skill 一样，严格按本文档定义的步骤顺序执行，不允许跳步、不允许合并步骤、不允许自行简化、不允许在未完成当前步骤前进入下一步。

执行要求如下：

1. 必须按步骤顺序依次执行
2. 每完成一步后，需根据流程要求继续进入下一步或向开发者反馈结果
3. 遇到报错、缺失项、环境异常或执行失败时，必须立即停止，并反馈具体问题
4. 未明确允许前，不得擅自开始代码修改、提交、推送或创建 PR
5. 所有 Git、记录、修改、提交流程，统一以本文件为唯一执行依据

---

### 远程仓库信息

本项目远程仓库地址：

```
https://github.com/Aiintalk/Ai_Toolbox.git
```

###  第一步：检查开发环境

AI 读取本文件后，首先必须检查当前开发环境是否就绪。

请依次执行以下命令：

```bash
# 1. 检查 Git 是否安装
git --version

# 2. 检查 Git 用户信息是否已配置
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

#### **判断规则：**

---

| 检查项                          | 异常情况          | Windows 处理方式                             | Mac 处理方式                           |
| ------------------------------- | ----------------- | -------------------------------------------- | -------------------------------------- |
| `git --version` 报错            | Git 未安装        | 下载安装 [git-scm.com](https://git-scm.com/) | `brew install git`                     |
| `user.name` / `user.email` 为空 | 提交信息无署名    | `git config --global user.name "名字"`       | `git config --global user.name "名字"` |
| `git remote -v` 地址不是本项目  | 仓库目录错误      | 切换到正确的项目目录                         | 切换到正确的项目目录                   |
| `gh --version` 报错             | GitHub CLI 未安装 | `winget install GitHub.cli`                  | `brew install gh`                      |
| `gh auth status` 未登录         | 无法推送和创建 PR | `gh auth login`                              | `gh auth login`                        |
| `node --version` 报错           | Node.js 未安装    | 下载安装 [nodejs.org](https://nodejs.org/)   | `brew install node`                    |

所有检查项均正常后，才可继续执行第二步。

如任一项异常，必须立即停止后续操作，并先反馈具体问题

------

### 第二步：检查 Git 状态并同步主分支

确认当前本地仓库状态正常，并在无异常的情况下切换到 main、拉取最新代码，为后续创建任务分支做准备。

【你必须先执行以下 Git 检查命令】

```bash

git status
git branch
git branch -vv
git remote -v
git fetch --all --prune
git branch --merged
git branch --no-merged

```

检查：

- 仓库是否正确
- 远程地址是否正确
- 是否有未提交改动
- 是否有旧分支未处理

如果有异常，停止并告诉我可选处理方式：上传、合并、删除。

如果正常，请执行以下命令，切换到主分支，获取仓库最新内容。

```bash
git checkout main
git pull origin main
```

完成以上步骤后，AI 需要向开发人员输出以下确认信息：

```
✅ 当前代码以从Github拉取最新版本。
```

以上全部完成后，才可继续执行第三步。

------

### **第三步：创建任务分支**

请先向开发人员确认本次任务分支名称，再创建任务分支，不要直接自动命名。

分支命名规则如下：

```text
格式：`姓名缩写月份日期`
示例：`yh0419`
```

请向开发人员提问：

```text
请提供本次任务的分支名称，我将按该分支名创建任务分支。
分支命名格式：姓名缩写月份日期，例如：yh0419
```

在开发人员提供分支名称后，再执行以下命令创建并切换分支：

```bash
git checkout -b 分支名称

```

分支创建完成后，继续读取根目录以下文件：

- 根目录 `README.md` — 了解整个项目的模块结构、技术栈、开发规范
- 根目录 `CHANGELOG.md` — 了解整个项目最近的里程碑和各模块更新情况

读取完成后，请按以下固定格式输出结果：

```
📋 项目概况
- 项目名称：Ai_Toolbox
- 当前模块：portal / benchmark-analyzer / persona-writer-web / qianchuan-writer-web / seeding-writer-web
- 最近更新：（来自根目录 CHANGELOG.md 的最新一条记录）

✅ 开发环境已准备完成
- 当前分支：xxx
- 基于：main 最新代码
- 分支已创建完成，可以开发啦！

```

要求：

1. 不要在开发人员未提供分支名称前创建分支
2. 不要跳过 README.md 和 CHANGELOG.md 的读取
3. 如果任何步骤报错，立即停止，并把错误信息反馈给开发人员
4. 完成以上步骤后，再进入第四步开发

---

### 第四步：读取根目录文档，了解项目全貌

在开始开发前，请先确认本次任务所属的功能板块。

可选功能板块包括：

```
- `portal`
- `benchmark-analyzer`
- `persona-writer-web`
- `qianchuan-writer-web`
- `seeding-writer-web`
```

请先向开发人员确认本次继续开发的功能板块。

确认后，读取对应子项目目录下的以下文件：

- `模块目录/README.md`
- `模块目录/CHANGELOG.md`

例如：

```
- 如果选择 `portal`，则读取：
  - `portal/README.md`
  - `portal/CHANGELOG.md`

- 如果选择 `benchmark-analyzer`，则读取：
  - `benchmark-analyzer/README.md`
  - `benchmark-analyzer/CHANGELOG.md`

- 如果选择 `persona-writer-web`，则读取：
  - `persona-writer-web/README.md`
  - `persona-writer-web/CHANGELOG.md`

- 如果选择 `qianchuan-writer-web`，则读取：
  - `qianchuan-writer-web/README.md`
  - `qianchuan-writer-web/CHANGELOG.md`

- 如果选择 `seeding-writer-web`，则读取：
  - `seeding-writer-web/README.md`
  - `seeding-writer-web/CHANGELOG.md`
```

版本号规则：

| 改动类型               | 版本变化  | 示例                |
| ---------------------- | --------- | ------------------- |
| 新增功能               | 第二位 +1 | `v1.0.0` → `v1.1.0` |
| 修复问题               | 第三位 +1 | `v1.0.0` → `v1.0.1` |
| 大规模重构或破坏性改动 | 第一位 +1 | `v1.0.0` → `v2.0.0` |

> ⚠️ 版本号必须基于子项目 `CHANGELOG.md` 中的最新版本，不能自行假设。如果没有版本号，则从 `v1.0.0` 开始。

读取完成后，向开发人员同步一下信息，并进入第五步开发。

```text
📦 模块概况
- 当前模块：xxx
- 当前版本：v1.0.0
- 最近更新：（来自子项目 CHANGELOG.md 的最新一条记录）
```

------

### 第五步：开始开发

当前任务分支已创建完成，Git 环境已准备就绪，模块信息已确认，可以根据需求开始开发。

------

### 第六步：开发完成后更新文档

功能开发完成后，AI 主动向开发人员输出改动摘要并请求确认，或开发人员说本次开发完成、开发结束后均需要向开发人员输出改动摘要并请求确认。

```text
✅ 功能已开发完成

- 当前模块：xxx
- 本次改动：
  - xxx
  - xxx
- 版本号：v1.0.0 → v1.0.1

是否确认提交？（确认后我将更新 CHANGELOG、提交代码并创建 PR）
```

开发人员回复"确认" / "可以" / "没问题"后，AI 执行以下操作：

1. 根据本次改动类型确定新版本号：
   - 新增功能 → 第二位 +1
   - 修复问题 → 第三位 +1
   - 大规模重构 → 第一位 +1
2. 在对应子项目 `CHANGELOG.md` 顶部新增一条记录：

```markdown
## v1.0.1 - 2026-04-19

### Added / Changed / Fixed
- 本次改动说明

### Notes
- 注意事项
```

3. 如果本次改动影响了功能说明、接口、使用流程等，同步更新子项目 `README.md`
4. 更新完成后进入第七步。

------

### 第七步：Git 提交

Git 提交前，AI 必须先让开发人员确认本次改动摘要，确认无误后再执行 add、commit、push。

**第一步：确认本次改动的文件列表**

```bash
git status
```

仔细查看输出结果，只 add 本次任务相关的文件，不允许使用 `git add .` 全部提交。

**第二步：add 本次相关文件**

```bash
git add 文件路径1 文件路径2 文件路径3
```

通常包含：

- 本次改动的功能文件
- 对应子项目的 `CHANGELOG.md`
- 对应子项目的 `README.md`（如有更新）

**Commit 规范**

Commit 信息统一格式：

```text
类型: 子项目 中文简述
```

| 类型       | 说明            |
| ---------- | --------------- |
| `feat`     | 新增功能        |
| `fix`      | 修复问题        |
| `docs`     | 文档更新        |
| `chore`    | 配置 / 依赖维护 |
| `refactor` | 代码重构        |

示例：

```
feat: qianchuan 新增卖点排列顺序选择功能
fix: persona 修复素材删除报错问题
docs: seeding 更新 CHANGELOG 和 README
```

**第三步：提交代码**

```bash
git commit -m "类型: 子项目 中文简述"
```

示例：

```bash
git commit -m "feat: qianchuan 新增卖点排列顺序选择功能"
git commit -m "fix: persona 修复素材删除报错问题"
git commit -m "docs: seeding 更新 CHANGELOG 和 README"
```

**第四步：提交完成后告知开发人员**

```
✅ 代码已提交

- 提交分支：yh0419
- 提交文件：（列出 add 的文件）
- 提交说明：（commit message）

即将推送到远程并创建 PR，是否继续？
```

开发人员确认后进入第八步。

------

### 第八步：推送远程并发起 PR

**第一步：推送当前分支到远程仓库**

```bash
git push -u origin <当前分支名>
```

如果提示 `gh: command not found`，先运行以下命令修复 PATH：

```bash
# Windows
export PATH="$PATH:/c/Program Files/GitHub CLI"

# Mac
export PATH="$PATH:/usr/local/bin"
```

**第二步：使用 GitHub CLI 创建 PR**

PR 的标题和内容根据本次实际改动填写，不要使用占位符：

```bash
gh pr create \
  --title "feat: qianchuan 新增卖点排列顺序选择功能" \
  --base main \
  --head <当前分支名> \
  --body "## Summary
- 本次具体改动说明1
- 本次具体改动说明2

## Test plan
- [ ] 测试项1
- [ ] 测试项2"
```

**第三步：PR 创建成功后告知开发人员**

```
✅ PR 已创建完成

- 分支：<当前分支名> → main
- PR 地址：<gh 返回的 PR 链接>
- 请负责人审核后合并。

```

---

### 第九步：等待审核

PR 提交后，AI 进入等待状态，当前任务分支保留，不做任何操作。

**等待期间注意：**

- 不要自行合并 PR
- 不要在当前分支继续开发新需求
- 如果有新需求，从最新 `main` 新开分支处理

**如果收到修改意见：**

```bash
git add 文件1 文件2
git commit -m "fix: 根据审核意见修改xxx"
git push origin <当前分支名>
```

push 完成后告知开发人员：

```
✅ 已根据审核意见修改完成

- 修改内容：xxx
- PR 已自动更新，请重新审核。
```

**等待开发人员回复"PR 已合并、合并完成、已合并、确认合并、完成合并、等语义后"后，才进入第十步。**

---

### 第十步：PR 合并后清理分支

收到开发人员"PR 已合并"的确认后，执行以下操作：

```bash
git checkout main
git pull origin main
git branch -d <当前分支名>
git push origin --delete <当前分支名>
```

清理完成后告知开发人员：

```
✅ 分支已清理完成

- 已删除本地分支：<当前分支名>
- 已删除远程分支：<当前分支名>
- 本地 main 已同步最新代码
- 本次任务全部完成 🎉
```

---

## 以上异常处理

### 情况 1：功能效果有问题

- 不合并，不删除分支
- 继续在原分支修改
- 修好后重新 push，PR 自动更新
- 告知开发人员重新审核

### 情况 2：PR 出现合并冲突

- 不删除分支
- 拉取最新 `main`，在原分支解决冲突：

```bash
git checkout main
git pull origin main
git checkout <当前分支名>
git merge main
# 解决冲突后
git add 冲突文件1 冲突文件2
git commit -m "fix: 解决合并冲突"
git push origin <当前分支名>
```

- 告知开发人员冲突已解决，请重新审核

### 情况 3：新需求在当前 PR 未合并时到来

- **与当前 PR 无依赖**：从最新 `main` 新开分支，单独提 PR
- **依赖当前 PR 代码**：等当前 PR 合并后，再从最新 `main` 开新分支

------

