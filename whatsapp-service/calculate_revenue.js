
import { supabase } from './lib/supabase.js';

const INTEREST_RATE_DAILY = 0.004;

const STUDENT_POLICIES = {
    'Islayne Caxias': { monthlyFeeOnTime: 179, monthlyFeeLate: 250 },
    'Islayne Caxias da Silva': { monthlyFeeOnTime: 179, monthlyFeeLate: 250 },
    'Islainy Caxias da Silva': { monthlyFeeOnTime: 179, monthlyFeeLate: 250 },
    'Laura Nascimento': { monthlyFeeOnTime: 179, monthlyFeeLate: 250 },
    'Laura Parente Nascimento': { monthlyFeeOnTime: 179, monthlyFeeLate: 250 },
    'João Miguel': { monthlyFeeOnTime: 0, monthlyFeeLate: 0, isScholarship: true },
    'João Miguel Cunha do Santo': { monthlyFeeOnTime: 0, monthlyFeeLate: 0, isScholarship: true },
};

function getDaysDifference(dateAStr, dateBStr) {
    const [yA, mA, dA] = dateAStr.split('-').map(Number);
    const [yB, mB, dB] = dateBStr.split('-').map(Number);
    const dateA = new Date(yA, mA - 1, dA, 12, 0, 0);
    const dateB = new Date(yB, mB - 1, dB, 12, 0, 0);
    const diffTime = dateA.getTime() - dateB.getTime();
    return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

function getLocalDateString() {
    const d = new Date();
    const options = { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'America/Rio_Branco' };
    const parts = new Intl.DateTimeFormat('pt-BR', options).formatToParts(d);
    const year = parts.find(p => p.type === 'year').value;
    const month = parts.find(p => p.type === 'month').value;
    const day = parts.find(p => p.type === 'day').value;
    return `${year}-${month}-${day}`;
}

function getPaymentStatus(dueDateStr, referenceDateStr) {
    const diffDays = getDaysDifference(dueDateStr, referenceDateStr);
    if (diffDays === 0) return 'due_today';
    if (diffDays > 0) return 'on_time';
    return 'overdue';
}

function calculatePaymentDetails(payment, studentName) {
    const dailyRate = INTEREST_RATE_DAILY;
    const sName = studentName || payment.studentName || '';
    let referenceDateStr = getLocalDateString();

    if (payment.status === 'paid' && payment.paid_at) {
        const pDate = new Date(payment.paid_at);
        referenceDateStr = pDate.toISOString().split('T')[0];
    }

    const dueDateStr = payment.due_date;
    const policy = STUDENT_POLICIES[sName];
    const detailedStatus = getPaymentStatus(dueDateStr, referenceDateStr);

    if (policy?.isScholarship) {
        return { ...payment, status: payment.status === 'paid' ? 'paid' : 'pending', calculatedAmount: 0, interest: 0, daysOverdue: 0, amount: 0 };
    }

    if (detailedStatus !== 'overdue') {
        let effectiveAmount = payment.amount;
        if (policy) effectiveAmount = policy.monthlyFeeOnTime;
        return { ...payment, status: payment.status === 'paid' ? 'paid' : 'pending', calculatedAmount: effectiveAmount, interest: 0, daysOverdue: 0 };
    }

    const baseAmount = policy ? policy.monthlyFeeLate : payment.amount;
    const overdueDays = getDaysDifference(referenceDateStr, dueDateStr);

    if (payment.interest_waived) {
        return { ...payment, status: payment.status === 'paid' ? 'paid' : 'overdue', calculatedAmount: baseAmount, interest: 0, daysOverdue: Math.max(0, overdueDays), amount: baseAmount };
    }

    const actualOverdueDays = Math.max(0, overdueDays);
    const totalInterest = baseAmount * (dailyRate * actualOverdueDays);
    const totalAmount = baseAmount + totalInterest;

    return { ...payment, status: payment.status === 'paid' ? 'paid' : 'overdue', calculatedAmount: totalAmount, amount: baseAmount, interest: totalInterest, daysOverdue: actualOverdueDays };
}

async function runRevenueAnalysis() {
    console.log('--- RELATÓRIO DE FATURAMENTO RISE UP ---');

    const { data: students } = await supabase.from('students').select('*');
    const { data: payments } = await supabase.from('payments').select('*');

    const processedPayments = payments.map(p => {
        const student = students.find(s => s.id === p.student_id);
        return calculatePaymentDetails(p, student?.name);
    });

    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    const paidThisMonth = processedPayments.filter(p => {
        if (p.status !== 'paid' || !p.paid_at) return false;
        const paidDate = new Date(p.paid_at);
        return paidDate.getMonth() === currentMonth && paidDate.getFullYear() === currentYear;
    });

    const revenueThisMonth = paidThisMonth.reduce((acc, curr) => acc + (curr.calculatedAmount || curr.amount || 0), 0);

    const overduePayments = processedPayments.filter(p => p.status === 'overdue');
    const totalOverdue = overduePayments.reduce((acc, curr) => acc + (curr.calculatedAmount || 0), 0);

    const pendingPayments = processedPayments.filter(p => p.status === 'pending');
    const totalPending = pendingPayments.reduce((acc, curr) => acc + (curr.calculatedAmount || curr.amount || 0), 0);

    // Janeiro 2026 (Mês anterior)
    const paidInJanuary = processedPayments.filter(p => {
        if (p.status !== 'paid' || !p.paid_at) return false;
        const paidDate = new Date(p.paid_at);
        return paidDate.getMonth() === 0 && paidDate.getFullYear() === 2026;
    });

    const revenueJanuary = paidInJanuary.reduce((acc, curr) => acc + (curr.calculatedAmount || curr.amount || 0), 0);

    console.log(`✅ Faturamento de JANEIRO/2026: R$ ${revenueJanuary.toFixed(2)}`);
    console.log(`💰 Faturamento de FEVEREIRO/2026: R$ ${revenueThisMonth.toFixed(2)}`);
    console.log(`🔴 Dívidas Totais (Atrasados): R$ ${totalOverdue.toFixed(2)}`);
    console.log(`⏳ Pendentes Totais (À vencer): R$ ${totalPending.toFixed(2)}`);
    console.log(`📈 Projeção Total (Ciclo Atual): R$ ${(revenueThisMonth + totalOverdue + totalPending).toFixed(2)}`);

    process.exit(0);
}

runRevenueAnalysis().catch(err => {
    console.error(err);
    process.exit(1);
});
