import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Teacher, Class } from '../types';
import { Plus, Edit, Trash2, Mail, Phone, BookOpen, User } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { showToast, showAlert, showConfirm } from '../utils/alerts';

interface TeachersProps {
    schoolId: string;
    classes: Class[];
}

const Teachers: React.FC<TeachersProps> = ({ schoolId, classes }) => {
    const [teachers, setTeachers] = useState<Teacher[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);

    const [formData, setFormData] = useState<Partial<Teacher>>({
        name: '',
        email: '',
        phone: '',
        specialty: '',
        active: true
    });

    useEffect(() => {
        if (schoolId) fetchTeachers();
    }, [schoolId]);

    const fetchTeachers = async () => {
        try {
            const { data, error } = await supabase
                .from('teachers')
                .select('*')
                .eq('school_id', schoolId)
                .order('name');

            if (error) throw error;
            setTeachers(data || []);
        } catch (error) {
            console.error('Erro ao buscar professores:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingTeacher) {
                const { error } = await supabase
                    .from('teachers')
                    .update(formData)
                    .eq('id', editingTeacher.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('teachers')
                    .insert([{ ...formData, school_id: schoolId }]);
                if (error) throw error;
            }
            fetchTeachers();
            closeModal();
            showToast("Professor salvo com sucesso!");
        } catch (error: any) {
            showAlert("Erro ao salvar", error.message, "error");
        }
    };

    const handleDelete = async (id: string) => {
        if (!await showConfirm("Excluir professor?", "Esta ação não pode ser desfeita.")) return;
        try {
            const { error } = await supabase.from('teachers').delete().eq('id', id);
            if (error) throw error;
            setTeachers(prev => prev.filter(t => t.id !== id));
            showToast("Professor excluído.");
        } catch (error) {
            showAlert("Erro ao excluir", "Não foi possível remover o professor.", "error");
        }
    };

    const openModal = (teacher?: Teacher) => {
        if (teacher) {
            setEditingTeacher(teacher);
            setFormData(teacher);
        } else {
            setEditingTeacher(null);
            setFormData({ name: '', email: '', phone: '', specialty: '', active: true });
        }
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingTeacher(null);
    };

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                        <User className="w-6 h-6 text-purple-400" /> Corpo Docente
                    </h2>
                    <p className="text-slate-400 text-sm">Gerencie os professores e suas especialidades.</p>
                </div>
                <button
                    onClick={() => openModal()}
                    className="flex items-center px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold transition-all hover:scale-105 shadow-lg shadow-purple-900/30"
                >
                    <Plus className="w-5 h-5 mr-2" /> Novo Professor
                </button>
            </div>

            {isLoading ? (
                <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-purple-500 rounded-full animate-spin border-t-transparent"></div></div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {teachers.map(teacher => (
                        <motion.div
                            key={teacher.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 hover:border-purple-500/50 transition-colors group"
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-purple-500 to-blue-500 flex items-center justify-center text-xl font-bold text-white shadow-lg">
                                    {teacher.name.charAt(0)}
                                </div>
                                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => openModal(teacher)} className="p-2 text-blue-400 hover:bg-blue-900/20 rounded-lg"><Edit className="w-4 h-4" /></button>
                                    <button onClick={() => handleDelete(teacher.id)} className="p-2 text-red-400 hover:bg-red-900/20 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                                </div>
                            </div>

                            <h3 className="text-xl font-bold text-white mb-1">{teacher.name}</h3>
                            <p className="text-purple-400 text-sm font-medium mb-4 flex items-center gap-1">
                                <BookOpen className="w-3 h-3" /> {teacher.specialty || 'Sem especialidade'}
                            </p>

                            <div className="space-y-2 text-sm text-slate-400">
                                {teacher.email && (
                                    <div className="flex items-center gap-2 overflow-hidden text-ellipsis whitespace-nowrap">
                                        <Mail className="w-4 h-4 flex-shrink-0" /> {teacher.email}
                                    </div>
                                )}
                                {teacher.phone && (
                                    <div className="flex items-center gap-2">
                                        <Phone className="w-4 h-4" /> {teacher.phone}
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}

            <AnimatePresence>
                {isModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-slate-900 p-8 rounded-2xl w-full max-w-md border border-slate-700 shadow-2xl"
                        >
                            <h3 className="text-2xl font-bold text-white mb-6">
                                {editingTeacher ? 'Editar Professor' : 'Novo Professor'}
                            </h3>
                            <form onSubmit={handleSave} className="space-y-4">
                                <div>
                                    <label className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-1 block">Nome</label>
                                    <input required className="w-full p-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-purple-500" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                                </div>
                                <div>
                                    <label className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-1 block">Matéria / Especialidade</label>
                                    <input className="w-full p-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-purple-500" placeholder="Ex: Matemática, Piano" value={formData.specialty} onChange={e => setFormData({ ...formData, specialty: e.target.value })} />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-1 block">Email</label>
                                        <input type="email" className="w-full p-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-purple-500" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-1 block">Telefone</label>
                                        <input className="w-full p-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-purple-500" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
                                    </div>
                                </div>
                                <div className="flex gap-3 pt-4">
                                    <button type="button" onClick={closeModal} className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold">Cancelar</button>
                                    <button type="submit" className="flex-1 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold shadow-lg">Salvar</button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default Teachers;
