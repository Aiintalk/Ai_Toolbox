# kol-intake-web — 红人信息采集助手

## 1. 项目定位

AI 对话式问卷，通过自然对话采集红人背景信息，完成后自动生成红人分析报告（Word 文档可下载）。

- **basePath**：`/kol-intake`
- **端口**：3007
- **服务器路径**：`/opt/kol-intake/`

## 2. 核心功能

- **AI 对话问卷**：以聊天界面呈现，AI 逐题提问，支持追问和共情式过渡（`bridge` 接口负责生成自然衔接语）
- **自动生成报告**：问卷完成后，调用 `claude-opus-4-6`（带 extended thinking）生成深度分析报告
- **管理后台**：`/kol-intake/admin` 查看所有提交记录，支持下载各份 Word 报告
- **问题配置**：问题列表维护在 `lib/questions.ts` 中，支持分节、多选收集等类型

## 3. API 路由

| 路由 | 方法 | 功能 |
|------|------|------|
| `/kol-intake/api/submit` | POST | 提交问卷答案，自动生成 AI 分析报告并保存 |
| `/kol-intake/api/bridge` | POST | AI 生成共情回复和自然过渡语句（用于问答中间） |
| `/kol-intake/api/submissions` | GET | 获取所有提交记录列表（管理后台） |
| `/kol-intake/api/submissions/[id]` | GET | 获取单个提交详情 |
| `/kol-intake/api/download/[id]` | GET | 下载指定提交的 Word 报告 |

## 4. 数据存储

- 提交记录：`/opt/kol-intake/data/*.json`（每次提交一个 JSON 文件，包含答案和 AI 报告）

## 5. 目录结构

```
kol-intake-web/
├── app/
│   ├── page.tsx              ← 问卷对话界面
│   ├── admin/page.tsx        ← 管理后台（提交列表 + 下载）
│   └── api/
│       ├── submit/route.ts
│       ├── bridge/route.ts
│       ├── submissions/route.ts
│       ├── submissions/[id]/route.ts
│       └── download/[id]/route.ts
├── lib/
│   ├── yunwu.ts
│   └── questions.ts          ← 问卷题目配置
├── data/                     ← 本地开发用（生产在 /opt/kol-intake/data/）
└── next.config.js            ← basePath: '/kol-intake', output: 'standalone'
```

## 6. 环境变量

| 变量名 | 说明 |
|--------|------|
| `YUNWU_API_KEY` | 云雾 AI API 密钥 |
| `YUNWU_BASE_URL` | 云雾 AI API 地址 |

## 7. 注意事项

- 报告生成使用 `claude-opus-4-6`（带 extended thinking），耗时较长，前端有等待状态提示
- `bridge` 接口使用 `claude-haiku-4-5` 模型（快速回复），保证问答流畅性
- 构建配置为 `output: 'standalone'`，与其他子项目略有不同
