import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Profile as UserProfile } from '../types';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import * as OTPAuth from 'otpauth';
import { QRCodeSVG } from 'qrcode.react';
import { useNavigate } from 'react-router-dom';

export const Profile = () => {
  const { user, signOut, setTwoFAVerified } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [show2FAModal, setShow2FAModal] = useState(false);
  const [twoFASecret, setTwoFASecret] = useState('');
  const [twoFACode, setTwoFACode] = useState('');
  const [setupStep, setSetupStep] = useState<'intro' | 'qr' | 'verify' | 'disable_confirm'>('intro');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [updatingProfile, setUpdatingProfile] = useState(false);
  const [showSetupGuide, setShowSetupGuide] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const fetchProfile = async () => {
    if (!user) return null;
    try {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
      
      if (error) {
        if (error.message.includes('JWT expired')) {
          signOut();
          return null;
        }
        throw error;
      }

      if (data) {
        setProfile(data);
        setFirstName(data.first_name || '');
        setLastName(data.last_name || '');
        setPhoneNumber(data.phone_number || '');
        // If 2FA is enabled, we should consider it verified for the current session if they are already in the profile page
        if (data.two_fa_enabled) {
          setTwoFAVerified(true);
        }
        return data;
      }
    } catch (error: any) {
      console.error('Profile fetch error:', error);
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      const data = await fetchProfile();
      if (data && !data.two_fa_enabled && !twoFASecret) {
        const secret = new OTPAuth.Secret({ size: 20 }).base32;
        setTwoFASecret(secret);
      }
    };
    init();
  }, [user]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setUpdatingProfile(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          first_name: firstName,
          last_name: lastName,
          phone_number: phoneNumber,
        })
        .eq('id', user.id);

      if (error) throw error;
      
      setProfile(prev => prev ? { ...prev, first_name: firstName, last_name: lastName, phone_number: phoneNumber } : null);
      toast.success('Profile updated successfully');
    } catch (error: any) {
      toast.error(error.message || 'Failed to update profile');
    } finally {
      setUpdatingProfile(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.email) return;

    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setChangingPassword(true);
    try {
      // 1. Verify old password by attempting to sign in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: oldPassword,
      });

      if (signInError) {
        throw new Error('Current password is incorrect');
      }

      // 2. Update to new password
      const { error: updateError } = await supabase.auth.updateUser({ 
        password: newPassword 
      });

      if (updateError) throw updateError;

      toast.success('Password updated successfully');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      toast.error(error.message || 'Failed to update password');
    } finally {
      setChangingPassword(false);
    }
  };

  const toggle2FA = async () => {
    if (!profile) return;
    
    if (profile.two_fa_enabled) {
      setSetupStep('disable_confirm');
      setShow2FAModal(true);
    } else {
      const secret = new OTPAuth.Secret({ size: 20 }).base32;
      setTwoFASecret(secret);
      setShowSetupGuide(!showSetupGuide);
      if (!showSetupGuide) {
        toast.info('Follow the setup guide below to enable 2FA');
      }
    }
  };

  const handleDisable2FA = async () => {
    if (!user || !profile) return;
    
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ 
          two_fa_enabled: false,
          two_fa_secret: null 
        })
        .eq('id', user?.id);

      if (error) throw error;
      setProfile({ ...profile, two_fa_enabled: false, two_fa_secret: null });
      setShow2FAModal(false);
      toast.success('2FA disabled successfully');
    } catch (error: any) {
      toast.error(error.message || 'Error disabling 2FA');
    }
  };

  const handleVerifyAndEnable2FA = async () => {
    if (!user || !profile || !twoFASecret) return;

    try {
      const totp = new OTPAuth.TOTP({
        issuer: 'AtmosPro',
        label: user.email,
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
        secret: twoFASecret,
      });

      const delta = totp.validate({
        token: twoFACode,
        window: 1,
      });

      if (delta === null) {
        toast.error('Invalid verification code');
        return;
      }

      const { error } = await supabase
        .from('profiles')
        .update({ 
          two_fa_enabled: true,
          two_fa_secret: twoFASecret 
        })
        .eq('id', user.id);

      if (error) throw error;

      setProfile({ ...profile, two_fa_enabled: true, two_fa_secret: twoFASecret });
      setTwoFAVerified(true);
      setShow2FAModal(false);
      setTwoFACode('');
      toast.success('2FA enabled successfully!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to enable 2FA');
    }
  };

  const otpAuthUrl = user ? new OTPAuth.TOTP({
    issuer: 'AtmosPro',
    label: user.email,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: twoFASecret,
  }).toString() : '';

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
        <div className="w-10 h-10 border-4 border-[#00D2FF] border-t-transparent rounded-full animate-spin"></div>
        <p className="text-on-surface-variant text-xs font-black uppercase tracking-widest animate-pulse">Loading Settings...</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="space-y-8 pb-10"
    >
      {/* Header */}
      <div className="flex items-center gap-4 pt-4">
        <button 
          onClick={() => navigate('/my')}
          className={`w-10 h-10 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant hover:text-[#00D2FF] transition-colors ${!isMobile ? 'rainbow-glow' : ''}`}
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h1 className="text-2xl font-headline font-black text-on-surface tracking-tight">Account Settings</h1>
      </div>

      <div className={`glass-card rounded-3xl p-6 border border-line/10 space-y-2 ${!isMobile ? 'rainbow-glow' : ''}`}>
        <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-black opacity-60">Registered Email</p>
        <div className="flex items-center gap-3 text-on-surface">
          <span className="material-symbols-outlined text-[var(--blue)]">mail</span>
          <span className="font-bold text-sm tracking-wide">{user?.email}</span>
        </div>
      </div>

      {/* Personal Information */}
      <div className={`glass-card rounded-3xl p-6 border border-line/10 space-y-6 ${!isMobile ? 'rainbow-glow' : ''}`}>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-surface-container-highest flex items-center justify-center text-on-surface-variant">
            <span className="material-symbols-outlined text-2xl">person</span>
          </div>
          <p className="font-headline font-black text-sm uppercase tracking-[0.1em] text-on-surface">Personal Information</p>
        </div>

        <form onSubmit={handleUpdateProfile} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold px-1">First Name</label>
              <input
                type="text"
                placeholder="First Name"
                className="w-full px-5 py-4 rounded-2xl bg-surface-container border border-line/10 text-on-surface focus:outline-none focus:border-[var(--blue)] transition-all text-sm"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold px-1">Last Name</label>
              <input
                type="text"
                placeholder="Last Name"
                className="w-full px-5 py-4 rounded-2xl bg-surface-container border border-line/10 text-on-surface focus:outline-none focus:border-[var(--blue)] transition-all text-sm"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold px-1">Phone Number</label>
            <input
              type="tel"
              placeholder="+1 234 567 890"
              className="w-full px-5 py-4 rounded-2xl bg-surface-container border border-line/10 text-on-surface focus:outline-none focus:border-[var(--blue)] transition-all text-sm"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
            />
          </div>
          <button
            type="submit"
            disabled={updatingProfile}
            className={`w-full py-4 rounded-full bg-surface-container-highest text-on-surface font-headline font-black uppercase tracking-widest text-[10px] hover:bg-[var(--blue)] hover:text-white transition-all active:scale-95 disabled:opacity-50 ${!isMobile ? 'rainbow-glow' : ''}`}
          >
            {updatingProfile ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      </div>

      {/* Language Selection */}
      <div className={`glass-card rounded-3xl p-6 border border-line/10 space-y-6 ${!isMobile ? 'rainbow-glow' : ''}`}>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-surface-container-highest flex items-center justify-center text-on-surface-variant">
            <span className="material-symbols-outlined text-2xl">language</span>
          </div>
          <p className="font-headline font-black text-sm uppercase tracking-[0.1em] text-on-surface">Language Settings</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {[
            { code: 'en', name: 'English', flag: '🇺🇸' },
            { code: 'ur', name: 'Urdu', flag: '🇵🇰' },
            { code: 'hi', name: 'Hindi', flag: '🇮🇳' },
            { code: 'ar', name: 'Arabic', flag: '🇸🇦' }
          ].map((lang) => (
            <button
              key={lang.code}
              onClick={() => toast.info(`Language set to ${lang.name}`)}
              className={`flex items-center gap-3 p-4 rounded-2xl border transition-all ${
                lang.code === 'en' 
                  ? 'bg-[var(--blue)]/10 border-[var(--blue)]/30 text-on-surface' 
                  : 'bg-surface-container border-line/5 text-on-surface-variant hover:border-line/20'
              }`}
            >
              <span className="text-xl">{lang.flag}</span>
              <span className="text-[10px] font-black uppercase tracking-widest">{lang.name}</span>
              {lang.code === 'en' && (
                <span className="material-symbols-outlined text-xs ml-auto text-[var(--blue)]">check_circle</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Security Section */}
      <div className="space-y-6">
        <div className="flex items-center gap-2 px-2">
          <span className="material-symbols-outlined text-[var(--blue)]">security</span>
          <h2 className="text-sm font-headline font-black uppercase tracking-[0.2em] text-on-surface">Security & Protection</h2>
        </div>

        <div className={`glass-card rounded-3xl p-6 border border-line/10 space-y-6 ${!isMobile ? 'rainbow-glow' : ''}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${profile?.kyc_status === 'verified' ? 'bg-green-500/10 text-green-500' : profile?.kyc_status === 'pending' ? 'bg-[var(--gold)]/10 text-[var(--gold)]' : 'bg-surface-container-highest text-on-surface-variant'}`}>
                <span className="material-symbols-outlined text-2xl">verified_user</span>
              </div>
              <div>
                <p className="font-headline font-black text-sm uppercase tracking-[0.1em] text-on-surface">Identity Verification</p>
                <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">{profile?.kyc_status || 'Unverified'}</p>
              </div>
            </div>
            <button 
              onClick={() => navigate('/my/setting/kyc')}
              className={`px-6 py-2 rounded-full bg-surface-container-highest text-on-surface font-headline font-black uppercase tracking-widest text-[9px] hover:bg-[var(--blue)] hover:text-white transition-all active:scale-95 ${!isMobile ? 'rainbow-glow' : ''}`}
            >
              {profile?.kyc_status === 'verified' ? 'View Details' : 'Verify Now'}
            </button>
          </div>
          <p className="text-[10px] text-on-surface-variant leading-relaxed uppercase tracking-wider font-medium">
            Complete your KYC to unlock higher limits and secure your account. Verification typically takes 24 hours.
          </p>
        </div>

        <div className={`glass-card rounded-3xl p-6 border border-line/10 space-y-6 ${!isMobile ? 'rainbow-glow' : ''}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${profile?.two_fa_enabled ? 'bg-[var(--blue)]/10 text-[var(--blue)]' : 'bg-surface-container-highest text-on-surface-variant'}`}>
                <span className="material-symbols-outlined text-2xl">shield_lock</span>
              </div>
              <div>
                <p className="font-headline font-black text-sm uppercase tracking-[0.1em] text-on-surface">2FA Authenticator</p>
                <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">{profile?.two_fa_enabled ? 'Security Enabled' : 'Security Disabled'}</p>
              </div>
            </div>
            <button 
              onClick={toggle2FA}
              className={`w-14 h-8 rounded-full relative transition-all duration-300 ${profile?.two_fa_enabled ? `bg-[var(--blue)] ${!isMobile ? 'rainbow-glow' : ''}` : 'bg-surface-container-highest'}`}
            >
              <div className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow-md transition-all duration-300 ${profile?.two_fa_enabled ? 'left-7' : 'left-1'}`}></div>
            </button>
          </div>
          <p className="text-[10px] text-on-surface-variant leading-relaxed uppercase tracking-wider font-medium">
            Secure your account with Google Authenticator or any TOTP app. This adds an extra layer of protection to your assets.
          </p>
        </div>

        {/* 2FA Setup Guide Section (Visible when user initiates setup and 2FA is disabled) */}
        {!profile?.two_fa_enabled && showSetupGuide && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className={`glass-card rounded-3xl p-7 border border-[var(--blue)]/20 space-y-8 relative overflow-hidden ${!isMobile ? 'rainbow-glow' : ''}`}
          >
            <div className="absolute right-0 top-0 w-48 h-48 bg-[var(--blue)]/5 blur-3xl rounded-full"></div>
            
            <div className="space-y-2 relative z-10">
              <h3 className="text-lg font-headline font-black text-on-surface uppercase tracking-tight">2FA Setup Guide</h3>
              <p className="text-[11px] text-on-surface-variant leading-relaxed font-medium">
                Follow these steps to secure your account with Two-Factor Authentication.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative z-10">
              {/* Step 1 */}
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-[var(--blue)]/10 flex items-center justify-center text-[var(--blue)] font-black text-xs">1</div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-on-surface">Install App</p>
                </div>
                <p className="text-[10px] text-on-surface-variant leading-relaxed">
                  Download Google Authenticator or Authy from the App Store or Play Store.
                </p>
              </div>

              {/* Step 2 */}
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-[var(--blue)]/10 flex items-center justify-center text-[var(--blue)] font-black text-xs">2</div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-on-surface">Scan QR Code</p>
                </div>
                <div className="bg-white p-3 rounded-2xl inline-block shadow-inner mx-auto md:mx-0">
                  <QRCodeSVG value={otpAuthUrl || 'otpauth://totp/AtmosPro?secret=BASE32SECRET'} size={120} />
                </div>
                <div className="space-y-2">
                  <p className="text-[9px] uppercase tracking-widest text-on-surface-variant font-black">Manual Secret</p>
                  <div className="flex items-center gap-2 bg-surface-container p-2 rounded-xl border border-line/10">
                    <code className="text-[10px] font-mono text-[var(--blue)] flex-1 truncate">{twoFASecret || 'Generating...'}</code>
                    <button 
                      onClick={() => {
                        if (twoFASecret) {
                          navigator.clipboard.writeText(twoFASecret);
                          toast.success('Secret copied');
                        } else {
                          const secret = new OTPAuth.Secret({ size: 20 }).base32;
                          setTwoFASecret(secret);
                          navigator.clipboard.writeText(secret);
                          toast.success('Secret generated and copied');
                        }
                      }}
                      className="p-1.5 hover:bg-white/5 rounded-lg transition-colors"
                    >
                      <span className="material-symbols-outlined text-xs">content_copy</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Step 3 */}
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-[var(--blue)]/10 flex items-center justify-center text-[var(--blue)] font-black text-xs">3</div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-on-surface">Verify Code</p>
                </div>
                <div className="space-y-4">
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="000000"
                    className="w-full px-4 py-3 rounded-xl bg-surface-container border border-line/10 text-on-surface focus:outline-none focus:border-[var(--blue)] transition-all font-black text-xl tracking-[0.4em] text-center"
                    value={twoFACode}
                    onChange={(e) => setTwoFACode(e.target.value.replace(/\D/g, ''))}
                  />
                  <button
                    onClick={handleVerifyAndEnable2FA}
                    disabled={twoFACode.length !== 6 || !twoFASecret}
                    className={`w-full py-3 rounded-full bg-[var(--blue)] text-white font-headline font-black uppercase tracking-widest text-[10px] shadow-lg shadow-[var(--blue)]/20 transition-all active:scale-95 disabled:opacity-50 ${!isMobile ? 'rainbow-glow' : ''}`}
                  >
                    Enable 2FA Now
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        <div className={`glass-card rounded-3xl p-6 border border-line/10 space-y-6 ${!isMobile ? 'rainbow-glow' : ''}`}>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-surface-container-highest flex items-center justify-center text-on-surface-variant">
              <span className="material-symbols-outlined text-2xl">lock_reset</span>
            </div>
            <p className="font-headline font-black text-sm uppercase tracking-[0.1em] text-on-surface">Change Password</p>
          </div>

          <form onSubmit={handlePasswordChange} className="space-y-4">
          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold px-1">Current Password</label>
            <input
              type="password"
              required
              placeholder="Enter current password"
              className="w-full px-5 py-4 rounded-2xl bg-surface-container border border-line/10 text-on-surface focus:outline-none focus:border-[var(--blue)] transition-all text-sm"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold px-1">New Password</label>
            <input
              type="password"
              required
              placeholder="Min 6 characters"
              className="w-full px-5 py-4 rounded-2xl bg-surface-container border border-line/10 text-on-surface focus:outline-none focus:border-[var(--blue)] transition-all text-sm"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold px-1">Confirm New Password</label>
            <input
              type="password"
              required
              placeholder="Repeat new password"
              className="w-full px-5 py-4 rounded-2xl bg-surface-container border border-line/10 text-on-surface focus:outline-none focus:border-[var(--blue)] transition-all text-sm"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
          <button
            type="submit"
            disabled={changingPassword}
            className={`w-full py-4 rounded-full bg-surface-container-highest text-on-surface font-headline font-black uppercase tracking-widest text-[10px] hover:bg-[var(--blue)] hover:text-white transition-all active:scale-95 disabled:opacity-50 ${!isMobile ? 'rainbow-glow' : ''}`}
          >
            {changingPassword ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>

      {/* 2FA Modal */}
      <AnimatePresence>
        {show2FAModal && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-background/80 backdrop-blur-md p-4">
            <motion.div
              initial={isMobile ? { opacity: 1 } : { opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={isMobile ? { opacity: 0 } : { opacity: 0, scale: 0.9, y: 20 }}
              className={`w-full max-w-md glass-card rounded-[32px] p-8 space-y-6 relative overflow-hidden border border-line/10 ${!isMobile ? 'rainbow-glow' : ''}`}
            >
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-headline font-black text-on-surface tracking-tight">2FA Setup</h2>
                <button onClick={() => setShow2FAModal(false)} className="text-on-surface-variant hover:text-on-surface">
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              <div className="space-y-6">
                {setupStep === 'intro' && (
                  <div className="space-y-6 text-center">
                    <div className="w-20 h-20 bg-[var(--blue)]/10 rounded-3xl flex items-center justify-center mx-auto">
                      <span className="material-symbols-outlined text-4xl text-[var(--blue)]">security</span>
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-xl font-headline font-black text-on-surface">Secure Your Account</h3>
                      <p className="text-sm text-on-surface-variant leading-relaxed">
                        Two-factor authentication adds an extra layer of security to your account.
                      </p>
                    </div>
                    <button
                      onClick={() => setSetupStep('qr')}
                      className={`w-full py-4 rounded-full bg-[var(--blue)] text-white font-headline font-black uppercase tracking-widest text-xs shadow-xl shadow-[var(--blue)]/20 transition-all active:scale-95 ${!isMobile ? 'rainbow-glow' : ''}`}
                    >
                      Start Setup
                    </button>
                  </div>
                )}

                {setupStep === 'qr' && (
                  <div className="space-y-6 text-center">
                    <div className="space-y-2">
                      <h3 className="text-lg font-headline font-black text-on-surface">Scan QR Code</h3>
                      <p className="text-xs text-on-surface-variant">
                        Scan this QR code with Google Authenticator.
                      </p>
                    </div>
                    
                    <div className="bg-white p-4 rounded-3xl inline-block mx-auto shadow-inner">
                      <QRCodeSVG value={otpAuthUrl} size={180} />
                    </div>

                    <div className="space-y-2">
                      <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-black">Or enter manually</p>
                      <div className="flex items-center gap-2 bg-surface-container p-3 rounded-2xl border border-line/10">
                        <code className="text-xs font-mono text-[var(--blue)] flex-1 truncate">{twoFASecret}</code>
                        <button 
                          onClick={() => {
                            navigator.clipboard.writeText(twoFASecret);
                            toast.success('Secret copied');
                          }}
                          className="p-2 hover:bg-white/5 rounded-lg transition-colors"
                        >
                          <span className="material-symbols-outlined text-sm">content_copy</span>
                        </button>
                      </div>
                    </div>

                    <button
                      onClick={() => setSetupStep('verify')}
                      className={`w-full py-4 rounded-full bg-[var(--blue)] text-white font-headline font-black uppercase tracking-widest text-xs shadow-xl shadow-[var(--blue)]/20 transition-all active:scale-95 ${!isMobile ? 'rainbow-glow' : ''}`}
                    >
                      I've Scanned It
                    </button>
                  </div>
                )}

                {setupStep === 'verify' && (
                  <div className="space-y-6 text-center">
                    <div className="space-y-2">
                      <h3 className="text-lg font-headline font-black text-on-surface">Verify Code</h3>
                      <p className="text-xs text-on-surface-variant">
                        Enter the 6-digit code from your app.
                      </p>
                    </div>

                    <div className="flex justify-center">
                      <input
                        type="text"
                        maxLength={6}
                        placeholder="000000"
                        autoFocus
                        className="w-48 text-center px-5 py-4 rounded-2xl bg-surface-container border border-line/10 text-on-surface focus:outline-none focus:border-[var(--blue)] transition-all font-black text-2xl tracking-[0.5em]"
                        value={twoFACode}
                        onChange={(e) => setTwoFACode(e.target.value.replace(/\D/g, ''))}
                      />
                    </div>

                    <div className="space-y-3">
                      <button
                        onClick={handleVerifyAndEnable2FA}
                        disabled={twoFACode.length !== 6}
                        className={`w-full py-4 rounded-full bg-[var(--blue)] text-white font-headline font-black uppercase tracking-widest text-xs shadow-xl shadow-[var(--blue)]/20 transition-all active:scale-95 disabled:opacity-50 ${!isMobile ? 'rainbow-glow' : ''}`}
                      >
                        Verify & Enable
                      </button>
                    </div>
                  </div>
                )}

                {setupStep === 'disable_confirm' && (
                  <div className="space-y-6 text-center">
                    <div className="w-20 h-20 bg-error/10 rounded-3xl flex items-center justify-center mx-auto">
                      <span className="material-symbols-outlined text-4xl text-error">warning</span>
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-xl font-headline font-black text-on-surface">Disable 2FA?</h3>
                      <p className="text-sm text-on-surface-variant leading-relaxed">
                        Are you sure you want to disable 2FA?
                      </p>
                    </div>
                    <div className="space-y-3">
                      <button
                        onClick={handleDisable2FA}
                        className={`w-full py-4 rounded-full bg-error text-white font-headline font-black uppercase tracking-widest text-xs shadow-xl shadow-error/20 transition-all active:scale-95 ${!isMobile ? 'rainbow-glow' : ''}`}
                      >
                        Yes, Disable 2FA
                      </button>
                      <button
                        onClick={() => setShow2FAModal(false)}
                        className={`w-full py-4 rounded-full bg-surface-container text-on-surface font-headline font-black uppercase tracking-widest text-xs transition-all active:scale-95 ${!isMobile ? 'rainbow-glow' : ''}`}
                      >
                        Keep it Enabled
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
