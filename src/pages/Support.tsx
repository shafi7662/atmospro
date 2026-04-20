import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { SupportTicket } from '../types';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';

export const Support = () => {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showNewTicket, setShowNewTicket] = useState(false);
  const [formData, setFormData] = useState({ subject: '', message: '' });
  const navigate = useNavigate();

  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const fetchTickets = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('support_tickets')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTickets(data || []);
    } catch (error: any) {
      console.error('Error fetching tickets:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.subject || !formData.message) {
      toast.error('Please fill in all fields');
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('support_tickets')
        .insert([{
          user_id: user?.id,
          subject: formData.subject,
          message: formData.message,
          status: 'open'
        }]);

      if (error) throw error;
      toast.success('Support ticket submitted successfully!');
      setFormData({ subject: '', message: '' });
      setShowNewTicket(false);
      fetchTickets();
    } catch (error: any) {
      toast.error(error.message || 'Error submitting ticket');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
        <div className="w-10 h-10 border-4 border-[var(--blue)] border-t-transparent rounded-full animate-spin"></div>
        <p className="text-on-surface-variant text-[10px] font-black uppercase tracking-widest animate-pulse">Loading Support...</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8 pb-10 max-w-4xl mx-auto px-4"
    >
      {/* Header */}
      <header className="flex items-center justify-between pt-12 relative">
        <div className="absolute top-1/2 left-0 -translate-y-1/2 w-64 h-64 bg-blue-500/5 blur-[100px] rounded-full -z-10 animate-pulse"></div>
        <div className="flex items-center gap-8">
          <motion.button
            whileHover={{ scale: 1.1, x: -4 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => navigate(-1)}
            className="w-14 h-14 rounded-2xl glass-card flex items-center justify-center text-slate-500 hover:text-blue-400 transition-all border-white/10 shadow-xl group"
          >
            <span className="material-symbols-outlined group-hover:-translate-x-1 transition-transform text-2xl">arrow_back</span>
          </motion.button>
          <div className="space-y-2">
            <h1 className="text-4xl font-headline font-black text-white tracking-tighter uppercase leading-none">Support Matrix</h1>
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>
              <p className="text-[10px] font-headline font-black uppercase tracking-[0.4em] text-slate-600">AtmosPro Assistance Protocol</p>
            </div>
          </div>
        </div>
        <motion.button
          whileHover={{ scale: 1.05, y: -2 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowNewTicket(true)}
          className="px-8 py-4 rounded-2xl bg-blue-500 text-white text-[11px] font-headline font-black uppercase tracking-[0.3em] shadow-[0_0_30px_rgba(59,130,246,0.3)] hover:shadow-[0_0_50px_rgba(59,130,246,0.5)] transition-all"
        >
          Initialize Ticket
        </motion.button>
      </header>

      {/* Tickets List */}
      <div className="space-y-8">
        {tickets.length > 0 ? (
          tickets.map((ticket, idx) => (
            <motion.div 
              key={ticket.id} 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="glass-card rounded-[40px] p-10 space-y-8 border-white/5 shadow-2xl relative overflow-hidden group hover:bg-white/[0.02] transition-all"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-400/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
              
              <div className="flex items-start justify-between relative z-10">
                <div className="space-y-3">
                  <h3 className="text-2xl font-headline font-black text-white tracking-tight group-hover:text-blue-400 transition-colors uppercase">{ticket.subject}</h3>
                  <div className="flex items-center gap-4">
                    <p className="text-[10px] text-slate-600 font-headline font-black uppercase tracking-[0.3em]">
                      {new Date(ticket.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                    <div className="w-1 h-1 rounded-full bg-slate-800"></div>
                    <p className="text-[10px] text-blue-400/50 font-headline font-black uppercase tracking-[0.3em]">
                      ID: {ticket.id.slice(0, 8)}
                    </p>
                  </div>
                </div>
                <div className={cn(
                  "px-5 py-2 rounded-xl text-[9px] font-headline font-black uppercase tracking-widest border shadow-lg",
                  ticket.status === 'open' ? "bg-emerald-400/10 text-emerald-400 border-emerald-400/20 shadow-emerald-400/5" :
                  ticket.status === 'pending' ? "bg-amber-400/10 text-amber-400 border-amber-400/20 shadow-amber-400/5" :
                  "bg-white/5 text-slate-600 border-white/10"
                )}>
                  {ticket.status}
                </div>
              </div>
              
              <div className="p-8 rounded-[32px] bg-white/[0.02] border border-white/5 shadow-inner group-hover:bg-white/[0.04] transition-all relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-blue-400/10"></div>
                <p className="text-sm text-slate-400 leading-relaxed font-medium">{ticket.message}</p>
              </div>

              {ticket.admin_reply && (
                <motion.div 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="p-8 rounded-[32px] bg-blue-500/[0.03] border border-blue-400/20 space-y-4 relative overflow-hidden shadow-xl"
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-blue-400/5 blur-[40px] -mr-10 -mt-10"></div>
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-blue-400/10 flex items-center justify-center border border-blue-400/20">
                      <span className="material-symbols-outlined text-xl text-blue-400">support_agent</span>
                    </div>
                    <span className="text-[10px] font-headline font-black text-blue-400 uppercase tracking-[0.4em]">Protocol Response</span>
                  </div>
                  <p className="text-sm text-white leading-relaxed font-medium pl-2 border-l-2 border-blue-400/30">{ticket.admin_reply}</p>
                </motion.div>
              )}
            </motion.div>
          ))
        ) : (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-40 space-y-10 glass-card rounded-[64px] border-white/5 shadow-2xl relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-white/[0.01]"></div>
            <div className="w-40 h-40 rounded-[48px] bg-white/5 flex items-center justify-center mx-auto text-slate-900 border border-white/5 shadow-inner group relative z-10">
              <span className="material-symbols-outlined text-7xl group-hover:rotate-12 transition-transform duration-700">contact_support</span>
            </div>
            <div className="space-y-6 relative z-10">
              <p className="text-3xl font-headline font-black uppercase tracking-[0.5em] text-white">No Active Tickets</p>
              <p className="text-[11px] text-slate-700 font-headline font-black uppercase tracking-[0.4em] max-w-sm mx-auto leading-relaxed">Need assistance? Initialize a support node and our matrix team will synchronize with you.</p>
            </div>
          </motion.div>
        )}
      </div>

      {/* New Ticket Modal */}
      <AnimatePresence>
        {showNewTicket && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] flex items-center justify-center px-6 bg-background/95 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.9, y: 30 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 30 }}
              className="glass-card rounded-[56px] p-12 w-full max-w-lg border-white/10 shadow-[0_0_100px_rgba(0,0,0,0.6)] relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-transparent to-emerald-500/10 z-0 animate-pulse"></div>
              
              <div className="relative z-10 space-y-10">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-6">
                    <div className="w-16 h-16 bg-blue-400/10 rounded-[24px] flex items-center justify-center text-blue-400 shadow-[0_0_30px_rgba(59,130,246,0.25)] border border-blue-400/20">
                      <span className="material-symbols-outlined text-4xl">add_comment</span>
                    </div>
                    <div>
                      <h2 className="text-3xl font-headline font-black text-white tracking-tight uppercase">New Ticket</h2>
                      <p className="text-[11px] text-slate-500 font-headline font-black uppercase tracking-[0.3em]">Initialize Support Node</p>
                    </div>
                  </div>
                  <motion.button 
                    whileHover={{ scale: 1.1, rotate: 90 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setShowNewTicket(false)}
                    className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-slate-500 hover:text-white transition-colors border border-white/10"
                  >
                    <span className="material-symbols-outlined">close</span>
                  </motion.button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-8">
                  <div className="space-y-3">
                    <label className="text-[11px] font-headline font-black uppercase tracking-[0.4em] text-slate-500 px-2">Subject Classification</label>
                    <input
                      type="text"
                      placeholder="e.g. Node Synchronization Issue"
                      value={formData.subject}
                      onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-[24px] px-8 py-5 text-white font-medium focus:outline-none focus:border-blue-400/50 transition-all shadow-inner placeholder:text-slate-700"
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[11px] font-headline font-black uppercase tracking-[0.4em] text-slate-500 px-2">Detailed Message</label>
                    <textarea
                      placeholder="Describe your protocol issue in detail..."
                      rows={5}
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-[32px] px-8 py-6 text-white font-medium focus:outline-none focus:border-blue-400/50 transition-all resize-none shadow-inner placeholder:text-slate-700"
                    />
                  </div>

                  <motion.button
                    type="submit"
                    disabled={submitting}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full py-6 rounded-[28px] bg-blue-500 text-white font-headline font-black uppercase tracking-[0.4em] text-xs shadow-[0_0_40px_rgba(59,130,246,0.3)] hover:shadow-[0_0_60px_rgba(59,130,246,0.4)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? 'Synchronizing...' : 'Transmit Ticket'}
                  </motion.button>
                </form>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
