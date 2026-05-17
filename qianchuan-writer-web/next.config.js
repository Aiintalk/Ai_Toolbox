/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: '/qianchuan-writer',
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
}

module.exports = nextConfig
