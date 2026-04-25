/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { auth } from '../lib/firebase';
import Logo from './Logo';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  updateProfile 
} from 'firebase/auth';
import { KeyRound, Mail, User, Loader2, ArrowRight } from 'lucide-react';

interface AuthProps {
  onSuccess: () => void;
  key?: string;
}

export default function Auth({ onSuccess }: AuthProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, { displayName: name });
      }
      onSuccess();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Authentifizierungsfehler');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md space-y-8"
      >
        <div className="text-center space-y-4">
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="mb-6 flex justify-center"
          >
            <Logo size={140} />
          </motion.div>
          <div>
            <h2 className="text-4xl font-black tracking-tight">{isLogin ? 'WILLKOMMEN ZURÜCK' : 'ALPHA WERDEN'}</h2>
            <p className="text-zinc-500 mt-2">Logge dich ein, um dein Training fortzusetzen.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={20} />
              <input
                type="text"
                placeholder="Dein Name"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                className="w-full bg-zinc-900/50 border border-zinc-800 rounded-2xl py-4 pl-12 pr-4 focus:border-blue-500 outline-none transition-all"
              />
            </div>
          )}
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={20} />
            <input
              type="email"
              placeholder="Email Adresse"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full bg-zinc-900/50 border border-zinc-800 rounded-2xl py-4 pl-12 pr-4 focus:border-blue-500 outline-none transition-all"
            />
          </div>
          <div className="relative">
            <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={20} />
            <input
              type="password"
              placeholder="Passwort"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="w-full bg-zinc-900/50 border border-zinc-800 rounded-2xl py-4 pl-12 pr-4 focus:border-blue-500 outline-none transition-all"
            />
          </div>

          {error && <p className="text-red-500 text-sm font-bold text-center mt-2">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 p-5 rounded-2xl font-black text-lg flex items-center justify-center gap-2 hover:bg-blue-500 transition-all active:scale-95 disabled:opacity-50 mt-4"
          >
            {loading ? <Loader2 className="animate-spin" /> : isLogin ? 'ANMELDEN' : 'REGISTRIEREN'}
            <ArrowRight size={20} />
          </button>
        </form>

        <p className="text-center text-zinc-500 text-sm">
          {isLogin ? 'Noch kein Mitglied?' : 'Bereits Mitglied?'} 
          <button 
            onClick={() => setIsLogin(!isLogin)}
            className="text-blue-500 font-bold ml-2 hover:underline"
          >
            {isLogin ? 'Jetzt registrieren' : 'Jetzt anmelden'}
          </button>
        </p>
      </motion.div>
    </div>
  );
}
