import { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const SocketContext = createContext();

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    // Connect to the base URL (stripping '/api' if it's there)
    const SOCKET_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';
    
    const socketInstance = io(SOCKET_URL, {
      withCredentials: true, // Crucial for CORS and cookies
    });

    socketInstance.on('connect', () => {
      console.log('🟢 Connected to Socket Server');
    });

    setSocket(socketInstance);

    // Clean up the connection if the user closes the app
    return () => {
      socketInstance.disconnect();
    };
  }, []);

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  );
};