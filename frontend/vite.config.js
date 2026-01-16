import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/',
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: '../public',
    emptyOutDir: false,
    // Increase chunk size warning limit since we're now splitting properly
    chunkSizeWarningLimit: 300,
    rollupOptions: {
      output: {
        assetFileNames: 'assets/[name]-[hash][extname]',
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        // Manual chunks for better code splitting
        manualChunks: {
          // Core React libraries - loaded once, cached forever
          'vendor-react': ['react', 'react-dom'],
          // Router - needed for navigation
          'vendor-router': ['react-router-dom'],
          // Data fetching - used across app
          'vendor-query': ['@tanstack/react-query'],
          // HTTP client
          'vendor-axios': ['axios'],
          // Icons - large library, separate chunk
          'vendor-icons': ['lucide-react'],
        },
      },
    },
  },
})
