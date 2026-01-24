import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Faltando variáveis de ambiente!");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTable() {
    console.log("Checando tabela 'authorized_access'...");
    const { data, error } = await supabase
        .from('authorized_access')
        .select('*')
        .limit(1);

    if (error) {
        console.error("ERRO ao acessar tabela:", error.message);
        if (error.message.includes('does not exist')) {
            console.log(">>> A tabela NÃO EXISTE no banco de dados.");
        }
    } else {
        console.log("Tabela existe! Itens encontrados:", data.length);
    }
}

checkTable();
