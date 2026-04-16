# AI 工具箱 · 部署文档

> 适用场景：将本项目从 Windows 本地开发环境部署到全新 Linux 虚拟机（VMware / 云服务器）进行测试或生产使用。

---

## 一、环境要求

| 项目 | 要求 |
|------|------|
| 服务器系统 | Ubuntu 20.04 / 22.04 / 24.04 LTS |
| 内存 | 建议 4GB 以上 |
| 磁盘 | 建议 20GB 以上 |
| Node.js | 18.x 或 20.x |
| npm | 9.x 或 10.x |
| 其他 | Git、Nginx、PM2 |

本文档基于以下环境验证：
- Ubuntu 24.04.4 LTS
- Node.js v20.20.2 / npm 10.8.2
- Nginx 1.24.0
- PM2 6.0.14

---

## 二、子项目与端口规划

| 子项目目录 | 工具名称 | 端口 | 访问路径 |
|-----------|---------|------|---------|
| portal | 导航主页（静态 HTML） | — | / |
| benchmark-analyzer | 对标分析助手 | 3001 | /benchmark-analyzer |
| persona-writer-web | 人设脚本仿写助手 | 3002 | /persona-writer |
| qianchuan-writer-web | 千川脚本仿写助手 | 3003 | /qianchuan-writer |
| seeding-writer-web | 种草内容仿写助手 | 3004 | /seeding-writer |

---

## 三、前置准备（本地操作）

### 3.1 修复 basePath 配置

`persona-writer-web` 和 `seeding-writer-web` 的 `next.config.js` 默认缺少 `basePath`，
部署到 Nginx 子路径后会导致静态资源 404 或路由错误，**必须在打包前修复**。

**persona-writer-web/next.config.js**
```js
const nextConfig = {
  basePath: '/persona-writer',   // ← 添加此行
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
}
module.exports = nextConfig
```

**seeding-writer-web/next.config.js**
```js
const nextConfig = {
  basePath: '/seeding-writer',   // ← 添加此行
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
}
module.exports = nextConfig
```

### 3.2 修复前端 API 路径

`persona-writer-web` 和 `seeding-writer-web` 的 `app/page.tsx` 中，
fetch 路径写的是 `/api/xxx`（绝对路径），通过 Nginx 反代后无法正确路由，
**必须加上 basePath 前缀**。

在每个文件的 import 语句后添加常量：

**persona-writer-web/app/page.tsx**
```ts
import { useState, useEffect, useRef } from 'react'

const BASE = '/persona-writer'   // ← 添加此行
```

然后把文件中所有 `fetch('/api/` 替换为 `fetch(\`${BASE}/api/`。

涉及的接口：
- `/api/personas`
- `/api/personas/references`
- `/api/chat`
- `/api/fetch-video`
- `/api/transcribe/upload`
- `/api/transcribe/poll`

**seeding-writer-web/app/page.tsx** 同理，常量改为：
```ts
const BASE = '/seeding-writer'
```

涉及的接口增加：
- `/api/parse-product`

> ⚠️ **注意**：`qianchuan-writer-web` 已正确使用 `${BASE}/api/`，无需修改。

### 3.3 检查 seeding-writer 依赖

`seeding-writer-web` 使用了 `mammoth` 包（用于解析 Word 文档），
但 `package.json` 中未声明该依赖，需要在服务器上手动安装：

```bash
cd /opt/ai-toolbox/seeding-writer-web
npm install mammoth
```

---

## 四、服务器部署步骤

### 4.1 连接服务器

```bash
ssh deploy@<服务器IP>
```

### 4.2 确认环境

```bash
node --version    # v20.x
npm --version     # 10.x
nginx -v          # nginx/1.24.x
pm2 --version     # 6.x
```

如 Node.js 未安装，通过 nvm 安装：
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20
```

如 PM2 未安装：
```bash
npm install -g pm2
```

如 Nginx 未安装（Ubuntu）：
```bash
sudo apt update && sudo apt install -y nginx
```

### 4.3 创建部署目录

```bash
mkdir -p ~/ai-toolbox/{benchmark-analyzer,persona-writer-web,qianchuan-writer-web,seeding-writer-web,portal}
```

### 4.4 传输代码（本地 Windows 执行）

使用 Git Bash + tar 打包，排除 `node_modules`、`.next`、`data` 目录：

```bash
cd "D:/your-path/Ai_Toolbox"

# 打包代码
tar --exclude='*/node_modules' --exclude='*/.next' --exclude='*/data' \
    -czf /tmp/ai-toolbox.tar.gz \
    benchmark-analyzer persona-writer-web qianchuan-writer-web seeding-writer-web portal

# 传输到服务器（使用 pscp，PuTTY 自带）
pscp -pw "your-password" /tmp/ai-toolbox.tar.gz deploy@<服务器IP>:/home/deploy/
```

### 4.5 在服务器上解压

```bash
cd ~/ai-toolbox
tar -xzf ~/ai-toolbox.tar.gz
```

### 4.6 配置环境变量

每个 Next.js 子项目根目录下创建 `.env.local`：

```bash
ENV_CONTENT='YUNWU_API_KEY=your_key
YUNWU_BASE_URL=https://yunwu.ai/v1
TIKHUB_API_KEY=your_key
ALIYUN_ACCESS_KEY_ID=your_id
ALIYUN_ACCESS_KEY_SECRET=your_secret
ALIYUN_APPKEY=your_appkey'

for dir in benchmark-analyzer persona-writer-web qianchuan-writer-web seeding-writer-web; do
  echo "$ENV_CONTENT" > ~/ai-toolbox/$dir/.env.local
done

# benchmark-analyzer 额外需要数据目录配置
echo 'BENCHMARK_DATA_DIR=/home/deploy/ai-toolbox/benchmark-analyzer/data' \
  >> ~/ai-toolbox/benchmark-analyzer/.env.local
mkdir -p ~/ai-toolbox/benchmark-analyzer/data
```

### 4.7 传输达人数据（本地 Windows 执行）

```bash
# 打包 data 目录
cd "D:/your-path/Ai_Toolbox"
tar -czf /tmp/personas.tar.gz \
    qianchuan-writer-web/data persona-writer-web/data seeding-writer-web/data

# 传输
pscp -pw "your-password" /tmp/personas.tar.gz deploy@<服务器IP>:/home/deploy/
```

在服务器上解压：
```bash
cd ~/ai-toolbox
tar -xzf ~/personas.tar.gz
```

> ⚠️ **已知问题 - 中文目录名编码错乱**
>
> 在 Windows 上用 tar 打包含中文名的目录，解压到 Linux 后目录名会变成乱码
>（例如 `孙静` 变成 `瀛欓潤`）。  
> **解决方案**：用 Node.js 脚本按字节匹配重命名：
>
> ```bash
> node -e "
> const fs = require('fs');
> const path = require('path');
> const base = '/home/deploy/ai-toolbox';
> const projects = ['qianchuan-writer-web', 'persona-writer-web', 'seeding-writer-web'];
>
> // 映射：乱码字节 hex → 正确名称（根据实际情况调整）
> const nameMap = {
>   'e7809be6ac93e6bda4': '孙静',
>   'e99784e58981e58aa7': '陶然',
> };
>
> projects.forEach(proj => {
>   const dir = path.join(base, proj, 'data', 'personas');
>   fs.readdirSync(dir, { withFileTypes: true }).forEach(e => {
>     if (!e.isDirectory()) return;
>     const hex = Buffer.from(e.name).toString('hex');
>     const correct = nameMap[hex];
>     if (correct) {
>       fs.renameSync(path.join(dir, e.name), path.join(dir, correct));
>       console.log('Renamed:', proj, '->', correct);
>     }
>   });
> });
> "
> ```
>
> 如需查看实际乱码的 hex 值，运行：
> ```bash
> node -e "
> const fs = require('fs');
> fs.readdirSync('/home/deploy/ai-toolbox/qianchuan-writer-web/data/personas')
>   .forEach(n => console.log(Buffer.from(n).toString('hex'), '|', n));
> "
> ```

### 4.8 安装依赖并构建

逐个子项目执行：

```bash
cd ~/ai-toolbox/benchmark-analyzer && npm install && npm run build
cd ~/ai-toolbox/persona-writer-web  && npm install && npm run build
cd ~/ai-toolbox/qianchuan-writer-web && npm install && npm run build

# seeding-writer 需要额外安装 mammoth
cd ~/ai-toolbox/seeding-writer-web && npm install && npm install mammoth && npm run build
```

> ⚠️ **重要**：必须在数据目录（`data/personas/`）已正确命名后再执行 `npm run build`。
> Next.js 的 API 路由在某些情况下会把 build 时的文件系统状态写入缓存，
> 若先 build 再放数据，API 会返回空数组。
>
> **解决方案**：清理 `.next` 目录后重新构建：
> ```bash
> rm -rf .next && npm run build
> ```

### 4.9 配置 PM2

创建 `~/ai-toolbox/ecosystem.config.js`：

```js
module.exports = {
  apps: [
    {
      name: 'benchmark',
      cwd: '/home/deploy/ai-toolbox/benchmark-analyzer',
      script: 'node_modules/.bin/next',
      args: 'start -p 3001',
      env_file: '.env.local',
    },
    {
      name: 'persona',
      cwd: '/home/deploy/ai-toolbox/persona-writer-web',
      script: 'node_modules/.bin/next',
      args: 'start -p 3002',
      env_file: '.env.local',
    },
    {
      name: 'qianchuan',
      cwd: '/home/deploy/ai-toolbox/qianchuan-writer-web',
      script: 'node_modules/.bin/next',
      args: 'start -p 3003',
      env_file: '.env.local',
    },
    {
      name: 'seeding',
      cwd: '/home/deploy/ai-toolbox/seeding-writer-web',
      script: 'node_modules/.bin/next',
      args: 'start -p 3004',
      env_file: '.env.local',
    },
  ],
}
```

启动并保存：

```bash
cd ~/ai-toolbox
pm2 delete all          # 清除旧进程（首次部署可跳过）
pm2 start ecosystem.config.js
pm2 save                # 保存进程列表，开机自启
pm2 list                # 确认所有进程 status = online
```

> ⚠️ **已知问题 - PM2 沿用旧配置**
>
> 若服务器上已有同名的 PM2 进程（如之前手动启动过），`pm2 start ecosystem.config.js`
> 会 restart 旧进程而不应用新的 `cwd` 或 `args`，导致启动报错：
> `Invalid project directory provided, no such directory: /opt/xxx/3001`
>
> **解决方案**：先删除所有旧进程再启动：
> ```bash
> pm2 delete all
> pm2 start ecosystem.config.js
> ```

### 4.10 配置 Nginx

创建配置文件：

```bash
sudo tee /etc/nginx/sites-available/ai-toolbox << 'EOF'
server {
    listen 80;
    server_name _;

    # portal 导航主页（静态文件）
    location / {
        root /home/deploy/ai-toolbox/portal;
        index index.html;
        try_files $uri $uri/ =404;
    }

    location /benchmark-analyzer {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }

    location /persona-writer {
        proxy_pass http://127.0.0.1:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }

    location /qianchuan-writer {
        proxy_pass http://127.0.0.1:3003;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }

    location /seeding-writer {
        proxy_pass http://127.0.0.1:3004;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/ai-toolbox /etc/nginx/sites-enabled/ai-toolbox
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t        # 检查配置语法
sudo systemctl reload nginx
```

> ⚠️ **已知问题1 - Nginx location 路径末尾斜杠导致重定向循环**
>
> 若 location 写成 `/benchmark-analyzer/`（带末尾 `/`），Next.js 会将请求
> 重定向到 `/benchmark-analyzer`（去掉 `/`），而 Nginx 的带斜杠规则匹配不到，
> 导致 308 循环重定向。
>
> **解决方案**：location 路径**不加末尾斜杠**，写成 `/benchmark-analyzer`。

> ⚠️ **已知问题2 - portal 静态文件 403/404**
>
> Nginx 默认以 `www-data` 用户运行，无法进入权限为 `drwxr-x---` 的 `/home/deploy` 目录。
>
> **解决方案**：给 `/home/deploy` 加上其他用户的执行权限：
> ```bash
> sudo chmod o+x /home/deploy
> ```

### 4.11 验证部署

```bash
# 检查端口监听
ss -tlnp | grep -E '3001|3002|3003|3004|:80'

# 检查各接口 HTTP 状态
curl -s -o /dev/null -w '%{http_code}\n' http://localhost/
curl -s -o /dev/null -w '%{http_code}\n' http://localhost/benchmark-analyzer
curl -s -o /dev/null -w '%{http_code}\n' http://localhost/persona-writer
curl -s -o /dev/null -w '%{http_code}\n' http://localhost/qianchuan-writer
curl -s -o /dev/null -w '%{http_code}\n' http://localhost/seeding-writer

# 全部返回 200 或 308（308 为正常重定向）即表示部署成功
```

浏览器访问：`http://<服务器IP>/`

---

## 五、更新部署流程

修改代码后，按以下步骤更新：

```bash
# 1. 本地重新打包（排除 node_modules、.next、data）
cd "D:/your-path/Ai_Toolbox"
tar --exclude='*/node_modules' --exclude='*/.next' --exclude='*/data' \
    -czf /tmp/ai-toolbox.tar.gz \
    benchmark-analyzer persona-writer-web qianchuan-writer-web seeding-writer-web portal

# 2. 传输并解压
pscp -pw "your-password" /tmp/ai-toolbox.tar.gz deploy@<服务器IP>:/home/deploy/
ssh deploy@<服务器IP> "cd ~/ai-toolbox && tar -xzf ~/ai-toolbox.tar.gz"

# 3. 重新构建（以 qianchuan 为例）
ssh deploy@<服务器IP> "
  cd ~/ai-toolbox/qianchuan-writer-web
  rm -rf .next
  npm run build
  pm2 restart qianchuan
"
```

---

## 六、常见问题汇总

### Q1: 页面工具显示"开发中"，无法点击

**原因**：`portal/index.html` 中对应的工具卡片是 `<div class="card-disabled">`，
或者链接使用了硬编码的服务器 IP。

**解决方案**：将对应卡片改为 `<a>` 标签，移除 `card-disabled`，
链接改为相对路径（`/qianchuan-writer` 而非 `http://x.x.x.x/qianchuan-writer`）。

---

### Q2: 达人选择下拉框为空

可能有三个原因：

**原因A**：`data/personas/` 目录未传输。

**解决方案**：参考步骤 4.7，单独打包传输 data 目录。

---

**原因B**：中文目录名编码错乱（Windows tar → Linux 解压）。

现象：`ls` 显示乱码字符，`/api/personas` 返回 `{"personas":[]}`。

**解决方案**：参考步骤 4.7 的 Node.js 重命名脚本。

---

**原因C**：前端 fetch 路径未加 basePath 前缀（`/api/personas` 而非 `/persona-writer/api/personas`）。

现象：浏览器 Network 面板中请求 `/api/personas` 返回 404 或 HTML。

**解决方案**：参考步骤 3.2，在 page.tsx 中添加 `const BASE = '/persona-writer'`，
并替换所有 `fetch('/api/` 为 `fetch(\`${BASE}/api/\``。

---

**原因D**：先 build 再放数据，Next.js 缓存了空结果。

现象：API 直接调用（`curl http://localhost:3002/...`）返回正确数据，但页面仍为空。

**解决方案**：
```bash
rm -rf .next && npm run build && pm2 restart persona
```

---

### Q3: seeding-writer build 报错 `Module not found: Can't resolve 'mammoth'`

**原因**：`mammoth` 依赖未在 `package.json` 中声明。

**解决方案**：
```bash
cd ~/ai-toolbox/seeding-writer-web
npm install mammoth
npm run build
```

---

### Q4: portal 返回 403 Forbidden

**原因**：Nginx（`www-data` 用户）没有权限进入 `/home/deploy` 目录。

**解决方案**：
```bash
sudo chmod o+x /home/deploy
```

---

### Q5: 所有子项目返回 502 Bad Gateway

**原因**：PM2 进程未正常启动，或端口未监听。

**排查步骤**：
```bash
pm2 list                    # 查看进程状态
pm2 logs benchmark --lines 20   # 查看错误日志
ss -tlnp | grep 300         # 检查端口是否监听
```

常见子原因：PM2 沿用旧配置（见 Q6）。

---

### Q6: PM2 进程 status = errored，日志报 `Invalid project directory`

**原因**：服务器上存在旧的同名 PM2 进程，`pm2 start ecosystem.config.js` 
只 restart 了旧进程而未应用新的 `cwd`。

**解决方案**：
```bash
pm2 delete all
pm2 start ~/ai-toolbox/ecosystem.config.js
pm2 save
```

---

### Q7: TikHub API 报错 `400 Bad Request`

**原因**：传入的抖音分享链接无效、已过期、或视频已删除/私密。

**排查步骤**：
1. 确认使用的是从抖音 App「分享 → 复制链接」得到的完整链接
2. 确认 `TIKHUB_API_KEY` 在 `.env.local` 中已正确配置
3. 直接测试 API Key 是否有效：
   ```bash
   curl -s "https://api.tikhub.io/api/v1/douyin/web/fetch_one_video_by_share_url?share_url=<真实链接>" \
     -H "Authorization: Bearer <your_key>"
   ```

---

## 七、PM2 常用命令

```bash
pm2 list                    # 查看所有进程
pm2 logs <name>             # 查看日志（实时）
pm2 logs <name> --lines 50  # 查看最近 50 行日志
pm2 restart <name>          # 重启指定进程
pm2 restart all             # 重启所有进程
pm2 stop <name>             # 停止指定进程
pm2 delete all              # 删除所有进程
pm2 save                    # 保存进程列表（用于开机自启）
pm2 startup                 # 生成开机自启命令
```
