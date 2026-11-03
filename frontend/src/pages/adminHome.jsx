import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import api, { getErrorMessage } from '../api.js'

function AdminHome() {
  const [adminUser, setAdminUser] = useState(null)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const adminMenuItems = [
    {
      to: '/admin/dashboard',
      label: 'ภาพรวม',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0">
          <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
        </svg>
      ),
    },
    {
      to: '/admin/users',
      label: 'ผู้ใช้งาน',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0">
          <circle cx="9" cy="7" r="4" />
          <path d="M17 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
          <path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
        </svg>
      ),
    },
    {
      to: '/admin/devices',
      label: 'อุปกรณ์',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0">
          <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
          <line x1="12" y1="18" x2="12.01" y2="18" />
        </svg>
      ),
    },
    {
      to: '/admin/support',
      label: 'ซัพพอร์ต',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0">
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
        </svg>
      ),
    },
    {
      to: '/admin/reports',
      label: 'รายงาน',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
      ),
    },
    {
      to: '/admin/settings',
      label: 'ตั้งค่า',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      ),
    },
  ]

  useEffect(() => {
    api.get('/me')
      .then((res) => {
        if (res.data.role !== 'admin') {
          navigate('/dashboard')
        } else {
          setAdminUser(res.data)
        }
      })
      .catch((err) => {
        if (err.response?.status === 401) {
          localStorage.removeItem('user')
          localStorage.removeItem('token')
          navigate('/login')
        } else {
          setError(getErrorMessage(err))
        }
      })
  }, [navigate])

  const handleLogout = async () => {
    try {
      await api.post('/logout')
    } catch (err) {
      console.error('Logout error:', err)
    } finally {
      localStorage.removeItem('user')
      localStorage.removeItem('token')
      navigate('/login')
    }
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
        <p role="alert" className="rounded-xl bg-red-50 px-6 py-4 text-sm text-red-700 shadow-xs">
          {error}
        </p>
      </div>
    )
  }

  if (!adminUser) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 text-sm font-medium text-slate-500">
        กำลังโหลดข้อมูล...
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="w-60 shrink-0 border-r border-pink-100 bg-pink-50 px-5 py-6 text-slate-600">
        <div className="mb-8 flex items-center gap-3 px-1">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-pink-500 text-white shadow-xs">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6" aria-hidden="true">
              <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />
            </svg>
          </span>
          <div className="min-w-0">
            <p className="truncate text-xs font-bold tracking-wide text-slate-800">PINK STUDIO</p>
            <p className="text-[10px] font-semibold tracking-wider text-slate-400">ADMIN SPACE</p>
          </div>
        </div>

        <nav aria-label="เมนูผู้ดูแลระบบ" className="space-y-1.5">
          {adminMenuItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `flex w-full items-center gap-3 rounded-full px-4 py-2.5 text-left text-sm font-medium transition-all ${
                isActive
                  ? 'bg-pink-500 font-bold text-white shadow-xs'
                  : 'text-slate-600 hover:bg-white hover:text-pink-500'
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="min-w-0 flex-1 px-8 py-8">
        <header className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-800">แดชบอร์ดผู้ดูแลระบบ</h1>
            <p className="mt-1 text-sm text-slate-500">ภาพรวมของระบบ Smart Watch Care ทั้งหมด</p>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-lg font-semibold text-slate-800">
              {adminUser.name} <span className="text-sm font-medium text-slate-400">(Admin)</span>
            </span>
            <button
              onClick={handleLogout}
              className="rounded-full bg-pink-500 px-6 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-pink-600 transition-colors cursor-pointer"
            >
              Logout
            </button>
          </div>
        </header>

        <main>
          <Outlet context={{ adminUser }} />
        </main>
      </div>
    </div>
  )
}

export default AdminHome