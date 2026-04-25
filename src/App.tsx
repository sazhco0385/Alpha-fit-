/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { UserProfile, TrainingPlan } from './types';
import Onboarding from './components/Onboarding';
import Dashboard from './components/Dashboard';
import Auth from './components/Auth';
import Logo from './components/Logo';
import { generateTrainingPlan } from './services/geminiService';
import { Loader2, Dumbbell, LogOut } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { auth, db } from './lib/firebase';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [plan, setPlan] = useState<TrainingPlan | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (authUser) => {
      setUser(authUser);
      if (authUser) {
        // Load profile and plan from Firestore
        await loadUserData(authUser.uid);
      } else {
        setProfile(null);
        setPlan(null);
      }
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const loadUserData = async (uid: string) => {
    try {
      // Real-time user profile listener
      const userUnsubscribe = onSnapshot(doc(db, 'users', uid), (doc) => {
        if (doc.exists()) {
          setProfile(doc.data() as UserProfile);
        }
      });

      const planDoc = await getDoc(doc(db, 'plans', uid));
      if (planDoc.exists()) {
        setPlan(planDoc.data() as TrainingPlan);
      }
      
      return () => {
        userUnsubscribe();
      };
    } catch (err) {
      console.error(err);
    }
  };

  const handleOnboardingComplete = async (userProfile: UserProfile) => {
    if (!user) return;
    setIsLoading(true);
    setError(null);

    try {
      const trainingPlan = await generateTrainingPlan(userProfile);
      
      // Save to Firestore
      const initialProfile = { ...userProfile, xp: 0, level_rank: 1 };
      await setDoc(doc(db, 'users', user.uid), initialProfile);
      await setDoc(doc(db, 'plans', user.uid), { ...trainingPlan, userId: user.uid });
      
      setProfile(initialProfile);
      setPlan(trainingPlan);
    } catch (err) {
      console.error(err);
      setError('Fehler beim Erstellen des Alpha-Plans. Bitte versuche es erneut.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 text-center">
        <motion.div 
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ repeat: Infinity, duration: 3 }}
          className="mb-8"
        >
          <Logo size={120} />
        </motion.div>
        <h2 className="text-3xl font-black mb-4 uppercase tracking-tighter">Alpha wird geladen...</h2>
        <div className="mt-8 flex items-center gap-2 text-blue-500">
          <Loader2 className="animate-spin" size={20} />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-zinc-950 min-h-screen font-sans selection:bg-blue-500/30">
      <AnimatePresence mode="wait">
        {!user ? (
          <Auth onSuccess={() => {}} key="auth" />
        ) : !profile || !plan ? (
          <Onboarding onComplete={handleOnboardingComplete} key="onboarding" />
        ) : (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            className="flex items-center justify-center min-h-screen md:p-8"
            key="dashboard"
          >
            <Dashboard profile={profile} plan={plan} />
            <button 
              onClick={handleLogout}
              className="fixed top-4 right-4 p-3 bg-zinc-900 border border-zinc-800 rounded-2xl text-zinc-500 hover:text-white transition-all shadow-xl"
            >
              <LogOut size={20} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      
      {error && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] bg-red-600 px-6 py-3 rounded-2xl shadow-2xl font-bold flex items-center gap-2">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="underline ml-2">Ok</button>
        </div>
      )}
    </div>
  );
}
