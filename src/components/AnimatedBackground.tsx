import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';

export const AnimatedBackground = () => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  if (isMobile) {
    return (
      <div className="fixed inset-0 -z-10 bg-[#0F1115]" />
    );
  }

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none bg-[#0F1115]">
      {/* Cinematic Lighting - Top Left Source */}
      <div 
        className="absolute top-0 left-0 w-[100vw] h-[100vh] opacity-40"
        style={{
          background: "radial-gradient(circle at 20% 20%, rgba(59, 130, 246, 0.2) 0%, transparent 70%)"
        }}
      />
      
      {/* Soft Ambient Glows - Using CSS animations for better performance */}
      <div
        className="absolute top-[-10%] right-[-10%] w-[60vw] h-[60vw] rounded-full blur-[100px] bg-[#8B5CF6]/20 animate-bg-glow-1"
      />
      
      <div
        className="absolute bottom-[-20%] left-[10%] w-[70vw] h-[70vw] rounded-full blur-[120px] bg-[#3B82F6]/15 animate-bg-glow-2"
      />

      {/* Subtle Grid System */}
      <div 
        className="absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage: `linear-gradient(rgba(255, 255, 255, 0.1) 1px, transparent 1px), 
                           linear-gradient(90deg, rgba(255, 255, 255, 0.1) 1px, transparent 1px)`,
          backgroundSize: '60px 60px'
        }}
      />

      {/* Premium Reflections / Light Streaks */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="absolute h-[1px] w-[40vw] bg-gradient-to-r from-transparent via-white/20 to-transparent rotate-[-15deg] animate-light-streak"
            style={{
              top: `${20 + i * 30}%`,
              animationDelay: `${i * 5}s`,
              animationDuration: `${12 + i * 4}s`
            }}
          />
        ))}
      </div>

      {/* Noise Texture for Depth */}
      <div 
        className="absolute inset-0 opacity-[0.02] mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />
    </div>
  );
};
