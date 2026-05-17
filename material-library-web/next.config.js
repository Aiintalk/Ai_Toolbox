/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: '/material-library',
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
}

module.exports = nextConfig
