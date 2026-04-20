import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { UserDashboard, Product, Reserve as ReserveType, SocialTask, UserSocialTask } from '../types';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

const formatTime = (ms: number) => {
  const seconds = Math.floor(ms / 1000);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

// Premium NFT Images Mapping
const NFT_IMAGES: Record<string, string> = {
  'tier1': 'https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?q=80&w=400&auto=format&fit=crop',
  'tier2': 'https://images.unsplash.com/photo-1643101809754-43a91784611a?q=80&w=400&auto=format&fit=crop',
  'tier3': 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=400&auto=format&fit=crop',
  'tier4': 'https://images.unsplash.com/photo-1634117622592-114e3024ff27?q=80&w=400&auto=format&fit=crop',
  'tier5': 'https://images.unsplash.com/photo-1633167606207-d840b5070fc2?q=80&w=400&auto=format&fit=crop',
  'diamond': 'https://images.unsplash.com/photo-1551334787-21e6bd3ab135?q=80&w=400&auto=format&fit=crop',
  'crystal': 'https://images.unsplash.com/photo-1569003339405-ea396a5a8a90?q=80&w=400&auto=format&fit=crop',
  'rare_diamond': 'https://images.unsplash.com/photo-1615111784767-4d7c419f35a0?q=80&w=400&auto=format&fit=crop',
  'default': 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?q=80&w=400&auto=format&fit=crop'
};

const getProductImage = (product: any) => {
  if (product.image_url) return product.image_url;
  const name = product.name.toLowerCase();
  if (name.includes('rare diamond')) return NFT_IMAGES.rare_diamond;
  if (name.includes('diamond')) return NFT_IMAGES.diamond;
  if (name.includes('crystal')) return NFT_IMAGES.crystal;
  
  const price = product.price;
  if (price <= 100) return NFT_IMAGES.tier1;
  if (price <= 500) return NFT_IMAGES.tier2;
  if (price <= 1000) return NFT_IMAGES.tier3;
  if (price <= 5000) return NFT_IMAGES.tier4;
  return NFT_IMAGES.tier5;
};

// Fallback Stake Products for VIP 2-5
const FALLBACK_STAKE_PRODUCTS: Product[] = [
  {
    id: 'stake-vip2',
    name: 'Crystal Node',
    description: 'High-yield crystal energy node for VIP 2 users.',
    price: 100,
    apy: 15,
    duration_days: 7,
    image_url: '',
    type: 'stake',
    min_vip_level: 2
  },
  {
    id: 'stake-vip3',
    name: 'Diamond Core',
    description: 'Advanced diamond core processing for VIP 3 users.',
    price: 500,
    apy: 25,
    duration_days: 14,
    image_url: '',
    type: 'stake',
    min_vip_level: 3
  },
  {
    id: 'stake-vip4',
    name: 'Rare Diamond Vault',
    description: 'Exclusive rare diamond vault for VIP 4 users.',
    price: 2000,
    apy: 45,
    duration_days: 30,
    image_url: '',
    type: 'stake',
    min_vip_level: 4
  },
  {
    id: 'stake-vip5',
    name: 'Eternal Diamond Matrix',
    description: 'The ultimate staking matrix for VIP 5 elite users.',
    price: 10000,
    apy: 85,
    duration_days: 90,
    image_url: '',
    type: 'stake',
    min_vip_level: 5
  }
];

export const Reserve = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'today' | 'stake' | 'task' | 'collection'>('stake');
  const [dashboard, setDashboard] = useState<UserDashboard | null>(null);
  const [activeReserve, setActiveReserve] = useState<any | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [vipLevel, setVipLevel] = useState(1);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [matching, setMatching] = useState(false);
  const [matchedProduct, setMatchedProduct] = useState<Product | null>(null);
  const [showProfit, setShowProfit] = useState<{ amount: number } | null>(null);
  const [lastReserve, setLastReserve] = useState<ReserveType | null>(null);
  const [socialTasks, setSocialTasks] = useState<SocialTask[]>([]);
  const [userSocialTasks, setUserSocialTasks] = useState<UserSocialTask[]>([]);
  const [claimingTaskId, setClaimingTaskId] = useState<string | null>(null);
  const [submittingUsername, setSubmittingUsername] = useState<string | null>(null);
  const [usernameInput, setUsernameInput] = useState('');
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  // Auto-select product based on balance for Stake tab
  useEffect(() => {
    if (!loading && products.length > 0 && dashboard && !activeReserve) {
      const balance = dashboard.available_balance || 0;
      const stakeProducts = products.filter(p => p.type === 'stake');
      const affordableProducts = [...stakeProducts]
        .filter(p => p.price <= balance)
        .sort((a, b) => b.price - a.price);
      
      if (affordableProducts.length > 0) {
        setSelectedProduct(affordableProducts[0]);
      } else if (stakeProducts.length > 0) {
        // If none affordable, show the cheapest one
        setSelectedProduct(stakeProducts[0]);
      }
    }
  }, [dashboard?.available_balance, products, activeReserve, loading]);

  const handleStartMatching = () => {
    if (!dashboard || dashboard.available_balance < 50) {
      toast.error('Minimum balance of $50 required for tasks');
      return;
    }
    
    setMatching(true);
    setMatchedProduct(null);
    
    // Simulate matching process
    setTimeout(() => {
      const balance = dashboard.available_balance;
      const taskProducts = products.filter(p => p.type === 'task');
      
      // Find a product that is slightly less than the balance (e.g. balance - random(0.30, 1.00))
      // But for now, we pick the highest priced product that is <= balance - 0.30
      const affordableTasks = [...taskProducts]
        .filter(p => p.price >= 50 && p.price <= balance - 0.30)
        .sort((a, b) => b.price - a.price);
      
      if (affordableTasks.length > 0) {
        setMatchedProduct(affordableTasks[0]);
      } else {
        toast.error('No affordable task found (Min $50)');
      }
      setMatching(false);
    }, 2000);
  };

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const fetchData = async () => {
    if (!user) return;
    try {
      const [dashRes, reservesRes, productsRes, lastReserveRes, socialTasksRes, userSocialTasksRes] = await Promise.all([
        supabase.rpc('get_user_dashboard', { p_user_id: user.id }),
        supabase.from('reserves').select('*, products(*)').eq('user_id', user.id).eq('status', 'active').limit(1),
        supabase.from('products').select('*').order('price', { ascending: true }),
        supabase.from('reserves').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1),
        supabase.from('social_tasks').select('*').eq('is_active', true).order('created_at', { ascending: false }),
        supabase.from('user_social_tasks').select('*').eq('user_id', user.id)
      ]);
      
      if (dashRes.error) {
        if (dashRes.error.message.includes('JWT expired')) {
          supabase.auth.signOut();
          return;
        }
        throw dashRes.error;
      }
      
      const dashboardData = dashRes.data;
      setDashboard(dashboardData);
      
      const profileRes = await supabase.from('profiles').select('vip_level').eq('id', user.id).maybeSingle();
      if (profileRes.data) {
        setVipLevel(profileRes.data.vip_level);
      } else if (dashboardData) {
        // Fallback calculation if profile fetch fails
        const balance = dashboardData.total_balance;
        if (balance >= 5001) setVipLevel(5);
        else if (balance >= 2001) setVipLevel(4);
        else if (balance >= 501) setVipLevel(3);
        else if (balance >= 101) setVipLevel(2);
        else setVipLevel(1);
      }
      
      const active = reservesRes.data?.[0] || null;
      setActiveReserve(active);
      
      const allProducts = (productsRes.data || []).map(p => ({
        ...p,
        type: p.type || (p.duration_days > 1 ? 'stake' : 'task'),
        min_vip_level: p.min_vip_level || 1
      })) as Product[];

      // Merge with fallback stake products if they don't exist in DB
      const mergedProducts = [...allProducts];
      FALLBACK_STAKE_PRODUCTS.forEach(fallback => {
        if (!mergedProducts.find(p => p.id === fallback.id)) {
          mergedProducts.push(fallback);
        }
      });

      setProducts(mergedProducts);
      
      if (active && active.products) {
        setSelectedProduct(active.products);
      }
      
      setLastReserve(lastReserveRes.data?.[0] || null);
      
      if (socialTasksRes.data) setSocialTasks(socialTasksRes.data);
      if (userSocialTasksRes.data) setUserSocialTasks(userSocialTasksRes.data);

      if (active) {
        setActiveTab('collection');
      }
    } catch (error: any) {
      console.error('Stake page error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClaimSocialTask = async (task: SocialTask) => {
    if (!user) return;
    
    // If it's a platform that requires a username, show the input first
    if (['telegram', 'twitter', 'youtube', 'instagram'].includes(task.platform)) {
      setSubmittingUsername(task.id);
      return;
    }

    await processSocialTaskClaim(task.id, null);
  };

  const processSocialTaskClaim = async (taskId: string, username: string | null) => {
    if (!user) return;
    setClaimingTaskId(taskId);
    try {
      const { error } = await supabase.rpc('claim_social_task', {
        p_user_id: user.id,
        p_task_id: taskId,
        p_username: username
      });

      if (error) throw error;

      toast.success('Task claimed successfully! Reward added to balance.');
      setSubmittingUsername(null);
      setUsernameInput('');
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to claim task');
    } finally {
      setClaimingTaskId(null);
    }
  };

  const calculateTimeLeft = () => {
    if (!activeReserve) {
      if (!lastReserve) return null;
      const lastTime = new Date(lastReserve.created_at).getTime();
      const nextTime = lastTime + 24 * 60 * 60 * 1000;
      const now = new Date().getTime();
      const diff = nextTime - now;
      return diff > 0 ? diff : null;
    }

    const availableAt = new Date(activeReserve.sell_available_at).getTime();
    const now = new Date().getTime();
    const diff = availableAt - now;

    return diff > 0 ? diff : null;
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);
    return () => clearInterval(interval);
  }, [user, activeReserve, lastReserve]);

  const handleReserve = async (prod: Product) => {
    if (!user || !dashboard) return;
    
    if (vipLevel < prod.min_vip_level) {
      toast.error(`This product requires VIP Level ${prod.min_vip_level}. Your current level is ${vipLevel}.`);
      return;
    }

    if (dashboard.available_balance < prod.price) {
      toast.error('Insufficient balance to stake this product');
      return;
    }

    setProcessing(true);
    try {
      const { error } = await supabase.rpc('reserve_product', {
        p_user_id: user.id,
        p_product_id: prod.id
      });
      if (error) throw error;
      toast.success(`Successfully staked ${prod.name}`);
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to stake product');
    } finally {
      setProcessing(false);
    }
  };

  const handleSell = async () => {
    if (!activeReserve) return;
    setProcessing(true);
    try {
      const { data, error } = await supabase.rpc('sell_product', {
        p_reserve_id: activeReserve.id
      });
      if (error) throw error;
      
      setShowProfit({ amount: data.profit || 0 });
      toast.success('Product sold successfully');
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to sell product');
    } finally {
      setProcessing(false);
    }
  };

  const isSellAvailable = () => {
    if (!activeReserve) return false;
    const now = new Date();
    const availableAt = new Date(activeReserve.sell_available_at);
    return now >= availableAt;
  };

  if (loading) {
    return (
      <div className="space-y-8 pb-10 animate-pulse">
        <div className="h-64 bg-white/5 rounded-[48px] rounded-tr-[100px] rounded-bl-[100px]"></div>
        <div className="flex justify-center">
          <div className="h-14 bg-white/5 rounded-2xl w-full max-w-lg"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="h-80 bg-white/5 rounded-[32px]"></div>
          <div className="h-80 bg-white/5 rounded-[32px]"></div>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={isMobile ? { opacity: 1 } : { opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8 pb-10"
    >
      {/* Balance Header - Now at the very top for all tabs */}
      <section className="px-4 max-w-4xl mx-auto w-full">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card rounded-[40px] p-10 space-y-10 relative overflow-hidden border-white/5"
        >
          <div className="absolute right-0 top-0 w-96 h-96 bg-emerald-400/10 blur-[120px] -mr-20 -mt-20"></div>
          <div className="absolute left-0 bottom-0 w-64 h-64 bg-blue-400/5 blur-[100px] -ml-20 -mb-20"></div>
          
          <div className="space-y-8 relative z-10">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_10px_rgba(52,211,153,0.5)]"></div>
                <p className="text-[10px] font-headline font-black uppercase tracking-[0.4em] text-slate-500">Total Portfolio Balance</p>
              </div>
              <h1 className="text-6xl font-headline font-black text-white tracking-tighter">
                <span className="text-3xl text-slate-500 mr-1">$</span>
                {Number(dashboard?.total_balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h1>
            </div>

            <div className="grid grid-cols-2 gap-8 pt-10 border-t border-white/5">
              <div className="space-y-2">
                <p className="text-[10px] font-headline font-black uppercase tracking-widest text-slate-500">Available Liquidity</p>
                <p className="text-3xl font-headline font-black text-white tracking-tight">${Number(dashboard?.available_balance || 0).toLocaleString()}</p>
              </div>
              <div className="space-y-2 border-l border-white/5 pl-8">
                <p className="text-[10px] font-headline font-black uppercase tracking-widest text-slate-500">Active Staking</p>
                <p className="text-3xl font-headline font-black text-emerald-400 tracking-tight">${(Number(dashboard?.total_balance || 0) - Number(dashboard?.available_balance || 0)).toLocaleString()}</p>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Tab Switcher */}
      <div className="px-4 max-w-2xl mx-auto w-full">
        <div className="flex p-2 bg-white/5 rounded-3xl relative glass-card border-white/5">
          {(['stake', 'task', 'collection', 'today'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "flex-1 py-4 rounded-2xl text-[10px] font-headline font-black uppercase tracking-widest transition-all relative z-10",
                activeTab === tab ? "text-emerald-950" : "text-slate-500 hover:text-white"
              )}
            >
              {tab}
              {activeTab === tab && (
                <motion.div
                  layoutId="activeReserveTab"
                  className="absolute inset-0 bg-emerald-400 rounded-2xl -z-10 shadow-[0_0_20px_rgba(52,211,153,0.3)]"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Stake Tab Content - All Stake Products */}
      {activeTab === 'stake' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 px-4 max-w-6xl mx-auto w-full">
          {products.filter(p => p.type === 'stake').sort((a, b) => a.min_vip_level - b.min_vip_level).map((product, index) => {
            const isSelected = selectedProduct?.id === product.id;
            const isLocked = vipLevel < product.min_vip_level;
            
            return (
              <motion.div 
                key={product.id} 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="relative group"
              >
                <div className={cn(
                  "glass-card rounded-[40px] p-8 space-y-8 border transition-all duration-500 relative overflow-hidden",
                  isSelected && !isLocked ? "border-emerald-400/50 bg-emerald-400/5 shadow-[0_0_40px_-10px_rgba(52,211,153,0.2)]" : "border-white/5 hover:border-white/20",
                  isLocked && "opacity-60"
                )}>
                  {isLocked && (
                    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-emerald-950/40 backdrop-blur-md">
                      <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-4 shadow-2xl">
                        <span className="material-symbols-outlined text-white/40 text-3xl">lock</span>
                      </div>
                      <p className="text-[10px] font-headline font-black uppercase tracking-[0.2em] text-white/60">VIP Level {product.min_vip_level} Required</p>
                    </div>
                  )}

                  <div className="flex justify-between items-start relative z-10">
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-2 h-2 rounded-full shadow-[0_0_10px_rgba(52,211,153,0.5)]",
                          !isLocked ? "bg-emerald-400 animate-pulse" : "bg-slate-700"
                        )}></div>
                        <p className="text-emerald-400 text-[10px] font-headline font-black uppercase tracking-[0.3em]">Stake Node</p>
                      </div>
                      <h3 className="text-2xl font-headline font-black text-white tracking-tight">{product.name}</h3>
                    </div>
                    <div className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10">
                      <span className="text-slate-500 text-[10px] font-headline font-black uppercase tracking-widest">#{product.id.slice(0, 4)}</span>
                    </div>
                  </div>

                  <div className="relative flex items-center justify-center py-4">
                    <div className="absolute inset-0 bg-emerald-400/5 blur-[60px] rounded-full"></div>
                    <div className="relative w-40 h-40 flex items-center justify-center group-hover:scale-110 transition-transform duration-700">
                      <img 
                        src={getProductImage(product)} 
                        alt={product.name} 
                        className="w-full h-full object-contain filter drop-shadow-[0_0_30px_rgba(52,211,153,0.4)]" 
                        referrerPolicy="no-referrer" 
                        loading="lazy"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 relative z-10">
                    {[
                      { label: 'Entry', value: `$${product.price.toLocaleString()}` },
                      { label: 'Yield', value: `${product.apy}%`, color: 'emerald' },
                      { label: 'Cycle', value: `${product.duration_days}D` }
                    ].map((stat) => (
                      <div key={stat.label} className="glass-card p-4 rounded-2xl text-center space-y-1 border-white/5 bg-white/5">
                        <p className="text-slate-500 text-[8px] font-headline font-black uppercase tracking-widest">{stat.label}</p>
                        <p className={cn(
                          "text-base font-headline font-black tracking-tight",
                          stat.color === 'emerald' ? "text-emerald-400" : "text-white"
                        )}>{stat.value}</p>
                      </div>
                    ))}
                  </div>

                  <motion.button
                    whileHover={!isLocked ? { scale: 1.02 } : {}}
                    whileTap={!isLocked ? { scale: 0.98 } : {}}
                    onClick={() => handleReserve(product)}
                    disabled={processing || isLocked || (dashboard?.available_balance || 0) < product.price}
                    className={cn(
                      "w-full py-5 rounded-2xl text-[10px] font-headline font-black uppercase tracking-[0.4em] transition-all relative overflow-hidden",
                      isLocked 
                        ? "bg-white/5 text-slate-700 border border-white/5 cursor-not-allowed" 
                        : "bg-emerald-400 text-emerald-950 shadow-[0_0_30px_rgba(52,211,153,0.2)]"
                    )}
                  >
                    {isLocked ? "Protocol Locked" : processing ? "Initializing..." : "Initialize Stake"}
                  </motion.button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Today Tab Content */}
      {activeTab === 'today' && (
        <div className="space-y-10 max-w-4xl mx-auto w-full px-4">
          <div className="flex items-center justify-between px-6">
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-6 bg-emerald-400 rounded-full"></div>
              <h2 className="text-xl font-headline font-black text-white tracking-tight uppercase">Daily Performance</h2>
            </div>
            <div className="px-5 py-2 rounded-full bg-white/5 border border-white/10">
              <span className="text-slate-500 text-[10px] font-headline font-black uppercase tracking-widest">{new Date().toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="glass-card p-10 rounded-[40px] space-y-6 border-white/5 relative overflow-hidden group"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-400/5 blur-[60px] -mr-10 -mt-10 group-hover:bg-emerald-400/10 transition-colors"></div>
              <div className="w-16 h-16 bg-emerald-400/10 rounded-2xl flex items-center justify-center text-emerald-400 border border-emerald-400/20 mb-4">
                <span className="material-symbols-outlined text-3xl">trending_up</span>
              </div>
              <div className="space-y-2">
                <p className="text-slate-500 text-[10px] font-headline font-black uppercase tracking-[0.3em]">Today's Realized Yield</p>
                <h3 className="text-5xl font-headline font-black text-emerald-400 tracking-tighter">
                  <span className="text-2xl mr-1">$</span>
                  {Number(dashboard?.today_profit || 0).toFixed(2)}
                </h3>
              </div>
              <div className="pt-6 border-t border-white/5">
                <p className="text-[10px] text-slate-600 font-headline font-medium uppercase tracking-widest">Performance optimized by Atmos AI</p>
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="glass-card p-10 rounded-[40px] space-y-6 border-white/5 relative overflow-hidden group"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-400/5 blur-[60px] -mr-10 -mt-10 group-hover:bg-blue-400/10 transition-colors"></div>
              <div className="w-16 h-16 bg-blue-400/10 rounded-2xl flex items-center justify-center text-blue-400 border border-blue-400/20 mb-4">
                <span className="material-symbols-outlined text-3xl">account_balance_wallet</span>
              </div>
              <div className="space-y-2">
                <p className="text-slate-500 text-[10px] font-headline font-black uppercase tracking-[0.3em]">Cumulative Protocol Earnings</p>
                <h3 className="text-5xl font-headline font-black text-white tracking-tighter">
                  <span className="text-2xl mr-1">$</span>
                  {Number(dashboard?.total_earnings || 0).toFixed(2)}
                </h3>
              </div>
              <div className="pt-6 border-t border-white/5">
                <p className="text-[10px] text-slate-600 font-headline font-medium uppercase tracking-widest">Total value extracted from matrix</p>
              </div>
            </motion.div>
          </div>

          <div className="glass-card p-10 rounded-[40px] border-white/5 relative overflow-hidden">
            <div className="flex items-center justify-between mb-8">
              <div className="space-y-1">
                <h4 className="text-lg font-headline font-black text-white tracking-tight uppercase">Network Activity</h4>
                <p className="text-[10px] text-slate-500 font-headline font-black uppercase tracking-widest">Live protocol monitoring</p>
              </div>
              <div className="flex gap-1">
                {[...Array(5)].map((_, i) => (
                  <motion.div
                    key={i}
                    animate={{ height: [10, 25, 10] }}
                    transition={{ duration: 1, repeat: Infinity, delay: i * 0.1 }}
                    className="w-1 bg-emerald-400/40 rounded-full"
                  />
                ))}
              </div>
            </div>
            <div className="space-y-4">
              {[
                { label: 'Network Latency', value: '12ms', status: 'Optimal' },
                { label: 'Node Distribution', value: 'Global', status: 'Active' },
                { label: 'Protocol Version', value: 'v2.4.0', status: 'Stable' }
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
                  <span className="text-[10px] text-slate-500 font-headline font-black uppercase tracking-widest">{item.label}</span>
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-white font-headline font-black">{item.value}</span>
                    <span className="px-2 py-0.5 rounded-md bg-emerald-400/10 text-emerald-400 text-[8px] font-headline font-black uppercase tracking-widest border border-emerald-400/20">{item.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Task Tab Content - Dynamic Matching */}
      {activeTab === 'task' && (
        <div className="space-y-10 max-w-4xl mx-auto w-full px-4">
          {activeReserve ? (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="glass-card p-12 rounded-[48px] text-center space-y-8 border-white/5 relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-emerald-400/30 to-transparent"></div>
              <div className="w-24 h-24 bg-emerald-400/10 rounded-3xl flex items-center justify-center mx-auto text-emerald-400 border border-emerald-400/20 shadow-lg">
                <span className="material-symbols-outlined text-5xl">inventory_2</span>
              </div>
              <div className="space-y-3">
                <h3 className="text-3xl font-headline font-black text-white tracking-tight">Active Operation Detected</h3>
                <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed font-headline font-medium uppercase tracking-widest">A protocol task is currently in progress. Please monitor the collection matrix for maturity.</p>
              </div>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setActiveTab('collection')}
                className="bg-emerald-400 text-emerald-950 px-12 py-5 rounded-2xl text-[11px] font-headline font-black uppercase tracking-[0.3em] shadow-[0_0_30px_rgba(52,211,153,0.2)]"
              >
                Access Collection
              </motion.button>
            </motion.div>
          ) : matching ? (
            <div className="glass-card p-24 rounded-[48px] text-center space-y-12 border-white/5 relative overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(52,211,153,0.05),transparent_70%)]"></div>
              <div className="relative z-10 space-y-10">
                <div className="relative w-40 h-40 mx-auto">
                  <motion.div 
                    animate={{ rotate: 360 }}
                    transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-0 border-2 border-dashed border-emerald-400/20 rounded-full"
                  ></motion.div>
                  <motion.div 
                    animate={{ rotate: -360 }}
                    transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-4 border border-emerald-400/40 rounded-full border-t-transparent"
                  ></motion.div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <motion.span 
                      animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="material-symbols-outlined text-5xl text-emerald-400"
                    >radar</motion.span>
                  </div>
                </div>
                <div className="space-y-4">
                  <h3 className="text-3xl font-headline font-black text-white tracking-tight uppercase">Scanning Matrix...</h3>
                  <p className="text-[10px] text-slate-500 font-headline font-black uppercase tracking-[0.4em] max-w-xs mx-auto">Analyzing global liquidity nodes for optimal task alignment.</p>
                </div>
                <div className="flex justify-center gap-3">
                  {[0, 1, 2, 3].map(i => (
                    <motion.div
                      key={i}
                      animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2 }}
                      className="w-2 h-2 bg-emerald-400 rounded-full shadow-[0_0_10px_rgba(52,211,153,0.5)]"
                    />
                  ))}
                </div>
              </div>
            </div>
          ) : matchedProduct ? (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-card rounded-[48px] p-10 space-y-10 border-white/5 relative overflow-hidden max-w-xl mx-auto"
            >
              <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-400/10 blur-[100px] -mr-20 -mt-20"></div>
              
              <div className="flex justify-between items-start relative z-10">
                <div className="space-y-2">
                  <p className="text-emerald-400 text-[10px] font-headline font-black uppercase tracking-[0.3em]">Matched Protocol Task</p>
                  <h3 className="text-3xl font-headline font-black text-white tracking-tight">{matchedProduct.name}</h3>
                </div>
                <div className="px-4 py-2 rounded-xl bg-white/5 border border-white/10">
                  <span className="text-slate-500 text-[10px] font-headline font-black uppercase tracking-widest">#{matchedProduct.id.slice(0, 4)}</span>
                </div>
              </div>

              <div className="relative flex items-center justify-center py-6">
                <div className="absolute inset-0 bg-emerald-400/5 blur-[60px] rounded-full"></div>
                <div className="relative w-48 h-48 flex items-center justify-center">
                  <img 
                    src={getProductImage(matchedProduct)} 
                    alt={matchedProduct.name} 
                    className="w-full h-full object-contain filter drop-shadow-[0_0_40px_rgba(52,211,153,0.4)]" 
                    referrerPolicy="no-referrer" 
                    loading="lazy"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 relative z-10">
                {[
                  { label: 'Entry', value: `$${matchedProduct.price.toLocaleString()}` },
                  { label: 'Yield', value: `+$${(matchedProduct.price * (matchedProduct.apy / 100)).toFixed(2)}`, color: 'emerald' },
                  { label: 'Return', value: `$${(matchedProduct.price + (matchedProduct.price * (matchedProduct.apy / 100))).toFixed(2)}`, color: 'blue' }
                ].map((stat) => (
                  <div key={stat.label} className="glass-card p-5 rounded-2xl text-center space-y-1 border-white/5 bg-white/5">
                    <p className="text-slate-500 text-[8px] font-headline font-black uppercase tracking-widest">{stat.label}</p>
                    <p className={cn(
                      "text-base font-headline font-black tracking-tight",
                      stat.color === 'emerald' ? "text-emerald-400" : 
                      stat.color === 'blue' ? "text-blue-400" : "text-white"
                    )}>{stat.value}</p>
                  </div>
                ))}
              </div>

              <div className="space-y-4 relative z-10">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleReserve(matchedProduct)}
                  disabled={processing}
                  className="w-full py-6 rounded-2xl bg-emerald-400 text-emerald-950 text-xs font-headline font-black uppercase tracking-[0.4em] shadow-[0_0_30px_rgba(52,211,153,0.2)]"
                >
                  {processing ? 'Initializing Protocol...' : 'Confirm & Execute Task'}
                </motion.button>
                <button
                  onClick={handleStartMatching}
                  disabled={processing}
                  className="w-full py-2 text-[10px] font-headline font-black uppercase tracking-widest text-slate-500 hover:text-white transition-colors"
                >
                  Recalibrate Matrix
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-card p-20 rounded-[48px] text-center space-y-10 border-white/5 max-w-xl mx-auto relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(52,211,153,0.05),transparent_70%)]"></div>
              <div className="w-28 h-28 bg-emerald-400/10 rounded-[32px] flex items-center justify-center mx-auto text-emerald-400 border border-emerald-400/20 shadow-2xl relative z-10">
                <span className="material-symbols-outlined text-6xl">rocket_launch</span>
              </div>
              <div className="space-y-4 relative z-10">
                <h3 className="text-4xl font-headline font-black text-white tracking-tight uppercase">Protocol Ready</h3>
                <p className="text-xs text-slate-500 font-headline font-black uppercase tracking-widest max-w-xs mx-auto leading-relaxed">Initialize the matching engine to identify high-yield tasks aligned with your current liquidity nodes.</p>
              </div>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleStartMatching}
                className="bg-emerald-400 text-emerald-950 px-16 py-6 rounded-2xl text-xs font-headline font-black uppercase tracking-[0.3em] shadow-[0_0_40px_rgba(52,211,153,0.3)] relative z-10"
              >
                Initialize Engine
              </motion.button>
            </motion.div>
          )}

          {/* Social Tasks Section */}
          <div className="space-y-8 pt-12">
            <div className="flex items-center justify-between px-6">
              <div className="flex items-center gap-3">
                <div className="w-1.5 h-6 bg-emerald-400 rounded-full"></div>
                <h3 className="text-xl font-headline font-black text-white tracking-tight uppercase">Social Bounty Matrix</h3>
              </div>
              <div className="px-4 py-1.5 rounded-full bg-emerald-400/10 border border-emerald-400/20">
                <span className="text-emerald-400 text-[10px] font-headline font-black uppercase tracking-widest">Bonus Yield</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {socialTasks.length > 0 ? (
                socialTasks.map((task, idx) => {
                  const isClaimed = userSocialTasks.some(ut => ut.task_id === task.id);
                  const isClaiming = claimingTaskId === task.id;
                  const isSubmitting = submittingUsername === task.id;

                  return (
                    <motion.div
                      key={task.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="glass-card p-6 rounded-[32px] border-white/5 hover:bg-white/5 transition-all group relative overflow-hidden"
                    >
                      <div className="flex items-center justify-between relative z-10">
                        <div className="flex items-center gap-5">
                          <div className={cn(
                            "w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-lg transition-transform group-hover:scale-110",
                            task.platform === 'telegram' ? 'bg-[#229ED9]' :
                            task.platform === 'twitter' ? 'bg-[#1DA1F2]' :
                            task.platform === 'youtube' ? 'bg-[#FF0000]' :
                            task.platform === 'instagram' ? 'bg-gradient-to-tr from-[#f9ce34] via-[#ee2a7b] to-[#6228d7]' :
                            'bg-emerald-400'
                          )}>
                            <span className="material-symbols-outlined text-2xl">
                              {task.platform === 'telegram' ? 'send' :
                               task.platform === 'twitter' ? 'share' :
                               task.platform === 'youtube' ? 'play_circle' :
                               task.platform === 'instagram' ? 'photo_camera' :
                               'link'}
                            </span>
                          </div>
                          <div className="space-y-1">
                            <h4 className="text-base font-headline font-black text-white leading-tight tracking-tight">{task.title}</h4>
                            <div className="flex items-center gap-3">
                              <span className="text-emerald-400 text-[10px] font-headline font-black uppercase tracking-widest">+${task.reward.toLocaleString()}</span>
                              <div className="w-1 h-1 rounded-full bg-white/10"></div>
                              <span className="text-[9px] text-slate-500 font-headline font-black uppercase tracking-widest">{task.platform}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          {isClaimed ? (
                            <div className="px-4 py-2 rounded-xl bg-emerald-400/10 border border-emerald-400/20 flex items-center gap-2">
                              <span className="material-symbols-outlined text-sm text-emerald-400">check_circle</span>
                              <span className="text-[9px] font-headline font-black text-emerald-400 uppercase tracking-widest">Claimed</span>
                            </div>
                          ) : isSubmitting ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                placeholder="Username"
                                value={usernameInput}
                                onChange={(e) => setUsernameInput(e.target.value)}
                                className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-[10px] text-white font-headline font-black placeholder:text-slate-700 focus:outline-none focus:border-emerald-400/50 w-32"
                              />
                              <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => processSocialTaskClaim(task.id, usernameInput)}
                                disabled={!usernameInput || isClaiming}
                                className="bg-emerald-400 text-emerald-950 px-4 py-2.5 rounded-xl text-[9px] font-headline font-black uppercase tracking-widest"
                              >
                                {isClaiming ? '...' : 'Submit'}
                              </motion.button>
                            </div>
                          ) : (
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => handleClaimSocialTask(task)}
                              className="bg-white/5 hover:bg-white/10 border border-white/10 px-5 py-2.5 rounded-xl text-[9px] font-headline font-black uppercase tracking-widest text-white transition-all"
                            >
                              Claim
                            </motion.button>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })
              ) : (
                <div className="glass-card p-12 rounded-[32px] text-center space-y-4 border-white/5 md:col-span-2">
                  <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mx-auto text-slate-800">
                    <span className="material-symbols-outlined text-3xl">task_alt</span>
                  </div>
                  <p className="text-xs text-slate-500 font-headline font-black uppercase tracking-widest">No active bounties detected in the matrix.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Collection Tab Content */}
      {activeTab === 'collection' && (
        <div className="space-y-10 max-w-4xl mx-auto w-full px-4">
          {activeReserve ? (
            <section className="space-y-10">
              <div className="flex items-center justify-between px-6">
                <div className="flex items-center gap-3">
                  <div className="w-1.5 h-6 bg-emerald-400 rounded-full"></div>
                  <h2 className="text-xl font-headline font-black text-white tracking-tight uppercase">Active Protocol</h2>
                </div>
                <div className="px-5 py-2 rounded-full bg-emerald-400/10 border border-emerald-400/20 flex items-center gap-3">
                  <motion.div 
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.5)]"
                  ></motion.div>
                  <span className="text-emerald-400 text-[10px] font-headline font-black uppercase tracking-widest">Processing Node</span>
                </div>
              </div>

              <div className="glass-card rounded-[56px] p-12 space-y-12 border-white/5 relative overflow-hidden flex flex-col items-center text-center">
                <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-400/5 blur-[120px] -mr-20 -mt-20"></div>
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-400/5 blur-[100px] -ml-20 -mb-20"></div>
                
                <div className="relative z-10 w-56 h-56 flex items-center justify-center">
                  <div className="absolute inset-0 border-2 border-dashed border-white/10 rounded-[64px] animate-[spin_30s_linear_infinite]"></div>
                  <div className="absolute inset-4 border border-emerald-400/20 rounded-[56px] animate-[spin_20s_linear_infinite_reverse]"></div>
                  <div className="absolute inset-8 border border-white/5 rounded-[48px] bg-emerald-400/5"></div>
                  
                  <div className="relative z-10 w-full h-full flex items-center justify-center p-8">
                    {activeReserve.products?.image_url ? (
                      <img 
                        src={activeReserve.products.image_url} 
                        alt={activeReserve.products.name} 
                        className="w-full h-full object-contain filter drop-shadow-[0_0_40px_rgba(52,211,153,0.4)]" 
                        referrerPolicy="no-referrer" 
                        loading="lazy" 
                      />
                    ) : (
                      <span className="material-symbols-outlined text-8xl text-emerald-400">layers</span>
                    )}
                  </div>
                </div>

                <div className="relative z-10 space-y-4">
                  <h3 className="text-4xl font-headline font-black text-white tracking-tight">{activeReserve.products?.name}</h3>
                  <div className="flex items-center justify-center gap-4">
                    <div className="px-4 py-1.5 rounded-xl bg-white/5 border border-white/10">
                      <span className="text-slate-500 text-[10px] font-headline font-black uppercase tracking-widest">#{activeReserve.id.slice(0, 8)}</span>
                    </div>
                    <div className="w-1.5 h-1.5 rounded-full bg-white/10"></div>
                    <p className="text-emerald-400 text-sm font-headline font-black uppercase tracking-widest">{activeReserve.products?.apy}% Yield</p>
                  </div>
                </div>

                <div className="relative z-10 w-full max-w-md space-y-10">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="glass-card p-6 rounded-3xl text-center space-y-1 border-white/5 bg-white/5">
                      <p className="text-slate-500 text-[9px] font-headline font-black uppercase tracking-widest">Initial Entry</p>
                      <p className="text-2xl font-headline font-black text-white tracking-tight">${activeReserve.amount.toLocaleString()}</p>
                    </div>
                    <div className="glass-card p-6 rounded-3xl text-center space-y-1 border-white/5 bg-white/5">
                      <p className="text-slate-500 text-[9px] font-headline font-black uppercase tracking-widest">Expected Return</p>
                      <p className="text-2xl font-headline font-black text-emerald-400 tracking-tight">${(activeReserve.amount * (1 + (activeReserve.products?.apy || 0) / 100)).toLocaleString()}</p>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="flex justify-between items-end px-2">
                      <div className="space-y-1">
                        <p className="text-slate-500 text-[10px] font-headline font-black uppercase tracking-widest">Maturity Progress</p>
                        <p className="text-emerald-400 text-xs font-headline font-black uppercase tracking-widest">
                          {timeLeft ? Math.min(100, Math.max(0, (1 - (timeLeft / (activeReserve.products?.duration_days * 24 * 60 * 60 * 1000))) * 100)).toFixed(1) : '100'}%
                        </p>
                      </div>
                      <div className="text-right space-y-1">
                        <p className="text-slate-500 text-[10px] font-headline font-black uppercase tracking-widest">Time Remaining</p>
                        <p className="text-white text-xs font-headline font-black uppercase tracking-widest">{timeLeft ? formatTime(timeLeft) : '00:00:00'}</p>
                      </div>
                    </div>
                    <div className="h-3 bg-white/5 rounded-full overflow-hidden border border-white/5 p-0.5">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${timeLeft ? Math.min(100, Math.max(0, (1 - (timeLeft / (activeReserve.products?.duration_days * 24 * 60 * 60 * 1000))) * 100)) : 100}%` }}
                        className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full shadow-[0_0_15px_rgba(52,211,153,0.5)]"
                      />
                    </div>
                  </div>

                  <motion.button
                    whileHover={isSellAvailable() ? { scale: 1.02 } : {}}
                    whileTap={isSellAvailable() ? { scale: 0.98 } : {}}
                    onClick={handleSell}
                    disabled={!isSellAvailable() || processing}
                    className={cn(
                      "w-full py-6 rounded-2xl text-xs font-headline font-black uppercase tracking-[0.5em] transition-all relative overflow-hidden",
                      isSellAvailable() 
                        ? "bg-emerald-400 text-emerald-950 shadow-[0_0_40px_rgba(52,211,153,0.3)]" 
                        : "bg-white/5 text-slate-700 border border-white/5 cursor-not-allowed"
                    )}
                  >
                    {!isSellAvailable() ? "Awaiting Maturity" : processing ? "Processing Sale..." : "Execute Liquidation"}
                  </motion.button>
                </div>
              </div>
            </section>
          ) : (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-card p-20 rounded-[48px] text-center space-y-10 border-white/5 max-w-xl mx-auto relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(52,211,153,0.05),transparent_70%)]"></div>
              <div className="w-28 h-28 bg-white/5 rounded-[32px] flex items-center justify-center mx-auto text-slate-800 border border-white/10 shadow-2xl relative z-10">
                <span className="material-symbols-outlined text-6xl">inventory_2</span>
              </div>
              <div className="space-y-4 relative z-10">
                <h3 className="text-4xl font-headline font-black text-white tracking-tight uppercase">No Active Nodes</h3>
                <p className="text-xs text-slate-500 font-headline font-black uppercase tracking-widest max-w-xs mx-auto leading-relaxed">Your collection matrix is currently empty. Initialize a stake or task to begin generating yield.</p>
              </div>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setActiveTab('stake')}
                className="bg-white/5 hover:bg-white/10 border border-white/10 text-white px-16 py-6 rounded-2xl text-xs font-headline font-black uppercase tracking-[0.3em] relative z-10 transition-all"
              >
                Browse Nodes
              </motion.button>
            </motion.div>
          )}
        </div>
      )}

      <AnimatePresence>
        {showProfit && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] flex items-center justify-center px-6 bg-[#05070A]/95 backdrop-blur-2xl"
          >
            <motion.div
              initial={{ scale: 0.9, y: 40, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              className="glass-card rounded-[64px] p-16 w-full max-w-md text-center space-y-12 border-emerald-400/20 shadow-[0_0_120px_rgba(52,211,153,0.2)] relative overflow-hidden"
            >
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
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
