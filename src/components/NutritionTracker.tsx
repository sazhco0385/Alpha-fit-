/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Camera, Plus, Utensils, X, Loader2, Save, Scan, History, Target } from 'lucide-react';
import { Meal, MealType, Macros, UserProfile, FitnessGoal } from '../types';
import { analyzeFood } from '../services/geminiService';

interface NutritionTrackerProps {
  onAddMeal: (meal: Meal) => void;
  meals: Meal[];
  profile: UserProfile;
}

export default function NutritionTracker({ onAddMeal, meals, profile }: NutritionTrackerProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [loading, setLoading] = useState(false);
  const [description, setDescription] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [analyzedMacros, setAnalyzedMacros] = useState<Macros | null>(null);
  const [meatName, setMealName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAnalyze = async () => {
    if (!description && !image) return;
    setLoading(true);
    try {
      const base64 = image?.split(',')[1];
      const result = await analyzeFood({ 
        text: description, 
        imageBase64: base64 
      });
      if (result.macros) setAnalyzedMacros(result.macros as Macros);
      if (result.name) setMealName(result.name);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = () => {
    if (!analyzedMacros || !meatName) return;
    const newMeal: Meal = {
      id: Date.now().toString(),
      name: meatName,
      timestamp: Date.now(),
      type: MealType.LUNCH, // Default
      macros: analyzedMacros,
      description: description,
      imageUrl: image || undefined,
    };
    onAddMeal(newMeal);
    resetForm();
  };

  const resetForm = () => {
    setIsAdding(false);
    setDescription('');
    setImage(null);
    setAnalyzedMacros(null);
    setMealName('');
  };

  const totalMacros = meals.reduce((acc, meal) => ({
    calories: acc.calories + meal.macros.calories,
    protein: acc.protein + meal.macros.protein,
    carbs: acc.carbs + meal.macros.carbs,
    fat: acc.fat + meal.macros.fat,
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

  const calculateDailyGoal = () => {
    // Basic BMR estimate (Mifflin-St Jeor) - assuming moderate activity (1.5)
    // Gender is not in profile, so we use a general average adjustment (+5 for male baseline)
    const bmr = (10 * profile.weight) + (6.25 * profile.height) - (5 * profile.age) + 5;
    const tdee = Math.round(bmr * 1.5);

    switch (profile.goal) {
      case FitnessGoal.WEIGHT_LOSS:
        return tdee - 500;
      case FitnessGoal.MUSCLE_BUILDING:
        return tdee + 300;
      default:
        return tdee;
    }
  };

  const dailyGoal = calculateDailyGoal();
  const progressPercent = Math.min((totalMacros.calories / dailyGoal) * 100, 100);
  const remainingCalories = dailyGoal - totalMacros.calories;

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black">Ernährung</h2>
          <p className="text-zinc-500 text-sm">Treibstoff für deinen Erfolg</p>
        </div>
        <button 
          onClick={() => setIsAdding(true)}
          className="bg-blue-600 p-4 rounded-2xl shadow-lg shadow-blue-900/20 hover:bg-blue-500 transition-all active:scale-95"
        >
          <Plus size={24} />
        </button>
      </header>

      {/* Goal Display */}
      <div className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-[2.5rem] space-y-4">
        <div className="flex justify-between items-end">
          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 flex items-center gap-1">
              <Target size={12} className="text-blue-500" /> Tagesziel
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-black">{totalMacros.calories}</span>
              <span className="text-zinc-500 font-bold">/ {dailyGoal} kcal</span>
            </div>
          </div>
          <div className="text-right">
            <span className={`text-sm font-black ${remainingCalories > 0 ? 'text-blue-500' : 'text-green-500'}`}>
              {remainingCalories > 0 ? `${remainingCalories} übrig` : 'Ziel erreicht!'}
            </span>
          </div>
        </div>
        
        <div className="h-4 w-full bg-zinc-800 rounded-full overflow-hidden">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 1, ease: 'easeOut' }}
            className={`h-full ${remainingCalories > 0 ? 'bg-blue-600' : 'bg-green-500'}`}
          />
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {[
          { label: 'Kcal', value: totalMacros.calories, color: 'text-white' },
          { label: 'Prot', value: totalMacros.protein, color: 'text-blue-500' },
          { label: 'Carb', value: totalMacros.carbs, color: 'text-yellow-500' },
          { label: 'Fat', value: totalMacros.fat, color: 'text-red-500' },
        ].map((stat, i) => (
          <div key={i} className="bg-zinc-900/50 border border-zinc-800 p-3 rounded-2xl text-center">
            <span className={`block font-black text-sm ${stat.color}`}>{Math.round(stat.value)}</span>
            <span className="text-[8px] uppercase tracking-widest text-zinc-500">{stat.label}</span>
          </div>
        ))}
      </div>

      <div className="space-y-4">
        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-500 flex items-center gap-2">
          <History size={14} /> Log Heute
        </h3>
        {meals.length === 0 ? (
          <div className="bg-zinc-900/30 border border-zinc-800 border-dashed rounded-3xl p-12 text-center">
            <Utensils className="mx-auto text-zinc-700 mb-4" size={32} />
            <p className="text-zinc-500 text-sm">Noch keine Mahlzeiten erfasst.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {meals.map(meal => (
              <div key={meal.id} className="bg-zinc-900 p-4 rounded-2xl border border-zinc-800 flex items-center gap-4">
                {meal.imageUrl ? (
                  <img src={meal.imageUrl} className="w-12 h-12 rounded-xl object-cover" />
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-zinc-800 flex items-center justify-center">
                    <Utensils size={20} className="text-zinc-500" />
                  </div>
                )}
                <div className="flex-1">
                  <h4 className="font-bold text-sm">{meal.name}</h4>
                  <div className="flex gap-2 text-[10px] text-zinc-500 mt-1">
                    <span>{meal.macros.calories} kcal</span>
                    <span>•</span>
                    <span>P: {meal.macros.protein}g</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {isAdding && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
          >
            <motion.div 
              initial={{ y: 100 }} 
              animate={{ y: 0 }} 
              exit={{ y: 100 }}
              className="w-full max-w-md bg-zinc-950 border border-zinc-900 rounded-t-[40px] sm:rounded-[40px] p-8 space-y-6 shadow-2xl"
            >
              <div className="flex justify-between items-center">
                <h3 className="text-2xl font-black">Mahlzeit Loggen</h3>
                <button onClick={resetForm} className="p-2 hover:bg-zinc-900 rounded-full transition-colors">
                  <X size={24} className="text-zinc-500" />
                </button>
              </div>

              <div className="space-y-4">
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="aspect-video bg-zinc-900 rounded-3xl border-2 border-dashed border-zinc-800 flex flex-col items-center justify-center cursor-pointer overflow-hidden relative group"
                >
                  {image ? (
                    <img src={image} className="w-full h-full object-cover" />
                  ) : (
                    <>
                      <Camera className="text-zinc-700 group-hover:text-blue-500 transition-colors mb-2" size={32} />
                      <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Foto hochladen</span>
                    </>
                  )}
                  <input type="file" ref={fileInputRef} onChange={handleImageChange} accept="image/*" className="hidden" />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-zinc-500">Beschreibe dein Essen</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Z.B. Haferflocken mit Beeren und Proteinshake..."
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-sm focus:border-blue-500 outline-none h-24 resize-none"
                  />
                </div>

                {!analyzedMacros ? (
                  <button 
                    onClick={handleAnalyze}
                    disabled={(!description && !image) || loading}
                    className="w-full bg-zinc-800 p-5 rounded-2xl font-black flex items-center justify-center gap-3 hover:bg-zinc-700 disabled:opacity-50 transition-all"
                  >
                    {loading ? <Loader2 className="animate-spin" size={20} /> : <Scan size={20} />}
                    KI ANALYSIEREN
                  </button>
                ) : (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-blue-600 p-6 rounded-3xl space-y-4"
                  >
                    <div className="flex justify-between items-center">
                      <input 
                        value={meatName}
                        onChange={(e) => setMealName(e.target.value)}
                        className="bg-transparent text-xl font-black outline-none border-b border-white/20 pb-1"
                      />
                      <span className="text-xs font-black text-white/60">Anpassbar</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-white/10 p-3 rounded-2xl">
                        <span className="block text-[10px] font-black uppercase text-white/60">Kalorien</span>
                        <span className="text-xl font-black">{analyzedMacros.calories}</span>
                      </div>
                      <div className="bg-white/10 p-3 rounded-2xl">
                        <span className="block text-[10px] font-black uppercase text-white/60">Protein</span>
                        <span className="text-xl font-black">{analyzedMacros.protein}g</span>
                      </div>
                    </div>
                    <button 
                      onClick={handleSave}
                      className="w-full bg-white text-blue-600 p-4 rounded-2xl font-black flex items-center justify-center gap-2 hover:bg-zinc-50 transition-colors"
                    >
                      <Save size={20} /> SPEICHERN
                    </button>
                  </motion.div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
