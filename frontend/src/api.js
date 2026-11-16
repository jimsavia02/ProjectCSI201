import axios from 'axios'

// withCredentials makes the browser send the login cookie to the server
// เรียกผ่าน /backend (Vite proxy ส่งต่อไป server ที่พอร์ต 8081) เพื่อให้เว็บกับ API อยู่โดเมนเดียวกัน
// เปิดจากมือถือผ่าน tunnel ได้ และ cookie จาก magic link ของ LINE ใช้กับ API ได้
const api = axios.create({
  baseURL: '/backend',
  withCredentials: true,
})

export const getErrorMessage = (err) =>
  err.response?.data?.error || 'ไม่สามารถเชื่อมต่อ Server ได้'

export default api
