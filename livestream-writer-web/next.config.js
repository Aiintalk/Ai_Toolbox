/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: '/livestream-writer',
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
}

module.exports = nextConfig
