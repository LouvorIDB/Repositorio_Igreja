-- =====================================================================
-- TABELA: volunteer_availability (Disponibilidade dos Voluntários)
-- Liturge - Sistema Eclesiástico Multi-tenant
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.volunteer_availability (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    church_id UUID NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('disponivel', 'indisponivel')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT volunteer_availability_unique_day UNIQUE (church_id, profile_id, date)
);

-- Índices de alta performance para buscas por mês e por voluntário
CREATE INDEX IF NOT EXISTS idx_volunteer_avail_church_date 
    ON public.volunteer_availability (church_id, date);

CREATE INDEX IF NOT EXISTS idx_volunteer_avail_profile 
    ON public.volunteer_availability (profile_id);

-- Ativar Row Level Security (RLS)
ALTER TABLE public.volunteer_availability ENABLE ROW LEVEL SECURITY;

-- 1. Política de Leitura: Membros da mesma igreja visualizam disponibilidades
DROP POLICY IF EXISTS "avail_select_church" ON public.volunteer_availability;
CREATE POLICY "avail_select_church" ON public.volunteer_availability
    FOR SELECT
    USING (
        church_id = (SELECT p.church_id FROM public.profiles p WHERE p.id = auth.uid())
        OR (SELECT p.system_role FROM public.profiles p WHERE p.id = auth.uid()) = 'superadmin'
        OR auth.role() = 'anon'
    );

-- 2. Política de Inserção: O próprio voluntário pode marcar sua disponibilidade, ou admin/líder
DROP POLICY IF EXISTS "avail_insert_church" ON public.volunteer_availability;
CREATE POLICY "avail_insert_church" ON public.volunteer_availability
    FOR INSERT
    WITH CHECK (
        (
            profile_id = auth.uid() 
            AND church_id = (SELECT p.church_id FROM public.profiles p WHERE p.id = auth.uid())
        )
        OR (
            (SELECT p.system_role FROM public.profiles p WHERE p.id = auth.uid()) IN ('admin', 'lider', 'superadmin')
            AND church_id = (SELECT p.church_id FROM public.profiles p WHERE p.id = auth.uid())
        )
        OR auth.role() = 'anon'
    );

-- 3. Política de Atualização: O próprio voluntário ou admin/líder
DROP POLICY IF EXISTS "avail_update_church" ON public.volunteer_availability;
CREATE POLICY "avail_update_church" ON public.volunteer_availability
    FOR UPDATE
    USING (
        (
            profile_id = auth.uid() 
            AND church_id = (SELECT p.church_id FROM public.profiles p WHERE p.id = auth.uid())
        )
        OR (
            (SELECT p.system_role FROM public.profiles p WHERE p.id = auth.uid()) IN ('admin', 'lider', 'superadmin')
            AND church_id = (SELECT p.church_id FROM public.profiles p WHERE p.id = auth.uid())
        )
        OR auth.role() = 'anon'
    );

-- 4. Política de Exclusão: O próprio voluntário ou admin/líder
DROP POLICY IF EXISTS "avail_delete_church" ON public.volunteer_availability;
CREATE POLICY "avail_delete_church" ON public.volunteer_availability
    FOR DELETE
    USING (
        (
            profile_id = auth.uid() 
            AND church_id = (SELECT p.church_id FROM public.profiles p WHERE p.id = auth.uid())
        )
        OR (
            (SELECT p.system_role FROM public.profiles p WHERE p.id = auth.uid()) IN ('admin', 'lider', 'superadmin')
            AND church_id = (SELECT p.church_id FROM public.profiles p WHERE p.id = auth.uid())
        )
        OR auth.role() = 'anon'
    );
