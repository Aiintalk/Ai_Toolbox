/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: '/auth',
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // better-sqlite3 是 native 模块，不能被 webpack 打进 server bundle
  experimental: {
    serverComponentsExternalPackages: ['better-sqlite3'],
  },
}

module.exports = nextConfig
