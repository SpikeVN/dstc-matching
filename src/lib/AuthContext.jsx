import { db, setAuthFailureCallback } from '@/api/apiClient';

import React, { createContext, useState, useContext, useEffect } from 'react';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(!!localStorage.getItem('access_token'));
  const [isLoadingPublicSettings] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [appPublicSettings] = useState(null);

  useEffect(() => {
    checkAppState();
    // Register global 401 handler: when a request fails after refresh, force logout
    setAuthFailureCallback(() => {
      setUser(null);
      setIsAuthenticated(false);
      setAuthChecked(true);
      setAuthError({ type: 'auth_required', message: 'Session expired' });
    });
    return () => setAuthFailureCallback(null);
  }, []);

  const checkAppState = async () => {
    // No token → definitely not authenticated, skip the API call and loading state
    if (!localStorage.getItem('access_token')) {
      setIsAuthenticated(false);
      setAuthChecked(true);
      setAuthError({ type: 'auth_required', message: 'Authentication required' });
      return;
    }

    try {
      setIsLoadingAuth(true);
      setAuthError(null);

      const currentUser = await db.auth.me();
      if (currentUser) {
        setUser(currentUser);
        setIsAuthenticated(true);
        setAuthChecked(true);
      } else {
        setIsAuthenticated(false);
        setAuthChecked(true);
        setAuthError({ type: 'auth_required', message: 'Authentication required' });
      }
    } catch (error) {
      console.error('App state check failed:', error);
      setIsAuthenticated(false);
      setAuthChecked(true);
      setAuthError({
        type: 'auth_required',
        message: error.message || 'Authentication required',
      });
    } finally {
      setIsLoadingAuth(false);
    }
  };

  const checkUserAuth = async () => {
    try {
      setIsLoadingAuth(true);
      const currentUser = await db.auth.me();
      setUser(currentUser);
      setIsAuthenticated(true);
      setAuthChecked(true);
      setAuthError(null);
    } catch (error) {
      console.error('User auth check failed:', error);
      setIsAuthenticated(false);
      setAuthChecked(true);

      if (error.status === 401 || error.status === 403) {
        setAuthError({
          type: 'auth_required',
          message: 'Authentication required',
        });
      }
    } finally {
      setIsLoadingAuth(false);
    }
  };

  const login = async (email, password) => {
    const userData = await db.auth.login(email, password);
    setUser(userData);
    setIsAuthenticated(true);
    setAuthError(null);
    return userData;
  };

  const signup = async (email, password, fullName) => {
    const result = await db.auth.signup(email, password, fullName);
    // If email confirmation is required, don't set auth state
    if (result.requires_email_confirmation) {
      return result;
    }
    setUser(result);
    setIsAuthenticated(true);
    setAuthError(null);
    return result;
  };

  const googleLogin = async (credential) => {
    const userData = await db.auth.googleLogin(credential);
    setUser(userData);
    setIsAuthenticated(true);
    setAuthError(null);
    return userData;
  };

  const logout = () => {
    setUser(null);
    setIsAuthenticated(false);
    setAuthChecked(true);
    setAuthError({ type: 'auth_required', message: 'Logged out' });
    db.auth.logout();
  };

  const navigateToLogin = () => {
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      appPublicSettings,
      authChecked,
      login,
      signup,
      googleLogin,
      logout,
      navigateToLogin,
      checkUserAuth,
      checkAppState
    }}>
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
