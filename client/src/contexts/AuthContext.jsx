import { createContext, useContext, useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../services/api';

// Create the context
const AuthContext = createContext();

// Create a custom hook to easily use this context in any component
export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  
  // loading is true by default so we don't flash the login screen 
  // while checking if the user already has a valid session
  const [loading, setLoading] = useState(true);

  // ─── 1. Check Auth Status on Load ───────────────────────────────────────────
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        // Hit your backend's /me endpoint
        const { data } = await api.get('/auth/me');
        setUser(data.data.user);
      } catch (error) {
        console.error('Session expired or invalid', error);
        localStorage.removeItem('accessToken');
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  // ─── 2. Login Method ────────────────────────────────────────────────────────
  const login = async (credentials) => {
    try {
      const { data } = await api.post('/auth/login', credentials);
      
      // Save token and set user state
      localStorage.setItem('accessToken', data.data.accessToken);
      setUser(data.data.user);
      
      toast.success(data.message || 'Logged in successfully!');
      return true; // Return true so the UI knows to redirect
    } catch (error) {
      toast.error(error.response?.data?.message || 'Login failed');
      return false;
    }
  };

  // ─── 3. Register Method ─────────────────────────────────────────────────────
  const register = async (userData) => {
    try {
      const { data } = await api.post('/auth/register', userData);
      // We don't auto-login here because they need to verify their email first
      toast.success(data.message || 'Registration successful! Please check your email.');
      return true;
    } catch (error) {
      toast.error(error.response?.data?.message || 'Registration failed');
      return false;
    }
  };

  // ─── 4. Logout Method ───────────────────────────────────────────────────────
  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (error) {
      console.error('Logout API error:', error);
    } finally {
      // Always clear local state even if API fails
      localStorage.removeItem('accessToken');
      setUser(null);
      toast.success('Logged out successfully');
      window.location.href = '/login'; // Force redirect to clear app memory
    }
  };

  // ─── 5. Provide State to App ────────────────────────────────────────────────
  const value = {
    user,
    loading,
    isAuthenticated: !!user,
    login,
    register,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};