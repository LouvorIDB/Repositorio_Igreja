import { Readable } from 'stream';

export default async function handler(req, res) {
    // Cabeçalhos CORS para permitir reprodução em qualquer cliente
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type, Accept');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges');

    if (req.method === 'OPTIONS') {
        res.statusCode = 204;
        res.end();
        return;
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.statusCode = 405;
        res.setHeader('Content-Type', 'text/plain');
        res.end('Method Not Allowed');
        return;
    }

    let id = req.query?.id;
    if (!id && req.url) {
        try {
            const parsed = new URL(req.url, 'http://localhost');
            id = parsed.searchParams.get('id');
        } catch (e) {
            // Silencioso
        }
    }

    const cleanId = id ? String(id).trim() : '';
    if (!cleanId || !/^[a-zA-Z0-9_-]{10,120}$/.test(cleanId)) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'ID de arquivo do Google Drive inválido ou ausente.' }));
        return;
    }

    const driveUrl = `https://drive.usercontent.google.com/download?id=${encodeURIComponent(cleanId)}&export=download&confirm=t&authuser=0`;

    const fetchHeaders = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': '*/*'
    };

    if (req.headers.range) {
        fetchHeaders['Range'] = req.headers.range;
    }

    try {
        const driveRes = await fetch(driveUrl, {
            headers: fetchHeaders,
            redirect: 'follow'
        });

        if (!driveRes.ok && driveRes.status !== 206) {
            res.statusCode = driveRes.status;
            res.setHeader('Content-Type', 'text/plain');
            res.end(`Falha ao obter áudio do Google Drive: HTTP ${driveRes.status}`);
            return;
        }

        res.statusCode = driveRes.status;

        const contentType = driveRes.headers.get('content-type') || 'audio/mpeg';
        res.setHeader('Content-Type', contentType);
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Cache-Control', 'public, max-age=86400');

        const contentLength = driveRes.headers.get('content-length');
        if (contentLength) {
            res.setHeader('Content-Length', contentLength);
        }

        const contentRange = driveRes.headers.get('content-range');
        if (contentRange) {
            res.setHeader('Content-Range', contentRange);
        }

        if (req.method === 'HEAD') {
            res.end();
            return;
        }

        const stream = Readable.fromWeb(driveRes.body);
        stream.pipe(res);

        req.on('close', () => {
            try {
                stream.destroy();
            } catch (e) {
                // Silencioso
            }
        });
    } catch (err) {
        console.error('[drive-stream] Erro no stream do Drive:', err);
        if (!res.headersSent) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'text/plain');
            res.end('Erro interno ao fazer proxy do áudio.');
        }
    }
}
