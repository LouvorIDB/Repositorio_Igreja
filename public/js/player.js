// ============================================================================
// LITURGE PLAYER - REPRODUTOR OFICIAL COM SUPORTE À MEDIA SESSION API
// Permite controle nativo de áudio (Play/Pause, Seek, Próxima/Anterior)
// via Central de Notificações e Tela de Bloqueio no Celular (Android / iOS)
// ============================================================================

window.LiturgePlayer = (function () {
    let currentAudio = null;
    let currentPlaylist = [];
    let currentTrackIndex = -1;
    let currentTrackInfo = null;
    let isUserSeeking = false;
    let lastDriveId = null;

    function getOrCreateAudioElement() {
        let el = document.getElementById('liturgeGlobalAudio');
        if (!el) {
            el = document.createElement('audio');
            el.id = 'liturgeGlobalAudio';
            el.className = 'hidden';
            el.preload = 'metadata';
            document.body.appendChild(el);
        }
        return el;
    }

    function syncNativeAndroidMedia(info, isPlaying) {
        if (window.AndroidMedia && typeof window.AndroidMedia.updateMedia === 'function') {
            try {
                const track = info || currentTrackInfo || {};
                const title = track.title || 'Música Liturge';
                const artist = track.artist || 'Liturge • Louvor';
                const album = track.album || 'Repertório Liturge';
                const duration = (currentAudio && !isNaN(currentAudio.duration) && isFinite(currentAudio.duration)) ? currentAudio.duration : 0;
                const position = (currentAudio && !isNaN(currentAudio.currentTime) && isFinite(currentAudio.currentTime)) ? currentAudio.currentTime : 0;
                window.AndroidMedia.updateMedia(title, artist, album, duration, position, !!isPlaying);
            } catch (e) {
                console.warn('[LiturgePlayer] Erro ao sincronizar com AndroidMedia:', e);
            }
        }
    }

    function initAudioListeners() {
        if (!currentAudio) {
            currentAudio = getOrCreateAudioElement();
        }

        currentAudio.onplay = () => {
            if ('mediaSession' in navigator) {
                navigator.mediaSession.playbackState = 'playing';
            }
            atualizarIconePlayPause(true);
            syncPositionState();
            syncNativeAndroidMedia(currentTrackInfo, true);
        };

        currentAudio.onpause = () => {
            if ('mediaSession' in navigator) {
                navigator.mediaSession.playbackState = 'paused';
            }
            atualizarIconePlayPause(false);
            syncPositionState();
            syncNativeAndroidMedia(currentTrackInfo, false);
        };

        currentAudio.ontimeupdate = () => {
            if (isUserSeeking) return;
            const cur = currentAudio.currentTime || 0;
            const dur = currentAudio.duration || 0;

            const curEl = document.getElementById('liturgePlayerCurTime');
            if (curEl) curEl.textContent = formatarTempo(cur);

            const scrubber = document.getElementById('liturgePlayerScrubber');
            if (scrubber && dur > 0) {
                scrubber.value = ((cur / dur) * 100).toFixed(2);
            }
        };

        currentAudio.onloadedmetadata = () => {
            const dur = currentAudio.duration || 0;
            const durEl = document.getElementById('liturgePlayerDurTime');
            if (durEl) durEl.textContent = formatarTempo(dur);
            syncPositionState();
            syncNativeAndroidMedia(currentTrackInfo, !currentAudio.paused);
        };

        currentAudio.onended = () => {
            // Avança automaticamente para o próximo louvor se houver lista
            if (currentPlaylist.length > 1 && currentTrackIndex < currentPlaylist.length - 1) {
                tocarProxima();
            } else {
                if ('mediaSession' in navigator) {
                    navigator.mediaSession.playbackState = 'paused';
                }
                if (window.AndroidMedia && typeof window.AndroidMedia.stopMedia === 'function') {
                    try { window.AndroidMedia.stopMedia(); } catch (e) {}
                }
                atualizarIconePlayPause(false);
                const scrubber = document.getElementById('liturgePlayerScrubber');
                if (scrubber) scrubber.value = 0;
                const curEl = document.getElementById('liturgePlayerCurTime');
                if (curEl) curEl.textContent = '00:00';
            }
        };

        currentAudio.onerror = (e) => {
            console.warn('[LiturgePlayer] Erro no stream nativo de áudio:', e);
            // Se falhou o proxy do drive e ainda não tentamos o stream direto do Google
            if (lastDriveId && !currentAudio.dataset.triedFallback) {
                currentAudio.dataset.triedFallback = '1';
                console.log('[LiturgePlayer] Tentando fallback de stream direto do Drive...');
                currentAudio.src = `https://drive.usercontent.google.com/download?id=${encodeURIComponent(lastDriveId)}&export=download&authuser=0`;
                currentAudio.load();
                currentAudio.play().catch(console.warn);
                return;
            }

            // Exibe indicação clara sem desmontar os controles do player
            const curEl = document.getElementById('liturgePlayerCurTime');
            if (curEl) curEl.textContent = 'Erro';
            const durEl = document.getElementById('liturgePlayerDurTime');
            if (durEl && lastDriveId) {
                durEl.innerHTML = `<a href="https://drive.google.com/file/d/${lastDriveId}/view" target="_blank" class="text-amber-400 underline font-sans text-[10px]">Abrir Drive ↗</a>`;
            }
        };
    }

    function formatarTempo(segundos) {
        if (!segundos || isNaN(segundos) || !isFinite(segundos)) return '00:00';
        const s = Math.floor(segundos);
        const m = Math.floor(s / 60);
        const remSec = s % 60;
        const h = Math.floor(m / 60);
        const remMin = m % 60;
        if (h > 0) {
            return `${h}:${remMin < 10 ? '0' : ''}${remMin}:${remSec < 10 ? '0' : ''}${remSec}`;
        }
        return `${remMin < 10 ? '0' : ''}${remMin}:${remSec < 10 ? '0' : ''}${remSec}`;
    }

    function atualizarIconePlayPause(isTocando) {
        const icon = document.getElementById('liturgePlayerPlayPauseIcon');
        if (icon) {
            icon.textContent = isTocando ? '⏸' : '▶';
        }
    }

    function syncPositionState() {
        if (!('mediaSession' in navigator) || !('setPositionState' in navigator.mediaSession)) return;
        if (!currentAudio) return;

        const dur = currentAudio.duration;
        if (!isNaN(dur) && isFinite(dur) && dur > 0) {
            try {
                navigator.mediaSession.setPositionState({
                    duration: dur,
                    playbackRate: currentAudio.playbackRate || 1,
                    position: Math.min(Math.max(0, currentAudio.currentTime), dur)
                });
            } catch (e) {
                // Silencioso se o estado momentâneo estiver inconsistente
            }
        }
    }

    function setupMediaSession(info) {
        if (!('mediaSession' in navigator)) return;

        const origin = window.location.origin;
        const artwork = [
            { src: `${origin}/icon-192.png`, sizes: '192x192', type: 'image/png' },
            { src: `${origin}/icon-512.png`, sizes: '512x512', type: 'image/png' }
        ];

        try {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: info.title || 'Música Liturge',
                artist: info.artist || 'Liturge • Louvor',
                album: info.album || 'Repertório Liturge',
                artwork: artwork
            });
        } catch (err) {
            console.warn('[LiturgePlayer] Erro ao registrar MediaMetadata:', err);
        }

        const actions = [
            ['play', () => {
                if (currentAudio) currentAudio.play().catch(console.warn);
            }],
            ['pause', () => {
                if (currentAudio) currentAudio.pause();
            }],
            ['stop', () => {
                fechar();
            }],
            ['seekbackward', (details) => {
                if (!currentAudio) return;
                const skip = (details && details.seekOffset) || 10;
                currentAudio.currentTime = Math.max(0, currentAudio.currentTime - skip);
                syncPositionState();
            }],
            ['seekforward', (details) => {
                if (!currentAudio) return;
                const skip = (details && details.seekOffset) || 10;
                currentAudio.currentTime = Math.min(currentAudio.duration || Infinity, currentAudio.currentTime + skip);
                syncPositionState();
            }],
            ['seekto', (details) => {
                if (!currentAudio || !details || details.seekTime === undefined) return;
                if (details.fastSeek && 'fastSeek' in currentAudio) {
                    currentAudio.fastSeek(details.seekTime);
                } else {
                    currentAudio.currentTime = details.seekTime;
                }
                syncPositionState();
            }],
            ['previoustrack', () => {
                tocarAnterior();
            }],
            ['nexttrack', () => {
                tocarProxima();
            }]
        ];

        actions.forEach(([action, handler]) => {
            try {
                navigator.mediaSession.setActionHandler(action, handler);
            } catch (e) {
                // Navegador não suporta esta ação específica
            }
        });
    }

    function renderNativePlayerUI() {
        const pc = document.getElementById('playerContainer');
        if (!pc) return;

        const hasPlaylist = currentPlaylist.length > 1;
        const total = currentPlaylist.length;
        const currentPos = currentTrackIndex >= 0 ? currentTrackIndex + 1 : 1;

        pc.innerHTML = `
            <div class="flex items-center gap-2 sm:gap-3 w-full">
                <!-- Botões de Controle -->
                <div class="flex items-center gap-1 sm:gap-1.5 shrink-0 justify-center">
                    <button id="liturgePlayerPrevBtn" onclick="LiturgePlayer.tocarAnterior()" class="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition disabled:opacity-30 disabled:cursor-not-allowed text-xs cursor-pointer" title="Música Anterior / Reiniciar">
                        ⏮
                    </button>
                    <button id="liturgePlayerPlayPauseBtn" onclick="LiturgePlayer.togglePlayPause()" class="w-9 h-9 flex items-center justify-center rounded-lg bg-gradient-to-r from-liturge-500 to-amber-600 hover:from-liturge-400 hover:to-amber-500 text-night-950 font-bold transition shadow-sm text-sm cursor-pointer" title="Play / Pausar">
                        <span id="liturgePlayerPlayPauseIcon">⏸</span>
                    </button>
                    <button id="liturgePlayerNextBtn" onclick="LiturgePlayer.tocarProxima()" class="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition disabled:opacity-30 disabled:cursor-not-allowed text-xs cursor-pointer" title="Próxima Música">
                        ⏭
                    </button>
                </div>

                <!-- Barra de Progresso e Tempos -->
                <div class="flex-1 min-w-0 flex flex-col justify-center px-1">
                    <div class="flex items-center justify-between text-[10px] text-slate-400 mb-1 font-mono">
                        <span id="liturgePlayerCurTime">00:00</span>
                        <div class="flex items-center gap-1.5">
                            ${hasPlaylist ? `<span id="liturgePlayerQueueIndicator" class="text-[10px] text-liturge-400 font-sans font-semibold">${currentPos} de ${total}</span>` : ''}
                            <span class="text-[10px] text-emerald-400 flex items-center gap-1 font-sans" title="Áudio pronto para controle na tela de bloqueio e central de notificações">
                                <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                                <span class="hidden sm:inline">2º Plano Ativo</span>
                            </span>
                        </div>
                        <span id="liturgePlayerDurTime">00:00</span>
                    </div>
                    <input type="range" id="liturgePlayerScrubber" min="0" max="100" value="0" step="0.1" class="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-liturge-500">
                </div>

                <!-- Botão Fechar Desktop -->
                <div class="hidden md:flex items-center shrink-0">
                    <button onclick="fecharPlayer()" class="w-8 h-8 flex items-center justify-center rounded-full bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white transition text-xs cursor-pointer" aria-label="Fechar Player" title="Fechar Player">
                        ✕
                    </button>
                </div>
            </div>
        `;

        // Eventos do scrubber de tempo
        const scrubber = document.getElementById('liturgePlayerScrubber');
        if (scrubber) {
            scrubber.oninput = () => {
                isUserSeeking = true;
                if (currentAudio && currentAudio.duration) {
                    const seekTime = (scrubber.value / 100) * currentAudio.duration;
                    const curEl = document.getElementById('liturgePlayerCurTime');
                    if (curEl) curEl.textContent = formatarTempo(seekTime);
                }
            };
            scrubber.onchange = () => {
                if (currentAudio && currentAudio.duration) {
                    currentAudio.currentTime = (scrubber.value / 100) * currentAudio.duration;
                    syncPositionState();
                    if (window.AndroidMedia && typeof window.AndroidMedia.updatePosition === 'function') {
                        try {
                            window.AndroidMedia.updatePosition(currentAudio.currentTime, !currentAudio.paused);
                        } catch (e) {}
                    }
                }
                isUserSeeking = false;
            };
        }

        atualizarBotoesPlaylist();
    }

    function atualizarBotoesPlaylist() {
        const prevBtn = document.getElementById('liturgePlayerPrevBtn');
        const nextBtn = document.getElementById('liturgePlayerNextBtn');
        const hasPlaylist = currentPlaylist.length > 1;

        if (prevBtn) {
            prevBtn.disabled = !hasPlaylist && (!currentAudio || currentAudio.currentTime < 3);
        }
        if (nextBtn) {
            nextBtn.disabled = !hasPlaylist || currentTrackIndex >= currentPlaylist.length - 1;
        }

        const indicator = document.getElementById('liturgePlayerQueueIndicator');
        if (indicator && hasPlaylist) {
            indicator.textContent = `${currentTrackIndex + 1} de ${currentPlaylist.length}`;
            indicator.classList.remove('hidden');
        }
    }

    function tocarFaixaPorIndice(index) {
        if (index < 0 || index >= currentPlaylist.length) return;
        currentTrackIndex = index;
        const track = currentPlaylist[index];
        playDriveAudio(track.title, track.fileIdOrUrl, {
            artist: track.artist,
            album: track.album,
            skipPlaylistReset: true
        });
    }

    function tocarProxima() {
        if (currentPlaylist.length > 0 && currentTrackIndex < currentPlaylist.length - 1) {
            tocarFaixaPorIndice(currentTrackIndex + 1);
        }
    }

    function tocarAnterior() {
        if (currentAudio && currentAudio.currentTime > 3) {
            currentAudio.currentTime = 0;
            syncPositionState();
            return;
        }
        if (currentPlaylist.length > 0 && currentTrackIndex > 0) {
            tocarFaixaPorIndice(currentTrackIndex - 1);
        } else if (currentAudio) {
            currentAudio.currentTime = 0;
            syncPositionState();
        }
    }

    function togglePlayPause(forceState) {
        if (!currentAudio) return;
        const shouldPlay = typeof forceState === 'boolean' ? forceState : currentAudio.paused;
        if (shouldPlay) {
            currentAudio.play().catch(console.warn);
        } else {
            currentAudio.pause();
        }
    }

    function seekTo(segundos) {
        if (!currentAudio) return;
        const target = Math.max(0, Math.min(currentAudio.duration || Infinity, segundos));
        currentAudio.currentTime = target;
        syncPositionState();
        if (window.AndroidMedia && typeof window.AndroidMedia.updatePosition === 'function') {
            try {
                window.AndroidMedia.updatePosition(target, !currentAudio.paused);
            } catch (e) {}
        }
    }

    function playDriveAudio(title, fileIdOrUrl, options = {}) {
        initAudioListeners();

        const playerBar = document.getElementById('fixed-player-bar');
        if (playerBar) {
            playerBar.style.display = 'block';
            playerBar.classList.remove('hidden');
        }

        const titleEl = document.getElementById('nowPlayingTitle');
        if (titleEl) titleEl.textContent = `Tocando: ${title}`;

        const subEl = document.getElementById('nowPlayingSubtitle');
        const artist = options.artist || 'Liturge • Louvor';
        const album = options.album || 'Repertório Liturge';
        if (subEl) {
            subEl.textContent = `${artist} • ${album}`;
        }

        const pc = document.getElementById('playerContainer');
        if (!pc) return;

        if (!fileIdOrUrl) {
            pc.innerHTML = '<span class="text-xs text-yellow-400">Nenhum áudio/VS cadastrado.</span>';
            return;
        }

        let strUrl = fileIdOrUrl.toString().trim();
        lastDriveId = null;

        // Gerenciamento da fila de reprodução
        if (!options.skipPlaylistReset) {
            if (options.playlist && Array.isArray(options.playlist) && options.playlist.length > 0) {
                currentPlaylist = options.playlist;
                currentTrackIndex = typeof options.trackIndex === 'number' ? options.trackIndex : 0;
            } else {
                currentPlaylist = [{ title, fileIdOrUrl, artist, album }];
                currentTrackIndex = 0;
            }
        }

        currentTrackInfo = { title, artist, album, url: strUrl };

        // Dispara imediatamente o controle nativo do Android para aparecer na hora do clique
        setupMediaSession(currentTrackInfo);
        syncNativeAndroidMedia(currentTrackInfo, true);

        let streamUrl = null;

        // 1. URLs Diretas (Cloudflare Worker/R2, Supabase Storage, CDN ou arquivo de áudio)
        if (strUrl.startsWith('http://') || strUrl.startsWith('https://')) {
            if (
                strUrl.includes('workers.dev') ||
                strUrl.includes('r2.cloudflarestorage') ||
                strUrl.includes('supabase') ||
                strUrl.includes('/storage/') ||
                strUrl.includes('/vs_tracks/') ||
                strUrl.match(/\.(mp3|wav|m4a|ogg|flac|aac)(\?.*)?$/i)
            ) {
                streamUrl = strUrl;
            } else {
                // Extrai ID do Google Drive se for link completo
                const match = strUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
                if (match && match[1]) {
                    fileIdOrUrl = match[1];
                } else {
                    const matchId = strUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
                    if (matchId && matchId[1]) {
                        fileIdOrUrl = matchId[1];
                    }
                }
            }
        }

        // 2. Se for arquivo do Google Drive (ID isolado ou extraído do link)
        if (!streamUrl) {
            const driveId = fileIdOrUrl.toString().trim();
            lastDriveId = driveId;
            const apiBase = (window.location.origin && !window.location.origin.startsWith('capacitor://') && !window.location.origin.startsWith('file://'))
                ? window.location.origin
                : 'https://liturge-dev.vercel.app';
            streamUrl = `${apiBase}/api/drive-stream?id=${encodeURIComponent(driveId)}`;
        }

        renderNativePlayerUI();
        delete currentAudio.dataset.triedFallback;
        currentAudio.removeAttribute('crossorigin');
        currentAudio.src = streamUrl;
        currentAudio.load();

        const playPromise = currentAudio.play();
        if (playPromise !== undefined) {
            playPromise.then(() => {
                atualizarIconePlayPause(true);
                syncNativeAndroidMedia(currentTrackInfo, true);
            }).catch((err) => {
                console.warn('[LiturgePlayer] Play aguardando interação do usuário:', err);
                atualizarIconePlayPause(false);
            });
        }
        if (window.AndroidMedia && typeof window.AndroidMedia.requestNotificationPermission === 'function') {
            try { window.AndroidMedia.requestNotificationPermission(); } catch (e) {}
        }
        syncNativeAndroidMedia(currentTrackInfo, true);
    }

    function fechar() {
        if (window.AndroidMedia && typeof window.AndroidMedia.stopMedia === 'function') {
            try { window.AndroidMedia.stopMedia(); } catch (e) {}
        }

        if (currentAudio) {
            currentAudio.pause();
            currentAudio.removeAttribute('src');
            currentAudio.load();
        }

        if ('mediaSession' in navigator) {
            navigator.mediaSession.playbackState = 'none';
            try {
                navigator.mediaSession.metadata = null;
            } catch (e) {
                // Silencioso
            }
        }

        currentTrackInfo = null;
        lastDriveId = null;

        const playerBar = document.getElementById('fixed-player-bar');
        if (playerBar) {
            playerBar.style.display = 'none';
            playerBar.classList.add('hidden');
        }

        const titleEl = document.getElementById('nowPlayingTitle');
        if (titleEl) titleEl.textContent = 'Nenhuma música selecionada';

        const subEl = document.getElementById('nowPlayingSubtitle');
        if (subEl) subEl.textContent = 'Player Oficial Liturge';

        const pc = document.getElementById('playerContainer');
        if (!pc) return;
        pc.innerHTML = '<span class="text-xs text-slate-400">Clique em "▶ Ouvir VS" para carregar o player.</span>';
    }

    function tocarDoCulto(playlistId, trackIndex) {
        if (window.liturgeCultosPlaylists && window.liturgeCultosPlaylists[playlistId]) {
            const list = window.liturgeCultosPlaylists[playlistId];
            if (list[trackIndex]) {
                currentPlaylist = list;
                currentTrackIndex = trackIndex;
                const track = list[trackIndex];
                playDriveAudio(track.title, track.fileIdOrUrl, {
                    artist: track.artist,
                    album: track.album,
                    skipPlaylistReset: true
                });
            }
        }
    }

    return {
        playDriveAudio,
        tocarDoCulto,
        tocarProxima,
        tocarAnterior,
        togglePlayPause,
        seekTo,
        fechar,
        tentarStreamDireto: () => {
            if (lastDriveId && currentTrackInfo) {
                playDriveAudio(currentTrackInfo.title, lastDriveId, {
                    artist: currentTrackInfo.artist,
                    album: currentTrackInfo.album
                });
            }
        }
    };
})();

// ============================================================================
// FUNÇÕES GLOBAIS DE COMPATIBILIDADE
// Mantém 100% de compatibilidade com chamadas legadas em todo o app
// ============================================================================

function fecharPlayer() {
    LiturgePlayer.fechar();
}

function playDriveAudio(title, fileIdOrUrl, options) {
    LiturgePlayer.playDriveAudio(title, fileIdOrUrl, options);
}

function playYoutubeAudio(title, url) {
    // Pausa qualquer áudio em reprodução antes de abrir o vídeo
    LiturgePlayer.fechar();

    const playerBar = document.getElementById('fixed-player-bar');
    if (playerBar) {
        playerBar.style.display = 'block';
        playerBar.classList.remove('hidden');
    }

    const videoId = typeof extrairIdYoutube === 'function' ? extrairIdYoutube(url) : null;
    const titleEl = document.getElementById('nowPlayingTitle');
    if (titleEl) titleEl.textContent = `▶ ${title}`;

    const subEl = document.getElementById('nowPlayingSubtitle');
    if (subEl) subEl.textContent = 'Vídeo do YouTube';

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

// Ocultar player por padrão ao inicializar
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fecharPlayer);
} else {
    fecharPlayer();
}


