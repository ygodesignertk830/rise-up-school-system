import { Class, Payment, School, Student } from '../types';

export const SCHOOL_DATA: School = {
  id: '1',
  name: 'Rise UP English School',
  slug: 'rise-up',
  active: true,
};

export const CLASSES_DATA: Class[] = [
  {
    id: 'c1',
    school_id: '1',
    name: 'Storyland',
    teacher: 'Rosi Oliveira',
    schedule: '10h00-11h30 (Seg/Qua)',
    room: 'B',
    color: 'bg-pink-100 text-pink-800 border-pink-200',
  },
  {
    id: 'c2',
    school_id: '1',
    name: 'My Disney Stars and Heroes (Starter)',
    teacher: 'Thiago Botelho',
    schedule: '10h00-11h30 (Seg/Qua)',
    room: 'A',
    color: 'bg-blue-100 text-blue-800 border-blue-200',
  },
  {
    id: 'c3',
    school_id: '1',
    name: 'My Disney Stars and Heroes – Level 1',
    teacher: 'Thiago Botelho',
    schedule: '13h00-14h30 (Seg/Qua)',
    room: 'A',
    color: 'bg-purple-100 text-purple-800 border-purple-200',
  },
  {
    id: 'c4',
    school_id: '1',
    name: 'New iLearn',
    teacher: 'Thiago Botelho',
    schedule: '13h00-14h30 (Ter/Qui)',
    room: 'C',
    color: 'bg-green-100 text-green-800 border-green-200',
  },
];

// Helper to create students
const createStudent = (id: string, classId: string, name: string): Student => ({
  id,
  school_id: '1',
  class_id: classId,
  name,
  monthly_fee: 150.00,
  payment_due_day: 10, // Default due day
  enrollment_date: '2024-02-01',
  status: 'active',
  photo_url: undefined, 
});

export const STUDENTS_DATA: Student[] = [
  // TURMA 1
  createStudent('s101', 'c1', 'Betina Bràz'),
  createStudent('s102', 'c1', 'Rhanã Arcênio'),
  createStudent('s103', 'c1', 'Cecilia Eleamen'),
  createStudent('s104', 'c1', 'Joaquim Prado'),
  createStudent('s105', 'c1', 'Glória Maria'),
  // TURMA 2
  createStudent('s201', 'c2', 'Benício Bràz'),
  createStudent('s202', 'c2', 'Joaquim Teixeira'),
  createStudent('s203', 'c2', 'Heitor Pessoa'),
  createStudent('s204', 'c2', 'Laura Nascimento'),
  createStudent('s205', 'c2', 'Sophia Barros'),
  // TURMA 3
  createStudent('s301', 'c3', 'Belisa Bierbach'),
  createStudent('s302', 'c3', 'Astrid Bierbach'),
  createStudent('s303', 'c3', 'Clara Tomio'),
  createStudent('s304', 'c3', 'Yasmim Arcênio'),
  createStudent('s305', 'c3', 'Isa Aragão'),
  createStudent('s306', 'c3', 'Isa Piauhy'),
  createStudent('s307', 'c3', 'Sofia Borges'),
  createStudent('s308', 'c3', 'Alzira Aciolly'),
  createStudent('s309', 'c3', 'Malu Prado'),
  createStudent('s310', 'c3', 'Lívia Garbin'),
  // TURMA 4
  createStudent('s401', 'c4', 'Alderico Estevão'),
  createStudent('s402', 'c4', 'Islayne Caxias'),
  createStudent('s403', 'c4', 'Isabele Franklin'),
  createStudent('s404', 'c4', 'João Miguel'),
  createStudent('s405', 'c4', 'Kácio Samuel'),
  createStudent('s406', 'c4', 'Luan Barros'),
];

// Generate some mock payments
const today = new Date();
const currentMonth = today.getMonth();
const currentYear = today.getFullYear();

export const PAYMENTS_DATA: Payment[] = STUDENTS_DATA.flatMap((student) => {
  const payments: Payment[] = [];
  
  // Past Month (Overdue if not paid)
  const pastDueDate = new Date(currentYear, currentMonth - 1, 10).toISOString().split('T')[0];
  const isPaidPast = Math.random() > 0.3; // 70% paid
  payments.push({
    id: `p-${student.id}-past`,
    student_id: student.id,
    due_date: pastDueDate,
    amount: student.monthly_fee,
    status: isPaidPast ? 'paid' : 'overdue',
    paid_at: isPaidPast ? new Date(currentYear, currentMonth - 1, 9).toISOString().split('T')[0] : undefined,
  });

  // Current Month (Pending or Paid)
  const currentDueDate = new Date(currentYear, currentMonth, 10).toISOString().split('T')[0];
  const isPaidCurrent = Math.random() > 0.8; // 20% paid early
  payments.push({
    id: `p-${student.id}-curr`,
    student_id: student.id,
    due_date: currentDueDate,
    amount: student.monthly_fee,
    status: isPaidCurrent ? 'paid' : 'pending',
    paid_at: isPaidCurrent ? new Date(currentYear, currentMonth, 5).toISOString().split('T')[0] : undefined,
  });

  return payments;
});