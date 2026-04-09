import axios from 'axios';

// We will set this in a .env file later, but for now it defaults to your local server
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Create a configured Axios instance
const api = axios.create({
  baseURL: API_URL,
  // CRITICAL: This tells Axios to send the httpOnly refreshToken cookie automatically
  withCredentials: true, 
});

// ─── Request Interceptor ──────────────────────────────────────────────────────
// Attach the access token to every outgoing request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// ─── Response Interceptor ─────────────────────────────────────────────────────
// Catch expired token errors and refresh silently
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Check for the exact error code from your auth.js middleware
    if (error.response?.data?.code === 'TOKEN_EXPIRED' && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // Ask backend for a new token (cookie is sent automatically)
        const { data } = await axios.post(
          `${API_URL}/auth/refresh-token`, 
          {}, 
          { withCredentials: true }
        );

        // Save the new access token
        localStorage.setItem('accessToken', data.data.accessToken);

        // Update the header on the failed request and try again
        originalRequest.headers.Authorization = `Bearer ${data.data.accessToken}`;
        return api(originalRequest);
        
      } catch (refreshError) {
        // If the refresh token is also expired, clear storage and redirect to login
        localStorage.removeItem('accessToken');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;