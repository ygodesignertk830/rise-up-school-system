import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('Missing Supabase Environment Variables!');
}

// CORREÇÃO CRÍTICA: Configuração explícita para evitar cache corrompido
// O Supabase estava salvando dados no localStorage que ficavam obsoletos no F5
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        // Mantém storage apenas para sessão de autenticação
        storage: window.localStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        flowType: 'pkce'
    },
    db: {
        schema: 'public'
    },
    global: {
        headers: {
            'x-client-info': 'supabase-js-web'
        }
    }
});

// Log para debug
console.log('🔧 Supabase client configurado com storage de auth apenas');