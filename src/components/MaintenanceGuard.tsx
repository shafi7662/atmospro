import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { motion } from 'motion/react';

export const MaintenanceGuard = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const [maintenance, setMaintenance] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkMaintenance = async () => {
      try {
        const { data } = await supabase.from('settings').select('maintenance_mode').maybeSingle();
        if (data?.maintenance_mode) {
          // Check if user is admin
          const { data: profile } = await supabase.from('profiles').select('role').eq('id', user?.id).maybeSingle();
          if (profile?.role !== 'admin') {
            setMaintenance(true);
          }
        }
      } catch (error) {
        console.error('Maintenance check error:', error);
      } finally {
        setLoading(false);
      }
    };

    checkMaintenance();
  }, [user]);

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[var(--bg)]">
        <div className="w-8 h-8 border-2 border-[#10B981] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (maintenance) {
    return (
      <div className="fixed inset-0 z-[200] bg-[#0F1115] flex flex-col items-center justify-center p-6 text-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="space-y-6 max-w-md"
        >
          <div className="w-24 h-24 rounded-full bg-[#10B981]/10 flex items-center justify-center mx-auto mb-8 border border-[#10B981]/20">
            <span className="material-symbols-outlined text-5xl text-[#10B981] animate-pulse">engineering</span>
          </div>
          <h1 className="text-3xl font-black text-white font-headline uppercase tracking-tighter">Under Maintenance</h1>
          <p className="text-[var(--ink-muted)] text-sm leading-relaxed">
            We are currently performing scheduled maintenance to improve your experience. 
            We'll be back online shortly. Thank you for your patience!
          </p>
          <div className="pt-8">
            <button 
              onClick={() => window.location.reload()}
              className="px-8 py-4 rounded-2xl bg-[#10B981] text-white font-black text-xs uppercase tracking-widest shadow-lg shadow-[#10B981]/20 active:scale-95 transition-all"
            >
              Refresh Status
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return <>{children}</>;
};
