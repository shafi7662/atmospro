import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

interface DepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const NETWORKS = {
  BEP20: {
    name: 'USDT BEP20',
    address: '0xac8e842c77a55a26a80e0b3ec1b5357129fab9cc',
    badge: 'Binance Smart Chain'
  },
  TRC20: {
    name: 'USDT TRC20',
    address: 'TCWm2pubjNnu3dARagaZxRj6aUR6vrpyTC',
    badge: 'Tron Network'
  }
};

export const DepositModal: React.FC<DepositModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { user } = useAuth();
  const [network, setNetwork] = useState<'BEP20' | 'TRC20'>('BEP20');
  const [amount, setAmount] = useState('');
  const [txid, setTxid] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Address copied to clipboard');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount < 50) {
      toast.error('Minimum deposit is 50 USDT');
      return;
    }

    if (!txid.trim()) {
      toast.error('Please enter the transaction hash (TXID)');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from('deposits').insert({
        user_id: user.id,
        amount: numAmount,
        network,
        txid,
        status: 'pending'
      });

      if (error) throw error;

      toast.success('Deposit submitted for approval');
      onSuccess();
      onClose();
      setAmount('');
      setTxid('');
    } catch (error: any) {
      toast.error(error.message || 'Failed to submit deposit');
    } finally {
      setLoading(false);
    }
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
              <h2 className="text-xl font-black text-on-surface tracking-tighter">Manual Deposit</h2>
              <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface transition-colors">
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex gap-2">
                {(['BEP20', 'TRC20'] as const).map((net) => (
                  <button
                    key={net}
                    onClick={() => setNetwork(net)}
                    className={`flex-1 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${
                      network === net
                        ? 'bg-[var(--blue)] text-white shadow-[0_0_10px_rgba(0,82,255,0.2)]'
                        : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
                    }`}
                  >
                    {net}
                  </button>
                ))}
              </div>

              <div className="p-3 rounded-xl bg-surface-container border border-outline/10 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[9px] uppercase tracking-widest text-on-surface-variant font-black">
                    {NETWORKS[network].badge}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-[var(--blue)]/10 text-[var(--blue)] text-[9px] font-black uppercase tracking-widest">
                    USDT
                  </span>
                </div>
                <div className="break-all font-mono text-xs text-on-surface bg-surface p-2.5 rounded-lg border border-outline/5">
                  {NETWORKS[network].address}
                </div>
                <button
                  onClick={() => handleCopy(NETWORKS[network].address)}
                  className="w-full py-1.5 rounded-lg bg-surface-container-high text-[var(--blue)] font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-surface-container-highest transition-colors"
                >
                  <span className="material-symbols-outlined text-sm">content_copy</span>
                  Copy Address
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[9px] uppercase tracking-widest text-on-surface-variant font-black px-1">
                    Deposit Amount (USDT)
                  </label>
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
                  <label className="text-[9px] uppercase tracking-widest text-on-surface-variant font-black px-1">
                    Transaction Hash (TXID)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Enter TXID"
                    className="w-full px-3 py-2.5 rounded-xl bg-surface-container border border-outline/20 text-on-surface focus:outline-none focus:border-[var(--blue)] transition-colors font-black text-sm"
                    value={txid}
                    onChange={(e) => setTxid(e.target.value)}
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary w-full py-3 rounded-full text-[11px] rainbow-glow"
                >
                  {loading ? 'Submitting...' : 'Submit Deposit'}
                </button>
              </form>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
