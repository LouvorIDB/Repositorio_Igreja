-- ==============================================================================
-- MIGRAÇÃO: ADICIONAR CAMPOS DE DATA DE ANIVERSÁRIO E ENDEREÇO NA TABELA PROFILES
-- ==============================================================================

-- Adiciona as colunas birthdate e address na tabela profiles
ALTER TABLE public.profiles 
    ADD COLUMN IF NOT EXISTS birthdate DATE,
    ADD COLUMN IF NOT EXISTS address TEXT;

-- Comentários para documentação das colunas
COMMENT ON COLUMN public.profiles.birthdate IS 'Data de nascimento / aniversário do usuário';
COMMENT ON COLUMN public.profiles.address IS 'Endereço residencial do usuário';
