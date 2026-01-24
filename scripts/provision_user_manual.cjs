const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// 1. LEITURA DE CREDENCIAIS
const envPath = path.join(__dirname, '../.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) env[parts[0].trim()] = parts.slice(1).join('=').trim();
});

const supabaseUrl = env.VITE_SUPABASE_URL;

// !!! ATENÇÃO: COLE SUA SERVICE_ROLE_KEY AQUI (Pegue no Dashboard -> Settings -> API)
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN6a2xjbnB1ZHpjZnlxbnRsYnVqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODk0NTU0MywiZXhwIjoyMDg0NTIxNTQzfQ.lQzDDb7U9z5CjCEyQIwDZKb41nsjsNX6xv6Az5ZWHfI';

if (!serviceRoleKey || serviceRoleKey.includes('COLE_AQUI')) {
    console.error("ERRO: Você precisa colar a SERVICE_ROLE_KEY no script!");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function provisionUser() {
    const email = 'thiago@riseup.com.br'; // Email desejado
    const password = '102030';     // Senha desejada
    const school_id = '5da234ef-a9bc-4b5e-b51f-0e256da582c1'; // ID da escola (Rise UP)

    console.log(`Provisionando usuário ${email}...`);

    try {
        // 1. Criar no Auth
        const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
            email,
            password,
            email_confirm: true
        });

        if (authError) throw authError;
        console.log("✓ Conta Auth criada!");

        // 2. Criar Perfil
        const { error: profileError } = await supabase
            .from('users')
            .upsert({
                id: authUser.user.id,
                email: email.toLowerCase(),
                role: 'school_admin',
                school_id
            });

        if (profileError) throw profileError;
        console.log("✓ Perfil do usuário criado!");

        // 3. Criar Autorização
        await supabase.from('authorized_access').upsert({ email, school_id });
        console.log("✓ Autorização vinculada!");

        console.log("\nPRONTO! O usuário já pode logar.");

    } catch (error) {
        console.error("FALHA:", error.message);
    }
}

provisionUser();
