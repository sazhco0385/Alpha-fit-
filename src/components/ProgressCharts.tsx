/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { Trophy, TrendingUp, Calendar, ChevronRight } from 'lucide-react';
import { ExerciseHistory } from '../types';

interface ProgressChartsProps {
  history: ExerciseHistory[];
}

const COLORS = ['#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B'];

export default function ProgressCharts({ history }: ProgressChartsProps) {
  const [selectedExercise, setSelectedExercise] = useState<string>(history[0]?.exerciseName || '');

  const activeHistory = history.find(h => h.exerciseName === selectedExercise);
  
  const getPR = () => {
    if (!activeHistory) return 0;
    return Math.max(...activeHistory.entries.map(e => e.weight));
  };

  const getProgressionRate = () => {
    if (!activeHistory || activeHistory.entries.length < 2) return 0;
    const first = activeHistory.entries[0].weight;
    const last = activeHistory.entries[activeHistory.entries.length - 1].weight;
    return (((last - first) / first) * 100).toFixed(1);
  };

  return (
    <div className="space-y-8">
      <header>
        <h2 className="text-3xl font-black">Analytics</h2>
        <p className="text-zinc-500 text-sm">Visualisiere deine Alpha-Gains</p>
      </header>

      {history.length > 0 ? (
        <>
          <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar no-scrollbar">
            {history.map((h, i) => (
              <button
                key={i}
                onClick={() => setSelectedExercise(h.exerciseName)}
                className={`px-4 py-2 rounded-full border text-xs font-bold transition-all shrink-0 ${
                  selectedExercise === h.exerciseName 
                  ? 'bg-blue-600 border-blue-500 text-white' 
                  : 'bg-zinc-900 border-zinc-800 text-zinc-400'
                }`}
              >
                {h.exerciseName}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-zinc-900/50 p-6 rounded-3xl border border-zinc-800">
              <Trophy className="text-yellow-500 mb-2" size={20} />
              <span className="block text-2xl font-black">{getPR()}kg</span>
              <span className="text-[10px] uppercase text-zinc-500 tracking-widest">PR Gewicht</span>
            </div>
            <div className="bg-zinc-900/50 p-6 rounded-3xl border border-zinc-800">
              <TrendingUp className="text-blue-500 mb-2" size={20} />
              <span className="block text-2xl font-black">+{getProgressionRate()}%</span>
              <span className="text-[10px] uppercase text-zinc-500 tracking-widest">Wachstum</span>
            </div>
          </div>

          <div className="bg-zinc-900/50 p-6 rounded-[2.5rem] border border-zinc-800 aspect-video w-full">
             <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={activeHistory?.entries}>
                <defs>
                  <linearGradient id="colorWeight" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#27272a" />
                <XAxis 
                  dataKey="date" 
                  stroke="#52525b" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false} 
                />
                <YAxis 
                  stroke="#52525b" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false} 
                  tickFormatter={(val) => `${val}kg`}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#09090b', borderRadius: '16px', border: '1px solid #27272a', fontSize: '12px' }}
                  itemStyle={{ fontWeight: 'bold', color: '#3B82F6' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="weight" 
                  stroke="#3B82F6" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorWeight)" 
                  animationDuration={1500}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <section className="space-y-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-zinc-500 flex items-center justify-between">
              <span>Letzte Rekorde</span>
              <ChevronRight size={14} />
            </h3>
            <div className="space-y-2">
              {activeHistory?.entries.slice(-3).reverse().map((entry, i) => (
                <div key={i} className="flex items-center justify-between p-4 bg-zinc-900/30 rounded-2xl border border-zinc-900">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center">
                      <Calendar size={14} className="text-zinc-500" />
                    </div>
                    <span className="text-sm font-medium">{entry.date}</span>
                  </div>
                  <span className="font-bold text-blue-500">{entry.weight}kg x {entry.reps}</span>
                </div>
              ))}
            </div>
          </section>
        </>
      ) : (
        <div className="bg-zinc-900/30 border border-zinc-800 border-dashed rounded-[3rem] p-16 text-center">
          <TrendingUp className="mx-auto text-zinc-800 mb-4" size={48} />
          <h3 className="text-xl font-bold mb-2">Noch keine Daten</h3>
          <p className="text-zinc-500 text-sm max-w-[200px] mx-auto">Trainiere weiter, um deine Fortschritte hier in Alpha-Diagrammen zu sehen.</p>
        </div>
      )}
    </div>
  );
}
