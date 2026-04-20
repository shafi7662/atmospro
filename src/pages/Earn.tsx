import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { cn } from '../lib/utils';

interface Transaction {
  id: string;
  type: 'profit' | 'deposit' | 'withdraw' | 'referral';
  amount: number;
  status: 'completed' | 'pending' | 'failed';
  created_at: string;
}

export const Earn = () => {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalEarnings, setTotalEarnings] = useState(0);

  const fetchData = async () => {
    if (!user) return;
    try {
      const [transRes, dashRes] = await Promise.all([
        supabase
          .from('transactions')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),
        supabase.rpc('get_user_dashboard', { p_user_id: user.id })
      ]);

      if (transRes.error) throw transRes.error;
      setTransactions(transRes.data || []);
      
      if (!dashRes.error) {
        setTotalEarnings(dashRes.data.total_earnings || 0);
      }
    } catch (error: any) {
      console.error('Earn page error:', error);
      toast.error('Failed to load earnings history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const getIcon = (type: string) => {
    switch (type) {
      case 'profit': return 'trending_up';
      case 'deposit': return 'add_circle';
      case 'withdraw': return 'remove_circle';
      case 'referral': return 'group';
      default: return 'payments';
    }
  };

  const getColor = (type: string) => {
    switch (type) {
      case 'profit': return 'text-[var(--blue)]';
      case 'deposit': return 'text-[var(--gold)]';
      case 'withdraw': return 'text-red-500';
      case 'referral': return 'text-purple-500';
      default: return 'text-on-surface';
    }
  };

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
      className="space-y-16 pb-20 max-w-5xl mx-auto px-4"
    >
      {/* Header Section */}
      <header className="text-center space-y-12 px-4 relative pt-12">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-400/5 blur-[150px] rounded-full -z-10 animate-pulse"></div>
        
        <div className="flex justify-center">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex items-center gap-4 px-6 py-2 bg-emerald-400/10 rounded-full border border-emerald-400/20 shadow-[0_0_30px_rgba(52,211,153,0.15)] backdrop-blur-md"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_12px_rgba(52,211,153,0.6)]"></span>
            <span className="text-[10px] font-headline font-black uppercase tracking-[0.5em] text-emerald-400">Yield Accumulation Active</span>
          </motion.div>
        </div>

        <div className="space-y-6">
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-8xl sm:text-9xl font-headline font-black text-white tracking-tighter drop-shadow-[0_0_50px_rgba(255,255,255,0.1)] leading-none"
          >
            <span className="text-emerald-400/30 text-4xl sm:text-5xl mr-2">$</span>
            {totalEarnings.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </motion.h1>
          <div className="flex flex-col items-center gap-4">
            <p className="text-slate-600 text-xs font-headline font-black uppercase tracking-[0.7em] max-w-sm mx-auto leading-relaxed">Aggregate Yield Protocol Synchronization</p>
            <div className="w-40 h-1 bg-gradient-to-r from-transparent via-emerald-400/30 to-transparent rounded-full"></div>
          </div>
        </div>

        <div className="flex justify-center gap-6">
          <motion.div 
            whileHover={{ scale: 1.05, y: -4 }}
            whileTap={{ scale: 0.95 }}
            className="px-10 py-4 rounded-[24px] bg-emerald-400 text-emerald-950 text-[11px] font-headline font-black uppercase tracking-[0.4em] shadow-[0_0_50px_rgba(52,211,153,0.3)] cursor-pointer relative overflow-hidden group"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
            History
          </motion.div>
          <motion.div 
            whileHover={{ scale: 1.05, y: -4, backgroundColor: "rgba(255,255,255,0.08)" }}
            whileTap={{ scale: 0.95 }}
            className="px-10 py-4 rounded-[24px] bg-white/5 border border-white/10 text-slate-500 text-[11px] font-headline font-black uppercase tracking-[0.4em] hover:text-white transition-all cursor-pointer shadow-2xl"
          >
            Rewards
          </motion.div>
        </div>
      </header>

      {/* Transaction Matrix */}
      <section className="space-y-12 w-full relative">
        <div className="flex items-center justify-between px-8">
          <div className="space-y-2">
            <h2 className="text-4xl font-headline font-black text-white tracking-tight uppercase leading-none">Transaction Matrix</h2>
            <p className="text-[10px] text-slate-600 font-headline font-black uppercase tracking-[0.4em]">Real-time Ledger Synchronization</p>
          </div>
          <div className="px-6 py-2 rounded-2xl bg-white/5 border border-white/10 shadow-xl backdrop-blur-md">
            <span className="text-[10px] text-emerald-400 font-headline font-black uppercase tracking-[0.2em]">{transactions.length} Data Nodes</span>
          </div>
        </div>

        {transactions.length > 0 ? (
          <div className="grid grid-cols-1 gap-6">
            {transactions.map((tx, index) => (
              <motion.div 
                key={tx.id}
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                whileHover={{ scale: 1.02, x: 8 }}
                className="glass-card rounded-[40px] p-10 flex items-center justify-between group hover:bg-white/[0.03] transition-all border-white/5 shadow-2xl relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-transparent via-current to-transparent opacity-0 group-hover:opacity-60 transition-opacity duration-500" style={{ color: tx.type === 'profit' ? '#34d399' : tx.type === 'deposit' ? '#60a5fa' : tx.type === 'withdraw' ? '#f87171' : '#a78bfa' }}></div>
                
                <div className="flex items-center gap-10">
                  <div className={cn(
                    "w-20 h-20 rounded-[28px] flex items-center justify-center transition-all duration-700 shadow-2xl border border-white/5 group-hover:scale-110 group-hover:rotate-6",
                    tx.type === 'profit' ? "bg-emerald-400/10 text-emerald-400 shadow-emerald-400/10" :
                    tx.type === 'deposit' ? "bg-blue-400/10 text-blue-400 shadow-blue-400/10" :
                    tx.type === 'withdraw' ? "bg-red-400/10 text-red-400 shadow-red-400/10" :
                    "bg-purple-400/10 text-purple-400 shadow-purple-400/10"
                  )}>
                    <span className="material-symbols-outlined text-4xl">{getIcon(tx.type)}</span>
                  </div>
                  <div className="space-y-3">
                    <h3 className="text-white font-headline font-black text-2xl uppercase tracking-tighter group-hover:text-emerald-400 transition-colors">{tx.type}</h3>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[12px] text-slate-700">calendar_today</span>
                        <p className="text-slate-600 text-[10px] font-headline font-black uppercase tracking-widest">
                          {new Date(tx.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                      </div>
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-900"></span>
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[12px] text-slate-700">schedule</span>
                        <p className="text-slate-600 text-[10px] font-headline font-black uppercase tracking-widest">
                          {new Date(tx.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="text-right space-y-4">
                  <p className={cn(
                    "font-headline font-black text-3xl tracking-tighter transition-all duration-700",
                    tx.type === 'withdraw' ? "text-red-400" : "text-white group-hover:text-emerald-400 group-hover:scale-110"
                  )}>
                    {tx.type === 'withdraw' ? '-' : '+'}${tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                  <div className={cn(
                    "inline-flex items-center px-4 py-1.5 rounded-xl text-[9px] font-headline font-black uppercase tracking-[0.3em] border transition-all duration-500",
                    tx.status === 'completed' ? "bg-emerald-400/10 border-emerald-400/20 text-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.1)]" :
                    tx.status === 'pending' ? "bg-blue-400/10 border-blue-400/20 text-blue-400 shadow-[0_0_15px_rgba(96,165,250,0.1)]" :
                    "bg-red-500/10 border-red-500/20 text-red-500 shadow-[0_0_15px_rgba(239,68,68,0.1)]"
                  )}>
                    {tx.status}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-card rounded-[64px] p-32 text-center space-y-10 border-dashed border-white/10 shadow-2xl relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-white/[0.01]"></div>
            <div className="w-32 h-32 bg-white/5 rounded-[48px] flex items-center justify-center mx-auto text-slate-900 border border-white/5 shadow-inner group relative z-10">
              <span className="material-symbols-outlined text-6xl group-hover:rotate-12 transition-transform duration-700">history</span>
            </div>
            <div className="space-y-6 relative z-10">
              <p className="text-white text-3xl font-headline font-black uppercase tracking-[0.4em]">No Transaction Data</p>
              <p className="text-slate-700 text-[11px] font-headline font-black uppercase tracking-[0.5em] max-w-sm mx-auto leading-relaxed">Initialize protocol operations to populate the AtmosPro ledger matrix.</p>
            </div>
          </motion.div>
        )}
      </section>
    </motion.div>
  );
};
