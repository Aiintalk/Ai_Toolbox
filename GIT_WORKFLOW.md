

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

---

### 第一步：检查开发环境

AI 读取本文件后，首先必须检查当前开发环境是否就绪。

请依次执行以下命令：

```bash
# 1.1 检查 Git 是否安装
git --version

# 1.2 检查 Git 用户信息是否已配置
git config user.name
git config user.email

# 1.3 检查当前仓库远程地址是否正确
git remote -v

# 1.4 检查 GitHub CLI 是否安装
gh --version

# 1.5 检查 GitHub CLI 是否已登录
gh auth status

# 1.6 检查 Node.js 是否安装
node --version

# 1.7 检查当前目录下是否存在服务器配置 YAML 文件
find . -maxdepth 1 \( -name "ssh-*.yaml" -o -name "server-*.yaml" \)

# 1.8 从 YAML 文件中提取连接信息并测试登录
# ⚠️ 密码仅在本地使用，严禁提交到 Git，严禁在对话中打印或输出密码内容
HOST=$(yq '.server.host' ssh-*.yaml)
PORT=$(yq '.server.port' ssh-*.yaml)
USER=$(yq '.server.user' ssh-*.yaml)
PASS=$(yq '.server.password' ssh-*.yaml)

# Mac / Linux：使用 sshpass 自动登录
sshpass -p "$PASS" ssh -p $PORT -o StrictHostKeyChecking=no -o ConnectTimeout=5 $USER@$HOST "echo ok && exit"
# Windows：无 sshpass，改用以下
#   ssh -p $PORT $USER@$HOST（手动输入密码，登录后 exit 退出即可）

# 1.9 登录成功则退出，继续后续流程

# 1.10 检查服务器配置 YAML 文件是否已加入 .gitignore（防止密码误提交）
```

#### **判断规则：**

---

| 检查项 | 异常情况 | Windows 处理方式 | Mac 处理方式 |
| --- | --- | --- | --- |
| `git --version` 报错 | Git 未安装 | 下载安装 [git-scm.com](https://git-scm.com/) | `brew install git` |
| `user.name` / `user.email` 为空 | 提交信息无署名 | `git config --global user.name "名字"` | `git config --global user.name "名字"` |
| `git remote -v` 地址不是本项目 | 仓库目录错误 | 切换到正确的项目目录 | 切换到正确的项目目录 |
| `gh --version` 报错 | GitHub CLI 未安装 | `winget install GitHub.cli` | `brew install gh` |
| `gh auth status` 未登录 | 无法推送和创建 PR | `gh auth login` | `gh auth login` |
| `node --version` 报错 | Node.js 未安装 | 下载安装 [nodejs.org](https://nodejs.org/) | `brew install node` |
| 未检测到 `ssh-*.yaml` 或 `server-*.yaml` | 未配置服务器连接文件 | 提醒从飞书下载 `ssh-*.yaml` | 提醒从飞书下载 `ssh-*.yaml` |
| 测试服务器连接失败 | 服务器不可连接或账号无法登录 | 检查 YAML 中 host / port / user / password 是否正确 | 检查 YAML 中 host / port / user / password 是否正确 |
| `ssh-*.yaml` 或 `server-*.yaml` 未加入 `.gitignore` | 存在误提交服务器账号密码风险 | 必须先加入 `.gitignore` 后才能继续 | 必须先加入 `.gitignore` 后才能继续 |

所有检查项均正常后，才可继续执行第二步。

如任一项异常，必须立即停止后续操作，并先反馈具体问题。

---

### 第二步：检查 Git 状态并同步主分支

确认当前本地仓库状态正常，并在无异常的情况下切换到 main、拉取最新代码，为后续创建任务分支做准备。

2.1 执行以下 Git 检查命令

```bash
git status
git branch
git branch -vv
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

2.2 切换并同步主分支

如果正常，执行以下命令切换到主分支并拉取最新代码：

```bash
git checkout main
git pull origin main
```

完成后向开发人员输出确认信息：

```
✅ 当前代码已从 Github 拉取最新版本。
```

以上全部完成后，才可继续执行第三步。

---

### 第三步：创建任务分支

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

分支创建完成后，向开发人员输出确认信息：

```
✅ 分支已创建：xxx
基于 main 最新代码，可进入下一步。
```

以上完成后，才可继续执行第四步。

---

### 第四步：读取项目文档，了解项目全貌

#### 4.1 读取根目录文档

首先读取根目录以下文件：

- 根目录 `README.md` — 了解整个项目的模块结构、技术栈、开发规范
- 根目录 `CHANGELOG.md` — 了解整个项目最近的里程碑和各模块更新情况

#### 4.2 确认本次任务所属功能板块

执行以下命令读取根目录结构，自动列出所有子项目目录：

```bash
ls -d */ 
```

将输出的子目录列表整理后，向开发人员展示并确认本次开发的功能板块：

```
当前项目包含以下功能板块：
（根据 ls -d */ 输出动态列出，例如：）
- portal
- benchmark-analyzer
- persona-writer-web
- qianchuan-writer-web
- seeding-writer-web
- ...

请确认本次开发的功能板块是哪个？
```

#### 4.3 读取子项目文档

确认后，读取对应子项目目录下的以下文件：

- `模块目录/README.md`
- `模块目录/CHANGELOG.md`

例如：

```
- 如果选择 portal，则读取：
  - portal/README.md
  - portal/CHANGELOG.md

- 如果选择 benchmark-analyzer，则读取：
  - benchmark-analyzer/README.md
  - benchmark-analyzer/CHANGELOG.md

（其他模块以此类推）
```

#### 4.4 输出确认信息

读取完成后，按以下固定格式输出结果：

```
📋 项目概况
- 项目名称：Ai_Toolbox
- 根目录最近更新：（来自根目录 CHANGELOG.md 的最新一条记录）

📦 模块概况
- 当前模块：xxx
- 当前版本：v1.0.0
- 最近更新：（来自子项目 CHANGELOG.md 的最新一条记录）

✅ 开发环境已准备完成
- 当前分支：xxx
- 基于：main 最新代码
- 分支已创建完成，可以开发啦！
```

---

### 第五步：开始开发

当前任务分支已创建完成，Git 环境已准备就绪，模块信息已确认，可以根据需求开始开发。

开发期间必须遵守以下规范：

1. **只修改本次任务相关文件**，不允许改动其他模块或无关文件
2. **不允许自行安装新依赖**，需先告知开发人员说明原因并等待确认
3. **遇到改动范围超出预期的情况**，必须停下来说明原因并询问开发人员，不允许擅自扩展
4. **遇到任何报错或无法解决的问题**，立即停止并反馈给开发人员

---

### 第六步：部署测试服务器

开发完成后，AI 必须先输出本次改动摘要，并请求开发人员确认是否部署到测试服务器。

在开发人员明确回复"是 / 确认 / 可以 / 需要 / 没问题"等部署确认前，不允许连接服务器、不允许推送文件、不允许重启服务。

#### 6.1 部署前摘要确认

```
✅ 功能已开发完成

当前模块：xxx-web
本次改动文件：
- app/xxx.tsx（改动说明）
- app/api/xxx/route.ts（改动说明）

是否需要部署到测试服务器查看效果？
A. 是，部署到测试服务器
B. 否，直接提交 Git
```

如开发人员选择 A，继续执行 6.2。
如开发人员选择 B，跳过第六步剩余内容和第七步，直接进入第八步。

#### 6.2 读取服务器配置 YAML 并连接服务器

开发人员确认后，AI 自动从第一步检测到的 YAML 文件中提取连接信息：

```bash
# 从 YAML 中提取字段
HOST=$(yq '.server.host' ssh-*.yaml)
PORT=$(yq '.server.port' ssh-*.yaml)
USER=$(yq '.server.user' ssh-*.yaml)
PASS=$(yq '.server.password' ssh-*.yaml)
```

> ⚠️ 提取后直接用于连接，严禁在对话中打印或输出 PASS 的值

连接服务器后执行：

```bash
# 6.2.1 检查服务运行状态
sshpass -p "$PASS" ssh -p $PORT -o StrictHostKeyChecking=no $USER@$HOST "sudo pm2 list"

# 6.2.2 将本次开发的文件推送到测试服务器
sshpass -p "$PASS" rsync -avz -e "ssh -p $PORT -o StrictHostKeyChecking=no" \
  --exclude='node_modules' --exclude='.next' --exclude='.env.local' \
  ./xxx-web/ $USER@$HOST:/opt/dev/Ai_Toolbox/xxx-web/

# 6.2.3 推送成功后向用户反馈：
# - 服务运行状态
# - 文件推送位置
# - ⚠️ 需要重新构建并重启服务（npm run build + pm2 restart）才能生效，是否确认？
```

#### 6.3 构建并重启（用户确认后执行）

```bash
# 远程执行构建和重启
sshpass -p "$PASS" ssh -p $PORT -o StrictHostKeyChecking=no $USER@$HOST << 'EOF'
cd /opt/dev/Ai_Toolbox/xxx-web
npm run build
sudo pm2 restart test-xxx
EOF

# 验证：HTTP 状态码 + 页面关键词
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://$HOST/xxx)
BODY=$(curl -s http://$HOST/xxx)
echo "HTTP 状态码：$HTTP_CODE"
echo $BODY | grep -q "页面关键词" && echo "✅ 页面内容正常" || echo "⚠️ 页面内容异常，请人工确认"
```

#### 6.4 部署结果反馈

```
部署结果：✅ 成功
build 耗时：xx 秒
PM2 状态：online
HTTP 验证：200
页面内容：✅ 正常
测试地址：http://120.26.111.136/xxx
```

部署完成，进入第七步。

---

### 第七步：用户测试及功能 BUG 修复

本步骤等待用户测试反馈，AI 不主动推进。

> ⏱️ 如等待超过 30 分钟未收到反馈，AI 可主动询问一次："测试是否完成，或有需要调整的地方？"之后继续等待，不再重复询问。

如用户反馈有问题 / 需要修改 / 需要升级：

7.1 AI 正常进行开发修复

7.2 修复完成后询问用户是否重新部署

```
✅ 修复已完成

当前模块：xxx-web
本次改动文件：
- app/xxx.tsx（改动说明）

是否确认重新部署到测试服务器？
```

7.3 用户回复"是 / 可以 / 确认"后，按第六步 6.2 完整流程执行：

```
rsync 推送文件 → npm run build → pm2 restart → HTTP + 页面内容验证
```

7.4 部署完成后输出反馈：

```
当前模块：xxx-web
本次改动文件：
- app/xxx.tsx（改动说明）

部署结果：✅ 成功
build 耗时：xx 秒
PM2 状态：online
HTTP 验证：200
测试地址：http://120.26.111.136/xxx
```

7.5 回到等待用户测试（循环以上步骤）

直到用户明确反馈测试通过 / 测试完成后，断开服务器连接，进入第八步。

---

### 第八步：测试通过，更新文档

用户测试通过后，AI 根据本次实际改动更新文档。

版本号规则：

| 改动类型 | 版本变化 | 示例 |
| --- | --- | --- |
| 新增功能 | 第二位 +1 | `v1.0.0` → `v1.1.0` |
| 修复问题 | 第三位 +1 | `v1.0.0` → `v1.0.1` |
| 大规模重构或破坏性改动 | 第一位 +1 | `v1.0.0` → `v2.0.0` |

> ⚠️ 版本号必须基于子项目 `CHANGELOG.md` 中的最新版本，不能自行假设。如果没有版本号，则从 `v1.0.0` 开始。

8.1 根据本次改动类型确定新版本号：
   - 新增功能 → 第二位 +1
   - 修复问题 → 第三位 +1
   - 大规模重构 → 第一位 +1

8.2 在对应子项目 `CHANGELOG.md` 顶部新增一条记录：

```markdown
## v1.0.1 - 2026-05-22

### Added / Changed / Fixed
- 本次改动说明

### Notes
- 注意事项
```

8.3 如果本次改动影响了功能说明、接口、使用流程等，同步更新子项目 `README.md`

8.4 更新完成后进入第九步。

---

### 第九步：Git 提交

AI 执行 `git status` 检查改动文件，整理后一次性向开发人员输出完整提交摘要，确认后直接执行 add 和 commit，不再二次询问。

9.1 执行 `git status`，整理改动文件列表，输出以下确认信息：

```
📋 本次提交内容

- 提交分支：yh0522
- 提交文件：
  - xxx/app/page.tsx（改动说明）
  - xxx/CHANGELOG.md（改动说明）
- 提交说明：feat: xxx 本次改动简述

确认无误后回复"继续"，我将直接执行提交。
```

> ⚠️ 如果 `git status` 中出现与本次任务无关的改动文件，不允许自行处理，必须在摘要中单独列出并询问开发人员：保留暂存（`git stash`）、丢弃（`git checkout -- 文件`）、还是一并提交？等待开发人员明确指示后再继续。

9.2 开发人员回复"继续"后，直接执行 add 和 commit：

```bash
git add 文件路径1 文件路径2
git commit -m "类型: 子项目 中文简述"
```

**Commit 规范**

Commit 信息统一格式：

```text
类型: 子项目 中文简述
```

| 类型 | 说明 |
| --- | --- |
| `feat` | 新增功能 |
| `fix` | 修复问题 |
| `docs` | 文档更新 |
| `chore` | 配置 / 依赖维护 |
| `refactor` | 代码重构 |

示例：

```
feat: qianchuan 新增卖点排列顺序选择功能
fix: persona 修复素材删除报错问题
docs: seeding 更新 CHANGELOG 和 README
```

9.3 提交完成后告知开发人员：

```
✅ 代码已提交

- 提交分支：yh0522
- 提交文件：（列出 add 的文件）
- 提交说明：（commit message）

即将推送到远程并创建 PR，是否继续？
```

开发人员确认后进入第十步。

---

### 第十步：推送远程并发起 PR

10.1 推送当前分支到远程仓库

```bash
git push -u origin <当前分支名>
```

如果提示 `gh: command not found`，先运行以下命令修复 PATH：

```bash
# Mac / Linux
export PATH="$PATH:/usr/local/bin"

# Windows PowerShell
$env:PATH += ";C:\Program Files\GitHub CLI"

# Windows CMD
set PATH=%PATH%;C:\Program Files\GitHub CLI
```

10.2 使用 GitHub CLI 创建 PR

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

10.3 PR 创建成功后告知开发人员

```
✅ PR 已创建完成

- 分支：<当前分支名> → main
- PR 地址：<gh 返回的 PR 链接>
- 请负责人审核后合并。
```

---

### 第十一步：等待审核

PR 提交后，AI 进入等待状态，当前任务分支保留，不做任何操作。

**等待期间注意：**

- 不要自行合并 PR
- 不要在当前分支继续开发新需求
- 如果有新需求，从最新 `main` 新开分支处理

**如果收到修改意见：**

11.1 在当前分支修改代码

11.2 修改完成后提交并推送：

```bash
git add 文件1 文件2
git commit -m "fix: 根据审核意见修改xxx"
git push origin <当前分支名>
```

11.3 如改动影响页面效果，询问开发人员是否需要重新部署到测试服务器确认：

```
✅ 已根据审核意见修改完成

- 修改内容：xxx
- 是否需要重新部署到测试服务器确认效果？
```

11.4 push 完成后告知开发人员：

```
✅ PR 已自动更新，请重新审核。
```

**等待开发人员回复"PR 已合并、合并完成、已合并、确认合并、完成合并"等语义后，才进入第十二步。**

---

### 第十二步：PR 合并后清理分支

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

## 异常处理

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
