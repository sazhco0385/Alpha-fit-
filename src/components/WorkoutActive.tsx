/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Exercise } from '../types';
import { CheckCircle2, Play, Info, ArrowUpCircle, Weight, Timer, FastForward } from 'lucide-react';
import { getProgressionRecommendation } from '../services/geminiService';

interface WorkoutActiveProps {
  workout: { day: string; exercises: Exercise[] };
  onFinish: () => void;
  onSaveProgress: (exerciseName: string, weight: number, reps: number) => void;
}

export default function WorkoutActive({ workout, onFinish, onSaveProgress }: WorkoutActiveProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentSet, setCurrentSet] = useState(1);
  const [isResting, setIsResting] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [showingAnalysis, setShowingAnalysis] = useState(false);
  const [recommendation, setRecommendation] = useState<string | null>(null);

  const currentExercise = workout.exercises[currentIndex];

  // Parse rest time string like "60s" or "90s"
  const getRestSeconds = (restStr: string) => {
    const seconds = parseInt(restStr.replace(/[^0-9]/g, ''));
    return isNaN(seconds) ? 60 : seconds;
  };

  useEffect(() => {
    let timer: number;
    if (isResting && timeLeft > 0) {
      timer = window.setInterval(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
    } else if (isResting && timeLeft === 0) {
      handleRestComplete();
    }
    return () => clearInterval(timer);
  }, [isResting, timeLeft]);

  const handleSetComplete = async (reps: number, weight: number) => {
    const isLastSet = currentSet >= currentExercise.sets;
    
    // Progression logic (simplified: check if reps met target)
    const targetRepsStr = currentExercise.reps.split('-')[0] || currentExercise.reps;
    const targetReps = parseInt(targetRepsStr);

    if (reps >= targetReps && isLastSet) {
      setShowingAnalysis(true);
      const rec = await getProgressionRecommendation(currentExercise.name, weight, reps, targetReps);
      setRecommendation(rec || "Alpha-Leistung! Gewicht beim nächsten Mal erhöhen.");
    } else {
      startRest();
    }
  };

  const startRest = () => {
    const restTime = getRestSeconds(currentExercise.rest);
    setTimeLeft(restTime);
    setIsResting(true);
  };

  const handleRestComplete = () => {
    setIsResting(false);
    if (currentSet < currentExercise.sets) {
      setCurrentSet(prev => prev + 1);
    } else {
      goToNextExercise();
    }
  };

  const goToNextExercise = () => {
    setShowingAnalysis(false);
    setRecommendation(null);
    setCurrentSet(1);
    if (currentIndex < workout.exercises.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      onFinish();
    }
  };

  const totalRestTime = getRestSeconds(currentExercise.rest);
  const progress = (timeLeft / totalRestTime) * 100;

  return (
    <div className="flex flex-col h-full space-y-6">
      <div className="bg-zinc-900/50 p-6 rounded-3xl border border-zinc-900 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-blue-900/20 via-transparent to-transparent">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-zinc-500 text-xs font-bold uppercase tracking-[0.2em]">{workout.day}</h3>
          <span className="bg-blue-600/20 text-blue-400 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-blue-500/20">
            Satz {currentSet} / {currentExercise.sets}
          </span>
        </div>
        <h2 className="text-3xl font-black">{currentExercise.name}</h2>
        <div className="flex gap-4 mt-6">
          <div className="flex-1 bg-zinc-950 p-4 rounded-2xl border border-zinc-800 text-center">
            <span className="block text-zinc-500 text-[10px] uppercase tracking-wider mb-1">Ziel</span>
            <span className="text-xl font-bold">{currentExercise.reps} Reps</span>
          </div>
          <div className="flex-1 bg-zinc-950 p-4 rounded-2xl border border-zinc-800 text-center">
            <span className="block text-zinc-500 text-[10px] uppercase tracking-wider mb-1">Pause</span>
            <span className="text-xl font-bold">{currentExercise.rest}</span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 custom-scrollbar pr-2">
        <AnimatePresence mode="wait">
          {isResting ? (
            <motion.div
              key="resting"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              className="p-8 bg-zinc-900 rounded-3xl border border-zinc-800 flex flex-col items-center text-center space-y-8"
            >
              <div className="relative w-48 h-48 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="96" cy="96" r="88"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="transparent"
                    className="text-zinc-800"
                  />
                  <motion.circle
                    cx="96" cy="96" r="88"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="transparent"
                    strokeDasharray={552.92}
                    animate={{ strokeDashoffset: 552.92 * (1 - progress / 100) }}
                    className="text-blue-500"
                  />
                </svg>
                <div className="absolute flex flex-col items-center">
                  <Timer className="text-zinc-500 mb-2" size={24} />
                  <span className="text-5xl font-black">{timeLeft}</span>
                  <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest mt-1">Pause</span>
                </div>
              </div>
              
              <div className="space-y-4 w-full">
                <p className="text-sm text-zinc-400 italic px-4">&quot;Bereite dich auf den nächsten Satz vor, Alpha!&quot;</p>
                <button 
                  onClick={handleRestComplete}
                  className="w-full py-4 rounded-2xl border border-zinc-800 bg-zinc-800/50 flex items-center justify-center gap-2 hover:bg-zinc-800 transition-all font-bold"
                >
                  Pause überspringen <FastForward size={18} />
                </button>
              </div>
            </motion.div>
          ) : showingAnalysis ? (
            <motion.div 
              key="analysis"
              initial={{ opacity: 0, scale: 0.95 }} 
              animate={{ opacity: 1, scale: 1 }} 
              className="p-8 bg-blue-600 rounded-3xl space-y-6 shadow-2xl shadow-blue-500/20"
            >
              <div className="flex items-center gap-3">
                <div className="bg-white/20 p-2 rounded-xl">
                  <ArrowUpCircle className="text-white" />
                </div>
                <h3 className="text-xl font-black">Alpha-Progression</h3>
              </div>
              <p className="text-blue-50 font-medium leading-loose italic underline-offset-4">&quot;{recommendation}&quot;</p>
              <button 
                onClick={goToNextExercise}
                className="w-full bg-white text-blue-600 p-5 rounded-2xl font-black text-lg hover:bg-blue-50 transition-colors"
              >
                Weiter zur nächsten Übung
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="inputs"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-4"
            >
              <div className="bg-zinc-900 p-6 rounded-3xl border border-zinc-800">
                <div className="flex items-center gap-2 mb-4 text-blue-500">
                  <Info size={18} />
                  <span className="text-sm font-bold uppercase tracking-wider">Anleitung</span>
                </div>
                <p className="text-zinc-400 text-sm leading-relaxed">{currentExercise.instruction}</p>
                {currentExercise.videoUrl && (
                  <div className="mt-4 pt-4 border-t border-zinc-800">
                    <a 
                      href={currentExercise.videoUrl} 
                      target="_blank" 
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 text-blue-500 hover:text-blue-400 text-xs font-bold uppercase tracking-widest transition-colors"
                    >
                      <Play size={14} fill="currentColor" /> Übungsvideo ansehen
                    </a>
                  </div>
                )}
              </div>

              <div className="p-8 bg-zinc-900 rounded-3xl border border-zinc-800 space-y-8 shadow-2xl">
                <div className="grid grid-cols-2 gap-8 text-center">
                  <div className="space-y-4">
                    <div className="flex justify-center"><Weight className="text-zinc-500" /></div>
                    <input 
                      type="number" 
                      placeholder="KG" 
                      className="w-full bg-black border-2 border-zinc-800 rounded-2xl p-4 text-center text-2xl font-bold focus:border-blue-500 outline-none" 
                      id="weight-input"
                    />
                  </div>
                  <div className="space-y-4">
                    <div className="flex justify-center"><CheckCircle2 className="text-zinc-500" /></div>
                    <input 
                      type="number" 
                      placeholder="Reps" 
                      className="w-full bg-black border-2 border-zinc-800 rounded-2xl p-4 text-center text-2xl font-bold focus:border-blue-500 outline-none" 
                      id="reps-input"
                    />
                  </div>
                </div>
                
                <button 
                  onClick={() => {
                    const repsInput = document.getElementById('reps-input') as HTMLInputElement;
                    const weightInput = document.getElementById('weight-input') as HTMLInputElement;
                    const reps = repsInput.value;
                    const weight = weightInput.value;
                    if (reps && weight) {
                      onSaveProgress(currentExercise.name, Number(weight), Number(reps));
                      handleSetComplete(Number(reps), Number(weight));
                      repsInput.value = ''; // Reset for next set
                    }
                  }}
                  className="w-full bg-blue-600 p-5 rounded-2xl font-black text-lg flex items-center justify-center gap-2 hover:bg-blue-500 shadow-xl shadow-blue-900/40 active:scale-95 transition-all"
                >
                  Satz {currentSet} abschließen <Play size={20} fill="currentColor" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex justify-between items-center px-4">
        <span className="text-zinc-500 font-bold text-xs">ÜBUNG {currentIndex + 1} VON {workout.exercises.length}</span>
        <div className="flex gap-1">
          {workout.exercises.map((_, i) => (
            <div key={i} className={`h-1 mx-0.5 rounded-full transition-all duration-500 ${i === currentIndex ? 'w-8 bg-blue-500' : 'w-2 bg-zinc-800'}`} />
          ))}
        </div>
      </div>
    </div>
  );
}
