# AI 工具箱 · 交付包

公司内部 14 个 AI 工具的完整源码与部署配置。当前生产环境部署在阿里云 `121.40.174.53`，本交付包可用于迁移到公司自有服务器。

---

## 14 个工具一览

| 工具 | URL 路径 | 端口 | 本地源码目录 | 用途 |
|------|---------|------|------------|------|
| 人设脚本仿写 | `/persona-writer` | 3001 | `persona-writer-web/` | 基于对标视频，仿写人设短视频脚本 |
| 种草脚本仿写 | `/seeding-writer` | 3003 | `seeding-writer-web/` | 种草内容脚本仿写 |
| 对标分析（旧） | `/benchmark-analyzer` | 3004 | `persona-positioning-web/`（旧版同源） | 拆解对标视频的结构与亮点 |
| 千川脚本仿写 | `/qianchuan-writer` | 3005 | `qianchuan-writer-web/` | 千川投流脚本仿写 |
| 人设定位 | `/persona-positioning` | 3006 | `persona-positioning-web/` | KOL 人设定位分析与定位报告导出 |
| 红人信息采集 | `/kol-intake` | 3007 | `kol-intake-web/` | 红人问卷收集 + AI 分析报告 |
| 素材库 | `/material-library` | 3008 | `material-library-web/` | 爆款文案 / 风格参考 / 素材分类管理 |
| TikTok 脚本仿写 | `/tiktok-writer` | 3009 | `tiktok-writer-web/` | TikTok 平台短视频脚本仿写 |
| 人设脚本复盘 | `/persona-review` | 3010 | `persona-review-web/` | 人设短视频脚本复盘分析 |
| 产品卖点提取 | `/selling-point-extractor` | 3011 | `selling-point-extractor-web/` | AI 提取并整理产品核心卖点 |
| 千川脚本复盘 | `/qianchuan-review` | 3012 | `qianchuan-review-web/` | 千川投流脚本复盘分析 |
| 直播脚本仿写 | `/livestream-writer` | 3013 | `livestream-writer-web/` | 直播带货脚本仿写 |
| 直播复盘 | `/livestream-review` | 3014 | `livestream-review-web/` | 直播内容复盘分析 |
| 千川素材收集 | `/qianchuan-collection` | 3015 | `qianchuan-collection-web/` | 千川投流素材归档管理 |
| Portal 门户 | `/` | —（静态） | `portal/` | 所有工具的导航入口 |

> **说明**：`/benchmark-analyzer`（3004）与 `/persona-positioning`（3006）共用 `persona-positioning-web/` 同一套源码，服务器上以不同端口分别部署。

全部统一入口：`http://服务器 IP/`

---

## 技术栈

- **框架**：Next.js 14.2.35 + React 18.3.1 + TypeScript
- **样式**：TailwindCSS 3.4
- **进程管理**：PM2
- **反向代理**：nginx（basePath 路径分发到各端口）
- **外部依赖**：
  - 云雾 AI（`api.yunwu.ai`）— 大模型调用
  - TikHub（`tikhub.io`）— 抖音视频/账号数据
  - 阿里云 OSS（`oss-cn-shanghai`）— 媒体文件存储

---

## 目录结构

```
AI工具箱代码包/
├── README.md                      ← 本文件
├── AI工具箱开发文档.md             ← 架构说明、API 清单、部署操作、Nginx 配置参考
├── GIT_WORKFLOW.md                ← 标准 Git 协作流程（分支规范、PR 流程）
├── persona-writer-web/            ← 人设脚本仿写
├── seeding-writer-web/            ← 种草脚本仿写
├── qianchuan-writer-web/          ← 千川脚本仿写
├── qianchuan-review-web/          ← 千川脚本复盘
├── qianchuan-collection-web/      ← 千川素材收集
├── persona-positioning-web/       ← 人设定位 / 对标分析（双路由同源）
├── persona-review-web/            ← 人设脚本复盘
├── kol-intake-web/                ← 红人信息采集
├── material-library-web/          ← 素材库
├── tiktok-writer-web/             ← TikTok 脚本仿写
├── selling-point-extractor-web/   ← 产品卖点提取
├── livestream-writer-web/         ← 直播脚本仿写
├── livestream-review-web/         ← 直播复盘
└── portal/                        ← 静态 HTML 门户，直接放 nginx 根目录
```

每个 `*-web/` 目录部署时需在服务器上手动创建 `.env.local`（含 API Key，不入库）。

---

## 生产环境现状（2026-05-17）

- 服务器：阿里云 ECS `121.40.174.53`（Ubuntu 22.04，x86_64）
- 源码位置：`/opt/<项目名>/`（如 `/opt/persona-writer/`）
- 静态 portal：`/var/www/portal/index.html`
- nginx 配置：`/etc/nginx/sites-enabled/portal-80`
- PM2 状态：14 个服务全部 online，已 `pm2 save`，服务器重启后会自动恢复

---

## 快速开始

1. 看 `AI工具箱开发文档.md` 第七节，按步骤在新服务器上搭好 Node + PM2 + nginx
2. 把根目录下 13 个 `*-web/` 目录上传到服务器 `/opt/`，目录名去掉 `-web` 后缀（如 `persona-writer-web/` → `/opt/persona-writer/`）
3. 每个目录下创建 `.env.local`，填写对应的 API Key（参见 `AI工具箱开发文档.md` 第三节）
4. 每个项目目录下执行 `npm install && npm run build`
5. 在 `/opt/` 创建 `ecosystem.config.js`，执行 `pm2 start ecosystem.config.js`
6. 将 nginx 配置（参见 `AI工具箱开发文档.md` 第八节）写入 `/etc/nginx/sites-enabled/portal-80`，执行 `nginx -t && systemctl reload nginx`
7. 把 `portal/index.html` 放到 `/var/www/portal/`
8. 浏览器访问 `http://新服务器 IP/` 验证

---

## 开发环境准备与 Git 流程入口

------

在完成本 README 的阅读后，请立即读取根目录 `GIT_WORKFLOW.md` 文件，并严格按照GIT_WORKFLOW.MD文件中的流程为开发者准备GIT环境。

## 联系人

部署中有疑问，直接问安雅。
