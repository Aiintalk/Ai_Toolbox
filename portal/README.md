# Portal — AI 工具箱导航页

## 1. 项目定位

作为整个 AI 工具箱的入口导航页，以静态 HTML 的形式集中展示所有工具的访问入口。

## 2. 当前功能

- 展示工具箱中全部 14 个工具的卡片列表，所有工具均已上线可用
- 支持点击直接跳转到对应工具（新标签页打开）
- 工具按 5 个业务分类展示：人设内容规划 / 千川 / 内容仿写 / 复盘工具 / 素材管理
- 顶部 header 展示品牌 logo、上线工具数量

**工具分类与入口：**

| 分类 | 工具 | 访问地址 |
|------|------|----------|
| 人设内容规划 | 红人信息采集助手 | `/kol-intake/` |
| 人设内容规划 | 对标分析助手 | `/benchmark-analyzer/` |
| 人设内容规划 | 人设定位助手 | `/persona-positioning/` |
| 千川 | 产品卖点提取器 | `/selling-point-extractor/` |
| 千川 | 千川爆文合集 | `/qianchuan-collection/` |
| 千川 | 千川脚本仿写助手 | `/qianchuan-writer/` |
| 千川 | 千川脚本复盘助手 | `/qianchuan-review/` |
| 内容仿写 | 直播间脚本仿写助手 | `/livestream-writer/` |
| 内容仿写 | 人设脚本仿写助手 | `/persona-writer/` |
| 内容仿写 | TikTok 脚本仿写助手 | `/tiktok-writer/` |
| 复盘工具 | 直播间脚本复盘助手 | `/livestream-review/` |
| 复盘工具 | 人设脚本复盘助手 | `/persona-review/` |
| 复盘工具 | TikTok 脚本复盘助手 | `/tiktok-review/` |
| 素材管理 | 素材库 | `/material-library/` |

## 3. 目录结构

```
portal/
├── index.html      ← 唯一页面文件，包含全部 HTML + CSS，无 JS 依赖
├── logo.png        ← 顶部品牌 logo（白色反色显示）
├── README.md       ← 本文档
└── CHANGELOG.md    ← 版本变更记录
```

## 4. 核心结构说明

本项目为纯静态页面，无后端接口。核心 HTML 结构：

- **`.header`**：顶部品牌栏，展示 logo、上线状态和工具总数
- **`.section`**：主内容区按分类组织，每个分类包含标题、分割线和卡片网格
- **`.card`**（`<a>` 标签）：可点击的工具入口卡片，包含图标、标题、描述、分类标签
- **`.card-disabled`**：开发中工具的禁用样式（当前所有工具均已上线，暂无禁用卡片）

**卡片颜色主题：**
- `card-write`：内容仿写类（橙黄背景图标）
- `card-review`：复盘工具类（橙色背景图标）
- `card-library`：素材管理类（蓝紫背景图标）
- `card-tiktok`：TikTok 相关（绿色背景图标）

## 5. 运行要求

- 无任何运行时依赖，无需 Node.js 或构建工具
- 直接以静态文件方式部署，放在 Nginx 根目录下即可
- 工具跳转地址当前硬编码为生产服务器 IP `121.40.174.53`，迁移服务器时需全局替换

## 6. 开发注意事项

- 新增工具时，在 `index.html` 对应分类的 `.grid` 中添加 `<a class="card ...">` 标签
- 同步更新 header 中的"N 个工具已上线"和"N 个工具"文案
- 新分类时同步更新 header 的"N 个分类"文案和 `.section-count`
- 页面无 JS，样式全部内联在 `<style>` 中，不要引入外部依赖
