import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';
import { readFileSync } from 'fs';
const pkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf-8'));
export default defineConfig({
    plugins: [vue()],
    define: {
        __APP_VERSION__: JSON.stringify(pkg.version || '0.0.0'),
    },
    resolve: {
        alias: {
            '@': resolve(__dirname, 'src'),
        },
    },
    base: '/',
    build: {
        /** 避免入口为异步 chunk 注入对 jspdf 等的静态 import + modulepreload（首页只应加载 Vue + Home） */
        modulePreload: false,
        minify: 'esbuild',
        sourcemap: false,
        rollupOptions: {
            output: {
                // 仅拆分 pdfjs；勿把 jspdf 强行 manualChunks，否则 Vite 的 preload 辅助会与 jspdf 同 chunk，入口会为路由懒加载静态拉取整份 jspdf
                manualChunks: {
                    pdfjs: ['pdfjs-dist'],
                },
            },
        },
    },
});
