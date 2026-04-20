import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Notification } from '../types';
import { motion, AnimatePresence } from 'motion/react';

export const NotificationCenter = ({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setNotifications(data || []);
    } catch (error: any) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen, user]);

  const markAsRead = async (id: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id);

      if (error) throw error;
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch (error: any) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user?.id)
        .eq('is_read', false);

      if (error) throw error;
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (error: any) {
      console.error('Error marking all as read:', error);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm"
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 h-screen w-full max-w-md z-[110] bg-[#1A1D24] border-l border-white/5 shadow-2xl flex flex-col"
          >
            <div className="p-6 border-b border-white/5 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-black text-white tracking-tight uppercase">Notifications</h2>
                <p className="text-[10px] text-white/40 font-black uppercase tracking-widest">Stay Updated</p>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={markAllAsRead}
                  className="text-[9px] font-black text-[var(--blue)] uppercase tracking-widest hover:underline"
                >
                  Mark all as read
                </button>
                <button 
                  onClick={onClose}
                  className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white/40 hover:text-white transition-colors"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar p-6 space-y-4">
              {loading ? (
                <div className="flex flex-col items-center justify-center h-full space-y-4">
                  <div className="w-8 h-8 border-2 border-[var(--blue)] border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : notifications.length > 0 ? (
                notifications.map((n) => (
                  <div 
                    key={n.id} 
                    onClick={() => !n.is_read && markAsRead(n.id)}
                    className={`p-5 rounded-3xl border transition-all cursor-pointer group relative overflow-hidden ${
                      n.is_read 
                        ? 'bg-white/2 border-white/5 opacity-60' 
                        : 'bg-white/5 border-white/10 hover:border-[var(--blue)]/30'
                    }`}
                  >
                    {!n.is_read && (
                      <div className="absolute top-5 right-5 w-2 h-2 rounded-full bg-[var(--blue)] shadow-[0_0_10px_#10B981]" />
                    )}
                    <div className="flex gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        n.type === 'success' ? 'bg-green-500/10 text-green-500' :
                        n.type === 'warning' ? 'bg-[var(--gold)]/10 text-[var(--gold)]' :
                        n.type === 'error' ? 'bg-red-500/10 text-red-500' :
                        'bg-[var(--blue)]/10 text-[var(--blue)]'
                      }`}>
                        <span className="material-symbols-outlined text-xl">
                          {n.type === 'success' ? 'check_circle' :
                           n.type === 'warning' ? 'warning' :
                           n.type === 'error' ? 'error' :
                           'info'}
                        </span>
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-sm font-black text-white tracking-tight">{n.title}</h4>
                        <p className="text-xs text-white/60 leading-relaxed">{n.message}</p>
                        <p className="text-[9px] text-white/30 font-black uppercase tracking-widest pt-1">
                          {new Date(n.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center space-y-4 opacity-20">
                  <span className="material-symbols-outlined text-6xl">notifications_off</span>
                  <p className="text-[10px] font-black uppercase tracking-widest">No notifications yet</p>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
