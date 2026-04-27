/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: '/kol-portal',
  reactStrictMode: true,
  // 通过 transpilePackages 让 Next.js 能直接消费 packages/auth-shared 里的 TS 源码
  transpilePackages: ['@ai-toolbox/auth-shared'],
  webpack: (config) => {
    // 关闭 symlink 解析，让 auth-shared 内的依赖（jose 等）从消费方 node_modules 解析
    config.resolve.symlinks = false
    return config
  },
}

module.exports = nextConfig
