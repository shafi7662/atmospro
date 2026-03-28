import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Profile, TeamData, UserDashboard } from '../types';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

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
    <div className="space-y-8 pb-10">
      <header className="flex items-center gap-4 px-2 cv-auto" style={{ containIntrinsicSize: '0 60px' }}>
        <button 
          onClick={() => navigate('/my')}
          className={`w-10 h-10 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant hover:text-[var(--blue)] transition-colors ${!isMobile ? 'rainbow-glow' : ''}`}
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h1 className="text-2xl font-black text-on-surface tracking-tight">My Team</h1>
      </header>

      {/* Team Summary */}
      <section className="px-2 max-w-2xl mx-auto w-full cv-auto" style={{ containIntrinsicSize: '0 200px' }}>
        <div className={`premium-card rounded-[32px] p-7 space-y-6 relative overflow-hidden ${!isMobile ? 'rainbow-glow' : ''}`}>
          <div className="absolute right-0 top-0 w-32 h-32 bg-gradient-to-bl from-[var(--blue)]/10 to-transparent blur-3xl"></div>
          
          <div className="grid grid-cols-2 gap-8 relative z-10">
            <div className="space-y-1">
              <p className="text-[9px] uppercase tracking-widest text-on-surface-variant font-black">Total Members</p>
              <p className={`text-3xl font-black text-on-surface tracking-tight ${!isMobile ? 'rainbow-text' : ''}`}>
                {(teamData?.direct_members || 0) + (teamData?.indirect_members || 0)}
              </p>
            </div>
            <div className="space-y-1 text-right">
              <p className="text-[9px] uppercase tracking-widest text-on-surface-variant font-black">Team Volume</p>
              <p className={`text-3xl font-black text-[var(--blue)] tracking-tight ${!isMobile ? 'rainbow-text' : ''}`}>
                ${teamData?.total_team_volume?.toLocaleString() || '0.00'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 pt-6 border-t border-line/10 relative z-10">
            <div className="text-center space-y-1">
              <p className="text-[8px] uppercase tracking-widest text-on-surface-variant font-black">Level 1</p>
              <p className="text-lg font-black text-on-surface">{teamData?.direct_members || 0}</p>
            </div>
            <div className="text-center space-y-1 border-x border-line/10">
              <p className="text-[8px] uppercase tracking-widest text-on-surface-variant font-black">Level 2</p>
              <p className="text-lg font-black text-on-surface">{teamData?.indirect_members || 0}</p>
            </div>
            <div className="text-center space-y-1">
              <p className="text-[8px] uppercase tracking-widest text-on-surface-variant font-black">Active</p>
              <p className="text-lg font-black text-[var(--blue)]">
                {members.filter(m => m.total_balance > 0).length}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Investment Breakdown */}
      <section className="px-2 max-w-2xl mx-auto w-full cv-auto" style={{ containIntrinsicSize: '0 150px' }}>
        <div className={`premium-card rounded-[32px] p-6 space-y-4 ${!isMobile ? 'rainbow-glow' : ''}`}>
          <h2 className="text-[10px] uppercase tracking-[0.2em] text-on-surface-variant font-black px-2">Investment Tiers</h2>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-surface-container rounded-2xl p-4 text-center">
              <p className="text-[8px] uppercase tracking-widest text-on-surface-variant font-black mb-1">Tier A</p>
              <p className="text-xl font-black text-on-surface">{teamData?.team_members_a || 0}</p>
            </div>
            <div className="bg-surface-container rounded-2xl p-4 text-center">
              <p className="text-[8px] uppercase tracking-widest text-on-surface-variant font-black mb-1">Tier B</p>
              <p className="text-xl font-black text-on-surface">{teamData?.team_members_b || 0}</p>
            </div>
            <div className="bg-surface-container rounded-2xl p-4 text-center">
              <p className="text-[8px] uppercase tracking-widest text-on-surface-variant font-black mb-1">Tier C</p>
              <p className="text-xl font-black text-on-surface">{teamData?.team_members_c || 0}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Earnings Calculation Section */}
      <section className="px-2 max-w-4xl mx-auto w-full cv-auto" style={{ containIntrinsicSize: '0 400px' }}>
        <div className={`premium-card rounded-[32px] p-7 space-y-6 relative overflow-hidden ${!isMobile ? 'rainbow-glow' : ''}`}>
          <div className="absolute left-0 bottom-0 w-32 h-32 bg-gradient-to-tr from-[var(--gold)]/10 to-transparent blur-3xl"></div>
          
          <div className="space-y-4 relative z-10">
            <div className="flex items-center justify-between">
              <h2 className="text-[10px] uppercase tracking-[0.3em] text-on-surface-variant font-black">Earnings Transparency</h2>
              <div className="w-8 h-8 rounded-full bg-[var(--blue)]/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-sm text-[var(--blue)]">info</span>
              </div>
            </div>

            <div className="space-y-6">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-[9px] uppercase tracking-widest text-on-surface-variant font-black">Total Team Earnings</p>
                  <p className="text-3xl font-black text-on-surface tracking-tight">
                    ${dashboard?.team_earnings?.toLocaleString(undefined, { minimumFractionDigits: 2 }) || '0.00'}
                  </p>
                </div>
                <div className="text-left md:text-right">
                  <p className="text-[9px] uppercase tracking-widest text-on-surface-variant font-black mb-1">Projected Daily</p>
                  <p className="text-lg font-black text-[var(--blue)] tracking-tight">
                    +${(estimatedDailyL1 + estimatedDailyL2).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-surface-container rounded-2xl p-4 space-y-3 border border-line/5 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-12 h-12 bg-[var(--blue)]/5 rounded-full blur-xl"></div>
                  <div className="flex items-center gap-2 relative z-10">
                    <div className="w-2 h-2 rounded-full bg-[var(--blue)]"></div>
                    <p className="text-[8px] uppercase tracking-widest text-on-surface-variant font-black">Direct (L1)</p>
                  </div>
                  <div className="space-y-1 relative z-10">
                    <p className="text-xl font-black text-on-surface">10% <span className="text-[10px] text-on-surface-variant font-medium tracking-normal">of profit</span></p>
                    <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest text-on-surface-variant/60">
                      <span>Volume: ${l1Volume.toLocaleString()}</span>
                    </div>
                  </div>
                  <p className="text-[8px] text-on-surface-variant leading-relaxed relative z-10">Earn 10% of the daily staking rewards generated by your direct referrals.</p>
                </div>
                <div className="bg-surface-container rounded-2xl p-4 space-y-3 border border-line/5 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-12 h-12 bg-[var(--gold)]/5 rounded-full blur-xl"></div>
                  <div className="flex items-center gap-2 relative z-10">
                    <div className="w-2 h-2 rounded-full bg-[var(--gold)]"></div>
                    <p className="text-[8px] uppercase tracking-widest text-on-surface-variant font-black">Indirect (L2)</p>
                  </div>
                  <div className="space-y-1 relative z-10">
                    <p className="text-xl font-black text-on-surface">5% <span className="text-[10px] text-on-surface-variant font-medium tracking-normal">of profit</span></p>
                    <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest text-on-surface-variant/60">
                      <span>Volume: ${l2Volume.toLocaleString()}</span>
                    </div>
                  </div>
                  <p className="text-[8px] text-on-surface-variant leading-relaxed relative z-10">Earn 5% of the daily staking rewards generated by your level 2 team members.</p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-surface-container-low border border-line/10">
                <p className="text-[9px] text-on-surface-variant leading-relaxed font-medium italic">
                  * Team earnings are calculated daily at 00:00 UTC and automatically credited to your available balance. Contributions are based on the net staking profit of your referrals.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Tabs */}
      <div className="px-2 max-w-2xl mx-auto w-full">
        <div className="flex p-1 bg-surface-container rounded-2xl">
          <button
            onClick={() => setActiveTab(1)}
            className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
              activeTab === 1 
                ? 'glass-card neon-border-blue text-[var(--blue)]' 
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Direct (L1)
          </button>
          <button
            onClick={() => setActiveTab(2)}
            className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
              activeTab === 2 
                ? 'glass-card neon-border-blue text-[var(--blue)]' 
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Indirect (L2)
          </button>
        </div>
      </div>

      {/* Members List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 px-2 max-w-6xl mx-auto w-full cv-auto" style={{ containIntrinsicSize: '0 600px' }}>
        {filteredMembers.length > 0 ? (
          filteredMembers.map((member) => (
            <div key={member.id} className="space-y-2">
              <div 
                onClick={() => handleMemberClick(member.id)}
                className={`glass-card rounded-2xl p-4 flex items-center justify-between border transition-all cursor-pointer ${
                  selectedMemberId === member.id 
                    ? 'neon-border-blue scale-[1.02] shadow-lg' 
                    : 'border-line/5 hover:border-line/20'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-surface-container flex items-center justify-center overflow-hidden border border-line/10">
                    <img 
                      src={member.avatar_url || `https://picsum.photos/seed/${member.id}/100/100`} 
                      alt="Avatar" 
                      className="w-full h-full object-cover"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div>
                    <p className="text-sm font-black text-on-surface tracking-tight">
                      {member.email.split('@')[0]}
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-black text-on-surface-variant uppercase tracking-widest">
                        VIP {member.vip_level || 1}
                      </span>
                      <span className="w-1 h-1 rounded-full bg-line/20"></span>
                      <span className="text-[9px] font-black text-[var(--blue)] uppercase tracking-widest">
                        ID: {member.permanent_id}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-[9px] uppercase tracking-widest text-on-surface-variant font-black mb-0.5">Balance</p>
                    <p className="text-sm font-black text-on-surface tracking-tight">
                      ${member.total_balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <span className={`material-symbols-outlined text-on-surface-variant transition-transform duration-300 ${selectedMemberId === member.id ? 'rotate-180' : ''}`}>
                    expand_more
                  </span>
                </div>
              </div>

              {/* Collapsible Content */}
              {selectedMemberId === member.id && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className={`glass-card rainbow-glow rounded-2xl p-5 mx-2 space-y-4 border border-[var(--blue)]/10 ${!isMobile ? 'rainbow-glow' : ''}`}>
                    {memberDetails[member.id]?.loading ? (
                      <div className="flex items-center justify-center py-4">
                        <div className="w-5 h-5 border-2 border-[var(--blue)] border-t-transparent rounded-full animate-spin"></div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <p className="text-[8px] uppercase tracking-widest text-on-surface-variant font-black">Direct Referrals</p>
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-sm text-[var(--blue)]">group</span>
                            <p className="text-lg font-black text-on-surface">
                              {memberDetails[member.id]?.referralCount || 0}
                            </p>
                          </div>
                        </div>
                        <div className="space-y-1 text-right">
                          <p className="text-[8px] uppercase tracking-widest text-on-surface-variant font-black">Total Earnings</p>
                          <div className="flex items-center justify-end gap-2">
                            <span className="material-symbols-outlined text-sm text-[var(--gold)]">payments</span>
                            <p className={`text-lg font-black text-[var(--gold)] ${!isMobile ? 'rainbow-text' : ''}`}>
                              ${(memberDetails[member.id]?.totalEarnings || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </div>
          ))
        ) : (
          <div className="text-center py-12 space-y-3 md:col-span-2">
            <div className="w-16 h-16 rounded-full bg-surface-container flex items-center justify-center mx-auto text-on-surface-variant/20">
              <span className="material-symbols-outlined text-3xl">group_off</span>
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">No members found in this level</p>
          </div>
        )}
      </div>
    </div>
  );
};
