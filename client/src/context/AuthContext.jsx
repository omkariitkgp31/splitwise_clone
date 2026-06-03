import React, { createContext, useState, useEffect, useContext } from 'react';
import api from '../api/axios';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkSession = async () => {
    try {
      const response = await api.get('/auth/me');
      setUser(response.data.user || response.data);
    } catch (error) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkSession();
  }, []);

  const login = async (email, password) => {
    setLoading(true);

    try {
      const response = await api.post('/auth/login', {
        email,
        password,
      });

      console.log("LOGIN RESPONSE", response.data);

      setUser(response.data.user || response.data);

      console.log(
        "USER SET",
        response.data.user || response.data
      );

      return response.data;
    } catch (error) {
      console.error("AUTH LOGIN ERROR", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };
  const logout = async () => {
    setLoading(true);
    try {
      await api.post('/auth/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      setLoading(false);
      window.location.href = '/login';
    }
  };

  return (
    <AuthContext.Provider value={{ user, setUser, login, logout, loading, checkSession }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
