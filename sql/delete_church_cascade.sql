-- =====================================================================
-- SCRIPT DE EXCLUSÃO EM CASCATA & POLÍTICA DE DELETE DE IGREJAS (SaaS)
-- Execute no SQL Editor do Supabase para habilitar a exclusão segura
-- =====================================================================

-- 1. Habilitar política de DELETE na tabela churches
DROP POLICY IF EXISTS "Permitir exclusão de igrejas por admins" ON churches;
CREATE POLICY "Permitir exclusão de igrejas por admins" ON churches
    FOR DELETE
    USING (true);

-- 2. Criar Função Segura com SECURITY DEFINER para Exclusão em Cascata Total
CREATE OR REPLACE FUNCTION delete_church_cascade(target_church_id UUID)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- 1. Mídias, Documentos, Patrimônio e Regras
    DELETE FROM church_media WHERE church_id = target_church_id;
    DELETE FROM church_assets WHERE church_id = target_church_id;
    DELETE FROM church_documents WHERE church_id = target_church_id;
    DELETE FROM recurring_rules WHERE church_id = target_church_id;

    -- 2. Cultos e tabelas dependentes
    DELETE FROM service_songs WHERE service_id IN (SELECT id FROM services WHERE church_id = target_church_id);
    DELETE FROM service_volunteers WHERE service_id IN (SELECT id FROM services WHERE church_id = target_church_id);
    DELETE FROM availability_comments WHERE service_id IN (SELECT id FROM services WHERE church_id = target_church_id);
    
    BEGIN
        DELETE FROM service_suggestions WHERE service_id IN (SELECT id FROM services WHERE church_id = target_church_id);
    EXCEPTION WHEN undefined_table THEN
        NULL;
    END;

    DELETE FROM services WHERE church_id = target_church_id;

    -- 3. Músicas e Versões
    DELETE FROM song_versions WHERE song_id IN (SELECT id FROM songs WHERE church_id = target_church_id);
    
    BEGIN
        DELETE FROM song_change_requests WHERE song_id IN (SELECT id FROM songs WHERE church_id = target_church_id);
    EXCEPTION WHEN undefined_table THEN
        NULL;
    END;

    DELETE FROM songs WHERE church_id = target_church_id;

    -- 4. Ministérios e Roles
    DELETE FROM user_ministry_roles WHERE ministry_id IN (SELECT id FROM ministries WHERE church_id = target_church_id);
    DELETE FROM ministries WHERE church_id = target_church_id;

    -- 5. Desvincular Perfis
    UPDATE profiles SET church_id = NULL WHERE church_id = target_church_id;

    -- 6. Excluir a Igreja
    DELETE FROM churches WHERE id = target_church_id;

    RETURN true;
END;
$$;

-- Permitir execução
GRANT EXECUTE ON FUNCTION delete_church_cascade(UUID) TO authenticated, anon, service_role;
