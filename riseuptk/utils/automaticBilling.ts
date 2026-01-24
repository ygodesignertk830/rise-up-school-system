import { SupabaseClient } from '@supabase/supabase-js';
import { Student, Payment } from '../types';
import { getLocalDateString } from './finance';

export const checkAndGenerateMonthlyFees = async (
    supabase: SupabaseClient,
    students: Student[],
    payments: Payment[]
) => {
    const today = new Date();
    const currentMonth = today.getMonth(); // 0-11
    const currentYear = today.getFullYear();

    const newPayments: Partial<Payment>[] = [];

    for (const student of students) {
        // 1. Skip inactive students
        if (student.status !== 'active') continue;

        // 2. Determine Due Day (default to 10 if missing)
        const dueDay = student.payment_due_day || 10;

        // 3. Check if payment exists for THIS month/year
        // We look for a payment where the due_date falls in the current month/year
        const hasPaymentThisMonth = payments.some(p => {
            if (p.student_id !== student.id) return false;

            // Convert yyyy-mm-dd to Date parts
            const [y, m, d] = p.due_date.split('-').map(Number);
            // Note: m is 1-12 in string, but Date uses 0-11.
            // We just compare raw values for safety
            return y === currentYear && (m - 1) === currentMonth;
        });

        if (hasPaymentThisMonth) continue;

        // 4. Create Payment if missing
        // Construct the Due Date: YYYY-MM-DD
        // Note: Month is 0-indexed in JS, so we need +1 for string.
        // If today is past the due day, maybe we should generate for next month? 
        // Requirement says: "generated automatically... with next due date".
        // For now, let's ensure the CURRENT month is generated even if late (it will just be overdue).
        const monthStr = String(currentMonth + 1).padStart(2, '0');
        const dayStr = String(dueDay).padStart(2, '0');
        const dueDate = `${currentYear}-${monthStr}-${dayStr}`;

        // 4.1 Check Enrollment Date Priority
        // If student enrolled AFTER the generated due date for this month, 
        // they shouldn't pay for this month (or it should be next month).
        if (student.enrollment_date && student.enrollment_date > dueDate) {
            console.log(`Skipping payment for ${student.name} (${dueDate}) - Enrolled after due date (${student.enrollment_date})`);
            continue;
        }

        console.log(`Generating Payment for ${student.name}: ${dueDate}`);

        newPayments.push({
            student_id: student.id,
            amount: student.monthly_fee || 250, // Default to 250 if not set
            due_date: dueDate,
            status: 'pending',
            interest: 0,
            daysOverdue: 0,
            interest_waived: false
        });
    }

    if (newPayments.length === 0) return;

    // 5. Batch Insert
    const { data, error } = await supabase
        .from('payments')
        .insert(newPayments)
        .select();

    if (error) {
        console.error('Error generating monthly fees:', error);
    } else {
        console.log(`Successfully generated ${data.length} monthly fees.`);
    }
};
