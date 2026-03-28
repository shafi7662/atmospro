import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { UserDashboard, Product, Reserve as ReserveType } from '../types';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';

// Premium NFT Images Mapping
const NFT_IMAGES: Record<string, string> = {
  'tier1': 'https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?q=80&w=400&auto=format&fit=crop',
  'tier2': 'https://images.unsplash.com/photo-1643101809754-43a91784611a?q=80&w=400&auto=format&fit=crop',
  'tier3': 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=400&auto=format&fit=crop',
  'tier4': 'https://images.unsplash.com/photo-1634117622592-114e3024ff27?q=80&w=400&auto=format&fit=crop',
  'tier5': 'https://images.unsplash.com/photo-1633167606207-d840b5070fc2?q=80&w=400&auto=format&fit=crop',
  'default': 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?q=80&w=400&auto=format&fit=crop'
};

const getProductImage = (product: any) => {
  if (product.image_url) return product.image_url;
  const price = product.price;
  if (price <= 100) return NFT_IMAGES.tier1;
  if (price <= 500) return NFT_IMAGES.tier2;
  if (price <= 1000) return NFT_IMAGES.tier3;
  if (price <= 5000) return NFT_IMAGES.tier4;
  return NFT_IMAGES.tier5;
};

export const Reserve = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'today' | 'stake' | 'task' | 'collection'>('stake');
  const [dashboard, setDashboard] = useState<UserDashboard | null>(null);
  const [activeReserve, setActiveReserve] = useState<any | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [showProfit, setShowProfit] = useState<{ amount: number } | null>(null);
  const [lastReserve, setLastReserve] = useState<ReserveType | null>(null);
  const [timeLeft, setTimeLeft] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const fetchData = async () => {
    if (!user) return;
    try {
      const [dashRes, reservesRes, productsRes, lastReserveRes] = await Promise.all([
        supabase.rpc('get_user_dashboard', { p_user_id: user.id }),
        supabase.from('reserves').select('*, products(*)').eq('user_id', user.id).eq('status', 'active').limit(1),
        supabase.from('products').select('*').order('price', { ascending: true }),
        supabase.from('reserves').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1)
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
      
      const active = reservesRes.data?.[0] || null;
      setActiveReserve(active);
      
      const allProducts = productsRes.data || [];
      setProducts(allProducts);
      
      // Auto-select product based on balance
      if (active && active.products) {
        setSelectedProduct(active.products);
      } else if (allProducts.length > 0) {
        const balance = dashboardData?.available_balance || 0;
        // Find the most expensive product that the user can afford
        const affordableProducts = [...allProducts]
          .filter(p => p.price <= balance)
          .sort((a, b) => b.price - a.price);
        
        if (affordableProducts.length > 0) {
          setSelectedProduct(affordableProducts[0]);
        } else {
          // If none affordable, show the cheapest one
          setSelectedProduct(allProducts[0]);
        }
      }
      
      setLastReserve(lastReserveRes.data?.[0] || null);
      
      if (active) {
        setActiveTab('collection');
      }
    } catch (error: any) {
      console.error('Stake page error:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateTimeLeft = () => {
    if (!activeReserve) {
      if (!lastReserve) return null;
      const lastTime = new Date(lastReserve.created_at).getTime();
      const nextTime = lastTime + 24 * 60 * 60 * 1000;
      const now = new Date().getTime();
      const diff = nextTime - now;
      if (diff <= 0) return null;

      const h = Math.floor(diff / (1000 * 60 * 60));
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((diff % (1000 * 60)) / 1000);
      return `${h}h ${m}m ${s}s`;
    }

    const availableAt = new Date(activeReserve.sell_available_at).getTime();
    const now = new Date().getTime();
    const diff = availableAt - now;

    if (diff <= 0) return null;

    const h = Math.floor(diff / (1000 * 60 * 60));
    const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const s = Math.floor((diff % (1000 * 60)) / 1000);
    return `${h}h ${m}m ${s}s`;
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
      <section className="space-y-4">
        <div className="relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-[#3B82F6] to-[#FFD700] rounded-[48px] rounded-tr-[100px] rounded-bl-[100px] blur opacity-10 group-hover:opacity-20 transition duration-1000"></div>
          <div className={`relative premium-card premium-border rounded-[48px] rounded-tr-[100px] rounded-bl-[100px] p-10 overflow-hidden ${!isMobile ? 'rainbow-glow' : ''}`}>
            <div className="absolute inset-0 bg-gradient-to-br from-[#3B82F6]/15 via-transparent to-[#FFD700]/10 z-0"></div>
            <img 
              src="https://picsum.photos/seed/crypto-vault/1200/600" 
              alt="Crypto Vault"
              className="absolute inset-0 w-full h-full object-cover opacity-[0.04] mix-blend-overlay z-0"
              loading="eager"
              fetchPriority="high"
              referrerPolicy="no-referrer"
            />
            
            {/* Flowing background element */}
            {!isMobile && (
              <div className="absolute inset-0 z-0 opacity-20 pointer-events-none">
                <div className="absolute top-[-50%] left-[-50%] w-[200%] h-[200%] bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.15)_0%,transparent_50%)] animate-[spin_30s_linear_infinite]"></div>
              </div>
            )}

            {/* Subtle scanline */}
            {!isMobile && (
              <div className="absolute inset-0 z-0 opacity-[0.03] pointer-events-none overflow-hidden">
                <div className="absolute inset-0 bg-[linear-gradient(0deg,transparent_0%,rgba(59,130,246,0.2)_50%,transparent_100%)] h-24 w-full animate-[scanline_12s_linear_infinite]"></div>
              </div>
            )}

            <div className="space-y-6 relative z-10">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full bg-[#3B82F6] ${!isMobile ? 'animate-ping' : ''}`}></div>
                  <p className="text-[#9CA3AF] text-[10px] font-black uppercase tracking-[0.4em]">Total Portfolio Balance</p>
                </div>
                <h1 className={`text-4xl md:text-5xl font-black text-on-surface tracking-tighter font-headline ${!isMobile ? 'rainbow-text' : ''}`}>
                  ${Number(dashboard?.total_balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </h1>
              </div>
              <div className="flex flex-wrap gap-10 pt-6 border-t border-white/10">
                <div className="space-y-1">
                  <p className="text-[#9CA3AF] text-[9px] font-black uppercase tracking-widest">Available</p>
                  <p className="text-xl font-black text-on-surface font-headline">${Number(dashboard?.available_balance || 0).toLocaleString()}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[#9CA3AF] text-[9px] font-black uppercase tracking-widest">In Stake</p>
                  <p className="text-xl font-black text-[var(--blue)] font-headline">${(Number(dashboard?.total_balance || 0) - Number(dashboard?.available_balance || 0)).toLocaleString()}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Tab Switcher - Back at the top of content area */}
      <div className="flex justify-center px-2 cv-auto" style={{ containIntrinsicSize: '0 60px' }}>
        <div className="flex gap-1 p-1 bg-surface-container rounded-2xl border border-white/5 w-full max-w-lg shadow-xl">
          {(['stake', 'task', 'collection', 'today'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all ${
                activeTab === tab
                  ? 'bg-[var(--blue)] text-white shadow-lg scale-[1.02]'
                  : 'text-on-surface-variant hover:bg-white/5'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Stake Tab Content - All Products */}
      {activeTab === 'stake' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 cv-auto" style={{ containIntrinsicSize: '0 800px' }}>
          {products.map((product, index) => (
            <div key={product.id} className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-b from-[var(--blue)]/20 to-transparent rounded-[32px] blur-xl opacity-0 group-hover:opacity-40 transition-opacity"></div>
              <div className={`relative premium-card premium-border rounded-[32px] p-6 space-y-6 overflow-hidden flex flex-col items-center ${!isMobile ? 'rainbow-glow' : ''}`}>
                <div className="absolute inset-0 bg-gradient-to-br from-[var(--blue)]/5 via-transparent to-[var(--purple)]/5 z-0"></div>
                <img 
                  src="https://picsum.photos/seed/tech-node/400/400" 
                  alt="Tech Node"
                  className="absolute inset-0 w-full h-full object-cover opacity-[0.02] mix-blend-overlay z-0"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                />
                
                {/* Product Header */}
                <div className="relative z-10 w-full flex justify-between items-start">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div className={`w-1.5 h-1.5 rounded-full bg-[var(--blue)] ${!isMobile ? 'animate-ping' : ''}`}></div>
                      <p className="text-[var(--blue)] text-[8px] font-black uppercase tracking-[0.2em]">Premium Node</p>
                      {index === products.length - 1 && (
                        <span className={`px-2 py-0.5 rounded-md bg-[#FF4444]/10 text-[#FF4444] text-[7px] font-black uppercase tracking-widest ${!isMobile ? 'animate-pulse' : ''}`}>Hot</span>
                      )}
                    </div>
                    <h3 className="text-xl font-black text-on-surface tracking-tighter leading-tight font-headline">{product.name}</h3>
                  </div>
                  <div className="px-3 py-1 rounded-full bg-white/5 border border-white/10">
                    <span className="text-on-surface-variant text-[8px] font-black uppercase tracking-widest">#{product.id.slice(0, 4)}</span>
                  </div>
                </div>

                {/* Product Image */}
                <div className="relative z-10 w-32 h-32 flex items-center justify-center">
                  {/* 4 Borders Square Frame */}
                  <div className="absolute inset-0 border border-white/10 rounded-[32px]"></div>
                  <div className="absolute inset-1.5 border border-[var(--blue)]/30 rounded-[28px]"></div>
                  <div className="absolute inset-3 border border-white/5 rounded-[24px] bg-[var(--blue)]/5"></div>
                  <div className="absolute inset-4.5 border border-[var(--blue)]/10 rounded-[20px]"></div>
                  
                  <img 
                    src={getProductImage(product)} 
                    alt={product.name} 
                    className="w-24 h-24 object-contain filter drop-shadow-2xl rounded-2xl relative z-10" 
                    referrerPolicy="no-referrer" 
                    loading="lazy"
                  />
                </div>

                {/* Product Stats */}
                <div className="relative z-10 w-full grid grid-cols-3 gap-2">
                  <div className="premium-card p-3 rounded-2xl text-center space-y-1 border-white/5 bg-white/5">
                    <p className="text-on-surface-variant text-[7px] font-black uppercase tracking-widest">Price</p>
                    <p className="text-sm font-black text-on-surface font-headline">${product.price.toLocaleString()}</p>
                  </div>
                  <div className="premium-card p-3 rounded-2xl text-center space-y-1 border-white/5 bg-white/5">
                    <p className="text-on-surface-variant text-[7px] font-black uppercase tracking-widest">APY</p>
                    <p className="text-sm font-black text-[var(--blue)] font-headline">{product.apy}%</p>
                  </div>
                  <div className="premium-card p-3 rounded-2xl text-center space-y-1 border-white/5 bg-white/5">
                    <p className="text-on-surface-variant text-[7px] font-black uppercase tracking-widest">Period</p>
                    <p className="text-sm font-black text-on-surface font-headline">24H</p>
                  </div>
                </div>

                {/* Action Button */}
                <button
                  onClick={() => {
                    setSelectedProduct(product);
                    setActiveTab('task');
                  }}
                  className={`relative z-10 w-full py-4 rounded-xl btn-primary text-[9px] font-black uppercase tracking-[0.3em] shadow-lg active:scale-95 transition-all ${!isMobile ? 'rainbow-glow' : ''}`}
                >
                  View Details & Stake
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Today Tab Content */}
      {activeTab === 'today' && (
        <div className="space-y-6 cv-auto" style={{ containIntrinsicSize: '0 200px' }}>
          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className={`premium-card p-6 rounded-[32px] space-y-2 ${!isMobile ? 'rainbow-glow' : ''}`}>
              <p className="text-on-surface-variant text-[9px] font-black uppercase tracking-widest">Today's Profit</p>
              <p className="text-2xl font-black text-[var(--blue)]">${Number(dashboard?.today_profit || 0).toFixed(2)}</p>
            </div>
            <div className={`premium-card p-6 rounded-[32px] space-y-2 ${!isMobile ? 'rainbow-glow' : ''}`}>
              <p className="text-on-surface-variant text-[9px] font-black uppercase tracking-widest">Total Earnings</p>
              <p className="text-2xl font-black text-[var(--gold)]">${Number(dashboard?.total_earnings || 0).toFixed(2)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Task Tab Content */}
      {activeTab === 'task' && (
        <div className="space-y-6 cv-auto" style={{ containIntrinsicSize: '0 500px' }}>
          {activeReserve ? (
            <div className={`premium-card p-10 rounded-[40px] text-center space-y-4 max-w-xl mx-auto ${!isMobile ? 'rainbow-glow' : ''}`}>
              <div className="w-16 h-16 bg-[var(--blue)]/10 rounded-full flex items-center justify-center mx-auto text-[var(--blue)]">
                <span className="material-symbols-outlined text-3xl">inventory_2</span>
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-black text-on-surface">Stake in Progress</h3>
                <p className="text-xs text-on-surface-variant">Your product is currently in the collection. Please wait for maturity to sell.</p>
              </div>
              <button
                onClick={() => setActiveTab('collection')}
                className="btn-secondary px-8 py-3 rounded-full text-[10px] uppercase tracking-widest font-black"
              >
                Go to Collection
              </button>
            </div>
          ) : (
            <section className="space-y-6">
              {selectedProduct && (
                <div className="relative group max-w-[400px] mx-auto">
                  {/* Premium NFT Card Background Glow */}
                  <div className="absolute -inset-1 bg-gradient-to-b from-[var(--blue)]/20 to-transparent rounded-[32px] blur-xl opacity-40"></div>
                  
                  <div className="relative premium-card premium-border rounded-[32px] p-5 space-y-5 overflow-hidden flex flex-col items-center">
                    {/* Card Header Info */}
                    <div className="w-full flex justify-between items-start px-1">
                      <div className="space-y-0.5">
                        <p className="text-[var(--blue)] text-[8px] font-black uppercase tracking-[0.2em]">Premium Asset</p>
                        <h3 className="text-lg font-black text-on-surface tracking-tighter leading-tight">{selectedProduct.name}</h3>
                      </div>
                      <div className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10">
                        <span className="text-on-surface-variant text-[8px] font-black uppercase tracking-widest">#{selectedProduct.id.slice(0, 4)}</span>
                      </div>
                    </div>

                    {/* NFT Visual Area */}
                    <div className="relative w-full aspect-square max-w-[180px] flex items-center justify-center">
                      {/* 4 Borders Square Frame */}
                      <div className="absolute inset-0 border border-white/10 rounded-[32px]"></div>
                      <div className="absolute inset-1.5 border border-[var(--blue)]/30 rounded-[28px]"></div>
                      <div className="absolute inset-3 border border-white/5 rounded-[24px] bg-[var(--blue)]/5"></div>
                      <div className="absolute inset-4.5 border border-[var(--blue)]/10 rounded-[20px]"></div>
                      
                      <div className="relative z-10 w-28 h-28 flex items-center justify-center">
                        <img 
                          src={getProductImage(selectedProduct)} 
                          alt={selectedProduct.name} 
                          className="w-full h-full object-contain filter drop-shadow-2xl rounded-2xl" 
                          referrerPolicy="no-referrer" 
                          loading="lazy"
                        />
                      </div>

                      {/* Floating Decorative Elements */}
                      <div className={`absolute top-4 right-4 w-1.5 h-1.5 bg-[var(--blue)] rounded-full ${!isMobile ? 'animate-pulse' : ''}`}></div>
                      <div className={`absolute bottom-4 left-4 w-1.5 h-1.5 bg-[var(--purple)] rounded-full ${!isMobile ? 'animate-pulse delay-700' : ''}`}></div>
                    </div>

                    {/* Stats Grid */}
                    <div className="w-full grid grid-cols-3 gap-1.5 px-1">
                      <div className="premium-card p-2.5 rounded-2xl text-center space-y-0.5 border-white/5">
                        <p className="text-on-surface-variant text-[7px] font-black uppercase tracking-widest">Price</p>
                        <p className="text-[11px] font-black text-on-surface">${selectedProduct.price.toLocaleString()}</p>
                      </div>
                      <div className="premium-card p-2.5 rounded-2xl text-center space-y-0.5 border-white/5">
                        <p className="text-on-surface-variant text-[7px] font-black uppercase tracking-widest">Yield</p>
                        <p className="text-[11px] font-black text-[var(--blue)]">{selectedProduct.apy}%</p>
                      </div>
                      <div className="premium-card p-2.5 rounded-2xl text-center space-y-0.5 border-white/5">
                        <p className="text-on-surface-variant text-[7px] font-black uppercase tracking-widest">Period</p>
                        <p className="text-[11px] font-black text-on-surface">24H</p>
                      </div>
                    </div>

                    {/* Action Area */}
                    <div className="w-full pt-1 space-y-3">
                      {timeLeft && (
                        <div className="flex items-center justify-center gap-1.5 py-2 bg-white/5 rounded-xl border border-white/5">
                          <span className={`material-symbols-outlined text-xs text-[var(--blue)] ${!isMobile ? 'animate-spin-slow' : ''}`}>history</span>
                          <span className="text-[8px] font-black uppercase tracking-widest text-on-surface-variant">Next Mint in {timeLeft}</span>
                        </div>
                      )}
                      
                      <button
                        onClick={() => handleReserve(selectedProduct)}
                        disabled={processing || !!timeLeft || (dashboard?.available_balance || 0) < selectedProduct.price}
                        className="w-full py-4 rounded-xl btn-primary text-[9px] font-black uppercase tracking-[0.3em] shadow-[0_8px_20px_rgba(59,130,246,0.2)] active:scale-95 transition-all disabled:opacity-30 disabled:grayscale disabled:cursor-not-allowed group overflow-hidden relative"
                      >
                        <span className="relative z-10">
                          {processing ? 'Processing...' : 
                           (dashboard?.available_balance || 0) < selectedProduct.price ? 'Low Funds' :
                           timeLeft ? `Locked` : 'Mint & Stake'}
                        </span>
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </section>
          )}
        </div>
      )}

      {/* Collection Tab Content */}
      {activeTab === 'collection' && (
        <div className="space-y-6 cv-auto" style={{ containIntrinsicSize: '0 600px' }}>
          {activeReserve ? (
            <section className="space-y-6">
              <div className="flex items-center justify-between px-2">
                <h2 className="text-on-surface font-black text-xl tracking-tight">Active Stake</h2>
                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-surface-container border border-white/5">
                  <div className={`w-1.5 h-1.5 rounded-full bg-[var(--blue)] ${!isMobile ? 'animate-pulse' : ''}`}></div>
                  <span className="text-on-surface-variant text-[9px] font-black uppercase tracking-widest">Processing</span>
                </div>
              </div>

              <div className="relative group max-w-2xl mx-auto">
                <div className="absolute -inset-1 bg-gradient-to-r from-[var(--blue)] to-[var(--purple)] rounded-[48px] blur opacity-10 group-hover:opacity-20 transition duration-1000"></div>
                <div className={`relative premium-card premium-border rounded-[48px] p-10 space-y-8 overflow-hidden flex flex-col items-center text-center ${!isMobile ? 'rainbow-glow' : ''}`}>
                  <div className="absolute inset-0 bg-gradient-to-br from-[var(--blue)]/10 via-transparent to-[var(--purple)]/10 z-0"></div>
                  <div className="absolute inset-0 bg-[url('https://picsum.photos/seed/active-node/800/800')] bg-cover bg-center opacity-[0.03] mix-blend-overlay z-0"></div>
                  
                  <div className="relative z-10 w-40 h-40 flex items-center justify-center">
                    {/* 4 Borders Square Frame */}
                    <div className="absolute inset-0 border border-white/10 rounded-[40px]"></div>
                    <div className="absolute inset-2 border border-[var(--blue)]/30 rounded-[36px]"></div>
                    <div className="absolute inset-4 border border-white/5 rounded-[32px] bg-[var(--blue)]/5"></div>
                    <div className="absolute inset-6 border border-[var(--blue)]/10 rounded-[28px]"></div>
                    
                    <div className="relative z-10 w-full h-full flex items-center justify-center p-4">
                      {activeReserve.products?.image_url ? (
                        <img src={activeReserve.products.image_url} alt={activeReserve.products.name} className="w-full h-full object-contain filter drop-shadow-2xl" referrerPolicy="no-referrer" loading="lazy" />
                      ) : (
                        <span className="material-symbols-outlined text-7xl text-[var(--blue)]">layers</span>
                      )}
                    </div>
                  </div>

                  <div className="relative z-10 space-y-2">
                    <h3 className="text-2xl font-black text-on-surface tracking-tight font-headline">{activeReserve.products?.name}</h3>
                    <div className="flex items-center justify-center gap-2">
                      <div className={`w-1.5 h-1.5 rounded-full bg-[var(--blue)] ${!isMobile ? 'animate-ping' : ''}`}></div>
                      <p className="text-[var(--blue)] text-[10px] font-black uppercase tracking-[0.2em]">Staked Asset Active</p>
                    </div>
                  </div>

                  <div className="relative z-10 w-full space-y-6">
                    <div className="space-y-3">
                      <div className="flex justify-between items-center px-2">
                        <span className="text-on-surface-variant text-[10px] font-black uppercase tracking-widest">
                          {isSellAvailable() ? 'Maturity Reached' : 'Processing Time'}
                        </span>
                        <span className="text-on-surface font-mono text-sm font-black">{timeLeft || '00:00:00'}</span>
                      </div>
                      <div className="h-2.5 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: isSellAvailable() ? '100%' : '65%' }}
                          className="h-full bg-gradient-to-r from-[var(--blue)] to-[var(--purple)] shadow-[0_0_15px_rgba(59,130,246,0.5)]"
                        />
                      </div>
                    </div>

                    <button
                      onClick={handleSell}
                      disabled={!isSellAvailable() || processing}
                      className={`w-full py-5 rounded-2xl font-black text-xs uppercase tracking-[0.3em] transition-all active:scale-95 ${!isMobile ? 'rainbow-glow' : ''} ${
                        isSellAvailable()
                          ? 'btn-primary shadow-xl'
                          : 'bg-white/5 text-on-surface-variant/40 border border-white/5 cursor-not-allowed'
                      }`}
                    >
                      {processing ? 'Liquidating...' : isSellAvailable() ? 'SELL ASSET' : 'PROCESSING...'}
                    </button>
                  </div>
                </div>
              </div>
            </section>
          ) : (
            <div className="glass-card p-10 rounded-[40px] text-center space-y-4">
              <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto text-on-surface-variant/30">
                <span className="material-symbols-outlined text-3xl">inventory_2</span>
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-black text-on-surface">No Active Stake</h3>
                <p className="text-xs text-on-surface-variant">You don't have any products in your collection yet.</p>
              </div>
              <button
                onClick={() => setActiveTab('task')}
                className="btn-primary px-8 py-3 rounded-full text-[10px] uppercase tracking-widest font-black"
              >
                Go to Task
              </button>
            </div>
          )}
        </div>
      )}

      <AnimatePresence>
        {showProfit && (
          <motion.div
            initial={isMobile ? { opacity: 1 } : { opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={isMobile ? { opacity: 0 } : { opacity: 0, scale: 0.9 }}
            className="fixed inset-0 z-[100] flex items-center justify-center px-6 bg-background/95 md:bg-background/80 md:backdrop-blur-sm"
          >
            <div className="glass-card rounded-[40px] p-8 w-full max-w-sm text-center space-y-6">
              <div className="w-20 h-20 bg-[var(--gold)]/10 rounded-full flex items-center justify-center mx-auto shadow-sm">
                <span className="material-symbols-outlined text-4xl text-[var(--gold)]">workspace_premium</span>
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-black text-on-surface tracking-tight">Profit Realized!</h2>
                <p className="text-on-surface-variant text-sm">Your asset has been successfully liquidated.</p>
              </div>
              <div className="text-5xl font-black text-[var(--blue)] tracking-tighter">
                +${showProfit.amount.toFixed(2)}
              </div>
              <button
                onClick={() => setShowProfit(null)}
                className={`btn-primary w-full py-4 rounded-2xl text-[10px] ${!isMobile ? 'rainbow-glow' : ''}`}
              >
                Collect Earnings
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
