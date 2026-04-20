import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const ProtectedRoute = () => {
  const { session, loading, isTwoFAEnabled, isTwoFAVerified } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-12 h-12 border-4 border-primary-container border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!session) {
    // For now, allow access even without session since login page was removed
    // return <Navigate to="/login" replace />;
    return <Outlet />;
  }

  if (isTwoFAEnabled && !isTwoFAVerified) {
    // return <Navigate to="/login" replace />;
    return <Outlet />;
  }

  return <Outlet />;
};
