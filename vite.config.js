import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: false,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
        rewrite: path => path.replace(/^\/api/, '/api'),
      }
    },
  },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          // Three.js gets its own chunk (lazy-loaded via HeroCanvas)
          'three-vendor': ['three'],
          // React ecosystem
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          // Data / queries
          'query-vendor': ['@tanstack/react-query', 'axios'],
        }
      }
    }
  }
});
