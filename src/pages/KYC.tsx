import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Profile } from '../types';
import { toast } from 'sonner';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';

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
      className="space-y-8 pb-10 max-w-2xl mx-auto px-4"
    >
      {/* Header */}
      <div className="flex items-center gap-4 pt-6">
        <button
          onClick={() => navigate(-1)}
          className="w-10 h-10 rounded-xl bg-surface-container flex items-center justify-center text-on-surface-variant hover:text-[var(--blue)] transition-colors"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <div>
          <h1 className="text-2xl font-black text-on-surface tracking-tight">Identity Verification</h1>
          <p className="text-[10px] text-on-surface-variant font-black uppercase tracking-widest">KYC System</p>
        </div>
      </div>

      {/* Status Card */}
      <div className={`premium-card rounded-[32px] p-8 text-center space-y-4 border ${statusColors[profile?.kyc_status || 'unverified']} ${!isMobile ? 'rainbow-glow' : ''}`}>
        <div className="w-16 h-16 rounded-full bg-surface-container flex items-center justify-center mx-auto">
          <span className={`material-symbols-outlined text-3xl ${statusColors[profile?.kyc_status || 'unverified'].split(' ')[0]}`}>
            {statusIcons[profile?.kyc_status || 'unverified']}
          </span>
        </div>
        <div className="space-y-1">
          <h2 className="text-xl font-black text-on-surface uppercase tracking-widest">
            {profile?.kyc_status || 'unverified'}
          </h2>
          <p className="text-xs text-on-surface-variant max-w-xs mx-auto">
            {profile?.kyc_status === 'verified' 
              ? 'Your identity has been verified. You have full access to all platform features.'
              : profile?.kyc_status === 'pending'
              ? 'Your application is under review. This usually takes 24-48 hours.'
              : profile?.kyc_status === 'rejected'
              ? `Your application was rejected: ${profile.kyc_rejection_reason || 'Please check your documents and try again.'}`
              : 'Please complete your identity verification to unlock higher withdrawal limits and premium features.'}
          </p>
        </div>
      </div>

      {/* Submission Form */}
      {(!profile?.kyc_status || profile?.kyc_status === 'unverified' || profile?.kyc_status === 'rejected') && (
        <div className="space-y-8">
          <form onSubmit={handleSubmit} className="space-y-6">
          <div className={`premium-card rounded-[32px] p-8 space-y-6 ${!isMobile ? 'rainbow-glow' : ''}`}>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant px-1">Document Type</label>
                <select
                  value={formData.documentType}
                  onChange={(e) => setFormData({ ...formData, documentType: e.target.value })}
                  className="w-full bg-surface-container border border-line/10 rounded-2xl px-5 py-4 text-on-surface focus:outline-none focus:border-[var(--blue)]/50 transition-all appearance-none"
                >
                  <option value="ID Card">National ID Card</option>
                  <option value="Passport">International Passport</option>
                  <option value="Drivers License">Driver's License</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant px-1">Document Number</label>
                <input
                  type="text"
                  placeholder="Enter your document number"
                  value={formData.documentNumber}
                  onChange={(e) => setFormData({ ...formData, documentNumber: e.target.value })}
                  className="w-full bg-surface-container border border-line/10 rounded-2xl px-5 py-4 text-on-surface focus:outline-none focus:border-[var(--blue)]/50 transition-all"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant px-1">Document Photo</label>
                  <div 
                    onClick={() => !uploading && document.getElementById('doc-upload')?.click()}
                    className="w-full aspect-square rounded-3xl border-2 border-dashed border-line/20 bg-surface-container flex flex-col items-center justify-center cursor-pointer hover:border-[var(--blue)]/30 transition-all overflow-hidden relative group"
                  >
                    {formData.documentUrl ? (
                      <>
                        <img src={formData.documentUrl} alt="Document" className="w-full h-full object-cover" loading="lazy" referrerPolicy="no-referrer" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                          <span className="text-white text-[10px] font-black uppercase tracking-widest">Change Photo</span>
                        </div>
                      </>
                    ) : (
                      <>
                        {uploading ? (
                          <div className="w-8 h-8 border-2 border-[var(--blue)] border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                          <>
                            <span className="material-symbols-outlined text-4xl text-on-surface-variant/30 mb-2">add_a_photo</span>
                            <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant text-center px-4">No Photo Selected</span>
                          </>
                        )}
                      </>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => document.getElementById('doc-upload')?.click()}
                    className="w-full py-3 rounded-xl bg-surface-container border border-line/10 text-[10px] font-black uppercase tracking-widest text-on-surface hover:bg-surface-container-high transition-all flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined text-sm">attach_file</span>
                    {formData.documentUrl ? 'Change Document File' : 'Select Document File'}
                  </button>
                  <input
                    id="doc-upload"
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(e) => handleUpload(e, 'doc')}
                    className="hidden"
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant px-1">Selfie with Document</label>
                  <div 
                    onClick={() => !uploading && document.getElementById('selfie-upload')?.click()}
                    className="w-full aspect-square rounded-3xl border-2 border-dashed border-line/20 bg-surface-container flex flex-col items-center justify-center cursor-pointer hover:border-[var(--blue)]/30 transition-all overflow-hidden relative group"
                  >
                    {formData.selfieUrl ? (
                      <>
                        <img src={formData.selfieUrl} alt="Selfie" className="w-full h-full object-cover" loading="lazy" referrerPolicy="no-referrer" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                          <span className="text-white text-[10px] font-black uppercase tracking-widest">Change Photo</span>
                        </div>
                      </>
                    ) : (
                      <>
                        {uploading ? (
                          <div className="w-8 h-8 border-2 border-[var(--blue)] border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                          <>
                            <span className="material-symbols-outlined text-4xl text-on-surface-variant/30 mb-2">face</span>
                            <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant text-center px-4">No Selfie Selected</span>
                          </>
                        )}
                      </>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => document.getElementById('selfie-upload')?.click()}
                    className="w-full py-3 rounded-xl bg-surface-container border border-line/10 text-[10px] font-black uppercase tracking-widest text-on-surface hover:bg-surface-container-high transition-all flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined text-sm">face</span>
                    {formData.selfieUrl ? 'Change Selfie File' : 'Select Selfie File'}
                  </button>
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

            <button
              type="submit"
              disabled={submitting || uploading}
              className="w-full py-5 rounded-2xl btn-primary text-[11px] font-black uppercase tracking-[0.3em] shadow-lg active:scale-95 transition-all disabled:opacity-50"
            >
              {submitting ? 'Submitting...' : 'Submit Verification'}
            </button>
          </div>
        </form>
      </div>
      )}

      {/* Info Section */}
      <div className="grid grid-cols-1 gap-4">
        <div className="glass-card rounded-2xl p-6 flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-[var(--blue)]/10 flex items-center justify-center text-[var(--blue)] shrink-0">
            <span className="material-symbols-outlined">security</span>
          </div>
          <div className="space-y-1">
            <h3 className="text-xs font-black text-on-surface uppercase tracking-widest">Secure Storage</h3>
            <p className="text-[10px] text-on-surface-variant leading-relaxed">
              Your documents are encrypted and stored securely. We only use this information for identity verification purposes.
            </p>
          </div>
        </div>
        
        <div className="glass-card rounded-2xl p-6 flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-[var(--gold)]/10 flex items-center justify-center text-[var(--gold)] shrink-0">
            <span className="material-symbols-outlined">speed</span>
          </div>
          <div className="space-y-1">
            <h3 className="text-xs font-black text-on-surface uppercase tracking-widest">Fast Review</h3>
            <p className="text-[10px] text-on-surface-variant leading-relaxed">
              Our compliance team typically reviews applications within 24 hours. You will be notified once your status changes.
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
