import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Home from './pages/Home.jsx'
import Login from './pages/Login.jsx'
import Register from './pages/Register.jsx'
import Welcome from './pages/Welcome.jsx'
import Dashboard from './pages/dashboard.jsx'
import Data from './pages/data.jsx'
import Report from './pages/report.jsx'
import Party from './pages/party.jsx'
import Setting from './pages/setting.jsx'
import Appointments from './pages/Appointments.jsx' // 1. เพิ่ม Import ตรงนี้

import AdminHome from './pages/adminHome.jsx'
import AdminDashboard from './pages/AdminDashboard.jsx'
import ProtectedRoute from './ProtectedRoute.jsx'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* === ฝั่ง USER === */}
        <Route 
          path="/" 
          element={
            <ProtectedRoute allowedRole="user">
              <Home />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="data" element={<Data />} />
          <Route path="report" element={<Report />} />
          <Route path="party" element={<Party />} />
          <Route path="setting" element={<Setting />} />
          
          {/* 2. วางไว้ตรงนี้ (พาธจะเป็น /appointments) */}
          <Route path="appointments" element={<Appointments />} />
        </Route>

        {/* === ฝั่ง ADMIN === */}
        <Route 
          path="/admin" 
          element={
            <ProtectedRoute allowedRole="admin">
              <AdminHome />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="dashboard" element={<AdminDashboard />} />
        </Route>

        {/* === หน้า PUBLIC === */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/welcome" element={<Welcome />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App