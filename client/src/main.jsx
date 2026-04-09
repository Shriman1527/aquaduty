import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Toaster } from 'react-hot-toast';
import App from './App.jsx';
import { AuthProvider } from './contexts/AuthContext.jsx';
import { SocketProvider } from './contexts/SocketContext.jsx'; // Add this
import './index.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <SocketProvider> {/* Wrap the app here */}
        <App />
        <Toaster position="top-right" /> 
      </SocketProvider>
    </AuthProvider>
  </StrictMode>,
);