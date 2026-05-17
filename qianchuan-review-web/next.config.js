/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: '/qianchuan-review',
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
}

module.exports = nextConfig
