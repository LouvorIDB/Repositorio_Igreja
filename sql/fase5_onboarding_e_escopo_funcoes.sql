-- =====================================================================
-- SCRIPT DE ATUALIZAÇÃO: ONBOARDING, ESCOPO DE FUNÇÕES E MÍDIAS POR MINISTÉRIO
-- Arquivo: sql/fase5_onboarding_e_escopo_funcoes.sql
-- =====================================================================

-- 1. ESCOPO DE ESCALA NAS FUNÇÕES DO MINISTÉRIO ('service' = culto geral | 'song' = por música)
ALTER TABLE public.ministry_roles 
    ADD COLUMN IF NOT EXISTS scale_scope TEXT DEFAULT 'service';

-- Adicionar restrição CHECK se ainda não existir
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_ministry_roles_scale_scope'
    ) THEN
        ALTER TABLE public.ministry_roles 
            ADD CONSTRAINT chk_ministry_roles_scale_scope CHECK (scale_scope IN ('service', 'song'));
    END IF;
END $$;

-- Migração suave: funções existentes que tenham 'cantor' ou 'vocal' no nome são migradas para 'song'
UPDATE public.ministry_roles 
SET scale_scope = 'song' 
WHERE LOWER(name) LIKE '%cantor%' OR LOWER(name) LIKE '%vocal%';

-- 2. PERMISSÃO DE UPLOAD DE MÍDIAS POR MINISTÉRIO
ALTER TABLE public.ministries 
    ADD COLUMN IF NOT EXISTS can_upload_media BOOLEAN DEFAULT false;

-- 3. ASSOCIAÇÃO DE MÍDIA AO MINISTÉRIO
ALTER TABLE public.church_media 
    ADD COLUMN IF NOT EXISTS ministry_id UUID REFERENCES public.ministries(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_church_media_ministry_id ON public.church_media(ministry_id);

-- 4. CONTROLE DE CONCLUSÃO DO ONBOARDING DA IGREJA
ALTER TABLE public.churches 
    ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false;

-- Marcar igrejas já ativas como onboarding_completed = true para não bloquear quem já usa o sistema
UPDATE public.churches 
SET onboarding_completed = true 
WHERE status = 'active';

SELECT 'Migração fase 5 (Onboarding, Funções por Música e Mídias por Ministério) concluída com sucesso!' AS status;
