import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
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
      setError('Passwords do not match')
      return
    }
    setLoading(true)
    try {
      const { name, email, password } = values
      await api.post('/register', { name, email, password })
      navigate('/login')
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const inputClass =
    'mt-1 w-full rounded border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500'

  return (
<div className="min-h-screen bg-[#fffafd]">
  <div className="flex min-h-screen w-full overflow-hidden bg-[#fffafd]">
        <aside className="hidden w-[228px] shrink-0 bg-[#ffedf3] px-6 py-8 md:block">
          <div className="mb-10 flex items-center gap-4">
            <div className="grid h-13 w-13 place-items-center rounded-2xl bg-[#fa6c9e] text-3xl text-white">
              ♡
            </div>
            <div>
              <strong className="block text-[17px] text-[#3c3038]">PINK STUDIO</strong>
              <span className="text-xs text-[#a88e9b]">MEMBER SPACE</span>
            </div>
          </div>

          <nav className="space-y-3">
            <a href="#" className="block rounded-2xl px-4 py-3 text-[#917d88]">
              ⌂ หน้าหลัก
            </a>
            <a
              href="#"
              className="block rounded-2xl border border-[#ff9cba] bg-white px-4 py-3 font-medium text-[#f05289]"
            >
              ♡ สมัครสมาชิก
            </a>
            <a href="#" className="block rounded-2xl px-4 py-3 text-[#917d88]">
              ♧ สมาชิก
            </a>
            <a href="#" className="block rounded-2xl px-4 py-3 text-[#917d88]">
              ⚙ ตั้งค่า
            </a>
          </nav>
        </aside>

        {/* เนื้อหาหลัก */}
        <main className="relative flex-1 px-5 py-8 md:px-12 md:py-12">
          <Link to="/login" className="text-sm text-[#a28d98] hover:underline">
            กลับหน้าเข้าสู่ระบบ
          </Link>

          <h1 className="mt-5 text-3xl font-semibold text-[#3c3038]">
            สร้างบัญชีใหม่
          </h1>
          <p className="mb-7 text-[#8e7c87]">กรอกข้อมูลเพื่อเริ่มต้นใช้งาน</p>

          {/* วงกลมหัวใจตกแต่ง */}
          <div className="absolute right-10 top-16 hidden h-36 w-36 items-center justify-center rounded-full bg-[#ff9dbc] text-5xl text-[#f4518c] md:flex">
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[#ffd9e5]">
              ♥
            </div>
          </div>


          <form
            onSubmit={handleSubmit}
            className="rounded-[22px] border border-[#f1dce5] bg-white p-5 md:mt-7 md:p-7"
          >
            {/* ขั้นตอน */}
            <div className="mb-7 flex items-center gap-3 text-sm">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#fa6c9e] text-base font-semibold text-white">
                1
              </span>
              <span className="shrink-0 text-[#f05289]">ข้อมูลส่วนตัว</span>
              <span className="h-[3px] flex-1 bg-[#f6cedd]" />
              <span className="shrink-0 text-[#a9939e]">2　ตั้งค่าบัญชี</span>
              <span className="hidden h-[3px] flex-1 bg-[#f6cedd] sm:block" />

            </div>

            {error && (
              <p
                role="alert"
                className="mb-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                {error}
              </p>
            )}

            <div className="grid gap-x-6 gap-y-5 md:grid-cols-2">
              <div>
                <label htmlFor="name" className="mb-2 block text-[#786671]">
                  ชื่อ - นามสกุล
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  placeholder="กรอกชื่อของคุณ"
                  required
                  value={values.name}
                  onChange={handleChange}
                  className="w-full rounded-[14px] border border-[#e9d7e0] px-4 py-4 outline-none placeholder:text-[#a9939e] focus:border-[#f66c9c] focus:ring-2 focus:ring-[#ffe3ed]"
                />
              </div>

              <div>
                <label htmlFor="email" className="mb-2 block text-[#786671]">
                  อีเมล
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="name@example.com"
                  required
                  value={values.email}
                  onChange={handleChange}
                  className="w-full rounded-[14px] border border-[#e9d7e0] px-4 py-4 outline-none placeholder:text-[#a9939e] focus:border-[#f66c9c] focus:ring-2 focus:ring-[#ffe3ed]"
                />
              </div>

              <div>
                <label htmlFor="phone" className="mb-2 block text-[#786671]">
                  เบอร์โทรศัพท์
                </label>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  placeholder="08X-XXX-XXXX"
                  className="w-full rounded-[14px] border border-[#e9d7e0] px-4 py-4 outline-none placeholder:text-[#a9939e] focus:border-[#f66c9c] focus:ring-2 focus:ring-[#ffe3ed]"
                />
              </div>

              <div>
                <label htmlFor="password" className="mb-2 block text-[#786671]">
                  รหัสผ่าน
                </label>
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
                  className="w-full rounded-[14px] border border-[#e9d7e0] px-4 py-4 outline-none placeholder:text-[#a9939e] focus:border-[#f66c9c] focus:ring-2 focus:ring-[#ffe3ed]"
                />
              </div>
              <div className="md:col-span-2">
                <label
                  htmlFor="confirmPassword"
                  className="mb-2 block text-[#786671]"
                >
                  ยืนยันรหัสผ่าน
                </label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  placeholder="กรอกรหัสผ่านอีกครั้ง"
                  required
                  value={values.confirmPassword}
                  onChange={handleChange}
                  className="w-full rounded-[14px] border border-[#e9d7e0] px-4 py-4 outline-none placeholder:text-[#a9939e] focus:border-[#f66c9c] focus:ring-2 focus:ring-[#ffe3ed]"
                />
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <label className="flex items-center gap-3 text-sm text-[#9d8994]">
                <input
                  type="checkbox"
                  required
                  className="h-5 w-5 accent-[#fa6c9e]"
                />
                ยินยอมรับข้อกำหนดและนโยบายความเป็นส่วนตัว
              </label>

              <button
                type="submit"
                disabled={loading}
                className="rounded-[15px] bg-gradient-to-r from-[#ff83ad] to-[#f34c8c] px-10 py-3 text-lg font-medium text-white transition hover:brightness-95 disabled:opacity-60"
              >
                {loading ? 'กำลังสร้างบัญชี...' : 'ถัดไป'}
              </button>
            </div>

            <p className="mt-5 text-sm text-[#9d8994]">
              มีบัญชีอยู่แล้ว?{' '}
              <Link to="/login" className="text-[#f05289] hover:underline">
                เข้าสู่ระบบ
              </Link>
            </p>
          </form>
        </main>
      </div>
    </div>
  )
}

export default Register
