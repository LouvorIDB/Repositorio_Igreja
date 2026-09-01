-- =====================================================================
-- SCRIPT DE HABILITAÇÃO DE DELETE PARA MINISTÉRIOS, FUNÇÕES E PERFIS
-- Execute no SQL Editor do Supabase para permitir exclusões pelo painel
-- =====================================================================

-- 1. Permitir exclusão na tabela ministries
DROP POLICY IF EXISTS "Permitir exclusão de ministérios por admins" ON ministries;
CREATE POLICY "Permitir exclusão de ministérios por admins" ON ministries
    FOR DELETE
    USING (true);

-- 2. Permitir exclusão na tabela ministry_roles (Funções dos Ministérios)
DROP POLICY IF EXISTS "Permitir exclusão de funções de ministérios" ON ministry_roles;
CREATE POLICY "Permitir exclusão de funções de ministérios" ON ministry_roles
    FOR DELETE
    USING (true);

-- 3. Permitir exclusão na tabela profiles (Perfis de Integrantes)
DROP POLICY IF EXISTS "Permitir exclusão de perfis por admins" ON profiles;
CREATE POLICY "Permitir exclusão de perfis por admins" ON profiles
    FOR DELETE
    USING (true);

-- 4. Permitir exclusão na tabela user_ministry_roles
DROP POLICY IF EXISTS "Permitir exclusão de cargos de ministérios" ON user_ministry_roles;
CREATE POLICY "Permitir exclusão de cargos de ministérios" ON user_ministry_roles
    FOR DELETE
    USING (true);
