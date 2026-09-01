-- =====================================================================
-- LIBERAÇÃO TOTAL DE RLS PARA user_ministry_roles, ministry_roles e ministry_leaders
-- Execute no SQL Editor do Supabase
-- =====================================================================

-- 1. Tabela user_ministry_roles
ALTER TABLE IF EXISTS user_ministry_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir tudo em user_ministry_roles" ON user_ministry_roles;
DROP POLICY IF EXISTS "Acesso as funções de ministerio" ON user_ministry_roles;
CREATE POLICY "Permitir tudo em user_ministry_roles" ON user_ministry_roles
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- 2. Tabela ministry_roles
ALTER TABLE IF EXISTS ministry_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir tudo em ministry_roles" ON ministry_roles;
CREATE POLICY "Permitir tudo em ministry_roles" ON ministry_roles
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- 3. Tabela ministry_leaders
ALTER TABLE IF EXISTS ministry_leaders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir tudo em ministry_leaders" ON ministry_leaders;
CREATE POLICY "Permitir tudo em ministry_leaders" ON ministry_leaders
    FOR ALL
    USING (true)
    WITH CHECK (true);
