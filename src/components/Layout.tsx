import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { cn } from '../lib/utils';

import { AnimatedBackground } from './AnimatedBackground';
import { NotificationCenter } from './NotificationCenter';

const TopBar = ({ onOpenNotifications }: { onOpenNotifications: () => void }) => {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="fixed top-0 right-0 left-0 md:left-72 h-20 flex justify-between items-center px-8 bg-emerald-950/40 backdrop-blur-xl border-b border-white/10 z-50 transition-all">
      <div className="flex items-center gap-4">
        <h2 className="font-headline text-xl font-bold tracking-tight text-[var(--ink)] hidden md:block">Command Center</h2>
        <div className="h-4 w-[1px] bg-white/20 mx-2 hidden md:block"></div>
        <div className="flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full border border-white/10">
          <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse"></span>
          <span className="text-[10px] font-label uppercase tracking-widest text-[#10B981]">Live Network</span>
        </div>
      </div>

      <div className="flex items-center gap-6">
        <div className="hidden lg:flex items-center relative group">
          <input 
            className="bg-white/5 border border-white/10 rounded-full py-2 pl-10 pr-4 text-sm w-64 focus:outline-none focus:border-[#10B981]/50 transition-all font-body text-[var(--ink)]" 
            placeholder="Search Matrix..." 
            type="text"
          />
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-muted)] text-sm">search</span>
        </div>

        <div className="flex items-center gap-4">
          <button 
            onClick={toggleTheme}
            className="p-2 text-[var(--ink-muted)] hover:text-[#10B981] transition-colors"
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            <span className="material-symbols-outlined text-xl">
              {theme === 'dark' ? 'light_mode' : 'dark_mode'}
            </span>
          </button>
          <button 
            onClick={onOpenNotifications}
            className="p-2 text-[var(--ink-muted)] hover:text-[#10B981] transition-colors relative"
          >
            <span className="material-symbols-outlined text-xl">notifications</span>
            <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-[#10B981] rounded-full"></span>
          </button>
          
          <div className="flex items-center gap-3 pl-4 border-l border-white/10">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-headline font-bold text-[var(--ink)]">{user?.email?.split('@')[0]}</p>
              <p className="text-[10px] text-[#10B981] uppercase tracking-tighter">Pro Member</p>
            </div>
            <div className="w-10 h-10 rounded-full border-2 border-[#10B981]/20 overflow-hidden">
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
      </div>
    </header>
  );
};

const Sidebar = () => {
  const { user } = useAuth();
  const location = useLocation();
  const isAdminPath = location.pathname.startsWith('/admin');

  const userNavItems = [
    { icon: 'dashboard', label: 'Command Center', path: '/' },
    { icon: 'account_balance_wallet', label: 'Assets', path: '/assets' },
    { icon: 'bolt', label: 'Yield Forge', path: '/reserve' },
    { icon: 'hub', label: 'Network Hub', path: '/team' },
    { icon: 'verified_user', label: 'KYC', path: '/my/setting/kyc' },
    { icon: 'person', label: 'Profile', path: '/my' },
  ];

  const adminNavItems = [
    { icon: 'admin_panel_settings', label: 'Admin Panel', path: '/admin?tab=overview' },
    { icon: 'group', label: 'Users', path: '/admin?tab=users' },
    { icon: 'verified_user', label: 'KYC Review', path: '/admin?tab=kyc' },
    { icon: 'payments', label: 'Deposits', path: '/admin?tab=deposits' },
    { icon: 'outbox', label: 'Withdrawals', path: '/admin?tab=withdrawals' },
    { icon: 'settings', label: 'Settings', path: '/admin?tab=settings' },
    { icon: 'arrow_back', label: 'Back to Site', path: '/' },
  ];

  const navItems = isAdminPath ? adminNavItems : userNavItems;

  return (
    <aside className="hidden md:flex fixed left-0 top-0 h-screen w-72 bg-emerald-950/60 backdrop-blur-[50px] border-r border-white/10 flex-col py-8 px-6 gap-y-4 z-[60]">
      <div className="flex items-center gap-3 mb-10 px-2">
        <div className="w-10 h-10 bg-[#10B981] rounded-lg flex items-center justify-center shadow-[0_0_15px_-3px_rgba(16,185,129,0.4)]">
          <span className="material-symbols-outlined text-emerald-950 font-black" style={{ fontVariationSettings: "'FILL' 1" }}>bolt</span>
        </div>
        <div>
          <h1 className="font-headline font-black text-emerald-400 text-xl tracking-tighter leading-none">AtmosPro</h1>
          <p className="font-headline text-[10px] uppercase tracking-[0.2em] text-slate-500 mt-1">The Ethereal Vault</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto no-scrollbar pr-2">
        {navItems.map((item) => {
          const isActive = isAdminPath 
            ? location.search === item.path.split('?')[1] || (item.path === '/admin?tab=overview' && !location.search)
            : location.pathname === item.path;

          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-4 py-3 px-4 rounded-lg transition-all duration-300 font-headline uppercase tracking-widest text-[10px]",
                isActive
                  ? "border-l-2 border-emerald-400 bg-emerald-400/10 text-emerald-400 shadow-[inset_10px_0_15px_-10px_rgba(92,253,128,0.3)]"
                  : "text-slate-500 hover:text-emerald-200 hover:bg-white/5"
              )}
            >
              <span className="material-symbols-outlined text-lg" style={isActive ? { fontVariationSettings: "'FILL' 1" } : {}}>{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="mt-auto pt-8 border-t border-white/5 space-y-1">
        <NavLink 
          to="/support"
          className="flex items-center gap-4 py-3 px-4 rounded-lg text-slate-500 hover:text-emerald-200 hover:bg-white/5 transition-colors font-headline uppercase tracking-widest text-[10px]"
        >
          <span className="material-symbols-outlined text-lg">help</span>
          Support
        </NavLink>
        <button className="w-full mt-6 py-3 px-4 bg-[#10B981] text-emerald-950 font-headline font-bold uppercase tracking-widest text-[10px] rounded-lg active:scale-95 transition-all duration-200 shadow-[0_0_20px_-5px_rgba(16,185,129,0.5)]">
          Connect Wallet
        </button>
      </div>
    </aside>
  );
};

const BottomNav = () => {
  const location = useLocation();
  const isAdminPath = location.pathname.startsWith('/admin');

  const userNavItems = [
    { icon: 'dashboard', label: 'Home', path: '/' },
    { icon: 'bolt', label: 'Forge', path: '/reserve' },
    { icon: 'account_balance_wallet', label: 'Assets', path: '/assets' },
    { icon: 'person', label: 'Profile', path: '/my' },
  ];

  const adminNavItems = [
    { icon: 'dashboard', label: 'Stats', path: '/admin?tab=overview' },
    { icon: 'group', label: 'Users', path: '/admin?tab=users' },
    { icon: 'inventory_2', label: 'Products', path: '/admin?tab=products' },
    { icon: 'arrow_back', label: 'Exit', path: '/' },
  ];

  const navItems = isAdminPath ? adminNavItems : userNavItems;

  return (
    <nav className="md:hidden fixed bottom-0 w-full z-50 px-4 pb-6 flex justify-around items-center bg-transparent pointer-events-none">
      <div className="h-16 w-full max-w-md rounded-2xl border border-white/10 flex justify-around items-center bg-emerald-950/80 backdrop-blur-2xl shadow-2xl pointer-events-auto transition-all">
        {navItems.map((item) => {
          const isActive = isAdminPath 
            ? location.search === item.path.split('?')[1] || (item.path === '/admin?tab=overview' && !location.search)
            : location.pathname === item.path;

          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={cn(
                "flex flex-col items-center justify-center transition-all duration-300 relative px-2",
                isActive
                  ? "text-emerald-400 scale-110"
                  : "text-slate-500 hover:text-emerald-400/80"
              )}
            >
              <span className="material-symbols-outlined text-xl mb-0.5" style={isActive ? { fontVariationSettings: "'FILL' 1" } : {}}>{item.icon}</span>
              <span className="text-[8px] font-bold tracking-widest uppercase">{item.label}</span>
              
              {isActive && (
                <div className="absolute -bottom-1 w-1 h-1 rounded-full bg-emerald-400 shadow-[0_0_10px_#10B981]" />
              )}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
};

export const Layout = () => {
  const location = useLocation();
  const isAuthPage = location.pathname === '/admin/login';
  const [isMobile, setIsMobile] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  if (isAuthPage) {
    return (
      <div className="min-h-screen bg-[#080f14] relative overflow-hidden flex items-center justify-center">
        <div className="fixed inset-0 z-0 pointer-events-none">
          <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-[#10B981]/10 blur-[120px] rounded-full animate-bg-glow-1"></div>
          <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#1E40AF]/10 blur-[100px] rounded-full animate-bg-glow-2"></div>
        </div>
        <div className="relative z-10 w-full">
          <Outlet />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080f14] text-[#e2e9f0] font-body selection:bg-[#10B981] selection:text-emerald-950 relative overflow-x-hidden">
      {/* Ambient Mesh Background */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-[#10B981]/10 blur-[120px] rounded-full animate-bg-glow-1"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-[#1E40AF]/10 blur-[120px] rounded-full animate-bg-glow-2"></div>
        <div className="absolute top-[20%] right-[10%] w-[30%] h-[40%] bg-[#F59E0B]/5 blur-[100px] rounded-full"></div>
      </div>

      {!isMobile && <div className="scanline" />}
      
      <Sidebar />
      
      <div className="flex-1 flex flex-col min-w-0 md:pl-72">
        <TopBar onOpenNotifications={() => setIsNotificationsOpen(true)} />
        <main className={cn(
          "pt-28 pb-32 px-6 md:px-12 relative z-10 w-full transition-all duration-500",
          location.pathname.startsWith('/admin') ? "max-w-full" : "max-w-7xl mx-auto"
        )}>
          <Outlet />
        </main>
        <BottomNav />
      </div>

      <NotificationCenter isOpen={isNotificationsOpen} onClose={() => setIsNotificationsOpen(false)} />
    </div>
  );
};
