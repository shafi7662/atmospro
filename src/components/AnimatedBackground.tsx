import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { useTheme } from '../context/ThemeContext';

export const AnimatedBackground = () => {
  const [isMobile, setIsMobile] = useState(false);
  const { theme } = useTheme();

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  if (isMobile) {
    return (
      <div className="fixed inset-0 -z-10 bg-[var(--bg)]" />
    );
  }

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none bg-[var(--bg)]">
      {/* Cinematic Mesh Gradient */}
      <div 
        className="absolute inset-0 opacity-40"
        style={{
          background: theme === 'dark' ? `
            radial-gradient(circle at 20% 20%, rgba(16, 185, 129, 0.15) 0%, transparent 50%),
            radial-gradient(circle at 80% 10%, rgba(30, 64, 175, 0.1) 0%, transparent 50%),
            radial-gradient(circle at 50% 90%, rgba(245, 158, 11, 0.05) 0%, transparent 50%),
            radial-gradient(circle at 10% 80%, rgba(16, 185, 129, 0.1) 0%, transparent 50%)
          ` : `
            radial-gradient(circle at 20% 20%, rgba(16, 185, 129, 0.12) 0%, transparent 50%),
            radial-gradient(circle at 80% 10%, rgba(30, 64, 175, 0.1) 0%, transparent 50%),
            radial-gradient(circle at 50% 90%, rgba(245, 158, 11, 0.08) 0%, transparent 50%),
            radial-gradient(circle at 10% 80%, rgba(16, 185, 129, 0.1) 0%, transparent 50%)
          `
        }}
      />
      
      {/* Soft Ambient Glows */}
      <div
        className="absolute top-[-20%] right-[-10%] w-[80vw] h-[80vw] rounded-full blur-[120px] bg-[#1E40AF]/10 animate-bg-glow-1"
        style={{ opacity: theme === 'dark' ? 1 : 0.6 }}
      />
      
      <div
        className="absolute bottom-[-30%] left-[-10%] w-[90vw] h-[90vw] rounded-full blur-[150px] bg-[#10B981]/10 animate-bg-glow-2"
        style={{ opacity: theme === 'dark' ? 1 : 0.6 }}
      />

      {/* Modern Grid System - Thinner and more subtle */}
      <div 
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: theme === 'dark' ? `linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px), 
                           linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px)` :
                           `linear-gradient(rgba(15, 23, 42, 0.1) 1px, transparent 1px), 
                           linear-gradient(90deg, rgba(15, 23, 42, 0.1) 1px, transparent 1px)`,
          backgroundSize: '100px 100px'
        }}
      />

      {/* Noise Texture for High-End Feel */}
      <div 
        className="absolute inset-0 opacity-[0.015] mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />
    </div>
  );
};
