import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X, User, Calendar, MapPin, DollarSign, Plus, Eye, Edit2, Trash2,
    AlertTriangle, CheckCircle, Clock, Search, FileText, ChevronRight,
    TrendingDown, Info, Cake, Baby
} from 'lucide-react';
import { Class, Student, Payment } from '../types';
import {
    formatCurrency, formatDate, getLocalDateString,
    calculatePaymentDetails, getPaymentStatus, getDaysDifference,
    calculateNextMonthSameDay
} from '../utils/finance';

interface ClassDetailModalProps {
    cls: Class;
    students: Student[];
    payments: Payment[];
    interestRate: number;
    isOpen: boolean;
    onClose: () => void;
    onAddStudent: (student: Student, initialPaymentDate: string) => void;
    onEditStudent: (student: Student) => void;
    onDeleteStudent: (id: string) => void;
    onTogglePayment: (id: string) => void;
    initialStudentId?: string;
}

const ClassDetailModal: React.FC<ClassDetailModalProps> = ({
    cls,
    students: allStudents,
    payments: allPayments,
    interestRate,
    isOpen,
    onClose,
    initialStudentId,
    onAddStudent: onAddStudentProp,
    onEditStudent,
    onDeleteStudent,
    onTogglePayment
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
    const [isAddingStudent, setIsAddingStudent] = useState(false);
    const [isEditingStudent, setIsEditingStudent] = useState(false);
    const [editStudentData, setEditStudentData] = useState<Partial<Student>>({});

    // Registration Form State
    const [newStudentData, setNewStudentData] = useState<Partial<Student>>({
        name: '',
        monthly_fee: 150,
        enrollment_date: getLocalDateString(),
        payment_due_day: 10,
        phone: '',
        guardian_name: '',
        birth_date: ''
    });
    const [initialPaymentDate, setInitialPaymentDate] = useState<string>('');

    // Auto-calculate initial payment date when enrollment date changes
    React.useEffect(() => {
        if (isAddingStudent && newStudentData.enrollment_date) {
            const nextDate = calculateNextMonthSameDay(newStudentData.enrollment_date);
            setInitialPaymentDate(nextDate);
            const day = parseInt(nextDate.split('-')[2]);
            setNewStudentData(prev => ({ ...prev, payment_due_day: day }));
        }
    }, [newStudentData.enrollment_date, isAddingStudent]);

    // Focus initial student when modal opens
    React.useEffect(() => {
        if (isOpen && initialStudentId) {
            setSelectedStudentId(initialStudentId);
            setIsAddingStudent(false);
            setIsEditingStudent(false);
        }
    }, [isOpen, initialStudentId]);

    const handleUpdateStudent = (e: React.FormEvent) => {
        e.preventDefault();
        if (!editStudentData.name || !editStudentData.birth_date) {
            alert("Nome e Data de Nascimento são obrigatórios.");
            return;
        }

        onEditStudent(editStudentData as Student);
        setIsEditingStudent(false);
    };

    const handleStartEdit = (student: Student) => {
        setEditStudentData(student);
        setIsEditingStudent(true);
        setIsAddingStudent(false);
    };

    const classStudents = useMemo(() => {
        return allStudents.filter(s => s.class_id === cls.id);
    }, [allStudents, cls.id]);

    const studentsWithStatus = useMemo(() => {
        const todayStr = getLocalDateString();

        return classStudents.map(student => {
            const studentPayments = allPayments
                .filter(p => p.student_id === student.id)
                .map(p => calculatePaymentDetails(p, interestRate, student.name));

            const overdue = studentPayments.filter(p => p.status === 'overdue');
            const dueToday = studentPayments.filter(p => getPaymentStatus(p.due_date, todayStr) === 'due_today' && p.status !== 'paid');
            const comingUp = studentPayments.filter(p => {
                const diff = getDaysDifference(p.due_date, todayStr);
                return diff > 0 && diff <= 3 && p.status !== 'paid';
            });

            let financialStatus: 'overdue' | 'due_today' | 'coming_up' | 'on_time' = 'on_time';
            if (overdue.length > 0) financialStatus = 'overdue';
            else if (dueToday.length > 0) financialStatus = 'due_today';
            else if (comingUp.length > 0) financialStatus = 'coming_up';

            return {
                ...student,
                financialStatus,
                payments: studentPayments.sort((a, b) => b.due_date.localeCompare(a.due_date)),
                totalDebt: overdue.reduce((acc, curr) => acc + (curr.calculatedAmount || 0), 0)
            };
        }).filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [classStudents, allPayments, interestRate, searchTerm]);

    const groups = {
        overdue: studentsWithStatus.filter(s => s.financialStatus === 'overdue'),
        due_today: studentsWithStatus.filter(s => s.financialStatus === 'due_today'),
        coming_up: studentsWithStatus.filter(s => s.financialStatus === 'coming_up'),
        on_time: studentsWithStatus.filter(s => s.financialStatus === 'on_time')
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
                onClick={onClose}
            >
                <motion.div
                    initial={{ scale: 0.9, y: 50, opacity: 0 }}
                    animate={{ scale: 1, y: 0, opacity: 1 }}
                    exit={{ scale: 0.9, y: 50, opacity: 0 }}
                    className="bg-slate-900 w-full max-w-6xl max-h-[90vh] rounded-[2.5rem] border border-slate-700 shadow-2xl relative overflow-hidden flex flex-col"
                    onClick={e => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="p-8 border-b border-slate-800 bg-slate-900/50 flex justify-between items-start shrink-0">
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <div className={`w-3 h-3 rounded-full ${cls.color}`}></div>
                                <span className="text-[10px] font-black uppercase text-slate-500 tracking-[0.3em]">Detalhes da Turma</span>
                            </div>
                            <h2 className="text-3xl font-black text-white tracking-tighter uppercase">{cls.name}</h2>
                            <div className="flex flex-wrap gap-4 mt-4">
                                <div className="flex items-center text-xs text-slate-400">
                                    <User className="w-4 h-4 mr-2 text-indigo-400" />
                                    Prof: <span className="font-bold text-slate-200 ml-1">{cls.teacher}</span>
                                </div>
                                <div className="flex items-center text-xs text-slate-400">
                                    <Calendar className="w-4 h-4 mr-2 text-blue-400" />
                                    Horário: <span className="font-bold text-slate-200 ml-1">{cls.schedule}</span>
                                </div>
                                <div className="flex items-center text-xs text-slate-400">
                                    <MapPin className="w-4 h-4 mr-2 text-emerald-400" />
                                    Sala: <span className="font-bold text-slate-200 ml-1">{cls.room}</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    setSelectedStudentId(null);
                                    setIsAddingStudent(true);
                                    setIsEditingStudent(false);
                                }}
                                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg flex items-center gap-2 transition-all"
                            >
                                <Plus className="w-5 h-5" /> Novo Aluno
                            </button>
                            <button onClick={onClose} className="p-3 bg-slate-800 rounded-2xl text-slate-400 hover:text-white transition-all"><X /></button>
                        </div>
                    </div>

                    <div className="flex-1 flex overflow-hidden">
                        {/* Sidebar List */}
                        <div className="w-1/3 border-r border-slate-800 flex flex-col bg-slate-950/20">
                            <div className="p-6 shrink-0">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                    <input
                                        type="text"
                                        placeholder="Filtrar alunos..."
                                        className="w-full bg-slate-900/50 border border-slate-700/50 p-3 pl-10 rounded-xl text-sm text-white outline-none focus:ring-2 focus:ring-indigo-600"
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto px-6 pb-6 custom-scrollbar space-y-8">
                                {/* Groups */}
                                {[
                                    { id: 'overdue', label: 'Em Atraso', list: groups.overdue, color: 'text-red-400', bg: 'bg-red-500/10' },
                                    { id: 'due_today', label: 'Vence Hoje', list: groups.due_today, color: 'text-orange-400', bg: 'bg-orange-500/10' },
                                    { id: 'coming_up', label: 'Vencendo em Breve', list: groups.coming_up, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
                                    { id: 'on_time', label: 'Em Dia', list: groups.on_time, color: 'text-emerald-400', bg: 'bg-emerald-500/10' }
                                ].map(group => group.list.length > 0 && (
                                    <div key={group.id} className="space-y-3">
                                        <h3 className={`text-[10px] font-black uppercase tracking-widest opacity-60 ${group.color} flex items-center gap-2`}>
                                            <div className={`w-1 h-1 rounded-full ${group.color.replace('text', 'bg')}`}></div>
                                            {group.label} ({group.list.length})
                                        </h3>
                                        <div className="space-y-2">
                                            {group.list.map(student => (
                                                <button
                                                    key={student.id}
                                                    onClick={() => {
                                                        setSelectedStudentId(student.id);
                                                        setIsAddingStudent(false);
                                                        setIsEditingStudent(false);
                                                    }}
                                                    className={`w-full text-left p-4 rounded-2xl border transition-all flex items-center justify-between group ${selectedStudentId === student.id
                                                        ? 'bg-slate-800 border-indigo-500 shadow-xl'
                                                        : 'bg-slate-900/40 border-slate-800 hover:border-slate-700'
                                                        }`}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        {student.photo_url ? (
                                                            <img src={student.photo_url} className="w-8 h-8 rounded-full object-cover" />
                                                        ) : (
                                                            <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-black text-slate-500">{student.name.substring(0, 2).toUpperCase()}</div>
                                                        )}
                                                        <div>
                                                            <p className="text-sm font-bold text-white leading-tight">{student.name}</p>
                                                            {student.financialStatus === 'overdue' && (
                                                                <p className="text-[10px] font-bold text-red-400 mt-1">{formatCurrency(student.totalDebt)} em aberto</p>
                                                            )}
                                                            {student.financialStatus === 'due_today' && (
                                                                <p className="text-[10px] font-bold text-orange-400 mt-1">Vence hoje</p>
                                                            )}
                                                            {student.financialStatus === 'coming_up' && (
                                                                <p className="text-[10px] font-bold text-yellow-400 mt-1">Vence em 3 dias</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <ChevronRight className={`w-4 h-4 transition-transform ${selectedStudentId === student.id ? 'translate-x-1 text-indigo-400' : 'text-slate-600'}`} />
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ))}

                                {studentsWithStatus.length === 0 && (
                                    <div className="py-20 text-center text-slate-600">
                                        <User className="mx-auto w-12 h-12 opacity-10 mb-4" />
                                        <p className="text-xs font-bold uppercase tracking-widest">Nenhum aluno encontrado</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Dossier Area */}
                        <div className="flex-1 bg-slate-900/40 overflow-y-auto custom-scrollbar p-12">
                            <AnimatePresence mode="wait">
                                {isAddingStudent ? (
                                    <motion.div
                                        key="add-student"
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.95 }}
                                        className="max-w-2xl mx-auto"
                                    >
                                        {/* Same form as before for adding */}
                                        <div className="flex items-center gap-4 mb-8">
                                            <div className="p-3 bg-indigo-600/10 rounded-2xl">
                                                <Plus className="w-6 h-6 text-indigo-400" />
                                            </div>
                                            <div>
                                                <h3 className="text-2xl font-black text-white tracking-tighter uppercase">Nova Matrícula</h3>
                                                <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Preencha os dados do novo aluno para a turma {cls.name}</p>
                                            </div>
                                        </div>

                                        <form onSubmit={(e) => {
                                            e.preventDefault();
                                            if (!newStudentData.name || !newStudentData.birth_date) {
                                                alert("Nome e Data de Nascimento são obrigatórios.");
                                                return;
                                            }

                                            const student: Student = {
                                                id: `new-${Date.now()}`,
                                                school_id: cls.school_id,
                                                class_id: cls.id,
                                                name: newStudentData.name!,
                                                monthly_fee: Number(newStudentData.monthly_fee),
                                                enrollment_date: newStudentData.enrollment_date || getLocalDateString(),
                                                payment_due_day: newStudentData.payment_due_day || 10,
                                                status: 'active',
                                                phone: newStudentData.phone,
                                                guardian_name: newStudentData.guardian_name,
                                                birth_date: newStudentData.birth_date!,
                                            };

                                            onAddStudentProp(student, initialPaymentDate);
                                            setIsAddingStudent(false);
                                            setNewStudentData({ name: '', monthly_fee: 150, enrollment_date: getLocalDateString(), payment_due_day: 10, phone: '', guardian_name: '', birth_date: '' });
                                        }} className="space-y-6">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-black uppercase text-slate-500 ml-1">Nome Completo</label>
                                                    <input required className="w-full bg-slate-900 border border-slate-700 p-4 rounded-2xl text-white font-bold outline-none focus:ring-2 focus:ring-indigo-600 transition-all" value={newStudentData.name} onChange={e => setNewStudentData({ ...newStudentData, name: e.target.value })} placeholder="Ex: Islayne Caxias" />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-black uppercase text-slate-500 ml-1">Data de Nascimento</label>
                                                    <input type="date" required className="w-full bg-slate-900 border border-slate-700 p-4 rounded-2xl text-white font-bold outline-none focus:ring-2 focus:ring-indigo-600" value={newStudentData.birth_date} onChange={e => setNewStudentData({ ...newStudentData, birth_date: e.target.value })} />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-black uppercase text-slate-500 ml-1">Telefone (Whats)</label>
                                                    <input className="w-full bg-slate-900 border border-slate-700 p-4 rounded-2xl text-white font-bold outline-none focus:ring-2 focus:ring-indigo-600" value={newStudentData.phone} onChange={e => setNewStudentData({ ...newStudentData, phone: e.target.value })} placeholder="(XX) XXXXX-XXXX" />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-black uppercase text-slate-500 ml-1">Responsável</label>
                                                    <input className="w-full bg-slate-900 border border-slate-700 p-4 rounded-2xl text-white font-bold outline-none focus:ring-2 focus:ring-indigo-600" value={newStudentData.guardian_name} onChange={e => setNewStudentData({ ...newStudentData, guardian_name: e.target.value })} placeholder="Nome do Pai/Mãe" />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-black uppercase text-slate-500 ml-1">Mensalidade (R$)</label>
                                                    <input type="number" required className="w-full bg-slate-900 border border-slate-700 p-4 rounded-2xl text-white font-bold outline-none focus:ring-2 focus:ring-indigo-600" value={newStudentData.monthly_fee} onChange={e => setNewStudentData({ ...newStudentData, monthly_fee: Number(e.target.value) })} />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-black uppercase text-slate-500 ml-1">Data Matrícula</label>
                                                    <input type="date" required className="w-full bg-slate-900 border border-slate-700 p-4 rounded-2xl text-white font-bold outline-none focus:ring-2 focus:ring-indigo-600" value={newStudentData.enrollment_date} onChange={e => setNewStudentData({ ...newStudentData, enrollment_date: e.target.value })} />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-black uppercase text-slate-500 ml-1">Vencimento Inicial</label>
                                                    <input type="date" required className="w-full bg-slate-900 border border-indigo-500/50 p-4 rounded-2xl text-white font-bold outline-none focus:ring-2 focus:ring-indigo-600 bg-indigo-900/20" value={initialPaymentDate} onChange={e => setInitialPaymentDate(e.target.value)} />
                                                </div>
                                            </div>

                                            <div className="flex gap-4 pt-4">
                                                <button type="submit" className="flex-1 py-4 bg-indigo-600 text-white font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-indigo-900/20 hover:bg-indigo-500 transition-all">Concluir Matrícula</button>
                                                <button type="button" onClick={() => setIsAddingStudent(false)} className="px-8 py-4 bg-slate-800 text-slate-400 font-black uppercase tracking-widest rounded-2xl hover:bg-slate-700 transition-all">Cancelar</button>
                                            </div>
                                        </form>
                                    </motion.div>
                                ) : isEditingStudent ? (
                                    <motion.div
                                        key="edit-student"
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.95 }}
                                        className="max-w-2xl mx-auto"
                                    >
                                        <div className="flex items-center gap-4 mb-8">
                                            <div className="p-3 bg-amber-600/10 rounded-2xl">
                                                <Edit2 className="w-6 h-6 text-amber-400" />
                                            </div>
                                            <div>
                                                <h3 className="text-2xl font-black text-white tracking-tighter uppercase">Editar Aluno</h3>
                                                <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Atualize as informações de {editStudentData.name}</p>
                                            </div>
                                        </div>

                                        <form onSubmit={handleUpdateStudent} className="space-y-6">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-black uppercase text-slate-500 ml-1">Nome Completo</label>
                                                    <input required className="w-full bg-slate-900 border border-slate-700 p-4 rounded-2xl text-white font-bold outline-none focus:ring-2 focus:ring-amber-600 transition-all" value={editStudentData.name} onChange={e => setEditStudentData({ ...editStudentData, name: e.target.value })} />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-black uppercase text-slate-500 ml-1">Data de Nascimento</label>
                                                    <input type="date" required className="w-full bg-slate-900 border border-slate-700 p-4 rounded-2xl text-white font-bold outline-none focus:ring-2 focus:ring-amber-600" value={editStudentData.birth_date} onChange={e => setEditStudentData({ ...editStudentData, birth_date: e.target.value })} />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-black uppercase text-slate-500 ml-1">Telefone (Whats)</label>
                                                    <input className="w-full bg-slate-900 border border-slate-700 p-4 rounded-2xl text-white font-bold outline-none focus:ring-2 focus:ring-amber-600" value={editStudentData.phone} onChange={e => setEditStudentData({ ...editStudentData, phone: e.target.value })} placeholder="(XX) XXXXX-XXXX" />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-black uppercase text-slate-500 ml-1">Responsável</label>
                                                    <input className="w-full bg-slate-900 border border-slate-700 p-4 rounded-2xl text-white font-bold outline-none focus:ring-2 focus:ring-amber-600" value={editStudentData.guardian_name} onChange={e => setEditStudentData({ ...editStudentData, guardian_name: e.target.value })} placeholder="Nome do Pai/Mãe" />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-black uppercase text-slate-500 ml-1">Mensalidade (R$)</label>
                                                    <input type="number" required className="w-full bg-slate-900 border border-slate-700 p-4 rounded-2xl text-white font-bold outline-none focus:ring-2 focus:ring-amber-600" value={editStudentData.monthly_fee} onChange={e => setEditStudentData({ ...editStudentData, monthly_fee: Number(e.target.value) })} />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-black uppercase text-slate-500 ml-1">Status Matrícula</label>
                                                    <select className="w-full bg-slate-900 border border-slate-700 p-4 rounded-2xl text-white font-bold outline-none focus:ring-2 focus:ring-amber-600" value={editStudentData.status} onChange={e => setEditStudentData({ ...editStudentData, status: e.target.value as 'active' | 'inactive' })}>
                                                        <option value="active">Ativo</option>
                                                        <option value="inactive">Inativo</option>
                                                    </select>
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-black uppercase text-slate-500 ml-1">Data Matrícula</label>
                                                    <input type="date" required className="w-full bg-slate-900 border border-slate-700 p-4 rounded-2xl text-white font-bold outline-none focus:ring-2 focus:ring-amber-600" value={editStudentData.enrollment_date} onChange={e => setEditStudentData({ ...editStudentData, enrollment_date: e.target.value })} />
                                                </div>
                                            </div>

                                            <div className="flex gap-4 pt-4">
                                                <button type="submit" className="flex-1 py-4 bg-amber-600 text-white font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-amber-900/20 hover:bg-amber-500 transition-all">Salvar Alterações</button>
                                                <button type="button" onClick={() => setIsEditingStudent(false)} className="px-8 py-4 bg-slate-800 text-slate-400 font-black uppercase tracking-widest rounded-2xl hover:bg-slate-700 transition-all">Cancelar</button>
                                            </div>
                                        </form>
                                    </motion.div>
                                ) : selectedStudentId ? (
                                    <motion.div
                                        key={selectedStudentId}
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -20 }}
                                        className="space-y-10"
                                    >
                                        {(() => {
                                            const student = studentsWithStatus.find(s => s.id === selectedStudentId);
                                            if (!student) return null;

                                            return (
                                                <>
                                                    {/* Student Profile */}
                                                    <div className="flex justify-between items-start">
                                                        <div className="flex items-center gap-6">
                                                            <div className="relative group">
                                                                <div className="absolute -inset-1 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-full blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
                                                                {student.photo_url ? (
                                                                    <img src={student.photo_url} className="relative w-24 h-24 rounded-full object-cover border-4 border-slate-800" />
                                                                ) : (
                                                                    <div className="relative w-24 h-24 rounded-full bg-slate-800 flex items-center justify-center text-2xl font-black text-slate-600 border-4 border-slate-700">{student.name.substring(0, 2).toUpperCase()}</div>
                                                                )}
                                                            </div>
                                                            <div>
                                                                <h3 className="text-3xl font-black text-white tracking-tighter uppercase">{student.name}</h3>
                                                                <p className="text-xs text-indigo-400 font-bold uppercase tracking-widest mt-1">Dossiê do Aluno</p>
                                                                <div className="flex gap-2 mt-4">
                                                                    <button onClick={() => handleStartEdit(student as Student)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center gap-2"><Edit2 className="w-3 h-3" /> Editar</button>
                                                                    <button onClick={() => onDeleteStudent(student.id)} className="px-4 py-2 bg-red-900/20 hover:bg-red-900/40 text-red-400 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center gap-2"><Trash2 className="w-3 h-3" /> Excluir</button>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="text-right flex flex-col items-end gap-2">
                                                            <span className={`inline-flex items-center px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${student.financialStatus === 'overdue' ? 'bg-red-500/10 text-red-400 border-red-500/30' :
                                                                student.financialStatus === 'due_today' ? 'bg-orange-500/10 text-orange-400 border-orange-500/30' :
                                                                    student.financialStatus === 'coming_up' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30' :
                                                                        'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                                                }`}>
                                                                {student.financialStatus === 'overdue' ? 'Atrasado' :
                                                                    student.financialStatus === 'due_today' ? 'Vence Hoje' :
                                                                        student.financialStatus === 'coming_up' ? 'Vence em 3 dias' :
                                                                            'Em Dia'}
                                                            </span>
                                                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider border ${student.status === 'active' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' : 'bg-slate-500/10 text-slate-400 border-slate-500/20'}`}>
                                                                Status: {student.status === 'active' ? 'Ativo' : 'Inativo'}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    {/* Stats Grid */}
                                                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                                        {[
                                                            { label: 'Nascimento', val: student.birth_date ? formatDate(student.birth_date) : 'N/A', icon: Cake, col: 'text-pink-400' },
                                                            { label: 'Matrícula', val: formatDate(student.enrollment_date), icon: Calendar, col: 'text-indigo-400' },
                                                            { label: 'Responsável', val: student.guardian_name || 'N/A', icon: User, col: 'text-blue-400' },
                                                            { label: 'Mensalidade', val: formatCurrency(student.monthly_fee), icon: DollarSign, col: 'text-emerald-400' }
                                                        ].map((stat, i) => (
                                                            <div key={i} className="bg-slate-800/40 border border-slate-700/50 p-5 rounded-2xl">
                                                                <p className="text-[9px] font-black uppercase text-slate-500 tracking-widest mb-2 flex items-center gap-2">
                                                                    {stat.icon && <stat.icon className={`w-3 h-3 ${stat.col}`} />} {stat.label}
                                                                </p>
                                                                <p className="text-xs font-black text-white">{stat.val}</p>
                                                            </div>
                                                        ))}
                                                    </div>

                                                    {/* Payments Table */}
                                                    <div className="space-y-4">
                                                        <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 px-2 flex items-center gap-2">
                                                            <TrendingDown className="w-4 h-4 text-indigo-400" /> Histórico Financeiro Recente
                                                        </h4>
                                                        <div className="bg-slate-950/40 rounded-[2rem] border border-slate-800 overflow-hidden">
                                                            <table className="w-full text-left">
                                                                <thead className="bg-slate-800/30 border-b border-slate-800">
                                                                    <tr>
                                                                        <th className="px-6 py-4 text-[9px] font-black uppercase text-slate-500">Vencimento</th>
                                                                        <th className="px-6 py-4 text-[9px] font-black uppercase text-slate-500">Status</th>
                                                                        <th className="px-6 py-4 text-[9px] font-black uppercase text-slate-500">Valor Atualizado</th>
                                                                        <th className="px-6 py-4 text-right text-[9px] font-black uppercase text-slate-500 pr-8">Ação</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody className="divide-y divide-slate-800/30">
                                                                    {student.payments.map(payment => (
                                                                        <tr key={payment.id} className="hover:bg-slate-800/20 transition-all group">
                                                                            <td className="px-6 py-4">
                                                                                <div className="text-xs font-bold text-slate-300">{formatDate(payment.due_date)}</div>
                                                                            </td>
                                                                            <td className="px-6 py-4">
                                                                                {payment.status === 'paid' ? (
                                                                                    <span className="flex items-center text-[10px] font-black text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-500/20 w-fit">PAGO</span>
                                                                                ) : payment.status === 'overdue' ? (
                                                                                    <span className="flex items-center text-[10px] font-black text-red-400 bg-red-500/10 px-2 py-1 rounded-lg border border-red-500/20 w-fit">ATRASADO</span>
                                                                                ) : (
                                                                                    <span className="flex items-center text-[10px] font-black text-blue-400 bg-blue-500/10 px-2 py-1 rounded-lg border border-blue-500/20 w-fit">AGENDADO</span>
                                                                                )}
                                                                            </td>
                                                                            <td className="px-6 py-4">
                                                                                <div className="text-sm font-black text-white">{formatCurrency(payment.calculatedAmount || payment.amount)}</div>
                                                                                {payment.interest! > 0 && <p className="text-[9px] font-bold text-red-400">+{formatCurrency(payment.interest!)} juros</p>}
                                                                            </td>
                                                                            <td className="px-6 py-4 text-right pr-8">
                                                                                <button
                                                                                    onClick={() => onTogglePayment(payment.id)}
                                                                                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${payment.status === 'paid'
                                                                                        ? 'bg-slate-800 text-slate-400 hover:bg-red-500/10 hover:text-red-400'
                                                                                        : 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20 hover:bg-emerald-600'
                                                                                        }`}
                                                                                >
                                                                                    {payment.status === 'paid' ? 'Estornar' : 'Pagar'}
                                                                                </button>
                                                                            </td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    </div>
                                                </>
                                            );
                                        })()}
                                    </motion.div>
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center text-center max-w-sm mx-auto">
                                        <div className="w-20 h-20 bg-indigo-600/10 rounded-3xl flex items-center justify-center mb-6">
                                            <Eye className="w-10 h-10 text-indigo-400" />
                                        </div>
                                        <h3 className="text-2xl font-black text-white tracking-tighter uppercase mb-3">Selecione um Aluno</h3>
                                        <p className="text-slate-400 text-sm leading-relaxed">Clique em um aluno na lista lateral para visualizar o dossiê acadêmico e financeiro completo.</p>
                                    </div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export default ClassDetailModal;
