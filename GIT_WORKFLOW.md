# GIT_WORKFLOW.md

## 1. 文档目的

本文件用于统一 Ai_Toolbox 项目的 Git 操作流程，确保多人协作开发时：

- 代码基准统一
- 分支规则清晰
- 提交流程一致
- PR 审核边界明确
- 分支清理时机正确

本文件适用于整个项目仓库，不针对单一功能模块。

## 远程仓库信息

本项目远程仓库地址：

```
https://github.com/Aiintalk/Ai_Toolbox.git
```

---

## 2. 核心原则

1. **GitHub 是唯一正式代码基准**
   - 所有开发必须基于 GitHub 当前最新版本进行
   - 不以个人电脑代码、个人测试环境代码作为正式基准

2. **一个分支只做一个任务**
   - 一个分支只对应一个明确需求
   - 不允许在同一个分支中混入多个独立任务

3. **PR 提交后，分支默认冻结**
   - PR 提交后，除非是为了响应审核意见，否则不要继续往该分支添加新需求

4. **只要 PR 还没合并，分支就不能删除**
   - 删除分支的前提是：PR 已合并

5. **Git 提交只能提交本次任务相关文件**
   - 不允许使用 `git add .` 直接把所有改动全部提交

---

## 3. 标准执行流程

### 第一步：开始前检查

AI 先检查：

- 当前目录是否为正确的 Git 仓库
- 当前是否存在未提交改动
- 当前所在分支
- 本地是否存在已合并但未清理的旧分支

建议先执行：

```bash
git status
git branch
```

---

### 第二步：切换到 main 并更新仓库

所有新任务都必须从最新 `main` 开始：

```bash
git checkout main
git pull origin main
```

---

### 第三步：创建任务分支并切换

分支命名格式：

```text
<类型>/<子项目>-<简短描述>
```

例如：

```bash
git checkout -b feature/seeding-copy-button
```

---

### 第四步：读取功能文档

创建分支后，继续读取：

- 当前功能模块的 `README.md`
- 当前功能模块的 `CHANGELOG.md`

以理解当前模块的功能状态、最近变更和开发注意事项。

---

### 第五步：开始开发前做记录

AI 先记录当前模块基础信息：

- 当前模块名称
- 当前模块版本号
- 当前模块当前功能说明
- 当前模块最近一次更新记录
- 本次任务目标

---

### 第六步：开始开发

老板提出需求，AI 在当前任务分支中开发。

---

### 第七步：开发完成后更新记录和文档

功能开发完成并确认无误后，AI 需要：

- 记录本次修改内容
- 判断版本号变化
- 更新当前功能模块 `README.md`
- 更新当前功能模块 `CHANGELOG.md`
- 生成本次修改说明

---

### 第八步：Git 提交

AI 只提交本次任务相关文件，不全部提交。

```bash
git status
git add 文件1 文件2 文件3
git commit -m "<类型>(<子项目>): <中文简述>"
```

---

### 第九步：推送远程并发起 PR

AI 推送当前任务分支到远程仓库，并发起 PR。

```bash
git push -u origin <当前分支名>
```

---

### 第十步：等待审核

PR 提交后，当前任务分支保留。

如果负责人提出修改意见，则继续在原分支修正并更新同一个 PR。

---

### 第十一步：PR 合并后清理分支

只有在 PR 已合并后，AI 才执行以下操作：

```bash
git checkout main
git pull origin main
git branch -d <当前分支名>
git push origin --delete <当前分支名>
```

---

## 4. 分支命名规范

分支命名统一使用：

```text
<类型>/<子项目>-<简短描述>
```

### 分支类型

- `feature/`：新增功能
- `fix/`：修复问题
- `docs/`：文档更新
- `chore/`：配置 / 依赖维护
- `refactor/`：代码重构

### 子项目统一命名

- `portal`
- `benchmark`
- `persona`
- `qianchuan`
- `seeding`

### 示例

```text
feature/seeding-copy-button
fix/persona-video-fetch-error
docs/benchmark-readme-update
chore/qianchuan-env-cleanup
refactor/benchmark-export-flow
```

---

## 5. Commit 规范

Commit 信息统一格式：

```text
<类型>(<子项目>): <中文简述>
```

### 示例

```text
feat(seeding): 新增结果复制按钮
fix(persona): 修复视频链接为空时报错
docs(benchmark): 更新功能说明文档
chore(qianchuan): 调整环境变量示例
refactor(seeding): 拆分结果展示组件
```

---

## 6. PR 提交后的规则

PR 提交后：

1. 当前任务分支必须保留
2. 不允许立即删除分支
3. 若负责人提出修改意见，可继续在原分支上修改
4. 若老板提出的是全新需求，不得继续写入当前待审核分支，应新建分支处理

---

## 7. 新需求很快又来的处理规则

如果当前 PR 还没合并，但新需求又来了：

### 情况 A：新需求与当前 PR 无依赖关系
- 从最新 `main` 新开分支
- 新需求单独提新 PR

### 情况 B：新需求依赖当前未合并 PR 的代码
- 建议等待当前 PR 先合并
- 合并后再从最新 `main` 开新分支继续开发

---

## 8. 异常处理

### 情况 1：功能效果有问题
- 不合并
- 不删除分支
- 继续在原分支修改
- 修好后重新提交并更新原 PR

### 情况 2：PR 无法合并 / 出现冲突
- 不删除分支
- 拉取最新 `main`
- 在原分支解决冲突
- 重新提交并 push
- 等待再次审核

---

## 9. 分支删除规则

只有在以下条件都满足时，才可以删除当前任务分支：

1. 当前 PR 已合并
2. 当前任务已完成
3. 当前分支后续不再需要保留

### 删除顺序

```bash
git checkout main
git pull origin main
git branch -d <当前分支名>
git push origin --delete <当前分支名>
```
