# persona-positioning — 人设定位助手

## 1. 项目定位

面向 MCN 机构和内容运营团队的 AI 工具，通过三步引导流程，基于达人自填采集表、抖音账号数据和对标参考资料，由 AI 自动生成专属的「人格档案」与「内容规划」，并支持导出为 Word 文档。

## 2. 当前功能

- 输入抖音号或主页链接，自动拉取账号数据（TikHub），提取点赞 TOP10 文案
- 上传达人采集表文件（Word / PDF / TXT / MD），AI 提取有效内容
- 与 `kol-intake` 联动，可直接从已采集的达人信息中导入
- 运营可补充主观判断文字及额外文档
- 上传对标账号的人格档案 / 内容规划作为参考
- AI 流式生成人格档案与内容规划（`claude-sonnet-4-6`），实时渲染
- 结果一键复制或导出为 `.docx` 文件
- 提供达人入职信息采集表模板（`/public/达人入职信息采集表模板.docx`）供下载

## 3. 使用流程

**Step 1 — 填写达人资料**
1. 输入达人抖音号或主页链接，点击「解析」（填写了抖音号则必须完成解析）
2. 上传达人采集表，或从「红人信息采集」下拉列表中直接导入
3. 在文本框补充运营的主观判断（可选），并可上传额外参考文档
4. 点击「下一步：上传对标资料」

**Step 2 — 上传对标资料**
1. 上传对标账号人格档案文件（可选）
2. 上传对标账号内容规划文件（可选）
3. 点击「开始生成人格档案与内容规划」

**Step 3 — 查看与导出结果**
1. AI 流式输出，先输出「人格档案」，再输出「内容规划」
2. 通过 Tab 切换两部分内容，可随时复制或导出 Word
3. 点击「← 返回」可中止生成并重新填写

## 4. 目录结构

```
persona-positioning/
├── app/
│   ├── page.tsx                       # 主页面（三步流程）
│   ├── layout.tsx
│   ├── globals.css
│   └── api/
│       ├── generate/route.ts          # AI 流式生成接口
│       ├── fetch-account/route.ts     # 抖音账号数据抓取
│       ├── kol-submissions/route.ts   # 读取 kol-intake 已采集数据
│       ├── parse-file/route.ts        # 文件解析（Word/PDF/TXT/MD）
│       └── export-word/route.ts       # Word 文档导出
├── lib/
│   ├── yunwu.ts                       # 云雾 AI 封装
│   └── tikhub.ts                      # TikHub 抖音数据封装
├── public/
│   └── 达人入职信息采集表模板.docx       # 可下载的采集表模板
├── next.config.js
├── tailwind.config.js
├── tsconfig.json
└── package.json
```

## 5. 核心接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/generate` | POST | 接收达人信息和对标资料，SSE 流式返回人格档案 + `===SPLIT===` + 内容规划 |
| `/api/fetch-account` | POST | 接收 `{ url }`，调用 TikHub 返回 TOP10 文案等数据 |
| `/api/kol-submissions` | GET | 读取 `/opt/kol-intake/data/` 目录，返回已采集达人列表 |
| `/api/parse-file` | POST | multipart/form-data，解析 PDF/DOCX/TXT/MD，返回提取文本（最多 8000 字） |
| `/api/export-word` | POST | 接收 `{ influencerName, profileResult, planResult, type }`，返回 `.docx` 文件流 |

## 6. 环境变量

```env
YUNWU_API_KEY=        # 云雾 AI API 密钥
YUNWU_BASE_URL=       # 云雾 AI 接口地址
TIKHUB_API_KEY=       # TikHub API 密钥（抖音账号解析）
```

**运行：**
```bash
npm install && npm run dev
```

访问地址：`http://localhost:3000`（部署时 basePath 为 `/persona-positioning`，端口 3006）

## 7. 开发注意事项

- `basePath` 为 `/persona-positioning`，所有路由以此为前缀
- `kol-submissions` 接口硬编码读取 `/opt/kol-intake/data/` 目录，需与 kol-intake 共存于同一服务器
- 文件解析截断至 8000 字，超长文档会丢失后段内容
- `parse-file` 接口依赖 `mammoth`（Word）和 `unpdf`（PDF）库，部署前需确认已安装
- AI 生成使用 `===SPLIT===` 分隔两份文档，前端据此切割展示
- Word 导出仅支持基础 Markdown 语法（标题、列表、引用、加粗），表格等不支持

## 8. 当前状态 / 已知问题

- **完成度**：核心三步流程完整，V2.0 新增工具
- **已知问题**：
  - `kol-submissions` 路径硬编码为 `/opt/kol-intake/data/`，Windows 开发环境不适用
  - 文件解析 8000 字截断，长文档需拆分上传
  - Word 导出不支持表格等复杂 Markdown 格式
  - 无身份验证

## 9. 流程功能测试

| 步骤 | 测试项 | 操作说明 | 预期结果 | 状态 |
|------|--------|----------|----------|------|
| Step 1 | 抖音账号解析 | 输入抖音号，点击解析 | 返回账号信息和 TOP10 文案 | ⬜ |
| Step 1 | 上传采集表 | 上传 Word/PDF 采集表 | 文件解析成功，内容显示在预览区 | ⬜ |
| Step 1 | 导入 kol-intake 数据 | 从下拉列表选择已采集达人 | 正确导入达人信息 | ⬜ |
| Step 1 | 进入下一步 | 完成必填项后点击下一步 | 正常跳转到 Step 2 | ⬜ |
| Step 2 | 上传对标资料 | 上传对标人格档案文件 | 文件解析成功 | ⬜ |
| Step 2 | 开始生成 | 点击「开始生成」 | 切换到结果页，AI 流式输出 | ⬜ |
| Step 3 | 人格档案 Tab | 查看人格档案 | 内容完整展示 | ⬜ |
| Step 3 | 内容规划 Tab | 查看内容规划 | 内容完整展示 | ⬜ |
| Step 3 | 复制 | 点击复制 | 内容复制到剪贴板 | ⬜ |
| Step 3 | 导出 Word | 点击「导出人格档案」 | 下载 .docx 文件 | ⬜ |
| 模板下载 | 下载采集表模板 | 点击模板下载链接 | 成功下载 .docx 模板文件 | ⬜ |

> 状态标记：⬜ 未测试 / ✅ 通过 / ❌ 未通过

## 10. 文档更新说明

- **2026-04-23**：初次创建 README，V2.0 新增工具，基于当前代码整理
