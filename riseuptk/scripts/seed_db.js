import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 1. Load Env Vars manually since dotenv might not be present
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

const DATA = {
    teachers: [
        { name: 'Rosi Oliveira' },
        { name: 'Thiago Botelho' }
    ],
    classes: [
        {
            name: 'Storyland',
            teacher: 'Rosi Oliveira',
            schedule: 'Seg/Qua 10h00-11h30',
            room: 'B',
            color: 'bg-pink-600',
            students: ['Betina Bràz', 'Rhanã Arcênio', 'Cecilia Eleamen', 'Joaquim Prado', 'Glória Maria']
        },
        {
            name: 'My Disney Stars and Heroes (Starter)',
            teacher: 'Thiago Botelho',
            schedule: 'Seg/Qua 10h00-11h30',
            room: 'A',
            color: 'bg-blue-600',
            students: ['Benício Bràz', 'Joaquim Teixeira', 'Heitor Pessoa', 'Laura Nascimento', 'Sophia Barros']
        },
        {
            name: 'My Disney Stars and Heroes – Level 1',
            teacher: 'Thiago Botelho',
            schedule: 'Seg/Qua 13h00-14h30',
            room: 'A',
            color: 'bg-purple-600',
            students: ['Belisa Bierbach', 'Astrid Bierbach', 'Clara Tomio', 'Yasmim Arcênio', 'Isa Aragão', 'Isa Piauhy', 'Sofia Borges', 'Alzira Aciolly', 'Malu Prado', 'Lívia Garbin']
        },
        {
            name: 'New iLearn',
            teacher: 'Thiago Botelho',
            schedule: 'Ter/Qui 13h00-14h30',
            room: 'A',
            color: 'bg-emerald-600',
            students: ['Alderico Estevão', 'Islayne Caxias', 'Isabele Franklin', 'João Miguel', 'Kácio Samuel', 'Luan Barros']
        }
    ]
};

async function getAuthSession() {
    const email = 'seed_admin@riseup.com';
    const password = 'seed_password_123';

    // 1. Try Sign In
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInData.session) return signInData.session;

    // 2. If fail, Try Sign Up
    console.log('Creating temp admin user for seeding...');
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({ email, password });
    if (signUpData.session) return signUpData.session;

    console.warn('⚠️ Could not authenticate automatically. RLS policies might block inserts.');
    if (signUpError) console.error('Auth Error:', signUpError.message);
    return null;
}

async function seed() {
    console.log('🌱 Starting Seed...');

    // AUTHENTICATE
    const session = await getAuthSession();
    if (!session) {
        console.error('❌ Aborting: Authentication failed. Cannot bypass RLS.');
        process.exit(1);
    }
    console.log(`✅ Authenticated as ${session.user.email}`);

    // 1. Get or Create School
    let { data: schools } = await supabase.from('schools').select('id').limit(1);
    let schoolId;

    if (!schools || schools.length === 0) {
        console.log('Creating School...');
        const { data, error } = await supabase.from('schools').insert({ name: 'Rise UP School', slug: 'rise-up-school', active: true }).select().single();
        if (error) throw error;
        schoolId = data.id;
    } else {
        schoolId = schools[0].id;
    }
    console.log(`✅ School ID: ${schoolId}`);

    // 2. Teachers
    console.log('Processing Teachers...');
    for (const t of DATA.teachers) {
        // Check if exists
        const { data: existing } = await supabase.from('teachers').select('id').eq('name', t.name).eq('school_id', schoolId).maybeSingle();
        if (!existing) {
            const { error } = await supabase.from('teachers').insert({ ...t, school_id: schoolId });
            if (error) console.error(`   ❌ Error creating teacher ${t.name}:`, error.message);
            else console.log(`   + Created Teacher: ${t.name}`);
        } else {
            console.log(`   . Teacher exists: ${t.name}`);
        }
    }

    // 3. Classes & Students
    console.log('Processing Classes & Students...');
    for (const cls of DATA.classes) {
        // Find Teacher ID (Optional link, logically) - Schema uses text for teacher name in classes, but let's keep consistency
        // Note: The schema for 'classes' uses 'teacher' as TEXT name, not ID reference yet (legacy). 
        // We insert the TEXT name.

        let classId;
        const { data: existingClass } = await supabase.from('classes').select('id').eq('name', cls.name).eq('school_id', schoolId).maybeSingle();

        if (!existingClass) {
            const { data: newClass, error } = await supabase.from('classes').insert({
                school_id: schoolId,
                name: cls.name,
                teacher: cls.teacher,
                schedule: cls.schedule,
                room: cls.room,
                color: cls.color
            }).select().single();
            if (error) throw error;
            classId = newClass.id;
            console.log(`   + Created Class: ${cls.name}`);
        } else {
            classId = existingClass.id;
            console.log(`   . Class exists: ${cls.name}`);
        }

        // Students
        for (const studentName of cls.students) {
            const { data: existingStudent } = await supabase.from('students').select('id').eq('name', studentName).eq('school_id', schoolId).maybeSingle();
            if (!existingStudent) {
                const { error } = await supabase.from('students').insert({
                    school_id: schoolId,
                    class_id: classId,
                    name: studentName,
                    status: 'active',
                    monthly_fee: 0, // Default
                    payment_due_day: 10
                });
                if (error) console.error(`      ❌ Error creating student ${studentName}:`, error.message);
                else console.log(`      + Student: ${studentName}`);
            }
        }
    }

    console.log('✅ Seed Completed Successfully!');
}

seed().catch(e => {
    console.error('❌ Error Seeding:', e);
    process.exit(1);
});
