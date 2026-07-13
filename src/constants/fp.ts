/** 发票打印页配置 */
export const FP_CONFIG = {
  /** PDF 转图渲染倍率，越大越清晰（预览/导出/打印共用） */
  PDF_RENDER_SCALE: 2.8,
  /** 转 JPEG 质量 0–1，用于预览/导出/打印 */
  IMAGE_QUALITY: 0.9,
  DEFAULT_MARGIN: 2,
  MAX_FILES: 50,
} as const
