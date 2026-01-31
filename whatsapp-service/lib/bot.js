import { supabase } from './supabase.js';

export const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    }).format(value);
};

export const formatDate = (dateString) => {
    if (!dateString) return '-';
    const parts = dateString.split('-');
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
};

export const getLocalDateString = () => {
    const d = new Date();
    const options = { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'America/Rio_Branco' };
    const parts = new Intl.DateTimeFormat('pt-BR', options).formatToParts(d);
    const year = parts.find(p => p.type === 'year').value;
    const month = parts.find(p => p.type === 'month').value;
    const day = parts.find(p => p.type === 'day').value;
    return `${year}-${month}-${day}`;
};

export async function getDuePayments() {
    const today = getLocalDateString();
    console.log(`🔍 [BOT] Verificando pagamentos para: ${today}`);

    // Busca todos os alunos ativos
    const { data: students, error: studentError } = await supabase
        .from('students')
        .select('*')
        .eq('status', 'active');

    if (studentError) throw studentError;
    console.log(`👥 [BOT] Alunos ativos: ${students?.length || 0}`);

    // Busca pagamentos pendentes
    const { data: payments, error: paymentError } = await supabase
        .from('payments')
        .select('*')
        .neq('status', 'paid');

    if (paymentError) throw paymentError;
    console.log(`💰 [BOT] Pagamentos pendentes: ${payments?.length || 0}`);

    const alerts = [];

    for (const student of students) {
        const studentPayments = payments.filter(p => p.student_id === student.id);

        for (const payment of studentPayments) {
            const diffDays = getDaysDifference(payment.due_date, today);

            let type = null;
            if (diffDays === 0) type = 'HOJE';
            else if (diffDays === 1) type = '2_DIAS';
            else if (diffDays === 2) type = '3_DIAS';
            else if (diffDays < 0) type = 'ATRASADO';

            if (type) {
                console.log(`🎯 [DEBUG] Alerta encontrado para ${student.name}:`, JSON.stringify(student));
                alerts.push({
                    student,
                    payment,
                    type,
                    diffDays: Math.abs(diffDays)
                });
            }
        }
    }

    return alerts;
}

function getDaysDifference(dateAStr, dateBStr) {
    const [yA, mA, dA] = dateAStr.split('-').map(Number);
    const [yB, mB, dB] = dateBStr.split('-').map(Number);
    const dateA = new Date(yA, mA - 1, dA, 12, 0, 0);
    const dateB = new Date(yB, mB - 1, dB, 12, 0, 0);
    return Math.round((dateA.getTime() - dateB.getTime()) / (1000 * 60 * 60 * 24));
}
