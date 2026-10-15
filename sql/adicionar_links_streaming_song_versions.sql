-- ==============================================================================
-- MIGRAÇÃO: Suporte a Links de Streaming e Cifras (Spotify, Deezer, Apple Music, Cifra Club, Letras)
-- ==============================================================================

-- 1. Colunas na tabela song_versions (links específicos por versão da música)
ALTER TABLE public.song_versions ADD COLUMN IF NOT EXISTS spotify_url TEXT;
ALTER TABLE public.song_versions ADD COLUMN IF NOT EXISTS deezer_url TEXT;
ALTER TABLE public.song_versions ADD COLUMN IF NOT EXISTS apple_music_url TEXT;
ALTER TABLE public.song_versions ADD COLUMN IF NOT EXISTS cifraclub_url TEXT;
ALTER TABLE public.song_versions ADD COLUMN IF NOT EXISTS letras_url TEXT;

-- 2. Coluna na tabela songs para espelhamento consolidado em formato JSONB
ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS streaming_links JSONB DEFAULT '{}'::jsonb;

-- Comentários informativos das colunas
COMMENT ON COLUMN public.song_versions.spotify_url IS 'URL ou link de busca direta da música no Spotify';
COMMENT ON COLUMN public.song_versions.deezer_url IS 'URL da música ou busca no Deezer';
COMMENT ON COLUMN public.song_versions.apple_music_url IS 'URL do Apple Music / iTunes da música';
COMMENT ON COLUMN public.song_versions.cifraclub_url IS 'URL da cifra no Cifra Club';
COMMENT ON COLUMN public.song_versions.letras_url IS 'URL da letra no Letras.mus.br';
