import React, { useState, useEffect } from 'react';
import { School } from '../types';
import { supabase } from '../lib/supabaseClient';
import {
  Building2, DollarSign, Calendar, Lock, Unlock,
  Plus, Search, LogOut, TrendingUp, AlertOctagon,
  MoreVertical, Edit, Mail, Key, Shield
} from 'lucide-react';
import { showToast, showAlert, showConfirm } from '../utils/alerts';
import { formatCurrency, getLocalDateString, formatDate, getFutureDateString } from '../utils/finance';
import { motion, AnimatePresence } from 'framer-motion';

interface SuperAdminDashboardProps {
  onLogout: () => void;
}

const SuperAdminDashboard: React.FC<SuperAdminDashboardProps> = ({ onLogout }) => {
  const [schools, setSchools] = useState<School[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'view'>('create');
  const [editingSchool, setEditingSchool] = useState<School | null>(null);

  // Estado do formulário
  const [formData, setFormData] = useState<Partial<School>>({
    name: '',
    slug: '',
    subscription_fee: 499.00,
    // AUTOMÁTICO: Próximo vencimento padrão = Hoje + 30 dias
    subscription_due_date: getFutureDateString(30),
    active: true,
    owner_email: ''
  });

  const [tempPassword, setTempPassword] = useState('');

  useEffect(() => {
    fetchSchools();
  }, []);

  const fetchSchools = async () => {
    try {
      const { data, error } = await supabase.from('schools').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      setSchools(data || []);
    } catch (error) {
      console.error('Erro ao buscar escolas:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveSchool = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const today = getLocalDateString();
      const dueDate = formData.subscription_due_date || today;

      // LÓGICA SÊNIOR: Bloqueio Automático Retroativo
      // Se a data de vencimento escolhida for menor que hoje, FORÇA o bloqueio (active = false)
      // Se a data for futura, e o status estava bloqueado por data antiga, podemos desbloquear automaticamente.
      let finalActiveStatus = formData.active;

      if (dueDate < today) {
        finalActiveStatus = false; // Venceu no passado? Bloqueia.
        showAlert("Aviso", "A data de vencimento é retroativa. A escola será bloqueada automaticamente.", "warning");
      } else {
        // Se estava bloqueado e jogou pro futuro, sugere desbloqueio, mas respeita o input do admin se ele quiser manter bloqueado manualmente
        // Aqui vamos assumir a regra de negócio: Pagou/Renovou = Desbloqueia.
        if (editingSchool && !editingSchool.active && formData.active) {
          // Admin já marcou como ativo no form, ok.
        } else if (dueDate >= today) {
          finalActiveStatus = true; // Data futura = Ativo
        }
      }

      const payload = {
        name: formData.name,
        slug: formData.slug || formData.name?.toLowerCase().replace(/\s+/g, '-'),
        subscription_fee: formData.subscription_fee,
        subscription_due_date: dueDate,
        active: finalActiveStatus,
        owner_email: formData.owner_email
      };

      if (editingSchool) {
        const { error } = await supabase.from('schools').update(payload).eq('id', editingSchool.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('schools').insert([payload]);
        if (error) throw error;
      }

      await fetchSchools();
      setIsModalOpen(false);
      setEditingSchool(null);
      resetForm();
    } catch (error: any) {
      showAlert('Erro ao salvar', error.message, 'error');
    }
  };

  const handleSendPasswordReset = async () => {
    if (!formData.owner_email) {
      showAlert("Erro", "É necessário um email cadastrado para redefinir a senha.", "error");
      return;
    }
    if (!await showConfirm(`Enviar email?`, `Enviar link de redefinição para ${formData.owner_email}?`)) return;

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(formData.owner_email, {
        redirectTo: window.location.origin, // Redireciona para o app após clicar no email
      });
      if (error) throw error;
      showToast(`Email enviado para ${formData.owner_email}!`, 'success');
    } catch (error: any) {
      showAlert("Erro ao enviar email", error.message, "error");
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      slug: '',
      subscription_fee: 499.00,
      subscription_due_date: getFutureDateString(30), // Reset sempre joga +30 dias
      active: true,
      owner_email: ''
    });
    setTempPassword('');
  };

  const handleToggleStatus = async (school: School) => {
    try {
      const newStatus = !school.active;
      // Se tentar desbloquear mas a data estiver vencida, avisa
      const today = getLocalDateString();
      if (newStatus === true && school.subscription_due_date && school.subscription_due_date < today) {
        if (!await showConfirm("Atenção", "A data de vencimento desta escola já passou. Desbloquear mesmo assim?")) {
          return;
        }
      }

      const { error } = await supabase.from('schools').update({ active: newStatus }).eq('id', school.id);
      if (error) throw error;
      setSchools(prev => prev.map(s => s.id === school.id ? { ...s, active: newStatus } : s));
      showToast(newStatus ? "Escola Desbloqueada" : "Escola Bloqueada", "info");
    } catch (error) {
      showAlert('Erro', 'Erro ao alterar status', 'error');
    }
  };

  // --- Actions ---

  const [searchTerm, setSearchTerm] = useState('');

  const filteredSchools = schools.filter(school =>
    school.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (school.owner_email && school.owner_email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleViewSchool = (school: School) => {
    setEditingSchool(school);
    setFormData(school);
    setModalMode('view');
    setIsModalOpen(true);
  };

  const handleDeleteSchool = async (schoolId: string) => {
    if (!await showConfirm("Excluir Escola?", "Isso apagará PERMANENTEMENTE todos os dados: alunos, turmas e histórico financeiro. Digite a senha de Super Admin para confirmar (simulação).")) return;

    // Simulação de segurança extra (em app real pediria senha novamente)
    if (!window.confirm("CONFIRMAÇÃO FINAL: Esta ação é irreversível. Deseja realmente excluir esta escola e TODOS os seus dados?")) return;

    try {
      setIsLoading(true);
      // Tentativa de exclusão direta (Cascade deve lidar com o resto)
      const { error } = await supabase.from('schools').delete().eq('id', schoolId);

      if (error) {
        console.error("Erro ao excluir:", error);
        throw error;
      }

      setSchools(prev => prev.filter(s => s.id !== schoolId));
      showToast("Escola excluída com sucesso!", "success");
    } catch (error: any) {
      // Se falhar, avisa
      showAlert("Erro ao excluir", "Não foi possível excluir a escola. Pode haver restrições de banco de dados (Foreign Keys) ou RLS.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const checkSaaSOverdue = (school: School) => {
    if (!school.subscription_due_date) return false;
    const today = getLocalDateString();
    return today > school.subscription_due_date;
  };

  // Metrics
  const totalMRR = schools.reduce((acc, curr) => acc + (curr.subscription_fee || 0), 0);
  const activeSchools = schools.filter(s => s.active).length;
  const blockedSchools = schools.filter(s => !s.active).length;

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200 font-outfit p-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-10">
        <div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-cyan-400">
            Painel Master (SaaS)
          </h1>
          <p className="text-slate-500">Controle total das franquias e faturamento.</p>
        </div>
        <button onClick={onLogout} className="flex items-center px-4 py-2 text-red-400 hover:bg-red-900/20 rounded-lg transition-colors">
          <LogOut className="w-4 h-4 mr-2" /> Sair
        </button>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700">
          <div className="flex justify-between items-center mb-4">
            <span className="text-slate-400 font-medium">Faturamento Mensal (MRR)</span>
            <DollarSign className="text-emerald-500 w-5 h-5" />
          </div>
          <p className="text-4xl font-bold text-white">{formatCurrency(totalMRR)}</p>
        </div>
        <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700">
          <div className="flex justify-between items-center mb-4">
            <span className="text-slate-400 font-medium">Escolas Ativas</span>
            <Building2 className="text-blue-500 w-5 h-5" />
          </div>
          <p className="text-4xl font-bold text-white">{activeSchools}</p>
        </div>
        <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700">
          <div className="flex justify-between items-center mb-4">
            <span className="text-slate-400 font-medium">Escolas Bloqueadas</span>
            <Lock className="text-red-500 w-5 h-5" />
          </div>
          <p className="text-4xl font-bold text-red-400">{blockedSchools}</p>
        </div>
      </div>

      {/* Schools List */}
      <div className="bg-slate-800/30 rounded-2xl border border-slate-700 overflow-hidden">
        <div className="p-6 border-b border-slate-700 flex flex-col md:flex-row justify-between items-center gap-4 bg-slate-900/50">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Building2 className="w-5 h-5 text-indigo-400" /> Escolas Cadastradas
          </h2>

          <div className="flex w-full md:w-auto gap-4">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500 w-4 h-4" />
              <input
                type="text"
                placeholder="Buscar escola ou email..."
                className="w-full pl-9 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <button
              onClick={() => { setEditingSchool(null); resetForm(); setModalMode('create'); setIsModalOpen(true); }}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg font-bold flex items-center transition-colors shadow-lg shadow-indigo-900/20 whitespace-nowrap"
            >
              <Plus className="w-5 h-5 mr-2" /> Nova Escola
            </button>
          </div>
        </div>

        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-900/50 text-slate-400 text-xs uppercase font-semibold">
            <tr>
              <th className="px-6 py-4">Escola / Email Admin</th>
              <th className="px-6 py-4">Plano (SaaS)</th>
              <th className="px-6 py-4">Vencimento Fatura</th>
              <th className="px-6 py-4">Status Financeiro</th>
              <th className="px-6 py-4 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {filteredSchools.map(school => {
              const isSaaSOverdue = checkSaaSOverdue(school);

              return (
                <tr key={school.id} className={`hover:bg-slate-800/50 transition-colors ${!school.active ? 'opacity-60 bg-red-900/5' : ''}`}>
                  <td className="px-6 py-4">
                    <div className="font-bold text-white text-lg">{school.name}</div>
                    <div className="text-sm text-slate-500">{school.owner_email || 'Email não cadastrado'}</div>
                  </td>
                  <td className="px-6 py-4 font-medium text-emerald-400">
                    {formatCurrency(school.subscription_fee || 0)}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-slate-500" />
                      <span>{formatDate(school.subscription_due_date || '')}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {isSaaSOverdue ? (
                      <span className="flex items-center gap-1 text-red-400 text-xs font-bold px-2 py-1 rounded bg-red-900/20 border border-red-900/50">
                        <AlertOctagon className="w-3 h-3" /> Vencido
                      </span>
                    ) : (
                      <span className="text-emerald-500 text-sm flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-emerald-500"></div> Em Dia
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => handleViewSchool(school)}
                        className="p-2 text-slate-400 hover:text-blue-400 hover:bg-slate-800 rounded-lg transition-colors"
                        title="Visualizar Detalhes"
                      >
                        <Search className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => handleToggleStatus(school)}
                        className={`p-2 rounded-lg border transition-all ${school.active
                          ? 'text-red-400 border-red-900/30 hover:bg-red-900/20'
                          : 'text-emerald-400 border-emerald-900/30 hover:bg-emerald-900/20 bg-emerald-900/10'
                          }`}
                        title={school.active ? "Bloquear Acesso da Escola" : "Desbloquear Acesso"}
                      >
                        {school.active ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                      </button>

                      <button
                        onClick={() => { setEditingSchool(school); setFormData(school); setModalMode('edit'); setIsModalOpen(true); }}
                        className="p-2 text-indigo-400 hover:bg-indigo-900/20 rounded-lg border border-transparent hover:border-indigo-900/30 transition-colors"
                        title="Editar Configurações"
                      >
                        <Edit className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => handleDeleteSchool(school.id)}
                        className="p-2 text-slate-500 hover:text-red-500 hover:bg-red-900/20 rounded-lg transition-colors border border-transparent hover:border-red-900/30"
                        title="Excluir Escola (Destrutivo)"
                      >
                        <LogOut className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modal Nova/Editar Escola */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              className="bg-[#1e293b] p-8 rounded-2xl w-full max-w-lg border border-slate-700 shadow-2xl overflow-y-auto max-h-[90vh]"
            >
              <h2 className="text-2xl font-bold text-white mb-6">
                {modalMode === 'create' && 'Cadastrar Nova Franquia'}
                {modalMode === 'edit' && 'Editar Configurações da Escola'}
                {modalMode === 'view' && 'Detalhes da Escola (Visualização)'}
              </h2>

              <form onSubmit={handleSaveSchool} className="space-y-6">
                <fieldset disabled={modalMode === 'view'} className="space-y-6 group-disabled:opacity-80">
                  {/* Dados Básicos */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider border-b border-slate-700 pb-2">Dados da Escola</h3>
                    <div>
                      <label className="text-sm text-slate-400 mb-1 block">Nome da Escola</label>
                      <input required type="text" className="w-full p-3 bg-slate-900 border border-slate-700 rounded-lg text-white focus:border-indigo-500 focus:outline-none" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Ex: Rise UP - Unidade Centro" />
                    </div>
                  </div>

                  {/* Financeiro */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider border-b border-slate-700 pb-2 flex items-center gap-2">
                      <DollarSign className="w-4 h-4" /> Configuração Financeira (SaaS)
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm text-slate-400 mb-1 block">Valor Mensal (R$)</label>
                        <input type="number" step="0.01" className="w-full p-3 bg-slate-900 border border-slate-700 rounded-lg text-emerald-400 font-bold text-lg" value={formData.subscription_fee} onChange={e => setFormData({ ...formData, subscription_fee: Number(e.target.value) })} />
                      </div>
                      <div>
                        <label className="text-sm text-slate-400 mb-1 block">Vencimento Fatura</label>
                        {/* Input Date Completo */}
                        <input
                          type="date"
                          className="w-full p-3 bg-slate-900 border border-slate-700 rounded-lg text-white cursor-pointer"
                          value={formData.subscription_due_date || ''}
                          onChange={e => setFormData({ ...formData, subscription_due_date: e.target.value })}
                        />
                        <p className="text-xs text-slate-500 mt-1">
                          {editingSchool ? 'Se retroativo, bloqueará a escola.' : 'Padrão: +30 dias.'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Credenciais de Acesso */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider border-b border-slate-700 pb-2 flex items-center gap-2">
                      <Key className="w-4 h-4" /> Credenciais de Acesso
                    </h3>
                    <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50">

                      <div className="space-y-3">
                        <div>
                          <label className="text-sm text-slate-400 mb-1 block flex items-center gap-2"><Mail className="w-3 h-3" /> Email de Login</label>
                          <input
                            type="email"
                            required
                            placeholder="admin@escola.com"
                            className="w-full p-3 bg-slate-900 border border-slate-700 rounded-lg text-white"
                            value={formData.owner_email || ''}
                            onChange={e => setFormData({ ...formData, owner_email: e.target.value })}
                          />
                        </div>

                        {editingSchool ? (
                          <div className="pt-2">
                            <label className="text-sm text-slate-400 mb-1 block flex items-center gap-2"><Lock className="w-3 h-3" /> Alterar Senha</label>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={handleSendPasswordReset}
                                className="flex-1 py-2 px-4 bg-orange-900/20 text-orange-400 border border-orange-900/50 rounded-lg text-sm font-bold hover:bg-orange-900/40 transition-colors flex items-center justify-center gap-2"
                              >
                                <Shield className="w-4 h-4" /> Enviar Email de Redefinição
                              </button>
                            </div>
                            <p className="text-xs text-slate-500 mt-2">
                              Por segurança, enviamos um link seguro para o dono da escola alterar sua própria senha.
                            </p>
                          </div>
                        ) : (
                          <div>
                            <label className="text-sm text-slate-400 mb-1 block flex items-center gap-2"><Lock className="w-3 h-3" /> Definir Senha Inicial</label>
                            <input
                              type="text"
                              placeholder="Digite uma senha forte"
                              className="w-full p-3 bg-slate-900 border border-slate-700 rounded-lg text-white"
                              value={tempPassword}
                              onChange={e => setTempPassword(e.target.value)}
                            />
                            <p className="text-xs text-slate-500 mt-2">
                              * Anote esta senha e entregue ao cliente.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                </fieldset>

                <div className="pt-4 flex gap-3">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="w-1/2 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors">
                    {modalMode === 'view' ? 'Fechar' : 'Cancelar'}
                  </button>
                  {modalMode !== 'view' && (
                    <button type="submit" className="w-1/2 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold transition-colors shadow-lg shadow-indigo-900/20">
                      {modalMode === 'edit' ? 'Salvar Alterações' : 'Cadastrar Escola'}
                    </button>
                  )}
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SuperAdminDashboard;