-- =====================================================================
-- SCRIPT DE INTEGRAÇÃO NATIVA HOLYRICS & LITURGE (MULTI-TENANT)
-- Adiciona suporte a tokens de integração de API e modelos de seções
-- =====================================================================

-- 1. Adicionar colunas dedicadas na tabela 'churches'
ALTER TABLE IF EXISTS public.churches 
ADD COLUMN IF NOT EXISTS holyrics_api_token TEXT UNIQUE;

ALTER TABLE IF EXISTS public.churches 
ADD COLUMN IF NOT EXISTS holyrics_template JSONB DEFAULT '[
    {id: sec_1, name: ABERTURA, color: #1E3A8A, content_type: videos, hide_if_empty: true},
    {id: sec_2, name: LOUVOR & ADORAÇÃO, color: #0284C7, content_type: musicas, hide_if_empty: false},
    {id: sec_3, name: AVISOS & NOTÍCIAS, color: #B45309, content_type: imagens, hide_if_empty: true},
    {id: sec_4, name: MENSAGEM PASTORAL, color: #047857, content_type: apenas_titulo, hide_if_empty: false},
    {id: sec_5, name: FUNDO MUSICAL, color: #6D28D9, content_type: audios, hide_if_empty: true}
]'::jsonb;

-- 2. Gerar tokens automáticos exclusivos para todas as igrejas que ainda não possuem
UPDATE public.churches
SET holyrics_api_token = 'ltg_live_' || replace(gen_random_uuid()::text, '-', '')
WHERE holyrics_api_token IS NULL OR holyrics_api_token = '';

-- 3. Função para garantir geração automática de token para novas igrejas
CREATE OR REPLACE FUNCTION public.ensure_church_holyrics_token()
RETURNS TRIGGER AS 
BEGIN
    IF NEW.holyrics_api_token IS NULL OR NEW.holyrics_api_token = '' THEN
        NEW.holyrics_api_token := 'ltg_live_' || replace(gen_random_uuid()::text, '-', '');
    END IF;
    IF NEW.holyrics_template IS NULL THEN
        NEW.holyrics_template := '[
            {id: sec_1, name: ABERTURA, color: #1E3A8A, content_type: videos, hide_if_empty: true},
            {id: sec_2, name: LOUVOR & ADORAÇÃO, color: #0284C7, content_type: musicas, hide_if_empty: false},
            {id: sec_3, name: AVISOS & NOTÍCIAS, color: #B45309, content_type: imagens, hide_if_empty: true},
            {id: sec_4, name: MENSAGEM PASTORAL, color: #047857, content_type: apenas_titulo, hide_if_empty: false},
            {id: sec_5, name: FUNDO MUSICAL, color: #6D28D9, content_type: audios, hide_if_empty: true}
        ]'::jsonb;
    END IF;
    RETURN NEW;
END;
 LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ensure_church_holyrics_token ON public.churches;
CREATE TRIGGER trg_ensure_church_holyrics_token
BEFORE INSERT ON public.churches
FOR EACH ROW
EXECUTE FUNCTION public.ensure_church_holyrics_token();

-- 4. Índice de alta velocidade para consultas da API Vercel
CREATE INDEX IF NOT EXISTS idx_churches_holyrics_token ON public.churches(holyrics_api_token);
