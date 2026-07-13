<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useToast } from '@/composables/useToast'
import { usePrintWithIframe } from '@/composables/usePrintWithIframe'
import { scheduleScrollToPreview } from '@/composables/useScrollPreviewIntoView'
import { FP_CONFIG } from '@/constants/fp'
import { PDF_WORKER_FILENAME } from '@/pdf-worker-asset'
import * as pdfjsLib from 'pdfjs-dist'

const router = useRouter()
const { showToast } = useToast()
const { print: printWithIframe } = usePrintWithIframe()

const CONFIG = FP_CONFIG
const MANY_FILES_THRESHOLD = 20
const APP_VERSION = __APP_VERSION__

const invoiceFiles = ref<string[]>([])
const originalFiles = ref<File[]>([])
const currentMode = ref<2 | 4>(4)
const currentMargin = ref<number>(CONFIG.DEFAULT_MARGIN)
const showLines = ref(true)
const isProcessing = ref(false)
const showBrowserWarning = ref(false)
const showPrintDialog = ref(false)
const showHelpDialog = ref(false)
const progressPercent = ref(0)
const progressText = ref('')
const showProgress = ref(false)
const dropZoneVisible = ref(true)
const fileInput = ref<HTMLInputElement | null>(null)
const failedFileNames = ref<string[]>([])

const fileCount = computed(() => originalFiles.value.length)
const hasFiles = computed(() => invoiceFiles.value.length > 0)
const printModeText = computed(() => currentMode.value === 2 ? '1页2张(纵向)' : '1页4张(横向)')
const printOrientationText = computed(() => currentMode.value === 2 ? '纵向' : '横向')
const bodyModeClass = computed(() => `mode-${currentMode.value}`)
const layoutSummaryText = computed(() => {
  const n = invoiceFiles.value.length
  if (n === 0) return '暂无发票'
  const perPage = currentMode.value === 2 ? 2 : 4
  const pages = Math.ceil(n / perPage)
  return `已加载 ${n} 张 · 约 ${pages} 页`
})

let pdfWorkerInited = false
function initPdfWorker() {
  if (pdfWorkerInited) return
  pdfWorkerInited = true
  const base = (import.meta as any).env?.BASE_URL || './'
  pdfjsLib.GlobalWorkerOptions.workerSrc = base + PDF_WORKER_FILENAME
}

function checkBrowserCompatibility() {
  const missing = []
  if (!window.File) missing.push('File API')
  if (!window.FileReader) missing.push('FileReader API')
  if (!window.Promise) missing.push('Promise API')
  if (!window.fetch) missing.push('Fetch API')
  if (missing.length > 0) {
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
function openJietu() { router.push('/jt') }

function removeFile(index: number) {
  originalFiles.value.splice(index, 1)
  invoiceFiles.value.splice(index, 1)
  if (originalFiles.value.length === 0) {
    resetApp()
    return
  }
  renderPreview()
  showToast(`已移除，剩余 ${invoiceFiles.value.length} 张`, 'info')
}

async function handleFiles(files: FileList | null) {
  if (!files?.length || isProcessing.value) {
    if (isProcessing.value) showToast('正在处理文件中，请稍候...', 'warning')
    return
  }
  const pdfFiles = Array.from(files).filter((f) => f.type === 'application/pdf')
  if (!pdfFiles.length) {
    showToast('请选择PDF文件！', 'warning')
    return
  }

  const newFiles: File[] = []
  const duplicateNames: string[] = []
  for (const f of pdfFiles) {
    const exists = originalFiles.value.some(
      (e) => e.name === f.name && e.size === f.size && e.lastModified === f.lastModified
    )
    if (exists) duplicateNames.push(f.name)
    else newFiles.push(f)
  }
  if (duplicateNames.length) {
    showToast(duplicateNames.length === 1 ? `已跳过重复：${duplicateNames[0]}` : `已跳过 ${duplicateNames.length} 个重复文件`, 'info', 4000)
  }
  if (!newFiles.length) return

  const totalAfter = originalFiles.value.length + newFiles.length
  if (totalAfter > CONFIG.MAX_FILES) {
    const canAdd = CONFIG.MAX_FILES - originalFiles.value.length
    showToast(`最多 ${CONFIG.MAX_FILES} 个文件，本次只能再添加 ${canAdd} 个`, 'warning', 5000)
    newFiles.splice(canAdd)
    if (!newFiles.length) return
  }

  isProcessing.value = true
  dropZoneVisible.value = false
  showProgress.value = true
  initPdfWorker()

  const base = (import.meta as any).env?.BASE_URL || './'
  const cMapUrl = base + 'cmaps/'
  const standardFontDataUrl = base + 'standard_fonts/'
  let successCount = 0
  const failedNames: string[] = []

  for (let i = 0; i < newFiles.length; i++) {
    const file = newFiles[i]
    progressText.value = `解析中 ${i + 1} / ${newFiles.length}`
    progressPercent.value = Math.round(((i + 1) / newFiles.length) * 100)
    try {
      const data = await file.arrayBuffer()
      const pdf = await pdfjsLib.getDocument({
        data,
        cMapUrl,
        cMapPacked: true,
        standardFontDataUrl,
      }).promise
      const page = await pdf.getPage(1)
      const viewport = page.getViewport({ scale: CONFIG.PDF_RENDER_SCALE })
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('无法获取 canvas 上下文')
      canvas.height = viewport.height
      canvas.width = viewport.width
      await page.render({ canvasContext: ctx, viewport }).promise
      const imageData = canvas.toDataURL('image/jpeg', CONFIG.IMAGE_QUALITY)
      originalFiles.value.push(file)
      invoiceFiles.value.push(imageData)
      successCount++
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ;(canvas as any).width = 0
      ;(canvas as any).height = 0
    } catch (e) {
      console.error(file.name, e)
      failedNames.push(file.name)
    }
  }

  isProcessing.value = false
  showProgress.value = false
  failedFileNames.value = failedNames
  if (successCount) {
    renderPreview()
    showToast(`成功加载 ${successCount} 个文件`, 'success')
    scheduleScrollToPreview(previewSectionRef)
  }
  if (failedNames.length) {
    showToast(failedNames.length === 1 ? `处理失败：${failedNames[0]}` : `${failedNames.length} 个文件处理失败`, 'error', 5000)
  }
}

function triggerFileSelect() { fileInput.value?.click() }

function updateMargin(val: number) {
  currentMargin.value = val
  renderPreview()
}

function bumpMargin(delta: number) {
  const next = Math.min(10, Math.max(0, currentMargin.value + delta))
  if (next !== currentMargin.value) updateMargin(next)
}

function setMode(mode: 2 | 4) {
  if (currentMode.value === mode) return
  currentMode.value = mode
  renderPreview()
}

function toggleLines() {
  showLines.value = !showLines.value
  renderPreview()
}

const previewSectionRef = ref<HTMLElement | null>(null)
const previewGridRef = ref<HTMLElement | null>(null)

function renderPreview() {
  const grid = previewGridRef.value
  if (!grid) return
  grid.innerHTML = ''
  const files = invoiceFiles.value
  const mode = currentMode.value
  if (!files.length) return

  const totalPages = Math.ceil(files.length / mode)
  const pageClass = mode === 2 ? 'v-page' : 'h-page'
  const linesClass = showLines.value ? 'show-lines' : ''

  for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
    const pageDiv = document.createElement('div')
    pageDiv.className = `preview-page ${pageClass} ${linesClass}`
    pageDiv.innerHTML = '<div class="line-h"></div><div class="line-v"></div>'

    for (let slotIndex = 0; slotIndex < mode; slotIndex++) {
      const fileIndex = pageIndex * mode + slotIndex
      if (fileIndex >= files.length) break
      const slot = document.createElement('div')
      slot.className = 'slot'
      const margin = currentMargin.value
      slot.style.padding = `${margin}mm`
      if (mode === 2) {
        slot.style.width = '100%'
        slot.style.height = '50%'
        slot.style.top = slotIndex === 0 ? '0' : '50%'
        slot.style.left = '0'
      } else {
        slot.style.width = '50%'
        slot.style.height = '50%'
        slot.style.top = slotIndex < 2 ? '0' : '50%'
        slot.style.left = slotIndex % 2 === 0 ? '0' : '50%'
      }
      const img = document.createElement('img')
      img.src = files[fileIndex]
      img.alt = `发票 ${fileIndex + 1}`
      slot.appendChild(img)
      pageDiv.appendChild(slot)
    }
    grid.appendChild(pageDiv)
  }
}

async function exportPdf() {
  if (!invoiceFiles.value.length) return
  if (invoiceFiles.value.length >= MANY_FILES_THRESHOLD) {
    showToast('文件较多，正在生成 PDF，请稍候…', 'info', 2000)
  }
  try {
    const { loadJsPDF } = await import('@/lib/loadJsPDF')
    const JsPDF = await loadJsPDF()
    const orientation = currentMode.value === 2 ? 'portrait' : 'landscape'
    const doc = new JsPDF({ orientation, unit: 'mm', format: 'a4' })
    const margin = currentMargin.value
    const mode = currentMode.value

    for (let i = 0; i < invoiceFiles.value.length; i++) {
      if (i > 0 && i % mode === 0) doc.addPage()
      const slotIndex = i % mode
      let x: number, y: number, slotWidth: number, slotHeight: number
      if (mode === 2) {
        slotWidth = 210
        slotHeight = 148.5
        x = 0
        y = slotIndex === 0 ? 0 : 148.5
      } else {
        slotWidth = 148.5
        slotHeight = 105
        x = slotIndex === 1 || slotIndex === 3 ? 148.5 : 0
        y = slotIndex < 2 ? 0 : 105
      }
      doc.addImage(
        invoiceFiles.value[i],
        'JPEG',
        x + margin,
        y + margin,
        slotWidth - margin * 2,
        slotHeight - margin * 2
      )
      if (showLines.value && slotIndex === mode - 1) {
        doc.setDrawColor(120)
        doc.setLineWidth(0.1)
        doc.setLineDashPattern([2, 2], 0)
        if (mode === 2) doc.line(0, 148.5, 210, 148.5)
        else {
          doc.line(0, 105, 297, 105)
          doc.line(148.5, 0, 148.5, 210)
        }
        doc.setLineDashPattern([], 0)
      }
    }
    const now = new Date()
    const ts = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`
    doc.save(`发票_${ts}.pdf`)
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
  if (invoiceFiles.value.length >= MANY_FILES_THRESHOLD) {
    showToast('文件较多，准备打印中，请稍候…', 'info', 1500)
  }
  const orientation = currentMode.value === 2 ? 'portrait' : 'landscape'
  const printCss = `
    @page { margin: 0; size: A4 ${orientation}; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { margin: 0; padding: 0; background: white; }
    #previewGrid { display: block; margin: 0; padding: 0; }
    .preview-page { margin: 0 auto; padding: 0; border: none; box-shadow: none; position: relative; overflow: hidden; page-break-after: always; break-inside: avoid; }
    .preview-page:last-child { page-break-after: avoid; }
    .v-page { width: 210mm; height: 297mm; }
    .h-page { width: 297mm; height: 210mm; }
    .slot { position: absolute; display: flex; align-items: center; justify-content: center; box-sizing: border-box; }
    .slot img { width: 100%; height: 100%; object-fit: contain; display: block; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .line-h, .line-v { position: absolute; pointer-events: none; z-index: 10; border: none; display: none; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .line-h { border-top: 1px dashed #e67e22; top: 50%; left: 0; width: 100%; }
    .line-v { border-left: 1px dashed #e67e22; left: 50%; top: 0; height: 100%; }
    .preview-page.show-lines .line-h { display: block !important; visibility: visible !important; }
    .preview-page.show-lines.h-page .line-v { display: block !important; visibility: visible !important; }
    .preview-page.show-lines.v-page .line-h { display: block !important; visibility: visible !important; }
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
  invoiceFiles.value = []
  originalFiles.value = []
  failedFileNames.value = []
  currentMargin.value = CONFIG.DEFAULT_MARGIN
  showLines.value = true
  isProcessing.value = false
  dropZoneVisible.value = true
  showPrintDialog.value = false
  if (fileInput.value) fileInput.value.value = ''
  currentMode.value = 4
  renderPreview()
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
  <div class="fp-page" :class="bodyModeClass">
    <div v-if="showBrowserWarning" class="browser-warning">
      <div class="browser-warning-content">
        <div>⚠️ 您的浏览器可能不完全支持所有功能，建议使用 Chrome、Edge 或 Firefox 最新版本</div>
        <button type="button" class="browser-warning-close" @click="closeBrowserWarning">×</button>
      </div>
    </div>

    <div v-if="showPrintDialog" class="print-dialog" role="dialog" aria-modal="true" aria-labelledby="fp-print-dialog-title" @click.self="hidePrintDialog">
      <div class="print-dialog-content">
        <h3 id="fp-print-dialog-title">🖨️ 打印设置提示</h3>
        <p>当前布局模式：<strong>{{ printModeText }}</strong></p>
        <p>请在稍后的打印设置中确认：</p>
        <p>1. <strong>纸张方向</strong>：<strong>{{ printOrientationText }}</strong></p>
        <p>2. <strong>纸张大小</strong>：<strong>A4</strong></p>
        <p>3. <strong>页边距</strong>：<strong>无</strong> 或 <strong>最小</strong></p>
        <p class="print-tip">💡 大多数浏览器会自动检测方向，建议手动确认</p>
        <div class="print-dialog-buttons">
          <button type="button" class="print-dialog-btn print-dialog-confirm" @click="doPrint">确认设置并打印</button>
          <button type="button" class="print-dialog-btn print-dialog-cancel" @click="hidePrintDialog">取消打印</button>
        </div>
      </div>
    </div>

    <div v-if="showHelpDialog" class="help-dialog" role="dialog" aria-modal="true" aria-labelledby="fp-help-dialog-title" @click.self="closeHelp">
      <div class="help-dialog-content">
        <button type="button" class="help-close" aria-label="关闭使用说明" @click="closeHelp">×</button>
        <h2 id="fp-help-dialog-title">📚 使用说明</h2>
        <div class="help-section">
          <h3>📋 工具简介</h3>
          <p>电子发票批量打印助手支持将多张 PDF 电子发票智能排版到 A4 纸上，实现高效、规范的批量打印。</p>
        </div>
        <div class="help-section">
          <h3>🚀 快速开始</h3>
          <p><strong>1. 加载发票</strong>：将 PDF 拖入虚线区域或点击“点击加载”，支持多选；“+ 继续添加”可补充更多。</p>
          <p><strong>2. 选择布局</strong>：1页2张(纵向) 或 1页4张(横向)。</p>
          <p><strong>3. 调整</strong>：裁剪线、边距。</p>
          <p><strong>4. 导出/打印</strong>：导出 PDF 或立即打印。</p>
        </div>
        <div class="help-section">
          <h3>⚠️ 重要</h3>
          <p>仅支持 <strong>PDF</strong> 格式；建议单次不超过 <strong>50</strong> 个文件；推荐 Chrome、Edge、Firefox。</p>
        </div>
        <div class="help-tip"><strong>💡</strong> 本工具在浏览器本地运行，不上传、不存储您的文件。</div>
        <div class="help-section">
          <h3>📞 支持</h3>
          <p>💬 <a href="https://ly.topmer.top" target="_blank" rel="noopener noreferrer">给我留言</a></p>
        </div>
      </div>
    </div>

    <div class="main-card">
      <div class="header">
        <h1>电子发票批量打印助手</h1>
        <div class="header-actions" role="toolbar" aria-label="页面操作">
          <button type="button" class="home-btn" title="返回主页" @click="goHome">🏠</button>
          <button type="button" class="invoice-btn" title="手机截图打印" @click="openJietu">🖼️</button>
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
            aria-label="将 PDF 电子发票拖入此处或点击加载"
            @click="onDropZoneClick"
            @dragover.prevent
            @dragleave.prevent
            @drop.prevent="handleFiles(($event as DragEvent).dataTransfer?.files ?? null)"
          >
            <div class="upload-icon">📤</div>
            <div class="upload-text">将 PDF 电子发票拖入此处</div>
            <div class="upload-subtext">或 <span>点击加载</span> (支持多选)</div>
            <div class="upload-limit">✨ 仅支持 PDF 格式，每次最多 50 张 ✨</div>
            <input ref="fileInput" type="file" accept="application/pdf" multiple hidden @change="onFileChange" />
          </div>

          <div v-show="!dropZoneVisible" class="drop-zone feedback-area">
            <div class="file-list-container">
              <div class="file-list-header">
                <span>📄 已加载文件 ({{ fileCount }})</span>
                <button type="button" class="btn-add-more" aria-label="继续添加更多 PDF 文件" @click="triggerFileSelect">+ 继续添加</button>
              </div>
              <div class="file-list-scroll">
                <div class="file-list">
                  <div
                    v-for="(file, index) in originalFiles"
                    :key="index"
                    class="file-item"
                    :title="file.name"
                  >
                    <div class="file-index">{{ index + 1 }}.</div>
                    <div class="file-name" :title="file.name">
                      {{ file.name.length > 25 ? file.name.slice(0, 22) + '...' : file.name }}
                    </div>
                    <div class="file-status">✓ 已加载</div>
                    <button type="button" class="file-remove-btn" title="移除此文件" aria-label="移除此文件" @click="removeFile(index)">×</button>
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
              <button type="button" :class="['toggle-btn', showLines ? 'btn-on' : 'btn-off']" @click="toggleLines">
                {{ showLines ? '已开启' : '已关闭' }}
              </button>
            </div>
          </div>
          <div class="setting-unit setting-margin">
            <div id="fp-margin-heading" class="unit-header">📏 边距：<b>{{ currentMargin }}</b>mm</div>
            <div class="margin-row" role="group" aria-labelledby="fp-margin-heading">
              <button type="button" class="margin-nudge" aria-label="边距减少 1 毫米" :disabled="currentMargin <= 0" @click="bumpMargin(-1)">−</button>
              <input
                :value="currentMargin"
                class="margin-range-input"
                type="range"
                min="0"
                max="10"
                step="1"
                :aria-valuemin="0"
                :aria-valuemax="10"
                :aria-valuenow="currentMargin"
                :aria-valuetext="`${currentMargin} 毫米`"
                aria-labelledby="fp-margin-heading"
                @input="updateMargin(Number(($event.target as HTMLInputElement).value))"
              />
              <button type="button" class="margin-nudge" aria-label="边距增加 1 毫米" :disabled="currentMargin >= 10" @click="bumpMargin(1)">+</button>
            </div>
          </div>
          <div class="setting-unit unit-full">
            <div class="unit-header">🧩 布局选择</div>
            <div class="mode-group">
              <button type="button" :class="['btn-mode', { active: currentMode === 2 }]" @click="setMode(2)">
                <span class="btn-mode-inner">
                  <span class="btn-mode-main">1页2张</span><span class="btn-mode-orient">(纵向)</span>
                </span>
              </button>
              <button type="button" :class="['btn-mode', { active: currentMode === 4 }]" @click="setMode(4)">
                <span class="btn-mode-inner">
                  <span class="btn-mode-main">1页4张</span><span class="btn-mode-orient">(横向)</span>
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
        aria-labelledby="fp-preview-title"
      >
        <h2 id="fp-preview-title" class="preview-landmark-title">排版预览</h2>
        <div ref="previewGridRef" id="previewGrid" class="preview-grid" />
      </section>
    </div>

    <div class="footer">
      Copyright © {{ new Date().getFullYear() }}
      <a href="https://topmer.top" target="_blank" rel="noopener">Topmer</a>
      | v{{ APP_VERSION }} | 💬 <a href="https://ly.topmer.top" target="_blank" rel="noopener">给我留言</a>
    </div>
  </div>
</template>

<style scoped>
.fp-page {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  /* fp 页面专属呼吸渐变（更浅 + 去紫），避免与 jt 页面颜色完全一致 */
  /* 更柔和的浅色系：低饱和，避免青色过艳；同时与 jt 保持观感差异 */
  --fp-gradient-start:rgb(115, 142, 170);
  --fp-gradient-mid1:rgb(72, 96, 115);
  --fp-gradient-mid2:rgb(85, 136, 113);
  --fp-gradient-mid3:rgb(190, 160, 133);
  --fp-gradient-end: #6f90a5;

  background: linear-gradient(-45deg, var(--fp-gradient-start), var(--fp-gradient-mid1), var(--fp-gradient-mid2), var(--fp-gradient-mid3), var(--fp-gradient-end));
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
  .fp-page {
    animation: none;
    background-position: 50% 50%;
    background-attachment: scroll;
  }
}

.main-card {
  width: 100%;
  max-width: 1050px;
  background: rgba(235, 230, 230, 0.75);
  backdrop-filter: blur(15px);
  border-radius: var(--border-radius-large);
  padding: 40px;
  box-shadow: 0 25px 50px rgba(0,0,0,0.2);
}
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
  transition: all 0.2s ease;
}
.home-btn:hover, .invoice-btn:hover, .help-btn:hover {
  background: rgba(255,255,255,0.5);
  transform: translateY(-1px);
}

.top-layout { display: flex; gap: 12px; margin-bottom: 12px; align-items: stretch; }
.drop-zone-container { flex: 1.2; display: flex; flex-direction: column; gap: 12px; }
.drop-zone {
  flex: 1;
  border: 0.5px dashed var(--color-primary);
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 25px;
  cursor: pointer;
  background: rgba(255,255,255,0.5);
  box-shadow: 0 4px 12px rgba(0,0,0,0.2);
  transition: all 0.1s ease;
}
.drop-zone:hover { background: rgba(255,255,255,0.5); transform: translateY(-2px); }
.upload-icon { font-size: 40px; color: var(--color-primary); margin-bottom: 10px; }
.upload-text { font-size: 18px; font-weight: 600; color: var(--color-dark-gray); margin-bottom: 8px; }
.upload-subtext { font-size: 14px; color: #576574; }
.upload-subtext span { color: #b97980; text-decoration: underline; }
.upload-limit { font-size: 12px; color: #576574; margin-top: 12px; }

.feedback-area { text-align: center; }
.reset-hint { color: var(--color-warning); font-size: 14px; font-weight: 500; margin-top: 4px; }
.failed-files { font-size: 12px; color: var(--color-error, #c0392b); margin-top: 6px; padding: 4px 0; word-break: break-all; }
.file-list-container { width: 100%; margin: 8px 0; }
.file-list-header { display: flex; justify-content: space-between; align-items: center; font-size: 13px; font-weight: 600; color: var(--color-dark-gray); margin-bottom: 6px; padding-bottom: 4px; border-bottom: 1px solid rgba(0,0,0,0.1); }
.btn-add-more { background: var(--color-warning); color: white; border: none; border-radius: 6px; padding: 5px 12px; font-size: 12px; font-weight: 600; cursor: pointer; }
.btn-add-more:hover { background: #d4731a; }
.file-list-scroll { max-height: 180px; overflow-y: auto; overflow-x: hidden; border: 1px solid rgba(74,109,124,0.2); border-radius: 6px; background: rgba(255,255,255,0.3); padding: 4px; }
.file-list { font-size: 12px; }
.file-item { position: relative; display: flex; align-items: center; justify-content: space-between; padding: 2px 30px 2px 4px; margin: 1px 0; background: rgba(255,255,255,0.5); border-radius: 4px; min-height: 20px; }
.file-index { font-size: 10px; color: var(--color-primary); font-weight: 600; padding-right: 8px; min-width: 28px; }
.file-name { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding-right: 8px; font-size: 10px; max-width: 180px; text-align: center; }
.file-status { font-size: 9px; padding: 1px 4px; border-radius: 8px; background: var(--color-success); color: white; white-space: nowrap; }
.file-remove-btn { position: absolute; right: 6px; top: 50%; transform: translateY(-50%); width: 18px; height: 18px; background: rgba(74,109,124,0.2); border: none; border-radius: 50%; color: var(--color-primary); font-size: 14px; line-height: 18px; cursor: pointer; }
.file-remove-btn:hover { background: var(--color-warning); color: white; }

.progress-wrapper { position: relative; height: 24px; background: rgba(0,0,0,0.1); border-radius: 12px; overflow: hidden; }
.progress-bar { height: 100%; width: 0%; background: linear-gradient(90deg, #77b282, #429852, #0c7820); transition: width 0.8s ease; }
.progress-text { position: absolute; width: 100%; height: 100%; top: 0; left: 0; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 500; color: #fff; pointer-events: none; }

.settings-panel { flex: 1; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; }
/* 桌面/平板：子项仍参与外层 grid；手机单列时由内部两列并排「本次排版 + 裁剪线」 */
.settings-tip-cut-row { display: contents; }
.setting-unit { background: rgba(170,180,180,0.75); border-radius: 12px; padding: 15px; display: flex; flex-direction: column; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(0,0,0,0.2); }
.setting-tip .layout-summary { font-size: 15px; font-weight: 600; color: var(--color-primary); }
.unit-full { grid-column: span 3; }
.unit-header { font-size: 14px; font-weight: 600; color: var(--color-dark-gray); margin-bottom: 8px; }
.toggle-btn { width: 70%; height: 35px; border-radius: 12px; border: none; font-weight: 600; cursor: pointer; transition: all 0.1s ease; }
.btn-on { background: var(--color-success); color: white; }
.btn-off { background: var(--color-light-gray); color: var(--color-medium-gray); }
.margin-row { display: flex; align-items: center; gap: 8px; width: 100%; max-width: 100%; }
.margin-nudge {
  display: none;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  padding: 0;
  border-radius: 10px;
  border: 1px solid rgba(74,109,124,0.35);
  background: rgba(255,255,255,0.5);
  font-size: 20px;
  font-weight: 600;
  line-height: 1;
  color: var(--color-dark-gray);
  cursor: pointer;
}
.margin-nudge:disabled { opacity: 0.35; cursor: not-allowed; }
.margin-range-input { flex: 1; min-width: 0; width: 100%; cursor: pointer; accent-color: #0066b2; }

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
.mode-group { display: flex; gap: 20px; width: 90%; }
.btn-mode {
  flex: 1;
  height: 38px;
  border-radius: 12px;
  border: 1px solid var(--color-light-gray);
  background: var(--color-light-gray);
  color: var(--color-primary);
  font-weight: 600;
  cursor: pointer;
  transition: all 0.1s ease;
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
.btn-large { flex: 1; height: 52px; border-radius: 12px; border: none; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px; color: white; transition: all 0.1s ease; }
.btn-large:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 5px 15px rgba(0,0,0,0.2); }
.btn-pdf { background: #94a3b8; }
.btn-print { background: var(--color-secondary); }
.btn-reset { background: white; color: var(--color-medium-gray); border: 1px solid var(--color-light-gray); }
.btn-reset:hover { background: #f8fafc; border-color: #94a3b8; }
.btn-large:disabled { opacity: 0.3; cursor: not-allowed; transform: none !important; box-shadow: none !important; }

/* 预览区域：内部由 JS 动态插入，必须用 :deep() 才能生效 */
.preview-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 10px; margin-top: 0; }
.preview-grid :deep(.preview-page) { background: white; position: relative; box-shadow: 0 15px 35px rgba(0,0,0,0.2); margin: 0 auto; overflow: hidden; transition: transform 0.1s ease; }
.preview-grid :deep(.preview-page:hover) { transform: translateY(-5px); box-shadow: 0 20px 40px rgba(0,0,0,0.2); }
.preview-grid :deep(.v-page) { aspect-ratio: 210/297; width: 100%; }
.preview-grid :deep(.h-page) { aspect-ratio: 297/210; width: 100%; }
.preview-grid :deep(.line-h),
.preview-grid :deep(.line-v) { position: absolute; pointer-events: none; z-index: 10; display: none; border: none; }
.preview-grid :deep(.line-h) { border-top: 0.5px dashed var(--color-warning); top: 50%; left: 0; width: 100%; }
.preview-grid :deep(.line-v) { border-left: 0.5px dashed var(--color-warning); left: 50%; top: 0; height: 100%; }
.preview-grid :deep(.show-lines .line-h) { display: block; }
.preview-grid :deep(.show-lines.h-page .line-v) { display: block; }
.preview-grid :deep(.slot) { position: absolute; display: flex; align-items: center; justify-content: center; box-sizing: border-box; }
.preview-grid :deep(.slot img) { width: 100%; height: 100%; object-fit: contain; display: block; }

.browser-warning { position: fixed; top: 0; left: 0; width: 100%; background: #ffcc00; color: #333; padding: 10px 15px; text-align: center; font-size: 14px; font-weight: 500; z-index: 9999; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
.browser-warning-content { max-width: 1050px; margin: 0 auto; display: flex; justify-content: space-between; align-items: center; }
.browser-warning-close { background: none; border: none; font-size: 20px; cursor: pointer; color: #333; padding: 0 10px; }

.print-dialog { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); display: flex; justify-content: center; align-items: center; z-index: 1000; }
.print-dialog-content { background: white; padding: 30px; border-radius: 12px; max-width: 500px; width: 90%; box-shadow: 0 10px 30px rgba(0,0,0,0.3); }
.print-dialog h3 { color: var(--color-dark-gray); margin-bottom: 15px; font-size: 20px; text-align: center; }
.print-dialog p { color: #576574; margin-bottom: 10px; line-height: 1.5; }
.print-dialog strong { color: var(--color-warning); }
.print-dialog-buttons { display: flex; gap: 15px; margin-top: 25px; }
.print-dialog-btn { flex: 1; padding: 12px; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; transition: all 0.2s ease; }
.print-dialog-confirm { background: var(--color-secondary); color: white; }
.print-dialog-confirm:hover { background: #0d5d49; }
.print-dialog-cancel { background: #f1f5f9; color: var(--color-medium-gray); border: 1px solid var(--color-light-gray); }
.print-dialog-cancel:hover { background: #e2e8f0; }
.print-tip { margin-top: 10px; font-size: 13px; color: #94a3b8; font-style: italic; }

.help-dialog { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); display: flex; justify-content: center; align-items: center; z-index: 1001; }
.help-dialog-content { background: white; padding: 30px; border-radius: 12px; max-width: 700px; width: 90%; max-height: 80vh; overflow-y: auto; box-shadow: 0 10px 30px rgba(0,0,0,0.3); position: relative; }
.help-close { position: absolute; top: 15px; right: 15px; background: none; border: none; font-size: 28px; cursor: pointer; color: var(--color-medium-gray); width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
.help-close:hover { background: #f1f5f9; color: var(--color-dark-gray); }
.help-dialog h2 { color: var(--color-dark-gray); margin-bottom: 20px; font-size: 24px; text-align: center; padding-right: 30px; }
.help-section { margin-bottom: 20px; }
.help-section h3 { color: var(--color-secondary); font-size: 18px; margin-bottom: 8px; }
.help-section p { color: #576574; line-height: 1.6; margin-bottom: 8px; padding-left: 28px; }
.help-tip { background: rgba(20,122,97,0.1); border-left: 3px solid var(--color-secondary); padding: 10px 15px; margin: 15px 0; border-radius: 0 6px 6px 0; font-size: 14px; }

.footer { width: 100%; max-width: 1050px; text-align: center; padding: 15px 0; color: var(--color-medium-gray); font-size: 14px; margin-top: 20px; }
.footer a { color: var(--color-secondary); text-decoration: none; font-weight: 600; }
.footer a:hover { color: #0d5d49; text-decoration: underline; }

@media (max-width: 768px) {
  .fp-page { padding: max(12px, env(safe-area-inset-top)) max(12px, env(safe-area-inset-right)) max(20px, env(safe-area-inset-bottom)) max(12px, env(safe-area-inset-left)); }
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
  .settings-panel { grid-template-columns: 1fr 1fr; gap: 6px; }
  .unit-full { grid-column: span 2; }
  .setting-unit { padding: 10px 8px; border-radius: 10px; }
  .unit-header { font-size: 12px; margin-bottom: 4px; }
  .margin-nudge { display: inline-flex; min-width: 44px; min-height: 44px; }
  .margin-range-input { min-height: 44px; }
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
  .mode-group { flex-direction: row; flex-wrap: nowrap; width: 100%; gap: 8px; }
  .btn-mode {
    min-width: 0;
    padding: 6px 4px;
    height: auto;
    min-height: 44px;
    font-size: 12px;
  }
  .btn-mode-inner {
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
  }
  .btn-mode-orient { font-size: 11px; font-weight: 600; opacity: 0.95; }
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
  .file-name { max-width: 120px; }
  .print-dialog-content, .help-dialog-content { padding: 20px 16px; margin: 16px; max-height: calc(100vh - 32px); }
  .help-section p { padding-left: 12px; }
  .footer { font-size: 12px; padding: 12px 8px; }
}
@media (max-width: 480px) {
  .fp-page { padding: max(8px, env(safe-area-inset-top)) max(8px, env(safe-area-inset-right)) max(16px, env(safe-area-inset-bottom)) max(8px, env(safe-area-inset-left)); }
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
  .setting-unit { padding: 8px 8px; border-radius: 10px; }
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
  .btn-mode { min-height: 40px; font-size: 12px; padding: 6px 4px; }
  .btn-mode-orient { font-size: 11px; }
  .toggle-btn { height: 32px; font-size: 13px; }
}

@media print {
  .fp-page {
    padding: 0 !important;
    margin: 0 !important;
    min-height: unset !important;
    height: auto !important;
    display: block !important;
    background: white !important;
  }
  .fp-page :deep(.header), .fp-page :deep(.top-layout), .fp-page :deep(.toolbar), .fp-page :deep(.footer), .fp-page :deep(.print-dialog), .fp-page :deep(.help-dialog), .fp-page :deep(.browser-warning), .fp-page :deep(.preview-landmark-title) { display: none !important; }
  .fp-page :deep(.main-card) {
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
  .fp-page :deep(#previewGrid) {
    display: block !important;
    margin: 0 !important;
    padding: 0 !important;
    width: 100% !important;
    gap: 0 !important;
  }
  .fp-page :deep(.preview-page) {
    margin: 0 auto !important;
    padding: 0 !important;
    border: none !important;
    box-shadow: none !important;
    transform: none !important;
    page-break-inside: avoid !important;
    break-inside: avoid !important;
    overflow: hidden !important;
  }
  .fp-page :deep(.preview-page:not(:last-child)) { page-break-after: always !important; }
  .fp-page :deep(.preview-page:last-child) { page-break-after: avoid !important; }
  .fp-page.mode-2 :deep(.preview-page) { width: 210mm !important; height: 297mm !important; }
  .fp-page.mode-4 :deep(.preview-page) { width: 297mm !important; height: 210mm !important; }
  .fp-page :deep(.slot) { position: absolute !important; box-sizing: border-box !important; }
  .fp-page :deep(.slot img) { width: 100% !important; height: 100% !important; object-fit: contain !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
}
</style>
