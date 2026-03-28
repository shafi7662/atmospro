import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  role: 'admin' | 'user' | null;
  loading: boolean;
  isTwoFAVerified: boolean;
  isTwoFAEnabled: boolean;
  setTwoFAVerified: (verified: boolean) => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<'admin' | 'user' | null>(null);
  const [loading, setLoading] = useState(true);
  const [isTwoFAVerified, setIsTwoFAVerified] = useState(() => {
    return sessionStorage.getItem('isTwoFAVerified') === 'true';
  });

  const setTwoFAVerified = (verified: boolean) => {
    setIsTwoFAVerified(verified);
    if (verified) {
      sessionStorage.setItem('isTwoFAVerified', 'true');
    } else {
      sessionStorage.removeItem('isTwoFAVerified');
    }
  };

  useEffect(() => {
    if (user?.email?.toLowerCase() === 'shafi7662424456@gmail.com') {
      setTwoFAVerified(true);
    }
  }, [user]);

  const [isTwoFAEnabled, setIsTwoFAEnabled] = useState(false);

  const fetchRole = async (user: User) => {
    try {
      // 1. Try to fetch existing profile
      let { data: profile, error: fetchError } = await supabase
        .from('profiles')
        .select('role, id, two_fa_enabled, two_fa_secret')
        .eq('id', user.id)
        .maybeSingle();
      
      if (fetchError) {
        console.error('Error fetching profile in AuthContext:', fetchError);
        setRole('user');
        return;
      }
      
      let finalRole: 'admin' | 'user' = 'user';

      if (!profile) {
        // 2. Profile doesn't exist, attempt to create it
        console.log('Profile not found in AuthContext, initializing...');
        
        // Get referral code from metadata
        const metadataReferralCode = user.user_metadata?.referral_code;
        let referrerId = null;

        if (metadataReferralCode) {
          const { data: referrerProfile } = await supabase
            .from('profiles')
            .select('id')
            .eq('referral_code', metadataReferralCode)
            .maybeSingle();
          
          if (referrerProfile) {
            referrerId = referrerProfile.id;
          }
        }

        const newProfile = {
          id: user.id,
          email: user.email,
          first_name: user.user_metadata?.first_name || null,
          last_name: user.user_metadata?.last_name || null,
          phone_number: user.user_metadata?.phone_number || null,
          role: user.email?.toLowerCase() === 'shafi7662424456@gmail.com' ? 'admin' : 'user',
          available_balance: 0,
          total_balance: 0,
          deposit_balance: 0,
          withdrawable_balance: 0,
          referral_code: `ATM-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
          permanent_id: Math.floor(100000 + Math.random() * 900000).toString(),
          vip_level: 1,
          two_fa_enabled: false,
          referred_by: referrerId
        };

        const { data: createdProfile, error: createError } = await supabase
          .from('profiles')
          .upsert(newProfile, { onConflict: 'id' })
          .select('role')
          .maybeSingle();

        if (createError) {
          console.error('Profile creation/upsert error in AuthContext:', createError);
          // Fallback role based on email
          finalRole = user.email?.toLowerCase() === 'shafi7662424456@gmail.com' ? 'admin' : 'user';
        } else if (createdProfile) {
          finalRole = createdProfile.role as 'admin' | 'user';
        }
      } else {
        // 3. Profile exists, check for admin auto-assignment
        finalRole = profile.role as 'admin' | 'user';
        setIsTwoFAEnabled(!!(profile.two_fa_enabled && profile.two_fa_secret));
        
        if (user.email?.toLowerCase() === 'shafi7662424456@gmail.com' && finalRole !== 'admin') {
          const { error: updateError } = await supabase
            .from('profiles')
            .update({ role: 'admin' })
            .eq('id', user.id);
          
          if (!updateError) {
            finalRole = 'admin';
          }
        }
      }
      
      setRole(finalRole);
    } catch (error) {
      console.error('Unexpected error in fetchRole:', error);
      setRole('user');
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchRole(session.user);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth event:', event);
      
      if (event === 'SIGNED_OUT') {
        setSession(null);
        setUser(null);
        setRole(null);
        setLoading(false);
        // Only toast if it wasn't a manual sign out (optional, but good for UX)
        // Actually, always toast for clarity if they were previously logged in
        toast.error('Your session has expired. Please log in again.');
      } else {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          fetchRole(session.user);
        } else {
          setRole(null);
          setLoading(false);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (role !== null) {
      setLoading(false);
    }
  }, [role]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setTwoFAVerified(false);
  };

  return (
    <AuthContext.Provider value={{ session, user, role, loading, isTwoFAVerified, isTwoFAEnabled, setTwoFAVerified, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
