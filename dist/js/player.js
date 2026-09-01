function fecharPlayer() {
    const playerBar = document.getElementById('fixed-player-bar');
    if (playerBar) {
        playerBar.style.display = 'none';
        playerBar.classList.add('hidden');
    }
    const titleEl = document.getElementById('nowPlayingTitle');
    if (titleEl) titleEl.textContent = 'Nenhuma música selecionada';
    const pc = document.getElementById('playerContainer');
    if (pc) pc.innerHTML = '<span class="text-xs text-slate-400">Clique em "▶ Ouvir VS" para carregar o player.</span>';
}

function playDriveAudio(title, fileIdOrUrl) {
    const playerBar = document.getElementById('fixed-player-bar');
    if (playerBar) {
        playerBar.style.display = 'block';
        playerBar.classList.remove('hidden');
    }

    const titleEl = document.getElementById('nowPlayingTitle');
    if (titleEl) titleEl.textContent = `Tocando: ${title}`;
    const pc = document.getElementById('playerContainer');
    if (!pc) return;

    if (!fileIdOrUrl) {
        pc.innerHTML = '<span class="text-xs text-yellow-400">Nenhum áudio/VS cadastrado.</span>';
        return;
    }

    let strUrl = fileIdOrUrl.toString().trim();

    // Se for URL HTTP/HTTPS (Supabase Storage ou arquivo de áudio direto)
    if (strUrl.startsWith('http://') || strUrl.startsWith('https://')) {
        if (strUrl.includes('supabase') || strUrl.includes('/storage/') || strUrl.match(/\.(mp3|wav|m4a|ogg|flac|aac)$/i)) {
            pc.innerHTML = `
                <div class="flex items-center gap-3 w-full">
                    <audio controls autoplay class="w-full h-9 rounded-lg accent-brand-500">
                        <source src="${strUrl}">
                        Seu navegador não suporta o player de áudio.
                    </audio>
                    <button onclick="fecharPlayer()" class="shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-slate-700 hover:bg-red-600 text-slate-300 hover:text-white transition text-sm" aria-label="Fechar Player">✕</button>
                </div>`;
            return;
        }

        const match = strUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
        if (match && match[1]) {
            fileIdOrUrl = match[1];
        }
    }

    // Embed do Google Drive em iframe preview para tocar o VS/áudio
    pc.innerHTML = `
        <div class="flex items-center gap-2 w-full">
            <div class="drive-player-wrapper flex-1">
                <iframe src="https://drive.google.com/file/d/${fileIdOrUrl}/preview" allow="autoplay"></iframe>
            </div>
            <button onclick="fecharPlayer()" class="shrink-0 w-7 h-7 flex items-center justify-center rounded-full bg-slate-700 hover:bg-red-600 text-slate-300 hover:text-white transition text-sm" aria-label="Fechar Player">✕</button>
        </div>`;
}

function playYoutubeAudio(title, url) {
    const playerBar = document.getElementById('fixed-player-bar');
    if (playerBar) {
        playerBar.style.display = 'block';
        playerBar.classList.remove('hidden');
    }

    const videoId = typeof extrairIdYoutube === 'function' ? extrairIdYoutube(url) : null;
    const titleEl = document.getElementById('nowPlayingTitle');
    if (titleEl) titleEl.textContent = `▶ ${title}`;
    const pc = document.getElementById('playerContainer');
    if (!pc) return;

    if (videoId) {
        const linkYt = `https://www.youtube.com/watch?v=${videoId}`;
        pc.innerHTML = `
            <div class="flex items-center gap-2 w-full">
                <div class="relative w-full rounded-lg overflow-hidden bg-black" style="height:180px;">
                    <iframe src="https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0" allow="autoplay; encrypted-media" allowfullscreen style="width:100%;height:100%;border:0;"></iframe>
                </div>
                <div class="flex flex-col gap-2 shrink-0">
                    <button onclick="abrirYoutubeEPausar('${linkYt}')" class="w-7 h-7 flex items-center justify-center rounded-full bg-red-700 hover:bg-red-500 text-white transition text-sm" title="Abrir no YouTube">↗</button>
                    <button onclick="fecharPlayer()" class="w-7 h-7 flex items-center justify-center rounded-full bg-slate-700 hover:bg-red-600 text-slate-300 hover:text-white transition text-sm" aria-label="Fechar Player">✕</button>
                </div>
            </div>`;
    } else {
        pc.innerHTML = '<span class="text-xs text-yellow-400">Link do YouTube inválido.</span>';
    }
}

function abrirYoutubeEPausar(url) {
    const pc = document.getElementById('playerContainer');
    if (pc) pc.innerHTML = '<span class="text-xs text-slate-400">Abrindo no YouTube...</span>';
    window.open(url, '_blank');
}

// Ocultar player por padrão ao carregar a página
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fecharPlayer);
} else {
    fecharPlayer();
}


