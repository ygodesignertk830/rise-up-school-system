import React, { useState } from 'react';
import { Lock, Mail, ArrowRight, Loader2 } from 'lucide-react';
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
    <div className="h-[100dvh] w-screen relative bg-[#020617] text-white font-outfit overflow-hidden flex flex-col items-center justify-center p-4">

      <div className="relative z-10 w-full max-w-6xl h-full flex flex-col items-center justify-center p-2 lg:p-0">

        <div className="w-full flex flex-col lg:flex-row items-center justify-center gap-6 lg:gap-24">

          {/* BRANDING HUB - Static */}
          <div className="shrink-0 scale-90 lg:scale-100">
            <div className="relative group">
              <div className="w-24 h-24 lg:w-72 lg:h-72 rounded-full flex items-center justify-center relative backdrop-blur-3xl border border-white/10 shadow-[0_0_100px_rgba(79,70,229,0.15)] overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-tr from-indigo-950/40 via-transparent to-blue-900/40 opacity-60" />
                <img
                  src={officialLogo}
                  alt="Rise Up Logo"
                  className="w-full h-full object-contain relative z-10 p-2 lg:p-6 drop-shadow-[0_0_40px_rgba(255,255,255,0.3)]"
                />
              </div>
            </div>
          </div>

          {/* PORTAL CORE */}
          <div className="w-full max-w-md shrink-0 lg:shrink px-1">
            <div className="bg-[#0f172a]/40 backdrop-blur-3xl p-6 md:p-12 rounded-[3rem] border border-white/5 shadow-[0_40px_120px_rgba(0,0,0,0.7)] relative overflow-hidden group">
              <div className="relative z-10 space-y-8">
                <div className="text-center lg:text-left">
                  <h2 className="text-3xl lg:text-4xl font-black text-white tracking-tighter uppercase mb-2 bg-clip-text text-transparent bg-gradient-to-b from-white to-slate-400">
                    Acesso Master
                  </h2>
                  <p className="text-[10px] lg:text-xs text-slate-500 font-bold uppercase tracking-[0.2em] mt-1 leading-relaxed">Gestão Digital • Rise UP English School</p>
                </div>

                {error && (
                  <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-200 text-[10px] lg:text-xs font-bold rounded-2xl flex items-center gap-3">
                    <div className="w-2 h-2 bg-red-500 rounded-full" /> {error}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5 lg:space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em] ml-1">E-mail Administrativo</label>
                    <div className="relative">
                      <Mail className="absolute left-5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-600 transition-colors group-focus-within:text-indigo-400" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full pl-14 pr-6 py-4 lg:py-5 bg-black/40 border border-slate-800 rounded-2xl focus:ring-2 focus:ring-indigo-600 focus:border-transparent outline-none text-white font-bold transition-all placeholder-slate-800"
                        placeholder="admin@riseup.school"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em] ml-1">Senha de Segurança</label>
                    <div className="relative">
                      <Lock className="absolute left-5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-600 transition-colors group-focus-within:text-indigo-400" />
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full pl-14 pr-6 py-4 lg:py-5 bg-black/40 border border-slate-800 rounded-2xl focus:ring-2 focus:ring-indigo-600 focus:border-transparent outline-none text-white font-bold transition-all"
                        placeholder="••••••••"
                        required
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-5 lg:py-6 bg-white text-indigo-950 font-black uppercase tracking-[0.3em] text-[10px] lg:text-xs rounded-2xl shadow-2xl hover:bg-slate-50 active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-30 group"
                  >
                    {loading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>Entrar no Painel <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" /></>
                    )}
                  </button>
                </form>

                {/* --- COMPACT SIGNATURE BELOW BUTTON --- */}
                <div className="flex flex-col items-center gap-1.5 pt-2 pointer-events-none opacity-50">
                  <div className="flex gap-1 justify-center">
                    <div className="w-1 h-1 bg-indigo-500 rounded-full" />
                    <div className="w-1 h-1 bg-blue-500 rounded-full" />
                  </div>
                  <p className="text-[7px] lg:text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 text-center ml-[0.4em]">
                    Desenvolvido por <span className="text-white brightness-125">Ygo Designer</span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
export default Login;