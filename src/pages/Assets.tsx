import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { UserDashboard, Transaction, Deposit, Withdrawal } from '../types';
import { toast } from 'sonner';
import { motion } from 'motion/react';
import { DepositModal } from '../components/DepositModal';
import { WithdrawModal } from '../components/WithdrawModal';

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
    <div className="space-y-8 pb-10">
      <section className="space-y-6 px-2 cv-auto" style={{ containIntrinsicSize: '0 300px' }}>
        <div className="space-y-1">
          <p className="text-on-surface-variant text-[10px] font-black uppercase tracking-[0.3em]">Total Assets Value</p>
          <div className="flex items-baseline gap-3">
            <h1 className={`text-5xl font-black text-on-surface tracking-tighter ${!isMobile ? 'rainbow-text' : ''}`}>
              ${Number(dashboard?.total_balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h1>
            <span className="text-[var(--blue)] text-[9px] font-black bg-[var(--blue)]/10 px-3 py-1 rounded-full uppercase tracking-widest border border-[var(--blue)]/20">Active</span>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className={`premium-card p-6 rounded-[32px] flex flex-col gap-2 relative overflow-hidden group ${!isMobile ? 'rainbow-glow' : ''}`}>
            <div className="absolute -right-4 -top-4 w-16 h-16 bg-[var(--blue)]/5 blur-2xl rounded-full group-hover:bg-[var(--blue)]/10 transition-all"></div>
            <span className="text-on-surface-variant text-[10px] font-black uppercase tracking-widest">Available</span>
            <span className="text-on-surface font-black text-xl tracking-tight">
              ${Number(dashboard?.available_balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className={`premium-card p-6 rounded-[32px] flex flex-col gap-2 relative overflow-hidden group ${!isMobile ? 'rainbow-glow' : ''}`}>
            <div className="absolute -right-4 -top-4 w-16 h-16 bg-[var(--gold)]/5 blur-2xl rounded-full group-hover:bg-[var(--gold)]/10 transition-all"></div>
            <span className="text-on-surface-variant text-[10px] font-black uppercase tracking-widest">Earnings</span>
            <span className="text-[var(--gold)] font-black text-xl tracking-tight">
              ${Number(dashboard?.total_earnings || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className={`premium-card p-6 rounded-[32px] flex flex-col gap-2 relative overflow-hidden group ${!isMobile ? 'rainbow-glow' : ''}`}>
            <div className="absolute -right-4 -top-4 w-16 h-16 bg-[var(--blue)]/5 blur-2xl rounded-full group-hover:bg-[var(--blue)]/10 transition-all"></div>
            <span className="text-on-surface-variant text-[10px] font-black uppercase tracking-widest">Deposit Balance</span>
            <span className="text-on-surface font-black text-xl tracking-tight">
              ${Number(dashboard?.deposit_balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className={`premium-card p-6 rounded-[32px] flex flex-col gap-2 relative overflow-hidden group ${!isMobile ? 'rainbow-glow' : ''}`}>
            <div className="absolute -right-4 -top-4 w-16 h-16 bg-[var(--gold)]/5 blur-2xl rounded-full group-hover:bg-[var(--gold)]/10 transition-all"></div>
            <span className="text-on-surface-variant text-[10px] font-black uppercase tracking-widest">Withdrawable</span>
            <span className="text-on-surface font-black text-xl tracking-tight">
              ${Number(dashboard?.withdrawable_balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </section>

      <section className="px-2 cv-auto" style={{ containIntrinsicSize: '0 100px' }}>
        <div className="grid grid-cols-2 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
          <button
            onClick={() => setIsDepositModalOpen(true)}
            className={`btn-primary py-4 rounded-2xl flex items-center justify-center gap-2 text-[11px] ${!isMobile ? 'rainbow-glow' : ''}`}
          >
            <span className="material-symbols-outlined text-lg">add_circle</span>
            Deposit
          </button>
          <button
            onClick={() => setIsWithdrawModalOpen(true)}
            className={`btn-secondary py-4 rounded-2xl flex items-center justify-center gap-2 text-[11px] ${!isMobile ? 'rainbow-glow' : ''}`}
          >
            <span className="material-symbols-outlined text-lg">arrow_outward</span>
            Withdraw
          </button>
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {withdrawals.length > 0 && (
          <section className="space-y-4 px-2 cv-auto" style={{ containIntrinsicSize: '0 300px' }}>
            <div className="flex items-center justify-between">
              <h2 className="font-black text-lg text-on-surface tracking-tight">Withdrawals</h2>
              <span className="text-on-surface-variant text-[10px] font-black uppercase tracking-widest">Recent</span>
            </div>
            <div className="space-y-3">
              {withdrawals.map((w) => (
                <div key={w.id} className={`premium-card p-5 rounded-[28px] flex items-center justify-between transition-all ${!isMobile ? 'rainbow-glow' : ''}`}>
                  <div className="flex items-center gap-4">
                    <div className="w-11 h-11 rounded-2xl bg-surface-container flex items-center justify-center text-on-surface-variant/40">
                      <span className="material-symbols-outlined text-xl">outbox</span>
                    </div>
                    <div>
                      <p className="font-black text-sm text-on-surface">{w.network} Withdraw</p>
                      <p className="text-[10px] text-on-surface-variant font-black truncate max-w-[120px] uppercase tracking-widest">{w.wallet_address}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-base text-on-surface">-${w.amount.toLocaleString()}</p>
                    <span className={`text-[9px] font-black uppercase tracking-widest ${
                      w.status === 'pending' ? 'text-on-surface-variant/40' :
                      w.status === 'approved' ? 'text-[var(--blue)]' :
                      'text-red-500'
                    }`}>
                      {w.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {deposits.length > 0 && (
          <section className="space-y-4 px-2 cv-auto" style={{ containIntrinsicSize: '0 300px' }}>
            <div className="flex items-center justify-between">
              <h2 className="font-black text-lg text-on-surface tracking-tight">Deposits</h2>
              <span className="text-on-surface-variant text-[10px] font-black uppercase tracking-widest">Recent</span>
            </div>
            <div className="space-y-3">
              {deposits.map((dep) => (
                <div key={dep.id} className={`glass-card p-5 rounded-[28px] flex items-center justify-between hover:translate-y-[-2px] transition-all ${!isMobile ? 'rainbow-glow' : ''}`}>
                  <div className="flex items-center gap-4">
                    <div className="w-11 h-11 rounded-2xl bg-[var(--blue)]/10 flex items-center justify-center text-[var(--blue)]">
                      <span className="material-symbols-outlined text-xl">account_balance_wallet</span>
                    </div>
                    <div>
                      <p className="font-black text-sm text-on-surface">{dep.network} Deposit</p>
                      <p className="text-[10px] text-on-surface-variant font-black truncate max-w-[120px] uppercase tracking-widest">{dep.txid}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-base text-[var(--blue)]">+${dep.amount.toLocaleString()}</p>
                    <span className={`text-[9px] font-black uppercase tracking-widest ${
                      dep.status === 'pending' ? 'text-on-surface-variant/40' :
                      dep.status === 'approved' ? 'text-[var(--blue)]' :
                      'text-red-500'
                    }`}>
                      {dep.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
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
    </div>
  );
};
