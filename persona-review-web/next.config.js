/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: '/persona-review',
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
}

module.exports = nextConfig
