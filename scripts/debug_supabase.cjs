const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Read directly from .env.local
const envPath = path.join(__dirname, '../.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
        const key = parts[0].trim();
        const value = parts.slice(1).join('=').trim();
        env[key] = value;
    }
});

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_ANON_KEY; // FIXED NAME

if (!supabaseUrl || !supabaseKey) {
    console.error("Faltando variáveis de ambiente!");
    console.log("Env keys found:", Object.keys(env));
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugData() {
    console.log("--- DEBUG DATA ---");

    console.log("\n1. Checando Tabela 'authorized_access':");
    try {
        const { data: auth, error: authError } = await supabase
            .from('authorized_access')
            .select('*, schools(name)');

        if (authError) {
            console.error("ERRO na tabela authorized_access:", authError.message);
            if (authError.message.includes('does not exist')) {
                console.log(">>> TABELA NÃO EXISTE. Rode o SQL!!!");
            }
        } else {
            console.log("Registros na 'authorized_access':", auth);
        }
    } catch (e) {
        console.error("FALHA CRÍTICA na query:", e.message);
    }

    console.log("\n2. Checando Escolas:");
    const { data: schools } = await supabase.from('schools').select('id, name');
    console.log("Escolas encontradas:", schools);
}

debugData();
