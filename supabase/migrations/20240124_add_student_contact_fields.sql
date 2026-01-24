-- Add missing columns to students table
ALTER TABLE public.students 
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS guardian_name TEXT;

COMMENT ON COLUMN public.students.phone IS 'WhatsApp do aluno ou responsável (DDD + Número)';
COMMENT ON COLUMN public.students.guardian_name IS 'Nome do responsável pelo aluno';
