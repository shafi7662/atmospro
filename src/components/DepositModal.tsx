import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { SystemSettings } from '../types';
import { ethers } from 'ethers';

interface DepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const NETWORKS = {
  BEP20: {
    name: 'USDT BEP20',
    address: '0xac8e842c77a55a26a80e0b3ec1b5357129fab9cc',
    badge: 'Binance Smart Chain',
    chainId: '0x38', // 56
    rpcUrl: 'https://bsc-dataseed.binance.org/',
    usdtContract: '0x55d398326f99059fF775485246999027B3197955'
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
  const [paymentMethod, setPaymentMethod] = useState<'manual' | 'wallet'>('manual');
  const [amount, setAmount] = useState('');
  const [txid, setTxid] = useState('');
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      supabase.from('settings').select('*').maybeSingle()
        .then(({ data }) => setSettings(data));
    }
  }, [isOpen]);

  const minDeposit = settings?.min_deposit || 50;

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Address copied to clipboard');
  };

  const connectWallet = async () => {
    if (!window.ethereum) {
      toast.error('Please install MetaMask or a Web3 wallet');
      return;
    }

    try {
      setLoading(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await provider.send("eth_requestAccounts", []);
      setWalletAddress(accounts[0]);
      
      // Switch to BSC if BEP20 is selected
      if (network === 'BEP20') {
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: NETWORKS.BEP20.chainId }],
          });
        } catch (switchError: any) {
          if (switchError.code === 4902) {
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: NETWORKS.BEP20.chainId,
                chainName: 'Binance Smart Chain',
                nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
                rpcUrls: [NETWORKS.BEP20.rpcUrl],
                blockExplorerUrls: ['https://bscscan.com/']
              }],
            });
          }
        }
      }
      toast.success('Wallet connected successfully');
    } catch (error: any) {
      toast.error(error.message || 'Failed to connect wallet');
    } finally {
      setLoading(false);
    }
  };

  const handleWalletPayment = async () => {
    if (!walletAddress || !window.ethereum) return;
    
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount < minDeposit) {
      toast.error(`Minimum deposit is ${minDeposit} USDT`);
      return;
    }

    setLoading(true);
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      
      const usdtAbi = ["function transfer(address to, uint256 amount) public returns (bool)"];
      const usdtContract = new ethers.Contract(NETWORKS.BEP20.usdtContract, usdtAbi, signer);
      
      // USDT has 18 decimals on BSC (usually, but check contract)
      // Standard USDT on BSC is 18 decimals
      const amountInWei = ethers.parseUnits(amount, 18);
      
      const tx = await usdtContract.transfer(NETWORKS.BEP20.address, amountInWei);
      toast.info('Transaction submitted. Please wait for confirmation...');
      
      const receipt = await tx.wait();
      
      // Submit to database automatically
      const { error } = await supabase.from('deposits').insert({
        user_id: user?.id,
        amount: numAmount,
        network: 'BEP20',
        txid: receipt.hash,
        status: 'pending'
      });

      if (error) throw error;

      toast.success('Payment successful and submitted for approval');
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Payment failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount < minDeposit) {
      toast.error(`Minimum deposit is ${minDeposit} USDT`);
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
              <h2 className="text-xl font-black text-on-surface tracking-tighter">Deposit Funds</h2>
              <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface transition-colors">
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>

            <div className="flex gap-2 p-1 bg-surface-container rounded-2xl border border-outline/5">
              <button
                onClick={() => setPaymentMethod('manual')}
                className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  paymentMethod === 'manual' ? 'bg-surface text-on-surface shadow-sm' : 'text-on-surface-variant'
                }`}
              >
                Manual Transfer
              </button>
              <button
                onClick={() => setPaymentMethod('wallet')}
                className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  paymentMethod === 'wallet' ? 'bg-surface text-on-surface shadow-sm' : 'text-on-surface-variant'
                }`}
              >
                Wallet Connect
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex gap-2">
                {(['BEP20', 'TRC20'] as const).map((net) => (
                  <button
                    key={net}
                    disabled={paymentMethod === 'wallet' && net === 'TRC20'}
                    onClick={() => setNetwork(net)}
                    className={`flex-1 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${
                      network === net
                        ? 'bg-[var(--blue)] text-white shadow-[0_0_10px_rgba(0,82,255,0.2)]'
                        : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
                    } disabled:opacity-30`}
                  >
                    {net}
                  </button>
                ))}
              </div>

              {paymentMethod === 'manual' ? (
                <div className="space-y-3">
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
                        placeholder={`Min ${minDeposit}.00`}
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
              ) : (
                <div className="space-y-4 py-2">
                  <div className="p-4 rounded-2xl bg-surface-container border border-outline/10 text-center space-y-3">
                    <div className="w-16 h-16 rounded-full bg-[var(--blue)]/10 flex items-center justify-center mx-auto">
                      <span className="material-symbols-outlined text-3xl text-[var(--blue)]">account_balance_wallet</span>
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-sm font-black text-white uppercase tracking-tight">Instant Wallet Pay</h3>
                      <p className="text-[10px] text-on-surface-variant font-bold">Pay directly using MetaMask or TrustWallet</p>
                    </div>
                    
                    {walletAddress ? (
                      <div className="px-3 py-2 rounded-xl bg-surface border border-outline/5">
                        <p className="text-[8px] uppercase tracking-widest text-on-surface-variant font-black mb-1">Connected Wallet</p>
                        <p className="text-[10px] font-mono text-on-surface truncate">{walletAddress}</p>
                      </div>
                    ) : (
                      <button
                        onClick={connectWallet}
                        disabled={loading}
                        className="w-full py-3 rounded-xl bg-[var(--blue)] text-white font-black text-[10px] uppercase tracking-widest shadow-lg shadow-[var(--blue)]/20"
                      >
                        {loading ? 'Connecting...' : 'Connect Wallet'}
                      </button>
                    )}
                  </div>

                  {walletAddress && (
                    <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                      <div className="space-y-1">
                        <label className="text-[9px] uppercase tracking-widest text-on-surface-variant font-black px-1">
                          Deposit Amount (USDT)
                        </label>
                        <input
                          type="number"
                          required
                          placeholder={`Min ${minDeposit}.00`}
                          className="w-full px-3 py-2.5 rounded-xl bg-surface-container border border-outline/20 text-on-surface focus:outline-none focus:border-[var(--blue)] transition-colors font-black text-sm"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                        />
                      </div>
                      <button
                        onClick={handleWalletPayment}
                        disabled={loading || !amount}
                        className="btn-primary w-full py-3 rounded-full text-[11px] rainbow-glow"
                      >
                        {loading ? 'Processing...' : `Pay ${amount || '0'} USDT Now`}
                      </button>
                    </div>
                  )}
                  
                  <div className="flex items-center gap-2 px-2">
                    <span className="material-symbols-outlined text-xs text-on-surface-variant">info</span>
                    <p className="text-[9px] text-on-surface-variant font-bold">Only BEP20 (BSC) is supported for direct wallet pay.</p>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
