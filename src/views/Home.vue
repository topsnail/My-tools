<script setup lang="ts">
import { RouterLink } from 'vue-router'
</script>

<template>
  <div class="home">
    <div class="bg-animate" aria-hidden="true" />
    <header class="header">
      <h1 class="brand">My tools</h1>
      <p class="disclaimer">✨ 仅为方便个人使用，如有问题请自行承担风险</p>
    </header>
    <div class="tools-container">
      <RouterLink to="/fp" class="tool-link">
        <div class="tool-card">
          <div class="tool-icon">🧾</div>
          <div class="tool-title">发票打印</div>
          <div class="tool-desc">简洁高效的发票排版工具<br>支持快速生成标准页面</div>
        </div>
      </RouterLink>
      <RouterLink to="/jt" class="tool-link">
        <div class="tool-card">
          <div class="tool-icon">🖼️</div>
          <div class="tool-title">手机截图打印</div>
          <div class="tool-desc">批量智能排版助手<br>支持裁剪线与多种布局方案</div>
        </div>
      </RouterLink>
      <RouterLink to="/pdf-tools" class="tool-link">
        <div class="tool-card">
          <div class="tool-icon">📦</div>
          <div class="tool-title">PDF常用工具</div>
          <div class="tool-desc">离线工具箱、对开页拆分<br>交替合并等 PDF 处理</div>
        </div>
      </RouterLink>
      <a href="https://fwd.topmer.top/" class="tool-link" target="_blank" rel="noopener noreferrer">
        <div class="tool-card">
          <div class="tool-icon">📊</div>
          <div class="tool-title">FWD数据处理</div>
          <div class="tool-desc">.mdb文件快速处理<br>支持一键导出报告数据</div>
        </div>
      </a>
      <a href="https://dpm.topmer.top/" class="tool-link" target="_blank" rel="noopener noreferrer">
        <div class="tool-card">
          <div class="tool-icon">📈</div>
          <div class="tool-title">贯入仪数据处理</div>
          <div class="tool-desc">CSV 可视化与数据分析<br>折线图、统计与导出</div>
        </div>
      </a>
      <a href="https://ly.topmer.top/" class="tool-link" target="_blank" rel="noopener noreferrer">
        <div class="tool-card">
          <div class="tool-icon">💬</div>
          <div class="tool-title">在线留言板</div>
          <div class="tool-desc">分享想法与反馈<br>欢迎留下你的留言</div>
        </div>
      </a>
    </div>
  </div>
</template>

<style scoped>
.home {
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

.brand {
  font-size: clamp(2rem, 5vw, 2.75rem);
  font-weight: 700;
  letter-spacing: 0.02em;
  color: var(--color-white);
  text-shadow: 0 2px 14px rgba(0, 0, 0, 0.25);
  margin-bottom: var(--spacing-md);
  line-height: 1.2;
}

.disclaimer {
  font-size: var(--font-size-lg);
  color: rgba(255, 255, 255, 0.92);
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
  line-height: 1.5;
}

.tools-container {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--spacing-lg);
  width: 100%;
  max-width: 720px;
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
  max-width: 220px;
  height: 220px;
  background: rgba(255,255,255,0.7);
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
  border: 1px solid rgba(255,255,255,0.3);
  cursor: pointer;
  transition: transform var(--transition-medium), background var(--transition-medium), box-shadow var(--transition-medium);
}

.tool-card:hover {
  transform: translateY(-8px);
  background: rgba(255,255,255,0.85);
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
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
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

@media (max-width: 900px) {
  .tools-container { grid-template-columns: repeat(2, 1fr); max-width: 520px; }
}

/* 手机端：保持 2×2 网格，纵向卡片（图标在上、文案居中），与参考布局一致 */
@media (max-width: 480px) {
  .home {
    justify-content: center;
    padding: max(var(--spacing-lg), env(safe-area-inset-top)) max(var(--spacing-md), env(safe-area-inset-right)) max(var(--spacing-lg), env(safe-area-inset-bottom)) max(var(--spacing-md), env(safe-area-inset-left));
  }
  .header { margin-bottom: var(--spacing-lg); }
  .brand { font-size: 1.75rem; }
  .disclaimer { font-size: var(--font-size-sm); padding: 0 var(--spacing-sm); }
  .tools-container {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
    padding: 0 14px;
    max-width: 100%;
  }
  .tool-card {
    max-width: none;
    min-height: 168px;
    height: auto;
    padding: 14px 10px 16px;
    flex-direction: column;
    justify-content: flex-start;
    align-items: center;
    border-radius: 22px;
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.12);
    background: rgba(255, 255, 255, 0.82);
  }
  .tool-icon {
    width: 52px;
    height: 52px;
    font-size: 1.65rem;
    min-width: 52px;
    min-height: 52px;
    margin-bottom: 10px;
    background: #fff;
    border: none;
    box-shadow: 0 3px 10px rgba(0, 0, 0, 0.08);
  }
  .tool-title {
    font-size: 15px;
    margin-bottom: 6px;
    text-align: center;
    line-height: 1.3;
  }
  .tool-desc {
    font-size: 11px;
    text-align: center;
    padding: 0 2px;
    line-height: 1.45;
  }
}

@media (prefers-reduced-motion: reduce) {
  .bg-animate {
    animation: none;
    background-position: 50% 50%;
    filter: none;
  }
}
</style>
