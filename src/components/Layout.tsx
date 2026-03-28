import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

import { AnimatedBackground } from './AnimatedBackground';

const TopBar = () => {
  const { user } = useAuth();

  return (
    <header className="fixed top-0 w-full flex justify-between items-center px-6 py-4 bg-[#0F1115]/95 md:bg-[#0F1115]/80 md:backdrop-blur-2xl z-50 border-b border-white/5 shadow-2xl transition-all md:hidden">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#3B82F6] to-[#8B5CF6] flex items-center justify-center shadow-lg shadow-blue-500/20">
          <span className="text-white font-black text-xl tracking-tighter">A</span>
        </div>
        <div>
          <h1 className="text-lg font-black tracking-tight text-[#E5E7EB] font-headline">AtmosPro</h1>
          <p className="text-[10px] uppercase tracking-[0.2em] text-[#9CA3AF] font-medium">Premium Crypto</p>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <button className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center border border-white/10 hover:bg-white/10 transition-colors">
          <span className="material-symbols-outlined text-sm text-[#E5E7EB]">notifications</span>
        </button>
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#FFD700] to-[#FF8C00] p-[1px] shadow-lg shadow-gold-500/10">
          <div className="w-full h-full rounded-full bg-[#0F1115] flex items-center justify-center overflow-hidden">
            <img
              src={user?.user_metadata?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.email}`}
              alt="Avatar"
              className="w-full h-full object-cover"
              loading="lazy"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>
      </div>
    </header>
  );
};

const Sidebar = () => {
  const { user } = useAuth();
  const location = useLocation();
  const navItems = [
    { icon: 'home', label: 'Dashboard', path: '/' },
    { icon: 'layers', label: 'Staking', path: '/reserve' },
    { icon: 'account_balance_wallet', label: 'My Assets', path: '/assets' },
    { icon: 'group', label: 'My Team', path: '/team' },
    { icon: 'person', label: 'Profile', path: '/my' },
  ];

  return (
    <aside className="hidden md:flex fixed left-0 top-0 h-screen w-72 bg-[#1A1D24]/80 backdrop-blur-2xl border-r border-white/5 flex-col p-8 z-50">
      <div className="flex items-center gap-4 mb-12">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#3B82F6] to-[#8B5CF6] flex items-center justify-center shadow-xl shadow-blue-500/20">
          <span className="text-white font-black text-2xl tracking-tighter">A</span>
        </div>
        <div>
          <h1 className="text-xl font-black tracking-tight text-[#E5E7EB] font-headline">AtmosPro</h1>
          <p className="text-[10px] uppercase tracking-[0.2em] text-[#9CA3AF] font-black">Premium Crypto</p>
        </div>
      </div>

      <nav className="flex-1 space-y-2">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-4 px-6 py-4 rounded-2xl transition-all duration-300 group",
                isActive
                  ? "bg-[var(--blue)]/10 text-[var(--blue)] shadow-[0_0_20px_rgba(59,130,246,0.1)]"
                  : "text-[#9CA3AF]/60 hover:text-white hover:bg-white/5"
              )
            }
          >
            <span className="material-symbols-outlined text-2xl">{item.icon}</span>
            <span className="text-xs font-black uppercase tracking-widest">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto pt-8 border-t border-white/5">
        <div className="flex items-center gap-4 px-2">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#FFD700] to-[#FF8C00] p-[1px]">
            <div className="w-full h-full rounded-2xl bg-[#0F1115] overflow-hidden">
              <img
                src={user?.user_metadata?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.email}`}
                alt="Avatar"
                className="w-full h-full object-cover"
                loading="lazy"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black text-white truncate">{user?.email?.split('@')[0]}</p>
            <p className="text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest">Investor</p>
          </div>
        </div>
      </div>
    </aside>
  );
};

const BottomNav = () => {
  const location = useLocation();
  const navItems = [
    { icon: 'home', label: 'Home', path: '/' },
    { icon: 'layers', label: 'Stake', path: '/reserve' },
    { icon: 'account_balance_wallet', label: 'Assets', path: '/assets' },
    { icon: 'person', label: 'My', path: '/my' },
  ];

  return (
    <nav className="fixed bottom-0 w-full z-50 px-4 pb-8 flex justify-around items-center bg-transparent pointer-events-none md:hidden">
      <div className="fixed bottom-6 left-4 right-4 h-16 rounded-2xl border border-white/5 flex justify-around items-center bg-[#1A1D24]/95 md:bg-[#1A1D24]/80 md:backdrop-blur-2xl shadow-2xl pointer-events-auto transition-all">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              cn(
                "flex flex-col items-center justify-center transition-all duration-300 relative px-2",
                isActive
                  ? "text-[#3B82F6] scale-110"
                  : "text-[#9CA3AF]/60 hover:text-[#3B82F6]/80"
              )
            }
          >
            <span className="material-symbols-outlined text-[22px] mb-0.5">{item.icon}</span>
            <span className="text-[9px] font-bold tracking-[0.15em] uppercase">{item.label}</span>
            
            {/* Active Glow Indicator */}
            <div 
              className={cn(
                "absolute -bottom-1.5 w-1 h-1 rounded-full bg-[#3B82F6] transition-all duration-300 shadow-[0_0_10px_#3B82F6]",
                location.pathname === item.path ? "opacity-100 scale-100" : "opacity-0 scale-0"
              )}
            />
          </NavLink>
        ))}
      </div>
    </nav>
  );
};

export const Layout = () => {
  const location = useLocation();
  const isAuthPage = ['/login', '/signup'].includes(location.pathname);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  if (isAuthPage) {
    return (
      <>
        <AnimatedBackground />
        {!isMobile && <div className="scanline" />}
        <Outlet />
      </>
    );
  }

  return (
    <div className="min-h-screen relative flex">
      <AnimatedBackground />
      {!isMobile && <div className="scanline" />}
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />
        <main className={cn(
          "pt-28 pb-36 px-6 mx-auto relative z-10 w-full cv-auto",
          location.pathname.startsWith('/admin') ? "max-w-6xl" : "max-w-5xl md:pt-12 md:pb-12 md:pl-80"
        )} style={{ containIntrinsicSize: '0 1000px' }}>
          <Outlet />
        </main>
        <BottomNav />
      </div>
    </div>
  );
};
