# qianchuan-collection-web — 千川爆文合集

## 1. 项目定位

全网高跑量千川脚本的收集与管理工具。按达人分库管理，分为全局公共脚本库和各达人专属脚本库，方便仿写时快速检索参考。

- **basePath**：`/qianchuan-collection`
- **端口**：3015
- **服务器路径**：`/opt/qianchuan-collection/`

## 2. 核心功能

- **双库模式**：
  - **全局库**（公共池）：跨达人的通用爆文，所有人可参考
  - **达人库**：某个达人专属的高跑量脚本，按人分类管理
- **脚本管理**：添加、查看、删除脚本，每条脚本包含标题、内容、点赞数、来源账号等信息
- **搜索**：支持按关键词搜索脚本内容
- **文件上传**：支持批量上传脚本文件
- **达人管理**：创建和删除达人分类

## 3. API 路由

| 路由 | 方法 | 功能 |
|------|------|------|
| `/qianchuan-collection/api/personas` | GET | 获取所有达人列表（含脚本数量统计） |
| `/qianchuan-collection/api/personas` | POST | 创建新达人 |
| `/qianchuan-collection/api/personas` | DELETE | 删除达人及其脚本 |
| `/qianchuan-collection/api/scripts` | GET | 获取脚本列表（`?pool=global` 或 `?pool=persona&persona=xxx`） |
| `/qianchuan-collection/api/scripts` | POST | 添加脚本 |
| `/qianchuan-collection/api/scripts` | DELETE | 删除脚本 |
| `/qianchuan-collection/api/upload` | POST | 批量上传脚本文件 |

## 4. 目录结构

```
qianchuan-collection-web/
├── app/
│   ├── page.tsx              ← 主页面（双库切换、搜索、脚本卡片展开）
│   └── api/
│       ├── personas/route.ts
│       ├── scripts/route.ts
│       └── upload/route.ts
├── lib/
└── next.config.js            ← basePath: '/qianchuan-collection'
```

## 5. 环境变量

本工具无外部 AI 或第三方 API 依赖，无需配置环境变量。

## 6. 注意事项

- 本工具无 AI 功能，纯脚本管理工具
- 脚本数据存储在服务器文件系统中
