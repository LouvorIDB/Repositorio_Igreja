-- Script para criar a tabela recurrent_services e configurar as políticas RLS

CREATE TABLE IF NOT EXISTS public.recurrent_services (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    church_id UUID REFERENCES public.churches(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    day_of_week INTEGER NOT NULL, -- 0 (Domingo) a 6 (Sábado)
    time TEXT NOT NULL,
    location TEXT,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS
ALTER TABLE public.recurrent_services ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso SaaS usando get_user_church_id()
CREATE POLICY "Recorrentes filtrados por igreja" ON public.recurrent_services
    FOR ALL
    USING (
        church_id IS NULL OR 
        church_id = get_user_church_id()
    )
    WITH CHECK (
        church_id IS NULL OR 
        church_id = get_user_church_id()
    );
