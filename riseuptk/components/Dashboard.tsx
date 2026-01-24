import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, AlertTriangle, CheckCircle, Clock, LogOut, BookOpen, Plus, X, Rocket, Sparkles, Bell, Calendar,
  LayoutDashboard, GraduationCap, Banknote, Database, Menu, ChevronLeft, Settings, Save, RefreshCw
} from 'lucide-react';
import officialLogo from '../LogotipoRiseUpOficial.png';
import { formatCurrency, formatDate, getLocalDateString, calculatePaymentDetails, getPaymentStatus, getDaysDifference } from '../utils/finance';
import ClassList from './ClassList';
import StudentList from './StudentList';
import Financial from './Financial';
import SqlDisplay from './SqlDisplay';
import Teachers from './Teachers';
import Attendance from './Attendance';
import { Student, Payment, Class, School } from '../types';
import { supabase } from '../lib/supabaseClient';

interface DashboardProps {
  schoolId: string;
  school: School | null;
  onUpdateSchool: (updated: School) => void;
  students: Student[];
  payments: Payment[];
  classes: Class[];
  onAddStudent: (student: Student, initialPaymentDate: string) => void;
  onEditStudent: (student: Student, specificNextDueDate?: string) => void;
  onDeleteStudent: (id: string) => void;
  onTogglePayment: (id: string) => void;
  onUpdatePaymentDate?: (paymentId: string, newDate: string) => void;
  onForgiveDebt: (id: string) => void;
  onLogout: () => void;
  onAddClass: (cls: Partial<Class>) => void;
  onEditClass: (cls: Class) => void;
  onDeleteClass: (id: string) => void;
}

const Dashboard: React.FC<DashboardProps> = ({
  schoolId,
  school,
  onUpdateSchool,
  students,
  payments,
  classes,
  onAddStudent,
  onEditStudent,
  onDeleteStudent,
  onTogglePayment,
  onUpdatePaymentDate,
  onForgiveDebt,
  onLogout,
  onAddClass,
  onEditClass,
  onDeleteClass
}) => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true); // Default OPEN
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [newInterestRate, setNewInterestRate] = useState(school?.daily_interest_rate || 0.004);

  // Class Modal State
  const [isClassModalOpen, setIsClassModalOpen] = useState(false);
  const [editingClassId, setEditingClassId] = useState<string | null>(null);
  const [newClass, setNewClass] = useState({ name: '', teacher: '', schedule: '', room: '', color: 'bg-blue-600' });

  // Stats Calculations
  const totalStudents = students.length;
  const currentInterestRate = school?.daily_interest_rate || 0.004;
  const processedPayments = useMemo(() => {
    return payments.map(p => {
      const student = students.find(s => s.id === p.student_id);
      return calculatePaymentDetails(p, currentInterestRate, student?.name);
    });
  }, [payments, currentInterestRate, students]);

  const handleUpdateInterestRate = async () => {
    if (!school) return;
    try {
      const { data, error } = await supabase
        .from('schools')
        .update({ daily_interest_rate: newInterestRate })
        .eq('id', school.id)
        .select()
        .single();

      if (error) throw error;
      if (data) {
        onUpdateSchool(data);
        setIsSettingsOpen(false);
        const { showToast } = await import('../utils/alerts');
        showToast("Taxa de juros atualizada com sucesso!");
      }
    } catch (error: any) {
      const { showAlert } = await import('../utils/alerts');
      showAlert("Erro ao atualizar", error.message, 'error');
    }
  };

  const handleSyncSpecialFees = async () => {
    try {
      const { showToast, showAlert } = await import('../utils/alerts');
      const { STUDENT_POLICIES } = await import('../utils/finance');

      showToast("Iniciando sincronização sênior...", "info");
      let updatedCount = 0;

      for (const [name, policy] of Object.entries(STUDENT_POLICIES)) {
        // Find existing student
        const { data: student } = await supabase.from('students').select('id, name').eq('name', name).single();
        if (!student) continue;

        // Update base fee in DB
        await supabase.from('students').update({ monthly_fee: policy.monthlyFeeLate }).eq('id', student.id);

        // Update pending payments base value
        await supabase.from('payments').update({ amount: policy.monthlyFeeLate }).eq('id', student.id).eq('status', 'pending');

        updatedCount++;
      }

      showToast(`${updatedCount} alunos sincronizados com sucesso!`);
    } catch (error: any) {
      const { showAlert } = await import('../utils/alerts');
      showAlert("Erro na sincronização", error.message, 'error');
    }
  };

  const overduePayments = processedPayments.filter(p => p.status === 'overdue');
  const totalOverdue = overduePayments.reduce((acc, curr) => acc + (curr.calculatedAmount || 0), 0);

  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  const paymentsReceivedThisMonth = processedPayments.filter(p => {
    if (!p.paid_at) return false;
    const paidDate = new Date(p.paid_at);
    return paidDate.getMonth() === currentMonth && paidDate.getFullYear() === currentYear;
  });

  const baseReceived = paymentsReceivedThisMonth.reduce((acc, curr) => acc + curr.amount, 0);
  const interestReceived = paymentsReceivedThisMonth.reduce((acc, curr) => acc + (curr.interest || 0), 0);
  const receivedThisMonth = baseReceived + interestReceived;

  // Lógica de Vencendo em Breve Simplificada (Acre)
  const todayStr = getLocalDateString();
  const pendingPayments = processedPayments.filter(p => p.status === 'pending');

  // No strict logic: upcoming is removed, so we check for due_today
  const upcomingPayments = pendingPayments.filter(p => {
    const status = getPaymentStatus(p.due_date, todayStr);
    return status === 'due_today';
  });

  const upcomingCount = upcomingPayments.length;
  // Any Due Today counts as "Vencendo Hoje" alert
  const isAnyDueToday = upcomingCount > 0;
  const pendingCount = pendingPayments.length;

  const totalPendingValue = pendingPayments.reduce((acc, curr) => acc + (curr.calculatedAmount || curr.amount), 0);
  const totalProjection = receivedThisMonth + totalPendingValue + totalOverdue;

  const notifications = useMemo(() => {
    if (!students.length) return [];
    // Removido 'upcoming' do tipo de alerta, pois simplificamos a lógica
    const alerts: Array<{ id: string, type: 'overdue' | 'due_today', studentName: string, amount: number, days: number, date: string }> = [];
    const tStr = getLocalDateString();

    processedPayments.forEach(payment => {
      if (payment.status === 'paid') return;
      const student = students.find(s => s.id === payment.student_id);
      if (!student) return;

      const status = getPaymentStatus(payment.due_date, tStr);
      const diffDays = getDaysDifference(payment.due_date, tStr);

      // Usando 'overdue' se estritamente atrasado
      if (status === 'overdue' || payment.status === 'overdue') {
        alerts.push({ id: payment.id, type: 'overdue', days: Math.abs(diffDays), studentName: student.name, amount: payment.calculatedAmount || payment.amount, date: payment.due_date });
      } else if (status === 'due_today') {
        alerts.push({ id: payment.id, type: 'due_today', days: 0, studentName: student.name, amount: payment.calculatedAmount || payment.amount, date: payment.due_date });
      }
    });

    return alerts.sort((a, b) => a.studentName.localeCompare(b.studentName));
  }, [processedPayments, students]);

  const handleSaveClass = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingClassId) {
      onEditClass({ ...newClass, id: editingClassId } as Class);
    } else {
      onAddClass(newClass);
    }
    closeClassModal();
  };

  const openNewClassModal = () => {
    setNewClass({ name: '', teacher: '', schedule: '', room: '', color: 'bg-blue-600' });
    setEditingClassId(null);
    setIsClassModalOpen(true);
  };

  const openEditClassModal = (cls: Class) => {
    setNewClass({ name: cls.name, teacher: cls.teacher, schedule: cls.schedule || '', room: cls.room || '', color: cls.color });
    setEditingClassId(cls.id);
    setIsClassModalOpen(true);
  };

  const closeClassModal = () => {
    setIsClassModalOpen(false);
    setNewClass({ name: '', teacher: '', schedule: '', room: '', color: 'bg-blue-600' });
    setEditingClassId(null);
  };

  React.useEffect(() => {
    if (students.length > 0 && activeTab === 'financial') {
      const runBilling = async () => {
        const { checkAndGenerateMonthlyFees } = await import('../utils/automaticBilling');
        await checkAndGenerateMonthlyFees(supabase, students, payments);
      };
      runBilling();
    }
  }, [students.length, activeTab, schoolId]);

  const navItems = [
    { id: 'dashboard', label: 'Início', icon: LayoutDashboard },
    { id: 'students', label: 'Alunos', icon: Users },
    { id: 'attendance', label: 'Chamada', icon: CheckCircle },
    { id: 'classes', label: 'Turmas', icon: GraduationCap },
    { id: 'teachers', label: 'Professores', icon: BookOpen },
    { id: 'financial', label: 'Financeiro', icon: Banknote },
  ];

  return (
    <div className="flex min-h-screen bg-[#0f172a] text-slate-200 font-outfit relative">

      {/* --- SIDEBAR BACKDROP (Mobile) --- */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[40] md:hidden"
          />
        )}
      </AnimatePresence>

      {/* --- SIDEBAR --- */}
      <motion.div
        initial={false}
        animate={{
          width: isSidebarOpen ? 260 : 0,
          opacity: isSidebarOpen ? 1 : 0
        }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="fixed md:sticky top-0 h-screen inset-y-0 left-0 bg-[#0b1120] border-r border-slate-800/50 flex flex-col z-[50] shadow-2xl overflow-hidden self-start"
      >
        <div className="p-6 flex items-center justify-between border-b border-slate-800/20 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/20 flex items-center justify-center border border-indigo-500/30">
              <img src={officialLogo} alt="Logo" className="w-8 h-8 object-contain" />
            </div>
            <div>
              <h1 className="font-black text-lg text-white tracking-tighter">RISE UP</h1>
              <p className="text-[9px] text-slate-500 font-bold uppercase tracking-[0.2em]">English School</p>
            </div>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="p-2 text-slate-500 hover:text-white transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 py-8 px-4 space-y-2 overflow-y-auto overflow-x-hidden custom-scrollbar">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => { setActiveTab(item.id); if (window.innerWidth < 768) setIsSidebarOpen(false); }}
              className={`w-full flex items-center p-3.5 rounded-2xl transition-all duration-300 group relative ${activeTab === item.id
                ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-900/40 font-bold'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'}`}
            >
              <item.icon className={`w-5 h-5 ${activeTab === item.id ? 'text-white' : 'text-slate-500 group-hover:text-white'}`} />
              <span className="ml-4 text-sm font-medium tracking-tight whitespace-nowrap">{item.label}</span>
            </button>
          ))}
        </div>

        <div className="p-6 border-t border-slate-800/30">
          <button onClick={onLogout} className="w-full flex items-center gap-3 p-3.5 text-red-400 hover:bg-red-500/10 rounded-2xl transition-all duration-300 group">
            <LogOut className="w-5 h-5 transition-transform group-hover:-translate-x-1" />
            <span className="text-sm font-bold tracking-tight">Encerrar Sessão</span>
          </button>
        </div>
      </motion.div>

      {/* --- MAIN WRAPPER --- */}
      <div className="flex-1 flex flex-col min-h-screen relative">
        <header className="sticky top-0 h-20 border-b border-slate-800/50 flex items-center justify-between px-4 md:px-8 bg-slate-900/90 backdrop-blur-md z-40 shrink-0">
          <div className="flex items-center gap-4">
            {!isSidebarOpen && (
              <button onClick={() => setIsSidebarOpen(true)} className="p-2.5 bg-slate-800 rounded-xl hover:bg-slate-700 transition-all">
                <Menu className="text-white w-5 h-5" />
              </button>
            )}
            <h2 className="text-lg md:text-xl font-black text-white uppercase tracking-tighter">
              {navItems.find(i => i.id === activeTab)?.label}
            </h2>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:block text-right">
              <p className="text-xs font-black text-white uppercase">{school?.name || 'Rise UP Staff'}</p>
              <p className="text-[10px] text-indigo-400 font-bold flex items-center justify-end gap-1 uppercase">Administrador Online</p>
            </div>

            <button onClick={() => setIsSettingsOpen(true)} className="p-2.5 bg-slate-800 border border-slate-700 rounded-xl hover:bg-slate-700 transition-colors"><Settings className="w-5 h-5 text-slate-400" /></button>

            <div className="relative">
              <button
                onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                className={`p-2.5 rounded-xl border ${notifications.some(n => n.type === 'overdue') ? 'bg-red-500/10 border-red-500/50 text-red-500' : 'bg-slate-800 border-slate-700 text-slate-400'}`}
              >
                <Bell className={`w-5 h-5 ${notifications.some(n => n.type === 'overdue') ? 'animate-pulse' : ''}`} />
                {totalStudents > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-600 text-[9px] font-black rounded-full flex items-center justify-center text-white border-2 border-slate-900">{totalStudents}</span>}
              </button>

              <AnimatePresence>
                {isNotificationsOpen && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="absolute right-0 top-full mt-4 w-80 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl z-[60] overflow-hidden">
                    <div className="p-4 border-b border-slate-800 bg-slate-950/40 font-black text-[10px] uppercase tracking-widest text-slate-400">Atividades Recentes</div>
                    <div className="max-h-72 overflow-y-auto custom-scrollbar">
                      {notifications.length === 0 ? <div className="p-8 text-center text-slate-500 text-xs font-bold uppercase tracking-widest">Tudo em dia!</div> : notifications.map(n => (
                        <div key={n.id} className="p-4 border-b border-slate-800 hover:bg-slate-800/50 transition-colors">
                          <p className="font-bold text-white text-sm">{n.studentName}</p>
                          <div className="flex justify-between items-center mt-1">
                            <span className={`text-[10px] uppercase font-black ${n.type === 'overdue' ? 'text-slate-500' : n.type === 'due_today' ? 'text-amber-500' : 'text-slate-500'}`}>
                              {n.type === 'overdue' ? 'ATRASADO' : n.type === 'due_today' ? 'VENCE HOJE' : 'VENCENDO LOGO'}
                            </span>
                            <span className={`text-xs font-black ${n.type === 'overdue' ? 'text-red-400' : n.type === 'due_today' ? 'text-amber-500' : 'text-yellow-500'}`}>
                              {formatCurrency(n.amount)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        <main className="flex-1 relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.2 }}
              className="h-full overflow-hidden flex flex-col"
            >
              {activeTab === 'dashboard' && (
                <div className="flex-1 p-4 md:p-8">
                  <div className="max-w-7xl mx-auto space-y-8">
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                      <div>
                        <h2 className="text-3xl md:text-5xl font-black text-white tracking-tighter flex items-center gap-3">
                          <Sparkles className="w-8 h-8 text-yellow-500 animate-pulse" />
                          Olá, Adm
                        </h2>
                        <p className="text-slate-400 font-bold text-sm md:text-base mt-2">Visão geral da sua unidade escolar hoje.</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                      {[
                        { label: 'Alunos', value: totalStudents, color: 'text-indigo-400', icon: Users, bg: 'bg-indigo-500/10', pulse: false },
                        { label: 'Faturamento', value: formatCurrency(receivedThisMonth), color: 'text-emerald-400', icon: CheckCircle, bg: 'bg-emerald-500/10', sub: interestReceived > 0 ? `+${formatCurrency(interestReceived)} juros` : null, pulse: false },
                        { label: 'Dívidas', value: formatCurrency(totalOverdue), color: 'text-red-400', icon: AlertTriangle, bg: 'bg-red-500/10', sub: `${overduePayments.length} em atraso`, pulse: false },
                        { label: 'Pendentes', value: formatCurrency(totalPendingValue), color: 'text-yellow-400', icon: Clock, bg: 'bg-yellow-500/10', sub: upcomingCount > 0 ? (isAnyDueToday ? '❗ VENCENDO HOJE' : `${upcomingCount} VENCENDO LOGO`) : `${pendingCount} agendados`, pulse: isAnyDueToday }
                      ].map((stat, i) => (
                        <div key={i} className={`bg-slate-800/40 p-6 rounded-[2rem] border shadow-xl relative overflow-hidden group transition-all duration-500 ${stat.pulse ? 'border-yellow-500/50 shadow-[0_0_30px_rgba(234,179,8,0.15)]' : 'border-slate-700'}`}>
                          {stat.pulse && (
                            <motion.div
                              animate={{ opacity: [0.3, 0.6, 0.3] }}
                              transition={{ duration: 2, repeat: Infinity }}
                              className="absolute inset-0 bg-yellow-500/5 pointer-events-none"
                            />
                          )}
                          <div className={`absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity`}><stat.icon className="w-20 h-20" /></div>
                          <div className="flex justify-between items-center mb-4">
                            <span className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em]">{stat.label}</span>
                            <div className={`p-2 ${stat.bg} rounded-xl`}><stat.icon className={`w-5 h-5 ${stat.color} ${stat.pulse ? 'animate-pulse' : ''}`} /></div>
                          </div>
                          <h3 className="text-3xl font-black text-white tracking-tighter">{stat.value}</h3>
                          {stat.sub && <p className={`text-[10px] font-black uppercase mt-2 ${stat.pulse ? 'text-yellow-500 animate-bounce' : stat.color}`}>{stat.sub}</p>}
                        </div>
                      ))}
                    </div>

                    <div className="bg-gradient-to-br from-indigo-600/20 via-slate-900/80 to-slate-900 border border-white/5 p-8 md:p-12 rounded-[3rem] shadow-2xl relative overflow-hidden group">
                      <div className="absolute -top-24 -right-24 w-96 h-96 bg-indigo-600/10 rounded-full blur-[100px]"></div>
                      <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-10">
                        <div className="text-center md:text-left">
                          <h4 className="text-indigo-400 font-black text-[10px] uppercase tracking-[0.5em] mb-4 flex items-center justify-center md:justify-start gap-2"><Rocket className="w-4 h-4" /> Projeção de Faturamento</h4>
                          <h2 className="text-6xl md:text-8xl font-black text-white tracking-tighter drop-shadow-2xl">{formatCurrency(totalProjection)}</h2>
                          <p className="text-slate-400 text-sm md:text-lg mt-4 max-w-md font-medium leading-relaxed">Estimativa total considerando todos os pagamentos previstos para o ciclo vigente.</p>
                        </div>
                        <div className="grid grid-cols-1 gap-2 w-full md:w-64">
                          {[
                            { label: 'Líquido', val: receivedThisMonth, col: 'text-emerald-400' },
                            { label: 'Pendente', val: totalPendingValue, col: 'text-yellow-500' },
                            { label: 'Atrasado', val: totalOverdue, col: 'text-red-500' }
                          ].map((item, i) => (
                            <div key={i} className="bg-black/30 backdrop-blur-xl p-4 rounded-3xl border border-white/5 flex justify-between items-center px-6">
                              <span className="text-[10px] font-black uppercase text-slate-500">{item.label}</span>
                              <span className={`text-xl font-black ${item.col}`}>{formatCurrency(item.val)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'students' && (
                <div className="flex-1 flex flex-col">
                  <StudentList
                    students={students} classes={classes} payments={payments} interestRate={currentInterestRate}
                    onAddStudent={onAddStudent} onEditStudent={onEditStudent} onDeleteStudent={onDeleteStudent}
                    onTogglePayment={onTogglePayment} onUpdatePaymentDate={onUpdatePaymentDate} onForgiveDebt={onForgiveDebt}
                  />
                </div>
              )}

              {activeTab === 'attendance' && (
                <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
                  <div className="max-w-7xl mx-auto"><Attendance schoolId={schoolId} classes={classes} students={students} /></div>
                </div>
              )}

              {activeTab === 'classes' && (
                <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
                  <div className="max-w-7xl mx-auto space-y-6">
                    <div className="flex justify-between items-center">
                      <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Turmas</h2>
                      <button onClick={openNewClassModal} className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg flex items-center gap-2 transition-all"><Plus className="w-5 h-5" /> Nova Turma</button>
                    </div>
                    <ClassList classes={classes} students={students} onEdit={openEditClassModal} onDelete={onDeleteClass} />
                  </div>
                </div>
              )}

              {activeTab === 'teachers' && (
                <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
                  <div className="max-w-7xl mx-auto"><Teachers schoolId={schoolId} classes={classes} /></div>
                </div>
              )}

              {activeTab === 'financial' && (
                <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
                  <div className="max-w-7xl mx-auto"><Financial payments={payments} students={students} classes={classes} interestRate={currentInterestRate} /></div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* --- MODALS (Settings & Class) --- */}
      <AnimatePresence>
        {isClassModalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div initial={{ scale: 0.9, y: 30 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 30 }} className="bg-slate-900 p-8 rounded-[2.5rem] w-full max-w-md border border-slate-700 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1.5 bg-indigo-600"></div>
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-2xl font-black text-white uppercase tracking-tighter">{editingClassId ? 'Editar Turma' : 'Nova Turma'}</h3>
                <button onClick={closeClassModal} className="p-2 bg-slate-800 rounded-full text-slate-400"><X /></button>
              </div>
              <form onSubmit={handleSaveClass} className="space-y-6">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest block mb-2">Identificação</label>
                  <input required className="w-full bg-slate-800 border border-slate-700 p-4 rounded-2xl text-white font-bold outline-none focus:ring-2 focus:ring-indigo-600 transition-all" value={newClass.name} onChange={e => setNewClass({ ...newClass, name: e.target.value })} placeholder="Nome da Turma" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <input required className="bg-slate-800 border border-slate-700 p-4 rounded-2xl text-white outline-none focus:ring-2 focus:ring-indigo-600" value={newClass.teacher} onChange={e => setNewClass({ ...newClass, teacher: e.target.value })} placeholder="Professor" />
                  <input className="bg-slate-800 border border-slate-700 p-4 rounded-2xl text-white outline-none focus:ring-2 focus:ring-indigo-600" value={newClass.schedule} onChange={e => setNewClass({ ...newClass, schedule: e.target.value })} placeholder="Horário" />
                </div>
                <div className="flex justify-center gap-3 py-4">
                  {['bg-blue-600', 'bg-indigo-600', 'bg-emerald-600', 'bg-rose-600', 'bg-amber-600'].map(c => (
                    <button key={c} type="button" onClick={() => setNewClass({ ...newClass, color: c })} className={`w-8 h-8 rounded-full ${c} border-4 transition-all ${newClass.color === c ? 'border-white scale-125' : 'border-transparent opacity-50'}`} />
                  ))}
                </div>
                <button type="submit" className="w-full py-4 bg-indigo-600 text-white font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-indigo-900/20 hover:bg-indigo-500 transition-all">Salvar Turma</button>
              </form>
            </motion.div>
          </motion.div>
        )}

        {isSettingsOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div initial={{ scale: 0.9, y: 30 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 30 }} className="bg-slate-900 p-8 rounded-[2.5rem] w-full max-w-sm border border-slate-700 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1.5 bg-emerald-500"></div>
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Ajustes</h3>
                <button onClick={() => setIsSettingsOpen(false)} className="p-2 bg-slate-800 rounded-full text-slate-400"><X /></button>
              </div>
              <div className="space-y-6">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest block mb-1">Juros ao Dia (%)</label>
                  <input type="number" step="0.001" className="w-full bg-slate-800 border border-slate-700 p-5 rounded-2xl text-white font-mono text-xl outline-none" value={newInterestRate} onChange={e => setNewInterestRate(Number(e.target.value))} />
                </div>
                <button onClick={handleUpdateInterestRate} className="w-full py-5 bg-emerald-600 text-white font-black uppercase tracking-widest rounded-3xl shadow-xl shadow-emerald-900/20 hover:bg-emerald-500 transition-all flex items-center justify-center gap-2"><Save className="w-5 h-5" /> Atualizar Taxa</button>

                <div className="pt-4 border-t border-slate-700/50 mt-4">
                  <p className="text-[9px] text-slate-500 font-bold uppercase mb-3">Manutenção de Dados (Senior)</p>
                  <button
                    onClick={handleSyncSpecialFees}
                    className="w-full py-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-2xl border border-slate-700 transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-wider"
                  >
                    <RefreshCw className="w-4 h-4" /> Corrigir Valores Especiais
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};

export default Dashboard;