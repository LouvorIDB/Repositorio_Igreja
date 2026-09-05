-- =====================================================================
-- SCRIPT DE CONFIGURAÇÃO: MULTI-MINISTÉRIO E SUPER ADMIN NO SUPABASE
-- Execute este script no SQL Editor do seu projeto Supabase.
-- =====================================================================

-- 1. TABELA DE SUPER ADMINS (BLINDADA)
CREATE TABLE IF NOT EXISTS public.super_admins (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.super_admins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir leitura de super_admins pelo próprio usuário" ON public.super_admins;
CREATE POLICY "Permitir leitura de super_admins pelo próprio usuário" ON public.super_admins
    FOR SELECT USING (auth.uid() = user_id);

-- Função auxiliar para checar se o usuário atual é Super Admin
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (SELECT 1 FROM public.super_admins WHERE user_id = auth.uid());
$$;


-- 2. TABELA DE LÍDERES POR MINISTÉRIO (GRANULARIDADE DE ACESSO)
CREATE TABLE IF NOT EXISTS public.ministry_leaders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    ministry_id UUID REFERENCES public.ministries(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(profile_id, ministry_id)
);

ALTER TABLE public.ministry_leaders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Leitura de ministry_leaders pública para autenticados" ON public.ministry_leaders;
CREATE POLICY "Leitura de ministry_leaders pública para autenticados" ON public.ministry_leaders
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Gerenciamento de ministry_leaders por admins" ON public.ministry_leaders;
CREATE POLICY "Gerenciamento de ministry_leaders por admins" ON public.ministry_leaders
    FOR ALL USING (
        is_super_admin() OR 
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (system_role = 'admin' OR role = 'admin'))
    );


-- 3. INSERIR SEU USUÁRIO INICIAL COMO SUPER ADMIN (Substitua 'seu_email@dominio.com' pelo seu e-mail cadastrado)
-- INSERT INTO public.super_admins (user_id)
-- SELECT id FROM auth.users WHERE email = 'seu_email@dominio.com'
-- ON CONFLICT (user_id) DO NOTHING;

-- Notificação de conclusão
SELECT 'Configuração de Super Admin e Líderes por Ministério concluída com sucesso!' as status;
