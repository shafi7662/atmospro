import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Deposit, Withdrawal, Profile } from '../types';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, AreaChart, Area 
} from 'recharts';

type AdminTab = 'overview' | 'users' | 'products' | 'deposits' | 'withdrawals' | 'kyc';

export const Admin = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // User Editing
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [viewingUser, setViewingUser] = useState<Profile | null>(null);
  const [userDetails, setUserDetails] = useState<any>(null);
  
  // Product Editing
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [productForm, setProductForm] = useState({
    name: '',
    description: '',
    price: '' as string | number,
    apy: '' as string | number,
    duration_days: '' as string | number,
    image_url: ''
  });

  const [newAvailableBalance, setNewAvailableBalance] = useState<number>(0);
  const [newTotalBalance, setNewTotalBalance] = useState<number>(0);
  const [newDepositBalance, setNewDepositBalance] = useState<number>(0);
  const [newWithdrawableBalance, setNewWithdrawableBalance] = useState<number>(0);
  const [newVipLevel, setNewVipLevel] = useState<number>(1);
  const [newReferredBy, setNewReferredBy] = useState<string>('');
  const [newRole, setNewRole] = useState<'admin' | 'user'>('user');
  const [uploadingProductImage, setUploadingProductImage] = useState(false);
  const productImageInputRef = React.useRef<HTMLInputElement>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const fetchData = async () => {
    try {
      const [depositsRes, withdrawalsRes, profilesRes, productsRes] = await Promise.all([
        supabase.from('deposits').select('*').order('created_at', { ascending: false }),
        supabase.from('withdrawals').select('*').order('created_at', { ascending: false }),
        supabase.from('profiles').select('*').order('created_at', { ascending: false }),
        supabase.from('products').select('*').order('price', { ascending: true })
      ]);

      if (depositsRes.error) {
        console.error('Deposits fetch error:', depositsRes.error);
        toast.error(`Deposits: ${depositsRes.error.message}`);
      }
      if (withdrawalsRes.error) {
        console.error('Withdrawals fetch error:', withdrawalsRes.error);
        toast.error(`Withdrawals: ${withdrawalsRes.error.message}`);
      }
      if (profilesRes.error) {
        console.error('Profiles fetch error:', profilesRes.error);
        toast.error(`Profiles: ${profilesRes.error.message}`);
      }

      setDeposits(depositsRes.data || []);
      setWithdrawals(withdrawalsRes.data || []);
      setProfiles(profilesRes.data || []);
      setProducts(productsRes.data || []);
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

  const handleDepositAction = async (deposit: Deposit, status: 'approved' | 'rejected') => {
    setProcessingId(deposit.id);
    try {
      if (status === 'approved') {
        const { error } = await supabase.rpc('approve_deposit', {
          p_deposit_id: deposit.id
        });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('deposits')
          .update({ status: 'rejected' })
          .eq('id', deposit.id);
        if (error) throw error;
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
      } else {
        const { error } = await supabase.rpc('reject_withdraw', {
          p_withdraw_id: withdrawal.id
        });
        if (error) throw error;
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
          duration_days: Number(productForm.duration_days)
        }]);
        if (error) throw error;
        toast.success('Product added');
        setIsAddingProduct(false);
      } else if (action === 'edit') {
        const { error } = await supabase.from('products').update({
          ...productForm,
          price: Number(productForm.price),
          apy: Number(productForm.apy),
          duration_days: Number(productForm.duration_days)
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
    <div className="space-y-8 pb-20">
      <header className="space-y-2 border-l-4 border-[var(--blue)] pl-6 py-2 cv-auto" style={{ containIntrinsicSize: '0 100px' }}>
        <div className="flex items-center gap-2 text-[var(--blue)] mb-1">
          <span className="material-symbols-outlined text-sm">security</span>
          <span className="text-[10px] font-bold uppercase tracking-[0.3em]">Secure Command Center</span>
        </div>
        <h1 className="text-4xl font-black text-on-surface tracking-tight">Admin Terminal</h1>
        <p className="text-on-surface-variant text-sm">Full access administrative control and asset management.</p>
      </header>

      {/* Navigation Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar cv-auto" style={{ containIntrinsicSize: '0 50px' }}>
        {(['overview', 'users', 'kyc', 'products', 'deposits', 'withdrawals'] as AdminTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-6 py-3 rounded-2xl font-bold text-[10px] uppercase tracking-widest transition-all whitespace-nowrap ${
              activeTab === tab 
                ? 'bg-[var(--blue)] text-white shadow-[0_0_20px_rgba(59,130,246,0.2)]' 
                : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-highest'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'overview' && (
          <div
            key="overview"
            className="space-y-6 cv-auto"
            style={{ containIntrinsicSize: '0 600px' }}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 cv-auto" style={{ containIntrinsicSize: '0 200px' }}>
              <div className={`premium-card premium-border p-6 rounded-[32px] ${!isMobile ? 'rainbow-glow' : ''}`}>
                <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-1">Total Users</p>
                <p className="text-3xl font-black text-white">{stats.totalUsers.toString().padStart(2, '0')}</p>
              </div>
              <div className={`premium-card premium-border p-6 rounded-[32px] ${!isMobile ? 'rainbow-glow' : ''}`}>
                <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-1">Total Balance</p>
                <p className="text-3xl font-black text-[var(--blue)]">${stats.totalBalance.toLocaleString()}</p>
              </div>
              <div className={`premium-card premium-border p-6 rounded-[32px] sm:col-span-2 lg:col-span-1 ${!isMobile ? 'rainbow-glow' : ''}`}>
                <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-1">Pending Tasks</p>
                <p className="text-3xl font-black text-[var(--purple)]">{(stats.pendingDeposits + stats.pendingWithdrawals).toString().padStart(2, '0')}</p>
              </div>
            </div>

            <div className="glass-card premium-border p-8 rounded-[32px] h-[300px] cv-auto" style={{ containIntrinsicSize: '0 300px' }}>
              <h3 className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-6">Financial Overview</h3>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                  <XAxis 
                    dataKey="name" 
                    stroke="#9CA3AF" 
                    fontSize={10} 
                    tickLine={false} 
                    axisLine={false}
                  />
                  <YAxis 
                    stroke="#9CA3AF" 
                    fontSize={10} 
                    tickLine={false} 
                    axisLine={false}
                    tickFormatter={(value) => `$${value}`}
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1A1D24', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px' }}
                    itemStyle={{ color: '#3B82F6' }}
                  />
                  <Bar dataKey="value" fill="#3B82F6" radius={[8, 8, 0, 0]} barSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div
            key="users"
            className="space-y-6 cv-auto"
            style={{ containIntrinsicSize: '0 800px' }}
          >
            <div className="relative">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant">search</span>
              <input
                type="text"
                placeholder="Search by email or ID..."
                className="w-full pl-12 pr-6 py-4 rounded-2xl bg-surface-container border border-white/5 text-on-surface focus:outline-none focus:border-primary-container transition-all"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="space-y-4">
              {filteredProfiles.map((profile) => (
                <div key={profile.id} className="glass-card premium-border rounded-[32px] p-6 space-y-4">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-surface-container flex items-center justify-center text-[var(--blue)] border border-white/5">
                        <span className="material-symbols-outlined">person</span>
                      </div>
                      <div>
                        <p className="text-on-surface font-bold">{profile.email}</p>
                        <p className="text-[10px] text-on-surface-variant font-mono opacity-60">{profile.id}</p>
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                      profile.role === 'admin' ? 'bg-[var(--blue)]/10 text-[var(--blue)] border-[var(--blue)]/20' : 'bg-surface-container text-on-surface-variant border-white/5'
                    }`}>
                      {profile.role}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 bg-surface-container/40 p-4 rounded-2xl border border-white/5">
                    <div>
                      <span className="text-[9px] uppercase font-black text-on-surface-variant tracking-widest block mb-1">Available</span>
                      <span className="text-lg font-black text-on-surface">${profile.available_balance?.toLocaleString() || '0'}</span>
                    </div>
                    <div>
                      <span className="text-[9px] uppercase font-black text-on-surface-variant tracking-widest block mb-1">Total Balance</span>
                      <span className="text-lg font-black text-on-surface">${profile.total_balance?.toLocaleString() || '0'}</span>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button 
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
                      className="flex-1 py-3 rounded-xl bg-surface-container/50 hover:bg-surface-container text-on-surface text-[10px] font-bold uppercase tracking-widest transition-all"
                    >
                      Adjust Balance
                    </button>
                    <button 
                      onClick={() => handleViewUser(profile)}
                      className="px-4 py-3 rounded-xl bg-surface-container/50 hover:bg-surface-container text-on-surface transition-all"
                    >
                      <span className="material-symbols-outlined text-sm">visibility</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'products' && (
          <div
            key="products"
            className="space-y-6 cv-auto"
            style={{ containIntrinsicSize: '0 600px' }}
          >
            <button 
              onClick={() => {
                setProductForm({ name: '', description: '', price: 0, apy: 0, duration_days: 1, image_url: '' });
                setIsAddingProduct(true);
              }}
              className="w-full py-4 rounded-2xl btn-primary text-xs uppercase tracking-widest shadow-lg"
            >
              Add New Product
            </button>

            <div className="grid grid-cols-1 gap-4 cv-auto" style={{ containIntrinsicSize: '0 400px' }}>
              {products.map((product) => (
                <div key={product.id} className="glass-card premium-border rounded-[32px] p-6 space-y-4">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-surface-container flex items-center justify-center text-[var(--blue)] border border-white/5 overflow-hidden">
                        <img src={product.image_url || 'https://picsum.photos/seed/node/100/100'} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" loading="lazy" />
                      </div>
                      <div>
                        <p className="text-on-surface font-bold">{product.name}</p>
                        <p className="text-[10px] text-on-surface-variant uppercase tracking-widest">{product.duration_days} Days @ {product.apy}% APY</p>
                      </div>
                    </div>
                    <p className="text-xl font-black text-[var(--blue)]">${product.price}</p>
                  </div>
                  
                  <p className="text-xs text-on-surface-variant line-clamp-2">{product.description}</p>

                  <div className="flex gap-3">
                    <button 
                      onClick={() => {
                        setEditingProduct(product);
                        setProductForm({ ...product });
                      }}
                      className="flex-1 py-3 rounded-xl bg-surface-container/50 hover:bg-surface-container text-on-surface text-[10px] font-bold uppercase tracking-widest transition-all"
                    >
                      Edit Product
                    </button>
                    <button 
                      onClick={() => handleProductAction('delete', product)}
                      className="px-4 py-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-500 transition-all"
                    >
                      <span className="material-symbols-outlined text-sm">delete</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'deposits' && (
          <div
            key="deposits"
            className="space-y-4 cv-auto"
            style={{ containIntrinsicSize: '0 600px' }}
          >
            {deposits.map((dep) => (
              <div key={dep.id} className="glass-card premium-border rounded-[32px] p-6 space-y-6 relative overflow-hidden group">
                {dep.status === 'pending' && (
                  <div className="absolute top-0 right-0 w-1 h-full bg-[var(--blue)] animate-pulse"></div>
                )}
                
                <div className="flex justify-between items-start">
                  <div className="space-y-4 w-full">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-surface-container flex items-center justify-center text-[var(--blue)] border border-white/5">
                        <span className="material-symbols-outlined">payments</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="px-2 py-0.5 rounded-full bg-[var(--blue)]/10 text-[var(--blue)] text-[9px] font-black uppercase tracking-widest border border-[var(--blue)]/20">
                            {dep.network}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                            dep.status === 'pending' ? 'bg-surface-container text-on-surface-variant border-white/5' :
                            dep.status === 'approved' ? 'bg-[var(--blue)]/10 text-[var(--blue)] border-[var(--blue)]/20' :
                            'bg-red-500/10 text-red-500 border-red-500/20'
                          }`}>
                            {dep.status}
                          </span>
                        </div>
                        <p className="text-2xl font-black text-on-surface tracking-tighter">${dep.amount.toLocaleString()}</p>
                      </div>
                    </div>

                    <div className="space-y-2 bg-surface-container/40 p-4 rounded-2xl border border-white/5">
                      <div className="flex flex-col">
                        <span className="text-[9px] uppercase font-black text-on-surface-variant tracking-widest mb-1">Transaction Hash</span>
                        <span className="font-mono text-[10px] text-on-surface break-all opacity-80">{dep.txid}</span>
                      </div>
                      <div className="h-px bg-white/5 w-full"></div>
                      <div className="flex justify-between items-center">
                        <div className="flex flex-col">
                          <span className="text-[9px] uppercase font-black text-on-surface-variant tracking-widest mb-1">User Identifier</span>
                          <span className="text-[10px] text-on-surface opacity-80">{dep.user_id}</span>
                        </div>
                        <div className="text-right flex flex-col">
                          <span className="text-[9px] uppercase font-black text-on-surface-variant tracking-widest mb-1">Timestamp</span>
                          <span className="text-[10px] text-on-surface opacity-80">{new Date(dep.created_at).toLocaleTimeString()}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {dep.status === 'pending' && (
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={() => handleDepositAction(dep, 'approved')}
                      disabled={!!processingId}
                      className="py-4 rounded-2xl btn-primary text-[10px] uppercase tracking-[0.2em] active:scale-95 transition-all disabled:opacity-50 shadow-lg"
                    >
                      {processingId === dep.id ? 'Verifying...' : 'Authorize'}
                    </button>
                    <button
                      onClick={() => handleDepositAction(dep, 'rejected')}
                      disabled={!!processingId}
                      className="py-4 rounded-2xl border border-red-500/30 text-red-500 font-black text-[10px] uppercase tracking-[0.2em] active:scale-95 transition-all disabled:opacity-50 hover:bg-red-500/5"
                    >
                      Deny
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {activeTab === 'kyc' && (
          <div
            key="kyc"
            className="space-y-4 cv-auto"
            style={{ containIntrinsicSize: '0 600px' }}
          >
            <div className="grid grid-cols-1 gap-4 cv-auto" style={{ containIntrinsicSize: '0 400px' }}>
              {profiles.filter(p => p.kyc_status === 'pending').length === 0 && (
                <div className="glass-card premium-border rounded-[32px] p-12 text-center space-y-4">
                  <div className="w-16 h-16 rounded-full bg-surface-container flex items-center justify-center mx-auto text-on-surface-variant/20">
                    <span className="material-symbols-outlined text-4xl">verified_user</span>
                  </div>
                  <p className="text-on-surface-variant text-xs uppercase tracking-widest font-bold">No pending KYC applications</p>
                </div>
              )}
              {profiles.filter(p => p.kyc_status === 'pending').map((profile) => (
                <div key={profile.id} className="glass-card premium-border rounded-[32px] p-6 space-y-6">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-surface-container flex items-center justify-center text-[var(--blue)] border border-white/5">
                        <span className="material-symbols-outlined">person</span>
                      </div>
                      <div>
                        <p className="text-on-surface font-bold">{profile.email}</p>
                        <p className="text-[10px] text-on-surface-variant font-mono opacity-60">{profile.id}</p>
                      </div>
                    </div>
                    <span className="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-[var(--gold)]/10 text-[var(--gold)] border border-[var(--gold)]/20">
                      Pending
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2 bg-surface-container/40 p-4 rounded-2xl border border-white/5">
                      <p className="text-[9px] uppercase font-black text-on-surface-variant tracking-widest">Document Info</p>
                      <div className="flex justify-between">
                        <span className="text-[10px] text-on-surface-variant">Type:</span>
                        <span className="text-[10px] text-on-surface font-bold uppercase">{profile.kyc_document_type}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[10px] text-on-surface-variant">Number:</span>
                        <span className="text-[10px] text-on-surface font-mono">{profile.kyc_document_number}</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="relative aspect-video rounded-2xl overflow-hidden border border-white/5 group">
                        <img 
                          src={profile.kyc_document_url || ''} 
                          alt="KYC Document" 
                          className="w-full h-full object-cover cursor-pointer hover:scale-110 transition-transform duration-500"
                          onClick={() => window.open(profile.kyc_document_url || '', '_blank')}
                          referrerPolicy="no-referrer"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                          <span className="text-[10px] font-black text-white uppercase tracking-widest">View Document</span>
                        </div>
                      </div>
                      <div className="relative aspect-video rounded-2xl overflow-hidden border border-white/5 group">
                        <img 
                          src={profile.kyc_selfie_url || ''} 
                          alt="KYC Selfie" 
                          className="w-full h-full object-cover cursor-pointer hover:scale-110 transition-transform duration-500"
                          onClick={() => window.open(profile.kyc_selfie_url || '', '_blank')}
                          referrerPolicy="no-referrer"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                          <span className="text-[10px] font-black text-white uppercase tracking-widest">View Selfie</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={() => handleKYCAction(profile.id, 'verified')}
                      disabled={!!processingId}
                      className="py-4 rounded-2xl btn-primary text-[10px] uppercase tracking-[0.2em] active:scale-95 transition-all disabled:opacity-50 shadow-lg"
                    >
                      {processingId === profile.id ? 'Verifying...' : 'Approve'}
                    </button>
                    <button
                      onClick={() => setIsRejectingKYC(profile.id)}
                      disabled={!!processingId}
                      className="py-4 rounded-2xl border border-red-500/30 text-red-500 font-black text-[10px] uppercase tracking-[0.2em] active:scale-95 transition-all disabled:opacity-50 hover:bg-red-500/5"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Rejection Modal */}
            {isRejectingKYC && (
              <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                <motion.div 
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="w-full max-w-md glass-card premium-border p-6 rounded-[32px] space-y-6 overflow-y-auto max-h-[90vh]"
                >
                  <div className="text-center space-y-2">
                    <h3 className="text-xl font-black text-white">Reject KYC</h3>
                    <p className="text-on-surface-variant text-[10px] font-bold uppercase tracking-widest">Provide a reason for rejection</p>
                  </div>
                  <textarea
                    className="w-full px-4 py-3 rounded-2xl bg-background border border-white/5 text-on-surface focus:outline-none focus:border-red-500 transition-all h-32 resize-none text-xs"
                    placeholder="e.g. Image is blurry, document expired..."
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={() => { setIsRejectingKYC(null); setRejectionReason(''); }}
                      className="py-4 rounded-2xl bg-white/5 text-white font-bold text-[10px] uppercase tracking-widest"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleKYCAction(isRejectingKYC, 'rejected', rejectionReason)}
                      disabled={!rejectionReason || !!processingId}
                      className="py-4 rounded-2xl bg-red-500 text-white font-black text-[10px] uppercase tracking-widest shadow-lg shadow-red-500/20 disabled:opacity-50"
                    >
                      {processingId ? 'Rejecting...' : 'Confirm Rejection'}
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'withdrawals' && (
          <div
            key="withdrawals"
            className="space-y-4 cv-auto"
            style={{ containIntrinsicSize: '0 600px' }}
          >
            {withdrawals.map((w) => (
              <div key={w.id} className="glass-card premium-border rounded-[32px] p-6 space-y-6 relative overflow-hidden group">
                {w.status === 'pending' && (
                  <div className="absolute top-0 right-0 w-1 h-full bg-[var(--gold)] animate-pulse"></div>
                )}
                
                <div className="flex justify-between items-start">
                  <div className="space-y-4 w-full">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-surface-container flex items-center justify-center text-[var(--gold)] border border-white/5">
                        <span className="material-symbols-outlined">outbox</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="px-2 py-0.5 rounded-full bg-[var(--gold)]/10 text-[var(--gold)] text-[9px] font-black uppercase tracking-widest border border-[var(--gold)]/20">
                            {w.network}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                            w.status === 'pending' ? 'bg-surface-container text-on-surface-variant border-white/5' :
                            w.status === 'approved' ? 'bg-[var(--gold)]/10 text-[var(--gold)] border-[var(--gold)]/20' :
                            'bg-red-500/10 text-red-500 border-red-500/20'
                          }`}>
                            {w.status}
                          </span>
                        </div>
                        <p className="text-2xl font-black text-on-surface tracking-tighter">${w.amount.toLocaleString()}</p>
                      </div>
                    </div>

                    <div className="space-y-2 bg-surface-container/40 p-4 rounded-2xl border border-white/5">
                      <div className="flex flex-col">
                        <span className="text-[9px] uppercase font-black text-on-surface-variant tracking-widest mb-1">Wallet Address</span>
                        <span className="font-mono text-[10px] text-on-surface break-all opacity-80">{w.wallet_address}</span>
                      </div>
                      <div className="h-px bg-white/5 w-full"></div>
                      <div className="flex justify-between items-center">
                        <div className="flex flex-col">
                          <span className="text-[9px] uppercase font-black text-on-surface-variant tracking-widest mb-1">User Identifier</span>
                          <span className="text-[10px] text-on-surface opacity-80">{w.user_id}</span>
                        </div>
                        <div className="text-right flex flex-col">
                          <span className="text-[9px] uppercase font-black text-on-surface-variant tracking-widest mb-1">Timestamp</span>
                          <span className="text-[10px] text-on-surface opacity-80">{new Date(w.created_at).toLocaleTimeString()}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {w.status === 'pending' && (
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={() => handleWithdrawAction(w, 'approved')}
                      disabled={!!processingId}
                      className="py-4 rounded-2xl btn-primary text-[10px] uppercase tracking-[0.2em] active:scale-95 transition-all disabled:opacity-50 shadow-lg"
                    >
                      {processingId === w.id ? 'Authorizing...' : 'Approve'}
                    </button>
                    <button
                      onClick={() => handleWithdrawAction(w, 'rejected')}
                      disabled={!!processingId}
                      className="py-4 rounded-2xl border border-red-500/30 text-red-500 font-black text-[10px] uppercase tracking-[0.2em] active:scale-95 transition-all disabled:opacity-50 hover:bg-red-500/5"
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>
            ))}
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
    </div>
  );
};
