import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Student, Class, Attendance as AttendanceType } from '../types';
import { Calendar, CheckCircle, XCircle, Save, Filter, BookOpen, Download, Rocket, Sparkles } from 'lucide-react';
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
        <div className="p-6 min-h-[600px]">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8 gap-4">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-emerald-500/10 rounded-2xl border border-emerald-500/20">
                        <CheckCircle className="w-8 h-8 text-emerald-400" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-white tracking-tight">Frequência e Diário</h2>
                        <p className="text-slate-400 text-sm">Gestão de presença e controle de conteúdos.</p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-4 bg-slate-800/50 p-4 rounded-3xl border border-slate-700/50 backdrop-blur-xl">
                    <div className="relative group">
                        <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl blur opacity-20 group-hover:opacity-40 transition duration-500"></div>
                        <div className="relative flex items-center bg-slate-900 rounded-xl px-3 py-2 border border-slate-700">
                            <Calendar className="w-4 h-4 text-blue-400 mr-2" />
                            <input
                                type="date"
                                className="bg-transparent text-white focus:outline-none text-sm"
                                value={selectedDate}
                                onChange={e => setSelectedDate(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="relative group">
                        <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl blur opacity-20 group-hover:opacity-40 transition duration-500"></div>
                        <div className="relative flex items-center bg-slate-900 rounded-xl px-3 py-2 border border-slate-700">
                            <Filter className="w-4 h-4 text-purple-400 mr-2" />
                            <select
                                className="bg-transparent text-white focus:outline-none text-sm min-w-[150px] appearance-none cursor-pointer"
                                value={selectedClassId}
                                onChange={e => setSelectedClassId(e.target.value)}
                            >
                                <option value="" disabled>Turma...</option>
                                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                    </div>

                    <button
                        onClick={handleExportPDF}
                        disabled={!selectedClassId || isExporting}
                        className="flex items-center gap-2 px-5 py-2.5 bg-slate-700 hover:bg-slate-600 border border-slate-600 text-white rounded-xl text-sm font-bold transition-all disabled:opacity-50 group hover:shadow-lg hover:shadow-purple-500/10"
                    >
                        {isExporting ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Download className="w-4 h-4 text-purple-400 group-hover:animate-bounce" />}
                        PDF MENSAL
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
                        <div className="flex justify-between items-center px-2">
                            <h3 className="text-white font-bold flex items-center gap-2">
                                <Sparkles className="w-4 h-4 text-yellow-400" />
                                Chamada <span className="text-slate-500">({classStudents.length})</span>
                            </h3>
                            <div className="flex gap-4">
                                <button onClick={() => markAll(true)} className="text-[10px] font-black tracking-widest text-emerald-400 hover:text-emerald-300 transition-colors uppercase">Marcar Todos</button>
                                <button onClick={() => markAll(false)} className="text-[10px] font-black tracking-widest text-red-400/70 hover:text-red-400 transition-colors uppercase">Desmarcar</button>
                            </div>
                        </div>

                        <div className="bg-slate-800/40 rounded-3xl border border-slate-700/50 overflow-hidden backdrop-blur-md">
                            {isLoading ? (
                                <div className="flex flex-col items-center py-24 gap-4">
                                    <div className="w-10 h-10 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div>
                                    <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Sincronizando registros...</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 divide-y divide-slate-700/30">
                                    {classStudents.map((student, idx) => {
                                        const isPresent = attendanceMap[student.id];
                                        return (
                                            <motion.div
                                                key={student.id}
                                                initial={{ opacity: 0, x: -10 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: idx * 0.03 }}
                                                className={`group flex items-center justify-between p-4 hover:bg-slate-700/20 transition-all cursor-pointer ${isPresent ? 'bg-emerald-500/[0.03]' : ''}`}
                                                onClick={() => togglePresence(student.id)}
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div className="relative">
                                                        {student.photo_url ? (
                                                            <img src={student.photo_url} className="w-12 h-12 rounded-2xl object-cover border-2 border-slate-700 group-hover:border-slate-500 transition-colors" />
                                                        ) : (
                                                            <div className="w-12 h-12 rounded-2xl bg-slate-800 border-2 border-slate-700 flex items-center justify-center text-slate-500 font-bold uppercase transition-all group-hover:bg-slate-700">
                                                                {student.name.substring(0, 2)}
                                                            </div>
                                                        )}
                                                        <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-lg border-2 border-[#0f172a] shadow-lg flex items-center justify-center transform group-hover:scale-110 transition-transform ${isPresent ? 'bg-emerald-500' : 'bg-red-500'}`}>
                                                            {isPresent ? <CheckCircle className="w-3 h-3 text-white" /> : <XCircle className="w-3 h-3 text-white" />}
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <p className={`font-bold transition-colors ${isPresent ? 'text-white' : 'text-slate-400'}`}>{student.name}</p>
                                                        <div className="flex items-center gap-2">
                                                            <div className={`w-1.5 h-1.5 rounded-full ${isPresent ? 'bg-emerald-500 animate-pulse' : 'bg-red-500/50'}`}></div>
                                                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{isPresent ? 'Presente' : 'Ausente'}</p>
                                                        </div>
                                                    </div>
                                                </div>

                                                <button className={`px-4 py-1.5 rounded-lg text-[10px] font-black tracking-widest transition-all ${isPresent ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20' : 'text-slate-400 bg-slate-700/50 border border-slate-600/50'}`}>
                                                    {isPresent ? 'CONFIRMADO' : 'NOTIFICAR'}
                                                </button>
                                            </motion.div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Diário de Classe */}
                    <div className="space-y-6">
                        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-3xl border border-slate-700 p-6 shadow-2xl relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
                                <BookOpen className="w-32 h-32" />
                            </div>

                            <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                                <BookOpen className="w-5 h-5 text-blue-400" />
                                Diário de Conteúdo
                            </h3>

                            <div className="space-y-4 relative z-10">
                                <textarea
                                    value={lessonContent}
                                    onChange={(e) => setLessonContent(e.target.value)}
                                    className="w-full h-48 p-4 bg-slate-950/50 border border-slate-700 rounded-2xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-mono text-sm leading-relaxed"
                                    placeholder="Descreva o que foi ensinado hoje..."
                                />

                                <div className="p-4 bg-blue-500/5 rounded-2xl border border-blue-500/10">
                                    <div className="flex items-start gap-3">
                                        <Sparkles className="w-4 h-4 text-blue-400 mt-0.5" />
                                        <p className="text-[11px] text-blue-300/80 leading-relaxed font-medium">
                                            Os conteúdos salvos aqui serão exportados automaticamente no relatório mensal em PDF.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="w-full py-5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black tracking-widest uppercase text-xs rounded-2xl shadow-xl shadow-emerald-900/40 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-3 group"
                        >
                            {isSaving ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            ) : (
                                <>
                                    <Save className="w-5 h-5 group-hover:scale-110 transition-transform" />
                                    Salvar Registros de Hoje
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

