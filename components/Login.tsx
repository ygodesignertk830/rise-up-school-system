import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Rocket, Lock, Mail, ArrowRight, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import officialLogo from '../LogotipoRiseUpOficial.png';

interface LoginProps {
  onLogin: (role: 'super_admin' | 'school_admin') => void;
}

const ShootingStar = () => {
  const [star, setStar] = React.useState({ x: -100, y: -100, delay: 0 });

  React.useEffect(() => {
    const trigger = () => {
      setStar({
        x: Math.random() * window.innerWidth,
        y: Math.random() * (window.innerHeight / 2),
        delay: Math.random() * 5
      });
      setTimeout(trigger, 10000 + Math.random() * 20000);
    };
    trigger();
  }, []);

  return (
    <motion.div
      initial={{ x: star.x, y: star.y, opacity: 0, scale: 0 }}
      animate={{
        x: [star.x, star.x + 400],
        y: [star.y, star.y + 400],
        opacity: [0, 1, 0],
        scale: [1, 1.2, 0.5]
      }}
      transition={{ duration: 1.5, delay: star.delay, ease: "easeOut" }}
      className="absolute w-[200px] h-[2px] bg-gradient-to-r from-transparent via-white to-transparent -rotate-45 blur-[1px] pointer-events-none z-0"
    />
  );
};

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
    <div className="h-[100dvh] w-screen relative bg-[#010409] text-white font-outfit overflow-hidden flex flex-col items-center justify-center p-4 md:p-8">

      {/* --- COSMOS ENGINE (Nebula 2.0) --- */}
      <div className="absolute inset-0 pointer-events-none z-0">
        {/* Nebula Glows */}
        <motion.div
          animate={{ opacity: [0.2, 0.4, 0.2], scale: [1, 1.1, 1] }}
          transition={{ duration: 15, repeat: Infinity }}
          className="absolute -top-[10%] -left-[10%] w-[60vw] h-[60vw] bg-indigo-600/10 blur-[120px] rounded-full"
        />
        <motion.div
          animate={{ opacity: [0.1, 0.3, 0.1], scale: [1.1, 1, 1.1] }}
          transition={{ duration: 20, repeat: Infinity }}
          className="absolute -bottom-[10%] -right-[10%] w-[50vw] h-[50vw] bg-purple-600/10 blur-[120px] rounded-full"
        />

        {/* Moving Particles */}
        {[...Array(30)].map((_, i) => (
          <motion.div
            key={`p-${i}`}
            className="absolute bg-white rounded-full opacity-10"
            initial={{ x: Math.random() * 2000, y: Math.random() * 2000 }}
            animate={{ y: [null, -100], opacity: [0.1, 0.3, 0.1] }}
            transition={{ duration: Math.random() * 20 + 20, repeat: Infinity, ease: "linear" }}
            style={{ width: Math.random() * 2 + 1, height: Math.random() * 2 + 1 }}
          />
        ))}

        <ShootingStar />
        <ShootingStar />
      </div>

      <div className="relative z-10 w-full max-w-6xl flex flex-col lg:flex-row items-center justify-center gap-6 lg:gap-20 h-full max-h-[800px]">

        {/* BRANDING AREA - Scaled down for mobile */}
        <div className="flex flex-col items-center shrink-0">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.2 }}
            className="relative"
          >
            {/* Orbital Shine */}
            <div className="absolute inset-0 bg-white/5 blur-[80px] rounded-full scale-[2.2] animate-pulse" />

            <div className="w-20 h-20 lg:w-72 lg:h-72 rounded-full flex items-center justify-center relative backdrop-blur-3xl border border-white/5 shadow-2xl overflow-hidden group">
              <img
                src={officialLogo}
                alt="Rise Up Logo"
                className="w-full h-full object-contain relative z-10 p-1 lg:p-4 drop-shadow-[0_0_20px_rgba(255,255,255,0.2)] group-hover:scale-110 transition-transform duration-1000"
              />
            </div>
          </motion.div>
        </div>

        {/* LOGIN CARD AREA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="w-full max-w-md shrink-0 lg:shrink"
        >
          <div className="bg-slate-900/40 backdrop-blur-3xl p-6 md:p-10 lg:p-12 rounded-[2.5rem] border border-white/10 shadow-[0_20px_80px_rgba(0,0,0,0.5)] relative overflow-hidden">
            <div className="relative z-10 space-y-6 lg:space-y-8">
              <div className="text-center lg:text-left">
                <h2 className="text-2xl lg:text-3xl font-black text-white tracking-tight uppercase">Login Master</h2>
                <p className="text-[10px] lg:text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Gestão Rise UP English School</p>
              </div>

              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-200 text-[10px] font-bold rounded-xl flex items-center gap-2 animate-shake">
                  <div className="w-1.5 h-1.5 bg-red-500 rounded-full" /> {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4 lg:space-y-6">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-600 tracking-widest ml-1">E-mail</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-600" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-12 pr-4 py-3.5 lg:py-4 bg-black/40 border border-slate-800 rounded-2xl focus:ring-2 focus:ring-indigo-600 outline-none text-white font-bold transition-all"
                      placeholder="admin@riseup.school"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-600 tracking-widest ml-1">Senha</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-600" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-12 pr-4 py-3.5 lg:py-4 bg-black/40 border border-slate-800 rounded-2xl focus:ring-2 focus:ring-indigo-600 outline-none text-white font-bold transition-all"
                      placeholder="••••••••"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 lg:py-5 bg-white text-black font-black uppercase tracking-[0.2em] text-[10px] lg:text-xs rounded-2xl shadow-xl hover:bg-slate-100 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin text-indigo-600" /> : <>Entrar no Painel <ArrowRight className="w-4 h-4" /></>}
                </button>
              </form>
            </div>
          </div>
        </motion.div>
      </div>

      {/* --- FINAL PERFECT SIGNATURE --- */}
      <div className="absolute bottom-6 left-0 w-full flex flex-col items-center gap-3 z-20 pointer-events-none px-6">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.5, duration: 1 }}
          className="flex items-center gap-3 bg-black/20 backdrop-blur-xl px-6 py-2.5 rounded-full border border-white/5"
        >
          <div className="flex gap-1">
            <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse" />
            <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse delay-75" />
          </div>
          <p className="text-[9px] lg:text-[10px] font-black uppercase tracking-[0.5em] text-slate-500 text-center">
            Desenvolvido por <span className="text-slate-200">Ygo Designer</span>
          </p>
        </motion.div>
      </div>

    </div>
  );
};

export default Login;