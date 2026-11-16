import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const SERVER = 'http://localhost:8081'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    // ให้เปิดผ่าน tunnel จากมือถือได้ (cloudflared / ngrok)
    allowedHosts: ['.trycloudflare.com', '.ngrok-free.app', '.ngrok.app'],
    proxy: {
      // axios ทั้งหมดเรียก /backend/... -> ตัด /backend ออกแล้วส่งไป server
      '/backend': {
        target: SERVER,
        rewrite: (path) => path.replace(/^\/backend/, ''),
      },
      // ส่งต่อตรงๆ (ไม่มีหน้าเว็บที่ขึ้นต้นด้วย path พวกนี้)
      // /api/line/webhook, /api/garmin/webhook ให้ LINE/Garmin เรียกผ่าน tunnel เดียวกับเว็บได้
      // /auth/line คือ magic link จากปุ่มใน LINE
      '/api': SERVER,
      '/auth': SERVER,
    },
  },
})
