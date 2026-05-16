/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: '/subtitle-extractor',
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
}

module.exports = nextConfig
