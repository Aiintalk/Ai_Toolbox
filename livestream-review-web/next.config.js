/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: '/livestream-review',
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
}

module.exports = nextConfig
