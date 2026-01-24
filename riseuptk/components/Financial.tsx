import React, { useMemo } from 'react';
import { AlertCircle, CheckCircle, Clock, DollarSign } from 'lucide-react';
import { calculatePaymentDetails, formatCurrency } from '../utils/finance';
import { Payment, Student, Class } from '../types';

interface FinancialProps {
  payments: Payment[];
  students: Student[];
  classes: Class[];
  interestRate?: number; // NEW PROP
  onTogglePayment?: (id: string) => void;
}

const Financial: React.FC<FinancialProps> = ({ payments: rawPayments, students, classes, interestRate = 0.004 }) => {
  const payments = useMemo(() => {
    return rawPayments.map(p => {
      const student = students.find(s => s.id === p.student_id);
      const details = calculatePaymentDetails(p, interestRate, student?.name);
      const cls = classes.find(c => c.id === student?.class_id);
      return {
        ...details,
        studentName: student?.name,
        className: cls?.name,
      };
    }).sort((a, b) => (a.studentName || '').localeCompare(b.studentName || ''));
  }, [rawPayments, students, classes, interestRate]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <DollarSign className="text-emerald-400 w-6 h-6" /> Relatório Financeiro
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Regra de Juros do Sistema: <span className="text-emerald-400 font-bold">{(interestRate * 100).toFixed(1)}% ao dia</span> para pagamentos em atraso.
          </p>
        </div>
      </div>

      <div className="bg-slate-900/40 backdrop-blur-md rounded-2xl shadow-xl border border-slate-700/50 overflow-hidden">
        {/* DESKTOP VIEW */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-800/60 border-b border-slate-700/50">
              <tr>
                <th className="px-6 py-5 text-xs font-bold text-slate-300 uppercase tracking-wider">Aluno / Turma</th>
                <th className="px-6 py-5 text-xs font-bold text-slate-300 uppercase tracking-wider">Vencimento</th>
                <th className="px-6 py-5 text-xs font-bold text-slate-300 uppercase tracking-wider">Status</th>
                <th className="px-6 py-5 text-xs font-bold text-slate-300 uppercase tracking-wider">Valor Original</th>
                <th className="px-6 py-5 text-xs font-bold text-slate-300 uppercase tracking-wider">Juros</th>
                <th className="px-6 py-5 text-xs font-bold text-slate-300 uppercase tracking-wider">Total a Pagar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/30">
              {payments.map((payment) => (
                <tr key={payment.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="px-6 py-4">
                    <div className="text-sm font-bold text-white">{payment.studentName}</div>
                    <div className="text-xs text-slate-400 bg-slate-800 inline-block px-2 py-0.5 rounded mt-1 border border-slate-700">
                      {payment.className || 'Sem Turma'}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-300">
                    {new Date(payment.due_date).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      {payment.status === 'paid' && (
                        <span className="flex items-center px-2 py-1 text-xs font-bold rounded-full bg-emerald-900/30 text-emerald-400 border border-emerald-500/30">
                          <CheckCircle className="w-3 h-3 mr-1" /> Pago
                        </span>
                      )}
                      {payment.status === 'pending' && (
                        <span className="flex items-center px-2 py-1 text-xs font-bold rounded-full bg-yellow-900/30 text-yellow-400 border border-yellow-500/30">
                          <Clock className="w-3 h-3 mr-1" /> Pendente
                        </span>
                      )}
                      {payment.status === 'overdue' && (
                        <span className="flex items-center px-2 py-1 text-xs font-bold rounded-full bg-red-900/30 text-red-400 border border-red-500/30 animate-pulse">
                          <AlertCircle className="w-3 h-3 mr-1" /> Atrasado ({payment.daysOverdue}d)
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-400">
                    {formatCurrency(payment.amount)}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {payment.interest && payment.interest > 0 ? (
                      <span className="text-red-400 font-bold bg-red-900/20 px-2 py-1 rounded">+{formatCurrency(payment.interest)}</span>
                    ) : (
                      <span className="text-slate-600">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm font-bold text-white text-lg">
                    {formatCurrency(payment.calculatedAmount || payment.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* MOBILE VIEW (CARDS) */}
        <div className="md:hidden divide-y divide-slate-700/50">
          {payments.map((payment) => (
            <div key={payment.id} className="p-5 flex flex-col gap-4">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="text-white font-bold text-base">{payment.studentName}</h4>
                  <p className="text-[10px] text-slate-400 mt-1 uppercase font-bold tracking-widest">{payment.className || 'Sem Turma'}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-slate-500 uppercase font-black">Vencimento</p>
                  <p className="text-xs text-white font-bold">{new Date(payment.due_date).toLocaleDateString('pt-BR')}</p>
                </div>
              </div>

              <div className="flex items-center justify-between bg-slate-800/50 p-3 rounded-xl border border-slate-700/30">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] text-slate-500 font-bold uppercase">Status</span>
                  {payment.status === 'paid' && <span className="text-[10px] font-black text-emerald-400">PAGO</span>}
                  {payment.status === 'pending' && <span className="text-[10px] font-black text-yellow-500">PENDENTE</span>}
                  {payment.status === 'overdue' && <span className="text-[10px] font-black text-red-500 animate-pulse">ATRASADO ({payment.daysOverdue}d)</span>}
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-slate-500 font-bold uppercase">Total</p>
                  <p className={`text-lg font-black ${payment.status === 'overdue' ? 'text-red-400' : 'text-white'}`}>
                    {formatCurrency(payment.calculatedAmount || payment.amount)}
                  </p>
                  {(payment.interest || 0) > 0 && (
                    <p className="text-[9px] text-red-400/80 font-bold mt-[-4px]">+{formatCurrency(payment.interest!)} de juros</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {payments.length === 0 && (
          <div className="px-6 py-12 text-center text-slate-500">
            Nenhum registro financeiro encontrado.
          </div>
        )}
      </div>
    </div>
  );
};

export default Financial;