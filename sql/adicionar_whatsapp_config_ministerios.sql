-- =====================================================================
-- ADICIONAR CONFIGURAÇÃO DE WHATSAPP POR MINISTÉRIO (MULTI-TENANT)
-- Arquivo: sql/adicionar_whatsapp_config_ministerios.sql
-- Projeto: Liturge (LouvorIDB / Repositorio_Igreja)
-- Objetivo:
--   1. Adicionar a coluna whatsapp_config (JSONB) na tabela public.ministries.
--   2. Permitir que cada ministério de cada igreja armazene sua própria
--      programação automática de WhatsApp e modelo de mensagem.
-- =====================================================================

-- 1. Adiciona a coluna whatsapp_config se ainda não existir
ALTER TABLE public.ministries
    ADD COLUMN IF NOT EXISTS whatsapp_config JSONB DEFAULT '{
        "active": false,
        "day_of_week": 1,
        "time": "08:00",
        "template": "Olá, *{nome}*! 👋\nSegue sua escala no ministério *{ministerio}* para esta semana:\n\n{escalas}\n\n{repertorio}\n\nTenha uma abençoada semana de ministração! 🙏✨",
        "include_services": true,
        "include_repertoire": true,
        "include_youtube_links": true,
        "include_tone": true,
        "include_confirmation_prompt": true
    }'::jsonb;

-- 2. Garantir permissões de UPDATE para administradores e líderes
-- A política existente 'Permitir atualização de ministérios por admins' já cobre com USING (true) WITH CHECK (true),
-- mas garantimos que ela exista:
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'ministries' AND policyname = 'Permitir atualização de ministérios por admins'
    ) THEN
        CREATE POLICY "Permitir atualização de ministérios por admins" ON public.ministries
            FOR UPDATE
            USING (auth.role() = 'authenticated')
            WITH CHECK (auth.role() = 'authenticated');
    END IF;
END
$$;

-- Notificação de sucesso
SELECT 'Coluna whatsapp_config adicionada com sucesso na tabela ministries!' AS status;
