/** 手机截图打印页配置 */
export const JT_CONFIG = {
  /** 导出 PDF 时裁剪后转 JPEG 的质量 0–1 */
  IMAGE_QUALITY: 0.92,
  MARGIN_MM: 4.3,
  SPACING_MM: 4.3,
  MAX_FILES: 50,
} as const

export interface LayoutResult {
  mode: number
  columns: number
  rows: number
  photosPerPage: number
  slotWidth: number
  slotHeight: number
  orientation: 'portrait' | 'landscape'
  pageWidth: number
  pageHeight: number
  margin: number
  spacing: number
}

const A4_W = 210
const A4_H = 297

export function calculateLayout(mode: number): LayoutResult {
  const margin = JT_CONFIG.MARGIN_MM
  const spacing = JT_CONFIG.SPACING_MM
  if (mode === 6) {
    const columns = 3
    const rows = 2
    const contentW = A4_W - margin * 2
    const contentH = A4_H - margin * 2
    const slotW = (contentW - spacing * (columns - 1)) / columns
    const slotH = (contentH - spacing * (rows - 1)) / rows
    return { mode: 6, columns, rows, photosPerPage: 6, slotWidth: slotW, slotHeight: slotH, orientation: 'portrait', pageWidth: A4_W, pageHeight: A4_H, margin, spacing }
  }
  if (mode === 9) {
    const columns = 3
    const rows = 3
    const contentW = A4_W - margin * 2
    const contentH = A4_H - margin * 2
    const slotW = (contentW - spacing * (columns - 1)) / columns
    const slotH = (contentH - spacing * (rows - 1)) / rows
    return { mode: 9, columns, rows, photosPerPage: 9, slotWidth: slotW, slotHeight: slotH, orientation: 'portrait', pageWidth: A4_W, pageHeight: A4_H, margin, spacing }
  }
  const columns = 6
  const rows = 2
  const pageWidth = A4_H
  const pageHeight = A4_W
  const contentW = pageWidth - margin * 2
  const contentH = pageHeight - margin * 2
  const slotW = (contentW - spacing * (columns - 1)) / columns
  const slotH = (contentH - spacing * (rows - 1)) / rows
  return { mode: 12, columns, rows, photosPerPage: 12, slotWidth: slotW, slotHeight: slotH, orientation: 'landscape', pageWidth, pageHeight, margin, spacing }
}
