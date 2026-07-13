/**
 * 将 tools/ 下的离线 HTML 工具复制到 public/tools/，供 Vite 构建与部署。
 * 维护时只改根目录 tools/，构建前自动同步。
 */
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const srcDir = path.join(root, 'tools')
const destDir = path.join(root, 'public', 'tools')

if (!fs.existsSync(srcDir)) {
  console.warn('copy-tools: tools/ 目录不存在，跳过')
  process.exit(0)
}

const files = fs.readdirSync(srcDir).filter((f) => f.endsWith('.html'))
if (!files.length) {
  console.warn('copy-tools: tools/ 下没有 .html 文件，跳过')
  process.exit(0)
}

if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true })

for (const file of files) {
  fs.copyFileSync(path.join(srcDir, file), path.join(destDir, file))
  console.log('copy-tools: 已复制', file, '-> public/tools/')
}
