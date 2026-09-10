import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || "https://pfhkzgccoirosztjcyrh.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBmaGt6Z2Njb2lyb3N6dGpjeXJoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY0NzY1MzgsImV4cCI6MjEwMjA1MjUzOH0.iFOlq-AXEmiTqCI2TsCblvzq_fp8YeadSr3vEFlgs9U";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false }
});

export const PADRAO_SECOES = [
    { id: 'sec_1', name: 'ABERTURA', color: '#1E3A8A', content_type: 'videos', hide_if_empty: true },
    { id: 'sec_2', name: 'LOUVOR & ADORAÇÃO', color: '#0284C7', content_type: 'musicas', hide_if_empty: false },
    { id: 'sec_3', name: 'AVISOS & NOTÍCIAS', color: '#B45309', content_type: 'imagens', hide_if_empty: true },
    { id: 'sec_4', name: 'MENSAGEM PASTORAL', color: '#047857', content_type: 'apenas_titulo', hide_if_empty: false },
    { id: 'sec_5', name: 'FUNDO MUSICAL', color: '#6D28D9', content_type: 'audios', hide_if_empty: true }
];

export function setCors(res) {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');
}

export function extractToken(req) {
    const authHeader = req.headers['authorization'] || req.headers['Authorization'] || '';
    if (authHeader.startsWith('Bearer ')) {
        return authHeader.slice(7).trim();
    }
    if (req.query && req.query.token) {
        return String(req.query.token).trim();
    }
    return null;
}

export async function authenticateChurch(req, res) {
    setCors(res);
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return null;
    }

    const token = extractToken(req);
    if (!token) {
        res.status(401).json({ status: 'error', message: 'Token de autenticação não fornecido. Use o header "Authorization: Bearer <TOKEN>".' });
        return null;
    }

    try {
        // 1. Tentar buscar por holyrics_api_token
        const { data: churchByCol } = await supabase
            .from('churches')
            .select('id, name, holyrics_api_token, holyrics_template, public_permissions')
            .eq('holyrics_api_token', token)
            .maybeSingle();

        if (churchByCol) {
            return churchByCol;
        }

        // 2. Fallback: buscar em public_permissions->>holyrics_api_token
        const { data: allChurches } = await supabase
            .from('churches')
            .select('id, name, holyrics_api_token, holyrics_template, public_permissions');

        if (allChurches && allChurches.length > 0) {
            const found = allChurches.find(c => {
                if (c.holyrics_api_token === token) return true;
                let pub = c.public_permissions;
                if (typeof pub === 'string') {
                    try { pub = JSON.parse(pub); } catch(e) {}
                }
                return pub && pub.holyrics_api_token === token;
            });
            if (found) return found;
        }

        res.status(403).json({ status: 'error', message: 'Token inválido ou não autorizado para nenhuma igreja.' });
        return null;
    } catch (err) {
        console.error('Erro na autenticação da igreja:', err);
        res.status(500).json({ status: 'error', message: 'Erro interno ao autenticar igreja: ' + err.message });
        return null;
    }
}

export function formatServicePayload(service, church) {
    // 1. Obter template de seções da igreja
    let template = church.holyrics_template;
    if (!template || !Array.isArray(template) || template.length === 0) {
        let pub = church.public_permissions;
        if (typeof pub === 'string') {
            try { pub = JSON.parse(pub); } catch(e) {}
        }
        if (pub && pub.holyrics_template && Array.isArray(pub.holyrics_template)) {
            template = pub.holyrics_template;
        }
    }
    if (!template || !Array.isArray(template) || template.length === 0) {
        template = PADRAO_SECOES;
    }

    // 2. Extrair e ordenar músicas
    const songsList = [];
    const rawSongs = service.service_songs || [];
    const sortedSongs = [...rawSongs].sort((a, b) => (a.song_order || a.order || 0) - (b.song_order || b.order || 0));

    for (const ss of sortedSongs) {
        let title = '';
        let artist = '';
        if (ss.song_versions) {
            const sv = Array.isArray(ss.song_versions) ? ss.song_versions[0] : ss.song_versions;
            if (sv && sv.songs) {
                const s = Array.isArray(sv.songs) ? sv.songs[0] : sv.songs;
                title = s?.title || '';
                artist = s?.artist || '';
            }
        }
        if (!title && ss.title) title = ss.title;
        if (!title && ss.name) title = ss.name;

        if (title) {
            songsList.push({
                type: 'song',
                title: title.trim(),
                artist: (artist || '').trim()
            });
        }
    }

    // 3. Extrair e categorizar mídias
    let rawMedia = service.service_media || [];
    if (!rawMedia || rawMedia.length === 0) {
        if (Array.isArray(service.media_urls)) {
            rawMedia = service.media_urls;
        } else if (typeof service.media_urls === 'string') {
            try { rawMedia = JSON.parse(service.media_urls); } catch(e) { rawMedia = []; }
        }
    }

    const videosList = [];
    const imagesList = [];
    const audiosList = [];

    for (const m of (rawMedia || [])) {
        if (!m || !m.url) continue;
        const name = (m.name || m.url.split('/').pop().split('?')[0] || 'arquivo').trim();
        const url = m.url;
        const rawType = (m.type || '').toLowerCase();
        const ext = name.split('.').pop().toLowerCase();

        const isVideo = rawType.startsWith('video/') || ['mp4', 'mkv', 'mov', 'avi', 'webm'].includes(ext);
        const isImage = rawType.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext);
        const isAudio = rawType.startsWith('audio/') || ['mp3', 'wav', 'm4a', 'aac', 'flac', 'ogg'].includes(ext);

        if (isVideo) {
            videosList.push({ type: 'video', name: name, url: url });
        } else if (isImage) {
            imagesList.push({ type: 'image', name: name, url: url });
        } else if (isAudio) {
            audiosList.push({ type: 'audio', name: name, url: url });
        } else {
            imagesList.push({ type: 'image', name: name, url: url });
        }
    }

    // 4. Montar seções conforme template da igreja
    const finalSections = [];

    for (const sec of template) {
        const title = (sec.name || sec.title || 'SEÇÃO').trim();
        let color = (sec.color || '#1E3A8A').trim().replace('#', '');
        if (color.length === 3) {
            color = color.split('').map(c => c + c).join('');
        }
        const contentType = (sec.content_type || 'apenas_titulo').toLowerCase();
        const hideIfEmpty = sec.hide_if_empty === true || sec.hide_if_empty === 'true';

        let items = [];
        if (contentType === 'musicas' || contentType === 'songs') {
            items = [...songsList];
        } else if (contentType === 'videos') {
            items = [...videosList];
        } else if (contentType === 'imagens' || contentType === 'images') {
            items = [...imagesList];
        } else if (contentType === 'audios') {
            items = [...audiosList];
        }

        // Se hide_if_empty for verdadeiro e a seção não tiver nenhum item, omite
        if (hideIfEmpty && items.length === 0 && contentType !== 'apenas_titulo') {
            continue;
        }

        finalSections.push({
            title: title,
            background_color: color,
            items: items
        });
    }

    return {
        id: service.id,
        title: service.title || 'Culto',
        datetime: service.date,
        sections: finalSections
    };
}
