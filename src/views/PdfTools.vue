<script setup lang="ts">
import { RouterLink } from 'vue-router'

const base = import.meta.env.BASE_URL ?? '/'

const tools = [
  {
    href: `${base}tools/PDF7.html`,
    icon: '📦',
    title: '离线 PDF 工具箱',
    desc: '合并、拆分、旋转、删除<br>转图片与页面重排',
  },
  {
    href: `${base}tools/PDFduikai.html`,
    icon: '📖',
    title: '对开页 PDF 拆分',
    desc: '拖拽分割线实时调整<br>逐页自定义左右/上下切分',
  },
  {
    href: `${base}tools/PDFjiaotihebing.html`,
    icon: '🔀',
    title: '交替合并 PDF',
    desc: '多文件按页轮流穿插<br>适合对页合并场景',
  },
]
</script>

<template>
  <div class="pdf-tools">
    <div class="bg-animate" aria-hidden="true" />
    <header class="header">
      <RouterLink to="/" class="back-link">← 返回首页</RouterLink>
      <h1>PDF 常用工具</h1>
      <p class="subtitle">以下为独立离线页面，在浏览器本地处理，不上传文件</p>
    </header>
    <div class="tools-container">
      <a
        v-for="tool in tools"
        :key="tool.href"
        :href="tool.href"
        class="tool-link"
      >
        <div class="tool-card">
          <div class="tool-icon">{{ tool.icon }}</div>
          <div class="tool-title">{{ tool.title }}</div>
          <div class="tool-desc" v-html="tool.desc" />
        </div>
      </a>
    </div>
  </div>
</template>

<style scoped>
.pdf-tools {
  min-height: 100dvh;
  width: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  position: relative;
  padding: var(--spacing-xl) 0;
}

.bg-animate {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
  background: linear-gradient(
    var(--gradient-angle),
    var(--color-gradient-start),
    var(--color-gradient-mid1),
    var(--color-gradient-mid2),
    var(--color-gradient-mid3),
    var(--color-gradient-end)
  );
  background-size: 500% 500%;
  animation: breath var(--animation-bg-speed) ease infinite;
  pointer-events: none;
}

@keyframes breath {
  0%, 100% { background-position: 0% 50%; filter: brightness(1); }
  25% { background-position: 50% 100%; filter: brightness(1.1); }
  50% { background-position: 100% 50%; filter: brightness(1); }
  75% { background-position: 50% 0%; filter: brightness(1.1); }
}

.header {
  text-align: center;
  margin-bottom: var(--spacing-xxl);
  padding: 0 var(--spacing-xl);
  position: relative;
  z-index: 1;
}

.back-link {
  display: inline-block;
  margin-bottom: var(--spacing-lg);
  color: rgba(255, 255, 255, 0.9);
  text-decoration: none;
  font-size: var(--font-size-sm);
  padding: 6px 14px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.15);
  transition: background var(--transition-medium);
}

.back-link:hover {
  background: rgba(255, 255, 255, 0.28);
}

.header h1 {
  font-size: var(--font-size-xxl);
  color: var(--color-white);
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
  margin-bottom: var(--spacing-sm);
}

.subtitle {
  font-size: var(--font-size-sm);
  color: rgba(255, 255, 255, 0.85);
  line-height: 1.5;
}

.tools-container {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--spacing-lg);
  width: 100%;
  max-width: 780px;
  padding: 0 var(--spacing-xl);
  justify-items: center;
  position: relative;
  z-index: 1;
}

.tool-link {
  text-decoration: none;
  color: inherit;
  width: 100%;
  display: flex;
  justify-content: center;
}

.tool-card {
  width: 100%;
  max-width: 240px;
  min-height: 220px;
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-radius: var(--border-radius-large);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: var(--spacing-lg);
  box-shadow: var(--shadow-light);
  border: 1px solid rgba(255, 255, 255, 0.3);
  cursor: pointer;
  transition: transform var(--transition-medium), background var(--transition-medium), box-shadow var(--transition-medium);
}

.tool-card:hover {
  transform: translateY(-8px);
  background: rgba(255, 255, 255, 0.85);
  box-shadow: var(--shadow-medium);
}

.tool-icon {
  font-size: 2rem;
  margin-bottom: var(--spacing-lg);
  width: 60px;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--color-white);
  border-radius: 50%;
  background: rgba(var(--color-primary-rgb), 0.1);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transition: border-color var(--transition-medium), background var(--transition-medium), transform var(--transition-medium), box-shadow var(--transition-medium);
}

.tool-card:hover .tool-icon {
  border-color: var(--color-secondary);
  background: rgba(var(--color-secondary-rgb), 0.15);
  transform: scale(1.05);
}

.tool-title {
  color: var(--color-dark-gray);
  font-size: var(--font-size-lg);
  font-weight: 600;
  margin-bottom: var(--spacing-sm);
}

.tool-desc {
  color: var(--color-medium-gray);
  font-size: var(--font-size-sm);
  line-height: 1.5;
  padding: 0 var(--spacing-xs);
}

@media (max-width: 768px) {
  .tools-container {
    grid-template-columns: 1fr;
    max-width: 320px;
  }
}

@media (max-width: 480px) {
  .pdf-tools {
    padding: max(var(--spacing-lg), env(safe-area-inset-top)) max(var(--spacing-md), env(safe-area-inset-right)) max(var(--spacing-lg), env(safe-area-inset-bottom)) max(var(--spacing-md), env(safe-area-inset-left));
  }
  .header { margin-bottom: var(--spacing-lg); }
  .header h1 { font-size: var(--font-size-lg); }
  .subtitle { font-size: 11px; padding: 0 var(--spacing-sm); }
  .tool-card {
    max-width: none;
    min-height: 168px;
    padding: 14px 10px 16px;
    border-radius: 22px;
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.12);
    background: rgba(255, 255, 255, 0.82);
  }
  .tool-icon {
    width: 52px;
    height: 52px;
    font-size: 1.65rem;
    margin-bottom: 10px;
    background: #fff;
    border: none;
    box-shadow: 0 3px 10px rgba(0, 0, 0, 0.08);
  }
  .tool-title { font-size: 15px; }
  .tool-desc { font-size: 11px; }
}

@media (prefers-reduced-motion: reduce) {
  .bg-animate {
    animation: none;
    background-position: 50% 50%;
    filter: none;
  }
}
</style>
