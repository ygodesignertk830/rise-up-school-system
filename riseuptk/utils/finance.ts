import { Payment } from '../types';

export const INTEREST_RATE_DAILY = 0.004; // 0.4% ao dia

// upcoming removido como status oficial financeiro, UI pode derivar se quiser
export type PaymentDetailedStatus = 'on_time' | 'due_today' | 'overdue' | 'paid';

/**
 * Calcula a diferença real de dias entre duas strings YYYY-MM-DD.
 * Usa normalização de meio-dia (12:00) e arredondamento para ser imune a mudanças de Fuso Horário/Horário de Verão (DST).
 */
export const getDaysDifference = (dateAStr: string, dateBStr: string): number => {
  const [yA, mA, dA] = dateAStr.split('-').map(Number);
  const [yB, mB, dB] = dateBStr.split('-').map(Number);

  const dateA = new Date(yA, mA - 1, dA, 12, 0, 0);
  const dateB = new Date(yB, mB - 1, dB, 12, 0, 0);

  const diffTime = dateA.getTime() - dateB.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
};

/**
 * LÓGICA SÊNIOR DEFINITIVA (Math-Based):
 * Diff = DueDate - Today
 * > 3: on_time (Verde)
 * 1..3: upcoming (Amarelo)
 * 0: due_today (Amarelo)
 * < 0: overdue (Vermelho + Juros)
 */
export const getPaymentStatus = (dueDateStr: string, referenceDateStr: string): PaymentDetailedStatus => {
  // OBS: getDaysDifference retorna (Data1 - Data2).
  // Se quisermos (Vencimento - Hoje), temos que passar (dueDate, today).
  // Se dueDate >= referenceDate (diff >= 0): Em Dia (on_time) ou Vence Hoje (due_today)
  // Se dueDate < referenceDate (diff < 0): Atrasado (overdue)
  const diffDays = getDaysDifference(dueDateStr, referenceDateStr);

  // Nova Lógica Simplificada Acre (Sem janela de 3 dias)
  if (diffDays === 0) return 'due_today';

  // Qualquer dia futuro (1, 2, 3, 30...) é 'on_time' (Em Dia)
  // A UI pode decidir se quer mostrar "Vence em X dias", mas o status financeiro é VERDE.
  if (diffDays > 0) return 'on_time';

  return 'overdue';
};

/**
 * Verifica se uma data é hoje ou no futuro (Previne datas retroativas)
 */
export const isFutureDate = (dateStr: string): boolean => {
  const [y, m, d] = dateStr.split('-').map(Number);
  const target = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return target >= today;
};

// Retorna a data de hoje no formato YYYY-MM-DD baseada no Fuso Horário do Acre (GMT-5)
export const getLocalDateString = () => {
  // Cria uma data usando o deslocamento do Acre (UTC-5)
  // America/Rio_Branco é o fuso correto
  const d = new Date();

  // Opções para garantir o fuso correto
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'America/Rio_Branco'
  };

  const formatter = new Intl.DateTimeFormat('pt-BR', options);
  const parts = formatter.formatToParts(d);

  // Reconstruct in YYYY-MM-DD
  const year = parts.find(p => p.type === 'year')?.value;
  const month = parts.find(p => p.type === 'month')?.value;
  const day = parts.find(p => p.type === 'day')?.value;

  return `${year}-${month}-${day}`;
};

// Política de Preços Especiais (Senior Programmer Logic)
export interface PricingPolicy {
  monthlyFeeOnTime: number;
  monthlyFeeLate: number;
  isScholarship?: boolean;
}

export const STUDENT_POLICIES: Record<string, PricingPolicy> = {
  'Islayne Caxias': { monthlyFeeOnTime: 179, monthlyFeeLate: 250 },
  'Islayne Caxias da Silva': { monthlyFeeOnTime: 179, monthlyFeeLate: 250 },
  'Islainy Caxias da Silva': { monthlyFeeOnTime: 179, monthlyFeeLate: 250 },
  'Laura Nascimento': { monthlyFeeOnTime: 179, monthlyFeeLate: 250 },
  'Laura Parente Nascimento': { monthlyFeeOnTime: 179, monthlyFeeLate: 250 },
  'João Miguel': { monthlyFeeOnTime: 0, monthlyFeeLate: 0, isScholarship: true },
  'João Miguel Cunha do Santo': { monthlyFeeOnTime: 0, monthlyFeeLate: 0, isScholarship: true },
};

// Retorna data futura (Hoje + X dias)
export const getFutureDateString = (daysToAdd: number) => {
  const d = new Date();
  d.setDate(d.getDate() + daysToAdd);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Formata YYYY-MM-DD para DD/MM/YYYY puramente via string
export const formatDate = (dateString: string) => {
  if (!dateString) return '-';
  const parts = dateString.split('-');
  if (parts.length !== 3) return dateString;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
};

export const calculatePaymentDetails = (payment: Payment, customInterestRate?: number, studentName?: string): Payment => {
  const dailyRate = customInterestRate !== undefined ? customInterestRate : INTEREST_RATE_DAILY;
  const sName = studentName || payment.studentName || '';
  // Define a data de referência (hoje ou data de pagamento se já estiver pago)
  let referenceDateStr = getLocalDateString();

  if (payment.status === 'paid' && payment.paid_at) {
    const pDate = new Date(payment.paid_at);
    const year = pDate.getFullYear();
    const month = String(pDate.getMonth() + 1).padStart(2, '0');
    const day = String(pDate.getDate()).padStart(2, '0');
    referenceDateStr = `${year}-${month}-${day}`;
  }

  const dueDateStr = payment.due_date;
  const policy = STUDENT_POLICIES[sName];
  const detailedStatus = getPaymentStatus(dueDateStr, referenceDateStr);

  // 1. REGRA: Se for bolsista 100%, o valor é SEMPRE zero
  if (policy?.isScholarship) {
    return {
      ...payment,
      status: payment.status === 'paid' ? 'paid' : 'pending',
      calculatedAmount: 0,
      interest: 0,
      daysOverdue: 0,
      amount: 0
    };
  }

  // 2. REGRA EM DIA OU ALERTA OU VENCIMENTO HOJE (Sem juros)
  if (detailedStatus !== 'overdue') {
    let effectiveAmount = payment.amount;

    // Se estiver em dia (on_time, upcoming ou hoje), aplica o valor promocional
    if (policy) {
      effectiveAmount = policy.monthlyFeeOnTime;
    }

    return {
      ...payment,
      status: payment.status === 'paid' ? 'paid' : 'pending',
      calculatedAmount: effectiveAmount,
      interest: 0,
      daysOverdue: 0,
    };
  }

  // 3. REGRA ATRASO (OVERDUE)
  // Se houver política especial, o valor base para cálculo de juros vira o valor nominal (250)
  const baseAmount = policy ? policy.monthlyFeeLate : payment.amount;

  // Recalculating diff for interest context (RefDate - DueDate for positive overdue days)
  // If getPaymentStatus says overdue, it means DueDate < RefDate (diffDays negative in getPaymentStatus)
  // Let's rely on getDaysDifference logic.
  // getDaysDifference(DateA, DateB) -> A - B.
  // We want Overdue Days = RefDate - DueDate.
  const overdueDays = getDaysDifference(referenceDateStr, dueDateStr);

  // Lógica de Juros Perdoados
  if (payment.interest_waived) {
    return {
      ...payment,
      status: payment.status === 'paid' ? 'paid' : 'overdue',
      calculatedAmount: baseAmount,
      interest: 0,
      daysOverdue: Math.max(0, overdueDays),
      amount: baseAmount
    };
  }

  // Cálculo: % por dia de atraso
  // Se overdueDays <= 0 (por segurança), juros é 0.
  const actualOverdueDays = Math.max(0, overdueDays);
  const totalInterest = baseAmount * (dailyRate * actualOverdueDays);
  const totalAmount = baseAmount + totalInterest;

  return {
    ...payment,
    status: payment.status === 'paid' ? 'paid' : 'overdue',
    calculatedAmount: totalAmount,
    amount: baseAmount,
    interest: totalInterest,
    daysOverdue: actualOverdueDays,
  };
};

export const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

// --- LÓGICA SÊNIOR DE DATAS ---
// Função auxiliar para calcular data exata no próximo mês
export const calculateNextMonthSameDay = (dateStr: string) => {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-').map(Number);

  // Cria data em UTC para evitar problemas de fuso
  const date = new Date(year, month - 1, day);

  // Adiciona 1 mês
  date.setMonth(date.getMonth() + 1);

  // Ajuste para dias que não existem (ex: 31 Jan -> 28/29 Fev)
  // Se o dia mudou (ex: era 31 e virou 1, 2...), volta para o último dia do mês anterior
  if (date.getDate() !== day) {
    date.setDate(0);
  }

  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');

  return `${y}-${m}-${d}`;
};