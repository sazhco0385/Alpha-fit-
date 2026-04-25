/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion } from 'motion/react';
import { Trophy, Zap, Shield, Flame, Target, Star } from 'lucide-react';

interface Badge {
  id: string;
  name: string;
  description: string;
  xpRequired: number;
  icon: React.ReactNode;
  color: string;
}

const BADGES: Badge[] = [
  { id: 'novice', name: 'Alpha-Starter', description: 'Erstes Training begonnen', xpRequired: 0, icon: <Zap size={24} />, color: 'text-yellow-500' },
  { id: 'consistent', name: 'Diszipliniert', description: '500 XP erreicht', xpRequired: 500, icon: <Shield size={24} />, color: 'text-blue-500' },
  { id: 'warrior', name: 'Alpha-Krieger', description: '1500 XP erreicht', xpRequired: 1500, icon: <Flame size={24} />, color: 'text-orange-500' },
  { id: 'elite', name: 'Elite-Status', description: '3000 XP erreicht', xpRequired: 3000, icon: <Star size={24} />, color: 'text-purple-500' },
  { id: 'titan', name: 'Titan', description: 'Meister der Alpha-Klasse (5000 XP)', xpRequired: 5000, icon: <Trophy size={24} />, color: 'text-red-500' },
];

interface BadgeSystemProps {
  currentXP: number;
}

export default function BadgeSystem({ currentXP }: BadgeSystemProps) {
  const currentLevel = Math.floor(currentXP / 1000) + 1;
  const progressToNextLevel = (currentXP % 1000) / 10;

  return (
    <section className="space-y-6">
      {/* XP Bar */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-xl">
        <div className="flex justify-between items-end mb-4">
          <div>
            <span className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Level {currentLevel}</span>
            <h3 className="text-2xl font-black">ALPHA FORTSCHRITT</h3>
          </div>
          <div className="text-right">
            <span className="text-blue-500 font-black text-2xl">{currentXP}</span>
            <span className="text-zinc-600 font-bold text-sm ml-1">XP</span>
          </div>
        </div>
        
        <div className="h-4 w-full bg-black rounded-full p-1 border border-zinc-800">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${progressToNextLevel}%` }}
            className="h-full bg-blue-600 rounded-full shadow-[0_0_15px_rgba(37,99,235,0.5)]"
          />
        </div>
        <p className="text-zinc-500 text-xs mt-3 text-center font-medium">Noch {1000 - (currentXP % 1000)} XP bis zum nächsten Level</p>
      </div>

      {/* Badges Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {BADGES.map((badge) => {
          const isUnlocked = currentXP >= badge.xpRequired;
          return (
            <motion.div
              key={badge.id}
              whileHover={isUnlocked ? { scale: 1.05 } : {}}
              className={`p-4 rounded-3xl border transition-all flex flex-col items-center text-center gap-3 ${
                isUnlocked 
                  ? 'bg-zinc-900/50 border-zinc-700 shadow-lg' 
                  : 'bg-zinc-950 border-zinc-900 opacity-40 grayscale'
              }`}
            >
              <div className={`p-3 rounded-2xl ${isUnlocked ? 'bg-zinc-800' : 'bg-transparent'}`}>
                {React.cloneElement(badge.icon as React.ReactElement, { 
                  className: isUnlocked ? badge.color : 'text-zinc-800' 
                })}
              </div>
              <div>
                <h4 className="font-black text-sm uppercase tracking-tight">{badge.name}</h4>
                <p className="text-[10px] text-zinc-500 leading-tight mt-1">{badge.description}</p>
              </div>
              {!isUnlocked && (
                <div className="mt-auto pt-2 border-t border-zinc-900 w-full">
                  <span className="text-[9px] font-bold text-zinc-700 uppercase">{badge.xpRequired} XP</span>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
