import React, { useState, useRef, useEffect } from 'react';
import { Search, Plus, X, Upload, Camera, Edit2, Eye, Rocket, CheckCircle, AlertTriangle, ShieldCheck, Trash2, Calendar, RotateCcw, CalendarDays, ArrowRight, Sparkles, FileText, Users, Clock, Phone } from 'lucide-react';
import { Student, Class, Payment } from '../types';
import { formatCurrency, formatDate, getLocalDateString, calculatePaymentDetails, getPaymentStatus, getDaysDifference, calculateNextMonthSameDay, STUDENT_POLICIES, getUPComingAlert } from '../utils/finance';
import { motion, AnimatePresence } from 'framer-motion';
import { showAlert } from '../utils/alerts';

interface StudentListProps {
    students: Student[];
    classes: Class[];
    payments?: Payment[];
    interestRate?: number; // NEW PROP
    onAddStudent: (student: Student, initialPaymentDate: string) => void;
    onEditStudent: (student: Student) => void;
    onDeleteStudent: (id: string) => void;
    onTogglePayment?: (id: string) => void;
    onUpdatePaymentDate?: (paymentId: string, newDate: string) => void;
    onForgiveDebt?: (id: string) => void;
    premiumWhatsAppEnabled?: boolean;
}

const StudentList: React.FC<StudentListProps> = ({
    students,
    classes,
    payments = [],
    interestRate = 0.004, // DEFAULT FALLBACK
    onAddStudent,
    onEditStudent,
    onDeleteStudent,
    onTogglePayment,
    onUpdatePaymentDate,
    onForgiveDebt,
    premiumWhatsAppEnabled = false,
    premiumWhatsAppOverdueEnabled = false
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState<'add' | 'edit' | 'view'>('add');
    const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

    // Estado para animação de pagamento
    const [launchingId, setLaunchingId] = useState<string | null>(null);

    // States para lógica de data
    const [isRetroactive, setIsRetroactive] = useState(false);

    const [formData, setFormData] = useState<Partial<Student>>({
        name: '',
        class_id: '',
        monthly_fee: 150,
        status: 'active',
        photo_url: undefined,
        enrollment_date: '',
        birth_date: ''
    });

    const [initialPaymentDate, setInitialPaymentDate] = useState<string>('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    // --- LÓGICA SÊNIOR DE DATAS ---


    // EFEITO 1: Monitora Matrícula -> Sugere Vencimento (Dia exato no próximo mês)
    useEffect(() => {
        if (modalMode === 'add' && formData.enrollment_date) {
            const nextDate = calculateNextMonthSameDay(formData.enrollment_date);
            setInitialPaymentDate(nextDate);

            // O dia de vencimento recorrente será o dia da data calculada
            const day = parseInt(nextDate.split('-')[2]);
            setFormData(prev => ({ ...prev, payment_due_day: day }));
        }
    }, [formData.enrollment_date, modalMode]);

    // EFEITO 2: Monitora Vencimento Manual -> Verifica Retroatividade
    useEffect(() => {
        if (modalMode === 'add' && initialPaymentDate) {
            const today = getLocalDateString();
            setIsRetroactive(initialPaymentDate < today);

            // Se usuário mudar manualmente o vencimento, atualizamos o dia recorrente
            const day = parseInt(initialPaymentDate.split('-')[2]);
            if (!isNaN(day)) {
                setFormData(prev => ({ ...prev, payment_due_day: day }));
            }
        }
    }, [initialPaymentDate, modalMode]);

    const resetForm = () => {
        const today = getLocalDateString();
        setFormData({
            name: '',
            class_id: classes[0]?.id || '',
            monthly_fee: 150,
            status: 'active',
            photo_url: undefined,
            phone: '',
            guardian_name: '',
            birth_date: '',
            enrollment_date: today,
            payment_due_day: parseInt(today.split('-')[2])
        });
        // Calcula o padrão inicial
        setInitialPaymentDate(calculateNextMonthSameDay(today));
        setSelectedStudent(null);
        setIsRetroactive(false);
    };

    const handleOpenAdd = () => {
        resetForm();
        setModalMode('add');
        setIsModalOpen(true);
    };

    const handleOpenEdit = (student: Student) => {
        setSelectedStudent(student);
        setFormData({ ...student });

        // Find current pending/overdue payment to populate the date picker
        const currentPayment = payments.find(p => p.student_id === student.id && p.status !== 'paid');
        if (currentPayment) {
            setInitialPaymentDate(currentPayment.due_date);
        } else {
            // Fallback: Calculate likely next based on due day
            const today = new Date();
            let targetYear = today.getFullYear();
            let targetMonth = today.getMonth();
            const dueDay = student.payment_due_day || 10;

            if (today.getDate() > dueDay) {
                targetMonth++;
                if (targetMonth > 11) { targetMonth = 0; targetYear++; }
            }
            const mStr = String(targetMonth + 1).padStart(2, '0');
            const dStr = String(dueDay).padStart(2, '0');
            setInitialPaymentDate(`${targetYear}-${mStr}-${dStr}`);
        }

        setModalMode('edit');
        setIsModalOpen(true);
    };

    const handleOpenView = (student: Student) => {
        setSelectedStudent(student);
        setFormData({ ...student });
        setModalMode('view');
        setIsModalOpen(true);
    };

    const handleCloseModal = () => { setIsModalOpen(false); resetForm(); };

    const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => setFormData(prev => ({ ...prev, photo_url: reader.result as string }));
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        const studentData: Student = {
            // Preserva dados originais se for edição (importante para school_id)
            ...selectedStudent,
            // Garante campos obrigatórios para novos
            id: selectedStudent?.id || `new-${Date.now()}`,
            school_id: selectedStudent?.school_id || classes[0]?.school_id || '1', // Tenta pegar ID real da escola
            name: formData.name!,
            class_id: formData.class_id!,
            monthly_fee: Number(formData.monthly_fee),
            enrollment_date: formData.enrollment_date || getLocalDateString(),
            payment_due_day: formData.payment_due_day || 10,
            status: formData.status as 'active' | 'inactive',
            photo_url: formData.photo_url,
            phone: formData.phone,
            guardian_name: formData.guardian_name,
            birth_date: formData.birth_date
        };

        if (modalMode === 'add') {
            onAddStudent(studentData, initialPaymentDate);
        } else if (modalMode === 'edit') {
            // Pass the specific full date chosen in the UI
            onEditStudent(studentData, initialPaymentDate);
        }

        handleCloseModal();
    };

    // MÓDULO PREMIUM: WhatsApp Reminder
    const handleWhatsAppReminder = (student: any) => {
        const phone = student.phone || '';
        if (!phone) {
            showAlert("⚠️ Atenção", "Número de telefone não cadastrado para este aluno.", "warning");
            return;
        }

        const days = student.daysUntilDue;
        const todayStr = getLocalDateString();
        const valueStr = formatCurrency(student.monthly_fee);

        const greeting = student.guardian_name ? `Olá *${student.guardian_name}*!` : `Olá!`;
        let message = `${greeting} Passando para lembrar que a mensalidade do(a) aluno(a) *${student.name}* vence em breve (${formatDate(student.relevantDate)}). Valor: ${valueStr}. Conte conosco!`;
        if (days === 0) message = `${greeting} Passando para lembrar que a mensalidade do(a) aluno(a) *${student.name}* *VENCE HOJE*. Valor: ${valueStr}. Conte conosco!`;
        else if (days === 1) message = `${greeting} Passando para lembrar que a mensalidade do(a) aluno(a) *${student.name}* vence em *2 DIAS* (${formatDate(student.relevantDate)}). Valor: ${valueStr}. Conte conosco!`;
        else if (days === 2) message = `${greeting} Passando para lembrar que a mensalidade do(a) aluno(a) *${student.name}* vence em *3 DIAS* (${formatDate(student.relevantDate)}). Valor: ${valueStr}. Conte conosco!`;

        const cleanPhone = phone.replace(/\D/g, '');
        const url = `https://wa.me/55${cleanPhone}?text=${encodeURIComponent(message)}`;
        window.open(url, '_blank');
    };

    const handleWhatsAppOverdueReminder = (student: any) => {
        const phone = student.phone || '';
        if (!phone) {
            showAlert("⚠️ Atenção", "Número de telefone não cadastrado para este aluno.", "warning");
            return;
        }

        const totalDebtStr = formatCurrency(student.totalDebt);
        const interestStr = formatCurrency(student.totalInterest);
        const baseFeeStr = formatCurrency(student.monthly_fee);
        const ratePct = (interestRate * 100).toFixed(1);

        const greeting = student.guardian_name ? `Olá *${student.guardian_name}*!` : `Olá!`;
        const message = `${greeting} Passando para informar que a mensalidade do(a) aluno(a) *${student.name}* consta em nosso sistema como *ATRASADA* (${student.daysOverdue} ${student.daysOverdue === 1 ? 'dia' : 'dias'}).\n\n*Resumo financeiro:*\n• Valor original: ${baseFeeStr}\n• Juros acumulados: ${interestStr} (Taxa: ${ratePct}% ao dia)\n• *Valor total atualizado: ${totalDebtStr}*\n\nPor favor, regularize assim que possível. Conte conosco!`;

        const cleanPhone = phone.replace(/\D/g, '');
        const url = `https://wa.me/55${cleanPhone}?text=${encodeURIComponent(message)}`;
        window.open(url, '_blank');
    };

    const handlePaymentClick = (id: string, isCurrentlyPaid: boolean) => {
        if (!isCurrentlyPaid && onTogglePayment) {
            setLaunchingId(id);
            setTimeout(() => {
                onTogglePayment(id);
                setLaunchingId(null);
            }, 1000);
        } else if (onTogglePayment) {
            onTogglePayment(id);
        }
    };

    const filteredStudents = students.filter(student =>
        student.name.toLowerCase().includes(searchTerm.toLowerCase())
    ).sort((a, b) => a.name.localeCompare(b.name))
        .map(s => {
            // Lógica Simplificada Acre (Fuso America/Rio_Branco já em finance.ts)
            // 1. Processa todos os pagamentos deste aluno
            const myPayments = payments
                .filter(p => p.student_id === s.id)
                .map(p => calculatePaymentDetails(p, interestRate, s.name));

            // 2. Filtra por estados fundamentais
            // Atrasados (Data < Hoje e não pago)
            const overduePayments = myPayments.filter(p => p.status === 'overdue');

            // Vence Hoje (Data == Hoje e não pago)
            // Em finance.ts, getPaymentStatus retorna 'due_today' se diff == 0
            const todayStr = getLocalDateString();
            const dueTodayPayments = myPayments.filter(p => getPaymentStatus(p.due_date, todayStr) === 'due_today' && p.status !== 'paid');

            // Pendentes Gerais (Futuro) - Qualquer coisa não paga que não seja atrasada nem hoje
            const pendingPayments = myPayments.filter(p => p.status === 'pending' && getPaymentStatus(p.due_date, todayStr) === 'on_time');

            // 3. Determina Status Principal do Aluno
            // Prioridade: Atrasado > Vence Hoje > Em Dia
            let primaryStatus = {
                hasOverdue: false,
                isDueToday: false,
                isOnTime: true, // Default se não houver problemas
                daysUntilDue: 0,
                daysOverdue: 0,
                totalDebt: 0,
                totalInterest: 0,
                relevantDate: ''
            };

            // FLAG BOLSISTA
            const isScholarship = STUDENT_POLICIES[s.name]?.isScholarship;

            if (overduePayments.length > 0 && !isScholarship) {

                primaryStatus.hasOverdue = true;
                primaryStatus.isOnTime = false;
                primaryStatus.totalDebt = overduePayments.reduce((acc, curr) => acc + (curr.calculatedAmount || 0), 0);
                primaryStatus.totalInterest = overduePayments.reduce((acc, curr) => acc + (curr.interest || 0), 0);
                // Data mais antiga de atraso
                const oldest = overduePayments.sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())[0];
                primaryStatus.relevantDate = oldest.due_date;
                primaryStatus.daysOverdue = oldest.daysOverdue || 0;
            } else if (dueTodayPayments.length > 0) {
                primaryStatus.isDueToday = true;
                primaryStatus.isOnTime = false;
                primaryStatus.relevantDate = dueTodayPayments[0].due_date;
            } else if (pendingPayments.length > 0) {
                // Em dia, mostra o próximo vencimento
                const next = pendingPayments.sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())[0];
                primaryStatus.relevantDate = next.due_date;
                // Calculamos dias apenas para labels informativos se desejado ("Vence em X dias"), mas status é VERDE
                const diff = getDaysDifference(next.due_date, todayStr);
                primaryStatus.daysUntilDue = diff;

                // Alerta de 3 dias (Amarelo)
                if (diff > 0 && diff <= 3) {
                    primaryStatus.isOnTime = false;
                    primaryStatus.isDueToday = false; // Just to be safe
                }
            } else {
                // Sem pendências
                primaryStatus.relevantDate = '';
            }

            // 4. Ação Rápida (Botão Pagar)
            // Prioriza o que é mais urgente
            let actionPayment = overduePayments[0] || dueTodayPayments[0] || pendingPayments[0] || undefined;
            if (actionPayment) {
                // Sort overdue by oldest first if multiple
                if (overduePayments.length > 1) actionPayment = overduePayments.sort((a, b) => a.due_date.localeCompare(b.due_date))[0];
                // Sort pending by soonest first
                if (pendingPayments.length > 1) actionPayment = pendingPayments.sort((a, b) => a.due_date.localeCompare(b.due_date))[0];
            }

            // Fallback para desfazer pagamento (pernite pegar o último pago)
            if (!actionPayment) {
                const paid = myPayments.filter(p => p.status === 'paid').sort((a, b) => b.due_date.localeCompare(a.due_date));
                if (paid.length > 0) actionPayment = paid[0];
            }

            return {
                ...s,
                className: classes.find(c => c.id === s.class_id)?.name || 'N/A',
                phone: (s as any).phone || '', // Adicionado dinamicamente
                ...primaryStatus,
                actionPayment,
                // Mantemos propertys auxiliares
                isUpcoming: primaryStatus.daysUntilDue > 0 && primaryStatus.daysUntilDue <= 3,
                isScholarship // EXPORT FLAG
            };
        });

    const studentPayments = selectedStudent
        ? payments.filter(p => p.student_id === selectedStudent.id).map(p => {
            // Lógica Simplificada Acre via finance.ts
            const processed = calculatePaymentDetails(p, interestRate, selectedStudent.name);
            const todayStr = getLocalDateString();
            const status = getPaymentStatus(processed.due_date, todayStr);

            return {
                ...processed,
                hasOverdue: processed.status === 'overdue',
                isDueToday: status === 'due_today',
                // Upcoming nao existe mais como status distinto, é 'on_time', mas criamos flag para não quebrar UI se necessário
                isUpcoming: status === 'on_time' && (getDaysDifference(processed.due_date, todayStr) > 0 && getDaysDifference(processed.due_date, todayStr) <= 3),
                isOnTime: status === 'on_time',
                daysUntilDue: getDaysDifference(processed.due_date, todayStr),
                totalDebt: processed.calculatedAmount || processed.amount,
                totalInterest: processed.interest || 0
            };
        }).sort((a, b) => new Date(b.due_date).getTime() - new Date(a.due_date).getTime())
        : [];

    return (
        <div className="bg-transparent flex flex-col">
            {/* Toolbar - STICKY at Top */}
            <div className="sticky top-0 p-4 lg:p-8 border-b border-slate-700/50 flex flex-col md:flex-row justify-between items-center gap-4 bg-[#0f172a] shadow-lg z-20 flex-shrink-0">
                <div className="relative w-full md:w-96">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
                    <input
                        type="text"
                        placeholder="Procurar aluno..."
                        className="w-full pl-10 pr-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-slate-200 placeholder-slate-500 transition-all"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <button
                    onClick={handleOpenAdd}
                    className="flex items-center justify-center px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:from-blue-500 hover:to-purple-500 transition-all shadow-lg shadow-purple-900/20 font-bold"
                >
                    <Plus className="w-5 h-5 md:mr-2" />
                    <span className="hidden md:inline">Novo Aluno</span>
                </button>
            </div>

            {/* List - Natural Height */}
            <div className="p-4 lg:p-8">
                <div className="max-w-7xl mx-auto">
                    {/* DESKTOP TABLE VIEW */}
                    <div className="hidden md:block overflow-x-auto pb-4">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-slate-800/40 border-b border-slate-700/50 text-slate-400">
                                <tr>
                                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider whitespace-nowrap">Aluno (A-Z)</th>
                                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider whitespace-nowrap">Turma</th>
                                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider whitespace-nowrap">Vencimento</th>
                                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider whitespace-nowrap">Situação Financeira</th>
                                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-right whitespace-nowrap">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700/30">
                                {filteredStudents.map((student) => (
                                    <tr key={student.id} className="hover:bg-slate-800/30 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center cursor-pointer" onClick={() => handleOpenView(student)}>
                                                <div className="relative flex-shrink-0">
                                                    {student.photo_url ? (
                                                        <img src={student.photo_url} alt={student.name} className="h-12 w-12 rounded-full object-cover border-2 border-slate-600 group-hover:border-purple-500 transition-colors shadow-lg" />
                                                    ) : (
                                                        <div className="h-12 w-12 rounded-full bg-slate-700 flex items-center justify-center text-slate-400 font-bold border-2 border-slate-600 group-hover:border-purple-500 transition-colors shadow-lg">
                                                            {student.name.substring(0, 2).toUpperCase()}
                                                        </div>
                                                    )}
                                                    <div className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[#0f172a] ${student.status === 'active' ? 'bg-emerald-500' : 'bg-slate-500'}`}></div>
                                                </div>
                                                <div className="ml-3 min-w-0">
                                                    <span className="text-sm font-bold text-white block truncate">{student.name}</span>
                                                    <span className="text-xs text-slate-400 block truncate">
                                                        Matrícula: {formatDate(student.enrollment_date || '')}
                                                    </span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="inline-block px-3 py-1 rounded-lg text-xs font-medium bg-slate-800/80 text-blue-300 border border-slate-700 whitespace-normal text-center max-w-[150px] leading-tight">
                                                {student.className}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className={`text-sm font-bold ${student.hasOverdue ? 'text-red-400' : student.isDueToday ? 'text-amber-500' : student.isUpcoming ? 'text-yellow-400' : 'text-slate-300'}`}>
                                                    {student.isScholarship ? 'Bolsista' : (student.relevantDate ? formatDate(student.relevantDate) : '--/--')}
                                                </span>
                                                <span className="text-[10px] text-slate-500 uppercase tracking-wider">
                                                    {student.isScholarship ? 'Isento' : (student.relevantDate ? (student.hasOverdue ? 'Venceu' : 'Vence em') : 'Sem previsão')}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {student.hasOverdue ? (
                                                <div className="flex flex-col items-start bg-red-400/5 p-2 rounded-xl border border-red-500/20">
                                                    <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold bg-red-900 text-red-100 border border-red-500 animate-pulse mb-1 uppercase">
                                                        <AlertTriangle className="w-3 h-3 mr-1" /> Atrasado há {student.daysOverdue} {student.daysOverdue === 1 ? 'dia' : 'dias'}
                                                    </span>
                                                    <span className="text-sm text-red-400 font-black">
                                                        {formatCurrency(student.totalDebt)}
                                                    </span>
                                                    {premiumWhatsAppOverdueEnabled && (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleWhatsAppOverdueReminder(student); }}
                                                            className="mt-2 flex items-center gap-1 text-[9px] font-black text-emerald-400 hover:text-emerald-300 transition-colors uppercase py-1 px-2 bg-emerald-900/10 rounded-lg border border-emerald-500/20"
                                                        >
                                                            <Rocket className="w-3 h-3" /> Cobrar Atraso (Whats)
                                                        </button>
                                                    )}
                                                    {student.totalInterest > 0 && (
                                                        <span className="text-[10px] text-red-400/70 font-mono">
                                                            (+ {formatCurrency(student.totalInterest)} juros)
                                                        </span>
                                                    )}
                                                </div>
                                            ) : student.isDueToday ? (
                                                <div className="flex flex-col items-start bg-amber-400/5 p-2 rounded-xl border border-amber-500/20">
                                                    <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold bg-amber-600 text-white border border-amber-400 mb-1 uppercase">
                                                        <Clock className="w-3 h-3 mr-1" /> Vence Hoje
                                                    </span>
                                                    <span className="text-sm font-black text-amber-500">
                                                        PAGAR HOJE
                                                    </span>
                                                    {premiumWhatsAppEnabled && (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleWhatsAppReminder(student); }}
                                                            className="mt-2 flex items-center gap-1 text-[9px] font-black text-emerald-400 hover:text-emerald-300 transition-colors uppercase bg-emerald-500/10 px-2 py-1 rounded-md border border-emerald-500/20"
                                                        >
                                                            <Rocket className="w-3 h-3" /> Lembrar via Whats
                                                        </button>
                                                    )}
                                                </div>
                                            ) : student.isUpcoming ? (
                                                <div className="flex flex-col items-start bg-amber-400/5 p-2 rounded-xl border border-amber-500/20">
                                                    <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold bg-amber-400 text-amber-900 border border-amber-500 mb-1 uppercase">
                                                        <Clock className="w-3 h-3 mr-1" /> Atenção
                                                    </span>
                                                    <span className="text-sm font-black text-amber-500">
                                                        {student.daysUntilDue === 0
                                                            ? 'VENCE HOJE'
                                                            : student.daysUntilDue === 1
                                                                ? 'VENCE EM 2 DIAS'
                                                                : 'VENCE EM 3 DIAS'}
                                                    </span>
                                                    {premiumWhatsAppEnabled && (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleWhatsAppReminder(student); }}
                                                            className="mt-2 flex items-center gap-1 text-[9px] font-black text-emerald-400 hover:text-emerald-300 transition-colors uppercase bg-emerald-500/10 px-2 py-1 rounded-md border border-emerald-500/20"
                                                        >
                                                            <Rocket className="w-3 h-3" /> Lembrar via Whats
                                                        </button>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-start bg-emerald-400/5 p-2 rounded-xl border border-emerald-500/20">
                                                    <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold bg-emerald-600 text-white border border-emerald-400 mb-1 uppercase">
                                                        <CheckCircle className="w-3 h-3 mr-1" /> Em Dia
                                                    </span>
                                                    <span className="text-sm font-black text-emerald-500">
                                                        REGULAR
                                                    </span>
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end items-center gap-2">
                                                {student.actionPayment && onTogglePayment && (
                                                    <div className="relative">
                                                        {launchingId === student.actionPayment.id && (
                                                            <motion.div
                                                                initial={{ y: 0, opacity: 1 }}
                                                                animate={{ y: -50, opacity: 0 }}
                                                                transition={{ duration: 0.8 }}
                                                                className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1 pointer-events-none z-20"
                                                            >
                                                                <Rocket className="w-5 h-5 text-orange-500 fill-orange-500" />
                                                            </motion.div>
                                                        )}

                                                        {student.actionPayment.status === 'paid' ? (
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handlePaymentClick(student.actionPayment!.id, true); }}
                                                                className="px-4 py-2 text-xs font-bold text-emerald-300 bg-emerald-900/20 hover:bg-red-900/30 hover:text-red-300 rounded-xl border border-emerald-900/50 hover:border-red-900/50 transition-colors flex items-center gap-1"
                                                            >
                                                                <RotateCcw className="w-3 h-3" /> Desfazer
                                                            </button>
                                                        ) : (
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handlePaymentClick(student.actionPayment!.id, false); }}
                                                                className={`px-4 py-2 text-xs font-bold text-white rounded-xl shadow-lg flex items-center gap-2 transition-all group-hover:scale-105 ${student.hasOverdue
                                                                    ? 'bg-gradient-to-r from-red-600 to-orange-600 shadow-red-900/40'
                                                                    : student.isDueToday
                                                                        ? 'bg-gradient-to-r from-amber-600 to-orange-600 shadow-amber-900/40 animate-pulse'
                                                                        : student.isUpcoming
                                                                            ? 'bg-gradient-to-r from-yellow-600 to-amber-600 shadow-yellow-900/40'
                                                                            : student.isOnTime
                                                                                ? 'bg-gradient-to-r from-emerald-600 to-teal-700 shadow-emerald-900/40 animate-[pulse_2s_infinite]'
                                                                                : 'bg-gradient-to-r from-emerald-600 to-teal-600 shadow-emerald-900/40'
                                                                    }`}
                                                            >
                                                                <Rocket className="w-4 h-4" />
                                                                <div className="flex flex-col items-start leading-none">
                                                                    <span>Pagar</span>
                                                                    <span className="text-[10px] opacity-80">{formatCurrency(student.actionPayment.calculatedAmount || student.actionPayment.amount)}</span>
                                                                </div>
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                                <div className="w-px h-6 bg-slate-700 mx-1"></div>
                                                <button onClick={(e) => { e.stopPropagation(); handleOpenView(student); }} className="p-2 text-slate-400 hover:text-blue-400 hover:bg-slate-800 rounded-lg transition-colors"><Eye className="w-4 h-4" /></button>
                                                <button onClick={(e) => { e.stopPropagation(); handleOpenEdit(student); }} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"><Edit2 className="w-4 h-4" /></button>
                                                <button onClick={(e) => { e.stopPropagation(); onDeleteStudent(student.id); }} className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* MOBILE CARD VIEW */}
                    <div className="md:hidden space-y-4">
                        {filteredStudents.map((student) => (
                            <div key={student.id} className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-5 backdrop-blur-sm relative overflow-hidden" onClick={() => handleOpenView(student)}>
                                {student.hasOverdue && <div className="absolute top-0 right-0 w-16 h-16 bg-red-500/10 rounded-bl-full blur-xl animate-pulse"></div>}
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="relative">
                                        {student.photo_url ? (
                                            <img src={student.photo_url} alt={student.name} className="h-14 w-14 rounded-full object-cover border-2 border-slate-600" />
                                        ) : (
                                            <div className="h-14 w-14 rounded-full bg-slate-700 flex items-center justify-center text-slate-400 font-bold border-2 border-slate-600">
                                                {student.name.substring(0, 2).toUpperCase()}
                                            </div>
                                        )}
                                        <div className={`absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-[#0b1120] ${student.status === 'active' ? 'bg-emerald-500' : 'bg-slate-500'}`}></div>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-base font-bold text-white break-words">{student.name}</h3>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className="text-[10px] text-blue-300 font-bold bg-blue-900/30 px-2 py-0.5 rounded border border-blue-800/50 uppercase tracking-tighter">{student.className}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className={`bg-slate-900/50 rounded-xl p-4 border flex justify-between items-center mb-4 transition-all ${student.hasOverdue ? 'border-red-500/30' :
                                    student.isDueToday ? 'border-amber-500/50 bg-amber-500/5 shadow-[0_0_15px_rgba(245,158,11,0.1)]' :
                                        student.isUpcoming ? 'border-yellow-500/50 bg-yellow-500/5 shadow-[0_0_15px_rgba(234,179,8,0.1)]' :
                                            'border-slate-700/30'
                                    }`}>
                                    {student.hasOverdue ? (
                                        <div>
                                            <p className="text-[10px] text-red-500 font-bold uppercase tracking-widest flex items-center gap-1 mb-1">
                                                <AlertTriangle className="w-3 h-3" /> Atrasado há {student.daysOverdue} {student.daysOverdue === 1 ? 'dia' : 'dias'}
                                            </p>
                                            <p className="text-lg font-black text-red-500 uppercase">
                                                DÉBITO EM ABERTO
                                            </p>
                                            {premiumWhatsAppOverdueEnabled && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleWhatsAppOverdueReminder(student); }}
                                                    className="mt-2 flex items-center gap-1 text-[10px] font-black text-emerald-400 hover:text-emerald-300 transition-colors uppercase py-2 px-3 bg-emerald-900/10 rounded-xl border border-emerald-500/20 w-fit"
                                                >
                                                    <Rocket className="w-4 h-4" /> Cobrar via Whats
                                                </button>
                                            )}
                                        </div>
                                    ) : student.isDueToday ? (
                                        <motion.div
                                            animate={{ opacity: [1, 0.5, 1] }}
                                            transition={{ duration: 1.5, repeat: Infinity }}
                                            className="flex flex-col items-start"
                                        >
                                            <p className="text-[10px] text-amber-500 font-bold uppercase tracking-widest flex items-center gap-1 mb-1">
                                                <Clock className="w-3 h-3" /> Vence Hoje
                                            </p>
                                            <p className="text-lg font-black text-amber-500 uppercase">PAGAR HOJE!</p>
                                            {premiumWhatsAppEnabled && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleWhatsAppReminder(student); }}
                                                    className="mt-1 flex items-center gap-1 text-[9px] font-black text-emerald-400 hover:text-emerald-300 transition-colors uppercase py-1"
                                                >
                                                    <Rocket className="w-3 h-3" /> Cobrança 1-Clique
                                                </button>
                                            )}
                                        </motion.div>
                                    ) : student.isUpcoming ? (
                                        <motion.div
                                            animate={{ opacity: [1, 0.8, 1] }}
                                            transition={{ duration: 2, repeat: Infinity }}
                                            className="flex flex-col items-start"
                                        >
                                            <p className="text-[10px] text-amber-500 font-bold uppercase tracking-widest flex items-center gap-1 mb-1">
                                                <Clock className="w-3 h-3" /> Atenção
                                            </p>
                                            <p className="text-lg font-black text-amber-500 uppercase">
                                                {student.daysUntilDue === 0 ? 'VENCE HOJE' : student.daysUntilDue === 1 ? 'VENCE EM 2 DIAS' : 'VENCE EM 3 DIAS'}
                                            </p>
                                            {premiumWhatsAppEnabled && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleWhatsAppReminder(student); }}
                                                    className="mt-1 flex items-center gap-1 text-[9px] font-black text-emerald-400 hover:text-emerald-300 transition-colors uppercase py-1"
                                                >
                                                    <Rocket className="w-3 h-3" /> Cobrança 1-Clique
                                                </button>
                                            )}
                                        </motion.div>
                                    ) : (
                                        <motion.div
                                            animate={{ opacity: [1, 0.6, 1], scale: [1, 1.02, 1] }}
                                            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                                            className="flex flex-col items-start"
                                        >
                                            <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest flex items-center gap-1 mb-1">
                                                <CheckCircle className="w-3 h-3" /> Em Dia
                                            </p>
                                            <p className="text-lg font-black text-emerald-500">REGULAR</p>
                                        </motion.div>
                                    )}

                                    {student.actionPayment && onTogglePayment && (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handlePaymentClick(student.actionPayment!.id, student.actionPayment!.status === 'paid'); }}
                                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-lg ${student.actionPayment.status === 'paid'
                                                ? 'bg-slate-700 text-emerald-400'
                                                : student.hasOverdue ? 'bg-gradient-to-r from-red-600 to-orange-600 text-white'
                                                    : student.isUpcoming ? 'bg-gradient-to-r from-yellow-600 to-amber-600 text-white animate-pulse'
                                                        : 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white'
                                                }`}
                                        >
                                            {student.actionPayment.status === 'paid' ? 'Estornar' : 'Pagar Agora'}
                                        </button>
                                    )}
                                </div>

                                <div className="flex justify-between items-center pt-2">
                                    <p className="text-[10px] text-slate-500 font-medium">Entrada: {formatDate(student.enrollment_date || '')}</p>
                                    <div className="flex gap-1">
                                        <button onClick={(e) => { e.stopPropagation(); handleOpenView(student); }} className="p-2.5 bg-slate-800/80 rounded-lg text-slate-400"><Eye className="w-4 h-4" /></button>
                                        <button onClick={(e) => { e.stopPropagation(); handleOpenEdit(student); }} className="p-2.5 bg-slate-800/80 rounded-lg text-slate-400"><Edit2 className="w-4 h-4" /></button>
                                        <button onClick={(e) => { e.stopPropagation(); onDeleteStudent(student.id); }} className="p-2.5 bg-red-900/20 rounded-lg text-red-400"><Trash2 className="w-4 h-4" /></button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {filteredStudents.length === 0 && (
                        <div className="py-20 text-center text-slate-500 bg-slate-800/20 rounded-3xl border-2 border-dashed border-slate-700/50">
                            <Users className="w-12 h-12 mx-auto mb-4 opacity-20" />
                            <p className="font-medium">Nenhum aluno encontrado para sua busca.</p>
                        </div>
                    )}
                </div>
            </div >

            {/* --- MODAL COM ANIMAÇÃO ESPACIAL --- */}
            <AnimatePresence>
                {
                    isModalOpen && (
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/80 backdrop-blur-md px-0 md:px-4"
                            onClick={handleCloseModal}
                        >
                            <motion.div
                                initial={{ scale: 0.9, opacity: 0, y: "100%" }}
                                animate={{ scale: 1, opacity: 1, y: 0 }}
                                exit={{ scale: 0.9, opacity: 0, y: "100%" }}
                                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                                className="bg-[#1e293b]/90 border border-slate-600/50 rounded-t-3xl md:rounded-3xl shadow-2xl w-full max-w-3xl max-h-[95vh] md:max-h-[90vh] overflow-y-auto relative overflow-hidden backdrop-blur-xl"
                                onClick={e => e.stopPropagation()}
                            >
                                {/* Drawer Handle (Mobile Only) */}
                                <div className="md:hidden w-12 h-1.5 bg-slate-600/50 rounded-full mx-auto my-3 flex-shrink-0"></div>
                                {/* --- FUNDO ESPACIAL INTERNO DO MODAL --- */}
                                <div className="absolute inset-0 z-0 pointer-events-none">
                                    <motion.div
                                        animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.2, 0.1] }}
                                        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
                                        className="absolute top-[-50%] left-[-20%] w-[600px] h-[600px] bg-purple-600/30 rounded-full blur-[100px]"
                                    />
                                    <motion.div
                                        animate={{ scale: [1, 1.3, 1], opacity: [0.1, 0.2, 0.1] }}
                                        transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
                                        className="absolute bottom-[-50%] right-[-20%] w-[500px] h-[500px] bg-blue-600/30 rounded-full blur-[100px]"
                                    />
                                    {/* Estrelas no Modal */}
                                    {[...Array(15)].map((_, i) => (
                                        <motion.div
                                            key={i}
                                            className="absolute bg-white rounded-full opacity-20"
                                            initial={{ x: Math.random() * 800, y: Math.random() * 600 }}
                                            animate={{ y: [null, Math.random() * -30], opacity: [0.1, 0.5, 0.1] }}
                                            transition={{ duration: Math.random() * 5 + 5, repeat: Infinity, ease: "linear" }}
                                            style={{ width: Math.random() * 2, height: Math.random() * 2 }}
                                        />
                                    ))}
                                </div>

                                {/* Conteúdo do Modal (z-10 para ficar acima do fundo) */}
                                <div className="relative z-10">
                                    {/* Header do Modal */}
                                    <div className="sticky top-0 bg-[#1e293b]/80 backdrop-blur-md z-20 px-8 py-6 border-b border-slate-700/50 flex justify-between items-center">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <Sparkles className="w-4 h-4 text-purple-400 animate-pulse" />
                                                <span className="text-xs font-bold tracking-widest text-slate-400 uppercase">Sistema Acadêmico</span>
                                            </div>
                                            <h3 className="text-2xl font-bold text-white">
                                                {modalMode === 'add' && 'Nova Matrícula'}
                                                {modalMode === 'edit' && 'Editar Dados do Aluno'}
                                                {modalMode === 'view' && 'Dossiê do Aluno'}
                                            </h3>
                                        </div>
                                        <button onClick={handleCloseModal} className="text-slate-400 hover:text-white p-2 rounded-full hover:bg-slate-700 transition-colors">
                                            <X className="w-6 h-6" />
                                        </button>
                                    </div>

                                    <div className="p-8">
                                        {modalMode === 'view' ? (
                                            <motion.div
                                                initial={{ opacity: 0, y: 20 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                className="space-y-8"
                                            >
                                                {/* Header do Aluno com Glassmorphism e Animação */}
                                                <div className="relative overflow-hidden flex flex-col md:flex-row gap-8 items-center md:items-start bg-slate-800/40 p-6 rounded-2xl border border-slate-700/50 backdrop-blur-xl shadow-2xl">
                                                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-purple-500/10 opacity-50 pointer-events-none" />

                                                    <motion.div
                                                        initial={{ scale: 0.9, opacity: 0 }}
                                                        animate={{ scale: 1, opacity: 1 }}
                                                        transition={{ delay: 0.2 }}
                                                        className="w-32 h-32 flex-shrink-0 relative group z-10"
                                                    >
                                                        <div className="absolute -inset-1 bg-gradient-to-tr from-blue-500 to-purple-500 rounded-full blur opacity-40 group-hover:opacity-75 transition duration-500 animate-pulse"></div>
                                                        {formData.photo_url ? (
                                                            <img src={formData.photo_url} className="relative w-full h-full rounded-full object-cover border-4 border-slate-800 shadow-2xl transition-transform duration-500 group-hover:scale-105" />
                                                        ) : (
                                                            <div className="relative w-full h-full rounded-full bg-slate-800 flex items-center justify-center text-slate-500 border-4 border-slate-700 shadow-inner">
                                                                <Camera className="w-12 h-12 opacity-50" />
                                                            </div>
                                                        )}
                                                    </motion.div>

                                                    <div className="flex-1 w-full text-center md:text-left z-10 min-w-0">
                                                        <div className="flex flex-col md:flex-row justify-between items-center md:items-start mb-6 gap-4">
                                                            <div className="w-full min-w-0 flex-1">
                                                                <h2 className="text-2xl md:text-4xl font-black text-white tracking-tight mb-2 drop-shadow-md break-words whitespace-normal leading-tight">
                                                                    {formData.name}
                                                                </h2>
                                                                <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                                                                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 font-bold text-[10px] uppercase tracking-wider">
                                                                        <div className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse"></div>
                                                                        {classes.find(c => c.id === formData.class_id)?.name}
                                                                    </div>
                                                                    {formData.status === 'active' ? (
                                                                        <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full text-[10px] font-bold uppercase tracking-wider">Aluno Ativo</span>
                                                                    ) : (
                                                                        <span className="px-3 py-1 bg-slate-700 text-slate-400 border border-slate-600 rounded-full text-[10px] font-bold uppercase tracking-wider">Inativo</span>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            {/* --- DEBT HIGHLIGHT --- */}
                                                            {(() => {
                                                                const unpaid = studentPayments.filter(p => p.status !== 'paid');
                                                                // Use hasOverdue flag (strict logic)
                                                                const debt = unpaid.filter(p => p.hasOverdue).reduce((acc, curr) => acc + curr.totalDebt, 0);

                                                                if (debt > 0) return (
                                                                    <motion.div
                                                                        animate={{ scale: [1, 1.05, 1] }}
                                                                        transition={{ duration: 1, repeat: Infinity }}
                                                                        className="flex-shrink-0 bg-red-600 border border-red-400 p-4 rounded-2xl text-center min-w-[140px] shadow-[0_0_30px_rgba(220,38,38,0.4)]"
                                                                    >
                                                                        <p className="text-[10px] text-red-100 font-bold uppercase mb-1">Em Atraso</p>
                                                                        <p className="text-2xl font-black text-white">{formatCurrency(debt)}</p>
                                                                    </motion.div>
                                                                );

                                                                const next = [...unpaid].sort((a, b) => a.due_date.localeCompare(b.due_date))[0];
                                                                if (next) {
                                                                    // Use strict flags directly from the payment object
                                                                    if (next.isDueToday) return (
                                                                        <motion.div
                                                                            animate={{ scale: [1, 1.05, 1], backgroundColor: ['#d97706', '#f59e0b', '#d97706'] }}
                                                                            transition={{ duration: 1.5, repeat: Infinity }}
                                                                            className="flex-shrink-0 border p-4 rounded-2xl text-center min-w-[140px] shadow-lg bg-amber-600 border-amber-400"
                                                                        >
                                                                            <p className="text-[10px] text-white font-bold uppercase mb-1">Vence Hoje</p>
                                                                            <p className="text-xl font-black text-white flex items-center justify-center gap-1"><Clock className="w-4 h-4" /> HOJE</p>
                                                                        </motion.div>
                                                                    );

                                                                    if (next.isUpcoming) return (
                                                                        <div className="flex flex-col items-center gap-2">
                                                                            <motion.div
                                                                                animate={{ scale: [1, 1.05, 1], backgroundColor: ['#d97706', '#f59e0b', '#d97706'] }}
                                                                                transition={{ duration: 1.5, repeat: Infinity }}
                                                                                className="flex-shrink-0 border p-4 rounded-2xl text-center min-w-[140px] shadow-lg bg-amber-600 border-amber-400"
                                                                            >
                                                                                <p className="text-[10px] text-white font-bold uppercase mb-1">{next.daysUntilDue === 0 ? 'VENCE HOJE' : next.daysUntilDue === 1 ? 'Vence em 2 dias' : 'Vence em 3 dias'}</p>
                                                                                <p className="text-xl font-black text-white flex items-center justify-center gap-1"><Clock className="w-4 h-4" /> ATENÇÃO</p>
                                                                            </motion.div>
                                                                            {premiumWhatsAppEnabled && (
                                                                                <button
                                                                                    onClick={() => handleWhatsAppReminder({ ...formData, daysUntilDue: next.daysUntilDue, relevantDate: next.due_date })}
                                                                                    className="flex items-center gap-1 text-[9px] font-black text-emerald-400 uppercase bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20 hover:bg-emerald-500/20 transition-all"
                                                                                >
                                                                                    <Rocket className="w-3 h-3" /> Cobrar via WhatsApp
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                    );
                                                                }

                                                                return (
                                                                    <div className="flex-shrink-0 bg-emerald-500/10 border border-emerald-500/30 p-4 rounded-2xl text-center min-w-[140px]">
                                                                        <p className="text-[10px] text-emerald-400 font-bold uppercase mb-1">Situação</p>
                                                                        <p className="text-xl font-black text-emerald-500">EM DIA</p>
                                                                    </div>
                                                                );
                                                            })()}

                                                            <button
                                                                onClick={() => setModalMode('edit')}
                                                                className="hidden md:flex p-3 bg-slate-800/80 hover:bg-purple-600 rounded-xl text-slate-300 hover:text-white transition-all transform hover:scale-110 shadow-lg border border-slate-700 hover:border-purple-500"
                                                                title="Editar Aluno"
                                                            >
                                                                <Edit2 className="w-5 h-5" />
                                                            </button>
                                                        </div>

                                                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                                                            <motion.div
                                                                whileHover={{ scale: 1.02 }}
                                                                className="p-4 bg-gradient-to-br from-slate-900/60 to-slate-800/60 rounded-xl border border-slate-700/50 flex flex-col justify-center min-h-[80px] shadow-lg"
                                                            >
                                                                <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-1 font-bold">Mensalidade Base</p>
                                                                <p className="text-base lg:text-lg font-black text-white">
                                                                    {(() => {
                                                                        const policy = STUDENT_POLICIES[formData.name || ''];
                                                                        if (policy?.isScholarship) return 'ISENTO (Bolsista)';
                                                                        if (policy && policy.monthlyFeeLate > policy.monthlyFeeOnTime) {
                                                                            return (
                                                                                <span className="flex flex-col leading-tight">
                                                                                    <span className="text-emerald-400">{formatCurrency(policy.monthlyFeeOnTime)} (Pontual)</span>
                                                                                    <span className="text-red-400 text-xs">{formatCurrency(policy.monthlyFeeLate)} (Atraso)</span>
                                                                                </span>
                                                                            );
                                                                        }
                                                                        return formatCurrency(Number(formData.monthly_fee));
                                                                    })()}
                                                                </p>
                                                            </motion.div>

                                                            <motion.div
                                                                whileHover={{ scale: 1.02 }}
                                                                className="p-4 bg-gradient-to-br from-slate-900/60 to-slate-800/60 rounded-xl border border-slate-700/50 flex flex-col justify-center min-h-[90px] shadow-lg group hover:border-blue-500/30 transition-colors"
                                                            >
                                                                <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-1 font-bold group-hover:text-blue-400 transition-colors">Próximo Vencimento</p>
                                                                <p className="text-sm lg:text-base font-semibold text-white">
                                                                    {(() => {
                                                                        if (STUDENT_POLICIES[formData.name || '']?.isScholarship) {
                                                                            return 'N/A (Bolsista)';
                                                                        }
                                                                        // Filter all unpaid payments for this student
                                                                        const unpaid = studentPayments.filter(p => p.status !== 'paid');

                                                                        if (unpaid.length > 0) {
                                                                            // Get the oldest one (the truly "next" one)
                                                                            const next = [...unpaid].sort((a, b) => a.due_date.localeCompare(b.due_date))[0];
                                                                            const [y, m, d] = next.due_date.split('-');
                                                                            return `${d}/${m}/${y}`;
                                                                        }

                                                                        // Fallback: Theoretical next month
                                                                        const today = new Date();
                                                                        const dueDay = formData.payment_due_day || 10;
                                                                        let targetMonth = today.getMonth();
                                                                        let targetYear = today.getFullYear();

                                                                        // If today is past the due day, the next is next month
                                                                        if (today.getDate() > dueDay) {
                                                                            targetMonth++;
                                                                            if (targetMonth > 11) { targetMonth = 0; targetYear++; }
                                                                        }

                                                                        const dayStr = String(dueDay).padStart(2, '0');
                                                                        const monthStr = String(targetMonth + 1).padStart(2, '0');
                                                                        return `${dayStr}/${monthStr}/${targetYear}`;
                                                                    })()}
                                                                </p>
                                                            </motion.div>

                                                            <motion.div
                                                                whileHover={{ scale: 1.02 }}
                                                                className="p-4 bg-gradient-to-br from-slate-900/60 to-slate-800/60 rounded-xl border border-slate-700/50 flex flex-col justify-center min-h-[80px] shadow-lg"
                                                            >
                                                                <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-1 font-bold">Matrícula</p>
                                                                <p className="text-sm lg:text-base font-semibold text-white">
                                                                    {formatDate(formData.enrollment_date || '')}
                                                                </p>
                                                            </motion.div>
                                                        </div>

                                                        {/* --- DADOS PESSOAIS E CONTATO --- */}
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 mt-6">
                                                            <motion.div
                                                                whileHover={{ scale: 1.02 }}
                                                                className="p-4 bg-slate-900/40 rounded-xl border border-slate-700/30 flex items-start gap-4 shadow-md group hover:border-purple-500/30 transition-all"
                                                            >
                                                                <div className="p-3 bg-purple-500/10 rounded-lg group-hover:scale-110 transition-transform flex-shrink-0 mt-1">
                                                                    <Users className="w-5 h-5 text-purple-400" />
                                                                </div>
                                                                <div className="flex flex-col min-w-0 break-words w-full">
                                                                    <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-1">Responsável</p>
                                                                    <p className="text-sm font-bold text-slate-200 leading-relaxed">
                                                                        {formData.guardian_name || 'Não informado'}
                                                                    </p>
                                                                </div>
                                                            </motion.div>

                                                            <motion.div
                                                                whileHover={{ scale: 1.02 }}
                                                                className="p-4 bg-slate-900/40 rounded-xl border border-slate-700/30 flex items-start gap-4 shadow-md group hover:border-emerald-500/30 transition-all"
                                                            >
                                                                <div className="p-3 bg-emerald-500/10 rounded-lg group-hover:scale-110 transition-transform flex-shrink-0 mt-1">
                                                                    <Phone className="w-5 h-5 text-emerald-400" />
                                                                </div>
                                                                <div className="flex flex-col min-w-0 break-words w-full">
                                                                    <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-1">WhatsApp</p>
                                                                    <p className="text-sm font-bold text-slate-200 font-mono leading-relaxed">
                                                                        {formData.phone || 'Não informado'}
                                                                    </p>
                                                                </div>
                                                            </motion.div>

                                                            <motion.div
                                                                whileHover={{ scale: 1.02 }}
                                                                className="p-4 bg-slate-900/40 rounded-xl border border-slate-700/30 flex items-start gap-4 shadow-md group hover:border-blue-500/30 transition-all"
                                                            >
                                                                <div className="p-3 bg-blue-500/10 rounded-lg group-hover:scale-110 transition-transform flex-shrink-0 mt-1">
                                                                    <CalendarDays className="w-5 h-5 text-blue-400" />
                                                                </div>
                                                                <div className="flex flex-col min-w-0 break-words w-full">
                                                                    <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-1">Nascimento</p>
                                                                    <p className="text-sm font-bold text-slate-200 leading-relaxed">
                                                                        {formData.birth_date ? formatDate(formData.birth_date) : 'Não informado'}
                                                                    </p>
                                                                </div>
                                                            </motion.div>
                                                        </div>
                                                    </div>
                                                </div>

                                                <motion.div
                                                    initial={{ opacity: 0, y: 20 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    transition={{ delay: 0.3 }}
                                                >
                                                    <h4 className="text-lg font-bold text-white mb-6 border-b border-slate-700/50 pb-3 flex items-center gap-3">
                                                        <div className="p-2 bg-blue-500/10 rounded-lg">
                                                            <Calendar className="w-5 h-5 text-blue-400" />
                                                        </div>
                                                        Histórico Financeiro
                                                    </h4>

                                                    <div className="space-y-3 max-h-[320px] overflow-y-auto pr-2 custom-scrollbar">
                                                        {studentPayments.map((payment, idx) => (
                                                            <motion.div
                                                                key={payment.id}
                                                                initial={{ opacity: 0, x: -20 }}
                                                                animate={{ opacity: 1, x: 0 }}
                                                                transition={{ delay: 0.1 * idx }}
                                                                className={`group flex flex-col md:flex-row md:items-center justify-between p-5 rounded-2xl border backdrop-blur-sm transition-all duration-300 hover:translate-x-1 ${payment.hasOverdue && payment.status !== 'paid'
                                                                    ? 'bg-gradient-to-r from-red-900/10 to-red-900/5 border-red-500/30 hover:border-red-500/50 hover:shadow-[0_0_20px_rgba(239,68,68,0.1)]'
                                                                    : payment.isDueToday && payment.status === 'pending'
                                                                        ? 'bg-gradient-to-r from-amber-600/20 to-amber-600/10 border-amber-500/50 hover:border-amber-400 shadow-[0_0_20px_rgba(217,119,6,0.1)]'
                                                                        : payment.isUpcoming && payment.status === 'pending'
                                                                            ? 'bg-gradient-to-r from-amber-900/10 to-amber-900/5 border-amber-500/30 hover:border-amber-500/50 hover:shadow-[0_0_20px_rgba(245,158,11,0.1)]'
                                                                            : payment.isOnTime && payment.status === 'pending'
                                                                                ? 'bg-gradient-to-r from-emerald-900/10 to-emerald-900/5 border-emerald-500/30 hover:border-emerald-500/50 hover:shadow-[0_0_20px_rgba(16,185,129,0.1)]'
                                                                                : 'bg-gradient-to-r from-slate-800/40 to-slate-800/20 border-slate-700/50 hover:border-slate-600 hover:bg-slate-800/60'
                                                                    }`}
                                                            >
                                                                <div className="flex flex-col gap-1 mb-3 md:mb-0">
                                                                    <div className="text-slate-400 text-xs uppercase font-bold tracking-wider flex items-center gap-2">
                                                                        {payment.status === 'paid' ? (
                                                                            <>
                                                                                <span className="flex items-center gap-1.5 text-emerald-400"><CheckCircle className="w-3.5 h-3.5" /> PAGO</span>
                                                                                <span className="text-slate-600">•</span>
                                                                                <span>{payment.paid_at ? formatDate(payment.paid_at.split('T')[0]) : '-'}</span>
                                                                            </>
                                                                        ) : (
                                                                            <div className="flex items-center gap-2">
                                                                                {(() => {
                                                                                    const alert = getUPComingAlert(payment.due_date, getLocalDateString());
                                                                                    if (alert) return (
                                                                                        <span className={`flex items-center gap-1.5 ${alert.color.split(' ')[0]} font-black`}><Clock className="w-3.5 h-3.5" /> {alert.label.split(' (')[0].toUpperCase()}</span>
                                                                                    );
                                                                                    if (payment.hasOverdue) return (
                                                                                        <span className="flex items-center gap-1.5 text-red-500 font-black"><AlertTriangle className="w-3.5 h-3.5" /> ATRASADO HÁ {payment.daysOverdue} {payment.daysOverdue === 1 ? 'DIA' : 'DIAS'}</span>
                                                                                    );
                                                                                    return <span className="flex items-center gap-1.5 text-blue-400"><Calendar className="w-3.5 h-3.5" /> VENCIMENTO</span>;
                                                                                })()}
                                                                                <span className="text-slate-600">•</span>
                                                                                <input
                                                                                    type="date"
                                                                                    min={getLocalDateString()}
                                                                                    className="bg-transparent border-none text-white font-bold text-sm focus:ring-0 cursor-pointer hover:text-blue-400 transition-colors"
                                                                                    value={payment.due_date}
                                                                                    onChange={(e) => onUpdatePaymentDate && onUpdatePaymentDate(payment.id, e.target.value)}
                                                                                />
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                    <div className="flex items-center gap-3 mt-1">
                                                                        <span className={`text-2xl font-black tracking-tight ${payment.status !== 'paid' ? (payment.hasOverdue ? 'text-red-400' : payment.isUpcoming || payment.isDueToday ? 'text-amber-400' : 'text-emerald-400') : 'text-white'}`}>
                                                                            {formatCurrency(payment.totalDebt)}
                                                                        </span>
                                                                        {(payment.totalInterest || 0) > 0 && payment.status !== 'paid' && (
                                                                            <span className="flex items-center text-[10px] font-black text-red-200 bg-red-600/20 px-2 py-0.5 rounded uppercase tracking-wider border border-red-500/20">
                                                                                +{formatCurrency(payment.totalInterest)} Juros
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </div>

                                                                <div className="flex items-center gap-3">
                                                                    {payment.hasOverdue && payment.status !== 'paid' && onForgiveDebt && (
                                                                        <button
                                                                            onClick={() => onForgiveDebt(payment.id)}
                                                                            className={`px-3 py-2 text-xs font-bold rounded-xl border transition-all flex items-center gap-2 hover:scale-105 ${payment.interest_waived
                                                                                ? 'text-slate-400 bg-slate-700/50 hover:bg-slate-700 hover:text-white border-slate-600'
                                                                                : 'text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 border-blue-500/20'
                                                                                }`}
                                                                            title={payment.interest_waived ? "Restaurar cobrança de juros" : "Perdoar juros deste pagamento"}
                                                                        >
                                                                            <ShieldCheck className="w-4 h-4" />
                                                                            {payment.interest_waived ? 'RESTAURAR' : 'PERDOAR'}
                                                                        </button>
                                                                    )}
                                                                    {onTogglePayment && (
                                                                        <button
                                                                            onClick={() => handlePaymentClick(payment.id, payment.status === 'paid')}
                                                                            className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 ${payment.status === 'paid'
                                                                                ? 'bg-slate-800 text-emerald-400 border border-emerald-500/30 hover:border-red-500/50 hover:text-red-400 hover:bg-red-500/10'
                                                                                : 'bg-gradient-to-r from-emerald-600 to-emerald-500 text-white shadow-emerald-900/20 hover:from-emerald-500 hover:to-emerald-400'
                                                                                }`}
                                                                        >
                                                                            {payment.status === 'paid' ? <><RotateCcw className="w-4 h-4" /> Desfazer</> : <><Rocket className="w-4 h-4" /> PAGAR AGORA</>}
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </motion.div>
                                                        ))}
                                                        {studentPayments.length === 0 && (
                                                            <div className="text-center py-12 bg-slate-800/20 rounded-2xl border border-slate-800/50 border-dashed">
                                                                <div className="inline-flex p-4 rounded-full bg-slate-800/50 mb-3">
                                                                    <FileText className="w-6 h-6 text-slate-500" />
                                                                </div>
                                                                <p className="text-slate-500 font-medium">Nenhum registro financeiro encontrado.</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </motion.div>

                                                <div className="flex justify-between items-center pt-6 border-t border-slate-700/50">
                                                    <button onClick={() => { onDeleteStudent(formData.id!); handleCloseModal(); }} className="group flex items-center gap-2 px-4 py-2 text-red-400/70 hover:text-red-400 hover:bg-red-900/10 rounded-xl transition-all text-sm font-medium">
                                                        <Trash2 className="w-4 h-4 transition-transform group-hover:scale-110" />
                                                        Excluir Aluno
                                                    </button>
                                                    <button onClick={handleCloseModal} className="px-8 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl transition-all font-bold shadow-lg border border-slate-700 hover:border-slate-600">
                                                        Fechar Visualização
                                                    </button>
                                                </div>
                                            </motion.div>
                                        ) : (
                                            <form onSubmit={handleSubmit} className="space-y-6">
                                                <div className="flex flex-col items-center justify-center p-6 bg-slate-800/30 rounded-2xl border-2 border-dashed border-slate-700 hover:border-purple-500 transition-all cursor-pointer group relative overflow-hidden" onClick={() => fileInputRef.current?.click()}>
                                                    <div className="absolute inset-0 bg-purple-900/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                                    {formData.photo_url ? (
                                                        <img src={formData.photo_url} className="w-32 h-32 rounded-full object-cover border-4 border-slate-600 group-hover:border-purple-500 shadow-xl z-10" />
                                                    ) : (
                                                        <div className="w-32 h-32 rounded-full bg-slate-700/50 flex flex-col items-center justify-center text-slate-400 group-hover:text-purple-400 transition-colors shadow-inner z-10">
                                                            <Upload className="w-8 h-8 mb-2" />
                                                            <span className="text-xs font-bold">Carregar Foto</span>
                                                        </div>
                                                    )}
                                                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handlePhotoUpload} />
                                                </div>

                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                    <div className="col-span-1 md:col-span-2">
                                                        <label className="text-xs font-bold text-slate-400 block mb-2 uppercase tracking-wider ml-1">Nome Completo</label>
                                                        <input required type="text" className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700/80 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all backdrop-blur-sm" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
                                                    </div>
                                                    <div>
                                                        <label className="text-xs font-bold text-slate-400 block mb-2 uppercase tracking-wider ml-1">Turma</label>
                                                        <select className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700/80 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all backdrop-blur-sm" value={formData.class_id} onChange={(e) => setFormData({ ...formData, class_id: e.target.value })}>
                                                            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className="text-xs font-bold text-slate-400 block mb-2 uppercase tracking-wider ml-1">Mensalidade (R$)</label>
                                                        <input type="number" className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700/80 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all backdrop-blur-sm" value={formData.monthly_fee} onChange={(e) => setFormData({ ...formData, monthly_fee: Number(e.target.value) })} />
                                                    </div>

                                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 col-span-1 md:col-span-2">
                                                        <div>
                                                            <label className="text-xs font-bold text-slate-400 block mb-2 uppercase tracking-wider ml-1">Responsável (Opcional)</label>
                                                            <input type="text" placeholder="Ex: Maria Souza" className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700/80 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all backdrop-blur-sm" value={formData.guardian_name || ''} onChange={(e) => setFormData({ ...formData, guardian_name: e.target.value })} />
                                                        </div>
                                                        <div>
                                                            <label className="text-xs font-bold text-slate-400 block mb-2 uppercase tracking-wider ml-1">WhatsApp (DDD + Número)</label>
                                                            <input type="text" placeholder="68999999999" className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700/80 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all backdrop-blur-sm font-mono" value={formData.phone || ''} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
                                                        </div>
                                                        <div>
                                                            <label className="text-xs font-bold text-slate-400 block mb-2 uppercase tracking-wider ml-1">Data de Nascimento</label>
                                                            <input type="date" className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700/80 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all backdrop-blur-sm" value={formData.birth_date || ''} onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })} />
                                                        </div>
                                                    </div>

                                                    {modalMode === 'add' ? (
                                                        <>
                                                            <div className="col-span-1 md:col-span-2 p-5 bg-slate-800/40 rounded-xl border border-slate-700/50 shadow-md">
                                                                <label className="text-sm font-bold text-slate-300 block mb-3 flex items-center gap-2 uppercase tracking-wider">
                                                                    <CalendarDays className="w-4 h-4 text-blue-400" /> Data de Matrícula (Retroativo)
                                                                </label>
                                                                <input type="date" className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-xl text-white focus:ring-2 focus:ring-purple-500 transition-all" value={formData.enrollment_date} onChange={(e) => setFormData({ ...formData, enrollment_date: e.target.value })} />
                                                                <p className="text-xs text-slate-500 mt-2 ml-1">Data oficial de entrada do aluno na escola.</p>
                                                            </div>

                                                            <div className={`col-span-1 md:col-span-2 p-5 rounded-xl transition-all shadow-md ${isRetroactive ? 'bg-red-900/20 border border-red-500/50 shadow-red-900/10' : 'bg-blue-900/20 border border-blue-500/30'}`}>
                                                                <label className={`text-sm font-bold block mb-3 flex items-center uppercase tracking-wider ${isRetroactive ? 'text-red-400' : 'text-blue-300'}`}>
                                                                    <Calendar className="w-4 h-4 mr-2" /> Data do 1º Pagamento
                                                                </label>
                                                                <div className="flex flex-col md:flex-row gap-4 items-center">
                                                                    <input type="date" required min={getLocalDateString()} className={`w-full md:w-auto flex-1 px-4 py-3 bg-slate-900/50 border rounded-xl text-white focus:outline-none focus:ring-2 transition-all ${isRetroactive ? 'border-red-500/50 focus:ring-red-500' : 'border-blue-500/50 focus:ring-blue-500'}`} value={initialPaymentDate} onChange={(e) => setInitialPaymentDate(e.target.value)} />
                                                                    {isRetroactive && (
                                                                        <div className="w-full md:w-auto flex items-center justify-center text-red-400 text-xs font-bold bg-red-900/30 px-4 py-2 rounded-xl border border-red-500/50 animate-pulse shadow-lg">
                                                                            <AlertTriangle className="w-4 h-4 mr-2" /> GERA ATRASO E JUROS
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <p className={`text-xs mt-3 flex items-center ${isRetroactive ? 'text-red-300' : 'text-blue-300/70'}`}>
                                                                    {isRetroactive ? 'Atenção: Data passada. Gera atraso imediato.' : `Calculado: ${initialPaymentDate.split('-')[2]} será o dia de vencimento fixo.`}
                                                                </p>
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <div className="col-span-1 md:col-span-2 p-5 bg-slate-800/40 rounded-xl border border-slate-700/50">
                                                                <label className="text-xs font-bold text-slate-400 block mb-2 uppercase tracking-wider">Data de Matrícula</label>
                                                                <input type="date" className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-xl text-white focus:ring-2 focus:ring-purple-500 transition-all" value={formData.enrollment_date} onChange={(e) => setFormData({ ...formData, enrollment_date: e.target.value })} />
                                                            </div>
                                                            <div className="col-span-1 md:col-span-2 p-5 bg-slate-800/40 rounded-xl border border-slate-700/50">
                                                                <label className="text-xs font-bold text-slate-400 block mb-2 uppercase tracking-wider">Data do Próximo Vencimento</label>
                                                                <div className="flex flex-col gap-2">
                                                                    <input
                                                                        type="date"
                                                                        min={getLocalDateString()}
                                                                        className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-xl text-white focus:ring-2 focus:ring-purple-500 transition-all font-bold"
                                                                        value={initialPaymentDate}
                                                                        onChange={(e) => {
                                                                            const dateVal = e.target.value;
                                                                            setInitialPaymentDate(dateVal);
                                                                            // Also update the recurring day based on this selection for consistency
                                                                            if (dateVal) {
                                                                                const day = parseInt(dateVal.split('-')[2]);
                                                                                setFormData({ ...formData, payment_due_day: day });
                                                                            }
                                                                        }}
                                                                    />
                                                                    <p className="text-xs text-slate-500">
                                                                        Define a data exata do próximo pagamento. O dia <strong>{initialPaymentDate ? initialPaymentDate.split('-')[2] : '--'}</strong> será usado para os meses seguintes.
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        </>
                                                    )}

                                                    <div className="col-span-1 md:col-span-2">
                                                        <label className="text-xs font-bold text-slate-400 block mb-2 uppercase tracking-wider ml-1">Status</label>
                                                        <div className="flex gap-4">
                                                            <label className={`flex items-center gap-3 cursor-pointer px-4 py-4 rounded-xl flex-1 border transition-all ${formData.status === 'active' ? 'bg-emerald-900/20 border-emerald-500/50 shadow-lg shadow-emerald-900/10' : 'bg-slate-800/50 border-slate-700'}`}>
                                                                <input type="radio" name="status" checked={formData.status === 'active'} onChange={() => setFormData({ ...formData, status: 'active' })} className="text-emerald-500 focus:ring-emerald-500 w-5 h-5" />
                                                                <span className={formData.status === 'active' ? 'text-emerald-400 font-bold' : 'text-slate-400'}>Ativo</span>
                                                            </label>
                                                            <label className={`flex items-center gap-3 cursor-pointer px-4 py-4 rounded-xl flex-1 border transition-all ${formData.status === 'inactive' ? 'bg-slate-700/50 border-slate-500' : 'bg-slate-800/50 border-slate-700'}`}>
                                                                <input type="radio" name="status" checked={formData.status === 'inactive'} onChange={() => setFormData({ ...formData, status: 'inactive' })} className="text-slate-400 focus:ring-slate-500 w-5 h-5" />
                                                                <span className="text-slate-300">Inativo</span>
                                                            </label>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex justify-end gap-4 pt-6 border-t border-slate-700/50">
                                                    <button type="button" onClick={handleCloseModal} className="px-6 py-3 bg-slate-800/80 text-slate-300 rounded-xl hover:bg-slate-700 font-bold transition-colors">Cancelar</button>
                                                    <button type="submit" className="px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold rounded-xl hover:from-blue-500 hover:to-purple-500 shadow-lg shadow-purple-900/30 flex items-center transform transition-transform hover:scale-105">
                                                        {modalMode === 'add' ? <><span className="mr-2">Confirmar Matrícula</span> <ArrowRight className="w-5 h-5" /></> : 'Salvar Alterações'}
                                                    </button>
                                                </div>
                                            </form>
                                        )}
                                    </div>
                                </div>
                            </motion.div >
                        </motion.div >
                    )
                }
            </AnimatePresence >
        </div >
    );
};

export default StudentList;