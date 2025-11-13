import React, { createContext, useState, useContext, useEffect } from 'react';
import { userService } from '../services/userService';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    
    if (token && storedUser) {
      try {
        setUser(JSON.parse(storedUser));
        // Optionally verify token is still valid
        userService.getProfile()
          .then(userData => setUser(userData))
          .catch(() => {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            setUser(null);
          });
      } catch (error) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }
    setLoading(false);
  }, []);

  const login = async (credentials) => {
    try {
      console.log('AuthContext: Calling login API...');
      const data = await userService.login(credentials);
      console.log('AuthContext: API response:', data);
      
      // Handle unified auth response format: { token, user: {...} }
      const token = data.token;
      const userData = data.user || data; // Support both formats
      
      console.log('AuthContext: Extracted token:', token ? 'present' : 'missing');
      console.log('AuthContext: Extracted user data:', userData);
      console.log('AuthContext: User role:', userData.role);
      
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);
      
      console.log('AuthContext: Login successful, returning user');
      return { success: true, user: userData };
    } catch (error) {
      console.error('AuthContext: Login error:', error);
      console.error('AuthContext: Error response:', error.response?.data);
      return { 
        success: false, 
        error: error.response?.data?.message || 'Login failed' 
      };
    }
  };

  const logout = () => {
    userService.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);