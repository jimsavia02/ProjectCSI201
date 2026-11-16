import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import api from './api.js';

const readStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem('user'));
  } catch {
    return null;
  }
};

function ProtectedRoute({ children, allowedRole }) {
  const [user, setUser] = useState(readStoredUser);
  // ไม่มี user ใน localStorage แต่อาจมี cookie อยู่แล้ว (เข้าผ่าน magic link จาก LINE) -> ถาม /me ก่อน
  const [checking, setChecking] = useState(!user);

  useEffect(() => {
    if (user) return;
    let ignore = false;
    api
      .get('/me')
      .then((res) => {
        if (ignore) return;
        localStorage.setItem('user', JSON.stringify(res.data));
        setUser(res.data);
      })
      .catch(() => {})
      .finally(() => !ignore && setChecking(false));
    return () => {
      ignore = true;
    };
  }, [user]);

  if (checking) return null;

  // 1. ยังไม่ได้ล็อกอิน -> ส่งไปหน้า /login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // 2. Role ไม่ตรง -> ส่งไปหน้าหลักของ Role ตัวเอง
  if (allowedRole && user.role !== allowedRole) {
    if (user.role === 'admin') {
      return <Navigate to="/admin/dashboard" replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

export default ProtectedRoute;
