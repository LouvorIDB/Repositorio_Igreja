-- ==============================================================================
-- AGENDAMENTO AUTOMÁTICO: DISPARO DE ESCALAS TODA SEGUNDA-FEIRA ÀS 08:00 (BRT)
-- ==============================================================================
-- Execute este script no SQL Editor do Supabase para agendar o disparo semanal.

-- 1. Habilitar extensões necessárias para cron e requisições HTTP na nuvem
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Remover agendamento anterior se existir para evitar duplicidade
SELECT cron.unschedule('disparo-escala-segunda-liturge')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'disparo-escala-segunda-liturge'
);

-- 3. Agendar para toda Segunda-Feira às 08:00 (horário de Brasília = 11:00 UTC)
-- Sintaxe cron: Minuto (0) Hora (11 UTC) Dia_Mes (*) Mes (*) Dia_Semana (1 = Segunda)
SELECT cron.schedule(
  'disparo-escala-segunda-liturge',
  '0 11 * * 1',
  $$
  SELECT net.http_get(
    url := 'https://pfhkzgccoirosztjcyrh.supabase.co/functions/v1/whatsapp-cron-segunda'
  );
  $$
);
