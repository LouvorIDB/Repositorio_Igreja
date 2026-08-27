-- SQL de Configuração para o Passo 4: Motor de Escala Inteligente

-- 1. Adicionar limite máximo de escalas mensais por voluntário na tabela profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS max_services_per_month INT DEFAULT 4;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS monthly_limit INT DEFAULT 4;
