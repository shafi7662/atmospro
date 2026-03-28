import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { motion } from 'motion/react';

export const AdminLogin = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      // Verify if the user is actually an admin
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .maybeSingle();

      console.log('Admin check - User ID:', data.user.id);
      console.log('Admin check - Profile:', profile);
      console.log('Admin check - Error:', profileError);

      if (profileError) throw profileError;

      let finalRole = profile?.role;
      const AUTHORIZED_ADMIN = 'shafi7662424456@gmail.com';
      
      if (data.user.email?.toLowerCase() === AUTHORIZED_ADMIN.toLowerCase()) {
        finalRole = 'admin';
        // Background sync
        if (profile?.role !== 'admin') {
          supabase.from('profiles')
            .upsert({ id: data.user.id, role: 'admin', email: data.user.email })
            .then(() => console.log('Admin role synced'));
        }
      }

      if (!finalRole || finalRole.toLowerCase() !== 'admin') {
        await supabase.auth.signOut();
        throw new Error('Unauthorized: Admin access only');
      }

      toast.success('Admin access granted');
      navigate('/admin');
    } catch (error: any) {
      toast.error(error.message || 'Access Denied');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-[#0e0e12]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(0,240,255,0.05),transparent_70%)]"></div>
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md space-y-8 relative z-10"
      >
        <div className="text-center space-y-2">
          <div className="w-20 h-20 bg-primary-container/10 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-primary-container/20 shadow-[0_0_30px_rgba(0,240,255,0.1)]">
            <span className="material-symbols-outlined text-4xl text-primary-container">admin_panel_settings</span>
          </div>
          <h1 className="text-4xl font-headline font-black text-white tracking-tighter">Admin Terminal</h1>
          <p className="text-on-surface-variant text-sm uppercase tracking-[0.3em] font-bold opacity-60">Secure Access Point</p>
        </div>

        <div className="glass-card rounded-[40px] p-8 border border-white/5 shadow-2xl">
          <form className="space-y-6" onSubmit={handleAdminLogin}>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold px-1">Admin Identifier</label>
                <input
                  type="email"
                  required
                  className="w-full px-5 py-4 rounded-2xl bg-background border border-white/5 text-on-surface focus:outline-none focus:border-primary-container transition-all"
                  placeholder="admin@atmospro.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold px-1">Security Key</label>
                <input
                  type="password"
                  required
                  className="w-full px-5 py-4 rounded-2xl bg-background border border-white/5 text-on-surface focus:outline-none focus:border-primary-container transition-all"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>
            
            <button
              type="submit"
              disabled={loading}
              className="w-full py-5 rounded-2xl bg-white text-black font-headline font-black uppercase tracking-widest hover:bg-primary-container hover:text-on-primary transition-all active:scale-95 disabled:opacity-50 shadow-[0_10px_30px_rgba(255,255,255,0.1)] rainbow-glow"
            >
              {loading ? 'Authenticating...' : 'Establish Connection'}
            </button>
          </form>
        </div>

        <p className="text-center text-[10px] text-on-surface-variant font-bold uppercase tracking-widest opacity-40">
          Authorized Personnel Only • Encrypted Session
        </p>
      </motion.div>
    </div>
  );
};
