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

// DATA FROM USER REQUEST
const DATA = {
    teachers: [
        { name: 'Rosi Oliveira', active: true },
        { name: 'Thiago Botelho', active: true }
    ],
    classes: [
        {
            name: 'Storyland',
            teacher: 'Rosi Oliveira',
            schedule: 'Seg/Qua 10h00 às 11h30',
            room: 'B',
            color: 'bg-pink-600',
            students: ['Betina Bràz', 'Rhanã Arcênio', 'Cecilia Eleamen', 'Joaquim Prado', 'Glória Maria']
        },
        {
            name: 'My Disney Stars and Heroes (Starter)',
            teacher: 'Thiago Botelho',
            schedule: 'Seg/Qua 10h00 às 11h30',
            room: 'A',
            color: 'bg-blue-600',
            students: ['Benício Bràz', 'Joaquim Teixeira', 'Heitor Pessoa', 'Laura Nascimento', 'Sophia Barros']
        },
        {
            name: 'My Disney Stars and Heroes – Level 1',
            teacher: 'Thiago Botelho',
            schedule: 'Seg/Qua 13h00 às 14h30',
            room: 'A',
            color: 'bg-purple-600',
            students: ['Belisa Bierbach', 'Astrid Bierbach', 'Clara Tomio', 'Yasmim Arcênio', 'Isa Aragão', 'Isa Piauhy', 'Sofia Borges', 'Alzira Aciolly', 'Malu Prado', 'Lívia Garbin']
        },
        {
            name: 'New iLearn',
            teacher: 'Thiago Botelho',
            schedule: 'Ter/Qui 13h00 às 14h30',
            room: 'A',
            color: 'bg-emerald-600',
            students: ['Alderico Estevão', 'Islayne Caxias', 'Isabele Franklin', 'João Miguel', 'Kácio Samuel', 'Luan Barros']
        }
    ]
};

async function getAuthSession() {
    const email = 'admin@escola.br'; // Using the specific email user mentioned
    const password = 'seed_password_123'; // Logic to ensure this user exists or Login

    // Try Sign In
    const { data: signInData } = await supabase.auth.signInWithPassword({ email, password });
    if (signInData.session) return signInData.session;

    // Try Sign Up
    const { data: signUpData } = await supabase.auth.signUp({ email, password });
    if (signUpData.session) return signUpData.session;

    // Fallback: Use generic seed admin if specific one fails (e.g. password mismatch)
    const { data: fallbackData } = await supabase.auth.signInWithPassword({ email: 'seed_admin@riseup.com', password: 'seed_password_123' });
    return fallbackData.session;
}

async function seed() {
    console.log('🌱 Starting Force Seed...');

    const session = await getAuthSession();
    if (!session) {
        console.error('❌ Authentication failed. Cannot upsert data.');
        process.exit(1);
    }
    console.log(`✅ Authenticated.`);

    // 1. Get School (Ensure "Rise UP School" exists)
    let schoolId;
    const { data: schools } = await supabase.from('schools').select('id').eq('slug', 'rise-up-school').maybeSingle();

    if (schools) {
        schoolId = schools.id;
        // Ensure owner_email is set to what user wants if possible, or just log
        await supabase.from('schools').update({ owner_email: 'admin@escola.br' }).eq('id', schoolId);
    } else {
        const { data: newSchool } = await supabase.from('schools').insert({
            name: 'Rise UP School',
            slug: 'rise-up-school',
            active: true,
            owner_email: 'admin@escola.br'
        }).select().single();
        schoolId = newSchool.id;
    }
    console.log(`✅ Target School ID: ${schoolId}`);

    // Update User to point to this school
    await supabase.from('users').update({ school_id: schoolId }).eq('id', session.user.id);

    // 2. Upsert Teachers
    for (const t of DATA.teachers) {
        // Upsert by school_id + name ideally, but we don't have unique constraint there.
        // We act smart: check if exists, if not insert.
        const { data: existing } = await supabase.from('teachers').select('id').eq('school_id', schoolId).eq('name', t.name).maybeSingle();
        if (!existing) {
            await supabase.from('teachers').insert({ ...t, school_id: schoolId });
            console.log(`   + Teacher: ${t.name}`);
        }
    }

    // 3. Upsert Classes & Students
    for (const cls of DATA.classes) {
        let classId;
        const { data: existingClass } = await supabase.from('classes').select('id')
            .eq('school_id', schoolId)
            .eq('name', cls.name)
            .maybeSingle();

        if (existingClass) {
            classId = existingClass.id;
            // Update details just in case
            await supabase.from('classes').update({
                teacher: cls.teacher,
                schedule: cls.schedule,
                room: cls.room,
                color: cls.color
            }).eq('id', classId);
            console.log(`   . Updated Class: ${cls.name}`);
        } else {
            const { data: newClass } = await supabase.from('classes').insert({
                school_id: schoolId,
                name: cls.name,
                teacher: cls.teacher,
                schedule: cls.schedule,
                room: cls.room,
                color: cls.color
            }).select().single();
            classId = newClass.id;
            console.log(`   + Created Class: ${cls.name}`);
        }

        // Students
        for (const sName of cls.students) {
            // Check existence
            const { data: existingStudent } = await supabase.from('students').select('id')
                .eq('school_id', schoolId)
                .eq('name', sName)
                .maybeSingle();

            if (!existingStudent) {
                await supabase.from('students').insert({
                    school_id: schoolId,
                    class_id: classId,
                    name: sName,
                    status: 'active',
                    monthly_fee: 0,
                    payment_due_day: 10
                });
                console.log(`      + Student: ${sName}`);
            } else {
                // Ensure class link is correct (move student if needed)
                await supabase.from('students').update({ class_id: classId }).eq('id', existingStudent.id);
            }
        }
    }
    console.log('✅ Force Seed Completed.');
}

seed().catch(console.error);
