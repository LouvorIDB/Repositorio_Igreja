-- =====================================================================
-- PATCH DE SEGURANÇA URGENTE: BLINDAGEM DE RLS & CONTROLE DE ACESSO
-- Arquivo: sql/patch_seguranca_urgente_rls.sql
-- Projeto: Liturge (LouvorIDB SaaS)
-- Objetivo:
--   1. Revogar permissão da role 'anon' na função delete_church_cascade.
--   2. Exigir verificação server-side de Super Admin ou Admin da Igreja.
--   3. Eliminar políticas inseguras USING (true) em perfis, igrejas e funções.
--   4. Blindar mutações de cultos e repertório para Líderes e Administradores.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. BLINDAGEM DA FUNÇÃO DE EXCLUSÃO EM CASCATA DE IGREJAS
-- ---------------------------------------------------------------------

-- Revogar acesso de anon e público
REVOKE EXECUTE ON FUNCTION delete_church_cascade(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION delete_church_cascade(UUID) FROM public;
GRANT EXECUTE ON FUNCTION delete_church_cascade(UUID) TO authenticated, service_role;

-- Atualizar a função com verificação rígida de autorização
CREATE OR REPLACE FUNCTION delete_church_cascade(target_church_id UUID)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_is_authorized boolean := false;
BEGIN
    -- 1. Validar se quem está chamando é Super Admin ou Admin da própria igreja
    IF (public.is_super_admin()) THEN
        v_is_authorized := true;
    ELSIF EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
          AND church_id = target_church_id 
          AND (system_role = 'admin' OR role = 'admin')
    ) THEN
        v_is_authorized := true;
    END IF;

    IF NOT v_is_authorized THEN
        RAISE EXCEPTION 'Acesso negado: Você não possui permissão administrativa para excluir esta congregação.';
    END IF;

    -- 2. Mídias, Documentos, Patrimônio e Regras
    DELETE FROM church_media WHERE church_id = target_church_id;
    DELETE FROM church_assets WHERE church_id = target_church_id;
    DELETE FROM church_documents WHERE church_id = target_church_id;
    DELETE FROM recurring_rules WHERE church_id = target_church_id;

    -- 3. Cultos e tabelas dependentes
    DELETE FROM service_songs WHERE service_id IN (SELECT id FROM services WHERE church_id = target_church_id);
    DELETE FROM service_scales WHERE service_id IN (SELECT id FROM services WHERE church_id = target_church_id);
    DELETE FROM availability_comments WHERE service_id IN (SELECT id FROM services WHERE church_id = target_church_id);

    BEGIN
        DELETE FROM service_suggestions WHERE service_id IN (SELECT id FROM services WHERE church_id = target_church_id);
    EXCEPTION WHEN undefined_table THEN
        NULL;
    END;

    DELETE FROM services WHERE church_id = target_church_id;

    -- 4. Músicas e Versões
    DELETE FROM song_versions WHERE song_id IN (SELECT id FROM songs WHERE church_id = target_church_id);
    DELETE FROM songs WHERE church_id = target_church_id;

    -- 5. Ministérios e Roles
    DELETE FROM user_ministry_roles WHERE ministry_id IN (SELECT id FROM ministries WHERE church_id = target_church_id);
    DELETE FROM ministry_roles WHERE ministry_id IN (SELECT id FROM ministries WHERE church_id = target_church_id);
    DELETE FROM ministry_leaders WHERE ministry_id IN (SELECT id FROM ministries WHERE church_id = target_church_id);
    DELETE FROM ministries WHERE church_id = target_church_id;

    -- 6. Desvincular Perfis
    UPDATE profiles SET church_id = NULL WHERE church_id = target_church_id;

    -- 7. Excluir a Igreja
    DELETE FROM churches WHERE id = target_church_id;

    RETURN true;
END;
$$;


-- ---------------------------------------------------------------------
-- 2. BLINDAGEM DA TABELA 'churches'
-- ---------------------------------------------------------------------

-- Excluir igrejas apenas por Super Admin ou Pastor Administrador da própria igreja
DROP POLICY IF EXISTS "Permitir exclusão de igrejas por admins" ON churches;
CREATE POLICY "Permitir exclusão de igrejas por admins" ON churches
    FOR DELETE
    TO authenticated
    USING (
        public.is_super_admin() OR 
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
              AND church_id = churches.id 
              AND (system_role = 'admin' OR role = 'admin')
        )
    );

-- Atualizar igrejas apenas por Super Admin ou Admin da própria igreja
DROP POLICY IF EXISTS "Permitir atualização de igrejas por admins" ON churches;
CREATE POLICY "Permitir atualização de igrejas por admins" ON churches
    FOR UPDATE
    TO authenticated
    USING (
        public.is_super_admin() OR 
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
              AND church_id = churches.id 
              AND (system_role = 'admin' OR role = 'admin')
        )
    )
    WITH CHECK (
        public.is_super_admin() OR 
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
              AND church_id = churches.id 
              AND (system_role = 'admin' OR role = 'admin')
        )
    );


-- ---------------------------------------------------------------------
-- 3. BLINDAGEM DA TABELA 'profiles'
-- ---------------------------------------------------------------------

-- Excluir perfis apenas por Super Admin ou Admin da mesma igreja
DROP POLICY IF EXISTS "Permitir exclusão de perfis por admins" ON profiles;
CREATE POLICY "Permitir exclusão de perfis por admins" ON profiles
    FOR DELETE
    TO authenticated
    USING (
        public.is_super_admin() OR 
        (
            church_id = get_user_church_id() AND 
            EXISTS (
                SELECT 1 FROM public.profiles 
                WHERE id = auth.uid() 
                  AND (system_role = 'admin' OR role = 'admin')
            )
        )
    );


-- ---------------------------------------------------------------------
-- 4. BLINDAGEM DAS TABELAS 'ministry_roles' E 'user_ministry_roles'
-- ---------------------------------------------------------------------

-- ministry_roles
DROP POLICY IF EXISTS "Permitir tudo em ministry_roles" ON ministry_roles;
DROP POLICY IF EXISTS "Permitir exclusão de funções de ministérios" ON ministry_roles;
CREATE POLICY "ministry_roles_select_policy" ON ministry_roles
    FOR SELECT
    USING (
        ministry_id IN (
            SELECT id FROM ministries 
            WHERE church_id IS NULL OR church_id = get_user_church_id()
        )
    );

CREATE POLICY "ministry_roles_modify_policy" ON ministry_roles
    FOR ALL
    TO authenticated
    USING (
        public.is_super_admin() OR 
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
              AND (system_role IN ('admin', 'lider') OR role IN ('admin', 'lider'))
        )
    );

-- user_ministry_roles
DROP POLICY IF EXISTS "Permitir tudo em user_ministry_roles" ON user_ministry_roles;
DROP POLICY IF EXISTS "Permitir exclusão de cargos de ministérios" ON user_ministry_roles;
DROP POLICY IF EXISTS "Acesso as funções de ministerio" ON user_ministry_roles;
CREATE POLICY "user_ministry_roles_select_policy" ON user_ministry_roles
    FOR SELECT
    USING (true);

CREATE POLICY "user_ministry_roles_modify_policy" ON user_ministry_roles
    FOR ALL
    TO authenticated
    USING (
        public.is_super_admin() OR 
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
              AND (system_role IN ('admin', 'lider') OR role IN ('admin', 'lider'))
        )
    );


-- ---------------------------------------------------------------------
-- 5. BLINDAGEM DE MUTABILIDADE EM 'services' E 'songs' (RBAC SERVER-SIDE)
-- ---------------------------------------------------------------------

-- services (Cultos)
DROP POLICY IF EXISTS "Cultos filtrados por igreja" ON services;

CREATE POLICY "Cultos visíveis por igreja" ON services
    FOR SELECT
    USING (church_id IS NULL OR church_id = get_user_church_id());

CREATE POLICY "Cultos modificáveis apenas por líderes e admins" ON services
    FOR ALL
    TO authenticated
    USING (
        (church_id IS NULL OR church_id = get_user_church_id()) AND
        (
            public.is_super_admin() OR 
            EXISTS (
                SELECT 1 FROM public.profiles 
                WHERE id = auth.uid() 
                  AND (system_role IN ('admin', 'lider') OR role IN ('admin', 'lider'))
            )
        )
    )
    WITH CHECK (
        (church_id IS NULL OR church_id = get_user_church_id()) AND
        (
            public.is_super_admin() OR 
            EXISTS (
                SELECT 1 FROM public.profiles 
                WHERE id = auth.uid() 
                  AND (system_role IN ('admin', 'lider') OR role IN ('admin', 'lider'))
            )
        )
    );

-- songs (Repertório)
DROP POLICY IF EXISTS "Músicas filtradas por igreja" ON songs;

CREATE POLICY "Músicas visíveis por igreja" ON songs
    FOR SELECT
    USING (church_id IS NULL OR church_id = get_user_church_id());

CREATE POLICY "Músicas modificáveis apenas por líderes e admins" ON songs
    FOR ALL
    TO authenticated
    USING (
        (church_id IS NULL OR church_id = get_user_church_id()) AND
        (
            public.is_super_admin() OR 
            EXISTS (
                SELECT 1 FROM public.profiles 
                WHERE id = auth.uid() 
                  AND (system_role IN ('admin', 'lider') OR role IN ('admin', 'lider'))
            )
        )
    )
    WITH CHECK (
        (church_id IS NULL OR church_id = get_user_church_id()) AND
        (
            public.is_super_admin() OR 
            EXISTS (
                SELECT 1 FROM public.profiles 
                WHERE id = auth.uid() 
                  AND (system_role IN ('admin', 'lider') OR role IN ('admin', 'lider'))
            )
        )
    );


-- ---------------------------------------------------------------------
-- 6. BLINDAGEM DE 'song_versions' E 'availability_comments'
-- ---------------------------------------------------------------------

-- song_versions
DROP POLICY IF EXISTS "Versões de músicas públicas" ON song_versions;

CREATE POLICY "Versões de músicas visíveis" ON song_versions
    FOR SELECT
    USING (
        song_id IN (
            SELECT id FROM songs 
            WHERE church_id IS NULL OR church_id = get_user_church_id()
        )
    );

CREATE POLICY "Versões modificáveis por usuários autenticados da igreja" ON song_versions
    FOR ALL
    TO authenticated
    USING (
        song_id IN (
            SELECT id FROM songs 
            WHERE church_id IS NULL OR church_id = get_user_church_id()
        )
    )
    WITH CHECK (
        song_id IN (
            SELECT id FROM songs 
            WHERE church_id IS NULL OR church_id = get_user_church_id()
        )
    );

-- availability_comments
DROP POLICY IF EXISTS "Comentários e solicitações da igreja" ON availability_comments;

CREATE POLICY "Comentários visíveis por igreja" ON availability_comments
    FOR SELECT
    USING (
        church_id IS NULL OR 
        church_id = get_user_church_id()
    );

CREATE POLICY "Comentários inseríveis por usuários da igreja" ON availability_comments
    FOR INSERT
    WITH CHECK (
        church_id IS NULL OR 
        church_id = get_user_church_id()
    );

CREATE POLICY "Comentários gerenciáveis por admins" ON availability_comments
    FOR ALL
    TO authenticated
    USING (
        (church_id IS NULL OR church_id = get_user_church_id()) AND
        (
            public.is_super_admin() OR 
            EXISTS (
                SELECT 1 FROM public.profiles 
                WHERE id = auth.uid() 
                  AND (system_role IN ('admin', 'lider') OR role IN ('admin', 'lider'))
            )
        )
    );

-- Notificação de conclusão
SELECT 'Patch de segurança e blindagem de RLS executado com sucesso!' as status;
