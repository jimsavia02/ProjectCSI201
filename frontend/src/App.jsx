import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Home from './pages/Home.jsx'
import Login from './pages/Login.jsx'
import Register from './pages/Register.jsx'
import Dashboard from './pages/dashboard.jsx'
import Data from './pages/data.jsx'
import Report from './pages/report.jsx'
import Party from './pages/party.jsx'
import Setting from './pages/setting.jsx'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="data" element={<Data />} />
          <Route path="report" element={<Report />} />
          <Route path="party" element={<Party />} />
          <Route path="setting" element={<Setting />} />
        </Route>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
