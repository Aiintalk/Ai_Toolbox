# benchmark-analyzer — 对标分析助手

## 1. 项目定位

输入抖音账号链接，自动抓取视频数据，通过 AI 生成该账号的人格档案与内容规划，支持历史记录保存与 Word 导出。

## 2. 当前功能

- 输入抖音账号主页链接，自动抓取 TOP10 + 近 30 天视频数据
- AI 流式生成「人格档案」与「内容规划」两份文档
- 支持历史记录列表查看与恢复
- 支持一键导出 Word 文档（.docx）
- 双 Tab 切换展示：人格档案 / 内容规划

## 3. 使用流程

1. 在输入框粘贴抖音账号主页链接
2. 点击「抓取数据」，系统自动拉取 TOP10 和近 30 天视频列表
3. 确认抓取结果后点击「开始分析」
4. 等待 AI 流式输出「人格档案」与「内容规划」
5. 切换 Tab 查看两份文档内容
6. 点击「导出 Word」下载分析结果

## 4. 目录结构

```
benchmark-analyzer/
├── app/
│   ├── page.tsx                  # 主页面（输入 → 分析结果两步流程）
│   ├── layout.tsx                # 根布局
│   ├── globals.css               # 全局样式
│   └── api/
│       ├── analyze/route.ts      # AI 分析接口（流式输出，返回人格档案+内容规划）
│       ├── export-word/route.ts  # Word 导出接口
│       ├── fetch-account/route.ts# 抖音账号数据抓取接口
│       └── history/route.ts      # 历史记录读写接口
├── lib/
│   ├── yunwu.ts                  # AI API 封装
│   └── tikhub.ts                 # TikHub API 封装
├── data/                         # 历史分析记录（每条一个 JSON 文件）
├── next.config.js
├── tailwind.config.js
├── tsconfig.json
└── package.json
```

## 5. 核心接口 / 核心模块

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/fetch-account` | POST | 输入账号 URL，返回 TOP10 + 近 30 天视频数据 |
| `/api/analyze` | POST | 流式输出人格档案与内容规划，用 `===SPLIT===` 分隔两份文档 |
| `/api/export-word` | POST | 接收 Markdown 内容，返回 .docx 文件流 |
| `/api/history` | GET | 返回历史记录列表 |
| `/api/history` | POST | 保存一条分析记录 |

**流式协议：**
- 响应为原始文本流（`text/plain`）
- 两份文档之间用 `===SPLIT===` 分隔，前半为人格档案，后半为内容规划

## 6. 环境变量 / 运行要求

```env
YUNWU_API_KEY=           # AI API 密钥（Yunwu 代理）
YUNWU_BASE_URL=          # AI API 地址（OpenAI 兼容协议）
TIKHUB_API_KEY=          # TikHub API 密钥（抖音数据）
BENCHMARK_DATA_DIR=      # 历史数据存储目录（默认 ./data/）
```

**运行：**
```bash
cd benchmark-analyzer
npm install
npm run dev
```

访问地址：`http://localhost:3000/benchmark-analyzer`

## 7. 开发注意事项

- `basePath` 为 `/benchmark-analyzer`，所有接口调用需带此前缀
- 历史记录存储在文件系统（`BENCHMARK_DATA_DIR`），不使用数据库
- 流式输出用 `===SPLIT===` 分隔两份文档，前端按此切割后分别渲染
- `SimpleMarkdown` 使用 `dangerouslySetInnerHTML`，存在 XSS 风险（已知技术债）
- 导出 Word 依赖 `docx` 库，修改导出格式时注意文档结构

## 8. 当前状态 / 已知问题

- **完成度**：核心功能完整，已上线
- **已知问题**：
  - `react-markdown` 已安装但未使用（冗余依赖）
  - `SimpleMarkdown` 未做 HTML 转义，存在 XSS 风险
  - 历史记录无分页，数据量大时加载较慢
  - 无身份验证，任何人可访问 API

## 9. 文档更新说明

- **2026-04-19**：初次创建 README，基于当前代码整理
