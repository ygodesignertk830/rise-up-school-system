import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { motion } from 'framer-motion';
import { Phone, CheckCircle, Clock, AlertTriangle, RefreshCw, LogOut, Activity } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

const WhatsAppIntegration: React.FC = () => {
    const [config, setConfig] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);

    const [isActionLoading, setIsActionLoading] = useState(false);

    const fetchStatus = async () => {
        try {
            const { data, error } = await supabase
                .from('whatsapp_config')
                .select('*')
                .eq('id', 'global')
                .maybeSingle();

            if (error) throw error;
            setConfig(data);
        } catch (err) {
            console.error('Erro ao buscar status do WhatsApp:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleLogout = async () => {
        const { showConfirm, showToast } = await import('../utils/alerts');
        const confirmed = await showConfirm(
            'Desconectar WhatsApp?',
            'Você precisará escanear o QR Code novamente para reativar as cobranças automáticas.'
        );

        if (!confirmed) return;

        setIsActionLoading(true);
        try {
            const { error } = await supabase
                .from('whatsapp_config')
                .update({
                    status: 'logged_out',
                    qr_code: null,
                    command: 'logout',
                    updated_at: new Date().toISOString()
                })
                .eq('id', 'global');

            if (error) throw error;
            showToast('Comando de desconexão enviado!', 'success');
        } catch (err: any) {
            console.error('Erro ao desconectar:', err);
            const { showAlert } = await import('../utils/alerts');
            showAlert('Erro', 'Não foi possível enviar o comando de desconexão.', 'error');
        } finally {
            setIsActionLoading(false);
        }
    };

    useEffect(() => {
        fetchStatus();
        // Inscrição em tempo real para atualizações do QR Code/Status
        const channel = supabase
            .channel('whatsapp_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_config' }, () => {
                fetchStatus();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-slate-400">
                <RefreshCw className="w-8 h-8 animate-spin mb-4 text-purple-500" />
                <p className="font-bold animate-pulse">Carregando integração...</p>
            </div>
        );
    }

    const status = config?.status || 'logged_out';
    const qrCode = config?.qr_code;

    return (
        <div className="max-w-4xl mx-auto p-4">
            <header className="mb-8">
                <h2 className="text-3xl font-black text-white flex items-center gap-4">
                    <div className="p-3 bg-emerald-500/20 rounded-2xl">
                        <Phone className="w-8 h-8 text-emerald-400" />
                    </div>
                    Automação de WhatsApp
                </h2>
                <p className="text-slate-400 mt-2 text-lg">Gerencie a conexão do robô de cobrança automática.</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Status Card */}
                <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={`p-8 rounded-3xl border backdrop-blur-md flex flex-col items-center justify-center text-center transition-all duration-500 ${status === 'connected'
                        ? 'bg-emerald-900/20 border-emerald-500/50 shadow-[0_0_40px_rgba(16,185,129,0.1)]'
                        : 'bg-slate-800/40 border-slate-700/50'
                        }`}
                >
                    <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 shadow-xl ${status === 'connected' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-700'
                        }`}>
                        {status === 'connected' ? (
                            <CheckCircle className="w-12 h-12 text-white" />
                        ) : status === 'connecting' ? (
                            <Clock className="w-12 h-12 text-amber-400 animate-spin" />
                        ) : (
                            <AlertTriangle className="w-12 h-12 text-slate-400" />
                        )}
                    </div>

                    <h3 className="text-2xl font-black text-white mb-2 uppercase tracking-tight">
                        {status === 'connected' ? 'Robô Conectado' : status === 'connecting' ? 'Aguardando Login' : 'Desconectado'}
                    </h3>
                    <p className="text-slate-400 font-medium">
                        {status === 'connected'
                            ? 'As mensagens de cobrança serão enviadas automaticamente às 11:00 AC.'
                            : 'O robô precisa estar conectado para realizar os envios automáticos.'}
                    </p>

                    {status === 'connected' && (
                        <button
                            onClick={handleLogout}
                            disabled={isActionLoading}
                            className="mt-8 flex items-center gap-2 px-6 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-2xl font-bold transition-all disabled:opacity-50"
                        >
                            {isActionLoading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <LogOut className="w-5 h-5" />}
                            {isActionLoading ? 'Desconectando...' : 'Desconectar WhatsApp'}
                        </button>
                    )}
                </motion.div>

                {/* QR Code / Instructions Card */}
                <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="bg-slate-800/40 border border-slate-700/50 p-8 rounded-3xl backdrop-blur-md"
                >
                    {status === 'connected' ? (
                        <div className="flex flex-col items-center justify-center h-full space-y-4">
                            <div className="p-6 bg-emerald-500/10 rounded-full">
                                <ShieldCheck className="w-16 h-16 text-emerald-400" />
                            </div>
                            <p className="text-emerald-400 font-black text-center text-lg uppercase tracking-widest">Conexão Segura</p>
                            <p className="text-slate-500 text-center">A sua conta de WhatsApp está vinculada ao servidor local de automação.</p>
                        </div>
                    ) : qrCode ? (
                        <div className="flex flex-col items-center">
                            <p className="text-white font-bold mb-6 text-center">Escaneie o QR Code abaixo com o WhatsApp da escola:</p>
                            <div className="p-6 bg-white rounded-3xl shadow-2xl overflow-hidden mb-6">
                                <QRCodeSVG value={qrCode} size={240} level="H" includeMargin={true} />
                            </div>
                            <div className="flex flex-col gap-3 w-full">
                                <div className="flex items-center gap-3 text-slate-400 text-sm bg-slate-900/50 p-3 rounded-xl border border-slate-700">
                                    <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 font-bold text-xs">1</div>
                                    Abra o WhatsApp no celular
                                </div>
                                <div className="flex items-center gap-3 text-slate-400 text-sm bg-slate-900/50 p-3 rounded-xl border border-slate-700">
                                    <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 font-bold text-xs">2</div>
                                    Toque em Aparelhos Conectados
                                </div>
                                <div className="flex items-center gap-3 text-slate-400 text-sm bg-slate-900/50 p-3 rounded-xl border border-slate-700">
                                    <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 font-bold text-xs">3</div>
                                    aponte para esta tela
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-center p-6 bg-slate-900/50 rounded-2xl border border-dashed border-slate-600">
                            <RefreshCw className="w-12 h-12 text-slate-600 mb-4 animate-spin" />
                            <p className="text-slate-400 font-bold uppercase tracking-wider">Gerando Novo Código...</p>
                            <p className="text-xs text-slate-500 mt-2">Certifique-se que o serviço `node index.js` está rodando no seu computador.</p>
                        </div>
                    )}
                </motion.div>
            </div>

            <div className="mt-8 p-6 bg-blue-900/10 border border-blue-500/30 rounded-3xl">
                <h4 className="text-blue-400 font-bold flex items-center gap-2 mb-2">
                    <Activity className="w-5 h-5" /> Dica para o Administrador
                </h4>
                <p className="text-slate-400 text-sm leading-relaxed">
                    O serviço de WhatsApp utiliza a tecnologia Baileys. Para que os envios ocorram às **11:00**, mantenha o terminal aberto com o comando `node index.js` rodando no servidor escolar. Você pode fechar esta página do navegador após conectar; o serviço continuará rodando em segundo plano.
                </p>
            </div>
        </div>
    );
};

export default WhatsAppIntegration;

const ShieldCheck = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
);
