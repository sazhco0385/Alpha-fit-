/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { UserProfile, TrainingPlan } from '../types';
import Logo from './Logo';
import { auth, db } from '../lib/firebase';
import { doc, updateDoc, increment } from 'firebase/firestore';
import { 
  Zap,
  Dumbbell, 
  MessageSquare, 
  LayoutDashboard, 
  Settings, 
  Flame, 
  Trophy, 
  TrendingUp, 
  ArrowRight,
  User as UserIcon,
  Play,
  Apple,
  LineChart as ChartIcon
} from 'lucide-react';
import { Meal, ExerciseHistory } from '../types';
import AICoach from './AICoach';
import WorkoutActive from './WorkoutActive';
import NutritionTracker from './NutritionTracker';
import ProgressCharts from './ProgressCharts';
import BadgeSystem from './BadgeSystem';

interface DashboardProps {
  profile: UserProfile;
  plan: TrainingPlan;
  key?: string;
}

export default function Dashboard({ profile, plan }: DashboardProps) {
  const [activeTab, setActiveTab] = useState<'home' | 'coach' | 'workout' | 'stats' | 'nutrition' | 'analytics'>('home');
  const [selectedWorkoutIndex, setSelectedWorkoutIndex] = useState<number | null>(null);
  const [xpAwarded, setXpAwarded] = useState(false);

  const handleSimulateXP = async () => {
    if (!profile) return;
    try {
      const userRef = doc(db, 'users', auth.currentUser?.uid || '');
      await updateDoc(userRef, {
        xp: increment(250)
      });
      setXpAwarded(true);
      setTimeout(() => setXpAwarded(false), 3000);
    } catch (err) {
      console.error(err);
    }
  };
  
  const [meals, setMeals] = useState<Meal[]>(() => {
    const saved = localStorage.getItem('alphafit_meals');
    return saved ? JSON.parse(saved) : [];
  });

  const [history, setHistory] = useState<ExerciseHistory[]>(() => {
    const saved = localStorage.getItem('alphafit_history');
    if (saved) return JSON.parse(saved);
    
    // Initial data
    return [
      {
        exerciseName: 'Bankdrücken',
        entries: [
          { date: '2026-04-01', weight: 60, reps: 10 },
          { date: '2026-04-08', weight: 65, reps: 8 },
          { date: '2026-04-15', weight: 67.5, reps: 8 },
          { date: '2026-04-22', weight: 70, reps: 6 },
        ]
      }
    ];
  });

  const handleAddMeal = (meal: Meal) => {
    const updated = [meal, ...meals];
    setMeals(updated);
    localStorage.setItem('alphafit_meals', JSON.stringify(updated));
  };

  const handleSaveProgress = (exerciseName: string, weight: number, reps: number) => {
    const today = new Date().toLocaleDateString('de-DE');
    const updated = [...history];
    const exerciseIdx = updated.findIndex(h => h.exerciseName === exerciseName);
    
    if (exerciseIdx >= 0) {
      updated[exerciseIdx].entries.push({ date: today, weight, reps });
    } else {
      updated.push({
        exerciseName,
        entries: [{ date: today, weight, reps }]
      });
    }
    
    setHistory(updated);
    localStorage.setItem('alphafit_history', JSON.stringify(updated));
  };

  const getStats = () => [
    { label: 'Level', value: profile.level, icon: Trophy, color: 'text-yellow-500' },
    { label: 'Gewicht', value: `${profile.weight}kg`, icon: TrendingUp, color: 'text-blue-500' },
    { label: 'Tage/Woche', value: profile.daysPerWeek, icon: Flame, color: 'text-orange-500' },
  ];

  const renderContent = () => {
    if (selectedWorkoutIndex !== null) {
      return (
        <WorkoutActive 
          workout={plan.workouts[selectedWorkoutIndex]} 
          onFinish={() => setSelectedWorkoutIndex(null)} 
          onSaveProgress={handleSaveProgress}
        />
      );
    }

    switch (activeTab) {
      case 'home':
        return (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
            <header className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <Logo size={50} />
                <div>
                  <h1 className="text-3xl font-black tracking-tight leading-none uppercase">Status</h1>
                  <p className="text-zinc-500 text-sm mt-1">Willkommen back, <span className="text-blue-500 font-bold">{profile.name}</span></p>
                </div>
              </div>
              <button 
                onClick={handleSimulateXP}
                className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center hover:bg-blue-600/10 transition-all border-dashed overflow-hidden relative"
              >
                <Zap size={24} className={xpAwarded ? "text-yellow-400 scale-125 transition-all" : "text-zinc-600"} />
                {xpAwarded && (
                  <motion.span 
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: -20, opacity: 1 }}
                    className="absolute text-[10px] font-black text-yellow-400"
                  >
                    +250 XP
                  </motion.span>
                )}
              </button>
            </header>

            <BadgeSystem currentXP={profile.xp || 0} />

            <div className="grid grid-cols-3 gap-3">
              {getStats().map((stat, i) => (
                <div key={i} className="bg-zinc-950 p-4 rounded-3xl border border-zinc-900 text-center">
                  <stat.icon className={`${stat.color} mx-auto mb-2`} size={20} />
                  <span className="block font-black text-lg">{stat.value}</span>
                  <span className="text-[10px] uppercase text-zinc-500 tracking-wider">{stat.label}</span>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button 
                onClick={() => setActiveTab('nutrition')}
                className="bg-zinc-900 p-6 rounded-3xl border border-zinc-800 text-left space-y-4 hover:border-blue-500/30 transition-all"
              >
                <Apple className="text-blue-500" size={24} />
                <h4 className="font-bold">Ernährung</h4>
              </button>
              <button 
                onClick={() => setActiveTab('analytics')}
                className="bg-zinc-900 p-6 rounded-3xl border border-zinc-800 text-left space-y-4 hover:border-blue-500/30 transition-all"
              >
                <TrendingUp className="text-blue-500" size={24} />
                <h4 className="font-bold">Fortschritt</h4>
              </button>
            </div>

            <section className="space-y-4">
              <h3 className="text-sm font-black uppercase tracking-[0.2em] text-zinc-500">Dein Trainingsplan</h3>
              <div className="grid grid-cols-1 gap-4">
                {plan.workouts.map((workout, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedWorkoutIndex(i)}
                    className="group bg-zinc-900 p-6 rounded-3xl border border-zinc-800 text-left hover:border-blue-500/50 hover:bg-zinc-800/50 transition-all active:scale-[0.98]"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <span className="text-blue-500 text-xs font-black uppercase tracking-widest">{workout.day}</span>
                        <h4 className="text-xl font-bold mt-1 group-hover:text-blue-400 transition-colors">Starten</h4>
                      </div>
                      <div className="p-3 bg-blue-600 rounded-2xl shadow-lg shadow-blue-900/30">
                        <Play size={20} fill="currentColor" />
                      </div>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {workout.exercises.slice(0, 3).map((ex, j) => (
                        <span key={j} className="text-[10px] bg-zinc-950 px-3 py-1.5 rounded-full border border-zinc-800 text-zinc-400">
                          {ex.name}
                        </span>
                      ))}
                      {workout.exercises.length > 3 && (
                        <span className="text-[10px] text-zinc-500 flex items-center gap-1 ml-1">
                          +{workout.exercises.length - 3} weitere <ArrowRight size={10} />
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </section>
          </motion.div>
        );
      case 'coach':
        return <AICoach profile={profile} />;
      case 'nutrition':
        return <NutritionTracker meals={meals} onAddMeal={handleAddMeal} profile={profile} />;
      case 'analytics':
        return <ProgressCharts history={history} />;
      default:
        return (
          <div className="flex items-center justify-center h-full text-zinc-500 font-bold uppercase tracking-widest text-sm">
            Demnächst verfügbar...
          </div>
        );
    }
  };

  return (
    <div className="h-screen bg-black text-white flex flex-col max-w-md mx-auto relative shadow-[0_0_100px_rgba(59,130,246,0.15)] overflow-hidden">
      <main className="flex-1 overflow-y-auto p-6 pb-28 custom-scrollbar">
        {renderContent()}
      </main>

      {selectedWorkoutIndex === null && (
        <nav className="absolute bottom-6 left-6 right-6 bg-zinc-900/80 backdrop-blur-xl border border-zinc-800 rounded-[32px] p-2 flex gap-1 shadow-2xl">
          {[
            { id: 'home', icon: LayoutDashboard, label: 'Board' },
            { id: 'analytics', icon: ChartIcon, label: 'Gains' },
            { id: 'nutrition', icon: Apple, label: 'Food' },
            { id: 'coach', icon: MessageSquare, label: 'Coach' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as any)}
              className={`flex-1 flex flex-col items-center gap-1 py-3 px-2 rounded-2xl transition-all duration-500 ${
                activeTab === item.id 
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40' 
                : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <item.icon size={22} className={activeTab === item.id ? 'animate-pulse' : ''} />
              <span className="text-[10px] font-black uppercase tracking-tighter">{item.label}</span>
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}
