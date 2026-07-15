# My tools

基于 **Vue 3 (Composition API)** + **TypeScript** + **Vite** 的个人工具集合。原 `FapiaoPrint` 文件夹已弃用，请使用本工程。

## 功能

- **首页** (`/`)：工具入口（发票打印、手机截图打印、FWD 等外链）
- **发票打印** (`/fp`)：PDF 电子发票批量排版，1 页 2 张(纵向) / 4 张(横向)，支持导出 PDF、打印、裁剪线
- **手机截图打印** (`/jt`)：手机截图批量排版，1 页 6/9/12 张，支持导出 PDF、打印、裁剪线

## 技术栈

- Vue 3 (Composition API) + TypeScript + Vite
- Vue Router（History 模式，URL 无 `#`，需静态托管 SPA 回退）
- **pdfjs-dist**：PDF 解析（worker、cmaps、standard_fonts 均本地化，无外网 CDN）
- **jsPDF**：导出 PDF

## 开发

```bash
npm install
npm run dev
```

访问：`http://localhost:5173`，路由为 `/`、`/fp`、`/jt`（无 `#`）。

## 构建

### 生产构建

```bash
npm run build
```

或先清理再构建：

```bash
npm run clean
npm run build
```

**构建产物**：`dist/` 目录，包含：
- `index.html` - 入口
- `assets/` - JS、CSS（已压缩、代码分割：pdfjs、jspdf 独立 chunk）
- `favicon.svg` - 网站图标
- `_headers` - CF Pages 自定义头（缓存等）
- `_redirects` - SPA 回退规则（`/* /index.html 200`）
- `pdf.worker.min.mjs`、`cmaps/`、`standard_fonts/` - PDF 解析与字体资源（构建时从 node_modules 复制，部署后同源加载，无需外网）

**部署说明**：
- **History 路由**：静态托管需 SPA 回退；`_redirects` 已为 Cloudflare Pages 配置好。
- **子路径**：若部署在 `https://xxx.com/tools/`，将 `vite.config.ts` 的 `base` 改为 `'/tools/'` 后重新构建。
- **清晰度**：发票页由 `src/constants/fp.ts` 的 `PDF_RENDER_SCALE`（2.8）、`IMAGE_QUALITY`（0.9）控制；截图页由 `jt.ts` 的 `IMAGE_QUALITY`（0.92）控制裁剪后 JPEG 质量。

## 部署到 Cloudflare Pages（网页端）

本项目适配通过 **Cloudflare Pages 网页端** 部署（直接上传构建产物或连接 Git）。

### 方式一：直接上传构建产物（推荐，网页端部署）

1. 本地执行构建：
   ```bash
   npm install
   npm run build
   ```
2. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/) → **Workers & Pages** → **Create** → **Pages** → **Upload assets**。
3. 将本地生成的 **`dist`** 文件夹**整体拖拽上传**（或选择包含 `dist` 内容的压缩包）。
4. 填写项目名称并创建部署；完成后会得到 `https://<项目名>.pages.dev` 的访问地址。

### 方式二：连接 Git（GitHub 等）由 CF 自动构建

1. 在 **Workers & Pages** 中 **Create** → **Pages** → **Connect to Git**，选择 GitHub 仓库并授权。
2. 构建配置：
   - **Build command**：`npm run build`
   - **Build output directory**：`dist`
   - **Root directory**：留空
3. 保存后，每次推送到所选分支会触发自动构建与发布。

**说明**：**不需要**把 `dist` 或 `node_modules` 提交到 Git。CF 会拉取源码，在云端执行 `npm install` 和 `npm run build`，在构建环境中生成 `dist` 再部署。请确保仓库有 `.gitignore` 忽略 `dist` 和 `node_modules`（本项目已包含）。

### 说明

- **History 路由**：URL 无 `#`（如 `/fp`、`/jt`）。`dist/_redirects` 中已配置 `/* /index.html 200`，CF Pages 会将所有路径回退到 index.html。
- **PDF 资源**：发票解析所用 worker、cmaps、standard_fonts 在构建时由 `scripts/copy-pdf-assets.cjs` 复制到 `public/` 并输出到 `dist/`，部署后从同源加载，不依赖外网。
- **子路径/自定义域**：若站点在子路径或绑定自定义域且非根路径，需在 `vite.config.ts` 中设置对应 `base` 后重新构建。

## 推荐环境与限制

- **浏览器**：推荐 Chrome、Edge、Firefox 最新版，以保证 PDF 解析与打印体验。
- **单次文件数**：最多 **50** 个（发票 PDF 或截图），超出会提示；较多时导出/打印会有「请稍候」提示。
- **单张大小**：图片建议 &lt; 3MB，避免内存占用过高。
- **数据与隐私**：所有处理均在浏览器本地完成，不上传至服务器。
