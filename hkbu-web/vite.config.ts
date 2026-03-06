import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/',   // Firebase Hosting serves from root
  plugins: [react()],
  server: {
    proxy: {
      '/hkbu-api': {
        target: 'https://genai.hkbu.edu.hk',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/hkbu-api/, '/api/v0/rest'),
      },
      '/hkbu-img': {
        target: 'https://sa.hkbu.edu.hk',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/hkbu-img/, ''),
      },
    },
  },
})
