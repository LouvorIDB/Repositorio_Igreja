// =====================================================================
// EXPORTADOR E CONFIGURADOR DE PLAYLISTS PARA HOLYRICS (h.hly)
// LouvorIDB SaaS — Geração nativa e personalizada de scripts Holyrics
// =====================================================================

const PADRAO_SECOES_HOLYRICS = [
    { id: 'sec_1', name: 'IMAGENS', color: '#1633A4', content_type: 'images' },
    { id: 'sec_2', name: 'VÍDEOS', color: '#6B21A8', content_type: 'videos' },
    { id: 'sec_3', name: 'INSTRUMENTAIS', color: '#9D1443', content_type: 'audios' },
    { id: 'sec_4', name: 'AVISOS', color: '#70671A', content_type: 'empty' },
    { id: 'sec_5', name: 'FUNÇÕES', color: '#337636', content_type: 'empty' },
    { id: 'sec_6', name: 'BÍBLIA', color: '#AC3B17', content_type: 'empty' },
    { id: 'sec_7', name: 'LETRAS', color: '#00C9FF', content_type: 'songs' }
];

let secoesHolyricsConfig = [...PADRAO_SECOES_HOLYRICS];

/**
 * Carrega as preferências de seções do Holyrics para a igreja atual
 */
async function carregarConfiguracaoHolyrics() {
    const userToEvaluate = (typeof modoSimulacaoPerfil !== 'undefined' ? modoSimulacaoPerfil : null) || (typeof usuarioLogado !== 'undefined' ? usuarioLogado : null);
    const churchId = userToEvaluate?.church_id || window.dadosGlobais?.church?.id || 'default';

    let configuracaoCarregada = null;

    // 1. Tentar ler do objeto em memória (dadosGlobais.church.public_permissions)
    const churchData = window.dadosGlobais?.church;
    if (churchData && churchData.public_permissions) {
        let pub = churchData.public_permissions;
        if (typeof pub === 'string') {
            try { pub = JSON.parse(pub); } catch(e) { pub = {}; }
        }
        if (pub && pub.holyrics_template && Array.isArray(pub.holyrics_template) && pub.holyrics_template.length > 0) {
            configuracaoCarregada = pub.holyrics_template;
        }
    }

    // 2. Tentar buscar diretamente no Supabase se houver conexão e churchId válido
    if (!configuracaoCarregada && typeof supabaseClient !== 'undefined' && supabaseClient && churchId && churchId !== 'default') {
        try {
            const { data: cRow } = await supabaseClient
                .from('churches')
                .select('public_permissions')
                .eq('id', churchId)
                .maybeSingle();

            if (cRow && cRow.public_permissions) {
                let pub = cRow.public_permissions;
                if (typeof pub === 'string') {
                    try { pub = JSON.parse(pub); } catch(e) { pub = {}; }
                }
                if (pub && pub.holyrics_template && Array.isArray(pub.holyrics_template) && pub.holyrics_template.length > 0) {
                    configuracaoCarregada = pub.holyrics_template;
                    if (window.dadosGlobais?.church) {
                        window.dadosGlobais.church.public_permissions = pub;
                    }
                }
            }
        } catch(eFetch) {
            console.warn('Aviso ao buscar seções na nuvem:', eFetch);
        }
    }

    // 3. Fallback no localStorage
    if (!configuracaoCarregada) {
        const salvo = localStorage.getItem('holyrics_template_' + churchId);
        if (salvo) {
            try {
                configuracaoCarregada = JSON.parse(salvo);
            } catch (e) {}
        }
    }

    if (configuracaoCarregada && Array.isArray(configuracaoCarregada) && configuracaoCarregada.length > 0) {
        secoesHolyricsConfig = configuracaoCarregada;
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

async function salvarConfiguracaoHolyrics() {
    const userToEvaluate = (typeof modoSimulacaoPerfil !== 'undefined' ? modoSimulacaoPerfil : null) || (typeof usuarioLogado !== 'undefined' ? usuarioLogado : null);
    const churchId = userToEvaluate?.church_id || window.dadosGlobais?.church?.id || 'default';

    localStorage.setItem('holyrics_template_' + churchId, JSON.stringify(secoesHolyricsConfig));

    let salvoNuvem = false;
    if (typeof supabaseClient !== 'undefined' && supabaseClient && churchId && churchId !== 'default') {
        try {
            // Obter public_permissions atual para preservar outras configurações
            let pub = {};
            try {
                const { data: cData } = await supabaseClient
                    .from('churches')
                    .select('public_permissions')
                    .eq('id', churchId)
                    .maybeSingle();
                if (cData && cData.public_permissions) {
                    pub = typeof cData.public_permissions === 'string'
                        ? JSON.parse(cData.public_permissions)
                        : cData.public_permissions;
                }
            } catch(eGet) {
                pub = window.dadosGlobais?.church?.public_permissions || {};
                if (typeof pub === 'string') {
                    try { pub = JSON.parse(pub); } catch(e){ pub = {}; }
                }
            }
            pub = { ...(pub || {}), holyrics_template: secoesHolyricsConfig };

            const { error } = await supabaseClient
                .from('churches')
                .update({ public_permissions: pub })
                .eq('id', churchId);

            if (!error) {
                salvoNuvem = true;
                if (window.dadosGlobais?.church) {
                    window.dadosGlobais.church.public_permissions = pub;
                }
            } else {
                console.warn('Aviso ao sincronizar na nuvem:', error);
            }
        } catch(errCloud) {
            console.warn('Falha na requisição de nuvem:', errCloud);
        }
    }

    if (salvoNuvem) {
        if (typeof mostrarToast === 'function') mostrarToast('☁️ Estrutura salva na nuvem! O Holyrics atualizará automaticamente.', 'sucesso');
    } else {
        if (typeof mostrarToast === 'function') mostrarToast('Estrutura da Playlist salva com sucesso!', 'sucesso');
    }
}

async function restaurarPadraoHolyrics() {
    if (!confirm('Deseja restaurar as seções padrão do Holyrics?')) return;
    secoesHolyricsConfig = JSON.parse(JSON.stringify(PADRAO_SECOES_HOLYRICS));
    await salvarConfiguracaoHolyrics();
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

    // Sincronização Dinâmica da Estrutura de Seções via Nuvem (Supabase)
    try {
        var urlSecoesNuvem = SUPABASE_URL + '/rest/v1/churches?id=eq.' + CHURCH_ID + '&select=public_permissions';
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
                    var jaExiste = false;
                    for (var k = 0; k < listaMidias.length; k++) {
                        if (listaMidias[k].file_name === mName || listaMidias[k].file_url === mLink) {
                            jaExiste = true;
                            break;
                        }
                    }
                    if (!jaExiste) {
                        listaMidias.push({ file_name: mName, file_url: mLink });
                    }
                }
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
                            h.hly('AddToPlaylist', {
                                items: [{
                                    type: 'song',
                                    id: musicaEncontrada.id,
                                    name: musicaEncontrada.title,
                                    title: musicaEncontrada.title
                                }]
                            });
                            h.log('🎵 Importada (Letras + Mídia): ' + musicaEncontrada.title);
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

/**
 * Gera o código-fonte do Módulo Oficial Holyrics LouvorIDB / Liturge
 * Compatível com Holyrics v2.23.0+ e especificação JSCommunity
 */
function gerarCodigoModuloHolyrics(churchIdCustom) {
    const userToEvaluate = (typeof modoSimulacaoPerfil !== 'undefined' ? modoSimulacaoPerfil : null) || (typeof usuarioLogado !== 'undefined' ? usuarioLogado : null);
    const churchId = churchIdCustom || userToEvaluate?.church_id || window.dadosGlobais?.church?.id || 'ae125cfd-96ef-4324-b1f0-f96a4f34eecf';

    const secoesJSON = JSON.stringify(secoesHolyricsConfig || PADRAO_SECOES_HOLYRICS, null, 4);
    const supabaseUrlFinal = typeof SUPABASE_URL !== 'undefined' ? SUPABASE_URL : 'https://pfhkzgccoirosztjcyrh.supabase.co';
    const supabaseKeyFinal = typeof SUPABASE_ANON_KEY !== 'undefined' ? SUPABASE_ANON_KEY : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBmaGt6Z2Njb2lyb3N6dGpjeXJoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY0NzY1MzgsImV4cCI6MjEwMjA1MjUzOH0.iFOlq-AXEmiTqCI2TsCblvzq_fp8YeadSr3vEFlgs9U';

    return `// =====================================================================
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
            '${supabaseUrlFinal}',
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
            name: 'ID da Igreja (LouvorIDB)',
            type: 'string',
            default_value: '${churchId}'
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
    var SUPABASE_URL = '${supabaseUrlFinal}';
    var API_KEY = '${supabaseKeyFinal}';
    var SECOES_CONFIG = ${secoesJSON};

    var churchId = '${churchId}';
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
        if (/\\.(mp4|mkv|mov|webm|avi|m4v|mpg|wmv)$/i.test(nAlvo)) {
            tipoMidia = 'video';
        } else if (/\\.(mp3|wav|m4a|aac|ogg|wma|flac)$/i.test(nAlvo)) {
            tipoMidia = 'audio';
        } else if (/\\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(nAlvo)) {
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
`;
}

/**
 * Faz o download do arquivo .js do Módulo para instalação no Holyrics
 */
function baixarArquivoModuloHolyrics() {
    const moduloCode = gerarCodigoModuloHolyrics();
    const blob = new Blob([moduloCode], { type: 'text/javascript;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'louvoridb_sync_module.js';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    if (typeof mostrarToast === 'function') mostrarToast('🧩 Módulo Holyrics (louvoridb_sync_module.js) baixado!', 'sucesso');
}

/**
 * Copia o código do Módulo para a área de transferência
 */
function copiarCodigoModuloHolyrics() {
    const moduloCode = gerarCodigoModuloHolyrics();

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(moduloCode).then(() => {
            if (typeof mostrarToast === 'function') mostrarToast('📋 Código do Módulo copiado com sucesso!', 'sucesso');
        }).catch(() => fallbackCopiarTexto(moduloCode));
    } else {
        fallbackCopiarTexto(moduloCode);
    }
}

/**
 * Funções de controle do Modal Tutorial do Holyrics
 */
function abrirTutorialHolyrics() {
    const modal = document.getElementById('modal-tutorial-holyrics');
    if (modal) modal.classList.remove('hidden');
}

function fecharTutorialHolyrics() {
    const modal = document.getElementById('modal-tutorial-holyrics');
    if (modal) modal.classList.add('hidden');
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
window.gerarCodigoModuloHolyrics = gerarCodigoModuloHolyrics;
window.baixarArquivoModuloHolyrics = baixarArquivoModuloHolyrics;
window.copiarCodigoModuloHolyrics = copiarCodigoModuloHolyrics;
window.abrirTutorialHolyrics = abrirTutorialHolyrics;
window.fecharTutorialHolyrics = fecharTutorialHolyrics;
