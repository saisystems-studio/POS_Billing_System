import React, { createContext, useContext, useState, useEffect } from 'react';
import authService from '../services/authService';
import api, { clearAuthStorage, notifyAuthReady, restoreAuthSession } from '../services/api';

const AuthContext = createContext(undefined);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);      // { id, username, email, role }
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const restore = async () => {
      try {
        const session = await restoreAuthSession();
        if (!mounted) return;
        if (session?.token && session?.user) {
          setUser(session.user);
          api.defaults.headers.common.Authorization = `Bearer ${session.token}`;
          setIsAuthenticated(true);
        } else {
          setUser(null);
          setIsAuthenticated(false);
        }
      } catch {
        if (mounted) {
          clearAuthStorage();
          setUser(null);
          setIsAuthenticated(false);
        }
      } finally {
        if (mounted) setIsLoading(false);
      }
    };
    restore();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    const handleAuthCleared = () => {
      setUser(null);
      setIsAuthenticated(false);
    };
    window.addEventListener('pos-auth-cleared', handleAuthCleared);
    return () => window.removeEventListener('pos-auth-cleared', handleAuthCleared);
  }, []);

  /**
   * Login with username/password via JWT API.
   * Stores access_token, refresh_token and user info in localStorage.
   * Records current login time so profile shows it for this session.
   */
  const login = async (username, password) => {
    clearAuthStorage();
    const data = await authService.login(username, password);
    // last_login from backend = the PREVIOUS session's login time (updated after token issue)
    // Store the current login time separately for display
    const userWithLoginTime = {
      ...data.user,
      current_login_time: new Date().toISOString(),
      last_login: data.user.last_login || null,
    };
    localStorage.setItem('access_token', data.access);
    localStorage.setItem('refresh_token', data.refresh);
    localStorage.setItem('user', JSON.stringify(userWithLoginTime));
    // backward-compat key used by other parts of app
    localStorage.setItem('username', data.user.username);
    api.defaults.headers.common.Authorization = `Bearer ${data.access}`;
    setUser(userWithLoginTime);
    setIsAuthenticated(true);
    notifyAuthReady();
  };

  /**
   * Logout: clears all local storage auth data.
   */
  const logout = () => {
    clearAuthStorage();
    setUser(null);
    setIsAuthenticated(false);
  };

  /**
   * Update stored user info after profile changes.
   */
  const updateUserState = (updatedUser) => {
    const merged = { ...user, ...updatedUser };
    setUser(merged);
    localStorage.setItem('user', JSON.stringify(merged));
    localStorage.setItem('username', merged.username);
  };

  // Convenience properties
  const username = user?.username ?? null;
  const role = user?.role ?? null;
  const isAdmin = role === 'Admin';

  return (
    <AuthContext.Provider value={{
      isAuthenticated,
      user,
      username,
      role,
      isAdmin,
      login,
      logout,
      updateUserState,
      isLoading,
    }}>
      {children}
    </AuthContext.Provider>
  );
};
