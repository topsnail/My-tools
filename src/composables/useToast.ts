import { ref } from 'vue'

export type ToastType = 'success' | 'warning' | 'error' | 'info'

export interface ToastItem {
  id: number
  message: string
  type: ToastType
  duration: number
  timer?: ReturnType<typeof setTimeout>
}

const toasts = ref<ToastItem[]>([])
let id = 0
let defaultDuration = 3000

const icons: Record<ToastType, string> = {
  success: '✅',
  warning: '⚠️',
  error: '❌',
  info: 'ℹ️',
}

function removeToast(toastId: number) {
  const idx = toasts.value.findIndex((t) => t.id === toastId)
  if (idx >= 0) {
    const t = toasts.value[idx]
    if (t.timer) clearTimeout(t.timer)
    toasts.value.splice(idx, 1)
  }
}

export function useToast() {
  function showToast(message: string, type: ToastType = 'info', duration: number = defaultDuration) {
    const toastId = ++id
    const item: ToastItem = {
      id: toastId,
      message,
      type,
      duration,
    }
    if (duration > 0) {
      item.timer = setTimeout(() => {
        removeToast(toastId)
      }, duration)
    }
    toasts.value.push(item)
    return toastId
  }

  return {
    toasts,
    showToast,
    removeToast,
    icons,
  }
}
