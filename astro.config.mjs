import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  output: 'static',
  vite: {
    plugins: [tailwindcss()],
    server: {
      proxy: Object.fromEntries(['/studio', '/api/staff', '/api/booking'].map(prefix => [prefix, {
        target: 'http://127.0.0.1:8766',
        changeOrigin: false,
        timeout: 15000,
        proxyTimeout: 15000
      }]))
    }
  }
});
