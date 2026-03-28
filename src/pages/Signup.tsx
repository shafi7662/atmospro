import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { countries } from '../constants/countries';

export const Signup = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [selectedCountry, setSelectedCountry] = useState(countries.find(c => c.code === '+92') || countries[0]);
  const [referralCode, setReferralCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    if (ref) {
      setReferralCode(ref);
    }
  }, []);

  const fullPhoneNumber = `${selectedCountry.code}${phoneNumber}`;

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !firstName || !lastName || !phoneNumber) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (!email.toLowerCase().endsWith('@gmail.com')) {
      toast.error('Please use a Gmail address');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: firstName,
            last_name: lastName,
            phone_number: fullPhoneNumber,
            referral_code: referralCode || null,
            two_fa_enabled: false,
          }
        }
      });
      if (error) throw error;
      toast.success('Account created successfully!');
      navigate('/login');
    } catch (error: any) {
      toast.error(error.message || 'Failed to sign up');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-transparent relative overflow-hidden py-12">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md space-y-8 relative z-10"
      >
        <div className="text-center space-y-2">
          <h1 className="text-6xl font-black text-white tracking-tighter font-headline">
            Atmos<span className="text-[#00F0FF]">Pro</span>
          </h1>
          <p className="text-white/40 text-[10px] font-black uppercase tracking-[0.4em]">Join the Future</p>
        </div>

        <div className="glass-card rounded-[40px] p-8 border-white/5 shadow-2xl">
          <form className="space-y-5" onSubmit={handleSignup}>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/40 px-1">First Name</label>
                <input
                  type="text"
                  required
                  className="w-full px-5 py-3.5 rounded-2xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-[#00F0FF] transition-all text-sm"
                  placeholder="John"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/40 px-1">Last Name</label>
                <input
                  type="text"
                  required
                  className="w-full px-5 py-3.5 rounded-2xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-[#00F0FF] transition-all text-sm"
                  placeholder="Doe"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/40 px-1">Phone Number</label>
              <div className="flex gap-2">
                <div className="relative w-1/3">
                  <select
                    className="w-full h-full px-3 py-3.5 rounded-2xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-[#00F0FF] transition-all text-sm appearance-none cursor-pointer"
                    value={selectedCountry.code}
                    onChange={(e) => {
                      const country = countries.find(c => c.code === e.target.value);
                      if (country) setSelectedCountry(country);
                    }}
                  >
                    {countries.map((c) => (
                      <option key={`${c.code}-${c.name}`} value={c.code} className="bg-[#151619]">
                        {c.flag} {c.code}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-white/20">
                    <span className="material-symbols-outlined text-sm">expand_more</span>
                  </div>
                </div>
                <input
                  type="tel"
                  required
                  className="flex-1 px-5 py-3.5 rounded-2xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-[#00F0FF] transition-all text-sm"
                  placeholder="300 1234567"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/40 px-1">Gmail Address</label>
              <input
                type="email"
                required
                className="w-full px-5 py-3.5 rounded-2xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-[#00F0FF] transition-all text-sm"
                placeholder="yourname@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/40 px-1">Password</label>
              <div className="relative group">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  className="w-full px-5 pr-12 py-3.5 rounded-2xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-[#00F0FF] transition-all text-sm"
                  placeholder="Min 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20 hover:text-white transition-colors"
                >
                  <span className="material-symbols-outlined text-xl">
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/40 px-1">Referral Code (Optional)</label>
              <input
                type="text"
                className="w-full px-5 py-3.5 rounded-2xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-[#FFD700] transition-all text-sm"
                placeholder="ATM-XXX-XXX"
                value={referralCode}
                onChange={(e) => setReferralCode(e.target.value)}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 rounded-full bg-[#00F0FF] text-black font-black uppercase tracking-[0.2em] text-xs shadow-[0_0_20px_rgba(0,240,255,0.3)] hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 mt-4 rainbow-glow"
            >
              {loading ? 'Initializing...' : 'Create Vault Account'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs font-bold uppercase tracking-widest text-white/30">
          Already have an account?{' '}
          <Link to="/login" className="text-[#00F0FF] hover:underline ml-1">Login</Link>
        </p>
      </motion.div>
    </div>
  );
};
