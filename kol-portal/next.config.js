/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: '/kol-portal',
  reactStrictMode: true,
  // 通过 transpilePackages 让 Next.js 能直接消费 packages/auth-shared 里的 TS 源码
  transpilePackages: ['@ai-toolbox/auth-shared'],
}

module.exports = nextConfig
