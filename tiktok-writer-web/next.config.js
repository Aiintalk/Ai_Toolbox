/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: '/tiktok-writer',
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
}

module.exports = nextConfig
