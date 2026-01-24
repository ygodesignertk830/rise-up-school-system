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

async function runUpdate() {
    console.log('🚀 Final Financial Infrastructure Adjustment (Senior Mode)...');

    // 1. Auth
    const { data: { session } } = await supabase.auth.signInWithPassword({
        email: 'rise@up.com',
        password: '142536'
    });

    if (!session) {
        console.error('❌ Authentication failed.');
        process.exit(1);
    }
    console.log('✅ Authenticated.');

    const updates = [
        { name: 'Islayne Caxias', targetFee: 250 },
        { name: 'Laura Nascimento', targetFee: 250 },
        { name: 'João Miguel', targetFee: 0 }
    ];

    for (const item of updates) {
        console.log(`\n👨‍🎓 Processing Student: ${item.name}`);

        // A. Find Student
        const { data: student, error: searchError } = await supabase
            .from('students')
            .select('id, monthly_fee')
            .eq('name', item.name)
            .single();

        if (searchError || !student) {
            console.warn(`   ⚠️ Student not found. Skipping.`);
            continue;
        }

        // B. Update Student Monthly Fee
        const { error: updateStudentError } = await supabase
            .from('students')
            .update({ monthly_fee: item.targetFee })
            .eq('id', student.id);

        if (updateStudentError) {
            console.error(`   ❌ Failed to update student fee:`, updateStudentError);
        } else {
            console.log(`   ✅ Base monthly fee updated to R$ ${item.targetFee}`);
        }

        // C. Update Pending Payments to the new Base Amount
        const { data: pendingPayments } = await supabase
            .from('payments')
            .select('id, amount')
            .eq('student_id', student.id)
            .eq('status', 'pending');

        if (pendingPayments && pendingPayments.length > 0) {
            console.log(`   📝 Found ${pendingPayments.length} pending payments. Correcting base amount...`);
            for (const p of pendingPayments) {
                const { error: pErr } = await supabase
                    .from('payments')
                    .update({ amount: item.targetFee })
                    .eq('id', p.id);

                if (pErr) console.error(`      ❌ Payment ${p.id} update failed:`, pErr);
                else console.log(`      ✅ Payment ${p.id} updated to R$ ${item.targetFee}`);
            }
        } else {
            console.log(`   ℹ️ No pending payments to update.`);
        }
    }

    console.log('\n✨ All adjustments completed successfully.');
}

runUpdate().catch(console.error);
