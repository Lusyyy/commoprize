import React, { useContext } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

// Route untuk role tertentu (admin atau user)
const PrivateRoute = ({ requiredRole }) => {
  const { currentUser, loading } = useContext(AuthContext);

  if (loading) {
    return <div className="text-center mt-5">Loading...</div>;
  }

  if (!currentUser) {
    return <Navigate to="/login" />;
  }

  // Jika requiredRole tidak dispecify atau user memiliki role yang sesuai
  if (!requiredRole || (requiredRole === 'admin' && currentUser.is_admin)) {
    return <Outlet />;
  }

  // Redirect ke halaman yang sesuai dengan role user
  return <Navigate to={currentUser.is_admin ? '/admin' : '/'} />;
};

export default PrivateRoute;