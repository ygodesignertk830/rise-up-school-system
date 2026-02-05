import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Student, Class, Attendance as AttendanceType } from '../types';
import { Calendar, CheckCircle, XCircle, Save, Filter, BookOpen, Download, Rocket, Sparkles, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getLocalDateString } from '../utils/finance';

import { showToast, showAlert } from '../utils/alerts';
import officialLogo from '../LogotipoRiseUpOficial.png'; // IMPORTE O LOGO

// Interface global para o jsPDF que adicionamos via CDN
declare global {
    interface Window {
        jspdf: any;
    }
}

interface AttendanceProps {
    schoolId: string;
    classes: Class[];
    students: Student[];
}

const imageUrlToBase64 = async (url: string): Promise<string> => {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};

const Attendance: React.FC<AttendanceProps> = ({ schoolId, classes, students }) => {
    const [selectedClassId, setSelectedClassId] = useState<string>('');
    const [selectedDate, setSelectedDate] = useState<string>(getLocalDateString());
    const [attendanceMap, setAttendanceMap] = useState<Record<string, boolean>>({});
    const [lessonContent, setLessonContent] = useState<string>('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [isClassDropdownOpen, setIsClassDropdownOpen] = useState(false);

    const selectedClassName = classes.find(c => c.id === selectedClassId)?.name || 'Selecionar Turma';

    // Filter students by class AND enrollment date
    const classStudents = students.filter(s => {
        const matchesClass = s.class_id === selectedClassId;
        const isEnrolledAtDate = !s.enrollment_date || s.enrollment_date <= selectedDate;
        return matchesClass && isEnrolledAtDate;
    }).sort((a, b) => a.name.localeCompare(b.name));

    useEffect(() => {
        if (selectedClassId && selectedDate) {
            fetchAttendance();
        } else {
            setAttendanceMap({});
        }
    }, [selectedClassId, selectedDate]);

    useEffect(() => {
        if (!selectedClassId && classes.length > 0) {
            setSelectedClassId(classes[0].id);
        }
    }, [classes]);

    // Fechar dropdown ao clicar fora
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (isClassDropdownOpen) {
                const target = event.target as HTMLElement;
                if (!target.closest('.class-selector-container')) {
                    setIsClassDropdownOpen(false);
                }
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isClassDropdownOpen]);

    const fetchAttendance = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('attendance')
                .select('student_id, present')
                .eq('school_id', schoolId)
                .eq('class_id', selectedClassId)
                .eq('date', selectedDate);

            if (error) throw error;

            const newMap: Record<string, boolean> = {};
            classStudents.forEach(s => newMap[s.id] = false);
            data?.forEach((record: any) => {
                newMap[record.student_id] = record.present;
            });
            setAttendanceMap(newMap);

            const { data: contentData } = await supabase
                .from('lesson_contents')
                .select('content')
                .eq('school_id', schoolId)
                .eq('class_id', selectedClassId)
                .eq('date', selectedDate)
                .maybeSingle();

            setLessonContent(contentData?.content || '');

        } catch (error) {
            console.error('Erro ao buscar frequência:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const togglePresence = (studentId: string) => {
        setAttendanceMap(prev => ({
            ...prev,
            [studentId]: !prev[studentId]
        }));
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const upsertData = classStudents.map(student => ({
                school_id: schoolId,
                class_id: selectedClassId,
                student_id: student.id,
                date: selectedDate,
                present: attendanceMap[student.id] || false
            }));

            const { error: attError } = await supabase
                .from('attendance')
                .upsert(upsertData, { onConflict: 'student_id, date' });

            if (attError) throw attError;

            const { error: contentError } = await supabase
                .from('lesson_contents')
                .upsert({
                    school_id: schoolId,
                    class_id: selectedClassId,
                    date: selectedDate,
                    content: lessonContent
                }, { onConflict: 'class_id, date' });

            if (contentError) throw contentError;

            showToast("Chamada e Conteúdo salvos!", "success");
        } catch (error: any) {
            showAlert("Erro ao salvar", error.message, "error");
        } finally {
            setIsSaving(false);
        }
    };

    const markAll = (present: boolean) => {
        const newMap = { ...attendanceMap };
        classStudents.forEach(s => newMap[s.id] = present);
        setAttendanceMap(newMap);
    };

    // --- LÓGICA DE EXPORTAÇÃO PDF ESPACIAL ---
    const handleExportPDF = async () => {
        if (!selectedClassId) return;
        setIsExporting(true);

        try {
            const currentYear = parseInt(selectedDate.split('-')[0]);
            const currentMonth = parseInt(selectedDate.split('-')[1]) - 1; // 0-indexed

            // 1. Gerar todos os dias úteis (Segunda a Sexta) do mês selecionado
            const date = new Date(currentYear, currentMonth, 1);
            const workingDays: { date: string, day: number }[] = [];
            while (date.getMonth() === currentMonth) {
                const dayOfWeek = date.getDay();
                if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Not Sunday (0) or Saturday (6)
                    const d = String(date.getDate()).padStart(2, '0');
                    const m = String(date.getMonth() + 1).padStart(2, '0');
                    workingDays.push({
                        date: `${date.getFullYear()}-${m}-${d}`,
                        day: date.getDate()
                    });
                }
                date.setDate(date.getDate() + 1);
            }

            // 2. Buscar TODOS os registros do mês para esta turma
            const startDate = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;
            const lastDay = new Date(currentYear, currentMonth + 1, 0).getDate();
            const endDate = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${lastDay}`;

            const { data: attendanceData } = await supabase
                .from('attendance')
                .select('*')
                .eq('class_id', selectedClassId)
                .gte('date', startDate)
                .lte('date', endDate);

            const { data: lessonContents } = await supabase
                .from('lesson_contents')
                .select('*')
                .eq('class_id', selectedClassId)
                .gte('date', startDate)
                .lte('date', endDate);

            // 3. Gerar o PDF
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

            const className = classes.find(c => c.id === selectedClassId)?.name || 'Turma';
            const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
            const monthLabel = `${monthNames[currentMonth]} / ${currentYear}`;

            // --- ESTILO ESPACIAL ---
            const primaryColor = [15, 23, 42]; // Slate-900
            const accentColor = [16, 185, 129]; // Emerald-500

            // Background decorativo
            doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
            doc.rect(0, 0, 297, 210, 'F');

            // Estrelas decorativas
            doc.setDrawColor(255, 255, 255);
            for (let i = 0; i < 50; i++) {
                doc.setGState(new doc.GState({ opacity: Math.random() }));
                doc.circle(Math.random() * 297, Math.random() * 210, 0.2, 'F');
            }
            doc.setGState(new doc.GState({ opacity: 1 }));

            // --- HEADER COM LOGO ---
            try {
                // Convert logo to Base64 to avoid browser security warnings
                const logoBase64 = await imageUrlToBase64(officialLogo);
                doc.addImage(logoBase64, 'PNG', 15, 10, 20, 20);

                // Ajusta texto para não sobrepor o logo (move X de 15 para 40)
                doc.setTextColor(255, 255, 255);
                doc.setFontSize(24);
                doc.setFont('helvetica', 'bold');
                doc.text('DIÁRIO DE FREQUÊNCIA', 40, 20);

                doc.setFontSize(14);
                doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
                doc.text(`${className.toUpperCase()} • ${monthLabel.toUpperCase()}`, 40, 30);
            } catch (err) {
                console.error("Erro ao carregar logo no PDF", err);
                // Fallback se falhar imagem: Imprime texto normal sem deslocamento ou mantém deslocamento
                doc.text('DIÁRIO DE FREQUÊNCIA', 15, 20);
            }

            // Preparar dados da tabela
            const tableHeaders = ['ALUNO', ...workingDays.map(wd => wd.day.toString()), 'FALTAS'];
            const tableRows = classStudents.map(student => {
                const row: any[] = [student.name.toUpperCase()];
                let totalAbsences = 0;

                workingDays.forEach(wd => {
                    const record = attendanceData?.find(a => a.student_id === student.id && a.date === wd.date);
                    if (record) {
                        if (record.present) {
                            row.push({ content: 'P', styles: { textColor: [255, 255, 255] } });
                        } else {
                            row.push({ content: 'F', styles: { textColor: [239, 68, 68], fontStyle: 'bold' } });
                            totalAbsences++;
                        }
                    } else {
                        row.push('');
                    }
                });

                row.push({ content: totalAbsences.toString(), styles: { fontStyle: 'bold', textColor: [255, 255, 255] } });
                return row;
            });

            // Gerar Tabela de Frequência
            doc.autoTable({
                head: [tableHeaders],
                body: tableRows,
                startY: 40,
                theme: 'grid',
                styles: {
                    fontSize: 7,
                    cellPadding: 2,
                    valign: 'middle',
                    halign: 'center',
                    fillColor: [15, 23, 42], // Fundo branco para garantir contraste com letras pretas
                    textColor: [0, 0, 0], // Letras pretas para legibilidade
                    lineColor: [200, 200, 200], // Linhas cinzas suaves
                },
                headStyles: {
                    fillColor: [79, 70, 229], // Indigo-600
                    textColor: [255, 255, 255],
                    fontStyle: 'bold'
                },
                columnStyles: {
                    0: { halign: 'left', fontStyle: 'bold', fontSize: 8, cellWidth: 'auto', textColor: [0, 0, 0], fillColor: [240, 240, 240] }
                }
            });

            // Resumo de Conteúdos
            let finalY = (doc as any).lastAutoTable.finalY + 15;
            if (finalY > 170) {
                doc.addPage();
                finalY = 25;
            }

            doc.setFontSize(14);
            doc.setTextColor(255, 255, 255);
            doc.text('CONTEÚDOS MINISTRADOS NO MÊS', 15, finalY);

            const contentData = workingDays
                .map(wd => {
                    const content = lessonContents?.find(c => c.date === wd.date);
                    if (!content) return null;
                    return [
                        wd.day + '/' + (currentMonth + 1),
                        content.content.toUpperCase()
                    ];
                })
                .filter(Boolean);

            if (contentData.length > 0) {
                doc.autoTable({
                    head: [['DIA', 'CONTEÚDO / ATIVIDADES']],
                    body: contentData,
                    startY: finalY + 8,
                    theme: 'grid',
                    styles: {
                        fontSize: 8,
                        fillColor: [255, 255, 255], // Fundo branco
                        textColor: [0, 0, 0], // Texto PRETO
                        cellPadding: 3,
                        lineColor: [200, 200, 200]
                    },
                    headStyles: {
                        fillColor: [16, 185, 129], // Emerald
                        textColor: [255, 255, 255]
                    },
                    columnStyles: {
                        0: { cellWidth: 20, fontStyle: 'bold', fillColor: [240, 240, 240] },
                        1: { cellWidth: 'auto' }
                    }
                });
            } else {
                doc.setFontSize(10);
                doc.setTextColor(150, 150, 150);
                doc.text('Nenhum registro de conteúdo encontrado para este mês.', 15, finalY + 15);
            }

            // Footer
            const totalPages = doc.getNumberOfPages();
            for (let i = 1; i <= totalPages; i++) {
                doc.setPage(i);
                doc.setFontSize(8);
                doc.setTextColor(100, 100, 100);
                doc.text(`Rise UP School System • Página ${i} de ${totalPages}`, 297 / 2, 205, { align: 'center' });
            }

            doc.save(`Diario_${className}_${monthNames[currentMonth]}.pdf`);
            showToast("PDF gerado com sucesso!", "success");
        } catch (error: any) {
            console.error(error);
            showAlert("Erro na Exportação", "Não foi possível gerar o PDF. Verifique se a biblioteca carregou corretamente.", "error");
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div className="pb-8 min-h-[600px] space-y-8">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8 gap-4">
                <div className="flex items-center gap-5">
                    <div className="p-4 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 shadow-inner">
                        <CheckCircle className="w-8 h-8 text-emerald-400" />
                    </div>
                    <div>
                        <h2 className="text-3xl font-black text-white tracking-tighter uppercase">Frequência e Diário</h2>
                        <p className="text-slate-500 text-xs font-bold uppercase tracking-[0.1em]">Gestão de presença • Controle de conteúdos</p>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 bg-slate-900/80 p-3 rounded-2xl border border-slate-700/50 backdrop-blur-2xl w-full lg:w-auto shadow-2xl overflow-visible relative z-50">
                    <div className="relative group flex-1 md:flex-none md:w-44">
                        <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-600 to-cyan-500 rounded-xl blur opacity-10 group-hover:opacity-30 transition duration-500"></div>
                        <div className="relative flex items-center bg-slate-950 rounded-xl px-3 py-2 border border-slate-800 group-hover:border-blue-500/50 transition-colors shadow-inner">
                            <Calendar className="w-4 h-4 text-blue-500 mr-2 flex-shrink-0" />
                            <input
                                type="date"
                                className="bg-transparent text-white focus:outline-none text-[11px] md:text-xs w-full font-bold tracking-tight"
                                value={selectedDate}
                                onChange={e => setSelectedDate(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="relative group class-selector-container flex-1 md:flex-none md:w-72 overflow-visible">
                        <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl blur opacity-10 group-hover:opacity-30 transition duration-500"></div>
                        <button
                            type="button"
                            id="class-dropdown-trigger"
                            onClick={() => setIsClassDropdownOpen(!isClassDropdownOpen)}
                            className="relative flex items-center bg-slate-950 rounded-xl px-4 py-2 border border-slate-800 w-full text-left transition-all hover:border-cyan-500 shadow-inner group/btn"
                        >
                            <Filter className="w-4 h-4 text-cyan-500 mr-3 flex-shrink-0 group-hover/btn:rotate-12 transition-transform" />
                            <span className="text-white text-[11px] md:text-xs font-black flex-1 truncate tracking-tight uppercase">{selectedClassName}</span>
                            <motion.div
                                animate={{ rotate: isClassDropdownOpen ? 180 : 0, scale: isClassDropdownOpen ? 1.1 : 1 }}
                                className="ml-2 text-slate-600 flex-shrink-0"
                            >
                                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                            </motion.div>
                        </button>

                        <AnimatePresence>
                            {isClassDropdownOpen && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10, scale: 0.98 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 10, scale: 0.98 }}
                                    className="absolute top-full mt-2 right-0 w-[280px] sm:w-[380px] max-w-[95vw] bg-[#020617] border-2 border-slate-800 rounded-2xl shadow-[0_30px_70px_-15px_rgba(0,0,0,0.8)] z-[2000] p-1.5 backdrop-blur-3xl ring-1 ring-white/5"
                                >
                                    <div className="p-2.5 border-b border-slate-800/50 mb-1">
                                        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-600">Selecione a Turma</p>
                                    </div>
                                    <div className="max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
                                        {classes.map(c => (
                                            <button
                                                key={c.id}
                                                type="button"
                                                onClick={() => {
                                                    setSelectedClassId(c.id);
                                                    setIsClassDropdownOpen(false);
                                                }}
                                                className={`w-full px-3 py-2.5 text-left transition-all flex items-center gap-3 rounded-lg mb-1 group/item ${selectedClassId === c.id
                                                    ? 'bg-blue-600/10 text-blue-400 ring-1 ring-blue-500/20'
                                                    : 'text-slate-500 hover:bg-white/5 hover:text-white'}`}
                                            >
                                                <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 shadow-[0_0_8px_rgba(0,0,0,0.5)] border-2 border-slate-900 ${c.color.split(' ')[0]}`} />
                                                <div className="flex-1 min-w-0">
                                                    <p className={`text-[11px] md:text-xs font-bold truncate ${selectedClassId === c.id ? 'text-blue-300' : ''}`}>{c.name}</p>
                                                </div>
                                                {selectedClassId === c.id && (
                                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.6)]" />
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    <button
                        onClick={handleExportPDF}
                        disabled={!selectedClassId || isExporting}
                        className="flex items-center justify-center gap-2 px-6 py-2 bg-slate-900 hover:bg-slate-800 border-2 border-slate-800 text-white rounded-xl text-[10px] font-black tracking-widest transition-all disabled:opacity-50 group hover:border-cyan-500/30 hover:shadow-2xl hover:shadow-cyan-500/10 flex-1 md:flex-none uppercase"
                    >
                        {isExporting ? <div className="w-3 h-3 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" /> : <Download className="w-3.5 h-3.5 text-cyan-400" />}
                        <span className="whitespace-nowrap">PDF</span>
                    </button>
                </div>
            </div>

            {!selectedClassId ? (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col items-center justify-center py-32 bg-slate-800/20 rounded-3xl border-2 border-dashed border-slate-700/50"
                >
                    <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-4 text-slate-500">
                        <Rocket className="w-8 h-8 opacity-50 animate-pulse" />
                    </div>
                    <p className="text-slate-500 font-medium">Pronto para a decolagem? Selecione uma turma.</p>
                </motion.div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Alunos */}
                    <div className="lg:col-span-2 space-y-4">
                        <div className="flex justify-between items-end px-1">
                            <div>
                                <h3 className="text-white text-lg font-black flex items-center gap-2 uppercase tracking-tight">
                                    <Sparkles className="w-5 h-5 text-cyan-400" />
                                    Chamada <span className="text-slate-600">[{classStudents.length}]</span>
                                </h3>
                            </div>
                            <div className="flex gap-6">
                                <button onClick={() => markAll(true)} className="text-[10px] font-black tracking-[0.2em] text-emerald-500 hover:text-emerald-400 transition-colors uppercase py-2">Marcar Todos</button>
                                <button onClick={() => markAll(false)} className="text-[10px] font-black tracking-[0.2em] text-red-500/70 hover:text-red-400 transition-colors uppercase py-2">Desmarcar</button>
                            </div>
                        </div>

                        <div className="bg-slate-900/50 rounded-3xl border border-slate-700/50 overflow-hidden backdrop-blur-xl">
                            <div className="overflow-x-auto custom-scrollbar">
                                <table className="w-full text-left">
                                    <thead className="bg-slate-800/80 text-slate-400 text-[10px] uppercase font-bold tracking-widest border-b border-slate-700/50">
                                        <tr>
                                            <th className="px-6 py-4">Aluno</th>
                                            <th className="px-6 py-4 text-center">Presença</th>
                                            <th className="px-6 py-4">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-700/30">
                                        {isLoading ? (
                                            <tr>
                                                <td colSpan={3} className="px-6 py-20 text-center">
                                                    <div className="flex flex-col items-center gap-3">
                                                        <div className="w-10 h-10 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
                                                        <p className="text-slate-400 font-medium">Carregando lista...</p>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : classStudents.length > 0 ? (
                                            classStudents.map(student => {
                                                const isPresent = attendanceMap[student.id];
                                                return (
                                                    <motion.tr
                                                        initial={{ opacity: 0 }}
                                                        animate={{ opacity: 1 }}
                                                        key={student.id}
                                                        className="hover:bg-white/5 transition-colors group"
                                                    >
                                                        <td className="px-6 py-5">
                                                            <div className="flex items-center gap-4">
                                                                <div className="w-11 h-11 rounded-xl bg-slate-950 flex items-center justify-center text-blue-500 font-black border border-slate-800 shadow-inner group-hover:border-blue-500/50 group-hover:bg-blue-500/5 transition-all duration-300">
                                                                    {student.name.charAt(0)}
                                                                </div>
                                                                <div>
                                                                    <p className="font-black text-white group-hover:text-blue-400 transition-colors tracking-tight">{student.name}</p>
                                                                    <div className="flex items-center gap-2 mt-0.5">
                                                                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-slate-950 text-slate-600 border border-slate-800/50 uppercase tracking-tighter">ID: {student.id.slice(0, 8)}</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center justify-center gap-2">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setAttendanceMap(prev => ({ ...prev, [student.id]: true }))}
                                                                    className={`p-3 rounded-2xl transition-all flex flex-col items-center gap-1 border-2 ${isPresent
                                                                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400 shadow-lg shadow-emerald-500/20 scale-105'
                                                                        : 'bg-slate-800/50 border-slate-700 text-slate-500 hover:border-slate-500'
                                                                        }`}
                                                                >
                                                                    <CheckCircle className="w-5 h-5" />
                                                                    <span className="text-[8px] font-black uppercase">Presente</span>
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setAttendanceMap(prev => ({ ...prev, [student.id]: false }))}
                                                                    className={`p-3 rounded-2xl transition-all flex flex-col items-center gap-1 border-2 ${!isPresent
                                                                        ? 'bg-red-500/20 border-red-500 text-red-500 shadow-lg shadow-red-500/20 scale-105'
                                                                        : 'bg-slate-800/50 border-slate-700 text-slate-500 hover:border-slate-500'
                                                                        }`}
                                                                >
                                                                    <XCircle className="w-5 h-5" />
                                                                    <span className="text-[8px] font-black uppercase">Ausente</span>
                                                                </button>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center gap-2">
                                                                <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${isPresent ? 'text-emerald-400 bg-emerald-500/10' : 'text-red-400 bg-red-500/10'}`}>
                                                                    {isPresent ? 'Confirmado' : 'Falta'}
                                                                </span>
                                                            </div>
                                                        </td>
                                                    </motion.tr>
                                                );
                                            })
                                        ) : (
                                            <tr>
                                                <td colSpan={3} className="px-6 py-20 text-center text-slate-500 italic">
                                                    Nenhum aluno encontrado para os filtros selecionados.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="bg-[#020617] rounded-[2rem] border-2 border-slate-900 p-8 shadow-2xl relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
                                <BookOpen className="w-40 h-40 text-blue-500" />
                            </div>

                            <h3 className="text-white font-black text-lg mb-6 flex items-center gap-3 uppercase tracking-tighter">
                                <BookOpen className="w-6 h-6 text-blue-500" />
                                Diário de Conteúdo
                            </h3>

                            <div className="space-y-6 relative z-10">
                                <textarea
                                    value={lessonContent}
                                    onChange={(e) => setLessonContent(e.target.value)}
                                    className="w-full h-64 p-6 bg-slate-950 border-2 border-slate-900 rounded-2xl text-white focus:outline-none focus:border-blue-500/50 transition-all font-mono text-sm leading-relaxed placeholder:text-slate-800 shadow-inner"
                                    placeholder="Comece a digitar o que foi ensinado hoje..."
                                />

                                <div className="p-5 bg-blue-500/5 rounded-2xl border-2 border-blue-500/10 flex items-start gap-4">
                                    <Sparkles className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                                    <p className="text-[10px] font-bold text-blue-300/60 leading-relaxed uppercase tracking-widest">
                                        Os conteúdos salvos aqui serão exportados automaticamente no relatório mensal em PDF para os gestores.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="w-full py-6 bg-blue-600 hover:bg-blue-500 text-white font-black tracking-[0.3em] uppercase text-xs rounded-2xl shadow-[0_20px_40px_-10px_rgba(37,99,235,0.3)] active:scale-[0.97] transition-all disabled:opacity-50 flex items-center justify-center gap-4 group ring-2 ring-white/5"
                        >
                            {isSaving ? (
                                <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin"></div>
                            ) : (
                                <>
                                    <Save className="w-6 h-6 group-hover:rotate-12 transition-transform" />
                                    Salvar Registros
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Attendance;

