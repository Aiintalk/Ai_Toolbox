/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: '/persona-writer',
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
}

module.exports = nextConfig
