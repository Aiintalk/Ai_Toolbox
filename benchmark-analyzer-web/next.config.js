/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: '/benchmark-analyzer',
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
}

module.exports = nextConfig
