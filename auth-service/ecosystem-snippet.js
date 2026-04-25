/**
 * PM2 配置片段，合入主 ecosystem.config.js 时把下面这条 app 加进去。
 *
 * 示例：
 *   module.exports = {
 *     apps: [
 *       { ... 现有 8 个工具 ... },
 *       require('./auth-service/ecosystem-snippet.js'),
 *     ],
 *   }
 */
module.exports = {
  name: 'auth-service',
  cwd: '/opt/auth-service',
  script: 'npm',
  args: 'start',
  env: {
    NODE_ENV: 'production',
    PORT: 3000,
  },
}
