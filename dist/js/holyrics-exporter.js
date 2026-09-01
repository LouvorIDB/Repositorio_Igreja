// =====================================================================
// EXPORTADOR E CONFIGURADOR DE PLAYLISTS PARA HOLYRICS (h.hly)
// LouvorIDB SaaS — Geração nativa e personalizada de scripts Holyrics
// =====================================================================

const PADRAO_SECOES_HOLYRICS = [
    { id: 'sec_1', name: 'IMAGENS', color: '#1633A4', content_type: 'images' },
    { id: 'sec_2', name: 'INSTRUMENTAIS', color: '#9D1443', content_type: 'empty' },
    { id: 'sec_3', name: 'AVISOS', color: '#70671A', content_type: 'empty' },
    { id: 'sec_4', name: 'FUNÇÕES', color: '#337636', content_type: 'empty' },
    { id: 'sec_5', name: 'BÍBLIA', color: '#AC3B17', content_type: 'empty' },
    { id: 'sec_6', name: 'LETRAS', color: '#00C9FF', content_type: 'songs' }
];

let secoesHolyricsConfig = [...PADRAO_SECOES_HOLYRICS];

/**
 * Carrega as preferências de seções do Holyrics para a igreja atual
 */
function carregarConfiguracaoHolyrics() {
    const userToEvaluate = (typeof modoSimulacaoPerfil !== 'undefined' ? modoSimulacaoPerfil : null) || (typeof usuarioLogado !== 'undefined' ? usuarioLogado : null);
    const churchId = userToEvaluate?.church_id || window.dadosGlobais?.church?.id || 'default';

    const salvo = localStorage.getItem('holyrics_template_' + churchId);
    if (salvo) {
        try {
            secoesHolyricsConfig = JSON.parse(salvo);
        } catch (e) {
            secoesHolyricsConfig = [...PADRAO_SECOES_HOLYRICS];
        }
    } else {
        secoesHolyricsConfig = [...PADRAO_SECOES_HOLYRICS];
    }

    renderizarEditorHolyrics();
    renderizarPreviewHolyrics();
}

/**
 * Renderiza os blocos editáveis na lista do configurador
 */
function renderizarEditorHolyrics() {
    const container = document.getElementById('lista-secoes-holyrics');
    if (!container) return;

    if (!secoesHolyricsConfig || secoesHolyricsConfig.length === 0) {
        container.innerHTML = `
            <div class="text-center py-6 text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl">
                Nenhuma seção cadastrada. Clique em "+ Adicionar Seção" acima.
            </div>
        `;
        return;
    }

    container.innerHTML = secoesHolyricsConfig.map((sec, idx) => {
        const isPrimeiro = idx === 0;
        const isUltimo = idx === secoesHolyricsConfig.length - 1;

        return `
            <div class="bg-slate-950 border border-slate-800 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 group hover:border-slate-700 transition shadow-md">
                
                <!-- Ordem e Cor -->
                <div class="flex items-center gap-3">
                    <div class="flex flex-col gap-0.5">
                        <button onclick="moverSecaoHolyrics('${sec.id}', -1)" ${isPrimeiro ? 'disabled' : ''} 
                            class="p-1 text-slate-400 hover:text-white disabled:opacity-20 disabled:hover:text-slate-400 text-[10px] bg-slate-900 rounded border border-slate-800 transition leading-none">▲</button>
                        <button onclick="moverSecaoHolyrics('${sec.id}', 1)" ${isUltimo ? 'disabled' : ''} 
                            class="p-1 text-slate-400 hover:text-white disabled:opacity-20 disabled:hover:text-slate-400 text-[10px] bg-slate-900 rounded border border-slate-800 transition leading-none">▼</button>
                    </div>

                    <div class="relative flex items-center justify-center">
                        <input type="color" value="${sec.color || '#1633A4'}" 
                            onchange="atualizarCampoSecao('${sec.id}', 'color', this.value)"
                            class="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0 p-0 overflow-hidden">
                    </div>

                    <!-- Nome da Seção -->
                    <div class="flex-1 min-w-[140px]">
                        <label class="block text-[10px] text-slate-500 font-medium uppercase tracking-wider mb-0.5">Título no Holyrics</label>
                        <input type="text" value="${sec.name || ''}" 
                            oninput="atualizarCampoSecao('${sec.id}', 'name', this.value)"
                            placeholder="Ex: IMAGENS, AVISOS"
                            class="w-full bg-slate-900 border border-slate-700 px-2.5 py-1.5 rounded-lg text-xs font-bold text-white focus:outline-none focus:border-cyan-500">
                    </div>
                </div>

                <!-- Conteúdo Vinculado e Ações -->
                <div class="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
                    <div class="flex-1 sm:flex-initial min-w-[170px]">
                        <label class="block text-[10px] text-slate-500 font-medium uppercase tracking-wider mb-0.5">Tipo de Conteúdo</label>
                        <select onchange="atualizarCampoSecao('${sec.id}', 'content_type', this.value)"
                            class="w-full bg-slate-900 border border-slate-700 px-2.5 py-1.5 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-cyan-500">
                            <option value="empty" ${sec.content_type === 'empty' ? 'selected' : ''}>🏷️ Apenas Título Vazio</option>
                            <option value="images" ${sec.content_type === 'images' ? 'selected' : ''}>🖼️ Imagens do Culto</option>
                            <option value="songs" ${sec.content_type === 'songs' ? 'selected' : ''}>🎵 Músicas do Repertório</option>
                            <option value="audios" ${sec.content_type === 'audios' ? 'selected' : ''}>🎧 Instrumentais / Áudios</option>
                            <option value="videos" ${sec.content_type === 'videos' ? 'selected' : ''}>🎬 Vídeos do Culto</option>
                        </select>
                    </div>

                    <button onclick="removerSecaoHolyrics('${sec.id}')" 
                        class="self-end sm:self-center p-2 text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 rounded-lg transition" title="Excluir Seção">
                        🗑️
                    </button>
                </div>

            </div>
        `;
    }).join('');
}

/**
 * Renderiza o Simulador Visual idêntico ao Holyrics
 */
function renderizarPreviewHolyrics() {
    const container = document.getElementById('preview-playlist-holyrics');
    if (!container) return;

    if (!secoesHolyricsConfig || secoesHolyricsConfig.length === 0) {
        container.innerHTML = `
            <div class="text-center py-12 text-zinc-600 text-xs">
                Playlist vazia
            </div>
        `;
        return;
    }

    container.innerHTML = secoesHolyricsConfig.map(sec => {
        let itensSimuladosHtml = '';

        if (sec.content_type === 'images') {
            itensSimuladosHtml = `
                <div class="pl-5 pr-2 py-1.5 bg-zinc-900/60 hover:bg-zinc-800/80 rounded flex items-center gap-2.5 text-xs text-zinc-300 transition my-0.5">
                    <span class="text-xs">🖼️</span>
                    <span class="truncate font-medium">FUNDO_CULTO.png</span>
                </div>
                <div class="pl-5 pr-2 py-1.5 bg-zinc-900/60 hover:bg-zinc-800/80 rounded flex items-center gap-2.5 text-xs text-zinc-300 transition my-0.5">
                    <span class="text-xs">🖼️</span>
                    <span class="truncate font-medium">AVISO_SANTA_CEIA.jpeg</span>
                </div>
            `;
        } else if (sec.content_type === 'songs') {
            itensSimuladosHtml = `
                <div class="pl-5 pr-2 py-1.5 bg-zinc-900/60 hover:bg-zinc-800/80 rounded flex items-center gap-2.5 text-xs text-cyan-300 transition my-0.5">
                    <span class="text-xs">🎵</span>
                    <span class="truncate font-medium">Te Esperamos</span>
                    <span class="text-[10px] text-zinc-500 ml-auto">Tom B</span>
                </div>
                <div class="pl-5 pr-2 py-1.5 bg-zinc-900/60 hover:bg-zinc-800/80 rounded flex items-center gap-2.5 text-xs text-cyan-300 transition my-0.5">
                    <span class="text-xs">🎵</span>
                    <span class="truncate font-medium">Canção de Simeão</span>
                    <span class="text-[10px] text-zinc-500 ml-auto">Tom A</span>
                </div>
                <div class="pl-5 pr-2 py-1.5 bg-zinc-900/60 hover:bg-zinc-800/80 rounded flex items-center gap-2.5 text-xs text-cyan-300 transition my-0.5">
                    <span class="text-xs">🎵</span>
                    <span class="truncate font-medium">Ele é Exaltado</span>
                    <span class="text-[10px] text-zinc-500 ml-auto">Tom G</span>
                </div>
            `;
        } else if (sec.content_type === 'audios') {
            itensSimuladosHtml = `
                <div class="pl-5 pr-2 py-1.5 bg-zinc-900/60 hover:bg-zinc-800/80 rounded flex items-center gap-2.5 text-xs text-rose-300 transition my-0.5">
                    <span class="text-xs">🎧</span>
                    <span class="truncate font-medium">Instrumental_Oracao.mp3</span>
                </div>
            `;
        } else if (sec.content_type === 'videos') {
            itensSimuladosHtml = `
                <div class="pl-5 pr-2 py-1.5 bg-zinc-900/60 hover:bg-zinc-800/80 rounded flex items-center gap-2.5 text-xs text-emerald-300 transition my-0.5">
                    <span class="text-xs">🎬</span>
                    <span class="truncate font-medium">Video_Abertura.mp4</span>
                </div>
            `;
        }

        return `
            <div class="space-y-0.5 mb-1.5">
                <!-- Cabeçalho Colorido Estilo Holyrics -->
                <div class="flex items-center gap-2 px-3 py-1 rounded text-white font-bold text-xs shadow" 
                    style="background-color: ${sec.color || '#1633A4'};">
                    <span class="text-[10px] opacity-80">−</span>
                    <span class="tracking-wide uppercase">${sec.name || 'SEÇÃO'}</span>
                </div>
                
                <!-- Itens Filhos Simulados -->
                ${itensSimuladosHtml}
            </div>
        `;
    }).join('');
}

function adicionarSecaoHolyrics() {
    const nova = {
        id: 'sec_' + Date.now(),
        name: 'NOVA SEÇÃO',
        color: '#4F46E5',
        content_type: 'empty'
    };
    secoesHolyricsConfig.push(nova);
    renderizarEditorHolyrics();
    renderizarPreviewHolyrics();
}

function removerSecaoHolyrics(id) {
    if (secoesHolyricsConfig.length <= 1) {
        if (typeof mostrarToast === 'function') mostrarToast('Você precisa manter pelo menos 1 seção.', 'aviso');
        return;
    }
    secoesHolyricsConfig = secoesHolyricsConfig.filter(s => s.id !== id);
    renderizarEditorHolyrics();
    renderizarPreviewHolyrics();
}

function moverSecaoHolyrics(id, direcao) {
    const idx = secoesHolyricsConfig.findIndex(s => s.id === id);
    if (idx === -1) return;
    const novoIdx = idx + direcao;
    if (novoIdx < 0 || novoIdx >= secoesHolyricsConfig.length) return;

    const item = secoesHolyricsConfig.splice(idx, 1)[0];
    secoesHolyricsConfig.splice(novoIdx, 0, item);

    renderizarEditorHolyrics();
    renderizarPreviewHolyrics();
}

function atualizarCampoSecao(id, campo, valor) {
    const sec = secoesHolyricsConfig.find(s => s.id === id);
    if (sec) {
        sec[campo] = valor;
        renderizarPreviewHolyrics();
    }
}

function salvarConfiguracaoHolyrics() {
    const userToEvaluate = (typeof modoSimulacaoPerfil !== 'undefined' ? modoSimulacaoPerfil : null) || (typeof usuarioLogado !== 'undefined' ? usuarioLogado : null);
    const churchId = userToEvaluate?.church_id || window.dadosGlobais?.church?.id || 'default';

    localStorage.setItem('holyrics_template_' + churchId, JSON.stringify(secoesHolyricsConfig));
    if (typeof mostrarToast === 'function') mostrarToast('Estrutura da Playlist salva com sucesso!', 'sucesso');
}

function restaurarPadraoHolyrics() {
    if (!confirm('Deseja restaurar as seções padrão do Holyrics?')) return;
    secoesHolyricsConfig = JSON.parse(JSON.stringify(PADRAO_SECOES_HOLYRICS));
    salvarConfiguracaoHolyrics();
    renderizarEditorHolyrics();
    renderizarPreviewHolyrics();
}

/**
 * Extrai a lista de músicas de um culto (suporta formato relacional e lista plana)
 */
function extrairMusicasDoCulto(cultoIdentificador) {
    const cultos = typeof Store !== 'undefined' ? Store.getCultos() : [];
    
    let service = Array.isArray(cultos) 
        ? cultos.find(c => c && typeof c === 'object' && String(c.id) === String(cultoIdentificador))
        : null;
    
    if (service && service.service_songs) {
        const musicasFormatadas = (service.service_songs || [])
            .sort((a, b) => (a.order || 0) - (b.order || 0))
            .map(ss => {
                const ver = ss.song_versions || {};
                const song = ver.songs || ss.songs || {};
                return {
                    title: song.title || ss.song_name || 'Música',
                    holyrics_id: song.holyrics_id || null,
                    key: ver.key || ss.key || '',
                    singer: ss.singers_list || ''
                };
            });

        return {
            title: service.title || 'Culto',
            date: service.date || '',
            musicas: musicasFormatadas
        };
    }

    return null;
}

/**
 * Gera o Script Master do Holyrics para a igreja com base na estrutura configurada
 */
function gerarScriptMasterHolyrics(churchIdCustom) {
    const userToEvaluate = (typeof modoSimulacaoPerfil !== 'undefined' ? modoSimulacaoPerfil : null) || (typeof usuarioLogado !== 'undefined' ? usuarioLogado : null);
    const churchId = churchIdCustom || userToEvaluate?.church_id || window.dadosGlobais?.church?.id || 'ae125cfd-96ef-4324-b1f0-f96a4f34eecf';

    const secoesJSON = JSON.stringify(secoesHolyricsConfig || PADRAO_SECOES_HOLYRICS);
    const supabaseUrlFinal = typeof SUPABASE_URL !== 'undefined' ? SUPABASE_URL : 'https://pfhkzgccoirosztjcyrh.supabase.co';
    const supabaseKeyFinal = typeof SUPABASE_ANON_KEY !== 'undefined' ? SUPABASE_ANON_KEY : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBmaGt6Z2Njb2lyb3N6dGpjeXJoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY0NzY1MzgsImV4cCI6MjEwMjA1MjUzOH0.iFOlq-AXEmiTqCI2TsCblvzq_fp8YeadSr3vEFlgs9U';

    const scriptCode = `function scriptAction(obj) {
    var SUPABASE_URL = '${supabaseUrlFinal}';
    var API_KEY = '${supabaseKeyFinal}';
    
    // ID Único da Igreja no LouvorIDB
    var CHURCH_ID = '${churchId}';

    // Estrutura de Seções Personalizada pelo Painel Liturge
    var SECOES_CONFIG = ${secoesJSON};

    // =========================================================
    // PASSO 1: Detectar a data da lista selecionada no Holyrics
    // =========================================================
    var playlistInfo = h.getPlaylistInfo();
    var dataCultoStr;

    if (playlistInfo && playlistInfo.datetime) {
        dataCultoStr = playlistInfo.datetime.split(' ')[0];
        h.log('📅 Lista selecionada: ' + (playlistInfo.name || 'Culto') + ' - ' + dataCultoStr);
    } else {
        dataCultoStr = h.date.format('yyyy-MM-dd');
        h.log('⚠️ Nenhuma lista selecionada. Usando data de hoje: ' + dataCultoStr);
    }

    var parts = dataCultoStr.split('-');
    var d = new Date(parts[0], parts[1] - 1, parts[2]);
    d.setDate(d.getDate() + 1);
    var anoP = d.getFullYear();
    var mesP = (d.getMonth() + 1 < 10 ? '0' : '') + (d.getMonth() + 1);
    var diaP = (d.getDate() < 10 ? '0' : '') + d.getDate();
    var proxDiaStr = anoP + '-' + mesP + '-' + diaP;

    // =========================================================
    // PASSO 2: Buscar culto da igreja especificada na API
    // =========================================================
    h.log('🔍 Buscando culto da igreja na data: ' + dataCultoStr);

    var urlCulto = SUPABASE_URL + '/rest/v1/services?select=id,date,media_urls&church_id=eq.' + CHURCH_ID + '&date=gte.' + dataCultoStr + '&date=lt.' + proxDiaStr + '&order=date.asc&limit=1';
    var cultosRes = h.apiRequest(urlCulto, {
        headers: { 'apikey': API_KEY, 'Authorization': 'Bearer ' + API_KEY }
    });

    if (!cultosRes) {
        h.log('❌ Erro de conexão com a API: ' + (h.getApiRequestLastError() || 'Verifique as Requisições Permitidas.'));
        return;
    }

    var cultos = JSON.parse(cultosRes);
    if (!cultos || cultos.length === 0) {
        h.log('⚠️ Nenhum culto encontrado para a data: ' + dataCultoStr);
        return;
    }

    var culto = cultos[0];
    h.log('✅ Culto localizado (ID: ' + culto.id + ' | Data: ' + culto.date.split('T')[0] + ')');

    // =========================================================
    // PASSO 3: Buscar mídias e músicas da API
    // =========================================================
    var urlMidias = SUPABASE_URL + '/rest/v1/church_media?select=id,file_name,file_url,mime_type&church_id=eq.' + CHURCH_ID + '&created_at=gte.' + dataCultoStr + '&created_at=lt.' + proxDiaStr + '&order=created_at.asc';
    var midiasRes = h.apiRequest(urlMidias, {
        headers: { 'apikey': API_KEY, 'Authorization': 'Bearer ' + API_KEY }
    });

    var listaMidias = [];
    if (midiasRes) {
        try { listaMidias = JSON.parse(midiasRes) || []; } catch (eMidias) {}
    }

    if (culto.media_urls && Array.isArray(culto.media_urls)) {
        for (var u = 0; u < culto.media_urls.length; u++) {
            var mUrl = culto.media_urls[u];
            var jaExiste = false;
            for (var k = 0; k < listaMidias.length; k++) {
                if (listaMidias[k].file_name === mUrl.name || listaMidias[k].file_url === mUrl.url) {
                    jaExiste = true;
                    break;
                }
            }
            if (!jaExiste) {
                listaMidias.push({ file_name: mUrl.name, file_url: mUrl.url });
            }
        }
    }

    var musicasRes = h.apiRequest(SUPABASE_URL + '/rest/v1/service_songs?select=*,song_versions(songs(title))&service_id=eq.' + culto.id + '&order=song_order.asc', {
        headers: { 'apikey': API_KEY, 'Authorization': 'Bearer ' + API_KEY }
    });

    var listaMusicas = [];
    if (musicasRes) {
        try { listaMusicas = JSON.parse(musicasRes) || []; } catch (eMusicas) {}
    }

    function baixarArquivoParaPasta(fileUrl, fileName, subFolder) {
        // Tentar via Java IO se disponível
        try {
            var URLClass = null;
            var FileClass = null;
            var FileOutputStreamClass = null;
            
            try {
                if (typeof Java !== 'undefined' && Java.type) {
                    URLClass = Java.type('java.net.URL');
                    FileClass = Java.type('java.io.File');
                    FileOutputStreamClass = Java.type('java.io.FileOutputStream');
                } else if (typeof Packages !== 'undefined' && Packages && Packages.java) {
                    URLClass = Packages.java.net.URL;
                    FileClass = Packages.java.io.File;
                    FileOutputStreamClass = Packages.java.io.FileOutputStream;
                }
            } catch (eClass) {}

            if (URLClass && FileClass && FileOutputStreamClass) {
                var urlObj = new URLClass(fileUrl);
                var conn = urlObj.openConnection();
                conn.setRequestProperty("User-Agent", "Mozilla/5.0");
                conn.setConnectTimeout(8000);
                conn.setReadTimeout(20000);
                var inStream = conn.getInputStream();
                
                var possibleDirs = [
                    "files/media/" + subFolder,
                    "files/" + subFolder,
                    "media/" + subFolder,
                    subFolder
                ];
                var destDir = null;
                for (var p = 0; p < possibleDirs.length; p++) {
                    var d = new FileClass(possibleDirs[p]);
                    if (d.exists() && d.isDirectory()) { destDir = d; break; }
                }
                if (!destDir) { destDir = new FileClass("files/media/" + subFolder); destDir.mkdirs(); }
                
                var targetFile = new FileClass(destDir, fileName);
                var outStream = new FileOutputStreamClass(targetFile);
                try {
                    inStream.transferTo(outStream);
                } catch (eTransfer) {
                    var b;
                    while ((b = inStream.read()) !== -1) { outStream.write(b); }
                }
                outStream.flush();
                outStream.close();
                inStream.close();
                h.log('💾 Arquivo salvo (' + subFolder + '): ' + targetFile.getPath());
                return true;
            }
        } catch (errDl) {
            h.log('⚠️ Aviso download ' + subFolder + ': ' + errDl);
        }
        return false;
    }

    // =========================================================
    // PASSO 4: Montar a Playlist do Holyrics conforme a estrutura
    // =========================================================
    h.log('🎬 Montando estrutura de seções configurada...');

    var imagensLocais = [];
    var audiosLocais = [];
    var videosLocais = [];
    try { imagensLocais = h.files.getImages() || []; } catch(eImgs) {}
    try { audiosLocais = h.files.getAudios() || []; } catch(eAuds) {}
    try { videosLocais = h.files.getVideos() || []; } catch(eVids) {}

    for (var s = 0; s < SECOES_CONFIG.length; s++) {
        var sec = SECOES_CONFIG[s];
        var hexCor = (sec.color || '#1633A4').replace('#', '');
        
        // 1. Criar o cabeçalho da seção
        h.hly('AddToPlaylist', { items: [{ type: "title", name: sec.name, background_color: hexCor }] });

        // 2. Inserir IMAGENS
        if (sec.content_type === 'images' && listaMidias.length > 0) {
            for (var m = 0; m < listaMidias.length; m++) {
                var midia = listaMidias[m];
                var isImg = /\\.(png|jpe?g|gif|webp|bmp)$/i.test(midia.file_name || '');
                if (isImg && midia.file_name) {
                    var nomeAlvo = (midia.file_name || '').toLowerCase();
                    var nomeSemExt = nomeAlvo.replace(/\\.[^/.]+$/, '');
                    var imgMatch = null;
                    for (var imgIdx = 0; imgIdx < imagensLocais.length; imgIdx++) {
                        var iName = (imagensLocais[imgIdx].name || imagensLocais[imgIdx].filename || '').toLowerCase();
                        var iSemExt = iName.replace(/\\.[^/.]+$/, '');
                        if (iName === nomeAlvo || iSemExt === nomeSemExt) {
                            imgMatch = imagensLocais[imgIdx];
                            break;
                        }
                    }
                    var fileFinal = imgMatch ? imgMatch.name : midia.file_name;
                    if (!imgMatch && midia.file_url) baixarArquivoParaPasta(midia.file_url, midia.file_name, 'image');
                    try {
                        h.hly('AddToPlaylist', { 
                            items: [{ 
                                type: 'image', 
                                name: fileFinal,
                                title: fileFinal,
                                file: fileFinal 
                            }] 
                        });
                        h.log('🖼️ Imagem adicionada: ' + fileFinal);
                    } catch (errHly) {}
                }
            }
        }

        // 3. Inserir ÁUDIOS / INSTRUMENTAIS
        if (sec.content_type === 'audios' && listaMidias.length > 0) {
            for (var m = 0; m < listaMidias.length; m++) {
                var midia = listaMidias[m];
                var isAudio = /\\.(mp3|wav|m4a|aac|ogg|wma)$/i.test(midia.file_name || '');
                if (isAudio && midia.file_name) {
                    var nomeAlvo = (midia.file_name || '').toLowerCase();
                    var nomeSemExt = nomeAlvo.replace(/\\.[^/.]+$/, '');
                    var audioMatch = null;
                    for (var audIdx = 0; audIdx < audiosLocais.length; audIdx++) {
                        var aName = (audiosLocais[audIdx].name || audiosLocais[audIdx].filename || '').toLowerCase();
                        var aSemExt = aName.replace(/\\.[^/.]+$/, '');
                        if (aName === nomeAlvo || aSemExt === nomeSemExt) {
                            audioMatch = audiosLocais[audIdx];
                            break;
                        }
                    }
                    var fileFinal = audioMatch ? audioMatch.name : midia.file_name;
                    if (!audioMatch && midia.file_url) baixarArquivoParaPasta(midia.file_url, midia.file_name, 'audio');
                    try {
                        h.hly('AddToPlaylist', { 
                            items: [{ 
                                type: 'audio', 
                                name: fileFinal,
                                title: fileFinal,
                                file: fileFinal 
                            }] 
                        });
                        h.log('🎧 Áudio adicionado: ' + fileFinal + (audioMatch ? ' (Localizado na biblioteca)' : ' (Aguardando arquivo na biblioteca de Áudio)'));
                    } catch (errHly) {}
                }
            }
        }

        // 4. Inserir VÍDEOS
        if (sec.content_type === 'videos' && listaMidias.length > 0) {
            for (var m = 0; m < listaMidias.length; m++) {
                var midia = listaMidias[m];
                var isVideo = /\\.(mp4|mkv|mov|webm|avi)$/i.test(midia.file_name || '');
                if (isVideo && midia.file_name) {
                    var nomeAlvo = (midia.file_name || '').toLowerCase();
                    var nomeSemExt = nomeAlvo.replace(/\\.[^/.]+$/, '');
                    var videoMatch = null;
                    for (var vidIdx = 0; vidIdx < videosLocais.length; vidIdx++) {
                        var vName = (videosLocais[vidIdx].name || videosLocais[vidIdx].filename || '').toLowerCase();
                        var vSemExt = vName.replace(/\\.[^/.]+$/, '');
                        if (vName === nomeAlvo || vSemExt === nomeSemExt) {
                            videoMatch = videosLocais[vidIdx];
                            break;
                        }
                    }
                    var fileFinal = videoMatch ? videoMatch.name : midia.file_name;
                    if (!videoMatch && midia.file_url) baixarArquivoParaPasta(midia.file_url, midia.file_name, 'video');
                    try {
                        h.hly('AddToPlaylist', { 
                            items: [{ 
                                type: 'video', 
                                name: fileFinal,
                                file: fileFinal 
                            }] 
                        });
                        h.log('🎬 Vídeo adicionado: ' + fileFinal);
                    } catch (errHly) {}
                }
            }
        }

        // 5. Inserir Músicas se a seção for do tipo 'songs'
        if (sec.content_type === 'songs' && listaMusicas.length > 0) {
            for (var i = 0; i < listaMusicas.length; i++) {
                var item = listaMusicas[i];
                var tituloExato = (item.song_versions && item.song_versions.songs) ? item.song_versions.songs.title : (item.song_name || item.title);

                if (tituloExato) {
                    try {
                        var busca = h.hlyOrThrow('SearchLyrics', { text: tituloExato });
                        var musicaEncontrada = null;
                        if (busca && busca.length > 0) {
                            for (var b = 0; b < busca.length; b++) {
                                if ((busca[b].title || '').toLowerCase() === tituloExato.toLowerCase()) {
                                    musicaEncontrada = busca[b];
                                    break;
                                }
                            }
                            if (!musicaEncontrada) musicaEncontrada = busca[0];
                        }

                        if (musicaEncontrada) {
                            h.hlyOrThrow('AddLyricsToPlaylist', { id: musicaEncontrada.id });
                            h.hly('AddToPlaylist', { items: [{ type: 'song', id: musicaEncontrada.id }] });
                            h.log('🎵 Importada: ' + musicaEncontrada.title);
                        }
                    } catch (errBusca) {}
                }
            }
        }
    }

    h.log('🎉 Importação concluída com sucesso!');
}`;

    return scriptCode;
}

/**
 * Copia o Script Master da Igreja para a área de transferência
 */
function copiarScriptHolyricsUnico() {
    const scriptCode = gerarScriptMasterHolyrics();

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(scriptCode).then(() => {
            if (typeof mostrarToast === 'function') mostrarToast('📋 Script Master copiado com sua estrutura personalizada!', 'sucesso');
        }).catch(() => fallbackCopiarTexto(scriptCode));
    } else {
        fallbackCopiarTexto(scriptCode);
    }
}

/**
 * Fallback de cópia para navegadores antigos
 */
function fallbackCopiarTexto(texto) {
    const textArea = document.createElement("textarea");
    textArea.value = texto;
    textArea.style.position = "fixed";
    textArea.style.left = "-999999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
        document.execCommand('copy');
        if (typeof mostrarToast === 'function') mostrarToast('📋 Script Master copiado com sua estrutura!', 'sucesso');
    } catch (err) {
        if (typeof mostrarToast === 'function') mostrarToast('Erro ao copiar script.', 'erro');
    }
    document.body.removeChild(textArea);
}

/**
 * Gera e baixa o arquivo .bat de sincronização automática com 1 clique
 */
function baixarArquivoSincronizadorBat() {
    const churchId = window.igrejaAtivaId || 'ae125cfd-96ef-4324-b1f0-f96a4f34eecf';
    const supabaseUrl = (typeof SUPABASE_URL !== 'undefined' ? SUPABASE_URL : 'https://pfhkzgccoirosztjcyrh.supabase.co');
    const apiKey = (typeof SUPABASE_ANON_KEY !== 'undefined' ? SUPABASE_ANON_KEY : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBmaGt6Z2Njb2lyb3N6dGpjeXJoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY0NzY1MzgsImV4cCI6MjEwMjA1MjUzOH0.iFOlq-AXEmiTqCI2TsCblvzq_fp8YeadSr3vEFlgs9U');

    const batContent = `@echo off
chcp 65001 >nul
title Sincronizador Liturge -> Holyrics

powershell -NoProfile -ExecutionPolicy Bypass -Command "& {
    Write-Host '=====================================================' -ForegroundColor Cyan
    Write-Host '   ⚡ SINCRONIZADOR LITURGE -> HOLYRICS' -ForegroundColor Yellow
    Write-Host '=====================================================' -ForegroundColor Cyan

    $churchId = '${churchId}'
    $supabaseUrl = '${supabaseUrl}'
    $apiKey = '${apiKey}'

    $hoje = (Get-Date).ToString('yyyy-MM-dd')
    $amanha = (Get-Date).AddDays(1).ToString('yyyy-MM-dd')

    Write-Host \"\`n📅 Buscando dados do culto do Liturge...\" -ForegroundColor White

    $headers = @{
        'apikey' = $apiKey
        'Authorization' = 'Bearer ' + $apiKey
    }

    # 1. Buscar Culto do Dia
    $urlCulto = \"$supabaseUrl/rest/v1/services?select=id,title,date,media_urls&church_id=eq.$churchId&date=gte.$hoje&date=lt.$amanha&order=date.asc&limit=1\"
    try {
        $cultos = Invoke-RestMethod -Uri $urlCulto -Headers $headers -Method Get
    } catch {
        Write-Host \"❌ Erro ao conectar com Liturge: $_\" -ForegroundColor Red
        Pause
        exit
    }

    if (-not $cultos -or $cultos.Count -eq 0) {
        Write-Host \"⚠️ Nenhum culto com a data de hoje ($hoje). Buscando o mais recente...\" -ForegroundColor Yellow
        $urlUltimo = \"$supabaseUrl/rest/v1/services?select=id,title,date,media_urls&church_id=eq.$churchId&order=date.desc&limit=1\"
        $cultos = Invoke-RestMethod -Uri $urlUltimo -Headers $headers -Method Get
    }

    if (-not $cultos -or $cultos.Count -eq 0) {
        Write-Host \"❌ Nenhum culto cadastrado encontrado para esta igreja.\" -ForegroundColor Red
        Pause
        exit
    }

    $culto = $cultos[0]
    Write-Host \"✅ Culto Localizado: $($culto.title) (Data: $($culto.date.Substring(0,10)))\" -ForegroundColor Green

    # 2. Localizar Pastas de Mídia do Holyrics
    $candidatos = @(
        \"$env:USERPROFILE\\Documents\\Holyrics\\files\\media\",
        \"$env:USERPROFILE\\Documents\\Holyrics\\files\",
        \"$env:APPDATA\\Holyrics\\files\\media\",
        \".\\files\\media\",
        \".\\media\"
    )

    $holyricsMediaDir = ''
    foreach ($cand in $candidatos) {
        if (Test-Path $cand) {
            $holyricsMediaDir = $cand
            break
        }
    }

    if (-not $holyricsMediaDir) {
        $holyricsMediaDir = \"$env:USERPROFILE\\Documents\\Holyrics\\files\\media\"
        New-Item -ItemType Directory -Force -Path $holyricsMediaDir | Out-Null
    }

    $imgDir = Join-Path $holyricsMediaDir 'image'
    $audioDir = Join-Path $holyricsMediaDir 'audio'
    $videoDir = Join-Path $holyricsMediaDir 'video'

    New-Item -ItemType Directory -Force -Path $imgDir | Out-Null
    New-Item -ItemType Directory -Force -Path $audioDir | Out-Null
    New-Item -ItemType Directory -Force -Path $videoDir | Out-Null

    Write-Host \"📁 Pasta Holyrics: $holyricsMediaDir\" -ForegroundColor DarkGray

    # 3. Baixar Mídias
    $midias = $culto.media_urls
    if ($midias -and $midias.Count -gt 0) {
        Write-Host \"\`n📥 Baixando mídias anexadas...\" -ForegroundColor Cyan
        foreach ($m in $midias) {
            $nome = $m.name
            $url = $m.url
            if (-not $url -or -not $nome) { continue }

            $destino = ''
            if ($nome -match '\\.(png|jpe?g|webp|gif|bmp)$') {
                $destino = Join-Path $imgDir $nome
            } elseif ($nome -match '\\.(mp3|wav|m4a|ogg|aac|wma)$') {
                $destino = Join-Path $audioDir $nome
            } elseif ($nome -match '\\.(mp4|mkv|mov|webm|avi)$') {
                $destino = Join-Path $videoDir $nome
            } else {
                $destino = Join-Path $imgDir $nome
            }

            if (Test-Path $destino) {
                Write-Host \"  ✓ Já existe no PC: $nome\" -ForegroundColor DarkGray
            } else {
                Write-Host \"  ⬇️ Baixando: $nome...\" -ForegroundColor White
                try {
                    Invoke-WebRequest -Uri $url -OutFile $destino -UseBasicParsing
                    Write-Host \"  ✅ Salvo com sucesso: $nome\" -ForegroundColor Green
                } catch {
                    Write-Host \"  ❌ Erro ao baixar $nome : $_\" -ForegroundColor Red
                }
            }
        }
    } else {
        Write-Host \"ℹ️ Nenhuma mídia anexada a este culto.\" -ForegroundColor DarkGray
    }

    Write-Host \"\`n🎉 Sincronização concluída com sucesso!\" -ForegroundColor Green
    Write-Host \"Agora no Holyrics basta rodar o Script Master que tudo entrará automaticamente com 1 clique!\`n\" -ForegroundColor Yellow
    Start-Sleep -Seconds 3
}\"
`;

    const blob = new Blob([batContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Sincronizar_Holyrics_Liturge.bat';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    if (typeof mostrarToast === 'function') mostrarToast('⬇️ Sincronizador (.bat) baixado com sucesso!', 'sucesso');
}

window.PADRAO_SECOES_HOLYRICS = PADRAO_SECOES_HOLYRICS;
window.carregarConfiguracaoHolyrics = carregarConfiguracaoHolyrics;
window.renderizarEditorHolyrics = renderizarEditorHolyrics;
window.renderizarPreviewHolyrics = renderizarPreviewHolyrics;
window.adicionarSecaoHolyrics = adicionarSecaoHolyrics;
window.removerSecaoHolyrics = removerSecaoHolyrics;
window.moverSecaoHolyrics = moverSecaoHolyrics;
window.atualizarCampoSecao = atualizarCampoSecao;
window.salvarConfiguracaoHolyrics = salvarConfiguracaoHolyrics;
window.restaurarPadraoHolyrics = restaurarPadraoHolyrics;
window.gerarScriptMasterHolyrics = gerarScriptMasterHolyrics;
window.copiarScriptHolyricsUnico = copiarScriptHolyricsUnico;
window.baixarArquivoSincronizadorBat = baixarArquivoSincronizadorBat;
