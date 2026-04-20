import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { UserDashboard, Product, Reserve as ReserveType, Profile, DailyEarning } from '../types';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../lib/utils';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export const Dashboard = () => {
  const { user } = useAuth();
  const [dashboard, setDashboard] = useState<UserDashboard | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [activeReserves, setActiveReserves] = useState<any[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [showProfit, setShowProfit] = useState<{ amount: number } | null>(null);
  const [lastReserve, setLastReserve] = useState<ReserveType | null>(null);
  const [chartData, setChartData] = useState<DailyEarning[]>([]);
  const [isMobile, setIsMobile] = useState(false);
  const [showNotification, setShowNotification] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading) {
      const hasShownNotification = sessionStorage.getItem('atmos_notification_shown');
      if (!hasShownNotification) {
        setShowNotification(true);
        sessionStorage.setItem('atmos_notification_shown', 'true');
      }
    }
  }, [loading]);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const fetchData = async () => {
    if (!user) return;
    try {
      const [dashRes, profileRes, reservesRes, productsRes, lastReserveRes, settingsRes] = await Promise.all([
        supabase.rpc('get_user_dashboard', { p_user_id: user.id }),
        supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
        supabase.from('reserves').select('*, products(*)').eq('user_id', user.id).eq('status', 'active'),
        supabase.from('products').select('*').order('price', { ascending: false }),
        supabase.from('reserves').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1),
        supabase.from('settings').select('*').maybeSingle()
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
      setSettings(settingsRes.data);

      // Fetch and process chart data
      const { data: transData } = await supabase
        .from('transactions')
        .select('amount, created_at')
        .eq('user_id', user.id)
        .eq('type', 'reward')
        .order('created_at', { ascending: true });

      if (transData && transData.length > 0) {
        const grouped = transData.reduce((acc: any, curr: any) => {
          const date = new Date(curr.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          acc[date] = (acc[date] || 0) + curr.amount;
          return acc;
        }, {});
        
        const formatted = Object.entries(grouped).map(([date, amount]) => ({
          date,
          amount: Number(amount)
        })).slice(-7);
        
        setChartData(formatted);
      } else {
        // Mock data if no transactions yet
        setChartData([
          { date: 'Apr 1', amount: 0 },
          { date: 'Apr 2', amount: 0 },
          { date: 'Apr 3', amount: 0 },
          { date: 'Apr 4', amount: 0 },
          { date: 'Apr 5', amount: 0 },
          { date: 'Apr 6', amount: 0 },
          { date: 'Apr 7', amount: 0 },
        ]);
      }
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
      className="space-y-12 pb-20 max-w-7xl mx-auto w-full px-4"
    >
      {/* Welcome Header */}
      <section className="flex flex-col md:flex-row justify-between items-start md:items-end gap-12 px-6 pt-12 relative">
        <div className="absolute -top-32 -left-32 w-[500px] h-[500px] bg-emerald-400/5 blur-[150px] rounded-full -z-10 animate-pulse"></div>
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/5 blur-[120px] rounded-full -z-10"></div>
        
        <div className="space-y-8 relative z-10">
          <div className="flex items-center gap-6">
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex items-center gap-3 px-5 py-2 rounded-2xl bg-emerald-400/10 border border-emerald-400/20 shadow-[0_0_30px_rgba(52,211,153,0.15)]"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_15px_rgba(52,211,153,0.6)]"></span>
              <span className="text-emerald-400 text-[10px] font-headline font-black uppercase tracking-[0.4em]">
                Protocol Active
              </span>
            </motion.div>
            <div className="w-1.5 h-1.5 rounded-full bg-slate-800"></div>
            <span className="text-slate-600 text-[10px] font-headline font-black uppercase tracking-[0.4em]">
              Matrix Sync: {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </div>
          
          <div className="space-y-4">
            <motion.h1 
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              className="text-7xl md:text-8xl font-headline font-black text-white tracking-tighter leading-[0.85] uppercase"
            >
              Neural <span className="text-emerald-400 drop-shadow-[0_0_30px_rgba(52,211,153,0.3)]">Matrix</span>
            </motion.h1>
            <p className="text-slate-500 text-sm font-headline font-black uppercase tracking-[0.5em] leading-relaxed pl-2 border-l-2 border-emerald-400/30">
              Welcome, {profile?.first_name || user?.email?.split('@')[0]} • Authorized Access
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-6 pt-4">
            <motion.div 
              whileHover={{ scale: 1.05, backgroundColor: "rgba(255,255,255,0.08)" }}
              className="flex items-center gap-4 px-6 py-3 rounded-2xl glass-card border-white/10 cursor-pointer group transition-all shadow-2xl"
              onClick={() => {
                if (profile?.permanent_id) {
                  navigator.clipboard.writeText(profile.permanent_id);
                  toast.success('Matrix ID copied to clipboard');
                }
              }}
            >
              <span className="text-slate-500 text-[10px] font-headline font-black uppercase tracking-[0.3em]">Node ID: <span className="text-white ml-2">{profile?.permanent_id || 'N/A'}</span></span>
              <span className="material-symbols-outlined text-lg text-slate-600 group-hover:text-emerald-400 transition-colors">content_copy</span>
            </motion.div>
            <div className="flex items-center gap-3 px-6 py-3 rounded-2xl bg-emerald-400/5 border border-emerald-400/10 shadow-xl">
              <span className="material-symbols-outlined text-lg text-emerald-400">verified_user</span>
              <span className="text-emerald-400 text-[10px] font-headline font-black uppercase tracking-[0.3em]">Encrypted Node</span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-10 relative z-10">
          <div className="text-right hidden md:block space-y-2">
            <p className="text-[10px] text-slate-700 uppercase tracking-[0.5em] font-headline font-black">Current Tier</p>
            <p className="text-3xl font-headline font-black text-emerald-400 uppercase tracking-tight drop-shadow-[0_0_20px_rgba(52,211,153,0.4)]">Elite Matrix</p>
          </div>
          <motion.div 
            whileHover={{ scale: 1.05, y: -6 }}
            whileTap={{ scale: 0.95 }}
            className="flex items-center gap-6 px-12 py-8 rounded-[40px] bg-emerald-400 text-emerald-950 shadow-[0_0_60px_rgba(52,211,153,0.3)] relative overflow-hidden group cursor-pointer"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
            <div className="w-14 h-14 rounded-2xl bg-emerald-950/10 flex items-center justify-center border border-emerald-950/10">
              <span className="material-symbols-outlined font-black text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>workspace_premium</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] font-headline font-black uppercase tracking-[0.2em] opacity-60">VIP Protocol</span>
              <span className="text-3xl font-headline font-black uppercase tracking-widest leading-none">Tier {vipLevel}</span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Main Bento Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 px-4">
        {/* Portfolio Summary */}
        <div className="lg:col-span-2 glass-card rounded-[64px] p-14 relative overflow-hidden group border-white/5 shadow-[0_0_80px_rgba(0,0,0,0.4)]">
          <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-emerald-400/5 blur-[180px] -mr-48 -mt-48 group-hover:bg-emerald-400/10 transition-colors duration-1000"></div>
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-500/5 blur-[150px] -ml-40 -mb-40"></div>
          
          <div className="relative z-10 space-y-20">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-12">
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-400/10 flex items-center justify-center border border-emerald-400/20 shadow-xl">
                    <span className="material-symbols-outlined text-emerald-400 text-2xl">account_balance_wallet</span>
                  </div>
                  <p className="text-[11px] text-slate-600 uppercase tracking-[0.6em] font-headline font-black">Aggregate Portfolio Value</p>
                </div>
                <h3 className="text-8xl md:text-9xl font-headline font-black text-white tracking-tighter drop-shadow-[0_0_40px_rgba(255,255,255,0.15)] leading-none">
                  <span className="text-5xl md:text-6xl mr-3 text-slate-800">$</span>
                  {(dashboard?.total_balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </h3>
              </div>
              <div className="flex flex-col items-start md:items-end gap-6">
                <motion.div 
                  whileHover={{ scale: 1.05, x: -4 }}
                  className="px-8 py-3 rounded-2xl bg-emerald-400/10 border border-emerald-400/20 flex items-center gap-4 shadow-2xl"
                >
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
                  <p className="text-[11px] text-emerald-400 uppercase tracking-[0.3em] font-headline font-black">+12.5% Yield Projection</p>
                </motion.div>
                <div className="h-24 w-72 opacity-30 group-hover:opacity-100 transition-opacity duration-1000">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10B981" stopOpacity={0.5}/>
                          <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <Area type="monotone" dataKey="amount" stroke="#10B981" fill="url(#colorAmount)" strokeWidth={5} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-16 pt-16 border-t border-white/5">
              <div className="space-y-4">
                <p className="text-[11px] text-slate-700 uppercase tracking-[0.4em] font-headline font-black">Liquid Capital</p>
                <p className="text-5xl font-headline font-black text-white tracking-tight uppercase">${(dashboard?.available_balance || 0).toLocaleString()}</p>
              </div>
              <div className="space-y-4">
                <p className="text-[11px] text-slate-700 uppercase tracking-[0.4em] font-headline font-black">Active Nodes</p>
                <p className="text-5xl font-headline font-black text-emerald-400 tracking-tight uppercase">${(dashboard?.total_reserve || 0).toLocaleString()}</p>
              </div>
              <div className="hidden sm:block space-y-4">
                <p className="text-[11px] text-slate-700 uppercase tracking-[0.4em] font-headline font-black">Total Yield</p>
                <p className="text-5xl font-headline font-black text-emerald-400 tracking-tight uppercase">${(dashboard?.total_earnings || 0).toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>

        {/* VIP Progress Card */}
        <div className="glass-card rounded-[64px] p-14 flex flex-col justify-between relative overflow-hidden group border-white/5 shadow-[0_0_80px_rgba(0,0,0,0.4)]">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-400/5 to-transparent opacity-40"></div>
          <div className="absolute -bottom-24 -right-24 w-80 h-80 bg-emerald-400/5 blur-[120px] rounded-full"></div>
          
          <div className="relative z-10 space-y-16">
            <div className="flex justify-between items-center">
              <div className="space-y-3">
                <p className="text-[11px] text-slate-700 uppercase tracking-[0.6em] font-headline font-black">Evolution Path</p>
                <h4 className="text-4xl font-headline font-black text-white tracking-tight uppercase leading-none">Tier Matrix</h4>
              </div>
              <div className="w-20 h-20 bg-emerald-400/10 rounded-[28px] flex items-center justify-center text-emerald-400 border border-emerald-400/20 shadow-2xl group-hover:scale-110 transition-transform duration-700">
                <span className="material-symbols-outlined text-4xl">military_tech</span>
              </div>
            </div>
            
            <div className="space-y-12">
              <div className="flex justify-between items-end">
                <div className="space-y-3">
                  <p className="text-[11px] text-slate-700 uppercase tracking-[0.4em] font-headline font-black">Next Synchronization</p>
                  <p className="text-5xl font-headline font-black text-white tracking-tighter uppercase">
                    ${vipLevel === 1 ? '101' : vipLevel === 2 ? '501' : vipLevel === 3 ? '2,001' : vipLevel === 4 ? '5,001' : 'MAX'}
                  </p>
                </div>
                <div className="px-6 py-3 rounded-2xl bg-emerald-400/10 border border-emerald-400/20 shadow-2xl">
                  <span className="text-emerald-400 text-[11px] font-headline font-black uppercase tracking-[0.3em]">Tier {vipLevel}</span>
                </div>
              </div>
              
              <div className="space-y-6">
                <div className="h-5 w-full bg-white/5 rounded-full overflow-hidden border border-white/10 p-1.5 shadow-inner relative">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ 
                      width: `${Math.min(100, (dashboard?.total_balance || 0) / (vipLevel === 1 ? 101 : vipLevel === 2 ? 501 : vipLevel === 3 ? 2001 : vipLevel === 4 ? 5001 : 1) * 100)}%` 
                    }}
                    className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 shadow-[0_0_30px_rgba(52,211,153,0.6)] relative rounded-full"
                  >
                    <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.4)_50%,transparent_100%)] animate-shimmer w-40 h-full"></div>
                  </motion.div>
                </div>
                <div className="flex justify-between text-[11px] font-headline font-black uppercase tracking-[0.5em] text-slate-700 px-2">
                  <span>Network Progress</span>
                  <span className="text-emerald-400">{Math.round(Math.min(100, (dashboard?.total_balance || 0) / (vipLevel === 1 ? 101 : vipLevel === 2 ? 501 : vipLevel === 3 ? 2001 : vipLevel === 4 ? 5001 : 1) * 100))}%</span>
                </div>
              </div>
            </div>
          </div>

          <motion.button 
            whileHover={{ scale: 1.02, backgroundColor: "rgba(255,255,255,0.08)" }}
            whileTap={{ scale: 0.98 }}
            className="relative z-10 w-full py-7 mt-16 bg-white/5 border border-white/10 rounded-[32px] text-white text-[11px] font-headline font-black uppercase tracking-[0.5em] hover:text-emerald-400 transition-all shadow-2xl"
          >
            Tier Protocol Details
          </motion.button>
        </div>
      </div>

      {/* Live Feed Marquee */}
      <section className="glass-card rounded-[40px] py-10 overflow-hidden relative border-white/5 mx-4 shadow-[0_0_60px_rgba(0,0,0,0.3)]">
        <div className="absolute left-0 top-0 bottom-0 w-80 bg-gradient-to-r from-[#05070A] to-transparent z-10"></div>
        <div className="absolute right-0 top-0 bottom-0 w-80 bg-gradient-to-l from-[#05070A] to-transparent z-10"></div>
        
        <div className="flex gap-20 animate-marquee whitespace-nowrap">
          {[...Array(2)].map((_, groupIndex) => (
            <div key={groupIndex} className="flex gap-20 items-center">
              {[
                { user: 'NODE_829', amount: '1,240.00', type: 'STAKE' },
                { user: 'NODE_104', amount: '450.50', type: 'YIELD' },
                { user: 'NODE_992', amount: '3,000.00', type: 'DEPOSIT' },
                { user: 'NODE_312', amount: '89.20', type: 'YIELD' },
                { user: 'NODE_554', amount: '5,000.00', type: 'STAKE' },
              ].map((item, i) => (
                <div key={`${groupIndex}-${i}`} className="flex items-center gap-8 px-10 py-4.5 rounded-[24px] bg-white/[0.03] border border-white/5 shadow-2xl group hover:bg-white/[0.06] transition-all">
                  <div className="w-3 h-3 rounded-full bg-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.8)] animate-pulse"></div>
                  <span className="text-sm font-headline font-black text-white uppercase tracking-[0.2em] group-hover:text-emerald-400 transition-colors">{item.user}</span>
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-800"></div>
                  <span className="text-sm font-headline font-black text-emerald-400 tracking-tight">${item.amount}</span>
                  <span className="text-[11px] font-headline font-black uppercase tracking-[0.4em] text-slate-700">{item.type}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>

      {/* Quick Actions */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-8 px-4">
        {[
          { label: 'Deposit', icon: 'add_circle', path: '/assets' },
          { label: 'Yield Forge', icon: 'bolt', path: '/reserve' },
          { label: 'Withdraw', icon: 'account_balance_wallet', path: '/assets' },
          { label: 'Network', icon: 'hub', path: '/team' }
        ].map((action) => (
          <motion.button
            key={action.label}
            whileHover={{ y: -10, scale: 1.02 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate(action.path)}
            className="glass-card rounded-[48px] p-10 flex flex-col items-center gap-8 group hover:bg-emerald-400/5 transition-all border-white/5 shadow-2xl relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-b from-emerald-400/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div className="w-20 h-20 rounded-[24px] bg-emerald-400/10 flex items-center justify-center text-emerald-400 group-hover:bg-emerald-400 group-hover:text-emerald-950 transition-all duration-500 shadow-[0_0_30px_rgba(52,211,153,0.15)] relative z-10">
              <span className="material-symbols-outlined text-4xl">{action.icon}</span>
            </div>
            <span className="text-xs font-headline font-black uppercase tracking-[0.4em] text-slate-600 group-hover:text-white transition-colors relative z-10">{action.label}</span>
          </motion.button>
        ))}
      </section>

      {/* Atmos Journey Steps */}
      <section className="space-y-16 px-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-8 px-8">
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-2.5 h-10 bg-emerald-400 rounded-full shadow-[0_0_20px_rgba(52,211,153,0.6)]"></div>
              <h2 className="text-5xl font-headline font-black text-white tracking-tighter uppercase leading-none">Matrix Evolution</h2>
            </div>
            <p className="text-[11px] text-slate-700 uppercase tracking-[0.6em] font-headline font-black pl-2">Synchronize nodes to maximize yield potential</p>
          </div>
          <div className="text-right hidden sm:block space-y-3">
            <p className="text-[11px] text-slate-700 uppercase tracking-[0.4em] font-headline font-black">Overall Synchronization</p>
            <p className="text-3xl font-headline font-black text-emerald-400 uppercase tracking-tight drop-shadow-[0_0_15px_rgba(52,211,153,0.4)]">Protocol 2 of 4</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          {[
            {
              title: 'Initialize Vault',
              desc: 'Deposit USDT to activate your investment matrix and begin your journey.',
              icon: 'account_balance_wallet',
              status: (dashboard?.total_balance || 0) > 0 ? 'Completed' : 'Pending',
              action: 'Deposit Now',
              path: '/assets'
            },
            {
              title: 'Forge Yield',
              desc: 'Deploy your first high-performance Atmos Node to start generating passive yield.',
              icon: 'bolt',
              status: activeReserves.length > 0 ? 'Active' : 'Pending',
              action: 'Enter Forge',
              path: '/reserve'
            },
            {
              title: 'Harvest Rewards',
              desc: 'Collect your daily passive rewards every 24 hours as your nodes mature.',
              icon: 'auto_graph',
              status: (dashboard?.total_earnings || 0) > 0 ? 'Earning' : 'Locked',
              action: 'View Yield',
              path: '/reserve'
            },
            {
              title: 'Expand Network',
              desc: 'Invite elite partners to your matrix to earn massive team commissions.',
              icon: 'hub',
              status: 'Available',
              action: 'Invite Now',
              path: '/team'
            }
          ].map((step, index) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.2 }}
              className="glass-card rounded-[64px] p-14 flex items-start gap-12 group hover:bg-white/[0.04] transition-all relative overflow-hidden border-white/5 shadow-[0_0_60px_rgba(0,0,0,0.3)]"
            >
              <div className="w-28 h-28 rounded-[36px] bg-white/5 flex items-center justify-center shrink-0 border border-white/10 group-hover:border-emerald-400/50 transition-all duration-1000 shadow-2xl relative overflow-hidden">
                <div className="absolute inset-0 bg-emerald-400/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <span className="material-symbols-outlined text-6xl text-emerald-400 group-hover:scale-110 group-hover:rotate-6 transition-transform duration-1000 relative z-10">{step.icon}</span>
              </div>
              
              <div className="flex-1 space-y-10">
                <div className="flex justify-between items-center">
                  <h3 className="text-4xl font-headline font-black text-white tracking-tight uppercase group-hover:text-emerald-400 transition-colors leading-none">{step.title}</h3>
                  <div className={cn(
                    "text-[10px] font-headline font-black uppercase tracking-[0.3em] px-6 py-2.5 rounded-2xl border transition-all shadow-xl",
                    step.status === 'Completed' || step.status === 'Active' || step.status === 'Earning'
                      ? "bg-emerald-400/10 text-emerald-400 border-emerald-400/20 shadow-emerald-400/5"
                      : "bg-white/5 text-slate-800 border-white/5"
                  )}>
                    {step.status}
                  </div>
                </div>
                <p className="text-base text-slate-500 font-headline font-medium leading-relaxed">{step.desc}</p>
                <motion.button 
                  whileHover={{ x: 12 }}
                  onClick={() => navigate(step.path)}
                  className="flex items-center gap-5 text-[11px] font-headline font-black uppercase tracking-[0.5em] text-emerald-400 hover:text-emerald-300 transition-colors pt-6 group/btn"
                >
                  {step.action}
                  <span className="material-symbols-outlined text-xl group-hover/btn:translate-x-2 transition-transform">arrow_forward</span>
                </motion.button>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      <AnimatePresence>
        {showNotification && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] flex items-center justify-center px-6 bg-[#05070A]/95 backdrop-blur-2xl"
          >
            <motion.div
              initial={{ scale: 0.9, y: 40, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              className="glass-card rounded-[64px] p-16 w-full max-w-2xl border-white/10 shadow-[0_0_150px_rgba(0,0,0,0.8)] relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-400/10 blur-[120px] -mr-32 -mt-32"></div>
              
              <div className="relative z-10 space-y-12">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-6">
                    <div className="w-20 h-20 bg-emerald-400/10 rounded-[32px] flex items-center justify-center text-emerald-400 border border-emerald-400/20 shadow-2xl">
                      <span className="material-symbols-outlined text-4xl">notifications_active</span>
                    </div>
                    <div className="space-y-2">
                      <h2 className="text-3xl font-headline font-black text-white tracking-tight uppercase leading-none">System Briefing</h2>
                      <p className="text-[10px] text-slate-600 font-headline font-black uppercase tracking-[0.4em]">VIP Evolution Protocol</p>
                    </div>
                  </div>
                  <motion.button 
                    whileHover={{ scale: 1.1, rotate: 90 }}
                    onClick={() => setShowNotification(false)}
                    className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center text-slate-600 hover:text-white transition-all border border-white/10"
                  >
                    <span className="material-symbols-outlined">close</span>
                  </motion.button>
                </div>

                <div className="space-y-10">
                  {settings?.announcement_text && (
                    <div className="p-10 rounded-[40px] bg-emerald-400/5 border border-emerald-400/10 relative overflow-hidden shadow-inner">
                      <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-400"></div>
                      <p className="text-base text-emerald-50/80 leading-relaxed font-headline font-medium italic">
                        "{settings.announcement_text}"
                      </p>
                    </div>
                  )}

                  <div className="space-y-6">
                    <p className="text-[11px] text-slate-600 font-headline font-black uppercase tracking-[0.5em] px-4">VIP Tier Matrix</p>
                    <div className="grid grid-cols-1 gap-4">
                      {[
                        { level: 1, range: '$0 - $100', team: 'No Req.', color: '#94a3b8' },
                        { level: 2, range: '$101 - $500', team: '3 Direct', color: '#10B981' },
                        { level: 3, range: '$501 - $2,000', team: '10 Direct', color: '#10B981' },
                        { level: 4, range: '$2,001 - $5,000', team: '25 Direct', color: '#10B981' },
                        { level: 5, range: '$5,001+', team: '50 Direct', color: '#10B981' },
                      ].map((vip) => (
                        <div key={vip.level} className="flex items-center justify-between p-6 rounded-3xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] transition-all group">
                          <div className="flex items-center gap-5">
                            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center group-hover:scale-110 transition-transform">
                              <span className="material-symbols-outlined text-xl" style={{ color: vip.color }}>workspace_premium</span>
                            </div>
                            <span className="text-sm font-headline font-black text-white uppercase tracking-widest">VIP Tier {vip.level}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-sm font-headline font-black text-emerald-400 tracking-tight">{vip.range}</span>
                            <p className="text-[9px] text-slate-700 font-headline font-black uppercase tracking-widest mt-1">{vip.team}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <motion.button
                  whileHover={{ scale: 1.02, backgroundColor: "#34d399" }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowNotification(false)}
                  className="w-full py-7 rounded-3xl bg-emerald-400 text-emerald-950 font-headline font-black uppercase tracking-[0.5em] text-xs shadow-[0_0_50px_rgba(52,211,153,0.4)] transition-all"
                >
                  Acknowledge Protocol
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {showProfit && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed inset-0 z-[120] flex items-center justify-center px-6 bg-[#05070A]/95 backdrop-blur-2xl"
          >
            <div className="glass-card rounded-[64px] p-16 w-full max-w-md text-center space-y-12 border-emerald-400/20 shadow-[0_0_120px_rgba(52,211,153,0.2)] relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1.5 bg-emerald-400 shadow-[0_0_20px_rgba(52,211,153,0.5)]"></div>
              <div className="w-32 h-32 bg-emerald-400/10 rounded-full flex items-center justify-center mx-auto border border-emerald-400/20 shadow-2xl relative">
                <div className="absolute inset-0 bg-emerald-400/20 blur-2xl rounded-full animate-pulse"></div>
                <motion.span 
                  animate={{ scale: [1, 1.2, 1], rotate: [0, 5, -5, 0] }}
                  transition={{ duration: 3, repeat: Infinity }}
                  className="material-symbols-outlined text-7xl text-emerald-400 relative z-10" 
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  bolt
                </motion.span>
              </div>
              <div className="space-y-4">
                <h2 className="text-5xl font-headline font-black text-white tracking-tight uppercase">Yield Harvested</h2>
                <p className="text-slate-600 text-sm font-headline font-medium leading-relaxed px-4">Your Atmos Node has successfully liquidated its yield into your primary vault.</p>
              </div>
              <div className="text-8xl font-headline font-black text-emerald-400 tracking-tighter drop-shadow-[0_0_30px_rgba(52,211,153,0.4)]">
                <span className="text-4xl mr-1 text-emerald-400/50">$</span>
                {showProfit.amount.toFixed(2)}
              </div>
              <motion.button
                whileHover={{ scale: 1.02, backgroundColor: "#34d399" }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowProfit(null)}
                className="w-full py-7 rounded-3xl bg-emerald-400 text-emerald-950 font-headline font-black uppercase tracking-[0.5em] text-xs shadow-[0_0_50px_rgba(52,211,153,0.4)]"
              >
                Collect Earnings
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
