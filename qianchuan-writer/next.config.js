/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: '/qianchuan-writer',
  transpilePackages: ['@ai-toolbox/auth-shared'],
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  webpack: (config) => {
    config.resolve.symlinks = false
    return config
  },
}

module.exports = nextConfig
