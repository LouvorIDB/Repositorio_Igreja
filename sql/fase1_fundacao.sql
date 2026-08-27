-- SQL de Configuração e Harmonização de Constraints para a Fase 1

-- 1. Ajustar Foreign Key de role_id para apontar para public.ministry_roles(id)
ALTER TABLE public.service_scales DROP CONSTRAINT IF EXISTS service_scales_role_id_fkey;
ALTER TABLE public.service_scales ADD CONSTRAINT service_scales_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.ministry_roles(id) ON DELETE SET NULL;

-- 2. Garantir que a tabela service_scales possua todas as colunas necessárias
CREATE TABLE IF NOT EXISTS public.service_scales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
    role_id UUID REFERENCES public.ministry_roles(id) ON DELETE SET NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    role_name TEXT,
    status TEXT DEFAULT 'escalado',
    justification TEXT,
    church_id UUID REFERENCES public.churches(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Adicionar colunas se faltarem na tabela
ALTER TABLE public.service_scales ADD COLUMN IF NOT EXISTS role_id UUID REFERENCES public.ministry_roles(id) ON DELETE SET NULL;
ALTER TABLE public.service_scales ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.service_scales ADD COLUMN IF NOT EXISTS profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.service_scales ADD COLUMN IF NOT EXISTS role_name TEXT;
ALTER TABLE public.service_scales ADD COLUMN IF NOT EXISTS church_id UUID REFERENCES public.churches(id) ON DELETE CASCADE;

-- Index para performance
CREATE INDEX IF NOT EXISTS idx_service_scales_service_id ON public.service_scales(service_id);
CREATE INDEX IF NOT EXISTS idx_service_scales_user_id ON public.service_scales(user_id);

-- RLS
ALTER TABLE public.service_scales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_scales_select_policy" ON public.service_scales;
CREATE POLICY "service_scales_select_policy" ON public.service_scales
    FOR SELECT USING (auth.role() = 'authenticated' OR auth.role() = 'anon');

DROP POLICY IF EXISTS "service_scales_all_authenticated" ON public.service_scales;
CREATE POLICY "service_scales_all_authenticated" ON public.service_scales
    FOR ALL USING (auth.role() = 'authenticated');
