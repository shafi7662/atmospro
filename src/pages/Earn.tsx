import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

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
      className="space-y-8 pb-10"
    >
      <header className="space-y-4 px-2">
        <div className="space-y-1">
          <p className="text-on-surface-variant text-[10px] font-black uppercase tracking-[0.3em]">Total Earnings</p>
          <h1 className="text-4xl font-black text-on-surface tracking-tighter rainbow-text">
            ${totalEarnings.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </h1>
        </div>
        <div className="flex gap-2">
          <div className="px-4 py-1.5 rounded-full bg-[var(--blue)]/10 border border-[var(--blue)]/20 text-[var(--blue)] text-[9px] font-black uppercase tracking-widest rainbow-glow">
            History
          </div>
          <div className="px-4 py-1.5 rounded-full bg-surface-container border border-line/10 text-on-surface-variant text-[9px] font-black uppercase tracking-widest rainbow-glow">
            Rewards
          </div>
        </div>
      </header>

      <section className="space-y-4">
        <div className="flex items-center justify-between px-2">
          <h2 className="text-on-surface font-black text-lg tracking-tight">Recent Activity</h2>
          <span className="text-on-surface-variant text-[10px] font-black uppercase tracking-widest">{transactions.length} Records</span>
        </div>

        {transactions.length > 0 ? (
          <div className="space-y-3">
            {transactions.map((tx) => (
              <div key={tx.id} className="glass-card rounded-3xl p-5 flex items-center justify-between hover:translate-y-[-2px] transition-all">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-2xl bg-surface-container flex items-center justify-center ${getColor(tx.type)}`}>
                    <span className="material-symbols-outlined text-2xl">{getIcon(tx.type)}</span>
                  </div>
                  <div>
                    <h3 className="text-on-surface font-black text-sm capitalize">{tx.type}</h3>
                    <p className="text-on-surface-variant text-[10px] font-medium">
                      {new Date(tx.created_at).toLocaleDateString()} • {new Date(tx.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`font-black text-base ${tx.type === 'withdraw' ? 'text-red-500' : 'text-on-surface'}`}>
                    {tx.type === 'withdraw' ? '-' : '+'}${tx.amount.toLocaleString()}
                  </p>
                  <p className="text-[9px] font-black uppercase tracking-widest text-[var(--blue)]/60">{tx.status}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="glass-card rounded-[40px] p-12 text-center space-y-4 border-dashed border-line/30">
            <div className="w-16 h-16 bg-surface-container rounded-full flex items-center justify-center mx-auto text-on-surface-variant/30">
              <span className="material-symbols-outlined text-3xl">history</span>
            </div>
            <p className="text-on-surface-variant text-sm font-medium">No transactions found yet.</p>
          </div>
        )}
      </section>
    </motion.div>
  );
};
