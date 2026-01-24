-- ============================================================================
-- SEED DATA - Rise UP School System
-- ============================================================================
-- Este script popula o banco com os dados fornecidos.
-- IMPORTANTE: Execute este script no SQL Editor do Supabase.

-- 1. Helper function para pegar (ou criar) uma escola padrão
DO $$
DECLARE
    v_school_id uuid;
    v_teacher_rosi uuid;
    v_teacher_thiago uuid;
    v_class_storyland uuid;
    v_class_disney_starter uuid;
    v_class_disney_level1 uuid;
    v_class_new_ilearn uuid;
BEGIN
    -- Obter ID da escola (pega a primeira encontrada ou cria uma nova)
    SELECT id INTO v_school_id FROM schools LIMIT 1;
    
    IF v_school_id IS NULL THEN
        INSERT INTO schools (name, slug, active)
        VALUES ('Rise UP School', 'rise-up-school', true)
        RETURNING id INTO v_school_id;
    END IF;

    -- ========================================================================
    -- 2. CADASTRO DE PROFESSORES
    -- ========================================================================
    
    -- Rosi Oliveira
    INSERT INTO teachers (school_id, name, active)
    VALUES (v_school_id, 'Rosi Oliveira', true)
    RETURNING id INTO v_teacher_rosi;

    -- Thiago Botelho
    INSERT INTO teachers (school_id, name, active)
    VALUES (v_school_id, 'Thiago Botelho', true)
    RETURNING id INTO v_teacher_thiago;


    -- ========================================================================
    -- 3. CADASTRO DE TURMAS (CLASSES)
    -- ========================================================================

    -- Turma: Storyland (Seg/Qua)
    INSERT INTO classes (school_id, name, teacher, schedule, room, color)
    VALUES (v_school_id, 'Storyland', 'Rosi Oliveira', 'Seg/Qua 10h00-11h30', 'B', 'bg-pink-600')
    RETURNING id INTO v_class_storyland;

    -- Turma: My Disney Stars and Heroes (Starter) (Seg/Qua)
    INSERT INTO classes (school_id, name, teacher, schedule, room, color)
    VALUES (v_school_id, 'My Disney Stars and Heroes (Starter)', 'Thiago Botelho', 'Seg/Qua 10h00-11h30', 'A', 'bg-blue-600')
    RETURNING id INTO v_class_disney_starter;

    -- Turma: My Disney Stars and Heroes – Level 1 (Seg/Qua)
    INSERT INTO classes (school_id, name, teacher, schedule, room, color)
    VALUES (v_school_id, 'My Disney Stars and Heroes – Level 1', 'Thiago Botelho', 'Seg/Qua 13h00-14h30', 'A', 'bg-purple-600')
    RETURNING id INTO v_class_disney_level1;

    -- Turma: New iLearn (Ter/Qui)
    INSERT INTO classes (school_id, name, teacher, schedule, room, color)
    VALUES (v_school_id, 'New iLearn', 'Thiago Botelho', 'Ter/Qui 13h00-14h30', 'A', 'bg-emerald-600')
    RETURNING id INTO v_class_new_ilearn;


    -- ========================================================================
    -- 4. CADASTRO DE ALUNOS (STUDENTS)
    -- ========================================================================

    -- Alunos Storyland
    INSERT INTO students (school_id, class_id, name, status) VALUES
    (v_school_id, v_class_storyland, 'Betina Bràz', 'active'),
    (v_school_id, v_class_storyland, 'Rhanã Arcênio', 'active'),
    (v_school_id, v_class_storyland, 'Cecilia Eleamen', 'active'),
    (v_school_id, v_class_storyland, 'Joaquim Prado', 'active'),
    (v_school_id, v_class_storyland, 'Glória Maria', 'active');

    -- Alunos My Disney Stars and Heroes (Starter)
    INSERT INTO students (school_id, class_id, name, status) VALUES
    (v_school_id, v_class_disney_starter, 'Benício Bràz', 'active'),
    (v_school_id, v_class_disney_starter, 'Joaquim Teixeira', 'active'),
    (v_school_id, v_class_disney_starter, 'Heitor Pessoa', 'active'),
    (v_school_id, v_class_disney_starter, 'Laura Nascimento', 'active'),
    (v_school_id, v_class_disney_starter, 'Sophia Barros', 'active');

    -- Alunos My Disney Stars and Heroes – Level 1
    INSERT INTO students (school_id, class_id, name, status) VALUES
    (v_school_id, v_class_disney_level1, 'Belisa Bierbach', 'active'),
    (v_school_id, v_class_disney_level1, 'Astrid Bierbach', 'active'),
    (v_school_id, v_class_disney_level1, 'Clara Tomio', 'active'),
    (v_school_id, v_class_disney_level1, 'Yasmim Arcênio', 'active'),
    (v_school_id, v_class_disney_level1, 'Isa Aragão', 'active'),
    (v_school_id, v_class_disney_level1, 'Isa Piauhy', 'active'),
    (v_school_id, v_class_disney_level1, 'Sofia Borges', 'active'),
    (v_school_id, v_class_disney_level1, 'Alzira Aciolly', 'active'),
    (v_school_id, v_class_disney_level1, 'Malu Prado', 'active'),
    (v_school_id, v_class_disney_level1, 'Lívia Garbin', 'active');

    -- Alunos New iLearn
    INSERT INTO students (school_id, class_id, name, status) VALUES
    (v_school_id, v_class_new_ilearn, 'Alderico Estevão', 'active'),
    (v_school_id, v_class_new_ilearn, 'Islayne Caxias', 'active'),
    (v_school_id, v_class_new_ilearn, 'Isabele Franklin', 'active'),
    (v_school_id, v_class_new_ilearn, 'João Miguel', 'active'),
    (v_school_id, v_class_new_ilearn, 'Kácio Samuel', 'active'),
    (v_school_id, v_class_new_ilearn, 'Luan Barros', 'active');

END $$;
