-- Adicionar coluna instruments na tabela profiles caso deseje mantê-la no banco
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS instruments TEXT;
