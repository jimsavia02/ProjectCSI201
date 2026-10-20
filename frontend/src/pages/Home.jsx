import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import api, { getErrorMessage } from '../api.js'

function Home() {
  const [user, setUser] = useState(null)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const menuItems = [
    {
      to: '/dashboard',
      label: 'ภาพรวม',
      icon: <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
    },
    {
      to: '/data',
      label: 'ข้อมูล',
      icon: <path d="M4 5h16M4 12h16M4 19h16M7 5v.01M7 12v.01M7 19v.01" />,
    },
    {
      to: '/report',
      label: 'รายงาน',
      icon: <><path d="M4 19V5" /><path d="M4 19h17" /><path d="m7 15 4-4 3 2 5-6" /></>,
    },
    {
      to: '/party',
      label: 'สมาชิก',
      icon: <><circle cx="9" cy="8" r="3" /><path d="M3 20v-1a6 6 0 0 1 12 0v1zM16 5.5a3 3 0 0 1 0 5.8M18 14a5 5 0 0 1 3 4.6v1" /></>,
    },
    {
      to: '/setting',
      label: 'ตั้งค่า',
      icon: <><circle cx="12" cy="12" r="3" /><path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.6a8 8 0 0 1-1.7 1l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-1.7-1l-1.7.6-1.4-2.4L7.3 15a8 8 0 0 1 0-2l-1.4-1.1 1.4-2.4 1.7.6a8 8 0 0 1 1.7-1l.3-1.8h2.8l.3 1.8a8 8 0 0 1 1.7 1l1.7-.6 1.4 2.4-1.4 1.1a8 8 0 0 1-.1 2z" /></>,
    },
  ]

  // Ask the server who is logged in; go to the login page if nobody is
  useEffect(() => {
    api.get('/me')
      .then((res) => setUser(res.data))
      .catch((err) => {
        if (err.response?.status === 401) {
          navigate('/login')
        } else {
          setError(getErrorMessage(err))
        }
      })
  }, [navigate])

  const handleLogout = async () => {
    try {
      await api.post('/logout')
      navigate('/login')
    } catch (err) {
      setError(getErrorMessage(err))
    }
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 px-4">
        <p role="alert" className="rounded bg-red-50 px-4 py-3 text-red-700">{error}</p>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 text-slate-500">
        Loading...
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-slate-100">
      <aside className="w-56 shrink-0 bg-pink-50 px-4 py-5 text-slate-600 max-sm:w-40 max-sm:px-3">
        <div className="mb-8 flex items-center gap-2.5 px-1">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-2 border-sky-400 bg-pink-400 text-white shadow-sm">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6" aria-hidden="true">
              <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />
            </svg>
          </span>
          <div className="min-w-0">
            <p className="truncate text-[11px] font-bold text-slate-800">PINK STUDIO</p>
            <p className="text-[9px] tracking-wide text-slate-400">YOUR SPACE</p>
          </div>
        </div>

        <nav aria-label="เมนูหลัก" className="space-y-1">
          {menuItems.map((item) => {
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${
                  isActive
                    ? 'bg-linear-to-r from-pink-400 to-pink-500 font-semibold text-white shadow-sm'
                    : 'text-slate-500 hover:bg-white/70 hover:text-pink-500'
                }`}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4 shrink-0"
                  aria-hidden="true"
                >
                  {item.icon}
                </svg>
                <span>{item.label}</span>
              </NavLink>
            )
          })}
        </nav>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="flex items-center justify-between bg-white px-6 py-4 shadow-sm">
          <h1 className="text-xl font-bold text-slate-800">Smart Watch Dashboard</h1>
          <div className="flex items-center gap-4">
            <span className="text-slate-600">{user.name}</span>
            <button
              onClick={handleLogout}
              className="rounded bg-pink-300 px-4 py-2 text-sm font-medium text-pink-950 hover:bg-pink-400"
            >
              Logout
            </button>
          </div>
        </header>
          <main className="p-6 text-slate-700">
            <Outlet context={{ user }} />
          </main>
        </div>
    </div>
  )
}

export default Home
