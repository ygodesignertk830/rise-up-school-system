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

async function getAuthSession() {
    // 1. Authenticate as the NEW Admin
    const email = 'rise@up.com';
    const password = '142536'; // User provided password

    console.log(`🔐 Authenticating as ${email}...`);

    // Try Sign In
    let { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInData.session) return signInData.session;

    // If fail (maybe user doesn't exist yet), Try Sign Up
    if (signInError && (signInError.message.includes('Invalid login') || signInError.status === 400)) {
        console.log('   User not found or pass wrong. Attempting to create...');
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({ email, password });
        if (signUpData.session) return signUpData.session;

        // If user exists but pass is wrong, we can't do much automatically without admin rights on backend.
        // But let's assume this is a fresh or specific request.
        if (signUpError) console.error('   ❌ Sign Up Error:', signUpError.message);
    }

    return null;
}

async function cleanup() {
    console.log('🧹 Starting Cleanup & Linking...');

    const session = await getAuthSession();
    if (!session) {
        console.error('❌ Failed to authenticate with rise@up.com. Cannot proceed with ownership transfer.');
        // We will continue cleanup though, assuming we can use Anon key for some things if RLS allows, 
        // BUT RLS likely blocks. We need a valid session.
        // Let's try to start with cleanup logic using what we have (maybe existing seed admin).
        // Actually, let's stop if we can't auth the specific user.
        process.exit(1);
    }
    console.log(`✅ Authenticated.`);

    // 1. Ensure "Rise UP School" is owned by this user
    let { data: schools } = await supabase.from('schools').select('*').limit(1); // Get any school to start
    let schoolId;

    if (schools && schools.length > 0) {
        // Find if there is a school named "Rise UP School"
        const specificSchool = schools.find(s => s.slug === 'rise-up-school' || s.name === 'Rise UP School');
        schoolId = specificSchool ? specificSchool.id : schools[0].id; // Fallback to first

        // Update Owner
        console.log(`🔗 Linking School (${schoolId}) to rise@up.com...`);
        const { error } = await supabase.from('schools').update({
            owner_email: 'rise@up.com',
            active: true
        }).eq('id', schoolId);

        if (error) console.error('   ❌ Error updating school:', error.message);
        else console.log('   ✅ School linked.');

        // Link User Table
        await supabase.from('users').upsert({
            id: session.user.id,
            email: 'rise@up.com',
            role: 'school_admin',
            school_id: schoolId
        });
    }

    if (!schoolId) {
        console.error("❌ No school found to clean.");
        return;
    }

    // 2. DEDUPLICATION LOGIC
    // Strategy: Identify valid unique keys, find all matching rows, keep first, delete others.

    // A. Clean Teachers
    console.log('🧹 Deduplicating Teachers...');
    const { data: teachers } = await supabase.from('teachers').select('id, name').eq('school_id', schoolId);
    if (teachers) {
        const uniqueNames = new Set();
        const toDelete = [];

        // Prefer keeping those with most recent ID, or just first seen? 
        // Actually, normally keep the oldest (first created) to avoid breaking relationships, 
        // BUT here we just re-inserted.
        // Let's keep the FIRST one we see, mark others for death.
        for (const t of teachers) {
            if (uniqueNames.has(t.name)) {
                toDelete.push(t.id);
            } else {
                uniqueNames.add(t.name);
            }
        }

        if (toDelete.length > 0) {
            console.log(`   Found ${toDelete.length} duplicate teachers. Deleting...`);
            await supabase.from('teachers').delete().in('id', toDelete);
        } else {
            console.log('   No duplicate teachers found.');
        }
    }

    // B. Clean Classes
    console.log('🧹 Deduplicating Classes...');
    const { data: classes } = await supabase.from('classes').select('id, name').eq('school_id', schoolId);
    if (classes) {
        const uniqueClasses = new Map(); // Name -> ID
        const classesToDelete = [];

        for (const c of classes) {
            if (uniqueClasses.has(c.name)) {
                // Duplicate found.
                // We must move students from this duplicate to the original before deleting!
                const originalId = uniqueClasses.get(c.name);
                const duplicateId = c.id;

                console.log(`   Merging class ${c.name} (${duplicateId} -> ${originalId})...`);
                // Move students
                await supabase.from('students').update({ class_id: originalId }).eq('class_id', duplicateId);
                // Move attendance? 
                await supabase.from('attendance').update({ class_id: originalId }).eq('class_id', duplicateId);

                classesToDelete.push(duplicateId);
            } else {
                uniqueClasses.set(c.name, c.id);
            }
        }

        if (classesToDelete.length > 0) {
            console.log(`   Deleting ${classesToDelete.length} empty duplicate classes...`);
            await supabase.from('classes').delete().in('id', classesToDelete);
        } else {
            console.log('   No duplicate classes found.');
        }
    }

    // C. Clean Students
    // Now that classes are merged, we might have duplicate students within the SAME class.
    console.log('🧹 Deduplicating Students...');
    // We need to fetch ALL students for this school
    const { data: students } = await supabase.from('students').select('id, name, class_id').eq('school_id', schoolId);

    if (students) {
        const seenStudents = new Set();
        const studentsToDelete = [];

        // Key: class_id + name
        for (const s of students) {
            const key = `${s.class_id}-${s.name}`;
            if (seenStudents.has(key)) {
                studentsToDelete.push(s.id);
            } else {
                seenStudents.add(key);
            }
        }

        if (studentsToDelete.length > 0) {
            console.log(`   Found ${studentsToDelete.length} duplicate students. Deleting...`);
            await supabase.from('students').delete().in('id', studentsToDelete);
        } else {
            console.log('   No duplicate students found.');
        }
    }

    console.log('✅ Cleanup Completed.');
}

cleanup().catch(console.error);
