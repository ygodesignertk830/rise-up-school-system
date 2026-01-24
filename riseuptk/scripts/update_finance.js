import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 1. Load Env Vars
const envPath = path.resolve(__dirname, '../.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const envConfig = {};
envContent.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) {
        envConfig[key.trim()] = value.trim();
    }
});

const supabaseUrl = envConfig['VITE_SUPABASE_URL'];
const supabaseKey = envConfig['VITE_SUPABASE_ANON_KEY'];

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function updateFinance() {
    console.log('💰 Starting Financial Bulk Update...');

    // Authenticate (Need RLS access)
    const { data: { session } } = await supabase.auth.signInWithPassword({
        email: 'rise@up.com',
        password: '142536'
    });

    if (!session) {
        console.error('❌ Auth Failed. Cannot proceed.');
        process.exit(1);
    }
    console.log('✅ Authenticated as Admin.');

    // 1. Fetch All Students
    const { data: students, error } = await supabase.from('students').select('*');
    if (error) {
        console.error('❌ Error fetching students:', error);
        return;
    }

    console.log(`Processing ${students.length} students...`);

    for (const student of students) {
        // A. Set Monthly Fee to 250
        // B. Set Payment Due Day based on Enrollment Date (Day of Month)

        let enrollmentDate = new Date(student.enrollment_date);
        // Handle timezone offset simply by taking the UTC parts or splitting string "YYYY-MM-DD"
        // Better to split string to avoid timezone shifts
        const [year, month, day] = student.enrollment_date.split('-').map(Number);
        const dueDay = day; // The day of enrollment

        console.log(`   Student: ${student.name} | Set Fee: 250 | Due Day: ${dueDay}`);

        // Update Student
        await supabase.from('students').update({
            monthly_fee: 250,
            payment_due_day: dueDay
        }).eq('id', student.id);


        // C. Update Pending Payments
        // We need to find pending payments for this student and update their Amount and Due Date
        const { data: payments } = await supabase.from('payments')
            .select('*')
            .eq('student_id', student.id)
            .eq('status', 'pending');

        if (payments && payments.length > 0) {
            for (const payment of payments) {
                // Determine new due date: keep the month/year of the payment, but change the day
                const currentDueDate = new Date(payment.due_date);
                // Fix timezone issue by treating as UTC or splitting
                const [pYear, pMonth, pDay] = payment.due_date.split('-').map(Number);

                // Construct new date string YYYY-MM-DD
                // Note: Month is 1-indexed in split array
                const newDueDate = `${pYear}-${String(pMonth).padStart(2, '0')}-${String(dueDay).padStart(2, '0')}`;

                // Be careful with invalid dates (e.g. Feb 30). JS Date auto-corrects, but string won't.
                // Let's use JS Date to validate
                const dateTest = new Date(pYear, pMonth - 1, dueDay);
                const validatedDate = dateTest.toISOString().split('T')[0];

                console.log(`      > Updating Payment (${payment.id}) -> Amt: 250, Due: ${validatedDate}`);

                await supabase.from('payments').update({
                    amount: 250,
                    due_date: validatedDate
                }).eq('id', payment.id);
            }
        }
    }

    console.log('✅ Financial Update Completed.');
}

updateFinance().catch(console.error);
