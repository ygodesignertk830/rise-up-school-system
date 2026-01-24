-- Add birth_date column to students table
ALTER TABLE public.students 
ADD COLUMN IF NOT EXISTS birth_date DATE;

COMMENT ON COLUMN public.students.birth_date IS 'Data de nascimento do aluno';
