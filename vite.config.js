import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // 必须保持单 chunk 源码 < 1MB：esbuild 处理 ≥1MB 的 transform 输入时会落到
        // %TEMP%\esbuild-*，该临时文件在 Windows 上删除失败（Access is denied）会直接中断构建。
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-icons': ['lucide-react'],
        },
      },
    },
  },
})
