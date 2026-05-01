#!/usr/bin/env node
/**
 * Ai_Toolbox 本地开发反代
 *
 * 监听 http://localhost:8080，按路径前缀转发到对应子应用 dev server。
 * 模拟生产环境 nginx 行为，让本地体验与线上一致。
 *
 * 使用：node scripts/local-proxy.mjs
 *
 * 各子应用需先各自 npm run dev 启动。
 */
import http from 'node:http'
import { request as httpRequest } from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORTAL_DIR = path.resolve(__dirname, '..', 'portal')

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

function servePortalStatic(req, res) {
  // 去掉 /portal 前缀和 query
  let urlPath = req.url.slice('/portal'.length).split('?')[0] || '/'
  if (urlPath === '' || urlPath === '/') urlPath = '/index.html'

  // 防穿越
  const safe = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, '')
  const filePath = path.join(PORTAL_DIR, safe)
  if (!filePath.startsWith(PORTAL_DIR)) {
    res.writeHead(403); res.end('Forbidden'); return
  }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end(`portal 静态文件未找到：${urlPath}`)
      return
    }
    const ext = path.extname(filePath).toLowerCase()
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' })
    fs.createReadStream(filePath).pipe(res)
  })
}

const ROUTES = [
  { prefix: '/auth', target: 'http://127.0.0.1:3000' },
  { prefix: '/benchmark-analyzer', target: 'http://127.0.0.1:3001' },
  { prefix: '/persona-positioning', target: 'http://127.0.0.1:3002' },
  { prefix: '/persona-writer', target: 'http://127.0.0.1:3003' },
  { prefix: '/qianchuan-writer', target: 'http://127.0.0.1:3004' },
  { prefix: '/seeding-writer', target: 'http://127.0.0.1:3005' },
  { prefix: '/material-library', target: 'http://127.0.0.1:3006' },
  { prefix: '/kol-intake', target: 'http://127.0.0.1:3007' },
  { prefix: '/kol-portal', target: 'http://127.0.0.1:3009' },
]

const ROOT_TARGET = 'http://127.0.0.1:3000' // 根路径默认走 auth-service（登录页等）
const PORT = Number(process.env.PROXY_PORT || 8080)

function pickTarget(url) {
  for (const r of ROUTES) {
    if (url === r.prefix || url.startsWith(r.prefix + '/') || url.startsWith(r.prefix + '?')) {
      return r.target
    }
  }
  return ROOT_TARGET
}

const server = http.createServer((req, res) => {
  // /portal 静态资源由本进程直接 serve（生产由 nginx serve）
  if (req.url === '/portal' || req.url.startsWith('/portal/') || req.url.startsWith('/portal?')) {
    return servePortalStatic(req, res)
  }

  const target = pickTarget(req.url)
  const targetUrl = new URL(target)

  const proxyReq = httpRequest(
    {
      host: targetUrl.hostname,
      port: targetUrl.port,
      method: req.method,
      path: req.url,
      headers: { ...req.headers, host: targetUrl.host },
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 502, proxyRes.headers)
      proxyRes.pipe(res)
    }
  )

  proxyReq.on('error', (err) => {
    res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end(`本地反代：上游 ${target} 不可达\n${err.message}\n（请确认对应子应用 dev server 已启动）`)
  })

  req.pipe(proxyReq)
})

server.listen(PORT, () => {
  console.log(`[local-proxy] listening on http://localhost:${PORT}`)
  console.log('[local-proxy] routes:')
  for (const r of ROUTES) console.log(`  ${r.prefix.padEnd(22)} → ${r.target}`)
  console.log(`  ${'/portal'.padEnd(22)} → 静态文件 ${PORTAL_DIR}`)
  console.log(`  (其他)                → ${ROOT_TARGET}`)
})
