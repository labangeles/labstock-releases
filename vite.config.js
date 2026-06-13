import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',

  // Optimizar dependencias en desarrollo (menos recompilaciones)
  optimizeDeps: {
    include: ['react', 'react-dom', '@supabase/supabase-js', 'xlsx'],
  },

  build: {
    target: 'esnext',          // Electron usa Chromium moderno — output más pequeño
    minify: 'esbuild',         // Más rápido que terser
    sourcemap: false,
    chunkSizeWarningLimit: 1000,

    rollupOptions: {
      output: {
        // Separar vendors pesados en chunks independientes — mejor cache del browser
        manualChunks: {
          'vendor-react':    ['react', 'react-dom'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-xlsx':     ['xlsx'],
        },
      },
    },
  },
})
