import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ [SUPABASE] Variáveis de ambiente faltando no .env');
    process.exit(1);
}

export const supabase = createClient(supabaseUrl, supabaseKey);
