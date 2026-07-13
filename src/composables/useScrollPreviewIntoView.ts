import { nextTick, type Ref } from 'vue'

/** 窄屏加载/更新预览后滚动到预览区，并转移焦点供读屏识别 */
export function scheduleScrollToPreview(containerRef: Ref<HTMLElement | null>) {
  if (typeof window === 'undefined') return
  if (!window.matchMedia('(max-width: 768px)').matches) return

  nextTick(() => {
    requestAnimationFrame(() => {
      const el = containerRef.value
      if (!el) return
      const grid = el.querySelector('#previewGrid') as HTMLElement | null
      if (!grid?.innerHTML.trim()) return
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })
      try {
        el.focus({ preventScroll: true })
      } catch {
        /* Safari 部分版本 focus 可能抛错 */
      }
    })
  })
}
