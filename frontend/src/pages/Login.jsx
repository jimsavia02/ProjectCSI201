import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
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
      await api.post('/login', values)
      navigate('/')
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid min-h-screen md:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-linear-to-br from-pink-200 to-pink-400 p-12 text-white md:flex md:flex-col">
        {/* Decorative dots, top right */}
        <span className="absolute right-24 top-14 h-5 w-5 rounded-full bg-white/60" />
        <span className="absolute right-16 top-24 h-2.5 w-2.5 rounded-full bg-white/80" />

        <div className="relative flex flex-1 flex-col justify-center">
          {/* Heart inside two soft circles */}
          <div className="mb-8 flex items-center gap-12">
          <div className="relative h-44 w-44 shrink-0">
            <span className="absolute -inset-6 rounded-full bg-white/15" />
            <span className="absolute inset-0 rounded-full border-2 border-white/80" />
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="absolute left-1/2 top-1/2 h-30 w-30 -translate-x-1/2 -translate-y-1/2"
              aria-hidden="true"
            >
              <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />
            </svg>
          </div>
            <p className="text-2xl font-bold tracking-wide">PINK STUDIO</p>
          </div>

          <h2 className="text-5xl font-bold leading-tight">
            Hello,<br />beautiful day.
          </h2>
          <p className="mt-5 max-w-xs text-lg leading-relaxed">
            พื้นที่ดิจิทัลที่ออกแบบมาให้ใช้งานได้อย่างสบายใจในทุกวัน
          </p>

          {/* Wavy line */}
          <svg
            viewBox="0 0 400 100"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            className="mt-2 w-full max-w-md opacity-70"
            aria-hidden="true"
          >
            <path d="M5 80c50-30 80 20 140-5s90-20 130-25 80-20 120-45" />
          </svg>
        </div>
      </div>

      <div className="flex items-center justify-center bg-pink-50 p-8">
        <form onSubmit={handleSubmit} className="w-full max-w-md space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-800">ยินดีต้อนรับ</h1>
            <p className="mt-2 text-slate-600">เข้าสู่ระบบเพื่อไปต่อ</p>
          </div>

          {error && (
            <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700">อีเมล</label>
            <div className="relative mt-2">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-pink-300"
                aria-hidden="true"
              >
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <path d="m3 7 9 6 9-6" />
              </svg>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="name@example.com"
                required
                value={values.email}
                onChange={handleChange}
                className="w-full rounded-xl border border-pink-200 bg-white py-3 pl-12 pr-4 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-pink-400"
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700">รหัสผ่าน</label>
            <div className="relative mt-2">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-pink-300"
                aria-hidden="true"
              >
                <rect x="5" y="11" width="14" height="10" rx="2" />
                <path d="M8 11V7a4 4 0 0 1 8 0v4" />
              </svg>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                required
                value={values.password}
                onChange={handleChange}
                className="w-full rounded-xl border border-pink-200 bg-white py-3 pl-12 pr-4 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-pink-400"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-linear-to-r from-pink-400 to-pink-500 py-3 font-bold text-white shadow-sm hover:from-pink-500 hover:to-pink-600 disabled:opacity-60"
          >
            {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
          </button>

          <p className="text-sm text-slate-600">
            ยังไม่มีบัญชี?{' '}
            <Link to="/register" className="ml-4 font-bold text-pink-500 hover:underline">สมัครสมาชิก</Link>
          </p>
        </form>
      </div>
    </div>
  )
}

export default Login
