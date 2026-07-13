/**
 * 仅在调用时加载 jspdf；请在 exportPdf 内通过 import('@/lib/loadJsPDF') 引用本模块，勿在页面顶层静态导入。
 */
export async function loadJsPDF() {
  const { jsPDF } = await import('jspdf')
  return jsPDF
}
