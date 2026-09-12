import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 3000
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-pdf': ['pdfjs-dist'],
          'vendor-docs': ['mammoth', 'jszip'],
          'vendor-p2p': ['peerjs', 'qrcode']
        }
      }
    }
  }
});
