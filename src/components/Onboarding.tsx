/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { UserProfile, FitnessGoal, ExperienceLevel } from '../types';
import { EQUIPMENT_OPTIONS, DAYS_OPTIONS } from '../constants';
import Logo from './Logo';
import { ChevronRight, ChevronLeft, Dumbbell, Target, User, Calendar } from 'lucide-react';

interface OnboardingProps {
  onComplete: (profile: UserProfile) => void | Promise<void>;
  key?: string;
}

export default function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState(1);
  const [profile, setProfile] = useState<Partial<UserProfile>>({
    equipment: [],
    daysPerWeek: 3,
  });

  const nextStep = () => setStep(s => s + 1);
  const prevStep = () => setStep(s => s - 1);

  const handleComplete = () => {
    if (profile.name && profile.age && profile.weight && profile.height && profile.goal && profile.level) {
      onComplete(profile as UserProfile);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
            <div className="flex items-center gap-3 mb-8">
              <User className="text-blue-500" size={32} />
              <h2 className="text-3xl font-bold">Wer bist du?</h2>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Name</label>
                <input
                  type="text"
                  value={profile.name || ''}
                  onChange={e => setProfile({ ...profile, name: e.target.value })}
                  placeholder="Alpha-Athlet"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-4 focus:border-blue-500 outline-none transition-colors"
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Alter</label>
                  <input
                    type="number"
                    value={profile.age || ''}
                    onChange={e => setProfile({ ...profile, age: Number(e.target.value) })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-4 focus:border-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Gewicht (kg)</label>
                  <input
                    type="number"
                    value={profile.weight || ''}
                    onChange={e => setProfile({ ...profile, weight: Number(e.target.value) })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-4 focus:border-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Größe (cm)</label>
                  <input
                    type="number"
                    value={profile.height || ''}
                    onChange={e => setProfile({ ...profile, height: Number(e.target.value) })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-4 focus:border-blue-500 outline-none"
                  />
                </div>
              </div>
            </div>
          </motion.div>
        );
      case 2:
        return (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
            <div className="flex items-center gap-3 mb-8">
              <Target className="text-blue-500" size={32} />
              <h2 className="text-3xl font-bold">Was ist dein Ziel?</h2>
            </div>
            <div className="grid grid-cols-1 gap-3">
              {Object.values(FitnessGoal).map(goal => (
                <button
                  key={goal}
                  onClick={() => setProfile({ ...profile, goal })}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    profile.goal === goal ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20' : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  {goal}
                </button>
              ))}
            </div>
          </motion.div>
        );
      case 3:
        return (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
            <div className="flex items-center gap-3 mb-8">
              <Dumbbell className="text-blue-500" size={32} />
              <h2 className="text-3xl font-bold">Basis-Daten</h2>
            </div>
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-3">Trainingstage pro Woche</label>
                <div className="flex gap-2">
                  {DAYS_OPTIONS.map(days => (
                    <button
                      key={days}
                      onClick={() => setProfile({ ...profile, daysPerWeek: days })}
                      className={`flex-1 p-4 rounded-xl border transition-all ${
                        profile.daysPerWeek === days ? 'bg-blue-600 border-blue-500' : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'
                      }`}
                    >
                      {days}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-3">Erfahrung</label>
                <div className="flex gap-2">
                  {Object.values(ExperienceLevel).map(level => (
                    <button
                      key={level}
                      onClick={() => setProfile({ ...profile, level })}
                      className={`flex-1 p-3 text-sm rounded-xl border transition-all ${
                        profile.level === level ? 'bg-blue-600 border-blue-500' : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        );
      case 4:
        return (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
            <div className="flex items-center gap-3 mb-8">
              <Calendar className="text-blue-500" size={32} />
              <h2 className="text-3xl font-bold">Equipment</h2>
            </div>
            <div className="grid grid-cols-1 gap-2 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
              {EQUIPMENT_OPTIONS.map(eq => (
                <button
                  key={eq}
                  onClick={() => {
                    const current = profile.equipment || [];
                    if (current.includes(eq)) {
                      setProfile({ ...profile, equipment: current.filter(e => e !== eq) });
                    } else {
                      setProfile({ ...profile, equipment: [...current, eq] });
                    }
                  }}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    profile.equipment?.includes(eq) ? 'bg-blue-600 border-blue-500' : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  {eq}
                </button>
              ))}
            </div>
          </motion.div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-6 flex flex-col items-center justify-center">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-10">
          <Logo size={60} />
        </div>
        <div className="mb-12">
          <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
            <motion.div 
              className="h-full bg-blue-600" 
              initial={{ width: '25%' }}
              animate={{ width: `${(step / 4) * 100}%` }}
            />
          </div>
          <p className="text-center mt-2 text-zinc-500 text-sm">Schritt {step} von 4</p>
        </div>

        <AnimatePresence mode="wait">
          {renderStep()}
        </AnimatePresence>

        <div className="flex gap-4 mt-12">
          {step > 1 && (
            <button
              onClick={prevStep}
              className="flex-1 bg-zinc-900 border border-zinc-800 p-4 rounded-2xl flex items-center justify-center hover:bg-zinc-800 transition-colors"
            >
              <ChevronLeft />
            </button>
          )}
          <button
            onClick={step === 4 ? handleComplete : nextStep}
            disabled={step === 1 && !profile.name}
            className="flex-[2] bg-blue-600 p-4 rounded-2xl flex items-center justify-center font-bold gap-2 hover:bg-blue-500 transition-all active:scale-95 disabled:opacity-50"
          >
            {step === 4 ? 'Alpha-Plan erstellen' : 'Weiter'}
            {step !== 4 && <ChevronRight size={20} />}
          </button>
        </div>
      </div>
    </div>
  );
}
