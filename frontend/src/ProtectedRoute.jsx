import { Navigate } from 'react-router-dom';

function ProtectedRoute({ children, allowedRole }) {
  const user = JSON.parse(localStorage.getItem('user'));

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