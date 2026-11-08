import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { HandHeart, Heart, Lock, Mail } from 'lucide-react'
import api, { getErrorMessage } from '../api.js'

function Login() {
  const [values, setValues] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleChange = (e) => {
    setValues({ ...values, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // 1. ส่งข้อมูล Login ไปที่ Backend (server จะตั้ง cookie "token" ให้)
      const res = await api.post('/login', values)
      const user = res.data.user || res.data

      // 2. เก็บข้อมูลผู้ใช้ไว้ให้ ProtectedRoute ใช้ตรวจสิทธิ์
      localStorage.setItem('user', JSON.stringify(user))
      if (res.data.token) {
        localStorage.setItem('token', res.data.token)
      }

      // 3. ไปหน้าหลักตาม role
      if (user && user.role === 'admin') {
        navigate('/admin/dashboard')
      } else {
        navigate('/dashboard')
      }
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const inputClass =
    'w-full rounded-2xl border border-white/80 bg-white py-3.5 pl-12 pr-4 text-sm text-slate-700 shadow-sm outline-none transition placeholder:text-slate-300 focus:border-pink-300 focus:ring-4 focus:ring-pink-200/60'

  return (
    <div className="relative min-h-screen overflow-hidden bg-linear-to-br from-pink-100 via-pink-200 to-pink-300 px-4 py-10 font-prompt sm:px-8">
      {/* แสงฟุ้งตกแต่งพื้นหลัง */}
      <span className="pointer-events-none absolute -left-24 -top-24 h-96 w-96 rounded-full bg-white/30 blur-3xl" />
      <span className="pointer-events-none absolute -bottom-32 right-0 h-112 w-md rounded-full bg-pink-400/30 blur-3xl" />

      <div className="relative mx-auto grid min-h-[calc(100vh-5rem)] max-w-6xl items-center gap-10 md:grid-cols-2">
        {/* ฝั่งซ้าย: แบรนด์ */}
        <div className="relative hidden flex-col text-white md:flex">
          <span className="absolute right-16 top-0 h-5 w-5 rounded-full bg-white/70" />
          <span className="absolute right-6 top-12 h-2.5 w-2.5 rounded-full bg-white/90" />

          <p className="mb-6 pl-8 text-lg font-semibold tracking-wide">PINK STUDIO</p>

          <div className="relative h-56 w-56">
            <span className="absolute inset-0 rounded-full bg-white/25" />
            <span className="absolute inset-8 rounded-full border-2 border-white/90" />
            <Heart
              className="absolute left-1/2 top-1/2 h-20 w-20 -translate-x-1/2 -translate-y-1/2"
              strokeWidth={1.5}
            />
          </div>

          <h2 className="-mt-14 text-5xl font-bold leading-tight drop-shadow-sm">
            Hello,
            <br />
            beautiful day.
          </h2>
          <p className="mt-5 max-w-xs leading-relaxed text-white/90">
            พื้นที่ดิจิทัลที่ออกแบบมาให้ใช้งาน
            <br />
            ได้อย่างสบายใจในทุกวัน
          </p>

          <svg
            viewBox="0 0 400 100"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            className="mt-4 w-full max-w-md opacity-70"
            aria-hidden="true"
          >
            <path d="M5 80c50-30 80 20 140-5s90-20 130-25 80-20 120-45" />
          </svg>
        </div>

        {/* ฝั่งขวา: การ์ดฟอร์มเข้าสู่ระบบ */}
        <form
          onSubmit={handleSubmit}
          className="mx-auto w-full max-w-md rounded-[2rem] border border-white/70 bg-white/35 p-8 shadow-2xl shadow-pink-400/20 backdrop-blur-xl sm:p-10"
        >
          <p className="mb-6 text-sm font-semibold tracking-wide text-pink-500 md:hidden">PINK STUDIO</p>

          <h1 className="flex items-center gap-2 text-3xl font-bold text-slate-800">
            ยินดีต้อนรับ
            <HandHeart className="h-8 w-8 text-pink-500" strokeWidth={2} aria-hidden="true" />
          </h1>
          <p className="mt-1 text-sm text-slate-500">เข้าสู่ระบบเพื่อไปต่อ</p>

          {error && (
            <p role="alert" className="mt-6 rounded-2xl bg-red-50/90 px-4 py-3 text-sm text-red-600">
              {error}
            </p>
          )}

          <div className="mt-8">
            <label htmlFor="email" className="mb-2 block text-sm text-slate-600">
              อีเมล
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-pink-300" aria-hidden="true" />
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="name@example.com"
                required
                value={values.email}
                onChange={handleChange}
                className={inputClass}
              />
            </div>
          </div>

          <div className="mt-6">
            <label htmlFor="password" className="mb-2 block text-sm text-slate-600">
              รหัสผ่าน
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-pink-300" aria-hidden="true" />
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                required
                value={values.password}
                onChange={handleChange}
                className={inputClass}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-8 w-full cursor-pointer rounded-2xl bg-linear-to-r from-pink-300 to-pink-500 py-3.5 font-semibold text-white shadow-lg shadow-pink-400/30 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
          </button>

          <p className="mt-6 text-sm text-slate-400">
            ยังไม่มีบัญชี?
            <Link to="/register" className="ml-4 font-semibold text-pink-500 hover:underline">
              สมัครสมาชิก
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}

export default Login
