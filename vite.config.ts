import { defineConfig } from 'vite';

export default defineConfig({
  // relative base so the bundle works at any mount path (GitHub Pages serves under /<repo>/)
  base: './',
  build: {
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          motion: ['gsap', 'lenis'],
        },
      },
    },
  },
  server: {
    port: 5188,
    strictPort: false,
  },
});
