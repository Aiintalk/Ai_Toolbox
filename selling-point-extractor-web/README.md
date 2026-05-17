# selling-point-extractor-web — 产品卖点提取器

## 1. 项目定位

专为短视频带货场景设计的产品卖点分析工具。上传产品 Brief 和达人文案脚本，AI 沿固定四个维度逐一分析，提炼最适合投放的核心卖点。

- **basePath**：`/selling-point-extractor`
- **端口**：3011
- **服务器路径**：`/opt/selling-point-extractor/`

## 2. 核心功能

- **文件上传解析**：支持上传多份产品 Brief 和达人文案（Word/PDF/TXT）
- **四维度分析**：
  1. 机制分析（破价/赠品/试用/限时限量/组合优惠，1-5星评分）
  2. 产品优势（功效、专利、成分、对比竞品）
  3. 使用场景（适用人群、使用时机、痛点匹配）
  4. 社会认证（背书、用户证言、销量数据）
- **多轮追问**：分析完成后支持继续对话，深入追问某个维度
- **历史记录**：保存分析结果，支持查看和删除历史记录

## 3. API 路由

| 路由 | 方法 | 功能 |
|------|------|------|
| `/selling-point-extractor/api/chat` | POST | AI 对话（卖点分析 + 追问，流式输出） |
| `/selling-point-extractor/api/parse-file` | POST | 解析上传文件（Word/PDF/TXT → 文本） |
| `/selling-point-extractor/api/history` | GET | 获取历史记录列表，`?id=xxx` 获取单条 |
| `/selling-point-extractor/api/history` | POST | 保存历史记录 |
| `/selling-point-extractor/api/history` | DELETE | 删除历史记录 `?id=xxx` |

## 4. 数据存储

- 历史记录：`/opt/selling-point-extractor/data/history/*.json`

## 5. 目录结构

```
selling-point-extractor-web/
├── app/
│   ├── page.tsx              ← 主页面（system prompt 硬编码在此）
│   └── api/
│       ├── chat/route.ts
│       ├── parse-file/route.ts
│       └── history/route.ts
├── lib/
│   └── yunwu.ts
├── data/history/
└── next.config.js            ← basePath: '/selling-point-extractor'
```

## 6. 环境变量

| 变量名 | 说明 |
|--------|------|
| `YUNWU_API_KEY` | 云雾 AI API 密钥 |
| `YUNWU_BASE_URL` | 云雾 AI API 地址 |
