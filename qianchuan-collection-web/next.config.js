/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: '/qianchuan-collection',
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
}

module.exports = nextConfig
