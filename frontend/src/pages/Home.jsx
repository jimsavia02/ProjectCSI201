import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api, { getErrorMessage } from '../api.js'

function Home() {
  const [user, setUser] = useState(null)
  const [error, setError] = useState('')
  const navigate = useNavigate()

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
    <div className="min-h-screen bg-slate-100">
      <header className="flex items-center justify-between bg-white px-6 py-4 shadow">
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
      <main className="p-6 text-slate-700">Welcome, {user.name}</main>
    </div>
  )
}

export default Home
