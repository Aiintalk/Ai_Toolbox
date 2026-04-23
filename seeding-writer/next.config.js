/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: '/seeding-writer',
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
}

module.exports = nextConfig
