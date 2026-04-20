import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { UserDashboard, Transaction, Deposit, Withdrawal } from '../types';
import { toast } from 'sonner';
import { motion } from 'motion/react';
import { DepositModal } from '../components/DepositModal';
import { WithdrawModal } from '../components/WithdrawModal';
import { cn } from '../lib/utils';

export const Assets = () => {
  const { user } = useAuth();
  const [dashboard, setDashboard] = useState<UserDashboard | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);

  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const fetchData = async () => {
    if (!user) return;
    try {
      const [dashRes, transRes, depositsRes, withdrawalsRes] = await Promise.all([
        supabase.rpc('get_user_dashboard', { p_user_id: user.id }),
        supabase.from('transactions').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(10),
        supabase.from('deposits').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(5),
        supabase.from('withdrawals').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(5)
      ]);

      if (dashRes.error) throw dashRes.error;
      if (transRes.error) throw transRes.error;
      if (depositsRes.error) throw depositsRes.error;
      if (withdrawalsRes.error) throw withdrawalsRes.error;

      setDashboard(dashRes.data);
      setTransactions(transRes.data || []);
      setDeposits(depositsRes.data || []);
      setWithdrawals(withdrawalsRes.data || []);
    } catch (error: any) {
      console.error('Assets error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="w-10 h-10 border-4 border-[var(--blue)] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-16 pb-20 max-w-7xl mx-auto w-full px-4"
    >
      {/* Total Balance Header */}
      <section className="text-center space-y-10 px-4 relative pt-10">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-400/5 blur-[150px] rounded-full -z-10 animate-pulse"></div>
        <div className="flex justify-center">
          <div className="flex items-center gap-3 px-6 py-2 bg-emerald-400/10 rounded-full border border-emerald-400/20 shadow-[0_0_30px_rgba(52,211,153,0.15)] backdrop-blur-md">
            <motion.div 
              animate={{ opacity: [0.3, 1, 0.3], scale: [1, 1.2, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.6)]"
            ></motion.div>
            <span className="text-[10px] font-headline font-black uppercase tracking-[0.5em] text-emerald-400">Live Asset Matrix</span>
          </div>
        </div>
        <div className="space-y-4">
          <motion.h1 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-8xl md:text-9xl font-headline font-black text-white tracking-tighter leading-none drop-shadow-[0_0_50px_rgba(255,255,255,0.1)]"
          >
            <span className="text-4xl md:text-5xl mr-2 text-slate-700">$</span>
            {Number(dashboard?.total_balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </motion.h1>
          <div className="flex flex-col items-center gap-4">
            <p className="text-slate-600 text-xs font-headline font-black uppercase tracking-[0.6em]">Global Portfolio Valuation</p>
            <div className="w-32 h-1 bg-gradient-to-r from-transparent via-emerald-400/30 to-transparent rounded-full"></div>
          </div>
        </div>
      </section>

      {/* Asset Breakdown Grid */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 px-2">
        {[
          { label: 'Available Liquidity', value: dashboard?.available_balance, icon: 'account_balance_wallet', color: 'emerald' },
          { label: 'Yield Generated', value: dashboard?.total_earnings, icon: 'trending_up', color: 'emerald' },
          { label: 'Total Deposits', value: dashboard?.deposit_balance, icon: 'add_circle', color: 'blue' },
          { label: 'Withdrawable', value: dashboard?.withdrawable_balance, icon: 'account_balance', color: 'emerald' }
        ].map((item, index) => (
          <motion.div 
            key={item.label}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            whileHover={{ y: -10, scale: 1.02 }}
            className="glass-card p-12 rounded-[56px] space-y-8 group hover:bg-white/[0.03] transition-all relative overflow-hidden border-white/5 shadow-2xl"
          >
            <div className="absolute top-0 right-0 w-40 h-40 bg-emerald-400/5 blur-[80px] -mr-12 -mt-12 group-hover:bg-emerald-400/10 transition-colors"></div>
            <div className="flex justify-between items-start relative z-10">
              <div className="w-20 h-20 rounded-[28px] bg-white/5 flex items-center justify-center text-slate-600 group-hover:text-emerald-400 group-hover:bg-emerald-400/10 transition-all duration-700 border border-white/10 shadow-xl">
                <span className="material-symbols-outlined text-4xl">{item.icon}</span>
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className="px-3 py-1 rounded-lg bg-white/5 border border-white/10">
                  <span className="text-[8px] font-headline font-black uppercase tracking-widest text-slate-600">Node_{index + 1}</span>
                </div>
                <div className="w-2 h-2 rounded-full bg-emerald-400/10 group-hover:bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0)] group-hover:shadow-[0_0_10px_rgba(52,211,153,0.5)] transition-all mt-1"></div>
              </div>
            </div>
            <div className="space-y-3 relative z-10">
              <p className="text-[10px] text-slate-600 uppercase tracking-[0.3em] font-headline font-black">{item.label}</p>
              <p className="text-4xl font-headline font-black text-white tracking-tight group-hover:text-emerald-400 transition-colors">
                <span className="text-xl text-slate-700 mr-1">$</span>
                {Number(item.value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
          </motion.div>
        ))}
      </section>

      {/* Action Hub */}
      <section className="flex flex-col sm:flex-row justify-center items-center gap-10 px-4">
        <motion.button
          whileHover={{ scale: 1.05, y: -8 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsDepositModalOpen(true)}
          className="w-full max-w-sm py-8 px-12 bg-emerald-400 text-emerald-950 rounded-[32px] flex items-center justify-center gap-6 text-xs font-headline font-black uppercase tracking-[0.5em] shadow-[0_0_60px_rgba(52,211,153,0.4)] transition-all relative overflow-hidden group"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
          <span className="material-symbols-outlined font-black text-3xl">add_circle</span>
          Initialize Deposit
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.05, y: -8 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsWithdrawModalOpen(true)}
          className="w-full max-w-sm py-8 px-12 bg-white/5 border border-white/10 text-white rounded-[32px] flex items-center justify-center gap-6 text-xs font-headline font-black uppercase tracking-[0.5em] hover:bg-white/10 transition-all shadow-2xl relative overflow-hidden group"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
          <span className="material-symbols-outlined font-black text-3xl">arrow_outward</span>
          Request Withdrawal
        </motion.button>
      </section>

      {/* Transaction History */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 px-4">
        {/* Withdrawals Section */}
        <section className="space-y-10">
          <div className="flex items-center justify-between px-8">
            <div className="flex items-center gap-4">
              <div className="w-2 h-8 bg-emerald-400 rounded-full shadow-[0_0_15px_rgba(52,211,153,0.5)]"></div>
              <h2 className="text-3xl font-headline font-black text-white tracking-tight uppercase">Withdrawal Logs</h2>
            </div>
            <span className="text-[10px] text-slate-600 font-headline font-black uppercase tracking-[0.4em]">Protocol Outflow</span>
          </div>
          <div className="space-y-6">
            {withdrawals.length > 0 ? withdrawals.map((w, index) => (
              <motion.div 
                key={w.id}
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="glass-card p-10 rounded-[40px] flex items-center justify-between group hover:bg-white/[0.03] transition-all border-white/5 shadow-2xl relative overflow-hidden"
              >
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-500/30 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="flex items-center gap-8">
                  <div className="w-16 h-16 rounded-[20px] bg-white/5 flex items-center justify-center text-slate-600 group-hover:text-white group-hover:bg-white/10 transition-all duration-700 border border-white/10 shadow-lg">
                    <span className="material-symbols-outlined text-3xl">outbox</span>
                  </div>
                  <div className="space-y-2">
                    <p className="font-headline font-black text-white text-base uppercase tracking-tight group-hover:text-red-400 transition-colors">{w.network} Protocol</p>
                    <div className="flex items-center gap-3">
                      <span className="text-[9px] text-slate-700 font-headline font-black uppercase tracking-widest">Address:</span>
                      <p className="text-[10px] text-slate-500 font-headline font-black uppercase tracking-tighter truncate max-w-[180px]">{w.wallet_address}</p>
                    </div>
                  </div>
                </div>
                <div className="text-right space-y-4">
                  <p className="font-headline font-black text-white text-2xl tracking-tighter">-${w.amount.toLocaleString()}</p>
                  <span className={cn(
                    "text-[10px] font-headline font-black uppercase tracking-widest px-4 py-1.5 rounded-2xl border transition-all",
                    w.status === 'pending' ? "bg-white/5 text-slate-600 border-white/10" :
                    w.status === 'approved' ? "bg-emerald-400/10 text-emerald-400 border-emerald-400/20 shadow-[0_0_20px_rgba(52,211,153,0.15)]" :
                    "bg-red-500/10 text-red-500 border-red-500/20"
                  )}>
                    {w.status}
                  </span>
                </div>
              </motion.div>
            )) : (
              <div className="glass-card p-24 rounded-[40px] text-center border-dashed border-white/10 bg-white/5 shadow-inner">
                <span className="material-symbols-outlined text-6xl text-slate-800 mb-6">history</span>
                <p className="text-slate-700 text-[11px] font-headline font-black uppercase tracking-[0.4em]">No outflow activity detected</p>
              </div>
            )}
          </div>
        </section>

        {/* Deposits Section */}
        <section className="space-y-10">
          <div className="flex items-center justify-between px-8">
            <div className="flex items-center gap-4">
              <div className="w-2 h-8 bg-emerald-400 rounded-full shadow-[0_0_15px_rgba(52,211,153,0.5)]"></div>
              <h2 className="text-3xl font-headline font-black text-white tracking-tight uppercase">Deposit Logs</h2>
            </div>
            <span className="text-[10px] text-slate-600 font-headline font-black uppercase tracking-[0.4em]">Protocol Inflow</span>
          </div>
          <div className="space-y-6">
            {deposits.length > 0 ? deposits.map((dep, index) => (
              <motion.div 
                key={dep.id}
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="glass-card p-10 rounded-[40px] flex items-center justify-between group hover:bg-white/[0.03] transition-all border-white/5 shadow-2xl relative overflow-hidden"
              >
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-400/30 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="flex items-center gap-8">
                  <div className="w-16 h-16 rounded-[20px] bg-emerald-400/10 flex items-center justify-center text-emerald-400 border border-emerald-400/20 shadow-[0_0_20px_rgba(52,211,153,0.15)] group-hover:scale-110 transition-transform duration-700">
                    <span className="material-symbols-outlined text-3xl">account_balance_wallet</span>
                  </div>
                  <div className="space-y-2">
                    <p className="font-headline font-black text-white text-base uppercase tracking-tight group-hover:text-emerald-400 transition-colors">{dep.network} Protocol</p>
                    <div className="flex items-center gap-3">
                      <span className="text-[9px] text-slate-700 font-headline font-black uppercase tracking-widest">TXID:</span>
                      <p className="text-[10px] text-slate-500 font-headline font-black uppercase tracking-tighter truncate max-w-[180px]">{dep.txid}</p>
                    </div>
                  </div>
                </div>
                <div className="text-right space-y-4">
                  <p className="font-headline font-black text-emerald-400 text-2xl tracking-tighter">+${dep.amount.toLocaleString()}</p>
                  <span className={cn(
                    "text-[10px] font-headline font-black uppercase tracking-widest px-4 py-1.5 rounded-2xl border transition-all",
                    dep.status === 'pending' ? "bg-white/5 text-slate-600 border-white/10" :
                    dep.status === 'approved' ? "bg-emerald-400/10 text-emerald-400 border-emerald-400/20 shadow-[0_0_20px_rgba(52,211,153,0.15)]" :
                    "bg-red-500/10 text-red-500 border-red-500/20"
                  )}>
                    {dep.status}
                  </span>
                </div>
              </motion.div>
            )) : (
              <div className="glass-card p-24 rounded-[40px] text-center border-dashed border-white/10 bg-white/5 shadow-inner">
                <span className="material-symbols-outlined text-6xl text-slate-800 mb-6">history</span>
                <p className="text-slate-700 text-[11px] font-headline font-black uppercase tracking-[0.4em]">No inflow activity detected</p>
              </div>
            )}
          </div>
        </section>
      </div>

      <DepositModal 
        isOpen={isDepositModalOpen} 
        onClose={() => setIsDepositModalOpen(false)} 
        onSuccess={fetchData}
      />

      <WithdrawModal
        isOpen={isWithdrawModalOpen}
        onClose={() => setIsWithdrawModalOpen(false)}
        onSuccess={fetchData}
        availableBalance={dashboard?.available_balance || 0}
      />
    </motion.div>
  );
};
