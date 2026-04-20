/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense, useState, useEffect } from 'react';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';
import { MaintenanceGuard } from './components/MaintenanceGuard';
import { Toaster } from 'sonner';

import { AdminRoute } from './components/AdminRoute';

// Lazy load pages for better performance
const Dashboard = lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })));
const Reserve = lazy(() => import('./pages/Reserve').then(m => ({ default: m.Reserve })));
const Assets = lazy(() => import('./pages/Assets').then(m => ({ default: m.Assets })));
const Profile = lazy(() => import('./pages/Profile').then(m => ({ default: m.Profile })));
const KYC = lazy(() => import('./pages/KYC').then(m => ({ default: m.KYC })));
const My = lazy(() => import('./pages/My').then(m => ({ default: m.My })));
const Team = lazy(() => import('./pages/Team').then(m => ({ default: m.Team })));
const Support = lazy(() => import('./pages/Support').then(m => ({ default: m.Support })));
const Admin = lazy(() => import('./pages/Admin').then(m => ({ default: m.Admin })));
const AdminLogin = lazy(() => import('./pages/AdminLogin').then(m => ({ default: m.AdminLogin })));

export default function App() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Toaster position="top-center" expand={false} richColors />
          <Suspense fallback={
            <div className="fixed inset-0 flex items-center justify-center bg-[var(--bg)]">
              <div className="w-8 h-8 border-2 border-[#10B981] border-t-transparent rounded-full animate-spin"></div>
            </div>
          }>
            <MaintenanceGuard>
              <Routes>
                <Route element={<Layout />}>
                  <Route path="/admin/login" element={<AdminLogin />} />
                  
                  <Route element={<ProtectedRoute />}>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/reserve" element={<Reserve />} />
                    <Route path="/assets" element={<Assets />} />
                    <Route path="/profile" element={<Profile />} />
                    <Route path="/my" element={<My />} />
                    <Route path="/my/setting/kyc" element={<KYC />} />
                    <Route path="/team" element={<Team />} />
                    <Route path="/support" element={<Support />} />
                  </Route>
  
                  <Route element={<AdminRoute />}>
                    <Route path="/admin" element={<Admin />} />
                  </Route>
                </Route>
                
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </MaintenanceGuard>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
