import React from 'react';
import { Calendar, User, MapPin, Edit2, Trash2 } from 'lucide-react';
import { Class, Student } from '../types';

interface ClassListProps {
  classes: Class[];
  students: Student[];
  onEdit: (cls: Class) => void;
  onDelete: (id: string) => void;
  onOpenDetail: (cls: Class, studentId?: string) => void;
}

const ClassList: React.FC<ClassListProps> = ({ classes, students, onEdit, onDelete, onOpenDetail }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {classes.map((cls) => {
        const studentCount = students.filter(s => s.class_id === cls.id).length;

        // Ensure color has correct format for tailwind if stored as simple class
        // Providing fallback just in case
        const bgColor = cls.color.includes('bg-') ? cls.color : 'bg-blue-600';

        return (
          <div
            key={cls.id}
            onClick={() => onOpenDetail(cls)}
            className="bg-slate-800 rounded-xl shadow-lg border border-slate-700 overflow-hidden hover:border-purple-500 transition-all group relative cursor-pointer"
          >
            <div className={`h-2 w-full ${bgColor}`}></div>
            <div className="p-6">
              <div className="flex justify-between items-start mb-4 gap-3">
                <div className="flex-1 min-w-0">
                  <h3 className="text-xl font-bold text-white leading-tight break-words pr-2">
                    {cls.name}
                  </h3>
                  <div className="mt-2 text-xs text-slate-500 font-bold uppercase tracking-widest bg-slate-900/40 w-fit px-2 py-1 rounded">
                    Clique para ver detalhes
                  </div>
                  <div className="mt-2">
                    <span className={`px-2.5 py-1 text-xs font-bold rounded-full bg-slate-900/80 text-slate-300 border border-slate-700 inline-flex items-center`}>
                      <User className="w-3 h-3 mr-1.5 text-purple-400" />
                      {studentCount} {studentCount === 1 ? 'Aluno' : 'Alunos'}
                    </span>
                  </div>
                </div>

                <div className="flex gap-1 flex-shrink-0 bg-slate-900/50 p-1 rounded-lg border border-slate-700/50 relative z-10" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => onEdit(cls)}
                    className="p-2 text-slate-400 hover:text-blue-400 hover:bg-slate-800 rounded-md transition-all active:scale-95"
                    title="Editar Turma"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <div className="w-px h-auto bg-slate-700/50 my-1"></div>
                  <button
                    onClick={() => onDelete(cls.id)}
                    className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-900/20 rounded-md transition-all active:scale-95"
                    title="Excluir Turma"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>


              <div className="space-y-3 text-sm text-slate-400 mt-6">
                <div className="flex items-center">
                  <User className="w-4 h-4 mr-2 text-purple-400" />
                  <span>Prof: <span className="font-medium text-slate-200">{cls.teacher}</span></span>
                </div>
                <div className="flex items-center">
                  <Calendar className="w-4 h-4 mr-2 text-blue-400" />
                  <span>{cls.schedule}</span>
                </div>
                <div className="flex items-center">
                  <MapPin className="w-4 h-4 mr-2 text-emerald-400" />
                  <span>Sala: {cls.room}</span>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-700/50">
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Alunos</h4>
                <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto custom-scrollbar">
                  {students
                    .filter(s => s.class_id === cls.id)
                    .map(s => (
                      <span
                        key={s.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenDetail(cls, s.id);
                        }}
                        className="text-xs bg-slate-900/50 text-slate-300 px-2 py-1 rounded border border-slate-700 hover:border-indigo-500 hover:text-indigo-400 transition-colors cursor-pointer"
                      >
                        {s.name.trim().split(' ')[0] || s.name}
                      </span>
                    ))}
                  {studentCount === 0 && <span className="text-xs text-slate-600 italic">Nenhum aluno matriculado</span>}
                </div>
              </div>
            </div>
          </div>
        );
      })}
      {classes.length === 0 && (
        <div className="col-span-full text-center py-10 text-slate-500">
          Nenhuma turma cadastrada. Clique em "Nova Turma" para começar.
        </div>
      )}
    </div>
  );
};

export default ClassList;