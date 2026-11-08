import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { HandHeart, Heart, Lock, Mail, UserRound } from 'lucide-react'
import api, { getErrorMessage } from '../api.js'

function Register() {
  const [values, setValues] = useState({ name: '', email: '', password: '', confirmPassword: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleChange = (e) => {
    setValues({ ...values, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (values.password !== values.confirmPassword) {
      setError('รหัสผ่านทั้งสองช่องไม่ตรงกัน')
      return
    }
    setLoading(true)
    try {
      // เบอร์โทรไม่ต้องกรอกตอนสมัคร (server เก็บเป็น NULL) ผู้ใช้เพิ่มเองได้ในหน้าตั้งค่า
      const { name, email, password } = values
      await api.post('/register', { name, email, password })
      // สมัครสำเร็จ: ไปหน้ายินดีต้อนรับ พร้อมส่งชื่อไปแสดง
      navigate('/welcome', { state: { name } })
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const inputClass =
    'w-full rounded-2xl border border-white/80 bg-white/80 py-3 pl-11 pr-4 text-sm text-slate-700 shadow-sm outline-none transition placeholder:text-slate-300 focus:border-pink-300 focus:bg-white focus:ring-4 focus:ring-pink-200/60'
  const iconClass = 'pointer-events-none absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-pink-300'
  const labelClass = 'mb-2 block text-sm text-slate-600'

  return (
    <div className="relative min-h-screen overflow-hidden bg-linear-to-br from-pink-100 via-pink-200 to-pink-300 px-4 py-10 font-prompt sm:px-8">
      {/* แสงฟุ้งและฟองตกแต่งพื้นหลัง */}
      <span className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/30 blur-3xl" />
      <span className="pointer-events-none absolute bottom-16 left-10 hidden h-28 w-28 rounded-full bg-pink-400/40 md:block" />
      <span className="pointer-events-none absolute bottom-36 left-40 hidden h-10 w-10 rounded-full bg-pink-400/40 md:block" />
      <span className="pointer-events-none absolute bottom-6 left-36 hidden h-16 w-16 rounded-full bg-pink-400/40 md:block" />

      <div className="relative mx-auto grid min-h-[calc(100vh-5rem)] max-w-6xl items-center gap-10 md:grid-cols-[2fr_3fr]">
        {/* ฝั่งซ้าย: แบรนด์ */}
        <div className="hidden flex-col items-center text-pink-500 md:flex">
          <p className="mb-6 text-lg font-semibold tracking-wide">PINK STUDIO</p>

          <div className="relative h-56 w-56">
            <span className="absolute inset-0 rounded-full bg-white/40" />
            <span className="absolute inset-8 rounded-full border-2 border-white" />
            <Heart
              className="absolute left-1/2 top-1/2 h-20 w-20 -translate-x-1/2 -translate-y-1/2 text-white"
              strokeWidth={1.5}
            />
          </div>

          <h2 className="-mt-6 text-5xl font-bold leading-tight drop-shadow-sm">
            เริ่มต้น
            <br />
            <span className="pl-12">ไปด้วยกัน</span>
          </h2>
        </div>

        {/* ฝั่งขวา: การ์ดฟอร์มสมัครสมาชิก */}
        <form
          onSubmit={handleSubmit}
          className="mx-auto w-full max-w-2xl rounded-[2rem] border border-white/70 bg-white/35 p-8 shadow-2xl shadow-pink-400/20 backdrop-blur-xl sm:p-10"
        >
          <p className="mb-6 text-sm font-semibold tracking-wide text-pink-500 md:hidden">PINK STUDIO</p>

          <h1 className="flex items-center gap-2 text-3xl font-bold text-pink-500">
            สร้างบัญชีใหม่
            <HandHeart className="h-8 w-8" strokeWidth={2} aria-hidden="true" />
          </h1>
          <p className="mt-1 text-sm text-slate-500">สร้างบัญชีของคุณเพื่อเข้าใช้ PINK STUDIO</p>

          {error && (
            <p role="alert" className="mt-6 rounded-2xl bg-red-50/90 px-4 py-3 text-sm text-red-600">
              {error}
            </p>
          )}

          <div className="mt-8 grid gap-x-6 gap-y-5 sm:grid-cols-2">
            <div>
              <label htmlFor="name" className={labelClass}>ชื่อ - นามสกุล</label>
              <div className="relative">
                <UserRound className={iconClass} aria-hidden="true" />
                <input
                  id="name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  placeholder="กรอกชื่อ-นามสกุลของคุณ"
                  required
                  value={values.name}
                  onChange={handleChange}
                  className={inputClass}
                />
              </div>
            </div>

            <div>
              <label htmlFor="email" className={labelClass}>อีเมล</label>
              <div className="relative">
                <Mail className={iconClass} aria-hidden="true" />
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

            <div>
              <label htmlFor="password" className={labelClass}>รหัสผ่าน</label>
              <div className="relative">
                <Lock className={iconClass} aria-hidden="true" />
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="อย่างน้อย 8 ตัวอักษร"
                  required
                  minLength={8}
                  value={values.password}
                  onChange={handleChange}
                  className={inputClass}
                />
              </div>
            </div>

            <div>
              <label htmlFor="confirmPassword" className={labelClass}>ยืนยันรหัสผ่าน</label>
              <div className="relative">
                <Lock className={iconClass} aria-hidden="true" />
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  placeholder="กรอกรหัสผ่านอีกครั้ง"
                  required
                  value={values.confirmPassword}
                  onChange={handleChange}
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          <label className="mt-6 flex items-center gap-3 text-sm text-slate-500">
            <input type="checkbox" required className="h-4 w-4 shrink-0 accent-pink-500" />
            <span>
              ยินยอมรับ<span className="text-pink-500">ข้อกำหนดและนโยบายความเป็นส่วนตัว</span>
            </span>
          </label>

          <div className="mt-6 flex justify-center">
            <button
              type="submit"
              disabled={loading}
              className="w-full max-w-xs cursor-pointer rounded-2xl bg-linear-to-r from-pink-300 to-pink-500 py-3.5 font-semibold text-white shadow-lg shadow-pink-400/30 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'กำลังสร้างบัญชี...' : 'สมัครสมาชิก'}
            </button>
          </div>

          <p className="mt-5 text-center text-sm text-slate-400">
            มีบัญชีอยู่แล้ว?
            <Link to="/login" className="ml-4 font-semibold text-pink-500 hover:underline">
              เข้าสู่ระบบ
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}

export default Register
