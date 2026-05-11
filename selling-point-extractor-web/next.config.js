/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: '/selling-point-extractor',
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
}

module.exports = nextConfig
