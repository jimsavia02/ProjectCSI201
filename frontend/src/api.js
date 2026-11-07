import axios from 'axios'

// withCredentials makes the browser send the login cookie to the server
const api = axios.create({
  baseURL: 'http://localhost:8081',
  withCredentials: true,
})

export const getErrorMessage = (err) =>
  err.response?.data?.error || 'ไม่สามารถเชื่อมต่อ Server ได้'

export default api
