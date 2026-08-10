function fecharPlayer() {
    document.getElementById('nowPlayingTitle').textContent = 'Nenhuma música selecionada';
    document.getElementById('playerContainer').innerHTML = '<span class="text-xs text-slate-400">Clique em "▶ Ouvir VS" para carregar o player.</span>';
}

function playDriveAudio(title, fileId, rawValue) {
    document.getElementById('nowPlayingTitle').textContent = `Tocando: ${title}`;
    const pc = document.getElementById('playerContainer');
    if (fileId) {
        pc.innerHTML = `
            <div class="flex items-center gap-2 w-full">
                <div class="drive-player-wrapper flex-1">
                    <iframe src="https://drive.google.com/file/d/${fileId}/preview" allow="autoplay"></iframe>
                </div>
                <button onclick="fecharPlayer()" class="shrink-0 w-7 h-7 flex items-center justify-center rounded-full bg-slate-700 hover:bg-red-600 text-slate-300 hover:text-white transition text-sm">✕</button>
            </div>`;
    } else {
        pc.innerHTML = '<span class="text-xs text-yellow-400">Insira o link do Drive na planilha.</span>';
    }
}

function playYoutubeAudio(title, url) {
    const videoId = extrairIdYoutube(url);
    document.getElementById('nowPlayingTitle').textContent = `▶ ${title}`;
    const pc = document.getElementById('playerContainer');
    if (videoId) {
        const linkYt = `https://www.youtube.com/watch?v=${videoId}`;
        pc.innerHTML = `
            <div class="flex items-center gap-2 w-full">
                <div class="relative w-full rounded-lg overflow-hidden bg-black" style="height:180px;">
                    <iframe src="https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0" allow="autoplay; encrypted-media" allowfullscreen style="width:100%;height:100%;border:0;"></iframe>
                </div>
                <div class="flex flex-col gap-2 shrink-0">
                    <button onclick="abrirYoutubeEPausar('${linkYt}')" class="w-7 h-7 flex items-center justify-center rounded-full bg-red-700 hover:bg-red-500 text-white transition text-sm">↗</button>
                    <button onclick="fecharPlayer()" class="w-7 h-7 flex items-center justify-center rounded-full bg-slate-700 hover:bg-red-600 text-slate-300 hover:text-white transition text-sm">✕</button>
                </div>
            </div>`;
    } else {
        pc.innerHTML = '<span class="text-xs text-yellow-400">Link do YouTube inválido.</span>';
    }
}

function abrirYoutubeEPausar(url) {
    document.getElementById('playerContainer').innerHTML = '<span class="text-xs text-slate-400">Abrindo no YouTube...</span>';
    window.open(url, '_blank');
}
