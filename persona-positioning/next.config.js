/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: '/persona-positioning',
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
}

module.exports = nextConfig
