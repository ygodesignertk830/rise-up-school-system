import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Rocket, Lock, Mail, ArrowRight, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import officialLogo from '../LogotipoRiseUpOficial.png';

interface LoginProps {
  onLogin: (role: 'super_admin' | 'school_admin') => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [isSignUp, setIsSignUp] = useState(false); // Toggle entre Login e Cadastro
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      if (isSignUp) {
        // --- CADASTRO ---
        const { error: authError } = await supabase.auth.signUp({
          email,
          password,
        });

        if (authError) {
          // Tratamento específico para erro comum de usuário existente
          if (authError.message.includes('already registered') || authError.message.includes('User already registered')) {
            setIsSignUp(false); // Muda para aba de login
            throw new Error("Esta conta já existe. Por favor, digite sua senha para entrar.");
          }
          throw authError;
        }

        setSuccessMsg("Conta criada! Verifique seu email ou faça login se o acesso não for automático.");
      } else {
        // --- LOGIN ---
        const { error: authError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (authError) {
          if (authError.message.includes('Invalid login')) {
            throw new Error("Email ou senha incorretos.");
          }
          throw authError;
        }
        // O login bem sucedido é capturado pelo onAuthStateChange no App.tsx
      }
    } catch (err: any) {
      console.error('Erro na autenticação:', err);
      setError(err.message || 'Falha na autenticação.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen w-screen relative bg-[#0B1120] text-white font-outfit overflow-hidden flex items-center justify-center p-4">

      {/* --- PREMIUM SPACE NEBULA BACKGROUND --- */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Luminous Gas Effects */}
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-purple-600/10 blur-[120px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-600/10 blur-[120px] rounded-full animate-pulse" style={{ animationDelay: '1s' }} />

        {/* Parallax Stars Layer 1 */}
        {[...Array(30)].map((_, i) => (
          <motion.div
            key={`s1-${i}`}
            className="absolute bg-white rounded-full opacity-20"
            initial={{ x: Math.random() * 2000, y: Math.random() * 2000 }}
            animate={{ opacity: [0.1, 0.4, 0.1], scale: [1, 1.2, 1] }}
            transition={{ duration: Math.random() * 5 + 3, repeat: Infinity }}
            style={{ width: Math.random() * 2 + 1, height: Math.random() * 2 + 1 }}
          />
        ))}

        {/* Parallax Stars Layer 2 (Faster) */}
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={`s2-${i}`}
            className="absolute bg-blue-400 rounded-full opacity-30"
            initial={{ x: Math.random() * 2000, y: Math.random() * 2000 }}
            animate={{ opacity: [0.2, 0.6, 0.2], y: [null, -50] }}
            transition={{ duration: Math.random() * 10 + 10, repeat: Infinity, ease: 'linear' }}
            style={{ width: 1, height: 1 }}
          />
        ))}
      </div>

      <div className="relative z-10 w-full max-w-5xl flex flex-col lg:flex-row items-center gap-8 lg:gap-16">
        {/* Branding Area */}
        <div className="flex flex-col items-center lg:items-start text-center lg:text-left shrink-0">
          <motion.div
            initial={{ opacity: 0, scale: 0.5, rotate: -10 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 100, damping: 15 }}
            className="relative mb-4 lg:mb-8"
          >
            {/* Orbital Glow */}
            <div className="absolute inset-0 bg-white/5 blur-3xl rounded-full scale-150" />

            <div className="w-24 h-24 lg:w-64 lg:h-64 rounded-full flex items-center justify-center relative transition-transform hover:scale-105 duration-700">
              <img
                src={officialLogo}
                alt="Rise Up Logo"
                className="w-full h-full object-contain drop-shadow-[0_0_40px_rgba(255,255,255,0.2)]"
              />
            </div>
          </motion.div>

          <div className="space-y-1">
            <motion.h1
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
              className="text-4xl lg:text-7xl font-black bg-clip-text text-transparent bg-gradient-to-r from-white via-blue-200 to-indigo-400 font-outfit leading-tight"
            >
              Rise UP
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="text-base lg:text-2xl text-slate-400 font-light tracking-[0.3em] uppercase"
            >
              English School
            </motion.p>
          </div>
        </div>

        {/* Login Card Area */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8 }}
          className="w-full max-w-md bg-slate-900/40 backdrop-blur-2xl p-6 lg:p-10 rounded-[2.5rem] border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)] relative overflow-hidden group"
        >
          {/* Internal Glow Effect */}
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-indigo-500/10 blur-[80px] rounded-full group-hover:bg-indigo-500/20 transition-all duration-1000" />

          <div className="relative z-10 space-y-6 lg:space-y-8">
            <div>
              <h2 className="text-2xl lg:text-3xl font-black text-white mb-2">Login Master</h2>
              <p className="text-xs lg:text-sm text-slate-500 font-medium">Acesse o portal administrativo para gerenciar sua unidade.</p>
            </div>

            {error && (
              <div className="p-4 bg-red-900/20 border border-red-500/50 text-red-200 text-sm rounded-xl flex items-center animate-shake">
                <span className="mr-2">⚠️</span> {error}
              </div>
            )}

            {successMsg && (
              <div className="p-4 bg-emerald-900/20 border border-emerald-500/50 text-emerald-200 text-sm rounded-xl flex items-center">
                <span className="mr-2">✅</span> {successMsg}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6 mt-8">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300 ml-1">Email</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-slate-500 group-focus-within:text-purple-500 transition-colors" />
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none text-white placeholder-slate-500 transition-all"
                    placeholder="admin@ygodesigner.school"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300 ml-1">Senha</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-slate-500 group-focus-within:text-purple-500 transition-colors" />
                  </div>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none text-white placeholder-slate-500 transition-all"
                    placeholder="••••••••"
                    minLength={6}
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center py-3 px-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold rounded-xl shadow-lg shadow-purple-900/20 transform transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                  <>
                    {isSignUp ? 'Cadastrar' : 'Entrar'} <ArrowRight className="ml-2 w-5 h-5" />
                  </>
                )}
              </button>
            </form>

            <div className="flex flex-col gap-2 items-center text-sm text-slate-500 mt-8">
              <button
                type="button"
                onClick={() => { setIsSignUp(!isSignUp); setError(null); setSuccessMsg(null); }}
                className="text-indigo-400 hover:text-indigo-300 font-bold transition-colors uppercase text-[10px] tracking-widest"
              >
                {isSignUp ? 'Já tem uma conta? Entrar' : 'Registrar nova unidade'}
              </button>
            </div>
          </div>
        </motion.div>
      </div>

      {/* --- SIGNATURE FOOTER --- */}
      <div className="absolute bottom-6 left-0 w-full flex justify-center z-20 pointer-events-none">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
          className="flex items-center gap-2 bg-black/20 backdrop-blur-md px-4 py-2 rounded-full border border-white/5"
        >
          <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse" />
          <p className="text-[10px] lg:text-xs font-black uppercase tracking-[0.3em] text-slate-500">
            Desenvolvido por <span className="text-slate-300">Ygo Designer</span>
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default Login;