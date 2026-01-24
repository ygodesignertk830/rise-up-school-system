export interface School {
  id: string;
  name: string;
  slug: string;
  logo_url?: string;
  active: boolean; // Se false, bloqueia o acesso da escola
  // Campos SaaS (Dono do Software -> Escola)
  subscription_fee?: number; // Valor que a escola paga pelo sistema
  subscription_due_date?: string; // Data exata do vencimento da fatura atual (YYYY-MM-DD)
  last_payment_date?: string; // Controle simples de último pagamento
  owner_email?: string; // Email do responsável (usado para vincular o usuário)
  owner_phone?: string;
  daily_interest_rate?: number; // Taxa de juros personalizada (ex: 0.004)
}

export type UserRole = 'super_admin' | 'school_admin';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  school_id: string | null; // Super admin pode não ter escola
}

export interface Class {
  id: string;
  school_id: string;
  name: string;
  teacher: string;
  schedule: string;
  room: string;
  color: string;
}

export type StudentStatus = 'active' | 'inactive';

export interface Student {
  id: string;
  school_id: string;
  class_id: string;
  name: string;
  monthly_fee: number;
  payment_due_day: number; // Dia de vencimento preferencial (ex: 10)
  enrollment_date: string;
  photo_url?: string;
  status: StudentStatus;
  // Computed for UI convenience
  className?: string;
  teacherName?: string;
}

export type PaymentStatus = 'paid' | 'pending' | 'overdue';

export interface Payment {
  id: string;
  student_id: string;
  due_date: string;
  amount: number;
  status: PaymentStatus;
  paid_at?: string;
  interest_waived?: boolean; // Indicates if debt/interest was forgiven
  // UI helpers
  studentName?: string;
  className?: string;
  calculatedAmount?: number;
  interest?: number;
  daysOverdue?: number;
}

export interface Teacher {
  id: string;
  school_id: string;
  name: string;
  email?: string;
  phone?: string;
  specialty?: string;
  active: boolean;
}

export interface Attendance {
  id: string;
  school_id: string;
  class_id: string;
  student_id: string;
  date: string;
  present: boolean;
  notes?: string;
  studentName?: string; // Helper for UI
}

export interface LessonContent {
  id: string;
  school_id: string;
  class_id: string;
  date: string;
  content: string;
}

export interface AuthorizedAccess {
  id: string;
  email: string;
  school_id: string;
  role: UserRole;
  created_at: string;
  schools?: {
    name: string;
  };
}