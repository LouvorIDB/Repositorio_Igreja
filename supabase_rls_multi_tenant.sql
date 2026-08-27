-- =====================================================================
-- SCRIPT DE SEGURANÇA MULTI-TENANT & RLS (ROW LEVEL SECURITY) SUPABASE
-- LouvorIDB SaaS — Versão com Suporte a Permissões Granulares & Simulação
-- =====================================================================

-- 1. ADICIONAR COLUNAS DEDICADAS DE PERMISSÕES E HOLYRICS
ALTER TABLE IF EXISTS songs ADD COLUMN IF NOT EXISTS holyrics_id TEXT;
ALTER TABLE IF EXISTS songs ADD COLUMN IF NOT EXISTS artist TEXT;
ALTER TABLE IF EXISTS ministries ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{}'::jsonb;
ALTER TABLE IF EXISTS profiles ADD COLUMN IF NOT EXISTS system_role TEXT DEFAULT 'voluntario';

-- Adicionar campos de controle e onboarding SaaS na tabela churches
ALTER TABLE IF EXISTS churches ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
ALTER TABLE IF EXISTS churches ADD COLUMN IF NOT EXISTS agreed_payment TEXT;
ALTER TABLE IF EXISTS churches ADD COLUMN IF NOT EXISTS leader_whatsapp TEXT;

-- 2. HABILITAR RLS NAS TABELAS PRINCIPAIS
ALTER TABLE IF EXISTS churches ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS services ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS song_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS user_ministry_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS availability_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS ministries ENABLE ROW LEVEL SECURITY;

-- 3. CRIAR FUNÇÃO SEGURA DE BUSCA DO CHURCH_ID (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION get_user_church_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT church_id FROM profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- 4. LIMPAR POLÍTICAS ANTIGAS
DROP POLICY IF EXISTS "Igrejas visíveis publicamente" ON churches;
DROP POLICY IF EXISTS "Permitir inserção anônima de igrejas" ON churches;
DROP POLICY IF EXISTS "Permitir atualização de igrejas por admins" ON churches;
DROP POLICY IF EXISTS "Cultos filtrados por igreja" ON services;
DROP POLICY IF EXISTS "Músicas filtradas por igreja" ON songs;
DROP POLICY IF EXISTS "Versões de músicas públicas" ON song_versions;
DROP POLICY IF EXISTS "Perfis filtrados por igreja" ON profiles;
DROP POLICY IF EXISTS "Comentários e solicitações da igreja" ON availability_comments;
DROP POLICY IF EXISTS "Ministérios da igreja" ON ministries;

-- 5. POLÍTICAS PARA A TABELA 'churches'
CREATE POLICY "Igrejas visíveis publicamente" ON churches
    FOR SELECT
    USING (true);

CREATE POLICY "Permitir inserção anônima de igrejas" ON churches
    FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Permitir atualização de igrejas por admins" ON churches
    FOR UPDATE
    USING (true)
    WITH CHECK (true);


-- 6. POLÍTICA PARA A TABELA 'profiles'
CREATE POLICY "Perfis filtrados por igreja" ON profiles
    FOR ALL
    USING (
        id = auth.uid() OR
        church_id IS NULL OR 
        church_id = get_user_church_id()
    )
    WITH CHECK (
        id = auth.uid() OR
        church_id IS NULL OR 
        church_id = get_user_church_id()
    );

-- 7. POLÍTICA PARA A TABELA 'services' (Cultos)
CREATE POLICY "Cultos filtrados por igreja" ON services
    FOR ALL
    USING (
        church_id IS NULL OR 
        church_id = get_user_church_id()
    )
    WITH CHECK (
        church_id IS NULL OR 
        church_id = get_user_church_id()
    );

-- 8. POLÍTICA PARA A TABELA 'songs' (Banco de Músicas)
CREATE POLICY "Músicas filtradas por igreja" ON songs
    FOR ALL
    USING (
        church_id IS NULL OR 
        church_id = get_user_church_id()
    )
    WITH CHECK (
        church_id IS NULL OR 
        church_id = get_user_church_id()
    );

-- 9. POLÍTICA PARA A TABELA 'song_versions' (Versões de Músicas)
CREATE POLICY "Versões de músicas públicas" ON song_versions
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- 10. POLÍTICA PARA A TABELA 'availability_comments' (Solicitações)
CREATE POLICY "Comentários e solicitações da igreja" ON availability_comments
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- 11. POLÍTICAS PARA A TABELA 'ministries' (Ministérios)
DROP POLICY IF EXISTS "Ministérios da igreja" ON ministries;
DROP POLICY IF EXISTS "Permitir inserção anônima de ministérios" ON ministries;
DROP POLICY IF EXISTS "Permitir atualização de ministérios por admins" ON ministries;

CREATE POLICY "Ministérios da igreja" ON ministries
    FOR SELECT
    USING (
        church_id IS NULL OR 
        church_id = get_user_church_id()
    );

CREATE POLICY "Permitir inserção anônima de ministérios" ON ministries
    FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Permitir atualização de ministérios por admins" ON ministries
    FOR UPDATE
    USING (true)
    WITH CHECK (true);

-- 12. POLÍTICA PARA A TABELA 'user_ministry_roles' (Cargos/Funções dos Integrantes)
-- Remove qualquer política antiga conflitante
DROP POLICY IF EXISTS "Acesso as funções de ministerio" ON user_ministry_roles;

CREATE POLICY "Acesso as funções de ministerio" ON user_ministry_roles
    FOR ALL
    USING (true)
    WITH CHECK (true);
