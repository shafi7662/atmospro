import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useSearchParams } from 'react-router-dom';
import { Deposit, Withdrawal, Profile, SocialTask, UserSocialTask, SupportTicket } from '../types';
import { cn } from '../lib/utils';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { ethers } from 'ethers';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, AreaChart, Area 
} from 'recharts';

const ADMIN_WALLET = '0xac8e842c77a55a26a80e0b3ec1b5357129fab9cc';

type AdminTab = 'overview' | 'users' | 'kyc' | 'products' | 'deposits' | 'withdrawals' | 'stakes' | 'transactions' | 'settings' | 'social_tasks' | 'support';

export const Admin = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = (searchParams.get('tab') as AdminTab) || 'overview';
  
  const setActiveTab = (tab: AdminTab) => {
    setSearchParams({ tab });
  };

  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [stakes, setStakes] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [socialTasks, setSocialTasks] = useState<SocialTask[]>([]);
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // User Editing
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [viewingUser, setViewingUser] = useState<Profile | null>(null);
  const [userDetails, setUserDetails] = useState<any>(null);
  
  // Product Editing
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [productFilter, setProductFilter] = useState<'all' | 'stake' | 'task'>('all');
  const [productForm, setProductForm] = useState({
    name: '',
    description: '',
    price: '' as string | number,
    apy: '' as string | number,
    duration_days: '' as string | number,
    image_url: '',
    type: 'stake' as 'stake' | 'task',
    min_vip_level: 1
  });

  const [settingsForm, setSettingsForm] = useState({
    announcement_text: '',
    maintenance_mode: false,
    min_deposit: 10,
    min_withdrawal: 10,
    withdrawal_fee: 0,
    referral_bonus_percent: 10
  });

  const [newAvailableBalance, setNewAvailableBalance] = useState<number>(0);
  const [newTotalBalance, setNewTotalBalance] = useState<number>(0);
  const [newDepositBalance, setNewDepositBalance] = useState<number>(0);
  const [newWithdrawableBalance, setNewWithdrawableBalance] = useState<number>(0);
  const [newVipLevel, setNewVipLevel] = useState<number>(1);
  const [newReferredBy, setNewReferredBy] = useState<string>('');
  const [newRole, setNewRole] = useState<'admin' | 'user'>('user');
  
  // Social Task Editing
  const [isAddingSocialTask, setIsAddingSocialTask] = useState(false);
  const [editingSocialTask, setEditingSocialTask] = useState<SocialTask | null>(null);
  const [socialTaskForm, setSocialTaskForm] = useState({
    platform: 'telegram' as 'telegram' | 'twitter' | 'youtube' | 'facebook' | 'instagram' | 'other',
    title: '',
    description: '',
    link: '',
    reward_amount: 0,
    is_active: true
  });

  const [uploadingProductImage, setUploadingProductImage] = useState(false);
  const productImageInputRef = React.useRef<HTMLInputElement>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const verifyOnChain = async (deposit: Deposit) => {
    if (deposit.network !== 'BEP20') {
      toast.error('On-chain verification only supported for BEP20 (BSC)');
      return;
    }

    setVerifyingId(deposit.id);
    try {
      const provider = new ethers.JsonRpcProvider('https://bsc-dataseed.binance.org/');
      const tx = await provider.getTransaction(deposit.txid);
      
      if (!tx) {
        toast.error('Transaction not found on-chain');
        return;
      }

      const receipt = await provider.getTransactionReceipt(deposit.txid);
      if (!receipt || receipt.status !== 1) {
        toast.error('Transaction failed or still pending');
        return;
      }

      // Check if it's a USDT transfer to Admin Wallet
      // USDT transfer signature: 0xa9059cbb
      if (!tx.data.startsWith('0xa9059cbb')) {
        toast.error('This is not a token transfer transaction');
        return;
      }

      // Decode data (address to, uint256 amount)
      const iface = new ethers.Interface(["function transfer(address to, uint256 amount)"]);
      const decoded = iface.decodeFunctionData("transfer", tx.data);
      
      const recipient = decoded[0].toLowerCase();
      const amount = ethers.formatUnits(decoded[1], 18); // USDT on BSC is 18 decimals

      if (recipient !== ADMIN_WALLET.toLowerCase()) {
        toast.error(`Recipient mismatch! Sent to: ${recipient}`);
        return;
      }

      if (parseFloat(amount) < deposit.amount) {
        toast.error(`Amount mismatch! Sent: ${amount}, Expected: ${deposit.amount}`);
        return;
      }

      toast.success(`Verified! Sent ${amount} USDT to your wallet.`);
      
      // Automatically approve if verified
      if (window.confirm('Transaction verified on-chain. Approve this deposit now?')) {
        handleDepositAction(deposit, 'approved');
      }
    } catch (error: any) {
      console.error(error);
      toast.error('Verification failed: ' + (error.message || 'Unknown error'));
    } finally {
      setVerifyingId(null);
    }
  };

  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [depositsRes, withdrawalsRes, profilesRes, productsRes, stakesRes, transactionsRes, settingsRes, socialTasksRes, supportRes] = await Promise.all([
        supabase.from('deposits').select('*').order('created_at', { ascending: false }),
        supabase.from('withdrawals').select('*').order('created_at', { ascending: false }),
        supabase.from('profiles').select('*').order('created_at', { ascending: false }),
        supabase.from('products').select('*').order('price', { ascending: true }),
        supabase.from('reserves').select('*, profiles(email), products(name)').order('created_at', { ascending: false }),
        supabase.from('transactions').select('*, profiles(email)').order('created_at', { ascending: false }),
        supabase.from('settings').select('*').maybeSingle(),
        supabase.from('social_tasks').select('*').order('created_at', { ascending: false }),
        supabase.from('support_tickets').select('*, profiles(email)').order('created_at', { ascending: false })
      ]);

      if (depositsRes.error) console.error('Deposits fetch error:', depositsRes.error);
      if (withdrawalsRes.error) console.error('Withdrawals fetch error:', withdrawalsRes.error);
      if (profilesRes.error) console.error('Profiles fetch error:', profilesRes.error);
      if (stakesRes.error) console.error('Stakes fetch error:', stakesRes.error);
      if (transactionsRes.error) console.error('Transactions fetch error:', transactionsRes.error);
      if (settingsRes.error) console.error('Settings fetch error:', settingsRes.error);
      if (socialTasksRes.error) console.error('Social tasks fetch error:', socialTasksRes.error);
      
      if (supportRes.error) {
        console.error('Support tickets fetch error:', supportRes.error);
        // If join fails, try fetching without join
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('support_tickets')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (!fallbackError) {
          setSupportTickets(fallbackData || []);
        } else {
          toast.error('Failed to fetch support tickets');
        }
      } else {
        setSupportTickets(supportRes.data || []);
      }

      setDeposits(depositsRes.data || []);
      setWithdrawals(withdrawalsRes.data || []);
      setProfiles(profilesRes.data || []);
      setProducts(productsRes.data || []);
      setStakes(stakesRes.data || []);
      setTransactions(transactionsRes.data || []);
      setSocialTasks(socialTasksRes.data || []);
      
      if (settingsRes.data) {
        setSettings(settingsRes.data);
        setSettingsForm({
          announcement_text: settingsRes.data.announcement_text || '',
          maintenance_mode: !!settingsRes.data.maintenance_mode,
          min_deposit: settingsRes.data.min_deposit || 10,
          min_withdrawal: settingsRes.data.min_withdrawal || 10,
          withdrawal_fee: settingsRes.data.withdrawal_fee || 0,
          referral_bonus_percent: settingsRes.data.referral_bonus_percent || 10
        });
      }
    } catch (error: any) {
      console.error('Admin fetch error:', error);
      toast.error('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (activeTab === 'support') {
      fetchData(true);
    }
  }, [activeTab]);

  const handleDepositAction = async (deposit: Deposit, status: 'approved' | 'rejected') => {
    setProcessingId(deposit.id);
    try {
      if (status === 'approved') {
        const { error } = await supabase.rpc('approve_deposit', {
          p_deposit_id: deposit.id
        });
        if (error) throw error;
        
        // Create notification
        await supabase.from('notifications').insert([{
          user_id: deposit.user_id,
          title: 'Deposit Approved',
          message: `Your deposit of $${deposit.amount} has been approved.`,
          type: 'success'
        }]);
      } else {
        const { error } = await supabase
          .from('deposits')
          .update({ status: 'rejected' })
          .eq('id', deposit.id);
        if (error) throw error;

        // Create notification
        await supabase.from('notifications').insert([{
          user_id: deposit.user_id,
          title: 'Deposit Rejected',
          message: `Your deposit of $${deposit.amount} has been rejected. Please contact support.`,
          type: 'error'
        }]);
      }

      toast.success(`Deposit ${status}`);
      fetchData();
    } catch (error: any) {
      toast.error(error.message || `Failed to ${status} deposit`);
    } finally {
      setProcessingId(null);
    }
  };

  const handleWithdrawAction = async (withdrawal: Withdrawal, status: 'approved' | 'rejected') => {
    setProcessingId(withdrawal.id);
    try {
      if (status === 'approved') {
        const { error } = await supabase
          .from('withdrawals')
          .update({ status: 'approved' })
          .eq('id', withdrawal.id);
        if (error) throw error;

        // Create notification
        await supabase.from('notifications').insert([{
          user_id: withdrawal.user_id,
          title: 'Withdrawal Approved',
          message: `Your withdrawal of $${withdrawal.amount} has been approved and processed.`,
          type: 'success'
        }]);
      } else {
        const { error } = await supabase.rpc('reject_withdraw', {
          p_withdraw_id: withdrawal.id
        });
        if (error) throw error;

        // Create notification
        await supabase.from('notifications').insert([{
          user_id: withdrawal.user_id,
          title: 'Withdrawal Rejected',
          message: `Your withdrawal of $${withdrawal.amount} has been rejected. Funds returned to balance.`,
          type: 'error'
        }]);
      }

      toast.success(`Withdrawal ${status}`);
      fetchData();
    } catch (error: any) {
      toast.error(error.message || `Failed to ${status} withdrawal`);
    } finally {
      setProcessingId(null);
    }
  };

  const handleUpdateBalance = async () => {
    if (!editingUser) return;
    setProcessingId(editingUser.id);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ 
          available_balance: newAvailableBalance,
          total_balance: newTotalBalance,
          deposit_balance: newDepositBalance,
          withdrawable_balance: newWithdrawableBalance,
          vip_level: newVipLevel,
          referred_by: newReferredBy || null,
          role: newRole
        })
        .eq('id', editingUser.id);
      
      if (error) throw error;
      
      toast.success('User updated successfully');
      setEditingUser(null);
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update user');
    } finally {
      setProcessingId(null);
    }
  };

  const handleViewUser = async (profile: Profile) => {
    setViewingUser(profile);
    setUserDetails(null);
    try {
      const [dashRes, teamRes, reservesRes] = await Promise.all([
        supabase.rpc('get_user_dashboard', { p_user_id: profile.id }),
        supabase.rpc('get_team_data', { p_user_id: profile.id }),
        supabase.from('reserves').select('*, products(*)').eq('user_id', profile.id).eq('status', 'active')
      ]);
      setUserDetails({
        dashboard: dashRes.data,
        team: teamRes.data?.[0],
        reserves: reservesRes.data || []
      });
    } catch (error) {
      console.error('Error fetching user details:', error);
    }
  };

  const handleProductAction = async (action: 'add' | 'edit' | 'delete', product?: any) => {
    setProcessingId(product?.id || 'new');
    try {
      if (action === 'delete') {
        const { error } = await supabase.from('products').delete().eq('id', product.id);
        if (error) throw error;
        toast.success('Product deleted');
      } else if (action === 'add') {
        const { error } = await supabase.from('products').insert([{
          ...productForm,
          price: Number(productForm.price),
          apy: Number(productForm.apy),
          duration_days: Number(productForm.duration_days),
          min_vip_level: Number(productForm.min_vip_level)
        }]);
        if (error) throw error;
        toast.success('Product added');
        setIsAddingProduct(false);
      } else if (action === 'edit') {
        const { error } = await supabase.from('products').update({
          ...productForm,
          price: Number(productForm.price),
          apy: Number(productForm.apy),
          duration_days: Number(productForm.duration_days),
          min_vip_level: Number(productForm.min_vip_level)
        }).eq('id', editingProduct.id);
        if (error) throw error;
        toast.success('Product updated');
        setEditingProduct(null);
      }
      fetchData();
    } catch (error: any) {
      toast.error(error.message || `Failed to ${action} product`);
    } finally {
      setProcessingId(null);
    }
  };

  const uploadProductImage = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploadingProductImage(true);
      if (!event.target.files || event.target.files.length === 0) {
        throw new Error('You must select an image to upload.');
      }

      const file = event.target.files[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `product-${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`;

      // Try to upload to 'products' bucket, fallback to 'avatars' if needed
      let bucket = 'products';
      let { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filePath, file);

      if (uploadError && uploadError.message.toLowerCase().includes('bucket not found')) {
        bucket = 'avatars';
        const { error: fallbackError } = await supabase.storage
          .from(bucket)
          .upload(filePath, file);
        uploadError = fallbackError;
      }

      if (uploadError) {
        if (uploadError.message.toLowerCase().includes('bucket not found')) {
          throw new Error('Storage bucket not found. Please create a bucket named "products" or "avatars" in your Supabase dashboard.');
        }
        throw uploadError;
      }

      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(filePath);

      setProductForm(prev => ({ ...prev, image_url: publicUrl }));
      toast.success('Product image uploaded!');
    } catch (error: any) {
      toast.error(error.message || 'Error uploading image');
    } finally {
      setUploadingProductImage(false);
    }
  };

  const [rejectionReason, setRejectionReason] = useState('');
  const [isRejectingKYC, setIsRejectingKYC] = useState<string | null>(null);

  const handleKYCAction = async (profileId: string, status: 'verified' | 'rejected', reason?: string) => {
    setProcessingId(profileId);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ 
          kyc_status: status,
          kyc_rejection_reason: reason || null
        })
        .eq('id', profileId);
      
      if (error) throw error;

      // Create notification
      await supabase.from('notifications').insert([{
        user_id: profileId,
        title: status === 'verified' ? 'KYC Verified' : 'KYC Rejected',
        message: status === 'verified' 
          ? 'Your identity has been successfully verified.' 
          : `Your KYC application was rejected. Reason: ${reason || 'Invalid documents'}`,
        type: status === 'verified' ? 'success' : 'error'
      }]);
      
      toast.success(`KYC ${status}`);
      setIsRejectingKYC(null);
      setRejectionReason('');
      fetchData();
    } catch (error: any) {
      toast.error(error.message || `Failed to ${status} KYC`);
    } finally {
      setProcessingId(null);
    }
  };

  const handleUpdateSettings = async () => {
    setProcessingId('settings');
    try {
      const { error } = await supabase
        .from('settings')
        .upsert({ 
          id: settings?.id || 'global',
          ...settingsForm,
          updated_at: new Date().toISOString()
        });
      
      if (error) throw error;
      toast.success('Settings updated successfully');
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update settings');
    } finally {
      setProcessingId(null);
    }
  };

  const handleSocialTaskAction = async (action: 'add' | 'edit' | 'delete', task?: SocialTask) => {
    setProcessingId(task?.id || 'new');
    try {
      if (action === 'delete') {
        const { error } = await supabase.from('social_tasks').delete().eq('id', task!.id);
        if (error) throw error;
        toast.success('Task deleted');
      } else if (action === 'add') {
        const { error } = await supabase.from('social_tasks').insert([socialTaskForm]);
        if (error) throw error;
        toast.success('Task added');
        setIsAddingSocialTask(false);
      } else if (action === 'edit') {
        const { error } = await supabase.from('social_tasks').update(socialTaskForm).eq('id', task!.id);
        if (error) throw error;
        toast.success('Task updated');
        setEditingSocialTask(null);
      }
      fetchData();
    } catch (error: any) {
      toast.error(error.message || `Failed to ${action} task`);
    } finally {
      setProcessingId(null);
    }
  };

  const [replyingTicket, setReplyingTicket] = useState<SupportTicket | null>(null);
  const [ticketReply, setTicketReply] = useState('');

  const handleTicketReply = async () => {
    if (!replyingTicket) return;
    setProcessingId(replyingTicket.id);
    try {
      const { error } = await supabase
        .from('support_tickets')
        .update({ 
          admin_reply: ticketReply,
          status: 'pending',
          updated_at: new Date().toISOString()
        })
        .eq('id', replyingTicket.id);
      
      if (error) throw error;
      
      // Create a notification for the user
      await supabase.from('notifications').insert([{
        user_id: replyingTicket.user_id,
        title: 'Support Ticket Update',
        message: `Admin has replied to your ticket: "${replyingTicket.subject}"`,
        type: 'info'
      }]);

      toast.success('Reply sent successfully');
      setReplyingTicket(null);
      setTicketReply('');
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to send reply');
    } finally {
      setProcessingId(null);
    }
  };

  const handleCloseTicket = async (ticketId: string) => {
    setProcessingId(ticketId);
    try {
      const { error } = await supabase
        .from('support_tickets')
        .update({ status: 'closed' })
        .eq('id', ticketId);
      
      if (error) throw error;
      toast.success('Ticket closed');
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to close ticket');
    } finally {
      setProcessingId(null);
    }
  };

  const filteredProfiles = profiles.filter(p => 
    p.email?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    p.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const stats = {
    totalUsers: profiles.length,
    totalBalance: profiles.reduce((acc, p) => acc + (p.available_balance || 0), 0),
    pendingDeposits: deposits.filter(d => d.status === 'pending').length,
    pendingWithdrawals: withdrawals.filter(w => w.status === 'pending').length,
    totalDeposits: deposits.filter(d => d.status === 'approved').reduce((acc, d) => acc + d.amount, 0),
    totalWithdrawals: withdrawals.filter(w => w.status === 'approved').reduce((acc, w) => acc + w.amount, 0),
  };

  // Mock chart data based on real stats
  const chartData = [
    { name: 'Deposits', value: stats.totalDeposits },
    { name: 'Withdrawals', value: stats.totalWithdrawals },
    { name: 'User Balance', value: stats.totalBalance },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="w-10 h-10 border-4 border-primary-container border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header className="space-y-6 pt-12 px-8 relative">
        <div className="absolute top-1/2 left-0 -translate-y-1/2 w-96 h-96 bg-blue-500/5 blur-[150px] rounded-full -z-10 animate-pulse"></div>
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 rounded-3xl bg-blue-500/10 flex items-center justify-center text-blue-400 border border-blue-400/20 shadow-[0_0_30px_rgba(59,130,246,0.2)]">
            <span className="material-symbols-outlined text-4xl">security</span>
          </div>
          <div className="space-y-2">
            <h1 className="text-5xl font-headline font-black text-white tracking-tighter uppercase leading-none">Admin <span className="text-blue-400">Terminal</span></h1>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-blue-400/10 border border-blue-400/20">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>
                <span className="text-[9px] font-headline font-black uppercase tracking-[0.3em] text-blue-400">Secure Command Protocol</span>
              </div>
              <div className="w-1 h-1 rounded-full bg-slate-800"></div>
              <p className="text-[10px] text-slate-600 font-headline font-black uppercase tracking-[0.4em]">Full Access Administrative Node</p>
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-col gap-8">
        {/* Navigation Tabs */}
        <nav className="w-full px-8">
          <div className="flex flex-row flex-wrap lg:flex-nowrap gap-3 overflow-x-auto pb-6 no-scrollbar scroll-smooth snap-x snap-mandatory">
            {(['overview', 'users', 'kyc', 'products', 'deposits', 'withdrawals', 'stakes', 'transactions', 'settings', 'social_tasks', 'support'] as AdminTab[]).map((tab) => (
              <motion.button
                key={tab}
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "px-8 py-4 rounded-2xl font-headline font-black text-[10px] uppercase tracking-[0.2em] transition-all duration-500 whitespace-nowrap flex items-center gap-3 border flex-shrink-0 snap-start shadow-xl relative overflow-hidden group",
                  activeTab === tab 
                    ? "bg-blue-500 text-white border-blue-400 shadow-[0_0_40px_rgba(59,130,246,0.3)]" 
                    : "glass-card text-slate-500 border-white/5 hover:border-white/10 hover:text-white"
                )}
              >
                {activeTab === tab && (
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full animate-shimmer"></div>
                )}
                <span className={cn(
                  "material-symbols-outlined text-xl transition-colors",
                  activeTab === tab ? "text-white" : "text-slate-600 group-hover:text-blue-400"
                )}>
                  {tab === 'overview' ? 'dashboard' : 
                   tab === 'users' ? 'group' : 
                   tab === 'kyc' ? 'verified_user' : 
                   tab === 'products' ? 'inventory_2' : 
                   tab === 'deposits' ? 'payments' : 
                   tab === 'withdrawals' ? 'outbox' : 
                   tab === 'stakes' ? 'account_tree' : 
                   tab === 'transactions' ? 'history' : 
                   tab === 'social_tasks' ? 'task' : 
                   tab === 'support' ? 'contact_support' : 'settings'}
                </span>
                {tab === 'social_tasks' ? 'Social Tasks' : tab}
              </motion.button>
            ))}
          </div>
        </nav>

        {/* Main Content Area */}
        <div className="flex-1 min-w-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="space-y-8"
            >
              {activeTab === 'overview' && (
                <div
                  key="overview"
                  className="space-y-8 px-8 pb-12"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <motion.div 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 }}
                      className="glass-card premium-border p-8 rounded-[40px] relative overflow-hidden group"
                    >
                      <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                        <span className="material-symbols-outlined text-6xl">group</span>
                      </div>
                      <p className="text-[10px] font-headline font-black uppercase tracking-[0.3em] text-slate-500 mb-2">Total Network Nodes</p>
                      <div className="flex items-end gap-3">
                        <p className="text-5xl font-headline font-black text-white tracking-tighter">{stats.totalUsers.toString().padStart(2, '0')}</p>
                        <div className="mb-2 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                          <span className="text-[9px] font-headline font-black text-emerald-400 uppercase tracking-widest">+12%</span>
                        </div>
                      </div>
                    </motion.div>

                    <motion.div 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                      className="glass-card premium-border p-8 rounded-[40px] relative overflow-hidden group"
                    >
                      <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity text-blue-400">
                        <span className="material-symbols-outlined text-6xl">account_balance_wallet</span>
                      </div>
                      <p className="text-[10px] font-headline font-black uppercase tracking-[0.3em] text-slate-500 mb-2">Aggregate Liquidity</p>
                      <div className="flex items-end gap-3">
                        <p className="text-5xl font-headline font-black text-blue-400 tracking-tighter">${stats.totalBalance.toLocaleString()}</p>
                        <div className="mb-2 px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20">
                          <span className="text-[9px] font-headline font-black text-blue-400 uppercase tracking-widest">Live</span>
                        </div>
                      </div>
                    </motion.div>

                    <motion.div 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                      className="glass-card premium-border p-8 rounded-[40px] relative overflow-hidden group"
                    >
                      <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity text-purple-400">
                        <span className="material-symbols-outlined text-6xl">pending_actions</span>
                      </div>
                      <p className="text-[10px] font-headline font-black uppercase tracking-[0.3em] text-slate-500 mb-2">Pending Protocols</p>
                      <div className="flex items-end gap-3">
                        <p className="text-5xl font-headline font-black text-purple-400 tracking-tighter">{(stats.pendingDeposits + stats.pendingWithdrawals).toString().padStart(2, '0')}</p>
                        <div className="mb-2 px-2 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20">
                          <span className="text-[9px] font-headline font-black text-purple-400 uppercase tracking-widest">Priority</span>
                        </div>
                      </div>
                    </motion.div>
                  </div>

                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="glass-card premium-border p-10 rounded-[48px] relative overflow-hidden"
                  >
                    <div className="flex items-center justify-between mb-10">
                      <div className="space-y-1">
                        <h3 className="text-[10px] font-headline font-black uppercase tracking-[0.4em] text-slate-500">Financial Matrix Analysis</h3>
                        <p className="text-xl font-headline font-black text-white uppercase tracking-tight">System Liquidity Flow</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                          <span className="text-[9px] font-headline font-black uppercase tracking-widest text-slate-400">Inflow</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                          <span className="text-[9px] font-headline font-black uppercase tracking-widest text-slate-400">Outflow</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="h-[400px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                          <defs>
                            <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#10B981" stopOpacity={1} />
                              <stop offset="100%" stopColor="#10B981" stopOpacity={0.3} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                          <XAxis 
                            dataKey="name" 
                            stroke="#475569" 
                            fontSize={10} 
                            tickLine={false} 
                            axisLine={false}
                            dy={10}
                            fontFamily="Inter"
                            fontWeight="bold"
                          />
                          <YAxis 
                            stroke="#475569" 
                            fontSize={10} 
                            tickLine={false} 
                            axisLine={false}
                            tickFormatter={(value) => `$${value}`}
                            fontFamily="Inter"
                            fontWeight="bold"
                          />
                          <Tooltip 
                            cursor={{ fill: 'rgba(255,255,255,0.02)' }}
                            contentStyle={{ 
                              backgroundColor: '#0f172a', 
                              border: '1px solid rgba(255,255,255,0.05)', 
                              borderRadius: '20px',
                              boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
                              padding: '16px'
                            }}
                            itemStyle={{ color: '#10B981', fontFamily: 'Inter', fontWeight: 'bold', fontSize: '12px' }}
                            labelStyle={{ color: '#64748b', fontFamily: 'Inter', fontWeight: 'bold', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}
                          />
                          <Bar 
                            dataKey="value" 
                            fill="url(#barGradient)" 
                            radius={[12, 12, 0, 0]} 
                            barSize={60} 
                            animationDuration={2000}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </motion.div>
                </div>
              )}

        {activeTab === 'users' && (
          <div
            key="users"
            className="space-y-8 px-8 pb-12"
          >
            <div className="relative group">
              <div className="absolute inset-0 bg-blue-500/5 blur-xl rounded-3xl group-focus-within:bg-blue-500/10 transition-all"></div>
              <span className="material-symbols-outlined absolute left-6 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-400 transition-colors">search</span>
              <input
                type="text"
                placeholder="Query Neural Database (Email or ID)..."
                className="w-full pl-16 pr-8 py-6 rounded-[24px] bg-slate-900/50 border border-white/5 text-white font-headline font-bold text-sm focus:outline-none focus:border-blue-500/50 focus:bg-slate-900 transition-all placeholder:text-slate-600 shadow-2xl"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {filteredProfiles.map((profile, idx) => (
                <motion.div 
                  key={profile.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: idx * 0.05 }}
                  className="glass-card premium-border rounded-[40px] p-8 space-y-6 relative overflow-hidden group hover:border-blue-500/30 transition-all"
                >
                  <div className="flex justify-between items-start relative z-10">
                    <div className="flex items-center gap-5">
                      <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center text-blue-400 border border-white/5 group-hover:border-blue-500/20 transition-all">
                        <span className="material-symbols-outlined text-3xl">account_circle</span>
                      </div>
                      <div className="space-y-1">
                        <p className="text-white font-headline font-black text-lg tracking-tight uppercase">{profile.email}</p>
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] text-slate-500 font-mono font-bold uppercase tracking-widest">Node ID:</span>
                          <span className="text-[10px] text-blue-400/60 font-mono font-bold tracking-tight">{profile.id}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className={cn(
                        "px-4 py-1.5 rounded-full text-[9px] font-headline font-black uppercase tracking-[0.2em] border shadow-lg",
                        profile.role === 'admin' 
                          ? "bg-blue-500/10 text-blue-400 border-blue-500/20" 
                          : "bg-slate-800/50 text-slate-400 border-white/5"
                      )}>
                        {profile.role}
                      </span>
                      <div className="flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                        <span className="text-[9px] font-headline font-black text-emerald-500 uppercase tracking-widest">Active</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 relative z-10">
                    <div className="bg-slate-900/50 p-5 rounded-3xl border border-white/5 group-hover:border-blue-500/10 transition-all">
                      <span className="text-[9px] uppercase font-headline font-black text-slate-500 tracking-[0.2em] block mb-2">Liquid Capital</span>
                      <span className="text-2xl font-headline font-black text-white tracking-tighter">${profile.available_balance?.toLocaleString() || '0'}</span>
                    </div>
                    <div className="bg-slate-900/50 p-5 rounded-3xl border border-white/5 group-hover:border-blue-500/10 transition-all">
                      <span className="text-[9px] uppercase font-headline font-black text-slate-500 tracking-[0.2em] block mb-2">Total Assets</span>
                      <span className="text-2xl font-headline font-black text-white tracking-tighter">${profile.total_balance?.toLocaleString() || '0'}</span>
                    </div>
                  </div>

                  <div className="flex gap-4 relative z-10">
                    <motion.button 
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        setEditingUser(profile);
                        setNewAvailableBalance(profile.available_balance || 0);
                        setNewTotalBalance(profile.total_balance || 0);
                        setNewDepositBalance(profile.deposit_balance || 0);
                        setNewWithdrawableBalance(profile.withdrawable_balance || 0);
                        setNewVipLevel(profile.vip_level || 1);
                        setNewReferredBy(profile.referred_by || '');
                        setNewRole(profile.role || 'user');
                      }}
                      className="flex-1 py-4 rounded-2xl bg-blue-500 text-white text-[10px] font-headline font-black uppercase tracking-[0.2em] transition-all shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40"
                    >
                      Modify Parameters
                    </motion.button>
                    <motion.button 
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleViewUser(profile)}
                      className="w-14 h-14 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center border border-white/5 transition-all shadow-xl"
                    >
                      <span className="material-symbols-outlined text-2xl">visibility</span>
                    </motion.button>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'products' && (
          <div
            key="products"
            className="space-y-8 px-8 pb-12"
          >
            <div className="flex flex-col md:flex-row gap-4">
              <motion.button 
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  setProductForm({ name: '', description: '', price: 0, apy: 0, duration_days: 1, image_url: '', type: 'stake', min_vip_level: 1 });
                  setIsAddingProduct(true);
                }}
                className="flex-1 py-5 rounded-2xl bg-blue-500 text-white font-headline font-black text-[10px] uppercase tracking-[0.3em] shadow-xl shadow-blue-500/20 hover:shadow-blue-500/40 transition-all flex items-center justify-center gap-3"
              >
                <span className="material-symbols-outlined text-xl">add_circle</span>
                Initialize New Asset
              </motion.button>
              <div className="flex bg-slate-900/50 rounded-2xl p-1.5 border border-white/5 backdrop-blur-xl">
                {(['all', 'stake', 'task'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setProductFilter(f)}
                    className={cn(
                      "px-6 py-3 rounded-xl text-[9px] font-headline font-black uppercase tracking-[0.2em] transition-all duration-500",
                      productFilter === f 
                        ? 'bg-blue-500 text-white shadow-lg' 
                        : 'text-slate-500 hover:text-white'
                    )}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {products
                .filter(p => productFilter === 'all' || p.type === productFilter)
                .map((product, idx) => (
                <motion.div 
                  key={product.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="glass-card premium-border rounded-[40px] p-8 space-y-6 relative overflow-hidden group hover:border-blue-500/30 transition-all"
                >
                  <div className="flex justify-between items-start relative z-10">
                    <div className="flex items-center gap-5">
                      <div className="w-20 h-20 rounded-3xl bg-slate-800 flex items-center justify-center text-blue-400 border border-white/5 overflow-hidden group-hover:border-blue-500/20 transition-all shadow-2xl">
                        <img src={product.image_url || 'https://picsum.photos/seed/node/100/100'} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" referrerPolicy="no-referrer" loading="lazy" />
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-3">
                          <p className="text-white font-headline font-black text-xl tracking-tight uppercase">{product.name}</p>
                          <span className={cn(
                            "px-3 py-1 rounded-full text-[8px] font-headline font-black uppercase tracking-[0.2em] border shadow-lg",
                            product.type === 'stake' 
                              ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' 
                              : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                          )}>
                            {product.type}
                          </span>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-xs text-slate-500">schedule</span>
                            <span className="text-[10px] text-slate-400 font-headline font-black uppercase tracking-widest">{product.duration_days} Days</span>
                          </div>
                          <div className="w-1 h-1 rounded-full bg-slate-800"></div>
                          <div className="flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-xs text-emerald-500">trending_up</span>
                            <span className="text-[10px] text-emerald-400 font-headline font-black uppercase tracking-widest">{product.apy}% APY</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-headline font-black text-blue-400 tracking-tighter">${product.price}</p>
                      <span className="text-[8px] font-headline font-black text-slate-500 uppercase tracking-widest">Base Value</span>
                    </div>
                  </div>
                  
                  <div className="relative z-10">
                    <div className="bg-slate-900/50 p-4 rounded-2xl border border-white/5 group-hover:border-blue-500/10 transition-all">
                      <p className="text-[11px] text-slate-400 font-medium leading-relaxed line-clamp-2">{product.description}</p>
                    </div>
                  </div>

                  <div className="flex gap-4 relative z-10">
                    <motion.button 
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        setEditingProduct(product);
                        setProductForm({ ...product });
                      }}
                      className="flex-1 py-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white text-[10px] font-headline font-black uppercase tracking-[0.2em] transition-all border border-white/5 shadow-xl"
                    >
                      Modify Asset
                    </motion.button>
                    <motion.button 
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleProductAction('delete', product)}
                      className="w-14 h-14 rounded-2xl bg-red-500/10 hover:bg-red-500/20 text-red-500 flex items-center justify-center border border-red-500/20 transition-all shadow-xl"
                    >
                      <span className="material-symbols-outlined text-2xl">delete</span>
                    </motion.button>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'deposits' && (
          <div
            key="deposits"
            className="space-y-6 px-8 pb-12"
          >
            <div className="grid grid-cols-1 gap-6">
              {deposits.map((dep, idx) => (
                <motion.div 
                  key={dep.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="glass-card premium-border rounded-[40px] p-8 space-y-6 relative overflow-hidden group"
                >
                  {dep.status === 'pending' && (
                    <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-500 animate-pulse"></div>
                  )}
                  
                  <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 relative z-10">
                    <div className="flex items-center gap-6">
                      <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center text-blue-400 border border-white/5 shadow-2xl">
                        <span className="material-symbols-outlined text-3xl">payments</span>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-3">
                          <span className="px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 text-[9px] font-headline font-black uppercase tracking-[0.2em] border border-blue-500/20 shadow-lg">
                            {dep.network}
                          </span>
                          <span className={cn(
                            "px-3 py-1 rounded-full text-[9px] font-headline font-black uppercase tracking-[0.2em] border shadow-lg",
                            dep.status === 'pending' ? 'bg-slate-800/50 text-slate-400 border-white/5' :
                            dep.status === 'approved' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                            'bg-red-500/10 text-red-500 border-red-500/20'
                          )}>
                            {dep.status}
                          </span>
                        </div>
                        <p className="text-3xl font-headline font-black text-white tracking-tighter">${dep.amount.toLocaleString()}</p>
                      </div>
                    </div>

                    <div className="flex-1 w-full lg:w-auto">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-900/50 p-5 rounded-3xl border border-white/5">
                        <div className="space-y-1">
                          <span className="text-[9px] uppercase font-headline font-black text-slate-500 tracking-[0.2em]">Transaction Hash</span>
                          <p className="font-mono text-[10px] text-blue-400/80 break-all leading-tight">{dep.txid}</p>
                        </div>
                        <div className="flex justify-between items-center sm:border-l sm:border-white/5 sm:pl-4">
                          <div className="space-y-1">
                            <span className="text-[9px] uppercase font-headline font-black text-slate-500 tracking-[0.2em]">Node ID</span>
                            <p className="text-[10px] text-white font-mono font-bold">{dep.user_id}</p>
                          </div>
                          <div className="text-right space-y-1">
                            <span className="text-[9px] uppercase font-headline font-black text-slate-500 tracking-[0.2em]">Timestamp</span>
                            <p className="text-[10px] text-slate-400 font-bold">{new Date(dep.created_at).toLocaleString()}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {dep.status === 'pending' && (
                    <div className="flex flex-col sm:flex-row gap-4 relative z-10">
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => verifyOnChain(dep)}
                        disabled={!!verifyingId || !!processingId}
                        className="flex-1 py-4 rounded-2xl bg-slate-800 border border-white/10 text-white text-[10px] font-headline font-black uppercase tracking-[0.2em] flex items-center justify-center gap-3 hover:bg-slate-700 transition-all disabled:opacity-50 shadow-xl"
                      >
                        {verifyingId === dep.id ? (
                          <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                          <span className="material-symbols-outlined text-xl text-blue-400">verified</span>
                        )}
                        {verifyingId === dep.id ? 'Analyzing Blockchain...' : 'Verify On-Chain'}
                      </motion.button>
                      
                      <div className="flex gap-4 flex-1">
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => handleDepositAction(dep, 'approved')}
                          disabled={!!processingId || !!verifyingId}
                          className="flex-1 py-4 rounded-2xl bg-emerald-500 text-white text-[10px] font-headline font-black uppercase tracking-[0.2em] active:scale-95 transition-all disabled:opacity-50 shadow-lg shadow-emerald-500/20"
                        >
                          {processingId === dep.id ? 'Processing...' : 'Authorize'}
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => handleDepositAction(dep, 'rejected')}
                          disabled={!!processingId || !!verifyingId}
                          className="flex-1 py-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 font-headline font-black text-[10px] uppercase tracking-[0.2em] active:scale-95 transition-all disabled:opacity-50 hover:bg-red-500/20"
                        >
                          Deny
                        </motion.button>
                      </div>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'kyc' && (
          <div
            key="kyc"
            className="space-y-8 px-8 pb-12"
          >
            <div className="grid grid-cols-1 gap-6">
              {profiles.filter(p => p.kyc_status === 'pending').length === 0 && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="glass-card premium-border rounded-[48px] p-20 text-center space-y-6"
                >
                  <div className="w-24 h-24 rounded-full bg-slate-900 flex items-center justify-center mx-auto text-slate-700 border border-white/5 shadow-2xl">
                    <span className="material-symbols-outlined text-5xl">verified_user</span>
                  </div>
                  <div className="space-y-2">
                    <p className="text-white font-headline font-black text-xl uppercase tracking-tight">All Clear</p>
                    <p className="text-slate-500 text-[10px] uppercase tracking-[0.3em] font-bold">No pending identity verifications in queue</p>
                  </div>
                </motion.div>
              )}
              {profiles.filter(p => p.kyc_status === 'pending').map((profile, idx) => (
                <motion.div 
                  key={profile.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className="glass-card premium-border rounded-[40px] p-8 space-y-8 relative overflow-hidden group"
                >
                  <div className="flex justify-between items-start relative z-10">
                    <div className="flex items-center gap-6">
                      <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center text-blue-400 border border-white/5 shadow-2xl">
                        <span className="material-symbols-outlined text-3xl">person</span>
                      </div>
                      <div className="space-y-1">
                        <p className="text-white font-headline font-black text-xl tracking-tight uppercase">{profile.email}</p>
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] text-slate-500 font-mono font-bold uppercase tracking-widest">Node ID:</span>
                          <span className="text-[10px] text-blue-400/60 font-mono font-bold tracking-tight">{profile.id}</span>
                        </div>
                      </div>
                    </div>
                    <span className="px-4 py-1.5 rounded-full text-[9px] font-headline font-black uppercase tracking-[0.2em] bg-amber-500/10 text-amber-500 border border-amber-500/20 shadow-lg">
                      Pending Verification
                    </span>
                  </div>

                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 relative z-10">
                    <div className="space-y-6">
                      <div className="bg-slate-900/50 p-6 rounded-3xl border border-white/5 space-y-4">
                        <p className="text-[10px] uppercase font-headline font-black text-slate-500 tracking-[0.2em]">Document Metadata</p>
                        <div className="grid grid-cols-2 gap-6">
                          <div className="space-y-1">
                            <span className="text-[9px] text-slate-600 font-bold uppercase tracking-widest">Type</span>
                            <p className="text-sm text-white font-headline font-black uppercase tracking-tight">{profile.kyc_document_type}</p>
                          </div>
                          <div className="space-y-1">
                            <span className="text-[9px] text-slate-600 font-bold uppercase tracking-widest">Serial Number</span>
                            <p className="text-sm text-blue-400 font-mono font-bold">{profile.kyc_document_number}</p>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => handleKYCAction(profile.id, 'verified')}
                          disabled={!!processingId}
                          className="py-5 rounded-2xl bg-emerald-500 text-white text-[10px] font-headline font-black uppercase tracking-[0.2em] active:scale-95 transition-all disabled:opacity-50 shadow-lg shadow-emerald-500/20"
                        >
                          {processingId === profile.id ? 'Verifying...' : 'Approve Node'}
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => setIsRejectingKYC(profile.id)}
                          disabled={!!processingId}
                          className="py-5 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 font-headline font-black text-[10px] uppercase tracking-[0.2em] active:scale-95 transition-all disabled:opacity-50 hover:bg-red-500/20"
                        >
                          Reject
                        </motion.button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-3">
                        <span className="text-[9px] text-slate-600 font-bold uppercase tracking-widest ml-1">Identity Document</span>
                        <div className="relative aspect-[4/3] rounded-3xl overflow-hidden border border-white/10 group cursor-pointer shadow-2xl" onClick={() => window.open(profile.kyc_document_url || '', '_blank')}>
                          <img 
                            src={profile.kyc_document_url || ''} 
                            alt="KYC Document" 
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                            referrerPolicy="no-referrer"
                            loading="lazy"
                          />
                          <div className="absolute inset-0 bg-blue-500/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
                            <span className="material-symbols-outlined text-3xl text-white">zoom_in</span>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <span className="text-[9px] text-slate-600 font-bold uppercase tracking-widest ml-1">Biometric Selfie</span>
                        <div className="relative aspect-[4/3] rounded-3xl overflow-hidden border border-white/10 group cursor-pointer shadow-2xl" onClick={() => window.open(profile.kyc_selfie_url || '', '_blank')}>
                          <img 
                            src={profile.kyc_selfie_url || ''} 
                            alt="KYC Selfie" 
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                            referrerPolicy="no-referrer"
                            loading="lazy"
                          />
                          <div className="absolute inset-0 bg-blue-500/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
                            <span className="material-symbols-outlined text-3xl text-white">zoom_in</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Rejection Modal */}
            <AnimatePresence>
              {isRejectingKYC && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setIsRejectingKYC(null)}
                    className="absolute inset-0 bg-slate-950/80 backdrop-blur-xl"
                  ></motion.div>
                  <motion.div 
                    initial={{ scale: 0.9, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.9, opacity: 0, y: 20 }}
                    className="w-full max-w-md glass-card premium-border p-10 rounded-[48px] space-y-8 relative z-10 shadow-[0_0_100px_rgba(0,0,0,0.5)]"
                  >
                    <div className="text-center space-y-3">
                      <div className="w-20 h-20 rounded-3xl bg-red-500/10 flex items-center justify-center mx-auto text-red-500 border border-red-500/20 mb-4">
                        <span className="material-symbols-outlined text-4xl">gpp_bad</span>
                      </div>
                      <h3 className="text-2xl font-headline font-black text-white uppercase tracking-tight">Reject Verification</h3>
                      <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.3em]">Specify protocol violation reason</p>
                    </div>
                    <textarea
                      className="w-full px-6 py-5 rounded-3xl bg-slate-900/50 border border-white/5 text-white focus:outline-none focus:border-red-500/50 transition-all h-40 resize-none text-sm font-medium placeholder:text-slate-700"
                      placeholder="e.g. Image resolution insufficient, document expired, mismatch detected..."
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                    />
                    <div className="grid grid-cols-2 gap-4">
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => { setIsRejectingKYC(null); setRejectionReason(''); }}
                        className="py-5 rounded-2xl bg-slate-800 text-white font-headline font-black text-[10px] uppercase tracking-[0.2em] border border-white/5"
                      >
                        Abort
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleKYCAction(isRejectingKYC, 'rejected', rejectionReason)}
                        disabled={!rejectionReason || !!processingId}
                        className="py-5 rounded-2xl bg-red-500 text-white font-headline font-black text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-red-500/20 disabled:opacity-50"
                      >
                        {processingId ? 'Processing...' : 'Confirm Rejection'}
                      </motion.button>
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>
          </div>
        )}

        {activeTab === 'withdrawals' && (
          <div
            key="withdrawals"
            className="space-y-6 px-8 pb-12"
          >
            <div className="grid grid-cols-1 gap-6">
              {withdrawals.map((w, idx) => (
                <motion.div 
                  key={w.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="glass-card premium-border rounded-[40px] p-8 space-y-6 relative overflow-hidden group"
                >
                  {w.status === 'pending' && (
                    <div className="absolute top-0 left-0 w-1.5 h-full bg-amber-500 animate-pulse"></div>
                  )}
                  
                  <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 relative z-10">
                    <div className="flex items-center gap-6">
                      <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center text-amber-400 border border-white/5 shadow-2xl">
                        <span className="material-symbols-outlined text-3xl">outbox</span>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-3">
                          <span className="px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 text-[9px] font-headline font-black uppercase tracking-[0.2em] border border-amber-500/20 shadow-lg">
                            {w.network}
                          </span>
                          <span className={cn(
                            "px-3 py-1 rounded-full text-[9px] font-headline font-black uppercase tracking-[0.2em] border shadow-lg",
                            w.status === 'pending' ? 'bg-slate-800/50 text-slate-400 border-white/5' :
                            w.status === 'approved' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                            'bg-red-500/10 text-red-500 border-red-500/20'
                          )}>
                            {w.status}
                          </span>
                        </div>
                        <p className="text-3xl font-headline font-black text-white tracking-tighter">${w.amount.toLocaleString()}</p>
                      </div>
                    </div>

                    <div className="flex-1 w-full lg:w-auto">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-900/50 p-5 rounded-3xl border border-white/5">
                        <div className="space-y-1">
                          <span className="text-[9px] uppercase font-headline font-black text-slate-500 tracking-[0.2em]">Destination Address</span>
                          <p className="font-mono text-[10px] text-amber-400/80 break-all leading-tight">{w.wallet_address}</p>
                        </div>
                        <div className="flex justify-between items-center sm:border-l sm:border-white/5 sm:pl-4">
                          <div className="space-y-1">
                            <span className="text-[9px] uppercase font-headline font-black text-slate-500 tracking-[0.2em]">Node ID</span>
                            <p className="text-[10px] text-white font-mono font-bold">{w.user_id}</p>
                          </div>
                          <div className="text-right space-y-1">
                            <span className="text-[9px] uppercase font-headline font-black text-slate-500 tracking-[0.2em]">Timestamp</span>
                            <p className="text-[10px] text-slate-400 font-bold">{new Date(w.created_at).toLocaleString()}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {w.status === 'pending' && (
                    <div className="grid grid-cols-2 gap-4 relative z-10">
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleWithdrawAction(w, 'approved')}
                        disabled={!!processingId}
                        className="py-4 rounded-2xl bg-amber-500 text-white text-[10px] font-headline font-black uppercase tracking-[0.2em] active:scale-95 transition-all disabled:opacity-50 shadow-lg shadow-amber-500/20"
                      >
                        {processingId === w.id ? 'Authorizing...' : 'Approve Withdrawal'}
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleWithdrawAction(w, 'rejected')}
                        disabled={!!processingId}
                        className="py-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 font-headline font-black text-[10px] uppercase tracking-[0.2em] active:scale-95 transition-all disabled:opacity-50 hover:bg-red-500/20"
                      >
                        Reject
                      </motion.button>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'stakes' && (
          <div key="stakes" className="space-y-6 px-8 pb-12">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {stakes.map((s, idx) => (
                <motion.div 
                  key={s.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: idx * 0.05 }}
                  className="glass-card premium-border rounded-[40px] p-8 space-y-6 relative overflow-hidden group"
                >
                  <div className="flex justify-between items-start relative z-10">
                    <div className="flex items-center gap-5">
                      <div className="w-14 h-14 rounded-2xl bg-slate-800 flex items-center justify-center text-blue-400 border border-white/5 shadow-2xl">
                        <span className="material-symbols-outlined text-2xl">layers</span>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-white font-headline font-black text-lg tracking-tight uppercase leading-tight">{s.products?.name || 'Unknown Protocol'}</p>
                        <p className="text-[9px] text-slate-500 font-bold uppercase tracking-[0.2em]">{s.profiles?.email}</p>
                      </div>
                    </div>
                    <span className={cn(
                      "px-3 py-1 rounded-full text-[9px] font-headline font-black uppercase tracking-[0.2em] border shadow-lg",
                      s.status === 'active' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-slate-800/50 text-slate-400 border-white/5'
                    )}>
                      {s.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 relative z-10">
                    <div className="bg-slate-900/50 p-5 rounded-3xl border border-white/5 space-y-1">
                      <span className="text-[9px] uppercase font-headline font-black text-slate-500 tracking-[0.2em]">Staked Capital</span>
                      <p className="text-2xl font-headline font-black text-white tracking-tighter">${s.amount.toLocaleString()}</p>
                    </div>
                    <div className="bg-slate-900/50 p-5 rounded-3xl border border-white/5 space-y-1">
                      <span className="text-[9px] uppercase font-headline font-black text-slate-500 tracking-[0.2em]">Maturity Date</span>
                      <p className="text-lg font-headline font-black text-blue-400 tracking-tight">{new Date(s.sell_available_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'transactions' && (
          <div key="transactions" className="space-y-6 px-8 pb-12">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {transactions.map((t, idx) => (
                <motion.div 
                  key={t.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.02 }}
                  className="glass-card premium-border rounded-[32px] p-6 space-y-5 relative overflow-hidden group"
                >
                  <div className="flex justify-between items-start relative z-10">
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "w-12 h-12 rounded-2xl flex items-center justify-center border border-white/5 shadow-xl",
                        t.type === 'deposit' ? 'bg-emerald-500/10 text-emerald-400' : 
                        t.type === 'withdraw' ? 'bg-amber-500/10 text-amber-400' : 
                        'bg-blue-500/10 text-blue-400'
                      )}>
                        <span className="material-symbols-outlined text-2xl">
                          {t.type === 'deposit' ? 'south_west' : t.type === 'withdraw' ? 'north_east' : 'sync_alt'}
                        </span>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-white font-headline font-black text-sm tracking-tight uppercase leading-tight">{t.type}</p>
                        <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest truncate max-w-[120px]">{t.profiles?.email}</p>
                      </div>
                    </div>
                    <div className="text-right space-y-0.5">
                      <p className={cn(
                        "text-lg font-headline font-black tracking-tighter",
                        t.amount > 0 ? 'text-emerald-400' : 'text-white'
                      )}>
                        {t.amount > 0 ? '+' : ''}{t.amount.toLocaleString()}
                      </p>
                      <p className="text-[8px] text-slate-600 font-mono font-bold uppercase tracking-widest">{new Date(t.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                  {t.description && (
                    <div className="bg-slate-900/50 p-3 rounded-xl border border-white/5">
                      <p className="text-[10px] text-slate-400 font-medium leading-relaxed italic opacity-80">
                        {t.description}
                      </p>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'support' && (
          <div key="support" className="space-y-8 px-8 pb-12">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
              <div className="space-y-1">
                <h2 className="text-3xl font-headline font-black text-white tracking-tight uppercase">Support Terminal</h2>
                <p className="text-[10px] text-slate-500 uppercase tracking-[0.3em] font-bold">Manage encrypted user communications</p>
              </div>
              <div className="flex items-center gap-4 w-full sm:w-auto">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => fetchData(true)}
                  className="w-14 h-14 rounded-2xl bg-slate-800 border border-white/5 flex items-center justify-center text-slate-400 hover:text-white transition-all shadow-xl"
                  title="Refresh Tickets"
                >
                  <span className="material-symbols-outlined text-2xl">refresh</span>
                </motion.button>
                <div className="flex-1 sm:flex-none px-6 py-4 rounded-2xl bg-slate-900/50 border border-white/5 flex items-center gap-4 shadow-xl">
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse shadow-[0_0_10px_rgba(245,158,11,0.5)]"></div>
                  <span className="text-[10px] font-headline font-black text-white uppercase tracking-[0.2em]">
                    {supportTickets.filter(t => t.status === 'open').length} Active Inquiries
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6">
              {supportTickets.map((ticket, idx) => (
                <motion.div 
                  key={ticket.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="glass-card premium-border rounded-[40px] p-8 space-y-6 relative overflow-hidden group"
                >
                  <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 relative z-10">
                    <div className="flex items-center gap-6">
                      <div className={cn(
                        "w-16 h-16 rounded-2xl flex items-center justify-center border border-white/5 shadow-2xl",
                        ticket.status === 'open' ? 'bg-amber-500/10 text-amber-400' : 'bg-emerald-500/10 text-emerald-400'
                      )}>
                        <span className="material-symbols-outlined text-3xl">
                          {ticket.status === 'open' ? 'mail' : 'mark_email_read'}
                        </span>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-3">
                          <span className={cn(
                            "px-3 py-1 rounded-full text-[9px] font-headline font-black uppercase tracking-[0.2em] border shadow-lg",
                            ticket.status === 'open' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          )}>
                            {ticket.status}
                          </span>
                          <span className="text-[9px] text-slate-500 font-headline font-black uppercase tracking-[0.2em]">
                            {new Date(ticket.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <h3 className="text-xl font-headline font-black text-white tracking-tight uppercase">{ticket.subject}</h3>
                        <p className="text-[10px] text-blue-400/60 font-mono font-bold tracking-tight">{ticket.profiles?.email}</p>
                      </div>
                    </div>
                    <div className="flex gap-4 w-full lg:w-auto">
                      {ticket.status !== 'closed' && (
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => {
                            setReplyingTicket(ticket);
                            setTicketReply(ticket.admin_reply || '');
                          }}
                          className="flex-1 lg:flex-none px-10 py-4 rounded-2xl bg-blue-500 text-white font-headline font-black text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-blue-500/20 active:scale-95 transition-all"
                        >
                          {ticket.admin_reply ? 'Modify Response' : 'Initialize Response'}
                        </motion.button>
                      )}
                      {ticket.status !== 'closed' && (
                        <motion.button 
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => handleCloseTicket(ticket.id)}
                          className="w-14 h-14 rounded-2xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 transition-all border border-emerald-500/20 flex items-center justify-center shadow-xl"
                          title="Close Ticket"
                        >
                          <span className="material-symbols-outlined text-2xl">check_circle</span>
                        </motion.button>
                      )}
                    </div>
                  </div>

                  <div className="p-6 rounded-[32px] bg-slate-900/50 border border-white/5 space-y-6 relative z-10">
                    <div className="space-y-2">
                      <span className="text-[9px] uppercase font-headline font-black text-slate-500 tracking-[0.2em]">User Transmission</span>
                      <p className="text-sm text-slate-300 leading-relaxed font-medium">{ticket.message}</p>
                    </div>
                    {ticket.admin_reply && (
                      <div className="pt-6 border-t border-white/5 space-y-3">
                        <div className="flex items-center gap-3">
                          <span className="material-symbols-outlined text-lg text-blue-400">reply</span>
                          <span className="text-[9px] font-headline font-black text-blue-400 uppercase tracking-[0.2em]">Admin Response Protocol</span>
                        </div>
                        <p className="text-sm text-white/90 leading-relaxed font-medium italic bg-blue-500/5 p-4 rounded-2xl border border-blue-500/10">{ticket.admin_reply}</p>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
              {supportTickets.length === 0 && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="py-32 text-center glass-card rounded-[48px] premium-border space-y-6"
                >
                  <div className="w-24 h-24 rounded-full bg-slate-900 flex items-center justify-center mx-auto text-slate-700 border border-white/5 shadow-2xl">
                    <span className="material-symbols-outlined text-5xl">support_agent</span>
                  </div>
                  <div className="space-y-2">
                    <p className="text-white font-headline font-black text-xl uppercase tracking-tight">All Quiet</p>
                    <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.3em]">No active support transmissions detected</p>
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div key="settings" className="space-y-8 px-8 pb-12">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-card premium-border rounded-[48px] p-10 space-y-10 relative overflow-hidden"
            >
              <div className="space-y-2">
                <h2 className="text-3xl font-headline font-black text-white tracking-tight uppercase">Global Parameters</h2>
                <p className="text-[10px] text-slate-500 uppercase tracking-[0.3em] font-bold">Configure core network protocols</p>
              </div>

              <div className="space-y-8">
                <div className="space-y-3">
                  <label className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-headline font-black ml-2">Network Announcement</label>
                  <textarea
                    className="w-full px-8 py-6 rounded-[32px] bg-slate-900/50 border border-white/5 text-white focus:outline-none focus:border-blue-500/50 transition-all h-32 resize-none text-sm font-medium placeholder:text-slate-700 shadow-inner"
                    value={settingsForm.announcement_text}
                    onChange={(e) => setSettingsForm({ ...settingsForm, announcement_text: e.target.value })}
                    placeholder="Broadcast message to all nodes..."
                  />
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-8 rounded-[32px] bg-slate-900/50 border border-white/5 gap-6 shadow-xl">
                  <div className="space-y-1">
                    <p className="text-lg font-headline font-black text-white uppercase tracking-tight">Maintenance Protocol</p>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em]">Restrict network access for system updates</p>
                  </div>
                  <button
                    onClick={() => setSettingsForm({ ...settingsForm, maintenance_mode: !settingsForm.maintenance_mode })}
                    className={cn(
                      "w-20 h-10 rounded-full relative transition-all duration-500 shadow-2xl",
                      settingsForm.maintenance_mode ? 'bg-red-500 shadow-red-500/20' : 'bg-slate-800'
                    )}
                  >
                    <motion.div 
                      animate={{ x: settingsForm.maintenance_mode ? 44 : 4 }}
                      className="absolute top-1 w-8 h-8 rounded-full bg-white shadow-lg"
                    ></motion.div>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {[
                    { label: 'Min Deposit Threshold', value: 'min_deposit', icon: 'input' },
                    { label: 'Min Withdrawal Limit', value: 'min_withdrawal', icon: 'output' },
                    { label: 'Network Fee (%)', value: 'withdrawal_fee', icon: 'percent' },
                    { label: 'Referral Incentive (%)', value: 'referral_bonus_percent', icon: 'group_add' }
                  ].map((field) => (
                    <div key={field.value} className="space-y-3">
                      <label className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-headline font-black ml-2">{field.label}</label>
                      <div className="relative group">
                        <div className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-blue-400 transition-colors">
                          <span className="material-symbols-outlined text-xl">{field.icon}</span>
                        </div>
                        <input
                          type="number"
                          className="w-full pl-16 pr-8 py-5 rounded-2xl bg-slate-900/50 border border-white/5 text-white font-headline font-black focus:outline-none focus:border-blue-500/50 transition-all text-lg shadow-inner"
                          value={settingsForm[field.value as keyof typeof settingsForm]}
                          onChange={(e) => setSettingsForm({ ...settingsForm, [field.value]: Number(e.target.value) })}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={handleUpdateSettings}
                  disabled={processingId === 'settings'}
                  className="w-full py-6 rounded-[32px] bg-blue-500 text-white text-xs font-headline font-black uppercase tracking-[0.3em] shadow-[0_0_40px_rgba(59,130,246,0.2)] hover:shadow-[0_0_60px_rgba(59,130,246,0.3)] transition-all disabled:opacity-50"
                >
                  {processingId === 'settings' ? 'Synchronizing Protocols...' : 'Commit Global Configuration'}
                </motion.button>
              </div>
            </motion.div>
          </div>
        )}

        {activeTab === 'social_tasks' && (
          <div key="social_tasks" className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h2 className="text-3xl font-headline font-black text-white tracking-tight uppercase">Social Protocols</h2>
                <p className="text-[10px] text-slate-500 uppercase tracking-[0.3em] font-bold">Incentivize community expansion</p>
              </div>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  setIsAddingSocialTask(true);
                  setSocialTaskForm({
                    platform: 'telegram',
                    title: '',
                    description: '',
                    link: '',
                    reward_amount: 0,
                    is_active: true
                  });
                }}
                className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-blue-500 text-white font-headline font-black text-[10px] uppercase tracking-[0.2em] flex items-center justify-center gap-3 shadow-xl shadow-blue-500/20"
              >
                <span className="material-symbols-outlined text-xl">add_circle</span>
                Initialize Task
              </motion.button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {socialTasks.map((task, idx) => (
                <motion.div 
                  key={task.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: idx * 0.05 }}
                  className="glass-card premium-border rounded-[32px] p-6 space-y-6 relative overflow-hidden group hover:shadow-[0_0_40px_rgba(59,130,246,0.1)] transition-all duration-500"
                >
                  <div className="flex items-center justify-between relative z-10">
                    <div className="flex items-center gap-4">
                      <div className="relative group/icon">
                        <div className="absolute -inset-2 bg-blue-500/20 rounded-full blur-xl opacity-0 group-hover/icon:opacity-100 transition-opacity duration-500" />
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center border border-white/10 shadow-2xl relative z-10 overflow-hidden">
                          <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/10 to-transparent opacity-0 group-hover/icon:opacity-100 transition-opacity" />
                          <span className="material-symbols-outlined text-3xl text-blue-400 drop-shadow-[0_0_10px_rgba(96,165,250,0.5)]">
                            {task.platform === 'telegram' ? 'send' : 
                             task.platform === 'twitter' ? 'close' : 
                             task.platform === 'youtube' ? 'play_circle' : 
                             task.platform === 'facebook' ? 'facebook' : 
                             task.platform === 'instagram' ? 'photo_camera' : 'task'}
                          </span>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-500/50" />
                          <p className="text-[10px] font-headline font-black text-slate-500 uppercase tracking-[0.3em]">{task.platform}</p>
                        </div>
                        <p className="text-base text-white font-headline font-black uppercase tracking-tight truncate max-w-[160px] drop-shadow-sm">{task.title}</p>
                      </div>
                    </div>
                    <div className={cn(
                      "px-3 py-1 rounded-full text-[8px] font-headline font-black uppercase tracking-[0.2em] border shadow-lg transition-all duration-300",
                      task.is_active 
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-emerald-500/5' 
                        : 'bg-red-500/10 text-red-500 border-red-500/20 shadow-red-500/5'
                    )}>
                      <div className="flex items-center gap-1.5">
                        <div className={cn(
                          "w-1 h-1 rounded-full animate-pulse",
                          task.is_active ? 'bg-emerald-400' : 'bg-red-500'
                        )} />
                        {task.is_active ? 'Operational' : 'Deactivated'}
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-4 p-5 rounded-2xl bg-slate-900/40 border border-white/5 relative z-10 backdrop-blur-sm group-hover:bg-slate-900/60 transition-colors">
                    <div className="flex justify-between items-center">
                      <div className="flex flex-col">
                        <span className="text-[8px] uppercase tracking-[0.3em] text-slate-500 font-headline font-black mb-1">Protocol Reward</span>
                        <div className="flex items-baseline gap-1">
                          <span className="text-2xl text-blue-400 font-headline font-black tracking-tighter">${task.reward_amount}</span>
                          <span className="text-[10px] text-blue-500/50 font-bold uppercase tracking-widest">USD</span>
                        </div>
                      </div>
                      <div className="w-10 h-10 rounded-xl bg-blue-500/5 border border-blue-500/10 flex items-center justify-center">
                        <span className="material-symbols-outlined text-blue-400/50 text-xl">payments</span>
                      </div>
                    </div>
                    <div className="h-px bg-gradient-to-r from-transparent via-white/5 to-transparent w-full" />
                    <div className="space-y-1.5">
                      <span className="text-[8px] uppercase tracking-[0.3em] text-slate-500 font-headline font-black">Mission Parameters</span>
                      <p className="text-[11px] text-slate-400 leading-relaxed font-medium line-clamp-2 italic opacity-80 group-hover:opacity-100 transition-opacity">
                        "{task.description}"
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3 relative z-10 pt-2">
                    <motion.button
                      whileHover={{ scale: 1.02, y: -2 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        setEditingSocialTask(task);
                        setSocialTaskForm({
                          platform: task.platform,
                          title: task.title,
                          description: task.description,
                          link: task.link,
                          reward_amount: task.reward_amount,
                          is_active: task.is_active
                        });
                      }}
                      className="flex-1 py-4 rounded-2xl bg-slate-800/50 text-white text-[10px] font-headline font-black uppercase tracking-[0.25em] border border-white/10 hover:bg-blue-500 hover:border-blue-400 hover:shadow-[0_0_20px_rgba(59,130,246,0.3)] transition-all duration-300 flex items-center justify-center gap-2 group/btn"
                    >
                      <span className="material-symbols-outlined text-sm group-hover/btn:rotate-12 transition-transform">edit_note</span>
                      Modify Protocol
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.05, rotate: 5 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleSocialTaskAction('delete', task)}
                      className="w-14 h-14 rounded-2xl bg-red-500/5 text-red-500/70 border border-red-500/10 flex items-center justify-center hover:bg-red-500 hover:text-white hover:border-red-400 hover:shadow-[0_0_20px_rgba(239,68,68,0.3)] transition-all duration-300"
                    >
                      <span className="material-symbols-outlined text-xl">delete_forever</span>
                    </motion.button>
                  </div>
                </motion.div>
              ))}
              {socialTasks.length === 0 && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="col-span-full py-32 text-center glass-card rounded-[48px] premium-border space-y-6"
                >
                  <div className="w-24 h-24 rounded-full bg-slate-900 flex items-center justify-center mx-auto text-slate-700 border border-white/5 shadow-2xl">
                    <span className="material-symbols-outlined text-5xl">task</span>
                  </div>
                  <div className="space-y-2">
                    <p className="text-white font-headline font-black text-xl uppercase tracking-tight">No Protocols</p>
                    <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.3em]">No social tasks have been initialized</p>
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {/* Support Ticket Reply Modal */}
        {replyingTicket && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center px-6 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="glass-card rounded-[40px] p-8 w-full max-w-lg border-white/10 shadow-2xl relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-[#10B981]/10 via-transparent to-[#F59E0B]/10 z-0"></div>
              
              <div className="relative z-10 space-y-6">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-[#10B981]/10 rounded-2xl flex items-center justify-center text-[#10B981]">
                      <span className="material-symbols-outlined text-2xl">reply</span>
                    </div>
                    <div>
                      <h2 className="text-xl font-black text-white tracking-tight uppercase">Reply to Ticket</h2>
                      <p className="text-[10px] text-white/40 font-black uppercase tracking-widest">Subject: {replyingTicket.subject}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setReplyingTicket(null)}
                    className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white/40 hover:text-white transition-colors"
                  >
                    <span className="material-symbols-outlined">close</span>
                  </button>
                </div>

                <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                  <p className="text-xs text-white/60 leading-relaxed italic">"{replyingTicket.message}"</p>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-white/40 px-1">Admin Reply</label>
                  <textarea
                    placeholder="Type your response here..."
                    rows={4}
                    value={ticketReply}
                    onChange={(e) => setTicketReply(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-[var(--blue)]/50 transition-all resize-none"
                  />
                </div>

                <button
                  onClick={handleTicketReply}
                  disabled={!!processingId || !ticketReply}
                  className="w-full py-5 rounded-2xl bg-[#10B981] text-white font-black uppercase tracking-[0.3em] text-[10px] shadow-lg shadow-[#10B981]/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
                >
                  {processingId === replyingTicket.id ? 'Sending...' : 'Send Reply'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Balance Edit Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-md glass-card premium-border p-4 sm:p-5 rounded-[20px] sm:rounded-[24px] space-y-3 my-2"
          >
            <div className="text-center space-y-0.5">
              <h3 className="text-lg font-black text-white">Adjust Balance</h3>
              <p className="text-on-surface-variant text-[10px] font-bold uppercase tracking-widest">{editingUser.email}</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-2 gap-y-1.5">
              <div className="space-y-0.5">
                <label className="text-[9px] uppercase tracking-widest text-on-surface-variant font-bold px-1">Available Balance</label>
                <input
                  type="number"
                  className="w-full px-2.5 py-2 rounded-lg bg-background border border-white/5 text-on-surface focus:outline-none focus:border-[var(--blue)] transition-all text-xs"
                  value={newAvailableBalance ?? 0}
                  onChange={(e) => setNewAvailableBalance(Number(e.target.value))}
                />
              </div>
              <div className="space-y-0.5">
                <label className="text-[9px] uppercase tracking-widest text-on-surface-variant font-bold px-1">Total Balance</label>
                <input
                  type="number"
                  className="w-full px-2.5 py-2 rounded-lg bg-background border border-white/5 text-on-surface focus:outline-none focus:border-[var(--blue)] transition-all text-xs"
                  value={newTotalBalance ?? 0}
                  onChange={(e) => setNewTotalBalance(Number(e.target.value))}
                />
              </div>
              <div className="space-y-0.5">
                <label className="text-[9px] uppercase tracking-widest text-on-surface-variant font-bold px-1">Deposit Balance</label>
                <input
                  type="number"
                  className="w-full px-2.5 py-2 rounded-lg bg-background border border-white/5 text-on-surface focus:outline-none focus:border-[var(--blue)] transition-all text-xs"
                  value={newDepositBalance ?? 0}
                  onChange={(e) => setNewDepositBalance(Number(e.target.value))}
                />
              </div>
              <div className="space-y-0.5">
                <label className="text-[9px] uppercase tracking-widest text-on-surface-variant font-bold px-1">Withdrawable</label>
                <input
                  type="number"
                  className="w-full px-2.5 py-2 rounded-lg bg-background border border-white/5 text-on-surface focus:outline-none focus:border-[var(--blue)] transition-all text-xs"
                  value={newWithdrawableBalance ?? 0}
                  onChange={(e) => setNewWithdrawableBalance(Number(e.target.value))}
                />
              </div>
              <div className="space-y-0.5">
                <label className="text-[9px] uppercase tracking-widest text-on-surface-variant font-bold px-1">VIP Level</label>
                <input
                  type="number"
                  className="w-full px-2.5 py-2 rounded-lg bg-background border border-white/5 text-on-surface focus:outline-none focus:border-[var(--blue)] transition-all text-xs"
                  value={newVipLevel ?? 1}
                  onChange={(e) => setNewVipLevel(Number(e.target.value))}
                  min="1"
                  max="10"
                />
              </div>
              <div className="space-y-0.5 col-span-2">
                <label className="text-[9px] uppercase tracking-widest text-on-surface-variant font-bold px-1">Referred By (User ID)</label>
                <input
                  type="text"
                  className="w-full px-2.5 py-2 rounded-lg bg-background border border-white/5 text-on-surface focus:outline-none focus:border-[var(--blue)] transition-all text-xs"
                  value={newReferredBy ?? ''}
                  onChange={(e) => setNewReferredBy(e.target.value)}
                  placeholder="Referrer's UUID"
                />
              </div>
              <div className="space-y-0.5 col-span-2">
                <label className="text-[9px] uppercase tracking-widest text-on-surface-variant font-bold px-1">User Role</label>
                <div className="flex gap-1.5">
                  {(['user', 'admin'] as const).map((role) => (
                    <button
                      key={role}
                      onClick={() => setNewRole(role)}
                      className={`flex-1 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all ${
                        newRole === role 
                          ? 'bg-[var(--blue)] text-white shadow-lg' 
                          : 'bg-white/5 text-on-surface-variant hover:bg-white/10'
                      }`}
                    >
                      {role}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                onClick={() => setEditingUser(null)}
                className="py-2.5 rounded-lg bg-white/5 text-white font-bold text-[9px] uppercase tracking-widest"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateBalance}
                disabled={!!processingId}
                className="py-2.5 rounded-lg btn-primary text-[9px] uppercase tracking-widest shadow-lg"
              >
                {processingId ? 'Updating...' : 'Confirm'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* User View Modal */}
      {viewingUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-md glass-card premium-border p-4 sm:p-5 rounded-[20px] sm:rounded-[24px] space-y-3 my-2"
          >
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-black text-white">User Details</h3>
              <button onClick={() => setViewingUser(null)} className="text-on-surface-variant">
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-surface-container flex items-center justify-center text-[var(--blue)] border border-white/5">
                  <img src={viewingUser.avatar_url || "https://picsum.photos/seed/user/100/100"} alt="" className="w-full h-full object-cover rounded-2xl" referrerPolicy="no-referrer" loading="lazy" />
                </div>
                <div>
                  <p className="text-lg font-black text-white truncate max-w-[200px]">{viewingUser.email}</p>
                  <p className="text-[9px] text-on-surface-variant font-mono uppercase tracking-widest">ID: {viewingUser.permanent_id}</p>
                </div>
              </div>

              {!userDetails ? (
                <div className="flex justify-center py-6">
                  <div className="w-6 h-6 border-2 border-[var(--blue)] border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    <div className="bg-surface-container p-2 rounded-lg border border-white/5">
                      <p className="text-[7px] uppercase font-black text-on-surface-variant tracking-widest mb-0.5">Total Earnings</p>
                      <p className="text-sm font-black text-[var(--gold)]">${userDetails.dashboard?.total_earnings?.toLocaleString() || '0'}</p>
                    </div>
                    <div className="bg-surface-container p-2 rounded-lg border border-white/5">
                      <p className="text-[7px] uppercase font-black text-on-surface-variant tracking-widest mb-0.5">Team Earnings</p>
                      <p className="text-sm font-black text-[var(--blue)]">${userDetails.dashboard?.team_earnings?.toLocaleString() || '0'}</p>
                    </div>
                  </div>

                  <div className="bg-surface-container p-2 rounded-lg border border-white/5 space-y-1.5">
                    <p className="text-[8px] uppercase font-black text-on-surface-variant tracking-widest">Team Statistics</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      <div>
                        <p className="text-[7px] text-on-surface-variant">Direct Members</p>
                        <p className="text-sm font-black text-white">{userDetails.team?.direct_members || 0}</p>
                      </div>
                      <div>
                        <p className="text-[7px] text-on-surface-variant">Team Volume</p>
                        <p className="text-sm font-black text-white">${userDetails.team?.total_team_volume?.toLocaleString() || '0'}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-surface-container p-2 rounded-lg border border-white/5 space-y-1">
                    <p className="text-[8px] uppercase font-black text-on-surface-variant tracking-widest">Account Info</p>
                    <div className="space-y-0.5">
                      <p className="text-[8px] text-on-surface-variant">Referral Code: <span className="text-white font-mono">{viewingUser.referral_code}</span></p>
                      <p className="text-[8px] text-on-surface-variant">Referred By: <span className="text-white font-mono">{viewingUser.referred_by || 'None'}</span></p>
                      <p className="text-[8px] text-on-surface-variant">Joined: <span className="text-white">{new Date(viewingUser.created_at).toLocaleDateString()}</span></p>
                    </div>
                  </div>

                  {userDetails.reserves?.length > 0 && (
                    <div className="bg-surface-container p-2 rounded-lg border border-white/5 space-y-1.5">
                      <p className="text-[8px] uppercase font-black text-on-surface-variant tracking-widest">Active Nodes</p>
                      <div className="space-y-1">
                        {userDetails.reserves.map((res: any) => (
                          <div key={res.id} className="flex justify-between items-center p-1 rounded-lg bg-background/40 border border-white/5">
                            <div>
                              <p className="text-[8px] font-bold text-white">{res.products?.name}</p>
                              <p className="text-[6px] text-on-surface-variant uppercase tracking-widest">${res.amount.toLocaleString()}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-[6px] text-on-surface-variant uppercase tracking-widest">Expires</p>
                              <p className="text-[7px] font-mono text-white">{new Date(res.sell_available_at).toLocaleDateString()}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <button
                onClick={() => setViewingUser(null)}
                className="w-full py-3 rounded-xl bg-white/5 text-white font-bold text-[9px] uppercase tracking-widest"
              >
                Close Terminal
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Product Edit/Add Modal */}
      {(isAddingProduct || editingProduct) && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-md glass-card premium-border p-4 sm:p-5 rounded-[20px] sm:rounded-[24px] space-y-3 my-2"
          >
            <div className="text-center space-y-0.5">
              <h3 className="text-lg font-black text-white">{isAddingProduct ? 'Add New Product' : 'Edit Product'}</h3>
            </div>

            <div className="space-y-1.5">
              {productForm.image_url && (
                <div className="relative w-full aspect-video rounded-lg overflow-hidden border border-white/10 glass-card">
                  <img 
                    src={productForm.image_url} 
                    alt="Preview" 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                    loading="lazy"
                  />
                  <button 
                    onClick={() => setProductForm({ ...productForm, image_url: '' })}
                    className="absolute top-1 right-1 p-0.5 rounded-full bg-black/50 text-white hover:bg-black/70 transition-all"
                  >
                    <span className="material-symbols-outlined text-[8px]">close</span>
                  </button>
                </div>
              )}
              <div className="space-y-0.5">
                <label className="text-[9px] uppercase tracking-widest text-on-surface-variant font-bold px-1">Product Name</label>
                <input
                  type="text"
                  className="w-full px-2.5 py-2 rounded-lg bg-background border border-white/5 text-on-surface focus:outline-none focus:border-[var(--blue)] transition-all text-xs"
                  value={productForm.name ?? ''}
                  onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                />
              </div>
              <div className="space-y-0.5">
                <label className="text-[9px] uppercase tracking-widest text-on-surface-variant font-bold px-1">Description</label>
                <textarea
                  className="w-full px-2.5 py-2 rounded-lg bg-background border border-white/5 text-on-surface focus:outline-none focus:border-[var(--blue)] transition-all h-12 resize-none text-xs"
                  value={productForm.description ?? ''}
                  onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                />
              </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-2 gap-y-1.5">
                <div className="space-y-0.5">
                  <label className="text-[9px] uppercase tracking-widest text-on-surface-variant font-bold px-1">Product Type</label>
                  <div className="flex gap-1">
                    {(['stake', 'task'] as const).map((type) => (
                      <button
                        key={type}
                        onClick={() => setProductForm({ ...productForm, type })}
                        className={`flex-1 py-2 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all ${
                          productForm.type === type 
                            ? 'bg-[var(--blue)] text-white' 
                            : 'bg-white/5 text-on-surface-variant'
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-0.5">
                  <label className="text-[9px] uppercase tracking-widest text-on-surface-variant font-bold px-1">Min VIP Level</label>
                  <input
                    type="number"
                    className="w-full px-2.5 py-2 rounded-lg bg-background border border-white/5 text-on-surface focus:outline-none focus:border-[var(--blue)] transition-all text-xs"
                    value={productForm.min_vip_level ?? 1}
                    onChange={(e) => setProductForm({ ...productForm, min_vip_level: Number(e.target.value) })}
                    min="1"
                    max="10"
                  />
                </div>
                <div className="space-y-0.5">
                  <label className="text-[9px] uppercase tracking-widest text-on-surface-variant font-bold px-1">Price ($)</label>
                  <input
                    type="number"
                    className="w-full px-2.5 py-2 rounded-lg bg-background border border-white/5 text-on-surface focus:outline-none focus:border-[var(--blue)] transition-all text-xs"
                    value={productForm.price ?? ''}
                    onChange={(e) => setProductForm({ ...productForm, price: e.target.value })}
                  />
                </div>
                <div className="space-y-0.5">
                  <label className="text-[9px] uppercase tracking-widest text-on-surface-variant font-bold px-1">APY (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="w-full px-2.5 py-2 rounded-lg bg-background border border-white/5 text-on-surface focus:outline-none focus:border-[var(--blue)] transition-all text-xs"
                    value={productForm.apy ?? ''}
                    onChange={(e) => setProductForm({ ...productForm, apy: e.target.value })}
                  />
                </div>
                <div className="space-y-0.5">
                  <label className="text-[9px] uppercase tracking-widest text-on-surface-variant font-bold px-1">Duration (Days)</label>
                  <input
                    type="number"
                    className="w-full px-2.5 py-2 rounded-lg bg-background border border-white/5 text-on-surface focus:outline-none focus:border-[var(--blue)] transition-all text-xs"
                    value={productForm.duration_days ?? ''}
                    onChange={(e) => setProductForm({ ...productForm, duration_days: e.target.value })}
                  />
                </div>
                <div className="space-y-0.5">
                  <label className="text-[9px] uppercase tracking-widest text-on-surface-variant font-bold px-1">Image URL</label>
                  <div className="flex gap-1">
                    <input
                      type="text"
                      className="flex-1 px-2.5 py-2 rounded-lg bg-background border border-white/5 text-on-surface focus:outline-none focus:border-[var(--blue)] transition-all text-xs"
                      value={productForm.image_url ?? ''}
                      onChange={(e) => setProductForm({ ...productForm, image_url: e.target.value })}
                      placeholder="https://..."
                    />
                    <button
                      onClick={() => productImageInputRef.current?.click()}
                      disabled={uploadingProductImage}
                      className="px-2 rounded-lg bg-white/5 border border-white/10 text-on-surface-variant hover:text-[var(--blue)] transition-all flex items-center justify-center"
                    >
                      {uploadingProductImage ? (
                        <div className="w-3 h-3 border-2 border-[var(--blue)] border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        <span className="material-symbols-outlined text-sm">upload</span>
                      )}
                    </button>
                  </div>
                  <input
                    type="file"
                    ref={productImageInputRef}
                    onChange={uploadProductImage}
                    accept="image/*"
                    className="hidden"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                onClick={() => { setIsAddingProduct(false); setEditingProduct(null); }}
                className="py-2.5 rounded-lg bg-white/5 text-white font-bold text-[9px] uppercase tracking-widest"
              >
                Cancel
              </button>
              <button
                onClick={() => handleProductAction(isAddingProduct ? 'add' : 'edit')}
                disabled={!!processingId}
                className="py-2.5 rounded-lg btn-primary text-[9px] uppercase tracking-widest shadow-lg"
              >
                {processingId ? 'Saving...' : 'Save Product'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
      {/* Social Task Modal */}
      {(isAddingSocialTask || editingSocialTask) && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="w-full max-w-md glass-card premium-border rounded-[32px] p-6 space-y-6"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-black text-white">
                {isAddingSocialTask ? 'Add Social Task' : 'Edit Social Task'}
              </h3>
              <button
                onClick={() => { setIsAddingSocialTask(false); setEditingSocialTask(null); }}
                className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-on-surface-variant hover:text-white transition-all"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[9px] uppercase tracking-widest text-on-surface-variant font-black px-1">Platform</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['telegram', 'twitter', 'youtube', 'facebook', 'instagram', 'other'] as const).map((p) => (
                    <button
                      key={p}
                      onClick={() => setSocialTaskForm({ ...socialTaskForm, platform: p })}
                      className={`py-2 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all border ${
                        socialTaskForm.platform === p 
                          ? 'bg-[var(--blue)] text-white border-[var(--blue)]' 
                          : 'bg-white/5 text-on-surface-variant border-white/5'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] uppercase tracking-widest text-on-surface-variant font-black px-1">Task Title</label>
                <input
                  type="text"
                  className="w-full px-4 py-3 rounded-2xl bg-background border border-white/5 text-on-surface focus:outline-none focus:border-[var(--blue)] transition-all text-xs"
                  value={socialTaskForm.title}
                  onChange={(e) => setSocialTaskForm({ ...socialTaskForm, title: e.target.value })}
                  placeholder="e.g. Follow us on Twitter"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] uppercase tracking-widest text-on-surface-variant font-black px-1">Description</label>
                <textarea
                  className="w-full px-4 py-3 rounded-2xl bg-background border border-white/5 text-on-surface focus:outline-none focus:border-[var(--blue)] transition-all h-20 resize-none text-xs"
                  value={socialTaskForm.description}
                  onChange={(e) => setSocialTaskForm({ ...socialTaskForm, description: e.target.value })}
                  placeholder="What should the user do?"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] uppercase tracking-widest text-on-surface-variant font-black px-1">Reward ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="w-full px-4 py-3 rounded-2xl bg-background border border-white/5 text-on-surface focus:outline-none focus:border-[var(--blue)] transition-all text-xs"
                    value={socialTaskForm.reward_amount}
                    onChange={(e) => setSocialTaskForm({ ...socialTaskForm, reward_amount: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] uppercase tracking-widest text-on-surface-variant font-black px-1">Status</label>
                  <button
                    onClick={() => setSocialTaskForm({ ...socialTaskForm, is_active: !socialTaskForm.is_active })}
                    className={`w-full py-3 rounded-2xl font-black text-[9px] uppercase tracking-widest border transition-all ${
                      socialTaskForm.is_active 
                        ? 'bg-green-500/10 text-green-500 border-green-500/20' 
                        : 'bg-red-500/10 text-red-500 border-red-500/20'
                    }`}
                  >
                    {socialTaskForm.is_active ? 'Active' : 'Inactive'}
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] uppercase tracking-widest text-on-surface-variant font-black px-1">Task Link</label>
                <input
                  type="text"
                  className="w-full px-4 py-3 rounded-2xl bg-background border border-white/5 text-on-surface focus:outline-none focus:border-[var(--blue)] transition-all text-xs"
                  value={socialTaskForm.link}
                  onChange={(e) => setSocialTaskForm({ ...socialTaskForm, link: e.target.value })}
                  placeholder="https://..."
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => { setIsAddingSocialTask(false); setEditingSocialTask(null); }}
                className="py-3.5 rounded-2xl bg-white/5 text-white font-bold text-[10px] uppercase tracking-widest"
              >
                Cancel
              </button>
              <button
                onClick={() => handleSocialTaskAction(isAddingSocialTask ? 'add' : 'edit', editingSocialTask || undefined)}
                disabled={!!processingId}
                className="py-3.5 rounded-2xl btn-primary text-[10px] uppercase tracking-widest shadow-lg"
              >
                {processingId ? 'Saving...' : 'Save Task'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};
