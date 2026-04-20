import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import * as OTPAuth from 'otpauth';

export const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [show2FAStep, setShow2FAStep] = useState(false);
  const [twoFACode, setTwoFACode] = useState('');
  const [tempUser, setTempUser] = useState<any>(null);
  const [tempProfile, setTempProfile] = useState<any>(null);
  const navigate = useNavigate();
  const { setTwoFAVerified, session, user: authUser, isTwoFAEnabled, isTwoFAVerified } = useAuth();

  useEffect(() => {
    if (session && authUser) {
      if (isTwoFAEnabled && !isTwoFAVerified) {
        const isAdmin = authUser.email?.toLowerCase() === 'shafi7662424456@gmail.com';
        
        if (isAdmin) {
          setTwoFAVerified(true);
          navigate('/');
          return;
        }

        // Fetch profile to get the secret for verification
        const fetchTempProfile = async () => {
          const { data } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', authUser.id)
            .maybeSingle();
          
          if (data && data.two_fa_enabled && data.two_fa_secret) {
            setTempUser(authUser);
            setTempProfile(data);
            setShow2FAStep(true);
          } else {
            // If 2FA is "enabled" but no secret exists, bypass it to prevent lockout
            setTwoFAVerified(true);
            navigate('/');
          }
        };
        fetchTempProfile();
      } else if (!isTwoFAEnabled || isTwoFAVerified) {
        navigate('/');
      }
    }
  }, [session, authUser, isTwoFAEnabled, isTwoFAVerified]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      
      const user = data.user;
      if (!user) throw new Error('User not found');

      // Check if 2FA is enabled
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError) throw profileError;

      const isAdmin = user.email?.toLowerCase() === 'shafi7662424456@gmail.com';

      if (profile?.two_fa_enabled && profile?.two_fa_secret && !isAdmin) {
        setTempUser(user);
        setTempProfile(profile);
        setShow2FAStep(true);
        toast.info('Please enter your 2FA code');
      } else {
        setTwoFAVerified(true);
        toast.success('Logged in successfully');
        navigate('/');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to login');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tempUser || !tempProfile || !tempProfile.two_fa_secret) return;

    setLoading(true);
    try {
      const totp = new OTPAuth.TOTP({
        issuer: 'AtmosPro',
        label: tempUser.email,
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
        secret: tempProfile.two_fa_secret,
      });

      const delta = totp.validate({
        token: twoFACode,
        window: 1,
      });

      if (delta === null) {
        throw new Error('Invalid verification code');
      }

      setTwoFAVerified(true);
      toast.success('Logged in successfully');
      navigate('/');
    } catch (error: any) {
      toast.error(error.message || '2FA verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      toast.error('Please enter your email address first');
      return;
    }
    setResetLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/profile`,
      });
      if (error) throw error;
      toast.success('Password reset link sent to your email');
    } catch (error: any) {
      toast.error(error.message || 'Failed to send reset link');
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-transparent relative overflow-hidden">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md space-y-8 relative z-10"
      >
        <div className="text-center space-y-2">
          <h1 className="text-6xl font-black text-[var(--ink)] tracking-tighter font-headline">
            Atmos<span className="text-[var(--blue)]">Pro</span>
          </h1>
          <p className="text-[var(--ink-muted)] text-[10px] font-black uppercase tracking-[0.4em]">The Ethereal Vault</p>
        </div>

        <div className="glass-card rounded-[40px] p-8 border-[var(--line)] shadow-2xl">
          <AnimatePresence mode="wait">
            {!show2FAStep ? (
              <motion.form 
                key="login-form"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-6" 
                onSubmit={handleLogin}
              >
                <div className="space-y-5">
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-[var(--ink-muted)] px-1">Email Address</label>
                    <div className="relative group">
                      <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[var(--ink-muted)]/40 group-focus-within:text-[var(--blue)] transition-colors text-xl">mail</span>
                      <input
                        type="email"
                        required
                        className="w-full pl-12 pr-4 py-4 rounded-2xl bg-[var(--surface-container)] border border-[var(--line)] text-[var(--ink)] focus:outline-none focus:border-[var(--blue)] transition-all text-sm"
                        placeholder="name@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-[var(--ink-muted)] px-1">Password</label>
                    <div className="relative group">
                      <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[var(--ink-muted)]/40 group-focus-within:text-[var(--blue)] transition-colors text-xl">lock</span>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        className="w-full pl-12 pr-12 py-4 rounded-2xl bg-[var(--surface-container)] border border-[var(--line)] text-[var(--ink)] focus:outline-none focus:border-[var(--blue)] transition-all text-sm"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--ink-muted)]/40 hover:text-[var(--ink)] transition-colors"
                      >
                        <span className="material-symbols-outlined text-xl">
                          {showPassword ? 'visibility_off' : 'visibility'}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between px-1">
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <div className="relative">
                      <input 
                        type="checkbox" 
                        className="sr-only"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                      />
                      <div className={`w-5 h-5 rounded-lg border transition-all flex items-center justify-center ${
                        rememberMe ? 'bg-[var(--blue)] border-[var(--blue)]' : 'bg-[var(--surface-container)] border-[var(--line)] group-hover:border-[var(--ink-muted)]/40'
                      }`}>
                        {rememberMe && <span className="material-symbols-outlined text-white text-sm font-bold">check</span>}
                      </div>
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-[var(--ink-muted)] group-hover:text-[var(--ink)] transition-colors">Remember Me</span>
                  </label>

                  <button 
                    type="button"
                    onClick={handleForgotPassword}
                    disabled={resetLoading}
                    className="text-[9px] font-black uppercase tracking-widest text-[var(--blue)] hover:underline disabled:opacity-50"
                  >
                    {resetLoading ? 'Sending...' : 'Forgot Password?'}
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 rounded-full bg-[var(--blue)] text-white font-black uppercase tracking-[0.2em] text-xs shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 mt-2 rainbow-glow"
                >
                  {loading ? 'Authenticating...' : 'Enter Vault'}
                </button>
              </motion.form>
            ) : (
              <motion.form 
                key="2fa-form"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6" 
                onSubmit={handleVerify2FA}
              >
                <div className="text-center space-y-4">
                  <div className="w-16 h-16 bg-[#00F0FF]/10 rounded-2xl flex items-center justify-center mx-auto">
                    <span className="material-symbols-outlined text-3xl text-[#00F0FF]">shield_lock</span>
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-xl font-black text-white uppercase tracking-tighter">2FA Verification</h3>
                    <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Enter the code from your authenticator app</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <input
                    type="text"
                    maxLength={6}
                    required
                    autoFocus
                    className="w-full px-5 py-4 rounded-2xl bg-white/5 border border-white/10 text-white text-center text-2xl font-black tracking-[0.5em] focus:outline-none focus:border-[#00F0FF] transition-all"
                    placeholder="000000"
                    value={twoFACode}
                    onChange={(e) => setTwoFACode(e.target.value.replace(/\D/g, ''))}
                  />
                </div>

                <div className="space-y-3">
                  <button
                    type="submit"
                    disabled={loading || twoFACode.length !== 6}
                    className="w-full py-4 rounded-full bg-[#00F0FF] text-black font-black uppercase tracking-[0.2em] text-xs shadow-[0_0_20px_rgba(0,240,255,0.3)] hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 rainbow-glow"
                  >
                    {loading ? 'Verifying...' : 'Verify & Enter'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShow2FAStep(false)}
                    className="w-full py-4 rounded-full bg-white/5 text-white/60 font-black uppercase tracking-[0.2em] text-[10px] hover:text-white transition-all"
                  >
                    Back to Login
                  </button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>
        </div>

        <p className="text-center text-xs font-bold uppercase tracking-widest text-white/30">
          New to AtmosPro?{' '}
          <Link to="/signup" className="text-[#00F0FF] hover:underline ml-1">Create Account</Link>
        </p>
      </motion.div>
    </div>
  );
};
