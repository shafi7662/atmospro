import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { UserDashboard, TeamData, Profile as UserProfile } from '../types';
import { toast } from 'sonner';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';

export const My = () => {
  const { user, signOut } = useAuth();
  const [dashboard, setDashboard] = useState<UserDashboard | null>(null);
  const [teamData, setTeamData] = useState<TeamData | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
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
      <section className="flex flex-col items-center text-center space-y-5 pt-6">
        <div className="relative group">
          <div className="absolute inset-0 bg-[var(--blue)]/20 rounded-full blur-3xl group-hover:bg-[var(--blue)]/30 transition-all duration-700"></div>
          <div 
            className="relative w-28 h-28 rounded-full p-1 bg-gradient-to-tr from-[var(--blue)] via-[var(--blue)]/30 to-[var(--gold)]/30 shadow-2xl cursor-pointer overflow-hidden"
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="w-full h-full rounded-full bg-surface overflow-hidden border-2 border-surface shadow-inner relative">
              {uploading && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-10">
                  <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                </div>
              )}
              <img
                alt="User Profile"
                className={`w-full h-full object-cover transition-opacity ${uploading ? 'opacity-50' : 'opacity-100'}`}
                src={profile?.avatar_url || "https://picsum.photos/seed/user/200/200"}
                loading="lazy"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                <span className="material-symbols-outlined text-white text-xl">photo_camera</span>
              </div>
            </div>
          </div>
          <input
            type="file"
            ref={fileInputRef}
            onChange={uploadAvatar}
            accept="image/*"
            className="hidden"
          />
          <div className={`absolute -bottom-2 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-[var(--gold)] text-black font-black text-[9px] tracking-widest uppercase shadow-[0_0_15px_rgba(255,215,0,0.4)] ${!isMobile ? 'rainbow-glow' : ''}`}>
            VIP LEVEL {vipLevel}
          </div>
        </div>
        
        <div className="space-y-1">
          <h1 className="text-3xl font-black text-on-surface tracking-tighter">
            {user?.email?.split('@')[0]}
          </h1>
          <p className="text-on-surface-variant text-[10px] font-black uppercase tracking-[0.2em]">
            {user?.email}
          </p>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-container border border-line/10 mt-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--blue)] animate-pulse"></span>
            <span className="text-[var(--blue)] text-[9px] font-black uppercase tracking-[0.2em]">ID: {profile?.permanent_id || 'N/A'}</span>
          </div>
        </div>
      </section>

      {/* Wallet Summary */}
      <div className="grid grid-cols-2 gap-4 px-2 max-w-2xl mx-auto w-full">
        <div className={`premium-card rounded-[32px] p-6 relative overflow-hidden group ${!isMobile ? 'rainbow-glow' : ''}`}>
          <div className="absolute -right-4 -top-4 w-20 h-20 bg-[var(--blue)]/5 blur-2xl rounded-full group-hover:bg-[var(--blue)]/10 transition-all"></div>
          <p className="text-[9px] uppercase tracking-widest text-on-surface-variant font-black mb-1">Total Assets</p>
          <p className={`text-2xl font-black text-on-surface tracking-tight ${!isMobile ? 'rainbow-text' : ''}`}>
            ${dashboard?.total_balance?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
          </p>
        </div>

        <div className={`premium-card rounded-[32px] p-6 relative overflow-hidden group ${!isMobile ? 'rainbow-glow' : ''}`}>
          <div className="absolute -right-4 -top-4 w-20 h-20 bg-[var(--gold)]/5 blur-2xl rounded-full group-hover:bg-[var(--gold)]/10 transition-all"></div>
          <p className="text-[9px] uppercase tracking-widest text-on-surface-variant font-black mb-1">Earnings</p>
          <p className={`text-2xl font-black text-[var(--gold)] tracking-tight ${!isMobile ? 'rainbow-text' : ''}`}>
            ${dashboard?.total_earnings?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
          </p>
        </div>
      </div>

      {/* Referral Section */}
      <section className="px-2 max-w-2xl mx-auto w-full">
        <div className={`premium-card rounded-[32px] p-7 space-y-6 relative overflow-hidden ${!isMobile ? 'rainbow-glow' : ''}`}>
          <div className="absolute right-0 top-0 w-32 h-32 bg-gradient-to-bl from-[var(--blue)]/10 to-transparent blur-3xl"></div>
          
          <div className="flex items-center justify-between relative z-10">
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-[0.3em] text-on-surface-variant font-black">Referral Code</p>
              <p className={`text-2xl md:text-3xl font-black text-on-surface tracking-[0.2em] font-mono ${!isMobile ? 'rainbow-text' : ''}`}>
                {profile?.referral_code || 'N/A'}
              </p>
            </div>
            <button
              onClick={copyReferral}
              className={`w-14 h-14 rounded-2xl bg-[var(--blue)]/10 flex items-center justify-center text-[var(--blue)] border border-[var(--blue)]/20 hover:bg-[var(--blue)]/20 transition-all active:scale-90 ${!isMobile ? 'rainbow-glow' : ''}`}
            >
              <span className="material-symbols-outlined text-2xl">content_copy</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-8 pt-6 border-t border-line/10 relative z-10">
            <div className="space-y-1">
              <p className="text-[9px] uppercase tracking-widest text-on-surface-variant font-black">Team Members</p>
              <p className="text-2xl font-black text-on-surface">
                {(teamData?.direct_members || 0) + (teamData?.indirect_members || 0)}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-[9px] uppercase tracking-widest text-on-surface-variant font-black">Team Volume</p>
              <p className={`text-2xl font-black text-[var(--blue)] ${!isMobile ? 'rainbow-text' : ''}`}>
                ${teamData?.total_team_volume?.toLocaleString() || '0.00'}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Action List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 px-2 max-w-4xl mx-auto w-full cv-auto" style={{ containIntrinsicSize: '0 400px' }}>
        <button
          onClick={() => navigate('/team')}
          className={`w-full glass-card rounded-2xl p-5 flex items-center justify-between hover:translate-y-[-2px] transition-all group ${!isMobile ? 'rainbow-glow' : ''}`}
        >
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-surface-container flex items-center justify-center text-on-surface-variant/40 group-hover:text-[var(--blue)] transition-colors">
              <span className="material-symbols-outlined text-xl">group</span>
            </div>
            <span className="font-black text-[11px] uppercase tracking-widest text-on-surface">My Team</span>
          </div>
          <span className="material-symbols-outlined text-on-surface-variant/20 group-hover:translate-x-1 transition-transform">chevron_right</span>
        </button>

        <button
          onClick={copyReferral}
          className={`w-full glass-card rounded-2xl p-5 flex items-center justify-between hover:translate-y-[-2px] transition-all group ${!isMobile ? 'rainbow-glow' : ''}`}
        >
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-surface-container flex items-center justify-center text-on-surface-variant/40 group-hover:text-[var(--blue)] transition-colors">
              <span className="material-symbols-outlined text-xl">share</span>
            </div>
            <span className="font-black text-[11px] uppercase tracking-widest text-on-surface">Copy Invitation Link</span>
          </div>
          <span className="material-symbols-outlined text-on-surface-variant/20 group-hover:translate-x-1 transition-transform">content_copy</span>
        </button>

        <button
          onClick={() => navigate('/my/setting/kyc')}
          className={`w-full glass-card rounded-2xl p-5 flex items-center justify-between hover:translate-y-[-2px] transition-all group ${!isMobile ? 'rainbow-glow' : ''}`}
        >
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-surface-container flex items-center justify-center text-on-surface-variant/40 group-hover:text-[var(--blue)] transition-colors">
              <span className="material-symbols-outlined text-xl">verified_user</span>
            </div>
            <div className="text-left">
              <span className="block font-black text-[11px] uppercase tracking-widest text-on-surface">KYC Verification</span>
              <span className={`text-[8px] font-black uppercase tracking-widest ${
                profile?.kyc_status === 'verified' ? 'text-green-500' : 
                profile?.kyc_status === 'pending' ? 'text-[var(--gold)]' : 
                profile?.kyc_status === 'rejected' ? 'text-red-500' : 'text-on-surface-variant'
              }`}>
                {profile?.kyc_status || 'Unverified'}
              </span>
            </div>
          </div>
          <span className="material-symbols-outlined text-on-surface-variant/20 group-hover:translate-x-1 transition-transform">chevron_right</span>
        </button>

        <button
          onClick={() => navigate('/profile')}
          className={`w-full glass-card rounded-2xl p-5 flex items-center justify-between hover:translate-y-[-2px] transition-all group ${!isMobile ? 'rainbow-glow' : ''}`}
        >
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-surface-container flex items-center justify-center text-on-surface-variant/40 group-hover:text-[var(--blue)] transition-colors">
              <span className="material-symbols-outlined text-xl">settings</span>
            </div>
            <span className="font-black text-[11px] uppercase tracking-widest text-on-surface">Account Settings</span>
          </div>
          <span className="material-symbols-outlined text-on-surface-variant/20 group-hover:translate-x-1 transition-transform">chevron_right</span>
        </button>

        <button
          onClick={() => navigate('/assets')}
          className={`w-full glass-card rounded-2xl p-5 flex items-center justify-between hover:translate-y-[-2px] transition-all group ${!isMobile ? 'rainbow-glow' : ''}`}
        >
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-surface-container flex items-center justify-center text-on-surface-variant/40 group-hover:text-[var(--blue)] transition-colors">
              <span className="material-symbols-outlined text-xl">history</span>
            </div>
            <span className="font-black text-[11px] uppercase tracking-widest text-on-surface">Transaction History</span>
          </div>
          <span className="material-symbols-outlined text-on-surface-variant/20 group-hover:translate-x-1 transition-transform">chevron_right</span>
        </button>

        <button
          onClick={signOut}
          className={`w-full py-5 rounded-2xl flex items-center justify-center gap-3 text-red-500 font-black hover:bg-red-500/5 transition-all text-[11px] uppercase tracking-[0.3em] border border-red-500/20 md:col-span-2 ${!isMobile ? 'rainbow-glow' : ''}`}
        >
          <span className="material-symbols-outlined text-xl">logout</span>
          Logout Account
        </button>

      </div>
    </motion.div>
  );
};
