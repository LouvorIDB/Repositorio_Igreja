// =====================================================================
// EXPORTADOR DEDICADO DE SCRIPTS E PLAYLISTS PARA HOLYRICS (h.hly)
// LouvorIDB SaaS — Geração nativa de scripts h.hly('AddToPlaylist')
// =====================================================================

/**
 * Extrai a lista de músicas de um culto (suporta formato relacional e lista plana)
 */
function extrairMusicasDoCulto(cultoIdentificador) {
    const cultos = typeof Store !== 'undefined' ? Store.getCultos() : [];
    
    // 1. Tenta buscar por ID relacional do Supabase ou slug
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

    // 2. Fallback para matriz de linhas (rows) de cultos
    if (Array.isArray(cultos)) {
        let emBlocoAlvo = false;
        let tituloCulto = 'Culto';
        const musicasEncontradas = [];

        for (let i = 0; i < cultos.length; i++) {
            const linha = cultos[i];
            if (!Array.isArray(linha)) continue;

            const col0 = linha[0] ? String(linha[0]) : '';

            if (col0.includes("CULTO DE")) {
                if (col0 === cultoIdentificador || col0.includes(cultoIdentificador)) {
                    emBlocoAlvo = true;
                    tituloCulto = col0;
                } else if (emBlocoAlvo) {
                    break;
                }
            } else if (emBlocoAlvo && col0.trim() !== '' && !col0.toUpperCase().includes('EM MONTAGEM')) {
                musicasEncontradas.push({
                    title: col0,
                    artist: linha[2] || '',
                    holyrics_id: null,
                    key: linha[1] || '',
                    singer: linha[6] || ''
                });
            }
        }

        if (emBlocoAlvo) {
            return {
                title: tituloCulto,
                date: '',
                musicas: musicasEncontradas
            };
        }
    }

    return null;
}

/**
 * Gera o Script Master do Holyrics para a igreja do usuário logado/simulado
 */
function gerarScriptMasterHolyrics(churchIdCustom) {
    const userToEvaluate = (typeof modoSimulacaoPerfil !== 'undefined' ? modoSimulacaoPerfil : null) || (typeof usuarioLogado !== 'undefined' ? usuarioLogado : null);
    const churchId = churchIdCustom || userToEvaluate?.church_id || window.dadosGlobais?.church?.id || 'ae125cfd-96ef-4324-b1f0-f96a4f34eecf';

    const scriptCode = `function scriptAction(obj) {
    var SUPABASE_URL = 'https://pfhkzgccoirosztjcyrh.supabase.co';
    var API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBmaGt6Z2Njb2lyb3N6dGpjeXrhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY0NzY1MzgsImV4cCI6MjEwMjA1MjUzOH0.iFOlq-AXEmiTqCI2TsCblvzq_fp8YeadSr3vEFlgs9U';
    
    // ID Único da Igreja no LouvorIDB
    var CHURCH_ID = '${churchId}';

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

    // Calcula o próximo dia para pegar o intervalo completo de 24h
    var parts = dataCultoStr.split('-');
    var d = new Date(parts[0], parts[1] - 1, parts[2]);
    d.setDate(d.getDate() + 1);
    var anoP = d.getFullYear();
    var mesP = (d.getMonth() + 1 < 10 ? '0' : '') + (d.getMonth() + 1);
    var diaP = (d.getDate() < 10 ? '0' : '') + d.getDate();
    var proxDiaStr = anoP + '-' + mesP + '-' + diaP;

    // =========================================================
    // PASSO 2: Adicionar itens base da lista padrão (Mídia)
    // (Você pode personalizar os itens abaixo conforme sua igreja)
    // =========================================================
    h.log('🎬 Adicionando itens base da lista padrão...');

    var items = [
        { type: "title", name: "IMAGENS", background_color: "1633A4" },
        { type: "title", name: "INSTRUMENTAIS", background_color: "9D1443" },
        { type: "title", name: "AVISOS", background_color: "70671A" },
        { type: "title", name: "FUNÇÕES", background_color: "337636" },
        { type: "title", name: "BÍBLIA", background_color: "AC3B17" },
        { type: "title", name: "LETRAS", background_color: "00C9FF" }
    ];

    h.hly('AddToPlaylist', { items: items });
    h.log('✅ Itens base adicionados com sucesso!');

    // =========================================================
    // PASSO 3: Buscar culto da igreja especificada na API
    // =========================================================
    h.log('🔍 Buscando culto da igreja na data: ' + dataCultoStr);

    var urlCulto = SUPABASE_URL + '/rest/v1/services?select=id,date&church_id=eq.' + CHURCH_ID + '&date=gte.' + dataCultoStr + '&date=lt.' + proxDiaStr + '&order=date.asc&limit=1';
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

    var musicasRes = h.apiRequest(SUPABASE_URL + '/rest/v1/service_songs?select=*,song_versions(songs(title))&service_id=eq.' + culto.id + '&order=song_order.asc', {
        headers: { 'apikey': API_KEY, 'Authorization': 'Bearer ' + API_KEY }
    });

    if (musicasRes) {
        var listaMusicas = JSON.parse(musicasRes);
        h.log('🎶 Músicas no repertório do culto: ' + listaMusicas.length);

        for (var i = 0; i < listaMusicas.length; i++) {
            var item = listaMusicas[i];
            var tituloExato = (item.song_versions && item.song_versions.songs) ? item.song_versions.songs.title : (item.song_name || item.title);

            if (tituloExato) {
                h.log('🔎 Pesquisando pelo título exato: ' + tituloExato);

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
                        // 1. Adiciona na aba LETRAS
                        h.hlyOrThrow('AddLyricsToPlaylist', { id: musicaEncontrada.id });
                        // 2. Adiciona na aba MÍDIA
                        h.hly('AddToPlaylist', { items: [{ type: 'song', id: musicaEncontrada.id }] });
                        h.log('✨ Importada: ' + musicaEncontrada.title);
                    } else {
                        h.log('⚠️ Música não encontrada com o título exato: ' + tituloExato);
                    }
                } catch (errBusca) {
                    h.log('❌ Erro ao buscar "' + tituloExato + '": ' + errBusca);
                }
            }
        }
        h.log('🎉 Importação concluída com sucesso!');
    }
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
            if (typeof mostrarToast === 'function') mostrarToast('📋 Script Master do Holyrics copiado com sucesso! Cole no Holyrics.', 'sucesso');
        }).catch(() => fallbackCopiarTexto(scriptCode, 'único'));
    } else {
        fallbackCopiarTexto(scriptCode, 'único');
    }
}

/**
 * Fallback de cópia para navegadores antigos ou sem permissão de clipboard
 */
function fallbackCopiarTexto(texto, totalMusicas) {
    const textArea = document.createElement("textarea");
    textArea.value = texto;
    textArea.style.position = "fixed";
    textArea.style.left = "-999999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
        document.execCommand('copy');
        if (typeof mostrarToast === 'function') mostrarToast(`📋 Script Holyrics copiado! (${totalMusicas} louvores).`, 'sucesso');
    } catch (err) {
        if (typeof mostrarToast === 'function') mostrarToast('Erro ao copiar script para área de transferência.', 'erro');
    }
    document.body.removeChild(textArea);
}

/**
 * Faz o download do arquivo .js para executar dentro do Holyrics
 */
function baixarScriptHolyricsServico(cultoIdentificador) {
    const dados = extrairMusicasDoCulto(cultoIdentificador);
    const res = gerarScriptHolyricsFormatado(dados);

    if (!res) {
        if (typeof mostrarToast === 'function') mostrarToast('Nenhuma música encontrada neste culto para exportar.', 'aviso');
        return;
    }

    const blob = new Blob([res.codigo], { type: 'text/javascript;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    const filename = `Script_Holyrics_${res.titulo.replace(/[^a-zA-Z0-9_-]/g, '_')}.js`;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);

    if (typeof mostrarToast === 'function') mostrarToast(`📥 Arquivo "${filename}" baixado com sucesso!`, 'sucesso');
}

function copiarScriptHolyricsServico(cultoIdentificador) {
    copiarScriptHolyricsUnico();
}

function abrirTutorialHolyrics() {
    document.getElementById('modal-tutorial-holyrics')?.classList.remove('hidden');
}

function fecharTutorialHolyrics() {
    document.getElementById('modal-tutorial-holyrics')?.classList.add('hidden');
}

window.extrairMusicasDoCulto = extrairMusicasDoCulto;
window.gerarScriptMasterHolyrics = gerarScriptMasterHolyrics;
window.copiarScriptHolyricsUnico = copiarScriptHolyricsUnico;
window.copiarScriptHolyricsServico = copiarScriptHolyricsServico;
window.baixarScriptHolyricsServico = baixarScriptHolyricsServico;
window.abrirTutorialHolyrics = abrirTutorialHolyrics;
window.fecharTutorialHolyrics = fecharTutorialHolyrics;

