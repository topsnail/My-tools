<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useToast } from '@/composables/useToast'
import { usePrintWithIframe } from '@/composables/usePrintWithIframe'
import { scheduleScrollToPreview } from '@/composables/useScrollPreviewIntoView'
import { JT_CONFIG, calculateLayout } from '@/constants/jt'

const router = useRouter()
const { showToast } = useToast()
const { print: printWithIframe } = usePrintWithIframe()

const CONFIG = JT_CONFIG
const MANY_FILES_THRESHOLD = 20
const APP_VERSION = __APP_VERSION__

interface PhotoItem {
  dataUrl: string
  originalName: string
  dimensions: { originalWidth: number; originalHeight: number; originalRatio: number }
}

const photoFiles = ref<PhotoItem[]>([])
const originalFiles = ref<File[]>([])
const currentMode = ref<6 | 9 | 12>(9)
const showCutLines = ref(true)
const isProcessing = ref(false)
const showBrowserWarning = ref(false)
const showPrintDialog = ref(false)
const showHelpDialog = ref(false)
const progressPercent = ref(0)
const progressText = ref('')
const showProgress = ref(false)
const dropZoneVisible = ref(true)
const fileInput = ref<HTMLInputElement | null>(null)
const previewSectionRef = ref<HTMLElement | null>(null)
const previewGridRef = ref<HTMLElement | null>(null)
const failedFileNames = ref<string[]>([])

const fileCount = computed(() => originalFiles.value.length)
const hasFiles = computed(() => photoFiles.value.length > 0)
const printModeText = computed(() => {
  if (currentMode.value === 6) return '1页6张(纵向)'
  if (currentMode.value === 9) return '1页9张(纵向)'
  return '1页12张(横向)'
})
const printOrientationText = computed(() => (currentMode.value === 12 ? '横向' : '纵向'))
const bodyModeClass = computed(() => `mode-${currentMode.value}`)
const layoutSummaryText = computed(() => {
  const n = photoFiles.value.length
  if (n === 0) return '暂无图片'
  const layout = calculateLayout(currentMode.value)
  const pages = Math.ceil(n / layout.photosPerPage)
  return `已加载 ${n} 张 · 约 ${pages} 页`
})

function checkBrowserCompatibility() {
  const missing: string[] = []
  if (!window.File) missing.push('File API')
  if (!window.FileReader) missing.push('FileReader API')
  if (!window.Promise) missing.push('Promise API')
  if (!(typeof HTMLCanvasElement !== 'undefined' && document.createElement('canvas').getContext('2d'))) missing.push('Canvas API')
  if (missing.length) {
    showBrowserWarning.value = true
    return false
  }
  return true
}

function closeBrowserWarning() { showBrowserWarning.value = false }
function openHelp() { showHelpDialog.value = true }
function closeHelp() { showHelpDialog.value = false }
function openPrintDialog() {
  if (!hasFiles.value) return
  showPrintDialog.value = true
}
function hidePrintDialog() { showPrintDialog.value = false }
function goHome() { router.push('/') }
function openFapiao() { router.push('/fp') }

function removeFile(index: number) {
  photoFiles.value.splice(index, 1)
  originalFiles.value.splice(index, 1)
  if (photoFiles.value.length === 0) {
    resetApp()
    return
  }
  showToast(`已删除，剩余 ${photoFiles.value.length} 张`, 'info')
  renderPreview()
}

function processImage(file: File): Promise<PhotoItem> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        resolve({
          dataUrl: e.target!.result as string,
          originalName: file.name,
          dimensions: {
            originalWidth: img.width,
            originalHeight: img.height,
            originalRatio: img.width / img.height,
          },
        })
      }
      img.onerror = () => reject(new Error('图片加载失败: ' + file.name))
      img.src = e.target!.result as string
    }
    reader.onerror = () => reject(new Error('文件读取失败: ' + file.name))
    reader.readAsDataURL(file)
  })
}

async function handleFiles(files: FileList | null) {
  if (!files?.length || isProcessing.value) {
    if (isProcessing.value) showToast('正在处理文件中，请稍候...', 'warning')
    return
  }
  const imageFiles = Array.from(files).filter((f) =>
    f.type.startsWith('image/') && ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'].includes(f.type)
  )
  if (!imageFiles.length) {
    showToast('请选择图片文件（JPG、PNG、WEBP）！', 'warning')
    return
  }
  const totalAfter = originalFiles.value.length + imageFiles.length
  if (totalAfter > CONFIG.MAX_FILES) {
    const canAdd = CONFIG.MAX_FILES - originalFiles.value.length
    showToast(`最多 ${CONFIG.MAX_FILES} 个文件，本次只能再添加 ${canAdd} 个`, 'warning')
    imageFiles.splice(canAdd)
    if (!imageFiles.length) return
  }

  isProcessing.value = true
  dropZoneVisible.value = false
  showProgress.value = true
  const startLen = photoFiles.value.length
  const duplicateNames: string[] = []
  const failedNames: string[] = []

  const batchTotal = imageFiles.length
  for (let i = 0; i < imageFiles.length; i++) {
    const file = imageFiles[i]
    // 仅针对「本批」文件显示进度，与百分比一致（避免追加文件时文案与进度条错位）
    progressText.value = `处理中 ${i + 1} / ${batchTotal}`
    progressPercent.value = Math.round(((i + 1) / batchTotal) * 100)
    const nameIdx = originalFiles.value.findIndex((f) => f.name === file.name)
    if (nameIdx >= 0) {
      duplicateNames.push(file.name)
      continue
    }
    try {
      const item = await processImage(file)
      photoFiles.value.push(item)
      originalFiles.value.push(file)
    } catch (e) {
      console.error(file.name, e)
      failedNames.push(file.name)
    }
  }

  isProcessing.value = false
  showProgress.value = false
  failedFileNames.value = failedNames
  if (duplicateNames.length) showToast(`已跳过 ${duplicateNames.length} 个重复文件`, 'warning', 5000)
  if (failedNames.length) showToast(failedNames.length === 1 ? `加载失败：${failedNames[0]}` : `${failedNames.length} 个文件加载失败`, 'error', 5000)
  const addedCount = photoFiles.value.length - startLen
  if (addedCount > 0) {
    showToast(`成功加载 ${addedCount} 张图片`, 'success')
    renderPreview()
    scheduleScrollToPreview(previewSectionRef)
  }
}

function triggerFileSelect() { fileInput.value?.click() }
function setMode(mode: 6 | 9 | 12) {
  if (currentMode.value === mode) return
  currentMode.value = mode
  renderPreview()
}
function toggleCutLines() {
  showCutLines.value = !showCutLines.value
  renderPreview()
}

function renderPreview() {
  const grid = previewGridRef.value
  if (!grid) return
  grid.innerHTML = ''
  const photos = photoFiles.value
  if (!photos.length) return
  const layout = calculateLayout(currentMode.value)
  const totalPages = Math.ceil(photos.length / layout.photosPerPage)
  const pageClass = layout.orientation === 'portrait' ? 'v-page' : 'h-page'

  for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
    const pageDiv = document.createElement('div')
    pageDiv.className = `preview-page ${pageClass}`

    for (let row = 0; row < layout.rows; row++) {
      for (let col = 0; col < layout.columns; col++) {
        const slotIndex = row * layout.columns + col
        const fileIndex = pageIndex * layout.photosPerPage + slotIndex
        if (fileIndex >= photos.length) continue
        const leftPct = (layout.margin + col * (layout.slotWidth + layout.spacing)) / layout.pageWidth * 100
        const topPct = (layout.margin + row * (layout.slotHeight + layout.spacing)) / layout.pageHeight * 100
        const widthPct = layout.slotWidth / layout.pageWidth * 100
        const heightPct = layout.slotHeight / layout.pageHeight * 100
        const slot = document.createElement('div')
        slot.className = 'slot'
        slot.style.left = `${leftPct}%`
        slot.style.top = `${topPct}%`
        slot.style.width = `${widthPct}%`
        slot.style.height = `${heightPct}%`
        slot.style.overflow = 'hidden'
        slot.style.display = 'flex'
        slot.style.alignItems = 'flex-start'
        slot.style.justifyContent = 'center'
        slot.style.background = 'white'
        const img = document.createElement('img')
        img.src = photos[fileIndex].dataUrl
        img.alt = photos[fileIndex].originalName
        img.style.width = '100%'
        img.style.height = 'auto'
        img.style.objectFit = 'cover'
        img.style.objectPosition = 'top center'
        slot.appendChild(img)
        pageDiv.appendChild(slot)
      }
    }

    if (showCutLines.value) {
      for (let col = 1; col < layout.columns; col++) {
        const lineX = layout.margin + col * layout.slotWidth + (col - 0.5) * layout.spacing
        const line = document.createElement('div')
        line.className = 'cut-line vertical'
        line.style.left = `${lineX / layout.pageWidth * 100}%`
        line.style.top = '0%'
        line.style.height = '100%'
        pageDiv.appendChild(line)
      }
      for (let row = 1; row < layout.rows; row++) {
        const lineY = layout.margin + row * layout.slotHeight + (row - 0.5) * layout.spacing
        const line = document.createElement('div')
        line.className = 'cut-line horizontal'
        line.style.top = `${lineY / layout.pageHeight * 100}%`
        line.style.left = '0%'
        line.style.width = '100%'
        pageDiv.appendChild(line)
      }
    }
    grid.appendChild(pageDiv)
  }
}

async function exportPdf() {
  if (!photoFiles.value.length) return
  if (photoFiles.value.length >= MANY_FILES_THRESHOLD) {
    showToast('文件较多，正在生成 PDF，请稍候…', 'info', 2000)
  }
  try {
    showToast('正在生成 PDF…', 'info')
    const { loadJsPDF } = await import('@/lib/loadJsPDF')
    const JsPDF = await loadJsPDF()
    const layout = calculateLayout(currentMode.value)
    const doc = new JsPDF({ orientation: layout.orientation, unit: 'mm', format: 'a4' })
    const totalPages = Math.ceil(photoFiles.value.length / layout.photosPerPage)

    for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
      if (pageIndex > 0) doc.addPage()
      for (let row = 0; row < layout.rows; row++) {
        for (let col = 0; col < layout.columns; col++) {
          const slotIndex = row * layout.columns + col
          const fileIndex = pageIndex * layout.photosPerPage + slotIndex
          if (fileIndex >= photoFiles.value.length) break
          const x = layout.margin + col * (layout.slotWidth + layout.spacing)
          const y = layout.margin + row * (layout.slotHeight + layout.spacing)
          const imgInfo = photoFiles.value[fileIndex]
          const ratio = imgInfo.dimensions.originalRatio
          const drawW = layout.slotWidth
          const drawH = layout.slotWidth / ratio
          const format = imgInfo.dataUrl.startsWith('data:image/png') ? 'PNG' : 'JPEG'

          if (drawH <= layout.slotHeight) {
            doc.addImage(imgInfo.dataUrl, format, x, y, drawW, drawH)
            if (drawH < layout.slotHeight) {
              doc.setFillColor(255, 255, 255)
              doc.rect(x, y + drawH, drawW, layout.slotHeight - drawH, 'F')
            }
          } else {
            const tempImg = new Image()
            tempImg.src = imgInfo.dataUrl
            await new Promise<void>((resolve, reject) => {
              if (tempImg.complete) resolve()
              else { tempImg.onload = () => resolve(); tempImg.onerror = reject }
            })
            const canvas = document.createElement('canvas')
            const ctx = canvas.getContext('2d')!
            const cropRatio = layout.slotHeight / drawH
            const cropH = tempImg.height * cropRatio
            canvas.width = tempImg.width
            canvas.height = cropH
            ctx.drawImage(tempImg, 0, 0, tempImg.width, cropH, 0, 0, tempImg.width, cropH)
            const dataUrl = canvas.toDataURL('image/jpeg', JT_CONFIG.IMAGE_QUALITY)
            doc.addImage(dataUrl, 'JPEG', x, y, drawW, layout.slotHeight)
          }
        }
      }
      if (showCutLines.value) {
        doc.setDrawColor(170, 170, 170)
        doc.setLineWidth(0.3)
        doc.setLineDashPattern([3, 3], 0)
        for (let col = 1; col < layout.columns; col++) {
          const lineX = layout.margin + col * layout.slotWidth + (col - 0.5) * layout.spacing
          doc.line(lineX, layout.margin, lineX, layout.pageHeight - layout.margin)
        }
        for (let row = 1; row < layout.rows; row++) {
          const lineY = layout.margin + row * layout.slotHeight + (row - 0.5) * layout.spacing
          doc.line(layout.margin, lineY, layout.pageWidth - layout.margin, lineY)
        }
        doc.setLineDashPattern([], 0)
      }
    }

    const now = new Date()
    const ts = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`
    doc.save(`图_${ts}.pdf`)
    showToast('PDF 导出成功！', 'success')
  } catch (e: any) {
    console.error(e)
    let msg = '导出 PDF 失败'
    if (e?.message?.includes('security')) msg += '：可能是浏览器安全限制，请尝试其他浏览器'
    else if (e?.message?.includes('memory') || e?.message?.includes('Out of memory')) msg += '：文件过多导致内存不足，请减少文件数量后重试'
    else if (e?.message) msg += `：${e.message}`
    showToast(msg + '，请重试。', 'error', 6000)
  }
}

function doPrint() {
  if (!hasFiles.value) return
  hidePrintDialog()
  const grid = document.getElementById('previewGrid')
  if (!grid || !grid.innerHTML.trim()) {
    showToast('暂无预览内容', 'warning')
    return
  }
  if (photoFiles.value.length >= MANY_FILES_THRESHOLD) {
    showToast('文件较多，准备打印中，请稍候…', 'info', 1500)
  }
  const orientation = currentMode.value === 12 ? 'landscape' : 'portrait'
  const printCss = `
    @page { margin: 0; size: A4 ${orientation}; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { margin: 0; padding: 0; background: white; }
    #previewGrid { display: block; margin: 0; padding: 0; }
    .preview-page { margin: 0 auto; padding: 0; border: none; box-shadow: none; position: relative; overflow: hidden; page-break-after: always; break-inside: avoid; }
    .preview-page:last-child { page-break-after: avoid; }
    .v-page { width: 210mm; height: 297mm; }
    .h-page { width: 297mm; height: 210mm; }
    .slot { position: absolute; display: flex; align-items: flex-start; justify-content: center; box-sizing: border-box; overflow: hidden; background: white; }
    .slot img { width: 100%; height: auto; object-fit: cover; object-position: top center; display: block; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .cut-line { position: absolute; pointer-events: none; z-index: 10; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .cut-line.vertical { border-left: 1px dashed #d35400; height: 100%; }
    .cut-line.horizontal { border-top: 1px dashed #d35400; width: 100%; }
  `
  try {
    printWithIframe(grid.innerHTML, printCss)
  } catch (e: any) {
    console.error(e)
    showToast('打印准备失败，请稍后重试。', 'error', 4000)
  }
}

function resetApp() {
  if (isProcessing.value && !confirm('文件正在处理中，确定要重置吗？')) return
  photoFiles.value = []
  originalFiles.value = []
  failedFileNames.value = []
  showCutLines.value = true
  isProcessing.value = false
  dropZoneVisible.value = true
  showPrintDialog.value = false
  if (fileInput.value) fileInput.value.value = ''
  currentMode.value = 9
  renderPreview()
  showToast('已重置', 'success', 2000)
}

function onFileChange(e: Event) {
  const target = e.target as HTMLInputElement
  if (target.files) handleFiles(target.files)
}
function onDropZoneClick() { fileInput.value?.click() }
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    hidePrintDialog()
    closeHelp()
    closeBrowserWarning()
  }
}

onMounted(async () => {
  checkBrowserCompatibility()
  document.addEventListener('keydown', onKeydown)
  await nextTick()
  renderPreview()
})
onUnmounted(() => document.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div class="jt-page" :class="bodyModeClass">
    <div v-if="showBrowserWarning" class="browser-warning">
      <div class="browser-warning-content">
        <div>⚠️ 建议使用 Chrome、Edge 或 Firefox 最新版本</div>
        <button type="button" class="browser-warning-close" @click="closeBrowserWarning">×</button>
      </div>
    </div>

    <div v-if="showPrintDialog" class="print-dialog" role="dialog" aria-modal="true" aria-labelledby="jt-print-dialog-title" @click.self="hidePrintDialog">
      <div class="print-dialog-content">
        <h3 id="jt-print-dialog-title">🖨️ 打印设置提示</h3>
        <p>当前布局：<strong>{{ printModeText }}</strong></p>
        <p>请在稍后的打印设置中确认：</p>
        <p>1. <strong>纸张方向</strong>：<strong>{{ printOrientationText }}</strong></p>
        <p>2. <strong>纸张大小</strong>：<strong>A4</strong></p>
        <p>3. <strong>页边距</strong>：<strong>无</strong> 或 <strong>最小</strong></p>
        <p>4. <strong>缩放</strong>：<strong>100%</strong></p>
        <p class="print-tip">💡 裁剪线已开启时，打印后可按虚线裁剪</p>
        <div class="print-dialog-buttons">
          <button type="button" class="print-dialog-btn print-dialog-confirm" @click="doPrint">确认并打印</button>
          <button type="button" class="print-dialog-btn print-dialog-cancel" @click="hidePrintDialog">取消</button>
        </div>
      </div>
    </div>

    <div v-if="showHelpDialog" class="help-dialog" role="dialog" aria-modal="true" aria-labelledby="jt-help-dialog-title" @click.self="closeHelp">
      <div class="help-dialog-content">
        <button type="button" class="help-close" aria-label="关闭使用说明" @click="closeHelp">×</button>
        <h2 id="jt-help-dialog-title">📚 使用说明</h2>
        <div class="help-section">
          <h3>📋 简介</h3>
          <p>手机截图批量打印：将多张竖版手机截图智能排版到 A4 纸上。</p>
        </div>
        <div class="help-section">
          <h3>🚀 快速开始</h3>
          <p>拖入或点击加载图片 → 选择布局（6/9/12 张/页）→ 可选裁剪线 → 导出 PDF 或打印。</p>
        </div>
        <div class="help-section">
          <h3>🧩 布局</h3>
          <p><strong>1页6张(纵向)</strong> 3×2；<strong>1页9张(纵向)</strong> 3×3 推荐；<strong>1页12张(横向)</strong> 6×2。</p>
        </div>
        <div class="help-tip"><strong>💡</strong> 支持 JPG、PNG、WEBP；单次最多 50 张；建议竖版 3:4 比例。</div>
        <div class="help-section">
          <h3>📞</h3>
          <p><a href="https://ly.topmer.top" target="_blank" rel="noopener">给我留言</a></p>
        </div>
      </div>
    </div>

    <div class="main-card">
      <div class="header">
        <h1>手机截图批量排版打印</h1>
        <div class="header-actions" role="toolbar" aria-label="页面操作">
          <button type="button" class="home-btn" title="更多工具" @click="goHome">🏠</button>
          <button type="button" class="invoice-btn" title="发票打印" @click="openFapiao">🧾</button>
          <button type="button" class="help-btn" title="使用说明" @click="openHelp">❓</button>
        </div>
      </div>

      <div class="top-layout">
        <div class="drop-zone-container">
          <div
            v-show="dropZoneVisible"
            class="drop-zone"
            role="button"
            tabindex="0"
            aria-label="将手机截图拖入此处或点击加载"
            @click="onDropZoneClick"
            @dragover.prevent
            @dragleave.prevent
            @drop.prevent="handleFiles(($event as DragEvent).dataTransfer?.files ?? null)"
          >
            <div class="upload-icon">📤</div>
            <div class="upload-text">将手机截图拖入此处</div>
            <div class="upload-subtext">或 <span>点击加载</span> (支持多选)</div>
            <div class="upload-limit">✨ 仅适用于手机截图，每次不超过 50 张 ✨</div>
            <input ref="fileInput" type="file" accept="image/jpeg,image/png,image/jpg,image/webp" multiple hidden @change="onFileChange" />
          </div>

          <div v-show="!dropZoneVisible" class="drop-zone feedback-area">
            <div class="file-list-container">
              <div class="file-list-header">
                <span>📄 已加载 ({{ fileCount }})</span>
                <button type="button" class="btn-add-more" aria-label="继续添加更多图片" @click="triggerFileSelect">+ 继续添加</button>
              </div>
              <div class="file-list-scroll">
                <div class="file-list">
                  <div v-for="(file, index) in originalFiles" :key="index" class="file-item" :title="file.name">
                    <span class="file-number">{{ index + 1 }}.</span>
                    <div class="file-name" :title="file.name">{{ file.name.length > 30 ? file.name.slice(0, 27) + '...' : file.name }}</div>
                    <span class="file-status-btn">✓ 已加载</span>
                    <button type="button" class="file-delete" title="删除" aria-label="移除此文件" @click="removeFile(index)">×</button>
                  </div>
                </div>
              </div>
              <div v-if="failedFileNames.length" class="failed-files" role="status" aria-live="polite">
                以下文件加载失败：{{ failedFileNames.join('、') }}
              </div>
            </div>
            <div class="reset-hint">💡 如需处理新文件，请点击“清空重置”</div>
          </div>

          <div v-show="showProgress" class="progress-wrapper">
            <div class="progress-bar" :style="{ width: progressPercent + '%' }" />
            <div class="progress-text">{{ progressText }}</div>
          </div>
        </div>

        <div class="settings-panel">
          <div class="settings-tip-cut-row">
            <div class="setting-unit setting-tip">
              <div class="unit-header">📄 本次排版</div>
              <div class="layout-summary">{{ layoutSummaryText }}</div>
            </div>
            <div class="setting-unit">
              <div class="unit-header">✂️ 裁剪线</div>
              <button type="button" :class="['toggle-btn', showCutLines ? 'btn-on' : 'btn-off']" @click="toggleCutLines">
                {{ showCutLines ? '已开启' : '已关闭' }}
              </button>
            </div>
          </div>
          <div class="setting-unit unit-full">
            <div class="unit-header">🧩 布局选择</div>
            <div class="mode-group">
              <button type="button" :class="['btn-mode', { active: currentMode === 6 }]" @click="setMode(6)">
                <span class="btn-mode-inner">
                  <span class="btn-mode-main">1页6张</span><span class="btn-mode-orient">(纵向)</span>
                </span>
              </button>
              <button type="button" :class="['btn-mode', { active: currentMode === 9 }]" @click="setMode(9)">
                <span class="btn-mode-inner">
                  <span class="btn-mode-main">1页9张</span><span class="btn-mode-orient">(纵向)</span>
                </span>
              </button>
              <button type="button" :class="['btn-mode', { active: currentMode === 12 }]" @click="setMode(12)">
                <span class="btn-mode-inner">
                  <span class="btn-mode-main">1页12张</span><span class="btn-mode-orient">(横向)</span>
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="toolbar">
        <button type="button" class="btn-large btn-pdf" :disabled="!hasFiles" aria-label="导出当前预览为 PDF 文件" @click="exportPdf">💾 导出 PDF</button>
        <button type="button" class="btn-large btn-print" :disabled="!hasFiles" aria-label="立即打印当前预览" @click="openPrintDialog">🖨️ 立即打印</button>
        <button type="button" class="btn-large btn-reset" aria-label="清空已加载文件并重置" @click="resetApp">🧹 清空重置</button>
      </div>

      <section
        ref="previewSectionRef"
        class="preview-section"
        tabindex="-1"
        role="region"
        aria-labelledby="jt-preview-title"
      >
        <h2 id="jt-preview-title" class="preview-landmark-title">排版预览</h2>
        <div ref="previewGridRef" id="previewGrid" class="preview-grid" />
      </section>
    </div>

    <div class="footer">
      Copyright © {{ new Date().getFullYear() }} <a href="https://topmer.top" target="_blank" rel="noopener">Topmer</a>
      | v{{ APP_VERSION }} | 💬 <a href="https://ly.topmer.top" target="_blank" rel="noopener">给我留言</a>
    </div>
  </div>
</template>

<style scoped>
.jt-page {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  /* jt 页面专属呼吸渐变（更浅 + 去紫），避免与 fp 页面完全相同 */
  /* 更柔和的浅色系：低饱和，避免青色过艳 */
  --jt-gradient-start:rgb(90, 119, 103);
  --jt-gradient-mid1:rgb(151, 155, 136);
  --jt-gradient-mid2:rgb(90, 110, 119);
  --jt-gradient-mid3:rgb(186, 155, 125);
  --jt-gradient-end:rgba(98, 119, 130, 0.42);

  background: linear-gradient(-45deg, var(--jt-gradient-start), var(--jt-gradient-mid1), var(--jt-gradient-mid2), var(--jt-gradient-mid3), var(--jt-gradient-end));
  background-size: 400% 400%;
  animation: gradientBG 20s ease infinite;
  background-attachment: fixed;
  min-height: 100vh;
  padding: 12px 20px 20px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}
@keyframes gradientBG {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

@media (prefers-reduced-motion: reduce) {
  .jt-page {
    animation: none;
    background-position: 50% 50%;
    background-attachment: scroll;
  }
}

.main-card { width: 100%; max-width: 1050px; background: rgba(235,230,230,0.75); backdrop-filter: blur(15px); border-radius: var(--border-radius-large); padding: 40px; box-shadow: 0 25px 50px rgba(0,0,0,0.2); }
.header {
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding-bottom: 6px;
  margin-bottom: 12px;
  border-bottom: 1px solid rgba(0,0,0,0.1);
}
.header h1 {
  flex: 1;
  min-width: 0;
  color: var(--color-dark-gray);
  text-align: center;
  font-size: 24px;
  margin: 0;
  padding: 0;
  letter-spacing: 2px;
  font-weight: 600;
}
.header-actions {
  display: flex;
  flex-direction: row;
  flex-shrink: 0;
  align-items: center;
  gap: 4px;
}
.home-btn, .invoice-btn, .help-btn {
  background: rgba(255,255,255,0.3);
  border: 1px solid rgba(74,109,124,0.3);
  border-radius: 8px;
  width: 36px;
  height: 36px;
  font-size: 18px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.home-btn:hover, .invoice-btn:hover, .help-btn:hover { background: rgba(255,255,255,0.5); transform: translateY(-1px); }

.top-layout { display: flex; gap: 12px; margin-bottom: 12px; align-items: stretch; }
.drop-zone-container { flex: 1.2; display: flex; flex-direction: column; gap: 12px; }
.drop-zone { flex: 1; border: 0.5px dashed var(--color-primary); border-radius: 12px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 25px; cursor: pointer; background: rgba(255,255,255,0.5); box-shadow: 0 4px 12px rgba(0,0,0,0.2); }
.drop-zone:hover { background: rgba(255,255,255,0.6); transform: translateY(-2px); }
.upload-icon { font-size: 40px; color: var(--color-primary); margin-bottom: 10px; }
.upload-text { font-size: 18px; font-weight: 600; color: var(--color-dark-gray); margin-bottom: 8px; }
.upload-subtext { font-size: 14px; color: #576574; }
.upload-subtext span { color: #b97980; text-decoration: underline; }
.upload-limit { font-size: 12px; color: #576574; margin-top: 12px; }

.feedback-area { text-align: center; }
.reset-hint { color: var(--color-warning); font-size: 14px; font-weight: 500; margin-top: 4px; }
.failed-files { font-size: 12px; color: #c0392b; margin-top: 6px; padding: 4px 0; word-break: break-all; }
.file-list-container { width: 100%; margin: 8px 0; }
.file-list-header { display: flex; justify-content: space-between; align-items: center; font-size: 13px; font-weight: 600; color: var(--color-dark-gray); margin-bottom: 6px; padding-bottom: 4px; border-bottom: 1px solid rgba(0,0,0,0.1); }
.btn-add-more { background: var(--color-warning); color: white; border: none; border-radius: 6px; padding: 5px 12px; font-size: 12px; font-weight: 600; cursor: pointer; }
.file-list-scroll { max-height: 180px; overflow-y: auto; border: 1px solid rgba(74,109,124,0.2); border-radius: 6px; background: rgba(255,255,255,0.3); padding: 4px; }
.file-list { font-size: 12px; }
.file-item { display: flex; align-items: center; gap: 8px; padding: 2px 30px 2px 8px; background: rgba(255,255,255,0.7); border-radius: 4px; margin: 1px 0; position: relative; }
.file-number { font-size: 12px; color: var(--color-dark-gray); min-width: 20px; }
.file-name { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 12px; padding-right: 8px; }
.file-status-btn { padding: 2px 8px; background: var(--color-success); color: white; border-radius: 3px; font-size: 11px; flex-shrink: 0; }
.file-delete { position: absolute; right: 6px; top: 50%; transform: translateY(-50%); width: 18px; height: 18px; background: rgba(74,109,124,0.2); border: none; border-radius: 50%; color: var(--color-primary); font-size: 14px; cursor: pointer; }
.file-delete:hover { background: var(--color-warning); color: white; }

.progress-wrapper { position: relative; height: 24px; background: rgba(0,0,0,0.1); border-radius: 12px; overflow: hidden; }
.progress-bar { height: 100%; width: 0%; background: linear-gradient(90deg, #77b282, #429852, #0c7820); transition: width 0.8s ease; }
.progress-text { position: absolute; width: 100%; height: 100%; top: 0; left: 0; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 500; color: #fff; pointer-events: none; }

.settings-panel { flex: 1; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.settings-tip-cut-row { display: contents; }
.setting-unit { background: rgba(170,180,180,0.75); border-radius: 12px; padding: 15px; display: flex; flex-direction: column; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(0,0,0,0.2); }
.setting-tip .layout-summary { font-size: 15px; font-weight: 600; color: var(--color-primary); }
.unit-full { grid-column: span 2; }
.unit-header { font-size: 14px; font-weight: 600; color: var(--color-dark-gray); margin-bottom: 8px; }
.toggle-btn { width: 70%; height: 35px; border-radius: 12px; border: none; font-weight: 600; cursor: pointer; }
.btn-on { background: var(--color-success); color: white; }
.btn-off { background: var(--color-light-gray); color: var(--color-medium-gray); }
.mode-group { display: flex; gap: 10px; width: 90%; flex-wrap: wrap; }
.btn-mode {
  flex: 1;
  min-width: 100px;
  height: 38px;
  border-radius: 12px;
  border: 1px solid var(--color-light-gray);
  background: var(--color-light-gray);
  color: var(--color-primary);
  font-weight: 600;
  cursor: pointer;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.btn-mode-inner {
  display: inline-flex;
  flex-direction: row;
  align-items: baseline;
  justify-content: center;
  gap: 0;
  line-height: 1.2;
}
.btn-mode:hover { border-color: var(--color-primary); }
.btn-mode.active { background: var(--color-success); color: white; border-color: var(--color-primary); }

.toolbar { display: flex; gap: 20px; margin-top: 20px; }
.btn-large { flex: 1; height: 52px; border-radius: 12px; border: none; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; color: white; }
.btn-large:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 5px 15px rgba(0,0,0,0.2); }
.btn-pdf { background: #94a3b8; }
.btn-print { background: var(--color-secondary); }
.btn-reset { background: white; color: var(--color-medium-gray); border: 1px solid var(--color-light-gray); }
.btn-reset:hover { background: #f8fafc; border-color: #94a3b8; }
.btn-large:disabled { opacity: 0.3; cursor: not-allowed; transform: none !important; }

.preview-section { margin-top: 4px; }
.preview-landmark-title {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

/* 预览区域：内部由 JS 动态插入，必须用 :deep() 才能生效 */
.preview-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 10px; margin-top: 0; }
.preview-grid :deep(.preview-page) { background: white; position: relative; box-shadow: 0 15px 35px rgba(0,0,0,0.2); margin: 0 auto; overflow: hidden; }
.preview-grid :deep(.preview-page:hover) { transform: translateY(-5px); box-shadow: 0 20px 40px rgba(0,0,0,0.2); }
.preview-grid :deep(.v-page) { aspect-ratio: 210/297; width: 100%; }
.preview-grid :deep(.h-page) { aspect-ratio: 297/210; width: 100%; }
.preview-grid :deep(.slot) { position: absolute; display: flex; align-items: flex-start; justify-content: center; box-sizing: border-box; overflow: hidden; background: white; }
.preview-grid :deep(.slot img) { width: 100%; height: auto; object-fit: cover; object-position: top center; display: block; }
.preview-grid :deep(.cut-line) { position: absolute; pointer-events: none; z-index: 10; }
.preview-grid :deep(.cut-line.vertical) { border-left: 0.5px dashed var(--color-danger); height: 100%; }
.preview-grid :deep(.cut-line.horizontal) { border-top: 0.5px dashed var(--color-danger); width: 100%; }

.browser-warning { position: fixed; top: 0; left: 0; width: 100%; background: #ffcc00; color: #333; padding: 10px 15px; text-align: center; font-size: 14px; font-weight: 500; z-index: 9999; }
.browser-warning-content { max-width: 1050px; margin: 0 auto; display: flex; justify-content: space-between; align-items: center; }
.browser-warning-close { background: none; border: none; font-size: 20px; cursor: pointer; padding: 0 10px; }

.print-dialog { position: fixed; inset: 0; background: rgba(0,0,0,0.7); display: flex; justify-content: center; align-items: center; z-index: 1000; }
.print-dialog-content { background: white; padding: 30px; border-radius: 12px; max-width: 500px; width: 90%; box-shadow: 0 10px 30px rgba(0,0,0,0.3); }
.print-dialog h3 { margin-bottom: 15px; font-size: 20px; text-align: center; }
.print-dialog p { color: #576574; margin-bottom: 10px; line-height: 1.5; }
.print-dialog strong { color: var(--color-warning); }
.print-dialog-buttons { display: flex; gap: 15px; margin-top: 25px; }
.print-dialog-btn { flex: 1; padding: 12px; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; }
.print-dialog-confirm { background: var(--color-secondary); color: white; }
.print-dialog-confirm:hover { background: #0d5d49; }
.print-dialog-cancel { background: #f1f5f9; color: var(--color-medium-gray); border: 1px solid var(--color-light-gray); }
.print-tip { margin-top: 10px; font-size: 13px; color: #94a3b8; font-style: italic; }

.help-dialog { position: fixed; inset: 0; background: rgba(0,0,0,0.7); display: flex; justify-content: center; align-items: center; z-index: 1001; }
.help-dialog-content { background: white; padding: 30px; border-radius: 12px; max-width: 700px; width: 90%; max-height: 80vh; overflow-y: auto; position: relative; box-shadow: 0 10px 30px rgba(0,0,0,0.3); }
.help-close { position: absolute; top: 15px; right: 15px; background: none; border: none; font-size: 28px; cursor: pointer; color: var(--color-medium-gray); width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
.help-close:hover { background: #f1f5f9; color: var(--color-dark-gray); }
.help-dialog h2 { color: var(--color-dark-gray); margin-bottom: 20px; font-size: 24px; text-align: center; }
.help-section { margin-bottom: 20px; }
.help-section h3 { color: var(--color-secondary); font-size: 18px; margin-bottom: 8px; }
.help-section p { color: #576574; line-height: 1.6; margin-bottom: 8px; padding-left: 28px; }
.help-tip { background: rgba(20,122,97,0.1); border-left: 3px solid var(--color-secondary); padding: 10px 15px; margin: 15px 0; border-radius: 0 6px 6px 0; font-size: 14px; }

.footer { width: 100%; max-width: 1050px; text-align: center; padding: 15px 0; color: var(--color-medium-gray); font-size: 14px; margin-top: 20px; }
.footer a { color: var(--color-secondary); text-decoration: none; font-weight: 600; }
.footer a:hover { color: #0d5d49; text-decoration: underline; }

@media (max-width: 768px) {
  .jt-page { padding: max(12px, env(safe-area-inset-top)) max(12px, env(safe-area-inset-right)) max(20px, env(safe-area-inset-bottom)) max(12px, env(safe-area-inset-left)); }
  .main-card { padding: 20px 16px; }
  .header {
    position: relative;
    display: block;
    margin-bottom: 10px;
    padding-bottom: 4px;
  }
  .header h1 {
    font-size: 20px;
    margin: 0;
    padding: 0 102px;
    text-align: center;
    letter-spacing: 1px;
  }
  .header-actions {
    position: absolute;
    right: 0;
    top: 50%;
    transform: translateY(-50%);
    display: flex;
    justify-content: flex-end;
    gap: 3px;
  }
  .home-btn, .invoice-btn, .help-btn {
    width: 32px;
    height: 32px;
    min-width: 32px;
    min-height: 32px;
    font-size: 15px;
    border-radius: 6px;
  }
  .top-layout { flex-direction: column; gap: 12px; margin-bottom: 12px; }
  .drop-zone-container { min-height: 140px; }
  .drop-zone { padding: 16px 12px; }
  .upload-icon { font-size: 32px; }
  .upload-text { font-size: 16px; }
  .upload-subtext, .upload-limit { font-size: 12px; }
  .settings-panel { gap: 6px; }
  .setting-unit { padding: 10px 8px; border-radius: 10px; }
  .unit-header { font-size: 12px; margin-bottom: 4px; }
  .preview-landmark-title {
    position: static;
    width: auto;
    height: auto;
    margin: 0 0 8px;
    clip: auto;
    overflow: visible;
    white-space: normal;
    font-size: 13px;
    font-weight: 600;
    color: var(--color-dark-gray);
    text-align: center;
  }
  .preview-section:focus-visible {
    outline: 2px solid var(--color-secondary);
    outline-offset: 3px;
    border-radius: 6px;
  }
  .mode-group { flex-direction: row; flex-wrap: nowrap; width: 100%; gap: 6px; }
  .btn-mode {
    min-width: 0;
    padding: 6px 2px;
    height: auto;
    min-height: 44px;
    font-size: 11px;
  }
  .btn-mode-inner {
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
  }
  .btn-mode-orient { font-size: 10px; font-weight: 600; opacity: 0.95; }
  .toolbar {
    display: grid;
    grid-template-columns: 1fr 1fr;
    grid-template-areas: 'pdf print' 'reset reset';
    gap: 8px;
    margin-top: 12px;
    padding-bottom: max(6px, env(safe-area-inset-bottom));
  }
  .toolbar .btn-pdf { grid-area: pdf; }
  .toolbar .btn-print { grid-area: print; }
  .toolbar .btn-reset { grid-area: reset; }
  .btn-large { min-height: 48px; font-size: 15px; width: 100%; }
  .file-list-scroll { max-height: 140px; }
  .print-dialog-content, .help-dialog-content { padding: 20px 16px; margin: 16px; max-height: calc(100vh - 32px); }
  .help-section p { padding-left: 12px; }
  .footer { font-size: 12px; padding: 12px 8px; }
}
@media (max-width: 480px) {
  .jt-page { padding: max(8px, env(safe-area-inset-top)) max(8px, env(safe-area-inset-right)) max(16px, env(safe-area-inset-bottom)) max(8px, env(safe-area-inset-left)); }
  .main-card { padding: 12px; position: relative; }
  .header { margin-bottom: 8px; padding-bottom: 4px; }
  .header h1 {
    font-size: 16px;
    letter-spacing: 0.5px;
    line-height: 1.35;
    padding: 0 90px;
  }
  .header-actions { gap: 3px; }
  .home-btn, .invoice-btn, .help-btn {
    width: 28px;
    height: 28px;
    min-width: 28px;
    min-height: 28px;
    font-size: 13px;
    border-radius: 5px;
  }
  .settings-panel { grid-template-columns: 1fr; gap: 6px; }
  .settings-tip-cut-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
    align-items: stretch;
  }
  .settings-tip-cut-row .setting-unit { min-width: 0; padding: 8px 6px; }
  .settings-tip-cut-row .unit-header { font-size: 11px; }
  .settings-tip-cut-row .layout-summary { font-size: 12px; }
  .settings-tip-cut-row .toggle-btn { width: 100%; height: 30px; font-size: 11px; }
  .unit-full { grid-column: span 1; }
  .toolbar {
    display: grid;
    grid-template-columns: 1fr 1fr;
    grid-template-areas: 'pdf print' 'reset reset';
    gap: 8px;
    margin-top: 10px;
    padding-bottom: max(8px, env(safe-area-inset-bottom));
  }
  .toolbar .btn-pdf { grid-area: pdf; }
  .toolbar .btn-print { grid-area: print; }
  .toolbar .btn-reset { grid-area: reset; }
  .btn-large { flex: none; width: 100%; min-height: 46px; height: auto; font-size: 14px; }
  .preview-grid { grid-template-columns: 1fr; gap: 8px; margin-top: 0; }
  .drop-zone { padding: 12px; }
  .upload-icon { font-size: 28px; }
  .upload-text { font-size: 14px; }
  .setting-unit { padding: 8px 8px; border-radius: 10px; }
  .btn-mode { min-height: 40px; font-size: 12px; padding: 6px 2px; }
  .btn-mode-orient { font-size: 10px; }
  .toggle-btn { height: 32px; font-size: 13px; }
}

@media print {
  .jt-page {
    padding: 0 !important;
    margin: 0 !important;
    min-height: unset !important;
    height: auto !important;
    display: block !important;
    background: white !important;
  }
  .jt-page :deep(.header), .jt-page :deep(.top-layout), .jt-page :deep(.toolbar), .jt-page :deep(.footer), .jt-page :deep(.print-dialog), .jt-page :deep(.help-dialog), .jt-page :deep(.browser-warning), .jt-page :deep(.preview-landmark-title) { display: none !important; }
  .jt-page :deep(.main-card) {
    padding: 0 !important;
    margin: 0 !important;
    border: none !important;
    box-shadow: none !important;
    background: none !important;
    width: 100% !important;
    max-width: none !important;
    min-height: unset !important;
    height: auto !important;
    display: block !important;
  }
  .jt-page :deep(#previewGrid) {
    display: block !important;
    margin: 0 !important;
    padding: 0 !important;
    width: 100% !important;
    gap: 0 !important;
  }
  .jt-page :deep(.preview-page) {
    margin: 0 auto !important;
    padding: 0 !important;
    border: none !important;
    box-shadow: none !important;
    transform: none !important;
    page-break-inside: avoid !important;
    break-inside: avoid !important;
    overflow: hidden !important;
  }
  .jt-page :deep(.preview-page:not(:last-child)) { page-break-after: always !important; }
  .jt-page :deep(.preview-page:last-child) { page-break-after: avoid !important; }
  .jt-page.mode-6 :deep(.preview-page), .jt-page.mode-9 :deep(.preview-page) { width: 210mm !important; height: 297mm !important; }
  .jt-page.mode-12 :deep(.preview-page) { width: 297mm !important; height: 210mm !important; }
  .jt-page :deep(.cut-line) { position: absolute !important; pointer-events: none !important; }
  .jt-page :deep(.slot) {
    position: absolute !important;
    display: flex !important;
    align-items: flex-start !important;
    justify-content: center !important;
    box-sizing: border-box !important;
    overflow: hidden !important;
    background: white !important;
  }
  .jt-page :deep(.slot img) {
    width: 100% !important;
    height: auto !important;
    object-fit: cover !important;
    object-position: top center !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
}
</style>
