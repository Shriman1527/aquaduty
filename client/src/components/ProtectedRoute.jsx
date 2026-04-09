import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const ProtectedRoute = () => {
  const { isAuthenticated, loading } = useAuth();

  // If the app is still checking localStorage/API for the user, show a simple loader
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-xl font-semibold text-blue-600 animate-pulse">
          Loading AquaDuty...
        </div>
      </div>
    );
  }

  // If they are not logged in, boot them to the login page
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // If they ARE logged in, render whatever child routes are inside
  return <Outlet />;
};

export default ProtectedRoute;