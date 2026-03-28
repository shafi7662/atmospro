import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { UserDashboard, Product, Reserve as ReserveType, Profile } from '../types';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';

export const Dashboard = () => {
  const { user } = useAuth();
  const [dashboard, setDashboard] = useState<UserDashboard | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [activeReserves, setActiveReserves] = useState<any[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [showProfit, setShowProfit] = useState<{ amount: number } | null>(null);
  const [lastReserve, setLastReserve] = useState<ReserveType | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const fetchData = async () => {
    if (!user) return;
    try {
      const [dashRes, profileRes, reservesRes, productsRes, lastReserveRes] = await Promise.all([
        supabase.rpc('get_user_dashboard', { p_user_id: user.id }),
        supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
        supabase.from('reserves').select('*, products(*)').eq('user_id', user.id).eq('status', 'active'),
        supabase.from('products').select('*').order('price', { ascending: false }),
        supabase.from('reserves').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1)
      ]);
      
      if (dashRes.error) {
        if (dashRes.error.message.includes('JWT expired')) {
          supabase.auth.signOut();
          return;
        }
        throw dashRes.error;
      }
      setDashboard(dashRes.data);
      setProfile(profileRes.data);
      setActiveReserves(reservesRes.data || []);
      setProducts(productsRes.data || []);
      setLastReserve(lastReserveRes.data?.[0] || null);
    } catch (error: any) {
      console.error('Dashboard error:', error);
    } finally {
      setLoading(false);
    }
  };

  const getVipLevel = (balance: number) => {
    if (balance >= 5001) return 5;
    if (balance >= 2001) return 4;
    if (balance >= 501) return 3;
    if (balance >= 101) return 2;
    return 1;
  };

  const vipLevel = profile?.vip_level || (dashboard ? getVipLevel(dashboard.total_balance) : 1);

  const canStake = () => {
    if (!lastReserve) return true;
    if (activeReserves.length > 0) return false;
    
    const lastTime = new Date(lastReserve.created_at).getTime();
    const now = new Date().getTime();
    const diff = now - lastTime;
    return diff >= 24 * 60 * 60 * 1000;
  };

  const getTimeRemaining = () => {
    if (!lastReserve) return null;
    const lastTime = new Date(lastReserve.created_at).getTime();
    const nextTime = lastTime + 24 * 60 * 60 * 1000;
    const now = new Date().getTime();
    const diff = nextTime - now;
    if (diff <= 0) return null;

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  const handleStake = async (product: Product) => {
    if (!user || !dashboard) return;
    
    if (dashboard.available_balance < product.price) {
      toast.error('Insufficient balance to stake this product');
      return;
    }

    setProcessing(product.id);
    try {
      const { error } = await supabase.rpc('reserve_product', {
        p_user_id: user.id,
        p_product_id: product.id
      });
      if (error) throw error;
      toast.success(`Successfully staked ${product.name}`);
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to stake product');
    } finally {
      setProcessing(null);
    }
  };

  const handleSell = async (reserve: any) => {
    setProcessing(reserve.id);
    try {
      const { data, error } = await supabase.rpc('sell_product', {
        p_reserve_id: reserve.id
      });
      if (error) throw error;
      
      setShowProfit({ amount: data.profit || 0 });
      toast.success('Product sold successfully');
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to sell product');
    } finally {
      setProcessing(null);
    }
  };

  const isSellAvailable = (reserve: any) => {
    const now = new Date();
    const availableAt = new Date(reserve.sell_available_at);
    return now >= availableAt;
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const handleAddTestBalance = async () => {
    if (!user || !dashboard) return;
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ available_balance: (dashboard.available_balance || 0) + 5000 })
        .eq('id', user.id);
      
      if (error) throw error;
      toast.success('Added $5,000 USDT Test Balance!');
      fetchData();
    } catch (error: any) {
      toast.error('Failed to add test balance');
    }
  };

  const handleRepairProfile = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Get referral code from metadata
      const metadataReferralCode = user.user_metadata?.referral_code;
      let referrerId = null;

      if (metadataReferralCode) {
        const { data: referrerProfile } = await supabase
          .from('profiles')
          .select('id')
          .eq('referral_code', metadataReferralCode)
          .maybeSingle();
        
        if (referrerProfile) {
          referrerId = referrerProfile.id;
        }
      }

      const newProfile = {
        id: user.id,
        email: user.email,
        first_name: user.user_metadata?.first_name || null,
        last_name: user.user_metadata?.last_name || null,
        phone_number: user.user_metadata?.phone_number || null,
        role: user.email?.toLowerCase() === 'shafi7662424456@gmail.com' ? 'admin' : 'user',
        available_balance: 0,
        total_balance: 0,
        deposit_balance: 0,
        withdrawable_balance: 0,
        referral_code: `ATM-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
        permanent_id: Math.floor(100000 + Math.random() * 900000).toString(),
        vip_level: 1,
        two_fa_enabled: false,
        referred_by: referrerId
      };

      const { error } = await supabase
        .from('profiles')
        .upsert(newProfile, { onConflict: 'id' });
      
      if (error) throw error;
      toast.success('Profile repaired successfully! Please refresh.');
      fetchData();
    } catch (error: any) {
      console.error('Repair error:', error);
      toast.error(`Repair failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-8 pb-10 animate-pulse">
        <div className="h-16 bg-white/5 rounded-2xl w-1/2"></div>
        <div className="h-48 bg-white/5 rounded-[40px]"></div>
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          <div className="col-span-1 md:col-span-4 h-64 bg-white/5 rounded-[40px]"></div>
          <div className="col-span-1 md:col-span-2 h-64 bg-white/5 rounded-[40px]"></div>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={isMobile ? { opacity: 1 } : { opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8 pb-10"
    >
      {/* Welcome Header */}
      <section className="flex justify-between items-center px-2 cv-auto" style={{ containIntrinsicSize: '0 80px' }}>
        <div className="space-y-1">
          <h2 className="text-[#9CA3AF] text-[10px] font-black uppercase tracking-[0.3em]">Vault Access Granted</h2>
          <h1 className="text-4xl font-black text-[#E5E7EB] tracking-tight font-headline">
            {profile?.first_name || user?.user_metadata?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'Investor'}
          </h1>
        </div>
        <motion.div 
          whileHover={isMobile ? {} : { scale: 1.05 }}
          className={`flex items-center gap-2 px-4 py-2 rounded-2xl bg-[#FFD700]/10 border border-[#FFD700]/20 shadow-sm ${!isMobile ? 'rainbow-glow' : ''}`}
        >
          <span className="material-symbols-outlined text-[#FFD700] text-sm">workspace_premium</span>
          <span className="text-[#FFD700] text-[10px] font-black uppercase tracking-widest">VIP {vipLevel}</span>
        </motion.div>
      </section>

      {/* Live Yield Feed */}
      <section className={`relative h-48 rounded-[40px] overflow-hidden premium-card border-white/5 group cv-auto ${!isMobile ? 'rainbow-glow' : ''}`} style={{ containIntrinsicSize: '0 192px' }}>
        <div className="absolute inset-0 bg-gradient-to-r from-[#3B82F6]/20 via-transparent to-[#FFD700]/10 z-10"></div>
        <img 
          src="https://picsum.photos/seed/cyber-grid/800/400" 
          alt="Cyber Grid"
          className="absolute inset-0 w-full h-full object-cover opacity-10 mix-blend-overlay"
          loading="eager"
          fetchPriority="high"
          referrerPolicy="no-referrer"
        />
        
        <div className="absolute inset-0 p-8 flex flex-col justify-between z-20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full bg-[#3B82F6] ${!isMobile ? 'animate-ping' : ''}`}></div>
              <span className="text-[10px] font-black text-[#3B82F6] uppercase tracking-[0.3em]">Live Yield Feed</span>
            </div>
            <span className="text-[9px] font-black text-[#9CA3AF] uppercase tracking-widest">Global Activity</span>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="flex gap-4 animate-marquee whitespace-nowrap">
                {[...Array(2)].map((_, groupIndex) => (
                  <React.Fragment key={groupIndex}>
                    {[
                      { user: 'ID 829***', amount: '1,240.00', type: 'Stake' },
                      { user: 'ID 104***', amount: '450.50', type: 'Profit' },
                      { user: 'ID 992***', amount: '3,000.00', type: 'Deposit' },
                      { user: 'ID 312***', amount: '89.20', type: 'Profit' },
                      { user: 'ID 554***', amount: '5,000.00', type: 'Stake' },
                    ].map((item, i) => (
                      <div key={`${groupIndex}-${i}`} className="flex items-center gap-2 bg-white/5 px-4 py-2 rounded-2xl border border-white/10">
                        <span className="text-[10px] font-black text-[#E5E7EB]">{item.user}</span>
                        <span className="text-[10px] font-bold text-[#3B82F6]">${item.amount}</span>
                        <span className="text-[8px] font-black uppercase tracking-widest text-[#9CA3AF]">{item.type}</span>
                      </div>
                    ))}
                  </React.Fragment>
                ))}
              </div>
            </div>
            <p className="font-headline font-black text-[#E5E7EB] text-xl leading-tight max-w-[280px]">
              AtmosPro Yield Index is currently performing at <span className="text-[#3B82F6]">+4.2%</span> above baseline.
            </p>
          </div>
        </div>
      </section>

      {/* Bento Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-4 cv-auto" style={{ containIntrinsicSize: '0 400px' }}>
        {/* Main Balance Card - Large Span */}
        <div className="col-span-1 md:col-span-4 md:row-span-2 relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-[#3B82F6] to-[#FFD700] rounded-[40px] blur opacity-10 group-hover:opacity-20 transition duration-1000"></div>
          <div className={`relative h-full premium-card rounded-[40px] p-8 flex flex-col justify-between min-h-[300px] overflow-hidden ${!isMobile ? 'rainbow-glow' : ''}`}>
            <div className="absolute inset-0 bg-gradient-to-br from-[#3B82F6]/10 via-transparent to-[#FFD700]/5 z-0"></div>
            <img 
              src="https://picsum.photos/seed/digital-vault/800/400" 
              alt="Digital Vault"
              className="absolute inset-0 w-full h-full object-cover opacity-[0.03] mix-blend-overlay z-0"
              loading="lazy"
              referrerPolicy="no-referrer"
            />
            
            {/* Flowing background element */}
            {!isMobile && (
              <div className="absolute inset-0 z-0 opacity-20 pointer-events-none">
                <div className="absolute top-[-50%] left-[-50%] w-[200%] h-[200%] bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.1)_0%,transparent_50%)] animate-[spin_20s_linear_infinite]"></div>
              </div>
            )}

            {/* Subtle scanline for the card */}
            {!isMobile && (
              <div className="absolute inset-0 z-0 opacity-[0.02] pointer-events-none overflow-hidden">
                <div className="absolute inset-0 bg-[linear-gradient(0deg,transparent_0%,rgba(59,130,246,0.2)_50%,transparent_100%)] h-20 w-full animate-[scanline_10s_linear_infinite]"></div>
              </div>
            )}

            <div className="premium-border absolute inset-0 pointer-events-none z-10" />
            
            <div className="relative z-10 space-y-1">
              <div className="flex items-center gap-2">
                <div className={`w-1.5 h-1.5 rounded-full bg-[#3B82F6] ${!isMobile ? 'animate-ping' : ''}`}></div>
                <p className="text-[#9CA3AF] text-[10px] font-black uppercase tracking-[0.4em]">Total Portfolio</p>
              </div>
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-4xl md:text-5xl font-black text-[#E5E7EB] tracking-tighter rainbow-text font-headline">
                  ${Number(dashboard?.total_balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="text-[#3B82F6] text-xs font-black uppercase tracking-widest">USDT</span>
              </div>
            </div>

            <div className="relative z-10 grid grid-cols-2 gap-4 md:gap-8 pt-6 border-t border-white/5">
              <div className="space-y-1">
                <p className="text-[#9CA3AF] text-[9px] font-black uppercase tracking-widest">Available</p>
                <p className="text-xl md:text-2xl font-black text-[#E5E7EB] font-headline">${Number(dashboard?.available_balance || 0).toLocaleString()}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[#9CA3AF] text-[9px] font-black uppercase tracking-widest">Total Profit</p>
                <p className="text-xl md:text-2xl font-black text-[#3B82F6] font-headline">${Number(dashboard?.total_earnings || 0).toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Stats - Smaller Bento Items */}
        <div className="col-span-1 md:col-span-2 space-y-4 cv-auto" style={{ containIntrinsicSize: '0 300px' }}>
          <div className={`premium-card rounded-[32px] p-6 flex flex-col justify-between group min-h-[140px] overflow-hidden relative ${!isMobile ? 'rainbow-glow' : ''}`}>
            <div className="absolute inset-0 bg-gradient-to-br from-[#3B82F6]/5 via-transparent to-[#FFD700]/5 z-0"></div>
            <div className="absolute inset-0 bg-[url('https://picsum.photos/seed/earnings/200/200')] bg-cover bg-center opacity-[0.02] mix-blend-overlay z-0"></div>
            
            <div className="relative z-10 flex items-center justify-between">
              <div className="w-10 h-10 rounded-2xl bg-[#3B82F6]/10 flex items-center justify-center text-[#3B82F6] group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined">trending_up</span>
              </div>
              <div className={`w-1.5 h-1.5 rounded-full bg-[#3B82F6] ${!isMobile ? 'animate-ping' : ''}`}></div>
            </div>
            <div className="relative z-10">
              <p className="text-[#9CA3AF] text-[8px] font-black uppercase tracking-widest">Earnings</p>
              <p className="text-xl font-black text-[#E5E7EB] font-headline">${Number(dashboard?.total_earnings || 0).toFixed(2)}</p>
            </div>
          </div>

          <div className={`premium-card rounded-[32px] p-6 flex flex-col justify-between group min-h-[140px] overflow-hidden relative ${!isMobile ? 'rainbow-glow' : ''}`}>
            <div className="absolute inset-0 bg-gradient-to-br from-[#FFD700]/5 via-transparent to-[#3B82F6]/5 z-0"></div>
            <div className="absolute inset-0 bg-[url('https://picsum.photos/seed/stakes/200/200')] bg-cover bg-center opacity-[0.02] mix-blend-overlay z-0"></div>
            
            <div className="relative z-10 flex items-center justify-between">
              <div className="w-10 h-10 rounded-2xl bg-[#FFD700]/10 flex items-center justify-center text-[#FFD700] group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined">layers</span>
              </div>
              <div className={`w-1.5 h-1.5 rounded-full bg-[#FFD700] ${!isMobile ? 'animate-ping' : ''}`}></div>
            </div>
            <div className="relative z-10">
              <p className="text-[#9CA3AF] text-[8px] font-black uppercase tracking-widest">Active Stakes</p>
              <p className="text-xl font-black text-[#E5E7EB] font-headline">{activeReserves.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions - Floating Row */}
      <section className="grid grid-cols-3 gap-4 cv-auto" style={{ containIntrinsicSize: '0 100px' }}>
        {[
          { label: 'Deposit', icon: 'add_circle', path: '/assets', color: '#3B82F6' },
          { label: 'Stake', icon: 'layers', path: '/reserve', color: '#FFD700' },
          { label: 'Withdraw', icon: 'account_balance_wallet', path: '/assets', color: '#3B82F6' }
        ].map((action) => (
          <button
            key={action.label}
            onClick={() => navigate(action.path)}
            className={`premium-card rounded-[24px] py-6 flex flex-col items-center gap-3 group border-white/5 relative overflow-hidden hover:scale-[1.02] active:scale-95 transition-all ${!isMobile ? 'rainbow-glow' : ''}`}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-transparent z-0"></div>
            <div className="relative z-10 w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center transition-all group-hover:bg-white/10" style={{ color: action.color }}>
              <span className="material-symbols-outlined text-2xl">{action.icon}</span>
            </div>
            <span className="relative z-10 text-[10px] font-black uppercase tracking-[0.2em] text-[#9CA3AF] group-hover:text-white transition-colors">{action.label}</span>
          </button>
        ))}
      </section>

      {/* Premium Task Guide Section */}
      <section className="space-y-6 cv-auto" style={{ containIntrinsicSize: '0 600px' }}>
        <div className="flex items-center justify-between px-2">
          <div className="space-y-1">
            <h2 className="text-2xl font-black text-[#E5E7EB] font-headline">Your Atmos Journey</h2>
            <p className="text-[10px] text-[#9CA3AF] font-black uppercase tracking-[0.2em]">Complete steps to maximize yield</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#3B82F6]/10 border border-[#3B82F6]/20">
              <div className={`w-1.5 h-1.5 rounded-full bg-[#3B82F6] ${!isMobile ? 'animate-pulse' : ''}`}></div>
              <span className="text-[#3B82F6] text-[9px] font-black uppercase tracking-widest">Live Progress</span>
            </div>
            <div className="w-32 h-1 bg-white/5 rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${(([(dashboard?.total_balance || 0) > 0, activeReserves.length > 0, (dashboard?.total_earnings || 0) > 0, false].filter(Boolean).length) / 4) * 100}%` }}
                className="h-full bg-gradient-to-r from-[#3B82F6] to-[#FFD700]"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            {
              id: 'step1',
              title: 'Secure Your Vault',
              desc: 'Deposit USDT to initialize your investment portfolio.',
              icon: 'account_balance_wallet',
              status: (dashboard?.total_balance || 0) > 0 ? 'Completed' : 'Pending',
              action: 'Deposit Now',
              path: '/assets',
              color: '#3B82F6'
            },
            {
              id: 'step2',
              title: 'Initialize Node',
              desc: 'Deploy your first high-performance Atmos Node.',
              icon: 'memory',
              status: activeReserves.length > 0 ? 'Active' : 'Pending',
              action: 'Select Node',
              path: '/reserve',
              color: '#FFD700'
            },
            {
              id: 'step3',
              title: 'Harvest Yield',
              desc: 'Collect your daily passive rewards every 24 hours.',
              icon: 'auto_graph',
              status: (dashboard?.total_earnings || 0) > 0 ? 'Earning' : 'Locked',
              action: 'View Yield',
              path: '/reserve',
              color: '#3B82F6'
            },
            {
              id: 'step4',
              title: 'Expand Network',
              desc: 'Invite elite partners to earn team commissions.',
              icon: 'group_add',
              status: 'Available',
              action: 'Invite Now',
              path: '/team',
              color: '#FFD700'
            }
          ].map((step, index) => (
            <motion.div
              key={step.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              whileHover={isMobile ? {} : { y: -5 }}
              className={`premium-card rounded-[32px] p-6 border border-white/5 relative overflow-hidden group ${!isMobile ? 'rainbow-glow' : ''}`}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-[#3B82F6]/5 via-transparent to-[#FFD700]/5 z-0"></div>
              <div className="absolute inset-0 bg-[url('https://picsum.photos/seed/tech-node/400/400')] bg-cover bg-center opacity-[0.02] mix-blend-overlay z-0"></div>
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-2xl blur-3xl -mr-16 -mt-16 group-hover:bg-white/10 transition-colors z-0"></div>
              
              <div className="relative z-10 flex items-start gap-5">
                <div className="relative w-14 h-14 flex items-center justify-center shrink-0">
                  {/* 4 Borders Square Frame */}
                  <div className="absolute inset-0 border border-white/10 rounded-2xl"></div>
                  <div className="absolute inset-1 border border-white/5 rounded-xl bg-white/5"></div>
                  <div className="absolute inset-2 border border-white/5 rounded-lg"></div>
                  <div className="absolute inset-3 border border-white/5 rounded-md"></div>
                  
                  <div className="relative z-10 flex items-center justify-center" style={{ color: step.color }}>
                    <span className="material-symbols-outlined text-3xl">{step.icon}</span>
                  </div>
                </div>
                
                <div className="flex-1 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-black text-[#E5E7EB] font-headline text-lg tracking-tight">{step.title}</h3>
                    <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-lg ${step.status === 'Pending' || step.status === 'Locked' ? 'bg-white/5 text-[#9CA3AF]' : 'bg-[#3B82F6]/10 text-[#3B82F6]'}`}>
                      {step.status}
                    </span>
                  </div>
                  <p className="text-[10px] text-[#9CA3AF] leading-relaxed font-medium">{step.desc}</p>
                  
                  <button 
                    onClick={() => navigate(step.path)}
                    className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.2em] text-[#E5E7EB] hover:text-[#3B82F6] transition-colors group/btn"
                  >
                    {step.action}
                    <span className="material-symbols-outlined text-sm group-hover/btn:translate-x-1 transition-transform">arrow_forward</span>
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      <AnimatePresence>
        {showProfit && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed inset-0 z-[100] flex items-center justify-center px-6 bg-background/95 md:bg-background/80 md:backdrop-blur-sm"
          >
            <div className="glass-card rounded-[40px] p-8 w-full max-w-sm text-center space-y-6">
              <div className="w-20 h-20 bg-[var(--gold)]/10 rounded-full flex items-center justify-center mx-auto shadow-sm">
                <span className="material-symbols-outlined text-4xl text-[var(--gold)]">workspace_premium</span>
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-black text-on-surface tracking-tight">Profit Realized!</h2>
                <p className="text-on-surface-variant text-sm">Your Atmos Node has been successfully liquidated.</p>
              </div>
              <div className="text-5xl font-black text-[var(--blue)] tracking-tighter">
                +${showProfit.amount.toFixed(2)}
              </div>
              <button
                onClick={() => setShowProfit(null)}
                className={`btn-primary w-full py-4 rounded-2xl text-[10px] ${!isMobile ? 'rainbow-glow' : ''}`}
              >
                Collect Earnings
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
