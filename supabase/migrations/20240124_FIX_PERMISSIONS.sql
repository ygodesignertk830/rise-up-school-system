-- COMPREHENSIVE FIX FOR USER MANAGEMENT & PERMISSIONS
-- Execute este script no SQL Editor do Supabase para destravar o sistema.

-- 1. Garante que a tabela 'users' seja acessível
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public profiles are viewable by anyone" ON public.users;
DROP POLICY IF EXISTS "Anyone can read profiles" ON public.users;
CREATE POLICY "Anyone can read profiles" ON public.users FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Enable insert for authenticated users only" ON public.users FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- 2. Recria a tabela 'authorized_access' para garantir estrutura correta
CREATE TABLE IF NOT EXISTS public.authorized_access (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'school_admin' CHECK (role IN ('school_admin', 'super_admin')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Habilita RLS na 'authorized_access' e define políticas ROBUSTAS
ALTER TABLE public.authorized_access ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Super admins can manage authorized_access" ON public.authorized_access;
DROP POLICY IF EXISTS "Users can read their own entry" ON public.authorized_access;
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.authorized_access;

-- Política para Super Admin (Agora segura e funcional)
CREATE POLICY "Super admins can manage authorized_access" 
ON public.authorized_access FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE users.id = auth.uid() 
        AND users.role = 'super_admin'
    )
);

-- Política para o usuário ver sua própria permissão (necessário no App.tsx)
CREATE POLICY "Users can read their own entry"
ON public.authorized_access FOR SELECT
USING (
    auth.jwt() ->> 'email' = email
);

-- 4. Garante que Schools são visíveis para join (Caso RLS de Schools esteja bloqueando)
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public full access" ON schools;
CREATE POLICY "Public full access" ON schools FOR ALL USING (true);
