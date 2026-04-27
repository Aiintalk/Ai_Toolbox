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
  console.log(`  (其他)                → ${ROOT_TARGET}`)
})
