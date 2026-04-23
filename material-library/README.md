# material-library — 素材库维护工具

## 1. 项目定位

面向 MCN 运营人员的 AI 仿写素材库管理工具。为每个达人维护人格档案、内容规划和分类素材，提供抖音视频自动抓取与语音转文字功能，帮助团队积累仿写参考素材，并通过 AI 对话生成贴合风格的文案。

## 2. 当前功能

- 多达人档案管理，每个达人有独立目录，含人格档案（`soul.md`）和内容规划（`content-plan.md`）
- 在线编辑并保存人格档案与内容规划
- 素材分 6 类管理：红人爆款文案、红人喜欢的内容、风格参考、千川爆款文案、千川喜欢的内容、千川风格参考
- 素材按类型分组展示，支持展开/折叠、删除
- 抖音视频信息抓取（TikHub）+ 语音转文字（阿里云 ASR），自动填充素材内容
- AI 流式对话，以达人档案 + 素材为上下文生成仿写文案（`claude-opus-4-6-thinking`）

> 注意：material-library 的达人数据（`data/personas/`）被 persona-writer、qianchuan-writer、seeding-writer 共享调用（通过 `/material-library/api/personas`），是整个工具箱的达人数据中心。

## 3. 使用流程

1. 访问 `/material-library/`，在「选择达人」下拉框中选择目标达人
2. 在「达人档案」区域查看或编辑人格档案和内容规划，点击保存
3. 在对应素材分类下点击添加按钮，填写标题和内容（可选填点赞数）
4. 若需从抖音视频获取素材：粘贴分享链接 → 自动抓取视频信息 → 提交 ASR 转录 → 等待结果 → 将文案作为素材内容保存
5. 在「已有素材目录」查看所有分类素材，可展开查看全文或删除
6. 在对话框中输入需求，AI 基于当前达人档案和素材生成仿写文案

## 4. 目录结构

```
material-library/
├── app/
│   ├── page.tsx                         # 素材库主页面（单页应用）
│   ├── layout.tsx
│   ├── globals.css
│   └── api/
│       ├── chat/route.ts                # AI 流式对话接口
│       ├── fetch-video/route.ts         # 抖音视频信息抓取
│       ├── personas/
│       │   ├── route.ts                 # GET 获取达人列表 / PUT 保存档案
│       │   └── references/route.ts     # POST 添加素材 / DELETE 删除素材
│       └── transcribe/
│           ├── upload/route.ts          # 下载视频 + 上传 OSS + 提交 ASR
│           └── poll/route.ts            # 轮询 ASR 转录结果
├── lib/
│   ├── yunwu.ts                         # 云雾 AI 流式对话封装
│   ├── tikhub.ts                        # TikHub 抖音视频封装
│   ├── aliyun-oss.ts                    # 阿里云 OSS 上传
│   └── aliyun-asr.ts                    # 阿里云语音识别（提交 + 轮询）
├── data/
│   └── personas/
│       └── {达人名}/
│           ├── soul.md                  # 人格档案
│           ├── content-plan.md          # 内容规划
│           └── references/
│               └── *.md                 # 素材文件（Markdown front-matter 格式）
├── next.config.js
├── tailwind.config.js
├── tsconfig.json
└── package.json
```

## 5. 核心接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/personas` | GET | 读取所有达人目录，返回人格档案、内容规划、素材列表 |
| `/api/personas` | PUT | 保存达人 `soul`（`soul.md`）或 `contentPlan`（`content-plan.md`） |
| `/api/personas/references` | POST | 为指定达人添加素材（写入带 frontmatter 的 `.md` 文件） |
| `/api/personas/references` | DELETE | 删除指定达人的某条素材文件 |
| `/api/chat` | POST | AI 流式对话，body: `{ messages, systemPrompt, model? }` |
| `/api/fetch-video` | POST | 解析抖音视频，body: `{ shareUrl }` |
| `/api/transcribe/upload` | POST | 下载视频 → 上传 OSS → 提交 ASR，返回 `{ taskId }` |
| `/api/transcribe/poll` | POST | 轮询 ASR 转录结果 |

## 6. 环境变量

```env
YUNWU_API_KEY=               # 云雾 AI API 密钥（必填，无默认值）
YUNWU_BASE_URL=              # 云雾 AI 接口地址（必填，无默认值）
TIKHUB_API_KEY=              # TikHub API 密钥
ALIYUN_ACCESS_KEY_ID=        # 阿里云 AccessKey ID
ALIYUN_ACCESS_KEY_SECRET=    # 阿里云 AccessKey Secret
ALIYUN_APPKEY=               # 阿里云 ASR AppKey
```

> 注意：`YUNWU_API_KEY` 和 `YUNWU_BASE_URL` 在 `lib/yunwu.ts` 中使用了非空断言（`!`），未配置时运行时直接报错，无默认值。

**运行：**
```bash
npm install && npm run dev
```

访问地址：`http://localhost:3000`（部署时 basePath 为 `/material-library`，端口 3008）

## 7. 开发注意事项

- `basePath` 为 `/material-library`，前端通过 `const BASE = '/material-library'` 统一管理
- **本服务的 `/api/personas` 是其他三个仿写工具的共享数据源**，需优先保证本服务在线
- `data/personas/` 目录不随代码入库，需手动在服务器上创建达人子目录
- OSS Bucket 名称 `hersystem-media-tmp` 硬编码在 `lib/aliyun-oss.ts` 中
- 抖音 CDN 链接有效期短，`fetchVideo` 返回的 `playUrl` 需立即用于 ASR 上传

## 8. 当前状态 / 已知问题

- **完成度**：核心素材管理功能完整，V2.0 新增工具
- **已知问题**：
  - 无鉴权：任何人可访问、修改、删除达人素材数据
  - 前端无法新建达人，需手动在服务器创建 `data/personas/{达人名}/` 目录
  - OSS Bucket 硬编码，更换需修改源码
  - 本地文件存储，重新部署时需注意数据持久化

## 9. 流程功能测试

| 步骤 | 测试项 | 操作说明 | 预期结果 | 状态 |
|------|--------|----------|----------|------|
| 基础 | 达人列表加载 | 进入页面，查看下拉列表 | 显示所有可用达人 | ⬜ |
| 基础 | 切换达人 | 选择不同达人 | 正确加载对应档案和素材 | ⬜ |
| 档案 | 编辑人格档案 | 修改内容后点击保存 | 保存成功，刷新后内容保留 | ⬜ |
| 档案 | 编辑内容规划 | 修改内容后点击保存 | 保存成功，刷新后内容保留 | ⬜ |
| 素材 | 添加素材 | 填写标题和内容，选择类型，点击保存 | 素材出现在对应分类列表 | ⬜ |
| 素材 | 查看素材 | 展开素材列表 | 正确显示素材全文 | ⬜ |
| 素材 | 删除素材 | 点击删除并确认 | 素材从列表中移除 | ⬜ |
| 转录 | 视频链接抓取 | 输入抖音分享链接 | 返回视频标题和信息 | ⬜ |
| 转录 | 语音转文字 | 提交 ASR 并等待结果 | 返回视频口播文案 | ⬜ |
| AI | 对话生成 | 输入需求，AI 生成文案 | 流式输出符合达人风格的文案 | ⬜ |

> 状态标记：⬜ 未测试 / ✅ 通过 / ❌ 未通过

## 10. 文档更新说明

- **2026-04-23**：初次创建 README，V2.0 新增工具，基于当前代码整理
