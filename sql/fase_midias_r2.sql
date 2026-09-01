-- =====================================================================
-- SCRIPT DE CONFIGURAÇÃO PARA ARMAZENAMENTO MULTI-TENANT DE MÍDIAS
-- Arquivo: sql/fase_midias_r2.sql
-- =====================================================================

-- 1. Adicionar colunas de controle de armazenamento na tabela 'churches'
ALTER TABLE public.churches 
    ADD COLUMN IF NOT EXISTS storage_limit_mb INTEGER DEFAULT 1024,
    ADD COLUMN IF NOT EXISTS storage_used_bytes BIGINT DEFAULT 0;

-- 2. Criar a tabela 'church_media'
CREATE TABLE IF NOT EXISTS public.church_media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    church_id UUID REFERENCES public.churches(id) ON DELETE CASCADE,
    file_name TEXT,
    file_url TEXT,
    file_size_bytes BIGINT,
    mime_type TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Índice para otimização de consultas por igreja
CREATE INDEX IF NOT EXISTS idx_church_media_church_id ON public.church_media(church_id);

-- 3. Habilitar Row Level Security (RLS) na tabela 'church_media'
ALTER TABLE public.church_media ENABLE ROW LEVEL SECURITY;

-- 4. Limpar políticas legadas/conflitantes se existirem
DROP POLICY IF EXISTS "Permitir SELECT de mídias da própria igreja" ON public.church_media;
DROP POLICY IF EXISTS "Permitir INSERT de mídias na própria igreja" ON public.church_media;
DROP POLICY IF EXISTS "Permitir DELETE de mídias da própria igreja" ON public.church_media;

-- 5. Criar Políticas RLS (SELECT, INSERT, DELETE) com base no church_id do perfil do usuário autenticado

-- Política de SELECT
CREATE POLICY "Permitir SELECT de mídias da própria igreja"
ON public.church_media
FOR SELECT
TO authenticated
USING (
    church_id = (SELECT profiles.church_id FROM public.profiles WHERE profiles.id = auth.uid())
);

-- Política de INSERT
CREATE POLICY "Permitir INSERT de mídias na própria igreja"
ON public.church_media
FOR INSERT
TO authenticated
WITH CHECK (
    church_id = (SELECT profiles.church_id FROM public.profiles WHERE profiles.id = auth.uid())
);

-- Política de DELETE
CREATE POLICY "Permitir DELETE de mídias da própria igreja"
ON public.church_media
FOR DELETE
TO authenticated
USING (
    church_id = (SELECT profiles.church_id FROM public.profiles WHERE profiles.id = auth.uid())
);
