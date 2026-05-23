import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],

  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5001',
        changeOrigin: true,
      },
    },
  },

  build: {
    target: 'esnext',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info', 'console.debug', 'console.warn'],
        passes: 2,
      },
      mangle: { toplevel: true },
    },
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Three.js + react-three — biggest chunks, always lazy-loaded
          if (id.includes('three') || id.includes('@react-three')) {
            return 'three';
          }
          // chart.js / react-chartjs-2
          if (id.includes('chart.js') || id.includes('react-chartjs-2')) {
            return 'charts-cjs';
          }
          // recharts
          if (id.includes('recharts') || id.includes('victory-vendor')) {
            return 'charts-recharts';
          }
          // framer-motion
          if (id.includes('framer-motion')) {
            return 'motion';
          }
          // lenis smooth scroll
          if (id.includes('lenis')) {
            return 'lenis';
          }
          // React core — keep tiny for fastest TTI
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) {
            return 'react-core';
          }
          // Router
          if (id.includes('react-router-dom') || id.includes('@remix-run')) {
            return 'router';
          }
          // Icons
          if (id.includes('lucide-react')) {
            return 'icons';
          }
          // Everything else from node_modules
          if (id.includes('node_modules')) {
            return 'vendor';
          }
        },
      },
    },
  },
})
