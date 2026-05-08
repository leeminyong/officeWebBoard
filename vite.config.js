import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  publicDir: false,
  server: {
    host: true,   // 192.168.0.139 같은 네트워크 주소로도 접속 가능하게 합니다
    port: 5173,
    proxy: {
      // /api, /uploads 요청은 백엔드 서버(3000번 포트)로 전달합니다
      '/api': 'http://localhost:3000',
      '/uploads': 'http://localhost:3000',
    },
  },
})
