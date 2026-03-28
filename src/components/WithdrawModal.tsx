import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { Profile as UserProfile } from '../types';
import * as OTPAuth from 'otpauth';

interface WithdrawModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  availableBalance: number;
}

export const WithdrawModal: React.FC<WithdrawModalProps> = ({ isOpen, onClose, onSuccess, availableBalance }) => {
  const { user } = useAuth();
  const [step, setStep] = useState<'details' | '2fa'>('details');
  const [network, setNetwork] = useState<'BEP20' | 'TRC20'>('BEP20');
  const [amount, setAmount] = useState('');
  const [address, setAddress] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  React.useEffect(() => {
    if (isOpen && user) {
      supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
        .then(({ data }) => setProfile(data));
    }
  }, [isOpen, user]);

  const handleInitiateWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount < 50) {
      toast.error('Minimum withdrawal is 50 USDT');
      return;
    }

    if (numAmount > availableBalance) {
      toast.error('Insufficient available balance');
      return;
    }

    if (!address.trim() || address.length < 20) {
      toast.error('Please enter a valid wallet address');
      return;
    }

    if (profile?.two_fa_enabled) {
      setStep('2fa');
    } else {
      // Direct submit if 2FA is not enabled
      await performWithdraw(numAmount);
    }
  };

  const performWithdraw = async (numAmount: number) => {
    setLoading(true);
    try {
      // 1. Call RPC to deduct balance (request_withdraw)
      const { error: rpcError } = await supabase.rpc('request_withdraw', {
        p_user_id: user?.id,
        p_amount: numAmount
      });

      if (rpcError) throw rpcError;

      // 2. Insert into withdrawals table
      const { error: insertError } = await supabase.from('withdrawals').insert({
        user_id: user?.id,
        amount: numAmount,
        network,
        wallet_address: address,
        status: 'pending'
      });

      if (insertError) throw insertError;

      toast.success('Withdraw request submitted for approval');
      onSuccess();
      onClose();
      resetForm();
    } catch (error: any) {
      toast.error(error.message || 'Failed to submit withdrawal');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;

    if (profile.two_fa_enabled) {
      try {
        const totp = new OTPAuth.TOTP({
          issuer: 'AtmosPro',
          label: user.email,
          algorithm: 'SHA1',
          digits: 6,
          period: 30,
          secret: profile.two_fa_secret || '',
        });

        const delta = totp.validate({
          token: otp,
          window: 1,
        });

        if (delta === null) {
          toast.error('Invalid verification code');
          return;
        }
      } catch (error) {
        toast.error('Error verifying 2FA code');
        return;
      }
    }

    const numAmount = parseFloat(amount);
    await performWithdraw(numAmount);
  };

  const resetForm = () => {
    setStep('details');
    setAmount('');
    setAddress('');
    setOtp('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="w-full max-w-md glass-card premium-border p-5 rounded-[24px] space-y-3 relative overflow-y-auto max-h-[90vh]"
          >
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-black text-on-surface tracking-tighter">
                {step === 'details' ? 'Request Withdraw' : 'Security Verification'}
              </h2>
              <button onClick={handleClose} className="text-on-surface-variant hover:text-on-surface transition-colors">
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>

            <div className="space-y-3">
              <AnimatePresence mode="wait">
                {step === 'details' ? (
                  <motion.div
                    key="details"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="space-y-3"
                  >
                    <div className="p-3 rounded-xl bg-[var(--blue)]/5 border border-[var(--blue)]/10 flex justify-between items-center">
                      <span className="text-[9px] font-black text-on-surface-variant uppercase tracking-widest">Available Balance</span>
                      <span className="text-lg font-black text-[var(--blue)] tracking-tight">${availableBalance.toLocaleString()}</span>
                    </div>

                    <form onSubmit={handleInitiateWithdraw} className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-[9px] uppercase tracking-widest text-on-surface-variant font-black px-1">Withdraw Amount (USDT)</label>
                        <input
                          type="number"
                          required
                          placeholder="Min 50.00"
                          className="w-full px-3 py-2.5 rounded-xl bg-surface-container border border-outline/20 text-on-surface focus:outline-none focus:border-[var(--blue)] transition-colors font-black text-sm"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] uppercase tracking-widest text-on-surface-variant font-black px-1">Select Network</label>
                        <div className="flex gap-2">
                          {(['BEP20', 'TRC20'] as const).map((net) => (
                            <button
                              key={net}
                              type="button"
                              onClick={() => setNetwork(net)}
                              className={`flex-1 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${
                                network === net
                                  ? 'bg-[var(--blue)] text-white shadow-[0_0_10px_rgba(0,82,255,0.2)]'
                                  : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
                              }`}
                            >
                              {net === 'BEP20' ? 'USDT BEP20' : 'USDT TRC20'}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] uppercase tracking-widest text-on-surface-variant font-black px-1">Your Wallet Address</label>
                        <input
                          type="text"
                          required
                          placeholder="Enter your USDT address"
                          className="w-full px-3 py-2.5 rounded-xl bg-surface-container border border-outline/20 text-on-surface focus:outline-none focus:border-[var(--blue)] transition-colors font-black text-sm"
                          value={address}
                          onChange={(e) => setAddress(e.target.value)}
                        />
                      </div>

                      <button
                        type="submit"
                        className="btn-primary w-full py-3 rounded-full text-[11px] rainbow-glow"
                      >
                        Continue to 2FA
                      </button>
                    </form>
                  </motion.div>
                ) : (
                  <motion.div
                    key="2fa"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-4"
                  >
                    <div className="text-center space-y-1">
                      <div className="w-12 h-12 bg-[var(--blue)]/10 rounded-full flex items-center justify-center mx-auto mb-2">
                        <span className="material-symbols-outlined text-2xl text-[var(--blue)]">shield_lock</span>
                      </div>
                      <h3 className="text-base font-black text-on-surface tracking-tight">Confirm Withdrawal</h3>
                      <p className="text-[10px] text-on-surface-variant font-black uppercase tracking-widest">
                        Enter the 6-digit verification code to authorize transaction of <span className="text-on-surface font-black">${amount}</span>.
                      </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div className="flex justify-center">
                        <input
                          type="text"
                          maxLength={6}
                          required
                          autoFocus
                          className="w-40 text-center px-4 py-3 rounded-xl bg-surface-container border border-outline/10 text-on-surface focus:outline-none focus:border-[var(--blue)] transition-all font-black text-xl tracking-[0.4em]"
                          placeholder="000000"
                          value={otp}
                          onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                        />
                      </div>

                      <div className="space-y-2">
                        <button
                          type="submit"
                          disabled={loading || otp.length !== 6}
                          className="btn-primary w-full py-3 rounded-full text-[11px] rainbow-glow"
                        >
                          {loading ? 'Verifying...' : 'Verify & Submit Withdraw'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setStep('details')}
                          className="w-full py-1.5 text-[9px] font-black uppercase tracking-widest text-on-surface-variant hover:text-on-surface transition-colors"
                        >
                          Back to Details
                        </button>
                      </div>
                    </form>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
