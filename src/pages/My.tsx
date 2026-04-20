import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { UserDashboard, TeamData, Profile as UserProfile } from '../types';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';

export const My = () => {
  const { user, signOut, role } = useAuth();
  const [dashboard, setDashboard] = useState<UserDashboard | null>(null);
  const [teamData, setTeamData] = useState<TeamData | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showVipDetails, setShowVipDetails] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const fetchData = async () => {
    if (!user) {
      navigate('/login');
      return;
    }

    try {
      const [dashRes, teamRes, profileRes] = await Promise.all([
        supabase.rpc('get_user_dashboard', { p_user_id: user.id }),
        supabase.rpc('get_team_data', { p_user_id: user.id }),
        supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
      ]);

      if (dashRes.error) throw dashRes.error;
      setDashboard(dashRes.data);
      
      if (teamRes.data && teamRes.data.length > 0) {
        setTeamData(teamRes.data[0]);
      }

      if (profileRes.data) {
        setProfile(profileRes.data);
      }
    } catch (error: any) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load profile data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    
    const profileSubscription = supabase
      .channel('profile_changes')
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'profiles',
        filter: `id=eq.${user?.id}`
      }, () => {
        fetchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(profileSubscription);
    };
  }, [user]);

  const getVipLevel = (balance: number) => {
    if (balance >= 5001) return 5;
    if (balance >= 2001) return 4;
    if (balance >= 501) return 3;
    if (balance >= 101) return 2;
    return 1;
  };

  const vipLevel = profile ? getVipLevel(profile.total_balance) : 1;

  const uploadAvatar = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      if (!event.target.files || event.target.files.length === 0) {
        throw new Error('You must select an image to upload.');
      }

      const file = event.target.files[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `${user?.id}-${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`;

      // Try to upload to 'avatars' bucket, fallback to 'products' if needed
      let bucket = 'avatars';
      let { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filePath, file);

      if (uploadError && uploadError.message.toLowerCase().includes('bucket not found')) {
        bucket = 'products';
        const { error: fallbackError } = await supabase.storage
          .from(bucket)
          .upload(filePath, file);
        uploadError = fallbackError;
      }

      if (uploadError) {
        if (uploadError.message.toLowerCase().includes('bucket not found')) {
          throw new Error('Storage bucket not found. Please create a bucket named "avatars" or "products" in your Supabase dashboard.');
        }
        throw uploadError;
      }

      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user?.id);

      if (updateError) throw updateError;

      toast.success('Profile picture updated!');
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Error uploading avatar');
    } finally {
      setUploading(false);
    }
  };

  const copyReferral = () => {
    if (!profile?.referral_code) return;
    const link = `${window.location.origin}/signup?ref=${profile.referral_code}`;
    navigator.clipboard.writeText(link);
    toast.success('Referral link copied!');
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
        <div className="w-10 h-10 border-4 border-[var(--blue)] border-t-transparent rounded-full animate-spin"></div>
        <p className="text-on-surface-variant text-[10px] font-black uppercase tracking-widest animate-pulse">Loading Profile...</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8 pb-10"
    >
      {/* Profile Header */}
      <section className="flex flex-col items-center text-center space-y-8 pt-12 relative">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[500px] bg-blue-500/5 blur-[120px] rounded-full -z-10 animate-pulse"></div>
        
        <div className="relative group">
          {/* Enhanced Background Glow */}
          <div className="absolute inset-0 bg-blue-400/20 rounded-full blur-[100px] group-hover:bg-blue-400/30 transition-all duration-1000"></div>
          
          {/* Animated Orbiting Rings */}
          {!isMobile && (
            <>
              <div className="absolute -inset-6 rounded-full border border-dashed border-blue-400/20 animate-[spin_40s_linear_infinite] opacity-40"></div>
              <div className="absolute -inset-12 rounded-full border border-dotted border-amber-400/10 animate-[spin_60s_linear_infinite_reverse] opacity-30"></div>
            </>
          )}

          <motion.div 
            whileHover={{ scale: 1.05, rotate: 2 }}
            className="relative w-44 h-44 rounded-[48px] p-1.5 bg-gradient-to-tr from-blue-500 via-blue-400/40 to-amber-400/40 shadow-[0_0_50px_rgba(59,130,246,0.3)] cursor-pointer overflow-hidden z-10 glass-card"
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="w-full h-full rounded-[42px] bg-[#0F1115] overflow-hidden border-2 border-white/10 shadow-inner relative group-hover:border-blue-400/50 transition-colors duration-500">
              {uploading && (
                <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-20 backdrop-blur-md">
                  <div className="w-10 h-10 border-2 border-blue-400 border-t-transparent rounded-full animate-spin shadow-[0_0_15px_rgba(59,130,246,0.5)]"></div>
                </div>
              )}
              <img
                alt="User Profile"
                className={`w-full h-full object-cover transition-all duration-700 group-hover:scale-110 group-hover:rotate-2 ${uploading ? 'opacity-30' : 'opacity-100'}`}
                src={profile?.avatar_url || "https://picsum.photos/seed/user/200/200"}
                loading="lazy"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all duration-500 backdrop-blur-[4px]">
                <div className="flex flex-col items-center gap-2 transform translate-y-4 group-hover:translate-y-0 transition-transform duration-500">
                  <div className="w-12 h-12 rounded-2xl bg-blue-400/20 flex items-center justify-center border border-blue-400/30">
                    <span className="material-symbols-outlined text-white text-2xl">photo_camera</span>
                  </div>
                  <span className="text-[10px] font-black text-white uppercase tracking-[0.3em]">Update Node</span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Integrated VIP Badge on Frame */}
          <motion.div 
            whileHover={{ scale: 1.15, rotate: -5 }}
            onClick={(e) => {
              e.stopPropagation();
              setShowVipDetails(true);
            }}
            className="absolute -bottom-4 -right-4 w-18 h-18 rounded-[24px] bg-gradient-to-br from-amber-400 to-amber-600 border-[6px] border-[#0F1115] flex flex-col items-center justify-center shadow-[0_0_40px_rgba(245,158,11,0.4)] z-20 cursor-pointer group/vip hover:shadow-[0_0_60px_rgba(245,158,11,0.6)] transition-all duration-500"
          >
            <span className="text-black font-black text-[10px] leading-none uppercase tracking-tighter opacity-70">VIP</span>
            <span className="text-black font-black text-2xl leading-none drop-shadow-md">{vipLevel}</span>
            <div className="absolute inset-0 rounded-[18px] bg-white/20 opacity-0 group-hover/vip:opacity-100 transition-opacity"></div>
          </motion.div>

          <input
            type="file"
            ref={fileInputRef}
            onChange={uploadAvatar}
            accept="image/*"
            className="hidden"
          />
        </div>
        
        <div className="space-y-5 relative z-10">
          <div className="flex flex-col items-center gap-2">
            <h1 className="text-5xl font-headline font-black text-white tracking-tighter uppercase leading-none drop-shadow-[0_0_20px_rgba(255,255,255,0.1)]">
              {user?.email?.split('@')[0]}
            </h1>
            <div className="px-4 py-1.5 bg-white/5 rounded-full border border-white/10 backdrop-blur-md">
              <p className="text-slate-400 text-[11px] font-headline font-black uppercase tracking-[0.4em]">
                {user?.email}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-center gap-4">
            <div className="inline-flex items-center gap-3 px-5 py-2 rounded-2xl bg-blue-400/5 border border-blue-400/20 backdrop-blur-xl shadow-[0_0_30px_rgba(59,130,246,0.1)]">
              <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>
              <span className="text-blue-400 text-[11px] font-headline font-black uppercase tracking-[0.3em]">Node ID: {profile?.permanent_id || 'N/A'}</span>
            </div>
            
            <motion.button 
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowVipDetails(true)}
              className="px-5 py-2 rounded-2xl bg-amber-400/10 border border-amber-400/20 text-amber-400 text-[11px] font-headline font-black uppercase tracking-[0.3em] hover:bg-amber-400/20 transition-all flex items-center gap-3 shadow-[0_0_30px_rgba(245,158,11,0.1)]"
            >
              <span className="material-symbols-outlined text-base">workspace_premium</span>
              Tier {vipLevel}
            </motion.button>
          </div>
        </div>
      </section>

      {/* Wallet Summary */}
      <div className="grid grid-cols-2 gap-6 px-4 max-w-2xl mx-auto w-full">
        <motion.div 
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          whileHover={{ y: -8, scale: 1.02 }}
          className="glass-card rounded-[40px] p-8 relative overflow-hidden group border-white/5 shadow-[0_0_50px_rgba(0,0,0,0.3)]"
        >
          <div className="absolute -right-8 -top-8 w-32 h-32 bg-blue-500/10 blur-[50px] rounded-full group-hover:bg-blue-500/20 transition-all duration-700"></div>
          <div className="relative z-10 space-y-3">
            <p className="text-[11px] uppercase tracking-[0.4em] text-slate-500 font-headline font-black">Total Assets</p>
            <p className="text-4xl font-headline font-black text-white tracking-tighter drop-shadow-sm">
              <span className="text-xl mr-1 text-slate-700">$</span>
              {dashboard?.total_balance?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
            </p>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          whileHover={{ y: -8, scale: 1.02 }}
          className="glass-card rounded-[40px] p-8 relative overflow-hidden group border-white/5 shadow-[0_0_50px_rgba(0,0,0,0.3)]"
        >
          <div className="absolute -right-8 -top-8 w-32 h-32 bg-amber-500/10 blur-[50px] rounded-full group-hover:bg-amber-500/20 transition-all duration-700"></div>
          <div className="relative z-10 space-y-3">
            <p className="text-[11px] uppercase tracking-[0.4em] text-slate-500 font-headline font-black">Total Earnings</p>
            <p className="text-4xl font-headline font-black text-amber-400 tracking-tighter drop-shadow-[0_0_15px_rgba(245,158,11,0.2)]">
              <span className="text-xl mr-1 text-amber-400/30">$</span>
              {dashboard?.total_earnings?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
            </p>
          </div>
        </motion.div>
      </div>

      {/* Referral Section */}
      <section className="px-4 max-w-2xl mx-auto w-full">
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          whileHover={{ y: -10 }}
          className="glass-card rounded-[48px] p-10 space-y-10 relative overflow-hidden border-white/5 shadow-[0_0_80px_rgba(0,0,0,0.4)] group"
        >
          <div className="absolute right-0 top-0 w-80 h-80 bg-gradient-to-bl from-blue-500/10 via-transparent to-transparent blur-[120px] group-hover:from-blue-500/20 transition-all duration-1000"></div>
          
          <div className="flex items-center justify-between relative z-10">
            <div className="space-y-4">
              <p className="text-[11px] uppercase tracking-[0.5em] text-slate-500 font-headline font-black">Referral Protocol</p>
              <p className="text-4xl md:text-5xl font-headline font-black text-white tracking-[0.3em] font-mono drop-shadow-[0_0_20px_rgba(255,255,255,0.1)]">
                {profile?.referral_code || 'N/A'}
              </p>
            </div>
            <motion.button
              whileHover={{ scale: 1.1, rotate: 8 }}
              whileTap={{ scale: 0.9 }}
              onClick={copyReferral}
              className="w-20 h-20 rounded-[28px] bg-blue-500/10 flex items-center justify-center text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition-all shadow-[0_0_30px_rgba(59,130,246,0.1)] group/copy"
            >
              <span className="material-symbols-outlined text-4xl group-hover/copy:scale-110 transition-transform">content_copy</span>
            </motion.button>
          </div>

          <div className="grid grid-cols-2 gap-12 pt-10 border-t border-white/5 relative z-10">
            <div className="space-y-3 group/stat">
              <p className="text-[10px] uppercase tracking-[0.3em] text-slate-600 font-headline font-black group-hover/stat:text-white transition-colors">Alliance Members</p>
              <div className="flex items-baseline gap-3">
                <p className="text-4xl font-headline font-black text-white group-hover/stat:text-blue-400 transition-colors">
                  {(teamData?.direct_members || 0) + (teamData?.indirect_members || 0)}
                </p>
                <div className="flex items-center gap-1.5 px-2 py-0.5 bg-blue-400/10 rounded-md border border-blue-400/20">
                  <div className="w-1 h-1 rounded-full bg-blue-400 animate-pulse"></div>
                  <span className="text-[8px] font-headline font-black text-blue-400 uppercase tracking-widest">Active</span>
                </div>
              </div>
            </div>
            <div className="space-y-3 group/stat">
              <p className="text-[10px] uppercase tracking-[0.3em] text-slate-600 font-headline font-black group-hover/stat:text-white transition-colors">Alliance Volume</p>
              <p className="text-4xl font-headline font-black text-blue-400 drop-shadow-[0_0_15px_rgba(59,130,246,0.2)]">
                <span className="text-xl mr-1 text-blue-400/30">$</span>
                {teamData?.total_team_volume?.toLocaleString() || '0.00'}
              </p>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Action List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 px-4 max-w-4xl mx-auto w-full">
        {role === 'admin' && (
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            onClick={() => navigate('/admin')}
            className="w-full glass-card rounded-[40px] p-8 flex items-center justify-between transition-all group border border-blue-400/40 md:col-span-2 hover:bg-blue-400/[0.05] shadow-[0_0_40px_rgba(59,130,246,0.15)] relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
            <div className="flex items-center gap-6 relative z-10">
              <div className="w-16 h-16 rounded-[24px] bg-blue-400/10 flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform duration-500 shadow-[0_0_30px_rgba(59,130,246,0.2)]">
                <span className="material-symbols-outlined text-3xl">admin_panel_settings</span>
              </div>
              <div className="text-left space-y-1.5">
                <span className="block font-headline font-black text-lg uppercase tracking-[0.2em] text-white">Admin Terminal</span>
                <span className="block text-[10px] font-headline font-black uppercase tracking-widest text-blue-400/70">Authorized Access Only</span>
              </div>
            </div>
            <div className="flex items-center gap-3 text-blue-400/40 group-hover:text-blue-400 transition-all duration-500 relative z-10">
              <span className="text-[11px] font-headline font-black uppercase tracking-widest">Access</span>
              <span className="material-symbols-outlined group-hover:translate-x-2 transition-transform text-2xl">terminal</span>
            </div>
          </motion.button>
        )}

        {[
          { icon: 'contact_support', label: 'Support Center', path: '/support', delay: 0.5 },
          { icon: 'group', label: 'My Alliance', path: '/team', delay: 0.6 },
          { icon: 'share', label: 'Invitation Link', action: copyReferral, delay: 0.7 },
          { 
            icon: 'verified_user', 
            label: 'KYC Verification', 
            path: '/my/setting/kyc', 
            delay: 0.8,
            status: profile?.kyc_status || 'Unverified',
            statusColor: profile?.kyc_status === 'verified' ? 'text-emerald-400' : 
                         profile?.kyc_status === 'pending' ? 'text-amber-400' : 
                         profile?.kyc_status === 'rejected' ? 'text-rose-400' : 'text-slate-600'
          },
          { icon: 'settings', label: 'Account Settings', path: '/profile', delay: 0.9 },
          { icon: 'history', label: 'Transaction Logs', path: '/assets', delay: 1.0 }
        ].map((item, idx) => (
          <motion.button
            key={idx}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: item.delay }}
            onClick={item.action || (() => navigate(item.path!))}
            className="w-full glass-card rounded-[32px] p-7 flex items-center justify-between transition-all group border-white/5 hover:border-white/20 hover:bg-white/[0.03] shadow-xl relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-white/[0.01] opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <div className="flex items-center gap-6 relative z-10">
              <div className="w-16 h-16 rounded-[22px] bg-white/5 flex items-center justify-center text-slate-500 group-hover:text-blue-400 group-hover:bg-blue-400/10 transition-all duration-500 border border-white/5 group-hover:border-blue-400/20">
                <span className="material-symbols-outlined text-3xl">{item.icon}</span>
              </div>
              <div className="text-left space-y-1">
                <span className="block font-headline font-black text-sm uppercase tracking-[0.15em] text-white group-hover:text-blue-400 transition-colors">{item.label}</span>
                {item.status && (
                  <div className="flex items-center gap-2">
                    <div className={cn("w-1 h-1 rounded-full animate-pulse", item.statusColor.replace('text-', 'bg-'))}></div>
                    <span className={cn("text-[9px] font-headline font-black uppercase tracking-widest", item.statusColor)}>
                      {item.status}
                    </span>
                  </div>
                )}
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/5 group-hover:border-blue-400/20 group-hover:text-blue-400 transition-all duration-500 relative z-10">
              <span className="material-symbols-outlined text-xl group-hover:translate-x-1 transition-transform">
                {item.icon === 'share' ? 'content_copy' : 'chevron_right'}
              </span>
            </div>
          </motion.button>
        ))}

        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.1 }}
          onClick={signOut}
          className="w-full py-7 rounded-[32px] flex items-center justify-center gap-5 text-rose-400 font-headline font-black hover:bg-rose-500/10 transition-all text-sm uppercase tracking-[0.4em] border border-rose-500/20 md:col-span-2 group shadow-lg shadow-rose-500/5"
        >
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center border border-rose-500/20 group-hover:rotate-12 transition-transform duration-500">
            <span className="material-symbols-outlined text-2xl">logout</span>
          </div>
          Terminate Session
        </motion.button>
      </div>

      <AnimatePresence>
        {showVipDetails && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] flex items-center justify-center px-6 bg-black/90 backdrop-blur-xl"
          >
            <motion.div
              initial={{ scale: 0.9, y: 30 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 30 }}
              className="glass-card rounded-[56px] p-12 w-full max-w-lg border-white/10 shadow-[0_0_100px_rgba(0,0,0,0.6)] relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-transparent to-amber-500/10 z-0 animate-pulse"></div>
              
              <div className="relative z-10 space-y-10">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-6">
                    <div className="w-16 h-16 bg-amber-400/10 rounded-[24px] flex items-center justify-center text-amber-400 shadow-[0_0_30px_rgba(245,158,11,0.25)] border border-amber-400/20">
                      <span className="material-symbols-outlined text-4xl">workspace_premium</span>
                    </div>
                    <div>
                      <h2 className="text-3xl font-headline font-black text-white tracking-tight uppercase">VIP Matrix</h2>
                      <p className="text-[11px] text-slate-500 font-headline font-black uppercase tracking-[0.3em]">Tier Calibration</p>
                    </div>
                  </div>
                  <motion.button 
                    whileHover={{ scale: 1.1, rotate: 90 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setShowVipDetails(false)}
                    className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-slate-500 hover:text-white transition-colors border border-white/10"
                  >
                    <span className="material-symbols-outlined">close</span>
                  </motion.button>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {[
                    { level: 1, range: '$0 - $100', team: 'No Req.', color: '#94A3B8' },
                    { level: 2, range: '$101 - $500', team: '3 Direct', color: '#10B981' },
                    { level: 3, range: '$501 - $2,000', team: '10 Direct', color: '#3B82F6' },
                    { level: 4, range: '$2,001 - $5,000', team: '25 Direct', color: '#A855F7' },
                    { level: 5, range: '$5,001+', team: '50 Direct', color: '#F59E0B' },
                  ].map((vip) => (
                    <motion.div 
                      key={vip.level} 
                      whileHover={{ x: 10 }}
                      className={cn(
                        "flex items-center justify-between p-5 rounded-[28px] transition-all group relative overflow-hidden",
                        vipLevel === vip.level 
                          ? "bg-amber-400/10 border border-amber-400/30 shadow-[0_0_30px_rgba(245,158,11,0.1)]" 
                          : "bg-white/[0.02] border border-white/5 hover:bg-white/[0.05]"
                      )}
                    >
                      <div className="flex items-center gap-5">
                        <div className="w-12 h-12 rounded-[18px] flex items-center justify-center shadow-lg border border-white/10" style={{ backgroundColor: `${vip.color}15`, color: vip.color }}>
                          <span className="material-symbols-outlined text-2xl">workspace_premium</span>
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-sm font-headline font-black text-white uppercase tracking-widest">Level {vip.level}</span>
                          <span className="text-[10px] font-headline font-black text-slate-500 uppercase tracking-widest">{vip.team}</span>
                        </div>
                      </div>
                      <div className="text-right space-y-1">
                        <span className="text-sm font-headline font-black text-white tracking-tight">{vip.range}</span>
                        {vipLevel === vip.level && (
                          <div className="flex items-center justify-end gap-1.5">
                            <div className="w-1 h-1 rounded-full bg-amber-400 animate-pulse"></div>
                            <span className="text-[9px] font-headline font-black text-amber-400 uppercase tracking-widest">Current Node</span>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowVipDetails(false)}
                  className="w-full py-6 rounded-[28px] bg-blue-500 text-white font-headline font-black uppercase tracking-[0.4em] text-xs shadow-[0_0_40px_rgba(59,130,246,0.3)] hover:shadow-[0_0_60px_rgba(59,130,246,0.4)] transition-all"
                >
                  Confirm Matrix
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
