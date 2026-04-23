# AI 工具箱 · 交付包

公司内部 8 个 AI 工具的完整源码与部署配置。当前生产环境部署在阿里云 `121.40.174.53`，本交付包可用于迁移到公司自有服务器。

---

## 8 个工具一览

| 工具 | URL 路径 | 端口 | 用途 |
|------|---------|------|------|
| 人设脚本仿写 | `/persona-writer` | 3001 | 基于对标视频，仿写人设短视频脚本 |
| 种草脚本仿写 | `/seeding-writer` | 3003 | 种草内容脚本仿写 |
| 对标分析 | `/benchmark-analyzer` | 3004 | 拆解对标视频的结构与亮点 |
| 千川脚本仿写 | `/qianchuan-writer` | 3005 | 千川投流脚本仿写 |
| 人设定位 | `/persona-positioning` | 3006 | KOL 人设定位分析与定位报告导出 |
| 红人信息采集 | `/kol-intake` | 3007 | 红人问卷收集 + AI 分析报告 |
| 素材库 | `/material-library` | 3008 | 爆款文案 / 风格参考 / 素材分类管理 |
| Portal 门户 | `/` | —（静态） | 所有工具的导航入口 |

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
AI工具箱-交付包/
├── README.md              ← 本文件
├── 部署手册.md            ← 从零部署步骤（装 Node、装 PM2、配 nginx）
├── 环境变量.md            ← 三套 API Key 说明
├── nginx.conf             ← 从生产服务器导出的真实 nginx 配置
├── ecosystem.config.js    ← PM2 进程管理配置（一键起停所有服务）
└── 项目源码/
    ├── persona-writer/
    ├── seeding-writer/
    ├── benchmark-analyzer/
    ├── qianchuan-writer/
    ├── persona-positioning/
    ├── kol-intake/
    ├── material-library/
    └── portal/           ← 静态 HTML，直接放 nginx 根目录
```

每个项目目录下都保留了原始的 `.env.local`（包含 API Key）。

---

## 生产环境现状（2026-04-22）

- 服务器：阿里云 ECS `121.40.174.53`（Ubuntu 22.04，x86_64）
- 源码位置：`/opt/<项目名>/`
- 静态 portal：`/var/www/portal/index.html`
- nginx 配置：`/etc/nginx/sites-enabled/portal-80`
- PM2 状态：8 个服务全部 online，已 `pm2 save`，服务器重启后会自动恢复

---

## 快速开始

1. 看 `部署手册.md`，按步骤在新服务器上搭好 Node + PM2 + nginx
2. 把 `项目源码/` 里的 8 个目录丢到 `/opt/`
3. 每个项目目录下执行 `npm install && npm run build`
4. 把 `ecosystem.config.js` 放到 `/opt/`，执行 `pm2 start ecosystem.config.js`
5. 把 `nginx.conf` 放到 `/etc/nginx/sites-enabled/portal-80`，`nginx -t && systemctl reload nginx`
6. 把 `项目源码/portal/index.html` 放到 `/var/www/portal/`
7. 浏览器访问 `http://新服务器 IP/` 验证

---

## 开发环境准备与 Git 流程入口

------

在完成本 README 的阅读后，请立即读取根目录 `GIT_WORKFLOW.md` 文件，并严格按照GIT_WORKFLOW.MD文件中的流程为开发者准备GIT环境。

## 联系人

部署中有疑问，直接问安雅。
