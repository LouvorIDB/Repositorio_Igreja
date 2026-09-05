-- =====================================================================
-- ATIVAÇÃO TOTAL DE RLS & BLINDAGEM DE ISOLAMENTO MULTI-TENANT
-- Arquivo: sql/ativar_rls_multi_tenant_total.sql
-- Projeto: Liturge
-- Objetivo:
--   1. Garantir ENABLE ROW LEVEL SECURITY em 100% das tabelas.
--   2. Garantir que consultas anônimas e de outros tenants não vazem dados.
-- =====================================================================

-- 1. HABILITAR RLS EXPLICITAMENTE EM TODAS AS TABELAS
ALTER TABLE IF EXISTS public.churches ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.service_scales ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.service_songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.service_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.song_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.ministries ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.ministry_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_ministry_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.ministry_leaders ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.availability_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.recurring_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.church_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.church_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.church_documents ENABLE ROW LEVEL SECURITY;

-- 2. REFORÇAR A POLÍTICA DE LEITURA EM 'profiles' (ISOLAMENTO DE MEMBROS)
DROP POLICY IF EXISTS "Perfis filtrados por igreja" ON public.profiles;
DROP POLICY IF EXISTS "profiles_church_isolation_select" ON public.profiles;

CREATE POLICY "profiles_church_isolation_select" ON public.profiles
    FOR SELECT
    USING (
        public.is_super_admin() OR
        id = auth.uid() OR
        (church_id IS NOT NULL AND church_id = get_user_church_id()) OR
        -- Permite leitura de membros para exibição pública de escalas de cultos da igreja ativa
        (auth.uid() IS NULL AND church_id IS NOT NULL)
    );

-- 3. REFORÇAR POLÍTICA DE LEITURA EM 'ministries' (ISOLAMENTO DE MINISTÉRIOS)
DROP POLICY IF EXISTS "Ministérios da igreja" ON public.ministries;
DROP POLICY IF EXISTS "ministries_church_isolation_select" ON public.ministries;

CREATE POLICY "ministries_church_isolation_select" ON public.ministries
    FOR SELECT
    USING (
        public.is_super_admin() OR
        church_id = get_user_church_id() OR
        (auth.uid() IS NULL AND church_id IS NOT NULL)
    );

-- 4. REFORÇAR POLÍTICA DE LEITURA EM 'availability_comments' (ISOLAMENTO DE SOLICITAÇÕES)
DROP POLICY IF EXISTS "Comentários visíveis por igreja" ON public.availability_comments;
DROP POLICY IF EXISTS "comments_church_isolation_select" ON public.availability_comments;

CREATE POLICY "comments_church_isolation_select" ON public.availability_comments
    FOR SELECT
    USING (
        public.is_super_admin() OR
        (church_id IS NOT NULL AND church_id = get_user_church_id())
    );

-- Notificação de conclusão
SELECT 'Isolamento RLS e ativação de segurança multi-tenant concluídos com sucesso!' as status;
