import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  publicDir: 'public', // Ensure public directory is copied to dist
  build: {
    outDir: 'dist',
    // Minify for production
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: false, // Keep console for debugging in production
        drop_debugger: true,
      },
    },
    // Generate sourcemaps for debugging
    sourcemap: true,
    rollupOptions: {
      output: {
        // Clean asset names
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
    // Set chunk size warning limit
    chunkSizeWarningLimit: 1000,
  },
})
