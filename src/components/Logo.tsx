/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion } from 'motion/react';

interface LogoProps {
  className?: string;
  size?: number;
}

export default function Logo({ className = "", size = 100 }: LogoProps) {
  return (
    <div className={`relative flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
      {/* Glow Effect */}
      <div className="absolute inset-0 bg-blue-500/20 blur-[30px] rounded-full scale-150 animate-pulse" />
      
      <svg
        viewBox="0 0 100 100"
        className="w-full h-full relative z-10"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Shield Background */}
        <path
          d="M50 5 L15 20 C15 20 15 60 50 95 C85 60 85 20 85 20 L50 5Z"
          fill="url(#shieldGradient)"
          stroke="#3B82F6"
          strokeWidth="1.5"
          className="drop-shadow-[0_0_10px_rgba(59,130,246,0.5)]"
        />
        
        {/* Muscular Figure Silhouette */}
        <path
          d="M50 25 C45 25 42 28 40 32 C35 30 30 32 28 38 C28 45 35 50 40 52 L40 70 L50 75 L60 70 L60 52 C65 50 72 45 72 38 C70 32 65 30 60 32 C58 28 55 25 50 25Z"
          fill="url(#silverGradient)"
          className="drop-shadow-[0_0_5px_rgba(255,255,255,0.3)]"
        />
        
        {/* Glowing "A" */}
        <path
          d="M50 35 L42 55 H48 L50 50 L52 55 H58 L50 35Z"
          fill="#3B82F6"
          className="animate-pulse shadow-[0_0_15px_rgba(59,130,246,1)]"
        />
        <path
          d="M45 50 H55"
          stroke="#3B82F6"
          strokeWidth="2"
          strokeLinecap="round"
        />

        <defs>
          <linearGradient id="shieldGradient" x1="50" y1="5" x2="50" y2="95" gradientUnits="userSpaceOnUse">
            <stop stopColor="#111827" />
            <stop offset="1" stopColor="#030712" />
          </linearGradient>
          <linearGradient id="silverGradient" x1="50" y1="25" x2="50" y2="75" gradientUnits="userSpaceOnUse">
            <stop stopColor="#F9FAFB" />
            <stop offset="0.5" stopColor="#9CA3AF" />
            <stop offset="1" stopColor="#4B5563" />
          </linearGradient>
        </defs>
      </svg>
      
      {/* Star sparkle at top */}
      <motion.div
        animate={{ opacity: [0.5, 1, 0.5], scale: [0.8, 1.2, 0.8] }}
        transition={{ repeat: Infinity, duration: 1.5 }}
        className="absolute top-[-5%] left-1/2 -translate-x-1/2 w-4 h-4 bg-white blur-[2px] rounded-full shadow-[0_0_15px_white]"
      />
    </div>
  );
}
