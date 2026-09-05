-- =====================================================================
-- ADICIONAR COLUNA STATUS NA TABELA AVAILABILITY_COMMENTS
-- Permite o fluxo de aprovação, rejeição e reabertura de solicitações
-- Arquivo: sql/add_status_to_availability_comments.sql
-- =====================================================================

-- 1. Criar a coluna 'status' se não existir, com valor padrão 'pendente'
ALTER TABLE public.availability_comments 
    ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pendente';

-- 2. Atualizar registros antigos nulos para 'pendente'
UPDATE public.availability_comments 
    SET status = 'pendente' 
    WHERE status IS NULL;

-- 3. Habilitar / Atualizar política RLS para que Admins e Líderes possam atualizar (UPDATE) o status
DROP POLICY IF EXISTS "Comentários gerenciáveis por admins" ON public.availability_comments;

CREATE POLICY "Comentários gerenciáveis por admins" ON public.availability_comments
    FOR ALL
    TO authenticated
    USING (
        (church_id IS NULL OR church_id = get_user_church_id()) AND
        (
            public.is_super_admin() OR 
            EXISTS (
                SELECT 1 FROM public.profiles 
                WHERE id = auth.uid() 
                  AND (system_role IN ('admin', 'lider') OR role IN ('admin', 'lider'))
            )
        )
    )
    WITH CHECK (
        (church_id IS NULL OR church_id = get_user_church_id()) AND
        (
            public.is_super_admin() OR 
            EXISTS (
                SELECT 1 FROM public.profiles 
                WHERE id = auth.uid() 
                  AND (system_role IN ('admin', 'lider') OR role IN ('admin', 'lider'))
            )
        )
    );
