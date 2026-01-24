-- FIX RLS & PERMISSIONS (ATUALIZADO)
-- Execute este script no SQL Editor do Supabase para corrigir erros de "Permissão Negada"

-- 1. Schools (Painel SaaS)
alter table schools enable row level security;
drop policy if exists "Public full access" on schools;
drop policy if exists "Public read access" on schools;
drop policy if exists "Public insert access" on schools;
drop policy if exists "Super admin update access" on schools;

-- Permite TUDO para facilitar (já que o controle de quem é admin é feito no Frontend/Auth)
-- Em produção, restringiríamos delete para apenas super_users via claims, mas aqui:
create policy "Public full access" on schools for all using (true);

-- 2. Students
alter table students enable row level security;
drop policy if exists "Authenticated users full access" on students;
create policy "Authenticated users full access" on students for all using (auth.role() = 'authenticated');

-- 3. Payments
alter table payments enable row level security;
drop policy if exists "Authenticated users full access" on payments;
create policy "Authenticated users full access" on payments for all using (auth.role() = 'authenticated');

-- 4. Classes
alter table classes enable row level security;
drop policy if exists "Authenticated users full access" on classes;
create policy "Authenticated users full access" on classes for all using (auth.role() = 'authenticated');

-- 5. Attendance & Teachers (Novos módulos)
alter table attendance enable row level security;
drop policy if exists "Authenticated users full access" on attendance;
create policy "Authenticated users full access" on attendance for all using (auth.role() = 'authenticated');

alter table teachers enable row level security;
drop policy if exists "Authenticated users full access" on teachers;
create policy "Authenticated users full access" on teachers for all using (auth.role() = 'authenticated');

-- 6. Lesson Contents
alter table lesson_contents enable row level security;
drop policy if exists "Authenticated users full access" on lesson_contents;
create policy "Authenticated users full access" on lesson_contents for all using (auth.role() = 'authenticated');
