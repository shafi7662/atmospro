import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Profile, TeamData, UserDashboard } from '../types';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { cn } from '../lib/utils';

interface TeamMember extends Profile {
  level: number;
}

interface MemberExtraDetails {
  referralCount: number;
  totalEarnings: number;
  loading: boolean;
}

export const Team = () => {
  const { user } = useAuth();
  const [teamData, setTeamData] = useState<TeamData | null>(null);
  const [dashboard, setDashboard] = useState<UserDashboard | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [memberDetails, setMemberDetails] = useState<Record<string, MemberExtraDetails>>({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<number>(1);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const navigate = useNavigate();

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
      setLoading(true);
      
      // Fetch team summary data and dashboard data
      const [teamRes, dashRes] = await Promise.all([
        supabase.rpc('get_team_data', { p_user_id: user.id }),
        supabase.rpc('get_user_dashboard', { p_user_id: user.id })
      ]);

      if (teamRes.error) throw teamRes.error;
      if (dashRes.error) throw dashRes.error;

      if (teamRes.data && teamRes.data.length > 0) {
        setTeamData(teamRes.data[0]);
      }
      
      if (dashRes.data) {
        setDashboard(dashRes.data);
      }

      // Fetch Level 1 members
      const { data: level1, error: l1Error } = await supabase
        .from('profiles')
        .select('*')
        .eq('referred_by', user.id);
      
      if (l1Error) throw l1Error;

      const level1Members: TeamMember[] = (level1 || []).map(m => ({ ...m, level: 1 }));

      // Fetch Level 2 members
      let level2Members: TeamMember[] = [];
      if (level1Members.length > 0) {
        const level1Ids = level1Members.map(m => m.id);
        const { data: level2, error: l2Error } = await supabase
          .from('profiles')
          .select('*')
          .in('referred_by', level1Ids);
        
        if (l2Error) throw l2Error;
        level2Members = (level2 || []).map(m => ({ ...m, level: 2 }));
      }

      setMembers([...level1Members, ...level2Members]);
    } catch (error: any) {
      console.error('Error fetching team data:', error);
      toast.error('Failed to load team information');
    } finally {
      setLoading(false);
    }
  };

  const fetchMemberDetails = async (memberId: string) => {
    if (memberDetails[memberId]) return;

    setMemberDetails(prev => ({
      ...prev,
      [memberId]: { referralCount: 0, totalEarnings: 0, loading: true }
    }));

    try {
      const [referralsRes, dashRes] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('referred_by', memberId),
        supabase.rpc('get_user_dashboard', { p_user_id: memberId })
      ]);

      setMemberDetails(prev => ({
        ...prev,
        [memberId]: {
          referralCount: referralsRes.count || 0,
          totalEarnings: dashRes.data?.total_earnings || 0,
          loading: false
        }
      }));
    } catch (error) {
      console.error('Error fetching member details:', error);
      setMemberDetails(prev => ({
        ...prev,
        [memberId]: { ...prev[memberId], loading: false }
      }));
    }
  };

  const handleMemberClick = (memberId: string) => {
    if (selectedMemberId === memberId) {
      setSelectedMemberId(null);
    } else {
      setSelectedMemberId(memberId);
      fetchMemberDetails(memberId);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const filteredMembers = members.filter(m => m.level === activeTab);
  const l1Volume = members.filter(m => m.level === 1).reduce((acc, m) => acc + m.total_balance, 0);
  const l2Volume = members.filter(m => m.level === 2).reduce((acc, m) => acc + m.total_balance, 0);
  
  // Assuming average 2.5% daily yield for projections
  const estimatedDailyL1 = l1Volume * 0.025 * 0.10;
  const estimatedDailyL2 = l2Volume * 0.025 * 0.05;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
        <div className="w-10 h-10 border-4 border-[var(--blue)] border-t-transparent rounded-full animate-spin"></div>
        <p className="text-on-surface-variant text-[10px] font-black uppercase tracking-widest animate-pulse">Loading Team Data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-16 pb-20 max-w-7xl mx-auto w-full px-4">
      <header className="flex items-center gap-10 pt-12 relative">
        <div className="absolute top-1/2 left-0 -translate-y-1/2 w-80 h-80 bg-emerald-400/5 blur-[120px] rounded-full -z-10 animate-pulse"></div>
        <motion.button 
          whileHover={{ scale: 1.1, x: -6 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => navigate('/my')}
          className="w-16 h-16 rounded-[24px] glass-card flex items-center justify-center text-slate-500 hover:text-emerald-400 transition-all border-white/10 shadow-2xl group relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-emerald-400/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <span className="material-symbols-outlined group-hover:-translate-x-1 transition-transform text-2xl">arrow_back</span>
        </motion.button>
        <div className="space-y-3">
          <h1 className="text-5xl font-headline font-black text-white tracking-tighter uppercase leading-none">Alliance Network</h1>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1 bg-emerald-400/10 rounded-full border border-emerald-400/20 shadow-[0_0_15px_rgba(52,211,153,0.1)]">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></div>
              <span className="text-[9px] font-headline font-black uppercase tracking-widest text-emerald-400">Secure Protocol</span>
            </div>
            <p className="text-[10px] font-headline font-black uppercase tracking-[0.5em] text-slate-600">Global Referral Matrix v3.1</p>
          </div>
        </div>
      </header>

      {/* Team Summary */}
      <section className="px-4 max-w-5xl mx-auto w-full">
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card rounded-[64px] p-16 space-y-16 relative overflow-hidden border-white/5 shadow-[0_0_100px_rgba(0,0,0,0.5)]"
        >
          <div className="absolute right-0 top-0 w-[600px] h-[600px] bg-emerald-400/5 blur-[180px] -mr-48 -mt-48 animate-pulse"></div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-20 relative z-10">
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-2 h-8 bg-emerald-400 rounded-full shadow-[0_0_15px_rgba(52,211,153,0.5)]"></div>
                <p className="text-[11px] uppercase tracking-[0.6em] text-slate-600 font-headline font-black">Network Population</p>
              </div>
              <div className="flex items-baseline gap-6">
                <p className="text-9xl font-headline font-black text-white tracking-tighter leading-none drop-shadow-[0_0_30px_rgba(255,255,255,0.1)]">
                  {(teamData?.direct_members || 0) + (teamData?.indirect_members || 0)}
                </p>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 px-3 py-1 bg-emerald-400/10 rounded-lg border border-emerald-400/20">
                    <span className="text-emerald-400 text-[9px] font-headline font-black uppercase tracking-widest">Active Nodes</span>
                  </div>
                  <span className="text-slate-700 text-[10px] font-headline font-black uppercase tracking-widest px-1">Verified Protocol</span>
                </div>
              </div>
            </div>
            <div className="space-y-6 md:text-right">
              <div className="flex items-center gap-4 md:justify-end">
                <p className="text-[11px] uppercase tracking-[0.6em] text-slate-600 font-headline font-black">Aggregate Network Volume</p>
                <div className="w-2 h-8 bg-emerald-400 rounded-full shadow-[0_0_15px_rgba(52,211,153,0.5)]"></div>
              </div>
              <p className="text-8xl font-headline font-black text-emerald-400 tracking-tighter leading-none drop-shadow-[0_0_40px_rgba(52,211,153,0.2)]">
                <span className="text-4xl mr-2 text-emerald-400/30">$</span>
                {teamData?.total_team_volume?.toLocaleString() || '0.00'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-16 pt-16 border-t border-white/5 relative z-10">
            <div className="space-y-4 group">
              <p className="text-[10px] uppercase tracking-[0.4em] text-slate-700 font-headline font-black group-hover:text-white transition-colors">Primary Tier (L1)</p>
              <p className="text-5xl font-headline font-black text-white group-hover:text-emerald-400 transition-all duration-500">{teamData?.direct_members || 0}</p>
            </div>
            <div className="space-y-4 sm:border-x border-white/5 sm:px-16 group">
              <p className="text-[10px] uppercase tracking-[0.4em] text-slate-700 font-headline font-black group-hover:text-white transition-colors">Secondary Tier (L2)</p>
              <p className="text-5xl font-headline font-black text-white group-hover:text-emerald-400 transition-all duration-500">{teamData?.indirect_members || 0}</p>
            </div>
            <div className="space-y-4 sm:text-right group">
              <p className="text-[10px] uppercase tracking-[0.4em] text-slate-700 font-headline font-black group-hover:text-white transition-colors">Operational Nodes</p>
              <p className="text-5xl font-headline font-black text-emerald-400 group-hover:scale-110 transition-all duration-500 origin-right">
                {members.filter(m => m.total_balance > 0).length}
              </p>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Investment Breakdown */}
      <section className="px-4 max-w-5xl mx-auto w-full">
        <div className="space-y-10">
          <div className="flex items-center gap-5 px-6">
            <div className="w-2.5 h-10 bg-emerald-400 rounded-full shadow-[0_0_20px_rgba(52,211,153,0.4)]"></div>
            <h2 className="text-3xl font-headline font-black text-white tracking-tight uppercase">Investment Classification</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-10">
            {[
              { label: 'Tier Alpha', value: teamData?.team_members_a || 0, color: 'emerald' },
              { label: 'Tier Beta', value: teamData?.team_members_b || 0, color: 'emerald' },
              { label: 'Tier Gamma', value: teamData?.team_members_c || 0, color: 'emerald' }
            ].map((tier, idx) => (
              <motion.div 
                key={tier.label}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.1 }}
                whileHover={{ y: -10, scale: 1.05 }}
                className="glass-card rounded-[48px] p-12 text-center border-white/5 hover:bg-white/[0.03] transition-all group relative overflow-hidden shadow-2xl"
              >
                <div className="absolute top-0 left-0 w-full h-1.5 bg-emerald-400/10 group-hover:bg-emerald-400 transition-colors duration-500"></div>
                <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-emerald-400/5 blur-[50px] rounded-full group-hover:bg-emerald-400/10 transition-colors"></div>
                <p className="text-[11px] uppercase tracking-[0.5em] text-slate-700 font-headline font-black mb-6 group-hover:text-white transition-colors">{tier.label}</p>
                <p className="text-6xl font-headline font-black text-white group-hover:text-emerald-400 transition-all duration-700 drop-shadow-[0_0_20px_rgba(52,211,153,0)] group-hover:drop-shadow-[0_0_20px_rgba(52,211,153,0.3)]">
                  {tier.value}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Earnings Transparency Section */}
      <section className="px-4 max-w-5xl mx-auto w-full">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="glass-card rounded-[56px] p-12 space-y-12 relative overflow-hidden border-white/5 shadow-2xl"
        >
          <div className="absolute left-0 bottom-0 w-[400px] h-[400px] bg-emerald-400/5 blur-[120px] -ml-40 -mb-40"></div>
          
          <div className="space-y-12 relative z-10">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <h2 className="text-3xl font-headline font-black text-white tracking-tight uppercase">Yield Matrix</h2>
                <div className="flex items-center gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400"></div>
                  <p className="text-[10px] font-headline font-black uppercase tracking-[0.3em] text-slate-500">Network Revenue Distribution Protocol</p>
                </div>
              </div>
              <div className="w-16 h-16 rounded-2xl bg-emerald-400/10 flex items-center justify-center border border-emerald-400/20 shadow-[0_0_20px_rgba(52,211,153,0.1)]">
                <span className="material-symbols-outlined text-3xl text-emerald-400">analytics</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
              <div className="space-y-4">
                <p className="text-[10px] uppercase tracking-[0.4em] text-slate-600 font-headline font-black">Cumulative Network Yield</p>
                <p className="text-7xl font-headline font-black text-white tracking-tighter leading-none">
                  <span className="text-3xl mr-2 text-slate-700">$</span>
                  {dashboard?.team_earnings?.toLocaleString(undefined, { minimumFractionDigits: 2 }) || '0.00'}
                </p>
              </div>
              <div className="glass-card p-8 rounded-[32px] border-white/5 flex flex-col justify-center bg-white/[0.02] shadow-xl">
                <p className="text-[10px] uppercase tracking-[0.4em] text-slate-600 font-headline font-black mb-2">Projected Daily Revenue</p>
                <p className="text-4xl font-headline font-black text-emerald-400 tracking-tight">
                  +${(estimatedDailyL1 + estimatedDailyL2).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="glass-card rounded-[40px] p-10 space-y-8 border-white/5 group hover:bg-white/5 transition-all shadow-xl">
                <div className="flex items-center gap-4">
                  <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_15px_rgba(52,211,153,0.5)]"></div>
                  <p className="text-xs uppercase tracking-[0.4em] text-white font-headline font-black">Primary Node (L1)</p>
                </div>
                <div className="space-y-4">
                  <div className="flex items-baseline gap-3">
                    <p className="text-5xl font-headline font-black text-white">10%</p>
                    <p className="text-[10px] text-slate-600 font-headline font-black uppercase tracking-[0.2em]">Profit Share</p>
                  </div>
                  <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: '10%' }}
                      className="h-full bg-emerald-400"
                    ></motion.div>
                  </div>
                  <div className="flex justify-between items-center">
                    <p className="text-[10px] text-slate-600 font-headline font-black uppercase tracking-widest">Volume: ${l1Volume.toLocaleString()}</p>
                    <span className="text-[8px] text-emerald-400/50 font-headline font-black uppercase tracking-widest">Active</span>
                  </div>
                </div>
              </div>
              
              <div className="glass-card rounded-[40px] p-10 space-y-8 border-white/5 group hover:bg-white/5 transition-all shadow-xl">
                <div className="flex items-center gap-4">
                  <div className="w-3 h-3 rounded-full bg-emerald-400/30"></div>
                  <p className="text-xs uppercase tracking-[0.4em] text-white font-headline font-black">Secondary Node (L2)</p>
                </div>
                <div className="space-y-4">
                  <div className="flex items-baseline gap-3">
                    <p className="text-5xl font-headline font-black text-white">5%</p>
                    <p className="text-[10px] text-slate-600 font-headline font-black uppercase tracking-[0.2em]">Profit Share</p>
                  </div>
                  <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: '5%' }}
                      className="h-full bg-emerald-400"
                    ></motion.div>
                  </div>
                  <div className="flex justify-between items-center">
                    <p className="text-[10px] text-slate-600 font-headline font-black uppercase tracking-widest">Volume: ${l2Volume.toLocaleString()}</p>
                    <span className="text-[8px] text-emerald-400/50 font-headline font-black uppercase tracking-widest">Active</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-8 rounded-[32px] bg-emerald-400/5 border border-emerald-400/10 flex items-start gap-6 shadow-inner">
              <div className="w-10 h-10 rounded-xl bg-emerald-400/10 flex items-center justify-center flex-shrink-0">
                <span className="material-symbols-outlined text-emerald-400 text-xl">info</span>
              </div>
              <p className="text-[10px] text-slate-500 leading-relaxed font-headline font-medium uppercase tracking-[0.15em]">
                Network revenue is calculated at 00:00 UTC. Rewards are based on the net staking profit of your alliance members and credited instantly to your primary liquidity node. All transactions are verified on the AtmosPro protocol.
              </p>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Tabs */}
      <div className="px-4 max-w-2xl mx-auto w-full">
        <div className="flex p-2.5 bg-white/5 rounded-[32px] relative glass-card border-white/5 shadow-2xl">
          {[
            { id: 1, label: 'Primary (L1)' },
            { id: 2, label: 'Secondary (L2)' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex-1 py-5 rounded-[24px] text-xs font-headline font-black uppercase tracking-[0.3em] transition-all relative z-10",
                activeTab === tab.id ? "text-emerald-950" : "text-slate-600 hover:text-white"
              )}
            >
              {tab.label}
              {activeTab === tab.id && (
                <motion.div
                  layoutId="activeTeamTab"
                  className="absolute inset-0 bg-emerald-400 rounded-[24px] -z-10 shadow-[0_0_30px_rgba(52,211,153,0.4)]"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Members List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 px-4 max-w-7xl mx-auto w-full">
        {filteredMembers.length > 0 ? (
          filteredMembers.map((member, idx) => (
            <motion.div 
              key={member.id} 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="space-y-8"
            >
              <div 
                onClick={() => handleMemberClick(member.id)}
                className={cn(
                  "glass-card rounded-[48px] p-10 flex items-center justify-between border transition-all cursor-pointer group shadow-2xl relative overflow-hidden",
                  selectedMemberId === member.id 
                    ? "border-emerald-400/50 bg-emerald-400/[0.03] shadow-[0_0_60px_-10px_rgba(52,211,153,0.25)]" 
                    : "border-white/5 hover:border-white/20 hover:bg-white/[0.03]"
                )}
              >
                <div className="flex items-center gap-10">
                  <div className="relative">
                    <div className="w-24 h-24 rounded-[32px] bg-white/5 flex items-center justify-center overflow-hidden border border-white/10 group-hover:border-emerald-400/40 transition-all duration-700 shadow-2xl">
                      <img 
                        src={member.avatar_url || `https://picsum.photos/seed/${member.id}/100/100`} 
                        alt="Avatar" 
                        className="w-full h-full object-cover opacity-50 group-hover:opacity-100 group-hover:scale-110 transition-all duration-1000"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <div className="absolute -bottom-3 -right-3 w-12 h-12 rounded-[18px] bg-emerald-400 flex items-center justify-center border-[6px] border-[#080f14] shadow-2xl group-hover:scale-110 transition-transform duration-500">
                      <span className="text-sm font-headline font-black text-emerald-950">V{member.vip_level || 1}</span>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <p className="text-2xl font-headline font-black text-white tracking-tighter group-hover:text-emerald-400 transition-colors uppercase leading-none">
                      {member.email.split('@')[0]}
                    </p>
                    <div className="flex items-center gap-5">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-headline font-black text-emerald-400/40 uppercase tracking-widest">
                          ID: {member.permanent_id}
                        </span>
                      </div>
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-900"></div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-headline font-black text-slate-700 uppercase tracking-widest">
                          {new Date(member.created_at).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-10">
                  <div className="text-right space-y-2">
                    <p className="text-[10px] uppercase tracking-[0.3em] text-slate-700 font-headline font-black">Node Balance</p>
                    <p className="text-3xl font-headline font-black text-white tracking-tighter group-hover:text-emerald-400 transition-colors">
                      <span className="text-base mr-1 text-slate-800">$</span>
                      {member.total_balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <motion.div 
                    animate={{ rotate: selectedMemberId === member.id ? 180 : 0 }}
                    className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10 group-hover:text-emerald-400 group-hover:bg-emerald-400/10 transition-all duration-500"
                  >
                    <span className="material-symbols-outlined text-2xl text-slate-700 group-hover:text-emerald-400">expand_more</span>
                  </motion.div>
                </div>
              </div>

              {/* Collapsible Content */}
              {selectedMemberId === member.id && (
                <motion.div
                  initial={{ opacity: 0, height: 0, y: -20 }}
                  animate={{ opacity: 1, height: 'auto', y: 0 }}
                  className="overflow-hidden px-8"
                >
                  <div className="glass-card rounded-[56px] p-12 space-y-12 border border-emerald-400/30 relative overflow-hidden shadow-[0_0_80px_rgba(52,211,153,0.1)] bg-emerald-400/[0.02]">
                    <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-transparent via-emerald-400/40 to-transparent"></div>
                    
                    {memberDetails[member.id]?.loading ? (
                      <div className="flex flex-col items-center justify-center py-16 gap-8">
                        <div className="w-12 h-12 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin shadow-[0_0_20px_rgba(52,211,153,0.4)]"></div>
                        <p className="text-[11px] font-headline font-black uppercase tracking-[0.5em] text-slate-700 animate-pulse">Synchronizing Node Data...</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-10">
                        <div className="space-y-6 p-10 rounded-[40px] bg-white/[0.02] border border-white/5 shadow-inner group hover:bg-white/[0.04] transition-all relative overflow-hidden">
                          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-400/5 blur-[40px] -mr-8 -mt-8"></div>
                          <p className="text-[11px] uppercase tracking-[0.5em] text-slate-700 font-headline font-black group-hover:text-white transition-colors">Network Reach</p>
                          <div className="flex items-center gap-8">
                            <div className="w-16 h-16 rounded-[20px] bg-emerald-400/10 flex items-center justify-center border border-emerald-400/20 shadow-[0_0_20px_rgba(52,211,153,0.15)] group-hover:scale-110 transition-transform duration-700">
                              <span className="material-symbols-outlined text-3xl text-emerald-400">group</span>
                            </div>
                            <p className="text-6xl font-headline font-black text-white tracking-tighter group-hover:text-emerald-400 transition-colors">
                              {memberDetails[member.id]?.referralCount || 0}
                            </p>
                          </div>
                        </div>
                        <div className="space-y-6 p-10 rounded-[40px] bg-white/[0.02] border border-white/5 shadow-inner group hover:bg-white/[0.04] transition-all sm:text-right relative overflow-hidden">
                          <div className="absolute top-0 left-0 w-24 h-24 bg-emerald-400/5 blur-[40px] -ml-8 -mt-8"></div>
                          <p className="text-[11px] uppercase tracking-[0.5em] text-slate-700 font-headline font-black group-hover:text-white transition-colors">Total Yield</p>
                          <div className="flex items-center sm:justify-end gap-8">
                            <p className="text-6xl font-headline font-black text-emerald-400 tracking-tighter leading-none drop-shadow-[0_0_20px_rgba(52,211,153,0.2)]">
                              <span className="text-3xl mr-1 text-emerald-400/40">$</span>
                              {(memberDetails[member.id]?.totalEarnings || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </p>
                            <div className="w-16 h-16 rounded-[20px] bg-emerald-400/10 flex items-center justify-center border border-emerald-400/20 shadow-[0_0_20px_rgba(52,211,153,0.15)] group-hover:scale-110 transition-transform duration-700">
                              <span className="material-symbols-outlined text-3xl text-emerald-400">payments</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </motion.div>
          ))
        ) : (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-40 space-y-10 lg:col-span-2 glass-card rounded-[64px] border-white/5 shadow-2xl relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-white/[0.01]"></div>
            <div className="w-40 h-40 rounded-[48px] bg-white/5 flex items-center justify-center mx-auto text-slate-900 border border-white/5 shadow-inner group relative z-10">
              <span className="material-symbols-outlined text-7xl group-hover:rotate-12 transition-transform duration-700">group_off</span>
            </div>
            <div className="space-y-6 relative z-10">
              <p className="text-3xl font-headline font-black uppercase tracking-[0.5em] text-white">No Alliance Members Detected</p>
              <p className="text-[11px] text-slate-700 font-headline font-black uppercase tracking-[0.4em] max-w-sm mx-auto leading-relaxed">Expand your network to initialize data nodes and populate the AtmosPro matrix.</p>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};
