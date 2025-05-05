import React, { createContext, useState, useEffect } from 'react';
import * as jwtDecode from 'jwt-decode';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    
    if (token) {
      try {
        // Decode token untuk memeriksa expiration
        const decodedToken = jwtDecode.jwtDecode(token);
        const currentTime = Date.now() / 1000;
        
        if (decodedToken.exp < currentTime) {
          // Token expired, remove from localStorage
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setCurrentUser(null);
        } else {
          // Token masih valid, load user dari localStorage
          const user = JSON.parse(localStorage.getItem('user'));
          setCurrentUser(user);
          
          // Log info token untuk debugging
          console.log('Token valid, user loaded from localStorage');
        }
      } catch (err) {
        console.error('Error decoding token:', err);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setCurrentUser(null);
      }
    }
    
    setLoading(false);
  }, []);

  // Fungsi login menggunakan fetch sebagai pengganti axios
  const login = async (username, password) => {
    try {
      setError(null);
      console.log('Attempting login for:', username); // Debug log
      
      const response = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password })
      });
      
      // Debug: Log response status
      console.log('Login response status:', response.status);
      
      const data = await response.json();
      
      // Debug: Log response data (without sensitive info)
      console.log('Login response:', {
        status: data.status,
        hasToken: !!data.token,
        user: data.user ? {
          id: data.user.id,
          username: data.user.username,
          is_admin: data.user.is_admin
        } : null
      });
      
      if (!response.ok) {
        throw new Error(data.message || 'Login gagal');
      }
      
      // Simpan token with format Bearer
      const token = data.token;
      
      if (!token) {
        throw new Error('Token tidak ditemukan dalam response');
      }
      
      // Save token and user to localStorage
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(data.user));
      
      setCurrentUser(data.user);
      return data.user;
    } catch (err) {
      console.error('Login error:', err);
      setError(err.message || 'Login gagal');
      throw err;
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setCurrentUser(null);
  };

  // Add function to generate auth headers
  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return {
      'Authorization': token ? `Bearer ${token}` : '',
      'Content-Type': 'application/json'
    };
  };

  // Tambahkan fungsi register SEBELUM return statement
  const register = async (username, password, isAdmin = false) => {
    try {
      setError(null);
      const response = await fetch('http://localhost:5000/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password, is_admin: isAdmin })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Registrasi gagal');
      }
      
      return data;
    } catch (err) {
      console.error('Registration error:', err);
      setError(err.message || 'Registrasi gagal');
      throw err;
    }
  };

  // Hanya ada satu return statement, tambahkan register ke dalamnya
  return (
    <AuthContext.Provider value={{ 
      currentUser, 
      loading, 
      error, 
      login, 
      logout, 
      register,
      getAuthHeaders 
    }}>
      {children}
    </AuthContext.Provider>
  );
};