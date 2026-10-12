-- Adiciona a coluna photo_url na tabela ministry_assets para fotos dos equipamentos
ALTER TABLE public.ministry_assets ADD COLUMN IF NOT EXISTS photo_url TEXT;
