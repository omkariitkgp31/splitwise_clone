import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    if (!user) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      return;
    }

    const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';
    const newSocket = io(socketUrl, {
      withCredentials: true,
      autoConnect: true,
    });

    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('Socket.io connected successfully!');
    });

    newSocket.on('disconnect', (reason) => {
      console.log('Socket.io disconnected:', reason);
    });

    newSocket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
    });

    return () => {
      newSocket.disconnect();
    };
  }, [user]);

  const emitJoinGroup = (groupId) => {
    if (socket) {
      socket.emit('join:group', { groupId });
    }
  };

  const emitLeaveGroup = (groupId) => {
    if (socket) {
      socket.emit('leave:group', { groupId });
    }
  };

  return (
    <SocketContext.Provider value={{ socket, emitJoinGroup, emitLeaveGroup }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};
