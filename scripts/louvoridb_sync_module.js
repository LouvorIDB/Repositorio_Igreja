// =====================================================================
// MÓDULO OFICIAL HOLYRICS — LOUVORIDB / LITURGE
// Compatível com Holyrics v2.23.0+ (Nashorn / GraalVM)
// Especificação oficial: holyrics/JSCommunity
// =====================================================================

function info() {
    return {
        id: 'louvoridb_sync',
        name: 'LouvorIDB / Liturge Sync',
        description: 'Sincronizador oficial de cultos, repertório e mídias da igreja com download automático via Java NIO.',
        min_version: '2.23.0',
        allowed_requests: [
            'https://pfhkzgccoirosztjcyrh.supabase.co',
            'https://liturge-upload-worker.erickrosquero.workers.dev',
            'https://*.workers.dev',
            'https://*.supabase.co'
        ],
        permissions: [
            {
                type: 'advanced',
                key: 'allowed_files'
            }
        ],
        available_in_main_window: true,
        available_in_bible_window: false
    };
}

function settings(module) {
    return [
        {
            id: 'church_id',
            name: 'ID da Igreja (UUID LouvorIDB)',
            type: 'string',
            default_value: 'ae125cfd-96ef-4324-b1f0-f96a4f34eecf'
        },
        {
            id: 'auto_download_media',
            name: 'Baixar Mídias Automaticamente',
            type: 'boolean',
            default_value: true
        }
    ];
}

function actions(module) {
    var arr = [];

    // Ação 1: Sincronizar o Culto da Data / Selecionado
    arr.push({
        id: 'sync_today_service',
        name: '⚡ Sincronizar Culto LouvorIDB',
        icon: 'cloud_download',
        action: function(evt) {
            executarSincronizacaoLouvorIDB(module);
        }
    });

    // Ação 2: Exportar Todo o Catálogo de Letras do Holyrics
    arr.push({
        id: 'export_holyrics_lyrics',
        name: '📤 Exportar Letras Holyrics -> Desktop',
        icon: 'upload_file',
        action: function(evt) {
            executarExportacaoLetrasHolyrics(module);
        }
    });

    return arr;
}

// =========================================================
// ROTINA DE DOWNLOAD DIRETO VIA JAVA NIO
// =========================================================
function encodeBase64UTF16LE(str) {
    var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    var bytes = [];
    for (var i = 0; i < str.length; i++) {
        var code = str.charCodeAt(i);
        bytes.push(code & 0xff);
        bytes.push((code >> 8) & 0xff);
    }
    var result = '';
    for (var i = 0; i < bytes.length; i += 3) {
        var b1 = bytes[i], b2 = bytes[i+1] || 0, b3 = bytes[i+2] || 0;
        var triplet = (b1 << 16) | (b2 << 8) | b3;
        result += chars[(triplet >> 18) & 63];
        result += chars[(triplet >> 12) & 63];
        result += (i + 1 < bytes.length) ? chars[(triplet >> 6) & 63] : '=';
        result += (i + 2 < bytes.length) ? chars[triplet & 63] : '=';
    }
    return result;
}

function obterPastaMediaHolyrics(subFolder) {
    try {
        var existingList = null;
        if (subFolder === 'video' && h.files && typeof h.files.getVideos === 'function') existingList = h.files.getVideos();
        else if (subFolder === 'audio' && h.files && typeof h.files.getAudios === 'function') existingList = h.files.getAudios();
        else if (subFolder === 'image' && h.files && typeof h.files.getImages === 'function') existingList = h.files.getImages();

        if (existingList && existingList.length > 0) {
            for (var el = 0; el < existingList.length; el++) {
                var it = existingList[el];
                if (it && it.path) {
                    var pathNormalizado = String(it.path).split('\\\\').join('/');
                    var lastSlash = pathNormalizado.lastIndexOf('/');
                    if (lastSlash > 0) {
                        return pathNormalizado.substring(0, lastSlash);
                    }
                }
            }
        }
    } catch(eDetect) {}

    try {
        if (h.files && typeof h.files.mkdir === 'function') {
            h.files.mkdir(subFolder);
        }
    } catch(eMkApi) {}

    var aspas = String.fromCharCode(34);
    var cifrao = String.fromCharCode(36);
    
    var psCode = "";
    psCode += cifrao + "c = @(";
    psCode += aspas + "C:\\\\Holyrics\\\\Holyrics\\\\files\\\\media\\\\" + subFolder + aspas + ",";
    psCode += aspas + "D:\\\\Holyrics\\\\Holyrics\\\\files\\\\media\\\\" + subFolder + aspas + ",";
    psCode += aspas + cifrao + "env:USERPROFILE\\\\Documents\\\\Holyrics\\\\files\\\\media\\\\" + subFolder + aspas + ",";
    psCode += aspas + cifrao + "env:USERPROFILE\\\\Documentos\\\\Holyrics\\\\files\\\\media\\\\" + subFolder + aspas;
    psCode += "); ";
    psCode += "foreach(" + cifrao + "p in " + cifrao + "c) { if(Test-Path " + cifrao + "p) { Write-Output " + cifrao + "p; exit } }; ";
    psCode += cifrao + "def = " + aspas + "C:\\\\Holyrics\\\\Holyrics\\\\files\\\\media\\\\" + subFolder + aspas + "; ";
    psCode += "New-Item -ItemType Directory -Force -Path " + cifrao + "def | Out-Null; Write-Output " + cifrao + "def;";

    var base64Cmd = encodeBase64UTF16LE(psCode);
    var cmd = 'powershell.exe -NoProfile -EncodedCommand ' + base64Cmd;
    
    var result = '';
    try {
        var saida = h.executeCmdAndWait(null, cmd, 8000);
        var saidaStr = String(saida || '');
        if (saidaStr.length > 0) {
            result = saidaStr.split('\n')[0].replace(/\r/g, '').trim();
        }
    } catch(e) {}

    if (result && result.length > 0) {
        return result.split('\\\\').join('/');
    }
    
    return "C:/Holyrics/Holyrics/files/media/" + subFolder;
}

function baixarArquivoComJavaNio(urlOrigem, nomeArquivo, subFolder) {
    try {
        var pastaDestino = obterPastaMediaHolyrics(subFolder);
        var caminhoAbsoluto = pastaDestino + '/' + nomeArquivo;
        caminhoAbsoluto = caminhoAbsoluto.split('\\\\').join('/');

        h.log('  ⬇️ Baixando ' + nomeArquivo + ' (' + subFolder + ')...');
        var urlLimpa = String(urlOrigem || '').trim().replace(/ /g, '%20');
        
        var aspas = String.fromCharCode(34);
        
        // Usamos EncodedCommand do PowerShell para evitar qualquer chance de erro de aspas do Java
        var psCmd = 'curl.exe -k -sS -L -o ' + aspas + caminhoAbsoluto + aspas + ' ' + aspas + urlLimpa + aspas;
        var base64Cmd = encodeBase64UTF16LE(psCmd);
        
        var comandoCli = 'powershell.exe -NoProfile -EncodedCommand ' + base64Cmd;
        
        var response = h.executeCmdAndWait(null, comandoCli, 60000);
        var responseStr = String(response || '');
        
        if (responseStr.length > 0) {
            h.log('  ⚠️ Aviso CURL: ' + responseStr.substring(0, 200));
        }
        
        // Verifica se o arquivo foi criado para ter certeza
        var checkCmd = encodeBase64UTF16LE('if (Test-Path ' + aspas + caminhoAbsoluto + aspas + ') { Write-Output "OK" } else { Write-Output "FALHA" }');
        var checkResult = h.executeCmdAndWait(null, 'powershell.exe -NoProfile -EncodedCommand ' + checkCmd, 5000);
        
        if (String(checkResult || '').indexOf('OK') > -1) {
            h.log('  ✅ Salvo com sucesso em: ' + caminhoAbsoluto);
        } else {
            h.log('  ⚠️ Arquivo não foi salvo. Caminho: ' + caminhoAbsoluto);
        }
        
        return nomeArquivo; 
    } catch(errCli) {
        h.log('  ⚠️ Falha no download CURL (' + nomeArquivo + '): ' + (errCli.message || errCli));
        return nomeArquivo;
    }
}

// =========================================================
// ROTINA PRINCIPAL DE SINCRONIZAÇÃO
// =========================================================
function executarSincronizacaoLouvorIDB(module) {
    var SUPABASE_URL = 'https://pfhkzgccoirosztjcyrh.supabase.co';
    var API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBmaGt6Z2Njb2lyb3N6dGpjeXJoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY0NzY1MzgsImV4cCI6MjEwMjA1MjUzOH0.iFOlq-AXEmiTqCI2TsCblvzq_fp8YeadSr3vEFlgs9U';
    
    var SECOES_CONFIG = [
        { id: 'sec_1', name: 'IMAGENS', color: '#1633A4', content_type: 'images' },
        { id: 'sec_2', name: 'VÍDEOS', color: '#6B21A8', content_type: 'videos' },
        { id: 'sec_3', name: 'INSTRUMENTAIS', color: '#9D1443', content_type: 'audios' },
        { id: 'sec_4', name: 'AVISOS', color: '#70671A', content_type: 'empty' },
        { id: 'sec_5', name: 'FUNÇÕES', color: '#337636', content_type: 'empty' },
        { id: 'sec_6', name: 'BÍBLIA', color: '#AC3B17', content_type: 'empty' },
        { id: 'sec_7', name: 'LETRAS', color: '#00C9FF', content_type: 'songs' }
    ];

    var churchId = 'ae125cfd-96ef-4324-b1f0-f96a4f34eecf';
    try {
        if (module && module.settings && module.settings.church_id) {
            churchId = module.settings.church_id;
        }
    } catch(eSet) {}

    // Sincronização Dinâmica da Estrutura de Seções via Nuvem (Supabase)
    try {
        var urlSecoesNuvem = SUPABASE_URL + '/rest/v1/churches?id=eq.' + churchId + '&select=public_permissions';
        var resSecoesNuvem = h.apiRequest(urlSecoesNuvem, {
            headers: { 'apikey': API_KEY, 'Authorization': 'Bearer ' + API_KEY }
        });
        if (resSecoesNuvem) {
            var igs = JSON.parse(resSecoesNuvem);
            if (igs && igs.length > 0 && igs[0].public_permissions) {
                var pObj = igs[0].public_permissions;
                if (typeof pObj === 'string') { try { pObj = JSON.parse(pObj); } catch(eParsePub) {} }
                if (pObj && pObj.holyrics_template && Array.isArray(pObj.holyrics_template) && pObj.holyrics_template.length > 0) {
                    SECOES_CONFIG = pObj.holyrics_template;
                    h.log('🌐 Estrutura de seções sincronizada da nuvem (' + SECOES_CONFIG.length + ' seções).');
                }
            }
        }
    } catch(errCloudSec) {
        h.log('ℹ️ Usando estrutura local padrão das seções.');
    }

    var playlistInfo = h.getPlaylistInfo();
    var dataCultoStr;

    if (playlistInfo && playlistInfo.datetime) {
        dataCultoStr = playlistInfo.datetime.split(' ')[0];
        h.log('📅 Lista selecionada: ' + (playlistInfo.name || 'Culto') + ' (' + dataCultoStr + ')');
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

    h.notification('🔍 Buscando dados do culto no LouvorIDB...');
    var urlCulto = SUPABASE_URL + '/rest/v1/services?select=id,title,date,media_urls&church_id=eq.' + churchId + '&date=gte.' + dataCultoStr + '&date=lt.' + proxDiaStr + '&order=date.asc&limit=1';
    var cultosRes = h.apiRequest(urlCulto, {
        headers: { 'apikey': API_KEY, 'Authorization': 'Bearer ' + API_KEY }
    });

    if (!cultosRes) {
        h.notificationError('❌ Erro de conexão com LouvorIDB.');
        h.log('Erro de API: ' + (h.getApiRequestLastError() || 'Verifique as requisições permitidas.'));
        return;
    }

    var cultos = [];
    try { cultos = JSON.parse(cultosRes) || []; } catch(eParse) {}

    if (cultos.length === 0) {
        h.log('⚠️ Nenhum culto com a data exata. Buscando o mais recente...');
        var urlRecente = SUPABASE_URL + '/rest/v1/services?select=id,title,date,media_urls&church_id=eq.' + churchId + '&order=date.desc&limit=1';
        var recRes = h.apiRequest(urlRecente, {
            headers: { 'apikey': API_KEY, 'Authorization': 'Bearer ' + API_KEY }
        });
        try { cultos = JSON.parse(recRes) || []; } catch(eRec) {}
    }

    if (cultos.length === 0) {
        h.notificationError('Nenhum culto encontrado no LouvorIDB para esta igreja.');
        return;
    }

    var culto = cultos[0];
    h.log('✅ Culto localizado: ' + (culto.title || 'Culto') + ' (' + culto.date.substring(0, 10) + ')');

    // 1. Coletar Mídias Cadastradas (media_urls e church_media)
    var listaMidias = [];

    // a) Mídias armazenadas no array ou JSON string de media_urls do culto
    if (culto.media_urls) {
        var rawUrls = culto.media_urls;
        if (typeof rawUrls === 'string') {
            try { rawUrls = JSON.parse(rawUrls); } catch(eParseUrls) { rawUrls = []; }
        }
        if (Array.isArray(rawUrls)) {
            for (var u = 0; u < rawUrls.length; u++) {
                var mUrl = rawUrls[u];
                var mName = '';
                var mLink = '';
                if (typeof mUrl === 'string') {
                    mLink = mUrl;
                    mName = mUrl.split('?')[0].split('/').pop() || 'arquivo';
                } else if (mUrl && typeof mUrl === 'object') {
                    mName = mUrl.name || mUrl.file_name || mUrl.filename || '';
                    mLink = mUrl.url || mUrl.file_url || '';
                    if (!mName && mLink) mName = mLink.split('?')[0].split('/').pop() || 'arquivo';
                }

                if (mLink) {
                    var jaTem = false;
                    for (var k = 0; k < listaMidias.length; k++) {
                        if (listaMidias[k].file_name === mName || listaMidias[k].file_url === mLink) {
                            jaTem = true;
                            break;
                        }
                    }
                    if (!jaTem) {
                        listaMidias.push({ file_name: mName, file_url: mLink });
                    }
                }
            }
        }
    }

    // c) Mídias gerais da igreja na mesma data (church_media)
    try {
        var urlMidias = SUPABASE_URL + '/rest/v1/church_media?select=id,file_name,file_url,mime_type&church_id=eq.' + churchId + '&created_at=gte.' + dataCultoStr + '&created_at=lt.' + proxDiaStr + '&order=created_at.asc';
        var midiasRes = h.apiRequest(urlMidias, {
            headers: { 'apikey': API_KEY, 'Authorization': 'Bearer ' + API_KEY }
        });
        var midiasGerais = [];
        if (midiasRes) {
            try { midiasGerais = JSON.parse(midiasRes) || []; } catch(eParseMg) {}
        }
        for (var g = 0; g < midiasGerais.length; g++) {
            var gm = midiasGerais[g];
            var gName = gm.file_name || gm.name || '';
            var gUrl = gm.file_url || gm.url || '';
            if (gUrl) {
                var jaExiste = false;
                for (var z = 0; z < listaMidias.length; z++) {
                    if (listaMidias[z].file_name === gName || listaMidias[z].file_url === gUrl) {
                        jaExiste = true;
                        break;
                    }
                }
                if (!jaExiste) {
                    listaMidias.push({ file_name: gName || (gUrl.split('?')[0].split('/').pop() || 'arquivo'), file_url: gUrl });
                }
            }
        }
    } catch(eCm) {}

    // d) Classificar e Baixar Arquivos de Mídia Automaticamente (Upfront)
    h.log('📦 Total de anexos de mídia detectados no culto: ' + listaMidias.length);
    for (var dIdx = 0; dIdx < listaMidias.length; dIdx++) {
        var itemMid = listaMidias[dIdx];
        var nAlvo = itemMid.file_name || '';
        var uAlvo = itemMid.file_url || '';

        var tipoMidia = 'image';
        if (/\.(mp4|mkv|mov|webm|avi|m4v|mpg|wmv)$/i.test(nAlvo)) {
            tipoMidia = 'video';
        } else if (/\.(mp3|wav|m4a|aac|ogg|wma|flac)$/i.test(nAlvo)) {
            tipoMidia = 'audio';
        } else if (/\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(nAlvo)) {
            tipoMidia = 'image';
        }

        itemMid.tipoMidia = tipoMidia;

        if (uAlvo && nAlvo) {
            h.log('⬇️ Processando download de ' + tipoMidia + ': ' + nAlvo);
            var nomeSalvo = baixarArquivoComJavaNio(uAlvo, nAlvo, tipoMidia);
            if (nomeSalvo) {
                itemMid.file_name = nomeSalvo;
            }
        }
    }

    // 2. Buscar Músicas do Culto (com letras embutidas)
    var musicasRes = h.apiRequest(SUPABASE_URL + '/rest/v1/service_songs?select=*,song_versions(lyrics,songs(title,artist))&service_id=eq.' + culto.id + '&order=song_order.asc', {
        headers: { 'apikey': API_KEY, 'Authorization': 'Bearer ' + API_KEY }
    });

    var listaMusicas = [];
    try { listaMusicas = JSON.parse(musicasRes) || []; } catch(eMus) {}

    // 3. Montar a Playlist Respeitando as Seções
    h.log('🎬 Montando Playlist no Holyrics...');
    var midiasInseridas = {};

    for (var s = 0; s < SECOES_CONFIG.length; s++) {
        var sec = SECOES_CONFIG[s];
        var hexCor = (sec.color || '#1633A4').replace('#', '');

        // Cabeçalho da Seção
        h.hly('AddToPlaylist', { items: [{ type: 'title', name: sec.name, background_color: hexCor }] });

        // Seção de Imagens
        if (sec.content_type === 'images' && listaMidias.length > 0) {
            for (var m = 0; m < listaMidias.length; m++) {
                var midiaImg = listaMidias[m];
                if (midiaImg.tipoMidia === 'image') {
                    try {
                        h.hly('AddToPlaylist', {
                            items: [{
                                type: 'image',
                                name: midiaImg.file_name,
                                title: midiaImg.file_name,
                                file: midiaImg.file_name
                            }]
                        });
                        midiasInseridas[midiaImg.file_name] = true;
                        h.log('  🖼️ Imagem adicionada: ' + midiaImg.file_name);
                    } catch(eAddImg) {}
                }
            }
        }

        // Seção de Áudios / Instrumentais
        if (sec.content_type === 'audios' && listaMidias.length > 0) {
            for (var a = 0; a < listaMidias.length; a++) {
                var midiaAud = listaMidias[a];
                if (midiaAud.tipoMidia === 'audio') {
                    try {
                        h.hly('AddToPlaylist', {
                            items: [{
                                type: 'audio',
                                name: midiaAud.file_name,
                                title: midiaAud.file_name,
                                file: midiaAud.file_name
                            }]
                        });
                        midiasInseridas[midiaAud.file_name] = true;
                        h.log('  🎧 Áudio adicionado: ' + midiaAud.file_name);
                    } catch(eAddAud) {}
                }
            }
        }

        // Seção de Vídeos
        if (sec.content_type === 'videos' && listaMidias.length > 0) {
            for (var v = 0; v < listaMidias.length; v++) {
                var midiaVid = listaMidias[v];
                if (midiaVid.tipoMidia === 'video') {
                    try {
                        h.hly('AddToPlaylist', {
                            items: [{
                                type: 'video',
                                name: midiaVid.file_name,
                                title: midiaVid.file_name,
                                file: midiaVid.file_name
                            }]
                        });
                        midiasInseridas[midiaVid.file_name] = true;
                        h.log('  🎬 Vídeo adicionado: ' + midiaVid.file_name);
                    } catch(eAddVid) {}
                }
            }
        }

        // Seção de Louvores / Músicas (adiciona em Letras + Mídia)
        if (sec.content_type === 'songs' && listaMusicas.length > 0) {
            for (var i = 0; i < listaMusicas.length; i++) {
                var itemMus = listaMusicas[i];
                var versao = itemMus.song_versions || {};
                var songObj = versao.songs || {};
                var tituloExato = songObj.title || itemMus.song_name || itemMus.title;

                if (!tituloExato) continue;

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
                        // 1. Adiciona na lista rápida da aba [Letras]
                        h.hlyOrThrow('AddLyricsToPlaylist', { id: musicaEncontrada.id });
                        // 2. Adiciona na playlist principal da aba [Mídia]
                        h.hly('AddToPlaylist', {
                            items: [{
                                type: 'song',
                                id: musicaEncontrada.id,
                                name: musicaEncontrada.title,
                                title: musicaEncontrada.title
                            }]
                        });
                        h.log('  🎵 Adicionada (Letras + Mídia): ' + musicaEncontrada.title);
                    } else {
                        h.log('  ⚠️ Não encontrada no Holyrics: ' + tituloExato);
                        var letraPronta = versao.lyrics || '';
                        if (letraPronta && typeof h.popupCreateSong === 'function') {
                            try {
                                h.popupCreateSong({
                                    title: tituloExato,
                                    artist: songObj.artist || '',
                                    lyrics: letraPronta
                                });
                            } catch(ePop) {}
                        }
                    }
                } catch(errBusca) {
                    h.log('  ⚠️ Erro ao pesquisar ' + tituloExato + ': ' + errBusca);
                }
            }
        }
    }

    // 4. Inserir Mídias Anexas que não foram incluídas em nenhuma seção configurada
    var midiasRestantes = [];
    for (var r = 0; r < listaMidias.length; r++) {
        if (!midiasInseridas[listaMidias[r].file_name]) {
            midiasRestantes.push(listaMidias[r]);
        }
    }

    if (midiasRestantes.length > 0) {
        var videosRestantes = [];
        var audiosRestantes = [];
        var outrasRestantes = [];

        for (var mr = 0; mr < midiasRestantes.length; mr++) {
            var rem = midiasRestantes[mr];
            if (rem.tipoMidia === 'video') videosRestantes.push(rem);
            else if (rem.tipoMidia === 'audio') audiosRestantes.push(rem);
            else outrasRestantes.push(rem);
        }

        if (videosRestantes.length > 0) {
            h.hly('AddToPlaylist', { items: [{ type: 'title', name: 'VÍDEOS', background_color: '6B21A8' }] });
            for (var vr = 0; vr < videosRestantes.length; vr++) {
                var vItem = videosRestantes[vr];
                try {
                    h.hly('AddToPlaylist', {
                        items: [{
                            type: 'video',
                            name: vItem.file_name,
                            title: vItem.file_name,
                            file: vItem.file_name
                        }]
                    });
                    h.log('  🎬 Vídeo adicionado (seção auto): ' + vItem.file_name);
                } catch(eVr) {}
            }
        }

        if (audiosRestantes.length > 0) {
            h.hly('AddToPlaylist', { items: [{ type: 'title', name: 'INSTRUMENTAIS', background_color: '9D1443' }] });
            for (var ar = 0; ar < audiosRestantes.length; ar++) {
                var aItem = audiosRestantes[ar];
                try {
                    h.hly('AddToPlaylist', {
                        items: [{
                            type: 'audio',
                            name: aItem.file_name,
                            title: aItem.file_name,
                            file: aItem.file_name
                        }]
                    });
                    h.log('  🎧 Áudio adicionado (seção auto): ' + aItem.file_name);
                } catch(eAr) {}
            }
        }

        if (outrasRestantes.length > 0) {
            h.hly('AddToPlaylist', { items: [{ type: 'title', name: 'MÍDIAS ADICIONAIS', background_color: '1633A4' }] });
            for (var or = 0; or < outrasRestantes.length; or++) {
                var oItem = outrasRestantes[or];
                try {
                    h.hly('AddToPlaylist', {
                        items: [{
                            type: oItem.tipoMidia || 'image',
                            name: oItem.file_name,
                            title: oItem.file_name,
                            file: oItem.file_name
                        }]
                    });
                    h.log('  🖼️ Mídia adicionada (seção auto): ' + oItem.file_name);
                } catch(eOr) {}
            }
        }
    }

    h.notification('🎉 Culto LouvorIDB sincronizado com sucesso no Holyrics!');
}

// =========================================================
// ROTINA DE EXPORTAÇÃO DE TODAS AS LETRAS DO HOLYRICS
// =========================================================
function executarExportacaoLetrasHolyrics(module) {
    h.log('🔍 Lendo banco de músicas do Holyrics...');
    var todasMusicas = [];

    try {
        if (h.db && h.db.songs && typeof h.db.songs.list === 'function') {
            todasMusicas = h.db.songs.list() || [];
        } else if (h.db && h.db.song && h.db.song.list) {
            todasMusicas = h.db.song.list || [];
        }
    } catch(eDb) {
        h.log('Erro ao ler h.db: ' + eDb);
    }

    if (!todasMusicas || todasMusicas.length === 0) {
        h.notificationError('Nenhuma música encontrada no acervo local do Holyrics.');
        return;
    }

    var exportData = [];
    for (var i = 0; i < todasMusicas.length; i++) {
        var s = todasMusicas[i];
        exportData.push({
            id: s.id || ('hly_' + i),
            title: s.title || s.name || 'Sem Título',
            artist: s.artist || s.author || '',
            lyrics: s.lyrics || s.text || s.paragraph || ''
        });
    }

                try {
        var aspas = String.fromCharCode(34);
        var desktopPath = "C:/Holyrics_Export_Letras.json"; // default fallback
        
        // Vamos achar o Desktop pelo Powershell usando EncodedCommand
        var psEnv = 'Write-Output [Environment]::GetFolderPath("Desktop")';
        var b64Env = encodeBase64UTF16LE(psEnv);
        var saidaEnv = '';
        try { 
            saidaEnv = String(h.executeCmdAndWait(null, 'powershell.exe -NoProfile -EncodedCommand ' + b64Env, 5000) || ''); 
        } catch(e) {}
        
        if (saidaEnv.length > 0) {
            desktopPath = saidaEnv.split('\n')[0].replace(/\r/g, '').trim().split('\\\\').join('/') + '/Holyrics_Export_Letras.json';
        }

        var jsonContent = JSON.stringify(exportData, null, 2);
        var base64Json = h.base64Encode(jsonContent);
        
        // Evitamos usar variaveis com cifrao em powershell
        var psCmd = '[System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String(' + aspas + base64Json + aspas + ')) | Set-Content -Path ' + aspas + desktopPath + aspas + ' -Encoding UTF8';
        var b64Cmd = encodeBase64UTF16LE(psCmd);
        var psCommand = 'powershell.exe -NoProfile -EncodedCommand ' + b64Cmd;
        
        h.executeCmdAndWait(null, psCommand, 10000);

        h.notification('📁 ' + exportData.length + ' letras exportadas para a sua Área de Trabalho!');
        h.log('Arquivo salvo com sucesso em: ' + desktopPath);
    } catch(errSave) {
        h.notificationError('Erro ao gravar arquivo na Área de Trabalho: ' + errSave.message);
    }
}
