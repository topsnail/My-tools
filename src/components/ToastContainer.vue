<script setup lang="ts">
import { useToast } from '@/composables/useToast'

const { toasts, removeToast, icons } = useToast()
</script>

<template>
  <div class="toast-container" aria-live="polite">
    <TransitionGroup name="toast">
      <div
        v-for="t in toasts"
        :key="t.id"
        :class="['toast', `toast-${t.type}`]"
        role="alert"
      >
        <span class="toast-icon">{{ icons[t.type] }}</span>
        <span class="toast-content">{{ t.message }}</span>
        <button type="button" class="toast-close" aria-label="关闭" @click="removeToast(t.id)">×</button>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-container {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 10000;
  display: flex;
  flex-direction: column;
  gap: 10px;
  pointer-events: none;
}

.toast-container .toast {
  pointer-events: auto;
}

.toast {
  background: white;
  border-radius: 8px;
  padding: 14px 18px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  min-width: 280px;
  max-width: 400px;
  display: flex;
  align-items: center;
  gap: 12px;
  border-left: 4px solid var(--color-primary);
}

.toast.toast-success { border-left-color: var(--color-success); }
.toast.toast-warning { border-left-color: var(--color-warning); }
.toast.toast-error { border-left-color: var(--color-danger); }
.toast.toast-info { border-left-color: #3498db; }

.toast-icon { font-size: 20px; flex-shrink: 0; }
.toast-content { flex: 1; font-size: 14px; color: var(--color-dark-gray); line-height: 1.4; }
.toast-close {
  background: none;
  border: none;
  font-size: 18px;
  color: #94a3b8;
  cursor: pointer;
  padding: 0;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.toast-close:hover { color: var(--color-medium-gray); }

.toast-enter-active, .toast-leave-active { transition: opacity 0.3s ease, transform 0.3s ease; }
.toast-enter-from { transform: translateX(100%); opacity: 0; }
.toast-leave-to { transform: translateX(100%); opacity: 0; }
.toast-move { transition: transform 0.3s ease; }

@media (max-width: 480px) {
  .toast-container {
    top: auto;
    bottom: max(16px, env(safe-area-inset-bottom));
    right: 12px;
    left: 12px;
    align-items: stretch;
  }
  .toast {
    min-width: 0;
    max-width: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .toast-enter-active,
  .toast-leave-active,
  .toast-move {
    transition-duration: 0.01ms !important;
  }
  .toast-enter-from,
  .toast-leave-to {
    transform: none;
    opacity: 1;
  }
}
</style>
