/**
 * 将 pdfjs-dist 的 worker、cmaps、standard_fonts 复制到 public 目录，
 * 实现 PDF 解析与字体资源全面本地化，部署后不依赖任何外网 CDN。
 */
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const nodePdf = path.join(root, 'node_modules', 'pdfjs-dist')
const publicDir = path.join(root, 'public')

if (!fs.existsSync(nodePdf)) {
  console.warn('copy-pdf-assets: node_modules/pdfjs-dist 不存在，请先执行 npm install')
  process.exit(0)
}

// Worker：优先 .mjs，否则 .js
const buildDir = path.join(nodePdf, 'build')
const workerMjs = path.join(buildDir, 'pdf.worker.min.mjs')
const workerJs = path.join(buildDir, 'pdf.worker.min.js')
const workerSrc = fs.existsSync(workerMjs) ? workerMjs : workerJs
const workerName = path.basename(workerSrc)

let workerFilename = 'pdf.worker.min.mjs'
if (!fs.existsSync(workerSrc)) {
  console.warn('copy-pdf-assets: 未找到 pdf.worker 文件，跳过')
} else {
  const destWorker = path.join(publicDir, workerName)
  fs.copyFileSync(workerSrc, destWorker)
  workerFilename = workerName
  console.log('copy-pdf-assets: 已复制', workerName, '-> public/')
}

// 供前端使用：写入 worker 文件名到 src，避免硬编码
const assetModulePath = path.join(root, 'src', 'pdf-worker-asset.ts')
fs.writeFileSync(
  assetModulePath,
  `// 由 scripts/copy-pdf-assets.cjs 生成，请勿手改\nexport const PDF_WORKER_FILENAME = ${JSON.stringify(workerFilename)}\n`
)

// CMap 目录（用于 PDF 内嵌 CJK 等字体正确显示）
const cmapsDir = path.join(nodePdf, 'cmaps')
const destCmaps = path.join(publicDir, 'cmaps')
if (fs.existsSync(cmapsDir)) {
  if (!fs.existsSync(destCmaps)) fs.mkdirSync(destCmaps, { recursive: true })
  const files = fs.readdirSync(cmapsDir)
  for (const f of files) {
    const src = path.join(cmapsDir, f)
    if (fs.statSync(src).isFile()) {
      fs.copyFileSync(src, path.join(destCmaps, f))
    }
  }
  console.log('copy-pdf-assets: 已复制 cmaps/ 共', files.length, '个文件')
}

// 标准字体（Times/Helvetica/Courier 等 14 种 PDF 标准字体，发票中常见）
const standardFontsDir = path.join(nodePdf, 'standard_fonts')
const destStandardFonts = path.join(publicDir, 'standard_fonts')
if (fs.existsSync(standardFontsDir)) {
  if (!fs.existsSync(destStandardFonts)) fs.mkdirSync(destStandardFonts, { recursive: true })
  const fontFiles = fs.readdirSync(standardFontsDir)
  for (const f of fontFiles) {
    const src = path.join(standardFontsDir, f)
    if (fs.statSync(src).isFile()) {
      fs.copyFileSync(src, path.join(destStandardFonts, f))
    }
  }
  console.log('copy-pdf-assets: 已复制 standard_fonts/ 共', fontFiles.length, '个文件')
}
