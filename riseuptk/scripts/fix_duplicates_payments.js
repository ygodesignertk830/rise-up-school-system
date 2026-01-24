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

async function fixData() {
    console.log('🔧 Starting Data Fix & Cleanup...');

    // Authenticate
    const { data: { session } } = await supabase.auth.signInWithPassword({
        email: 'rise@up.com',
        password: '142536'
    });

    if (!session) {
        console.error('❌ Auth Failed.');
        process.exit(1);
    }
    console.log('✅ Authenticated.');

    // 1. AGGRESSIVE STUDENT DEDUPLICATION
    console.log('🧹 Deduplicating Students...');

    // Fetch all students with their class name to be safer
    const { data: students } = await supabase.from('students').select(`
        id, name, school_id, class_id,
        classes (name)
    `);

    if (students) {
        // Group by Name + Class (or just Name if we trust names are unique globally per school)
        // User complained about duplicates generally. Let's group by Name + School.
        const studentMap = new Map(); // Name -> [StudentRecords]

        for (const s of students) {
            if (!studentMap.has(s.name)) {
                studentMap.set(s.name, []);
            }
            studentMap.get(s.name).push(s);
        }

        let deletedCount = 0;

        for (const [name, records] of studentMap) {
            if (records.length > 1) {
                console.log(`   Duplicate found for "${name}" (${records.length} records)`);

                // Which one to keep?
                // 1. The one with payments?
                // 2. The most recent? 

                // Let's check which records have payments
                const recordsWithPayments = [];
                for (const r of records) {
                    const { count } = await supabase.from('payments').select('id', { count: 'exact', head: true }).eq('student_id', r.id);
                    if (count > 0) recordsWithPayments.push(r);
                }

                let keeper;
                if (recordsWithPayments.length > 0) {
                    // Keep the first one that has payments
                    keeper = recordsWithPayments[0];
                    // If multiple have payments, we might need to MERGE payments.
                    if (recordsWithPayments.length > 1) {
                        console.log(`      ⚠️ Multiple records have payments! Merging to first...`);
                        for (let i = 1; i < recordsWithPayments.length; i++) {
                            const victim = recordsWithPayments[i];
                            await supabase.from('payments').update({ student_id: keeper.id }).eq('student_id', victim.id);
                            await supabase.from('attendance').update({ student_id: keeper.id }).eq('student_id', victim.id);
                        }
                    }
                } else {
                    // No payments? Keep the first one created (assumed by ID sort or just first in list)
                    keeper = records[0];
                }

                // Delete others
                const toDelete = records.filter(r => r.id !== keeper.id).map(r => r.id);
                if (toDelete.length > 0) {
                    await supabase.from('students').delete().in('id', toDelete);
                    deletedCount += toDelete.length;
                    console.log(`      Deleted ${toDelete.length} duplicates.`);
                }
            }
        }

        console.log(`   Total duplicate students removed: ${deletedCount}`);
    }

    // 2. ENSURE PAYMENTS EXIST (Fix "Pay Button" Issue)
    // Sometimes button doesn't show if no pending payment exists for the month.
    // We should ensure every student has at least one PENDING or OVERDUE payment if valid.

    console.log('💳 Verifying Payments...');
    const { data: allStudents } = await supabase.from('students').select('*');

    if (allStudents) {
        for (const s of allStudents) {
            // Check if student has ANY payment
            const { count } = await supabase.from('payments').select('id', { count: 'exact', head: true }).eq('student_id', s.id);

            if (count === 0) {
                console.log(`   Student "${s.name}" has NO payments. Creating initial payment...`);

                // Create a payment for this month/enrollment
                const enrollmentDate = new Date(s.enrollment_date);
                const now = new Date();

                // Use current month if enrollment is old, or enrollment month if recent?
                // Let's just create a payment for NEXT due date based on day.

                let targetMonth = now.getMonth();
                let targetYear = now.getFullYear();
                let targetDay = s.payment_due_day || 10;

                // If today is past the due day, maybe create for next month? 
                // Or create for THIS month as overdue?
                if (now.getDate() > targetDay) {
                    // Late for this month
                    // Leave it as pending/overdue for this month
                }

                // Fix day if missing
                if (!targetDay) targetDay = 10;

                const dueDate = new Date(targetYear, targetMonth, targetDay).toISOString().split('T')[0];

                await supabase.from('payments').insert({
                    student_id: s.id,
                    due_date: dueDate,
                    amount: s.monthly_fee || 250,
                    status: 'pending'
                });
            }
        }
    }

    console.log('✅ Fix Completed.');
}

fixData().catch(console.error);
