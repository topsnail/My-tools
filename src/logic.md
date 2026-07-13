# my tools 项目逻辑说明

本文档记录当前项目的业务逻辑与实现要点，便于后期修改与排查。

---

## 1. 项目概览

- **技术栈**：Vue 3 (Composition API) + TypeScript + Vite + Vue Router (History 模式)
- **功能**：打印工具集合——首页入口、发票 PDF 批量排版打印、手机截图批量排版打印
- **路由**：`/` 首页，`/fp` 发票打印，`/jt` 手机截图打印（无 `#`，需静态托管配置 SPA 回退）
- **页面标题**：仅使用路由 `meta.title`，无后缀（如「电子发票批量打印」）

---

## 2. 路由与页面

- **router/index.ts**
  - `createWebHistory(base)`，路径形如 `/`、`/fp`、`/jt`（无 `#`）
  - `afterEach` 根据 `meta.title` 设置 `document.title`
- **页面组件**
  - `Home.vue`：工具入口，三个卡片（发票打印、手机截图打印、FWD 外链）
  - `FapiaoPrint.vue`：电子发票批量打印
  - `JietuPrint.vue`：手机截图批量打印

---

## 3. 首页 (Home.vue)

- 纯展示：背景动画、标题、三个工具卡片
- 发票 / 截图 使用 `<RouterLink to="/fp">`、`<RouterLink to="/jt">`
- FWD 使用外链 `<a href="https://fwd.topmer.top/">`
- 样式使用全局 CSS 变量（见 `styles/global.css`）

---

## 4. 发票打印 (FapiaoPrint.vue)

### 4.1 配置与状态

| 名称 | 类型 | 说明 |
|------|------|------|
| CONFIG.PDF_RENDER_SCALE | 2.8 | PDF 转图缩放倍率（越大越清晰，预览/导出/打印共用） |
| CONFIG.IMAGE_QUALITY | 0.9 | 转 JPEG 质量 0–1 |
| CONFIG.DEFAULT_MARGIN | 2 | 默认边距 mm |
| CONFIG.MAX_FILES | 50 | 单次最多文件数 |
| invoiceFiles | ref\<string[]\> | 每张发票第一页转成的 dataURL (JPEG) |
| originalFiles | ref\<File[]\> | 原始 PDF 文件，用于列表展示与删除 |
| currentMode | ref\<2 \| 4\> | 2=1 页 2 张(纵向)，4=1 页 4 张(横向)，默认 4 |
| currentMargin | ref\<number\> | 边距 mm，0–10 |
| showLines | ref\<boolean\> | 是否显示裁剪线，默认 true |
| isProcessing / showProgress / progressPercent / progressText | ref | 处理中与进度 UI |
| dropZoneVisible | ref\<boolean\> | 是否显示拖拽区（有文件后为 false，显示文件列表） |
| showBrowserWarning / showPrintDialog / showHelpDialog | ref\<boolean\> | 各类弹窗显隐 |

### 4.2 文件处理流程

1. **入口**：拖拽或点击触发 `handleFiles(files)`，隐藏 input 用 `fileInput.value?.click()` 触发选择。
2. **过滤**：只接受 `application/pdf`，其余 Toast 提示。
3. **去重**：按 `name + size + lastModified` 与当前 `originalFiles` 比较，重复的跳过并 Toast。
4. **数量**：若 `originalFiles.length + 新文件数 > MAX_FILES`，只取能加入的数量，并 Toast。
5. **解析**：
   - 使用 **pdfjs-dist**：worker、cMap、standardFontData 均从 `public/` 同源加载（构建时由 `scripts/copy-pdf-assets.cjs` 从 node_modules 复制），无外网 CDN 依赖。
   - `getDocument({ data, cMapUrl, cMapPacked: true, standardFontDataUrl }).promise`，取第 1 页，`getViewport({ scale })` 后渲染到临时 canvas，`toDataURL('image/jpeg', IMAGE_QUALITY)` 得到 dataURL。
   - 成功则 push 到 `originalFiles` 和 `invoiceFiles`，失败记入 `failedNames` 并 Toast。
6. **收尾**：清空/释放 canvas，`showProgress = false`，调用 `renderPreview()`。

### 4.3 预览渲染 (renderPreview)

- **容器**：`previewGridRef`（即 `#previewGrid`），**由 JS 动态插入子节点**（非模板），因此样式必须用 **`:deep()`** 才能作用到 `.preview-page`、`.slot`、`.line-h`、`.line-v`（见下方「预览与样式」）。
- **逻辑**：
  - 清空 `grid.innerHTML`，按 `currentMode` 计算总页数 `totalPages = ceil(files.length / mode)`。
  - 每页一个 `div.preview-page`，class 含 `v-page`(纵向) 或 `h-page`(横向)，以及 `show-lines`（当 `showLines.value` 为 true）。
  - 每页先 `innerHTML = '<div class="line-h"></div><div class="line-v"></div>'`（两条线始终存在，显隐由 CSS `.show-lines` 控制）。
  - 按 mode 用百分比设置每个 `.slot` 的 position（2 张：上下各 50%；4 张：四宫格），`slot.style.padding = margin + 'mm'`，内嵌 `img` 的 src 为对应 dataURL。
- **裁剪线**：预览是否显示完全由「裁剪线」开关决定；class `show-lines` 控制 `.line-h` / `.line-v` 的 display。

### 4.4 导出 PDF (exportPdf)

- 使用 **jsPDF**，`orientation`: mode 2 为 portrait，mode 4 为 landscape。
- 每页 A4，按 slot 位置算 x,y（mode 2：slot 210×148.5 mm；mode 4：148.5×105 mm），`doc.addImage(dataURL, 'JPEG', x+margin, y+margin, w, h)`。
- 若 `showLines` 为 true，在每页最后一张 slot 后画虚线（`setLineDashPattern([2,2])`）：mode 2 画横线，mode 4 画横+竖。
- 文件名：`发票_yyyyMMddHHmm.pdf`。

### 4.5 预览、导出、打印与清晰度

- **预览**：在 `#previewGrid` 中展示已解析的 `invoiceFiles`（dataURL），按 mode 与边距用 CSS 排布，不重新生成图。
- **导出**：jsPDF 将同一批 dataURL 按 A4 slot 尺寸画入 PDF 并下载。
- **打印**：将当前 `#previewGrid` 的 innerHTML 写入隐藏 iframe，加打印 CSS 后 `iframe.contentWindow.print()`，即「所见即所打」。
- **清晰度**：由解析阶段决定，三者一致。`PDF_RENDER_SCALE` 控制渲染倍率，`IMAGE_QUALITY` 控制 JPEG 质量；当前为 2.8、0.9。

### 4.6 打印 (doPrint)

- **策略**：不在当前页直接打印，而是用**隐藏 iframe** 写入「当前预览网格的 HTML + 打印用 CSS」，再对 iframe 调用 `contentWindow.print()`，避免 Vue 布局产生空白页，且**不会打开新标签页**（不会出现 about:blank）。
- **流程**：
  1. 取 `document.getElementById('previewGrid').innerHTML`（即当前预览 DOM，已含裁剪线 class 与 line 节点）。
  2. 拼一个完整 HTML 文档字符串：`@page`、body、`#previewGrid` 的样式，以及 `.preview-page`、`.slot`、`.line-h`、`.line-v` 等；**是否有裁剪线**由复制过去的 DOM 上是否带 `show-lines` class 决定，打印 CSS 里用 `.preview-page.show-lines .line-h` 等显示线条。
  3. 创建 iframe，样式为 `position:fixed;left:-9999px;width:0;height:0;border:none` 置于视口外，append 到 body。
  4. `iframe.contentDocument.write(html)`、`close()`，`setTimeout` 后 `iframe.contentWindow.print()`。
  5. `onafterprint` 或约 1 秒后移除 iframe。

---

## 5. 手机截图打印 (JietuPrint.vue)

### 5.1 配置与状态

| 名称 | 类型 | 说明 |
|------|------|------|
| CONFIG.IMAGE_QUALITY | 0.92 | 导出 PDF 时裁剪后转 JPEG 的质量 0–1 |
| CONFIG.MARGIN_MM / SPACING_MM | 4.3 | 页边距与图片间距 mm |
| CONFIG.MAX_FILES | 50 | 单次最多文件数 |
| photoFiles | ref\<PhotoItem[]\> | 每张图 { dataUrl, originalName, dimensions: { originalWidth, originalHeight, originalRatio } } |
| originalFiles | ref\<File[]\> | 原始文件，用于列表与删除 |
| currentMode | ref\<6 \| 9 \| 12\> | 6=1 页 6 张，9=1 页 9 张，12=1 页 12 张，默认 9 |
| showCutLines | ref\<boolean\> | 是否显示裁剪线，默认 true |
| 其它 UI 状态 | 同 FapiaoPrint | isProcessing、showProgress、dropZoneVisible、各弹窗等 |

### 5.2 布局计算 (calculateLayout)

- A4：210×297 mm，margin/spacing 固定 4.3 mm。
- **mode 6**：纵向，3 列×2 行，content 区域平分后得 slotWidth、slotHeight。
- **mode 9**：纵向，3 列×3 行。
- **mode 12**：横向（pageWidth=297, pageHeight=210），6 列×2 行。
- 返回 `LayoutResult`：columns, rows, photosPerPage, slotWidth, slotHeight, orientation, pageWidth, pageHeight, margin, spacing。

### 5.3 文件处理流程

1. **入口**：拖拽或点击，`handleFiles(files)`。
2. **过滤**：`image/jpeg`、`image/png`、`image/jpg`、`image/webp`。
3. **数量**：同 FapiaoPrint，超过 MAX_FILES 则只取可添加数量。
4. **去重**：按文件名在 `originalFiles` 中是否已存在，重复则跳过并记入 `duplicateNames`，最后 Toast。
5. **单图处理** `processImage(file)`：`FileReader.readAsDataURL`，new Image 取宽高，resolve `{ dataUrl, originalName, dimensions: { originalWidth, originalHeight, originalRatio } }`。
6. 成功则 push 到 `photoFiles` 和 `originalFiles`，最后 `renderPreview()`。

### 5.4 预览渲染 (renderPreview)

- 同样用 **previewGridRef** 动态插入，样式需 **`:deep()`**。
- 按 `calculateLayout(currentMode.value)` 得到行列与 slot 尺寸，用**百分比**设置每个 slot 的 left/top/width/height（便于不同页宽高比一致）。
- 图片：`object-fit: cover`，`object-position: top center`（顶部对齐，底部可裁）。
- **裁剪线**：仅当 `showCutLines.value === true` 时，在每页内插入 `.cut-line.vertical` / `.cut-line.horizontal`，位置用 layout 的 margin、slotWidth、slotHeight、spacing 计算（列/行间隔中线）。**打印时是否有线**取决于复制过去的 HTML 里是否包含这些节点（即预览时是否开启裁剪线）。

### 5.5 导出 PDF (exportPdf)

- jsPDF，orientation 来自 `layout.orientation`。
- 按 layout 的 x,y,slotWidth,slotHeight 逐 slot 画图；若图片比例导致高度超出 slot，则用 canvas 裁掉底部再 `toDataURL('image/jpeg')` 画入 PDF。
- 若 `showCutLines` 为 true，用 `setLineDashPattern([3,3])` 在列/行间隔处画灰色虚线。
- 文件名：`图_yyyyMMddHHmm.pdf`。

### 5.6 预览、导出、打印与清晰度

- **预览**：`#previewGrid` 展示 `photoFiles` 的 dataURL，按 layout 排布；原图无压缩。
- **导出**：jsPDF 按 layout 画图；若图片需裁剪则用 `toDataURL('image/jpeg', IMAGE_QUALITY)`（当前 0.92）后插入。
- **打印**：同 FapiaoPrint，打印当前预览 DOM。
- **清晰度**：主要由原图决定；导出时裁剪部分使用 `IMAGE_QUALITY`（0.92）。

### 5.7 打印 (doPrint)

- 与 FapiaoPrint 相同策略：**隐藏 iframe**（不新开标签）、只写 `#previewGrid` 的 innerHTML + 打印 CSS，再对 iframe 调 `contentWindow.print()`。
- 纸张方向：mode 12 为 landscape，6/9 为 portrait。
- 打印文档内对 `.cut-line` 的样式与预览一致（1px 虚线、print-color-adjust），**是否出现裁剪线**由复制出的 HTML 是否包含 `.cut-line` 节点决定（即预览时是否开启裁剪线）。

---

## 6. 公共逻辑

### 6.1 Toast (useToast.ts + ToastContainer.vue)

- **useToast()**：返回 `{ toasts, showToast, removeToast, icons }`。`showToast(message, type?, duration?)` 往 toasts 里 push 一条，duration 后自动 remove；type 为 success/warning/error/info。
- **ToastContainer**：在 App.vue 中挂载，根据 `toasts` 列表渲染，带关闭按钮；样式用 left 边框颜色区分 type。

### 6.2 全局样式 (styles/global.css)

- **:root**：颜色、圆角、间距、阴影、字号、过渡等 CSS 变量，供各页面使用。
- **@media print**：对 html/body/#app/.app 做 margin、padding、height、min-height、overflow 重置，避免整页布局产生空白页；隐藏 `.toast-container`；强调 `#previewGrid` 为 block。  
  （实际打印以「新窗口仅预览内容」为主，本段主要影响用户在本页直接 Ctrl+P 时的表现。）

### 6.3 预览 DOM 与样式（:deep）

- 两处打印页的预览区域都是 **JS 里 `document.createElement` 后 append 到 `#previewGrid`**，节点没有 Vue 的 data-v-xxx，**scoped 样式不会作用到这些节点**。
- 因此所有「只作用于预览内部」的样式都必须写在 **`.preview-grid :deep(.preview-page)`、`:deep(.slot)`、`:deep(.line-h)` 等** 下，否则预览排版会错乱；打印窗口是独立文档，不依赖这些 scoped 规则。

### 6.4 浏览器兼容

- **checkBrowserCompatibility**：检测 File、FileReader、Promise、fetch（fp）或 Canvas（jt），缺则 `showBrowserWarning = true`。
- **打印**：使用页面内隐藏 iframe，不打开新标签，无需允许弹窗。

---

## 7. 修改时注意点

- **增加/修改布局模式**（如 fp 加 1 页 6 张、jt 加 1 页 4 张）：改 CONFIG/currentMode 类型、renderPreview 分支、exportPdf 坐标与分页、doPrint 的 printCss 中的 .v-page/.h-page 及 @page orientation，并同步 calculateLayout（jt）。
- **改裁剪线样式或显隐逻辑**：预览看 `.show-lines`（fp）或是否插入 `.cut-line`（jt）；打印看新窗口 HTML 里带的 class/节点，以及 printCss 中对应选择器。
- **改单页尺寸或边距**：fp 的 slot 像素尺寸在 exportPdf 里写死（210/148.5 等），需一起改；jt 用 calculateLayout 的 margin/spacing/slotWidth/slotHeight，改 CONFIG 或 layout 计算即可。
- **新增依赖（如新 PDF 库）**：注意 worker 路径、cMap 等；若仍用新窗口打印，只需在新窗口的 HTML 内联样式中体现即可。

---

## 8. 改进建议

以下为可选优化，按需采纳。

### 8.1 代码与结构

- **打印逻辑复用**：FapiaoPrint 与 JietuPrint 的 `doPrint` 中「拼 HTML + 写 iframe + print」流程类似，可抽成 composable（如 `usePrintWithIframe(html, options)`），统一处理 iframe 创建、写入、打印、移除，两页只传不同的 `printCss` 与 `grid.innerHTML`，减少重复、方便统一改打印行为。
- **配置与布局独立**：CONFIG、`calculateLayout` 可放到 `src/constants/`、`src/utils/layout.ts` 等，便于调整参数和单测；导出 PDF 中的 A4/slot 尺寸（如 210、148.5）也可集中为常量。
- **预览 HTML 生成**：`renderPreview` 内大量 `createElement` 与 `innerHTML`，可改为「纯函数：输入 state → 输出预览 HTML 字符串」，再一次性 `grid.innerHTML = html`，便于单测与后续若要做服务端/离线预览。

### 8.2 用户体验

- **导出/打印反馈**：导出 PDF 时（尤其 jt 多图）可先 `showToast('正在生成 PDF…', 'info')`，完成后 Toast 成功或失败；打印前若内容很多，可短暂「准备打印中」提示，避免用户误以为无响应。
- **帮助内容**：帮助弹窗内容较多时，可做折叠/锚点或分块标题，方便快速跳到「导出」「打印」「故障排除」等段落。
- **失败文件列表**：PDF 解析失败时，除 Toast 外可在文件列表区域标出「以下文件加载失败：xxx.pdf」，或提供「重试失败项」，减少用户困惑。

### 8.3 健壮性与错误处理

- **iframe 写入异常**：`doPrint` 内 `doc.write(html)` 可包一层 try-catch，若失败（如内容过大、编码问题）则 Toast 提示并移除 iframe，避免留下不可见 iframe。
- **导出错误信息**：导出 PDF 失败时，可根据 `e.message` 或错误类型给出更具体提示（如「可能因内存不足，请减少文件数量」），便于用户自助排查。

### 8.4 性能

- **大量文件**：接近 MAX_FILES（如 50 张）时，预览 DOM 与打印 iframe 体积较大，可在导出/打印前加简短提示「文件较多，请稍候」，或对预览做「只渲染前 N 页」的轻量优化（需权衡与打印一致性）。
- **PDF 解析**：当前串行解析、单页转图已做 canvas 释放，可保持；若未来需要进一步优化，可考虑 Worker 内解析（需处理 worker 与主线程间的 data 传递）。

### 8.5 可访问性

- **关键控件**：拖拽区、主要按钮（导出 PDF、立即打印、清空重置）可补充 `aria-label`，帮助读屏用户理解用途。
- **操作结果**：导出/打印成功或失败后，除 Toast 外可对结果区域加 `aria-live="polite"` 或简短说明，确保辅助技术能读到反馈。

### 8.6 部署与工程

- **子路径部署**：若部署到非根路径（如 `https://xxx.com/tools/`），需将 `vite.config.ts` 的 `base` 改为 `'/tools/'` 后重新构建；当前 `base: '/'` 为根路径部署。
- **版本号**：页脚与 logic 中的版本号可与 `package.json` 的 version 同步，通过构建时注入 `__APP_VERSION__`，避免多处手改。
- **Cloudflare Pages**：`public/_redirects` 已配置 `/* /index.html 200`，构建时复制到 `dist/`，CF Pages 将所有路径回退到 index.html。Git 连接部署时**不需要**把 `dist` 提交到仓库，CF 在云端执行 `npm run build` 生成 `dist` 再部署。PDF 相关资源（worker、cmaps、standard_fonts）由 `scripts/copy-pdf-assets.cjs` 在构建时从 node_modules 复制到 `public/`，无外网 CDN 依赖。详见 README 与 DEPLOY.md。

### 8.7 文档与维护

- **README**：可补充「构建命令」「部署方式」「推荐浏览器」「单次文件数/大小限制」等，方便他人接手或自部署。
- **logic.md**：若遇到反复被问的问题（如打印无裁剪线、空白页），可在本文档加「常见问题」小节，记录原因与对应修改位置。

### 8.8 测试（可选）

- 若计划长期维护，可对核心逻辑做单测：如 `calculateLayout(mode)` 的输入输出、导出 PDF 时 slot 坐标计算等，用 Vitest 与 Vite 集成即可，不要求覆盖 UI。

### 8.9 其它

- **外链安全**：首页 FWD 等外链已用 `rel="noopener noreferrer"` 即可，避免 tabnabbing。
- **隐私说明**：帮助或关于中可再次强调「数据仅在本机处理、不上传」，增强用户信任。

---

## 9. 常见问题

- **打印没有裁剪线**：请先在预览中打开「裁剪线」开关；打印内容与预览一致，仅当预览显示裁剪线时，打印文档中才会出现裁剪线。
- **打印出现空白页 / about:blank**：已改为在页面内用隐藏 iframe 打印，不再新开标签页；若仍异常，请尝试 Chrome/Edge 并允许弹窗。
- **导出 PDF 失败**：常见原因包括内存不足（可减少文件数量）、浏览器安全限制（可换浏览器）；错误提示会尽量给出具体原因。
- **部分文件加载失败**：发票页会显示「以下文件加载失败：xxx.pdf」；截图页同理。可检查文件格式与是否损坏后重试。

---

*文档随项目逻辑变更需同步更新。*
