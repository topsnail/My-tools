import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import Home from '@/views/Home.vue'

/** 懒加载：避免首页拉取 pdfjs / jspdf，进入对应路由再加载 */
const FapiaoPrint = () => import('@/views/FapiaoPrint.vue')
const JietuPrint = () => import('@/views/JietuPrint.vue')

const base = (import.meta as any).env?.BASE_URL ?? '/'
const routes: RouteRecordRaw[] = [
  { path: '/', name: 'Home', component: Home, meta: { title: '打印工具' } },
  { path: '/fp', name: 'FapiaoPrint', component: FapiaoPrint, meta: { title: '电子发票批量打印' } },
  { path: '/jt', name: 'JietuPrint', component: JietuPrint, meta: { title: '手机截图批量打印' } },
]

const router = createRouter({
  history: createWebHistory(base),
  routes,
})

router.afterEach((to) => {
  if (to.meta?.title && typeof to.meta.title === 'string') {
    document.title = to.meta.title
  }
})

export default router
