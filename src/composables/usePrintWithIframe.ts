/**
 * 使用隐藏 iframe 执行打印，避免新开标签页（about:blank）。
 * 调用方负责拼好 printCss 与 gridInnerHTML，本函数负责创建 iframe、写入文档、调 print、清理。
 */
export function usePrintWithIframe() {
  function print(gridInnerHTML: string, printCss: string): void {
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>打印</title><style>${printCss}</style></head><body><div id="previewGrid">${gridInnerHTML}</div></body></html>`
    const iframe = document.createElement('iframe')
    iframe.setAttribute('style', 'position:fixed;left:-9999px;width:0;height:0;border:none;')
    iframe.setAttribute('aria-hidden', 'true')
    document.body.appendChild(iframe)
    const doc = iframe.contentDocument
    if (!doc) {
      if (iframe.parentNode) document.body.removeChild(iframe)
      throw new Error('无法访问打印框架文档')
    }
    try {
      doc.open()
      doc.write(html)
      doc.close()
    } catch (e) {
      if (iframe.parentNode) document.body.removeChild(iframe)
      throw e
    }
    const iframeWin = iframe.contentWindow!
    setTimeout(() => {
      iframeWin.focus()
      iframeWin.print()
      iframeWin.onafterprint = () => {
        if (iframe.parentNode) document.body.removeChild(iframe)
      }
      setTimeout(() => {
        if (iframe.parentNode) document.body.removeChild(iframe)
      }, 1000)
    }, 300)
  }

  return { print }
}
