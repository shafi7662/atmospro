import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Profile } from '../types';
import { toast } from 'sonner';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../lib/utils';

export const KYC = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    documentType: 'ID Card',
    documentNumber: '',
    documentUrl: '',
    selfieUrl: ''
  });

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
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (error) throw error;
      setProfile(data);
      if (data?.kyc_document_type) {
        setFormData(prev => ({
          ...prev,
          documentType: data.kyc_document_type || 'ID Card',
          documentNumber: data.kyc_document_number || '',
          documentUrl: data.kyc_document_url || '',
          selfieUrl: data.kyc_selfie_url || ''
        }));
      }
    } catch (error: any) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>, type: 'doc' | 'selfie') => {
    try {
      setUploading(true);
      if (!event.target.files || event.target.files.length === 0) {
        throw new Error('You must select an image to upload.');
      }

      const file = event.target.files[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `kyc-${type}-${user?.id}-${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`;

      let bucket = 'avatars'; // Reusing existing bucket for simplicity
      let { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filePath, file);

      if (uploadError && uploadError.message.toLowerCase().includes('bucket not found')) {
        bucket = 'products';
        const { error: fallbackError } = await supabase.storage
          .from(bucket)
          .upload(filePath, file);
        uploadError = fallbackError;
      }

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(filePath);

      if (type === 'doc') {
        setFormData(prev => ({ ...prev, documentUrl: publicUrl }));
      } else {
        setFormData(prev => ({ ...prev, selfieUrl: publicUrl }));
      }
      toast.success(`${type === 'doc' ? 'Document' : 'Selfie'} uploaded successfully!`);
    } catch (error: any) {
      toast.error(error.message || 'Error uploading image');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.documentNumber || !formData.documentUrl || !formData.selfieUrl) {
      toast.error('Please complete all fields and upload both your document and selfie.');
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          kyc_status: 'pending',
          kyc_document_type: formData.documentType,
          kyc_document_number: formData.documentNumber,
          kyc_document_url: formData.documentUrl,
          kyc_selfie_url: formData.selfieUrl
        })
        .eq('id', user?.id);

      if (error) throw error;
      toast.success('KYC application submitted successfully!');
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Error submitting KYC');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
        <div className="w-10 h-10 border-4 border-[var(--blue)] border-t-transparent rounded-full animate-spin"></div>
        <p className="text-on-surface-variant text-[10px] font-black uppercase tracking-widest animate-pulse">Verifying Status...</p>
      </div>
    );
  }

  const statusColors = {
    unverified: 'text-gray-400 bg-gray-400/10 border-gray-400/20',
    pending: 'text-[var(--gold)] bg-[var(--gold)]/10 border-[var(--gold)]/20',
    verified: 'text-green-500 bg-green-500/10 border-green-500/20',
    rejected: 'text-red-500 bg-red-500/10 border-red-500/20'
  };

  const statusIcons = {
    unverified: 'help',
    pending: 'hourglass_empty',
    verified: 'verified',
    rejected: 'cancel'
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-16 pb-20 max-w-3xl mx-auto px-4"
    >
      {/* Header */}
      <header className="flex items-center gap-10 pt-12 relative">
        <div className="absolute top-1/2 left-0 -translate-y-1/2 w-80 h-80 bg-emerald-400/5 blur-[120px] rounded-full -z-10 animate-pulse"></div>
        <motion.button
          whileHover={{ scale: 1.1, x: -6 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => navigate(-1)}
          className="w-16 h-16 rounded-[24px] glass-card flex items-center justify-center text-slate-500 hover:text-emerald-400 transition-all border-white/10 shadow-2xl group relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-emerald-400/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <span className="material-symbols-outlined group-hover:-translate-x-1 transition-transform text-2xl">arrow_back</span>
        </motion.button>
        <div className="space-y-3">
          <h1 className="text-5xl font-headline font-black text-white tracking-tighter uppercase leading-none">Identity Verification</h1>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1 bg-emerald-400/10 rounded-full border border-emerald-400/20 shadow-[0_0_15px_rgba(52,211,153,0.1)]">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></div>
              <span className="text-[9px] font-headline font-black uppercase tracking-widest text-emerald-400">Secure Protocol</span>
            </div>
            <p className="text-[10px] font-headline font-black uppercase tracking-[0.5em] text-slate-600">Compliance Matrix v2.4</p>
          </div>
        </div>
      </header>

      {/* Status Card */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className={cn(
          "glass-card rounded-[64px] p-16 text-center space-y-10 border relative overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.5)] transition-all duration-700",
          profile?.kyc_status === 'verified' ? "border-emerald-400/30 bg-emerald-400/[0.03] shadow-[0_0_80px_rgba(52,211,153,0.1)]" :
          profile?.kyc_status === 'pending' ? "border-blue-400/30 bg-blue-400/[0.03] shadow-[0_0_80px_rgba(96,165,250,0.1)]" :
          profile?.kyc_status === 'rejected' ? "border-red-400/30 bg-red-400/[0.03] shadow-[0_0_80px_rgba(248,113,113,0.1)]" :
          "border-white/5"
        )}
      >
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-transparent via-current to-transparent opacity-30"></div>
        <div className="absolute -top-24 -left-24 w-64 h-64 bg-current opacity-[0.03] blur-[80px] rounded-full"></div>
        
        <div className={cn(
          "w-32 h-32 rounded-[40px] flex items-center justify-center mx-auto border shadow-2xl transition-all duration-700 group relative",
          profile?.kyc_status === 'verified' ? "bg-emerald-400/10 border-emerald-400/20 text-emerald-400 shadow-[0_0_30px_rgba(52,211,153,0.2)]" :
          profile?.kyc_status === 'pending' ? "bg-blue-400/10 border-blue-400/20 text-blue-400 shadow-[0_0_30px_rgba(96,165,250,0.2)]" :
          profile?.kyc_status === 'rejected' ? "bg-red-400/10 border-red-400/20 text-red-400 shadow-[0_0_30px_rgba(248,113,113,0.2)]" :
          "bg-white/5 border-white/10 text-slate-800"
        )}>
          <div className="absolute inset-0 bg-current opacity-0 group-hover:opacity-10 rounded-[40px] transition-opacity"></div>
          <span className="material-symbols-outlined text-6xl group-hover:scale-110 transition-transform duration-500">
            {statusIcons[profile?.kyc_status || 'unverified']}
          </span>
        </div>
        
        <div className="space-y-6 relative z-10">
          <div className="space-y-2">
            <span className="text-[10px] font-headline font-black uppercase tracking-[0.5em] text-slate-600">Current Status</span>
            <h2 className={cn(
              "text-5xl font-headline font-black uppercase tracking-[0.3em] leading-none",
              profile?.kyc_status === 'verified' ? "text-emerald-400 drop-shadow-[0_0_20px_rgba(52,211,153,0.3)]" :
              profile?.kyc_status === 'pending' ? "text-blue-400 drop-shadow-[0_0_20px_rgba(96,165,250,0.3)]" :
              profile?.kyc_status === 'rejected' ? "text-red-400 drop-shadow-[0_0_20_rgba(248,113,113,0.3)]" :
              "text-white"
            )}>
              {profile?.kyc_status || 'unverified'}
            </h2>
          </div>
          <p className="text-base text-slate-500 max-w-lg mx-auto leading-relaxed font-headline font-medium uppercase tracking-widest px-4">
            {profile?.kyc_status === 'verified' 
              ? 'Your identity has been verified. You have full access to all platform features and premium liquidity nodes.'
              : profile?.kyc_status === 'pending'
              ? 'Your application is under protocol review. This usually takes 24-48 hours for full synchronization.'
              : profile?.kyc_status === 'rejected'
              ? `Your application was rejected: ${profile.kyc_rejection_reason || 'Please check your documents and try again.'}`
              : 'Please complete your identity verification to unlock higher withdrawal limits and premium AtmosPro features.'}
          </p>
        </div>
      </motion.div>

      {/* Submission Form */}
      {(!profile?.kyc_status || profile?.kyc_status === 'unverified' || profile?.kyc_status === 'rejected') && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-12"
        >
          <form onSubmit={handleSubmit} className="space-y-10">
            <div className="glass-card rounded-[56px] p-12 space-y-10 border-white/5 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-400/5 blur-[100px] -mr-32 -mt-32"></div>
              
              <div className="space-y-8 relative z-10">
                <div className="space-y-4">
                  <label className="text-[10px] font-headline font-black uppercase tracking-[0.4em] text-slate-600 px-2">Document Classification</label>
                  <div className="relative group">
                    <select
                      value={formData.documentType}
                      onChange={(e) => setFormData({ ...formData, documentType: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-3xl px-8 py-6 text-white font-headline font-black uppercase tracking-[0.2em] focus:outline-none focus:border-emerald-400/50 transition-all appearance-none cursor-pointer group-hover:bg-white/[0.07] shadow-inner"
                    >
                      <option value="ID Card">National ID Card</option>
                      <option value="Passport">International Passport</option>
                      <option value="Drivers License">Driver's License</option>
                    </select>
                    <span className="material-symbols-outlined absolute right-8 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none group-hover:text-emerald-400 transition-colors">expand_more</span>
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-headline font-black uppercase tracking-[0.4em] text-slate-600 px-2">Identification Serial</label>
                  <input
                    type="text"
                    placeholder="Enter document number"
                    value={formData.documentNumber}
                    onChange={(e) => setFormData({ ...formData, documentNumber: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-3xl px-8 py-6 text-white font-headline font-black tracking-[0.2em] focus:outline-none focus:border-emerald-400/50 transition-all placeholder:text-slate-800 shadow-inner hover:bg-white/[0.07]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-10">
                  <div className="space-y-5">
                    <label className="text-[10px] font-headline font-black uppercase tracking-[0.4em] text-slate-600 px-2 text-center block">Asset Scan</label>
                    <div 
                      onClick={() => !uploading && document.getElementById('doc-upload')?.click()}
                      className="w-full aspect-square rounded-[48px] border-2 border-dashed border-white/10 bg-white/[0.02] flex flex-col items-center justify-center cursor-pointer hover:border-emerald-400/30 transition-all overflow-hidden relative group shadow-inner"
                    >
                      {formData.documentUrl ? (
                        <>
                          <img src={formData.documentUrl} alt="Document" className="w-full h-full object-cover opacity-60 group-hover:opacity-100 group-hover:scale-110 transition-all duration-700" loading="lazy" referrerPolicy="no-referrer" />
                          <div className="absolute inset-0 bg-emerald-950/80 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-all duration-500">
                            <span className="material-symbols-outlined text-emerald-400 text-3xl mb-2">refresh</span>
                            <span className="text-emerald-400 text-[10px] font-headline font-black uppercase tracking-[0.3em]">Update Scan</span>
                          </div>
                        </>
                      ) : (
                        <div className="text-center space-y-4 px-8">
                          {uploading ? (
                            <div className="w-12 h-12 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin mx-auto shadow-[0_0_15px_rgba(52,211,153,0.3)]"></div>
                          ) : (
                            <>
                              <div className="w-20 h-20 rounded-[32px] bg-white/5 flex items-center justify-center mx-auto text-slate-900 group-hover:text-emerald-400/50 group-hover:bg-emerald-400/5 transition-all duration-500 border border-white/5">
                                <span className="material-symbols-outlined text-5xl">add_a_photo</span>
                              </div>
                              <span className="text-[10px] font-headline font-black uppercase tracking-[0.3em] text-slate-700 block">Upload Document</span>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                    <input
                      id="doc-upload"
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={(e) => handleUpload(e, 'doc')}
                      className="hidden"
                    />
                  </div>

                  <div className="space-y-5">
                    <label className="text-[10px] font-headline font-black uppercase tracking-[0.4em] text-slate-600 px-2 text-center block">Biometric Sync</label>
                    <div 
                      onClick={() => !uploading && document.getElementById('selfie-upload')?.click()}
                      className="w-full aspect-square rounded-[48px] border-2 border-dashed border-white/10 bg-white/[0.02] flex flex-col items-center justify-center cursor-pointer hover:border-emerald-400/30 transition-all overflow-hidden relative group shadow-inner"
                    >
                      {formData.selfieUrl ? (
                        <>
                          <img src={formData.selfieUrl} alt="Selfie" className="w-full h-full object-cover opacity-60 group-hover:opacity-100 group-hover:scale-110 transition-all duration-700" loading="lazy" referrerPolicy="no-referrer" />
                          <div className="absolute inset-0 bg-emerald-950/80 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-all duration-500">
                            <span className="material-symbols-outlined text-emerald-400 text-3xl mb-2">refresh</span>
                            <span className="text-emerald-400 text-[10px] font-headline font-black uppercase tracking-[0.3em]">Update Biometric</span>
                          </div>
                        </>
                      ) : (
                        <div className="text-center space-y-4 px-8">
                          {uploading ? (
                            <div className="w-12 h-12 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin mx-auto shadow-[0_0_15px_rgba(52,211,153,0.3)]"></div>
                          ) : (
                            <>
                              <div className="w-20 h-20 rounded-[32px] bg-white/5 flex items-center justify-center mx-auto text-slate-900 group-hover:text-emerald-400/50 group-hover:bg-emerald-400/5 transition-all duration-500 border border-white/5">
                                <span className="material-symbols-outlined text-5xl">face</span>
                              </div>
                              <span className="text-[10px] font-headline font-black uppercase tracking-[0.3em] text-slate-700 block">Upload Selfie</span>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                    <input
                      id="selfie-upload"
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleUpload(e, 'selfie')}
                      className="hidden"
                    />
                  </div>
                </div>
              </div>

              <motion.button
                whileHover={{ scale: 1.05, y: -4 }}
                whileTap={{ scale: 0.95 }}
                type="submit"
                disabled={submitting || uploading}
                className="w-full py-7 rounded-3xl bg-emerald-400 text-emerald-950 text-xs font-headline font-black uppercase tracking-[0.5em] shadow-[0_0_50px_rgba(52,211,153,0.3)] active:scale-95 transition-all disabled:opacity-50 relative overflow-hidden group"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                {submitting ? 'Initializing Verification...' : 'Submit Protocol Data'}
              </motion.button>
            </div>
          </form>
        </motion.div>
      )}

      {/* Info Section */}
      <div className="grid grid-cols-1 gap-10">
        <div className="glass-card rounded-[48px] p-12 flex items-start gap-10 border-white/5 hover:bg-white/[0.03] transition-all group shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-40 h-40 bg-emerald-400/5 blur-[60px] -mr-12 -mt-12"></div>
          <div className="w-20 h-20 rounded-[28px] bg-emerald-400/10 flex items-center justify-center text-emerald-400 shrink-0 border border-emerald-400/20 group-hover:scale-110 transition-all duration-700 shadow-[0_0_30px_rgba(52,211,153,0.15)]">
            <span className="material-symbols-outlined text-4xl">security</span>
          </div>
          <div className="space-y-4 relative z-10">
            <h3 className="text-xl font-headline font-black text-white uppercase tracking-[0.2em]">Encrypted Data Vault</h3>
            <p className="text-[11px] text-slate-600 leading-relaxed font-headline font-medium uppercase tracking-[0.3em]">
              Your documents are processed through an end-to-end encrypted protocol. We strictly adhere to global privacy standards and ISO/IEC 27001 for identity verification and data sovereignty.
            </p>
          </div>
        </div>
        
        <div className="glass-card rounded-[48px] p-12 flex items-start gap-10 border-white/5 hover:bg-white/[0.03] transition-all group shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-40 h-40 bg-blue-400/5 blur-[60px] -mr-12 -mt-12"></div>
          <div className="w-20 h-20 rounded-[28px] bg-blue-400/10 flex items-center justify-center text-blue-400 shrink-0 border border-blue-400/20 group-hover:scale-110 transition-all duration-700 shadow-[0_0_30px_rgba(96,165,250,0.15)]">
            <span className="material-symbols-outlined text-4xl">speed</span>
          </div>
          <div className="space-y-4 relative z-10">
            <h3 className="text-xl font-headline font-black text-white uppercase tracking-[0.2em]">Rapid Matrix Review</h3>
            <p className="text-[11px] text-slate-600 leading-relaxed font-headline font-medium uppercase tracking-[0.3em]">
              Our automated compliance matrix typically processes applications within 24 hours. You will receive a secure encrypted notification upon status update in your AtmosPro dashboard.
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
