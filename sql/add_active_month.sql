-- Script para adicionar o controle de mês ativo por igreja

ALTER TABLE public.churches 
ADD COLUMN IF NOT EXISTS active_month TEXT;
-- O valor esperado será no formato 'YYYY-MM', ex: '2026-09'
