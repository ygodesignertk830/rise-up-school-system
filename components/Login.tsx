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
    <div className="h-screen w-full flex flex-col lg:flex-row bg-[#0B1120] text-white font-outfit overflow-hidden">
      {/* Lado Esquerdo - Branding */}
      <div className="w-full lg:w-1/2 flex flex-col items-center justify-center bg-[#0f172a] relative p-8 order-last lg:order-first lg:h-full">
        <div className="relative z-10 text-center flex flex-col items-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8 }}
            className="mb-4 lg:mb-8"
          >
            {/* Logotipo Oficial */}
            <div className="w-32 h-32 md:w-64 md:h-64 rounded-full flex items-center justify-center relative z-10 transition-all duration-500">
              <img
                src={officialLogo}
                alt="Rise Up Logo"
                className="w-full h-full object-contain drop-shadow-[0_0_25px_rgba(255,255,255,0.15)]"
              />
            </div>
          </motion.div>

          <div className="hidden lg:block">
            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400 font-outfit"
            >
              Rise UP
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
              className="text-xl text-gray-300 mt-2 tracking-wide font-light"
            >
              English School
            </motion.p>
          </div>
        </div>
      </div>

      {/* Lado Direito - Formulário */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 md:p-8 bg-[#0B1120] lg:h-full">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md space-y-6 lg:space-y-8"
        >
          <div className="text-center lg:text-left">
            <h2 className="text-3xl font-bold text-white mb-2">
              {isSignUp ? 'Criar Conta' : 'Bem-vindo'}
            </h2>
            <p className="text-slate-400">
              {isSignUp ? 'Preencha os dados para registrar sua escola.' : 'Use suas credenciais para acessar o painel.'}
            </p>
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
              className="text-purple-400 hover:text-purple-300 font-medium transition-colors"
            >
              {/*{isSignUp ? 'Já tem uma conta? Faça Login.' : 'Não tem conta? Cadastre-se.'}*/}
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Login;