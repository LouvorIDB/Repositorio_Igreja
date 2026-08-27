-- SQL de Configuração para o Passo 3: Almoxarifado Virtual e Wiki Base

-- 1. Tabela de Equipamentos e Patrimônio (ministry_assets)
CREATE TABLE IF NOT EXISTS public.ministry_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ministry_id UUID REFERENCES public.ministries(id) ON DELETE CASCADE,
    church_id UUID REFERENCES public.churches(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category TEXT DEFAULT 'equipamento', -- equipamento, instrumento, cabo, senha, acessorio
    status TEXT DEFAULT 'disponivel',    -- disponivel, em_uso, manutencao, quebrado
    description TEXT,
    location TEXT,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index para performance
CREATE INDEX IF NOT EXISTS idx_ministry_assets_church_id ON public.ministry_assets(church_id);
CREATE INDEX IF NOT EXISTS idx_ministry_assets_ministry_id ON public.ministry_assets(ministry_id);

-- RLS para ministry_assets
ALTER TABLE public.ministry_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ministry_assets_select_policy" ON public.ministry_assets;
CREATE POLICY "ministry_assets_select_policy" ON public.ministry_assets
    FOR SELECT USING (auth.role() = 'authenticated' OR auth.role() = 'anon');

DROP POLICY IF EXISTS "ministry_assets_all_authenticated" ON public.ministry_assets;
CREATE POLICY "ministry_assets_all_authenticated" ON public.ministry_assets
    FOR ALL USING (auth.role() = 'authenticated');


-- 2. Tabela de Documentos, Manuais e Wiki (ministry_docs)
CREATE TABLE IF NOT EXISTS public.ministry_docs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ministry_id UUID REFERENCES public.ministries(id) ON DELETE CASCADE,
    church_id UUID REFERENCES public.churches(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content_url TEXT,                     -- link de PDF, vídeo ou Drive
    doc_type TEXT DEFAULT 'wiki_texto',   -- manual_pdf, wiki_texto, video_link
    description TEXT,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index para performance
CREATE INDEX IF NOT EXISTS idx_ministry_docs_church_id ON public.ministry_docs(church_id);
CREATE INDEX IF NOT EXISTS idx_ministry_docs_ministry_id ON public.ministry_docs(ministry_id);

-- RLS para ministry_docs
ALTER TABLE public.ministry_docs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ministry_docs_select_policy" ON public.ministry_docs;
CREATE POLICY "ministry_docs_select_policy" ON public.ministry_docs
    FOR SELECT USING (auth.role() = 'authenticated' OR auth.role() = 'anon');

DROP POLICY IF EXISTS "ministry_docs_all_authenticated" ON public.ministry_docs;
CREATE POLICY "ministry_docs_all_authenticated" ON public.ministry_docs
    FOR ALL USING (auth.role() = 'authenticated');
