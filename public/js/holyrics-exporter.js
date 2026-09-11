// =====================================================================
// CENTRAL DE INTEGRAÇÃO HOLYRICS NATIVA (LITURGE)
// Gerenciamento de credenciais, modelo padrão de seções e download do módulo
// =====================================================================

const PADRAO_SECOES_HOLYRICS = [
    { id: 'sec_1', name: 'ABERTURA', color: '#1E3A8A', content_type: 'videos', hide_if_empty: true },
    { id: 'sec_2', name: 'LOUVOR & ADORAÇÃO', color: '#0284C7', content_type: 'musicas', hide_if_empty: false },
    { id: 'sec_3', name: 'AVISOS & NOTÍCIAS', color: '#B45309', content_type: 'imagens', hide_if_empty: true },
    { id: 'sec_4', name: 'MENSAGEM PASTORAL', color: '#047857', content_type: 'apenas_titulo', hide_if_empty: false },
    { id: 'sec_5', name: 'FUNDO MUSICAL', color: '#6D28D9', content_type: 'audios', hide_if_empty: true }
];

let secoesHolyricsConfig = JSON.parse(JSON.stringify(PADRAO_SECOES_HOLYRICS));
let holyricsChurchToken = '';
let tokenVisivel = false;
let templateModuloCache = null;

/**
 * Carrega a configuração da igreja (token e modelo de seções)
 */
async function carregarConfiguracaoHolyrics() {
    const userToEvaluate = (typeof modoSimulacaoPerfil !== 'undefined' ? modoSimulacaoPerfil : null) || (typeof usuarioLogado !== 'undefined' ? usuarioLogado : null);
    const churchId = userToEvaluate?.church_id || window.dadosGlobais?.church?.id || 'default';

    let tokenCarregado = null;
    let templateCarregado = null;

    // 1. Tentar ler da memória global primeiro
    const churchData = window.dadosGlobais?.church;
    if (churchData) {
        if (churchData.public_permissions) {
            let pub = churchData.public_permissions;
            if (typeof pub === 'string') {
                try { pub = JSON.parse(pub); } catch(e) {}
            }
            if (pub?.holyrics_api_token) tokenCarregado = pub.holyrics_api_token;
            if (pub?.holyrics_template && Array.isArray(pub.holyrics_template)) templateCarregado = pub.holyrics_template;
        }
    }

    // 2. Tentar buscar do Supabase se houver conexão e churchId válido
    if (typeof supabaseClient !== 'undefined' && supabaseClient && churchId && churchId !== 'default') {
        try {
            const { data: row } = await supabaseClient
                .from('churches')
                .select('id, name, public_permissions')
                .eq('id', churchId)
                .maybeSingle();

            if (row) {
                let pub = row.public_permissions;
                if (typeof pub === 'string') {
                    try { pub = JSON.parse(pub); } catch(e) {}
                }
                if (!pub) pub = {};

                if (pub.holyrics_api_token) tokenCarregado = pub.holyrics_api_token;
                if (pub.holyrics_template && Array.isArray(pub.holyrics_template)) templateCarregado = pub.holyrics_template;

                // Se a igreja ainda não possui um token, gerar um e salvar em public_permissions
                if (!tokenCarregado) {
                    tokenCarregado = 'ltg_live_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
                    pub.holyrics_api_token = tokenCarregado;

                    await supabaseClient
                        .from('churches')
                        .update({ public_permissions: pub })
                        .eq('id', churchId);

                    if (window.dadosGlobais?.church) {
                        window.dadosGlobais.church.public_permissions = pub;
                    }
                }
            }
        } catch (err) {
            console.warn('Aviso ao consultar credenciais Holyrics no Supabase:', err);
        }
    }

    // 3. Fallback no localStorage
    if (!tokenCarregado) {
        tokenCarregado = localStorage.getItem('holyrics_token_' + churchId) || ('ltg_live_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36));
        localStorage.setItem('holyrics_token_' + churchId, tokenCarregado);
    }
    if (!templateCarregado) {
        const salvo = localStorage.getItem('holyrics_template_' + churchId);
        if (salvo) {
            try { templateCarregado = JSON.parse(salvo); } catch(e) {}
        }
    }

    holyricsChurchToken = tokenCarregado;
    secoesHolyricsConfig = (templateCarregado && Array.isArray(templateCarregado) && templateCarregado.length > 0)
        ? templateCarregado
        : JSON.parse(JSON.stringify(PADRAO_SECOES_HOLYRICS));

    atualizarExibicaoToken();
    renderizarEditorHolyrics();
    renderizarPreviewHolyrics();
}

/**
 * Atualiza o input de exibição do token
 */
function atualizarExibicaoToken() {
    const el = document.getElementById('holyrics-token-input');
    if (!el) return;
    el.value = holyricsChurchToken || '';
    el.type = tokenVisivel ? 'text' : 'password';

    const btnEye = document.getElementById('btn-toggle-token-eye');
    if (btnEye) {
        btnEye.textContent = tokenVisivel ? '🔒' : '👁️';
    }
}

/**
 * Alterna visualização do token (texto vs password)
 */
function toggleVisibilidadeTokenHolyrics() {
    tokenVisivel = !tokenVisivel;
    atualizarExibicaoToken();
}

/**
 * Copia o token para a área de transferência
 */
function copiarTokenHolyrics() {
    if (!holyricsChurchToken) {
        if (typeof mostrarToast === 'function') mostrarToast('Token não carregado.', 'aviso');
        return;
    }
    navigator.clipboard.writeText(holyricsChurchToken).then(() => {
        if (typeof mostrarToast === 'function') mostrarToast('Token da igreja copiado com sucesso!', 'sucesso');
    }).catch(() => {
        if (typeof mostrarToast === 'function') mostrarToast('Erro ao copiar token.', 'erro');
    });
}

/**
 * Gera um novo token para a igreja
 */
async function gerarNovoTokenHolyrics() {
    if (!confirm('Deseja realmente gerar um NOVO token de integração?\n\nAtenção: O token anterior deixará de funcionar e você precisará atualizar o módulo no Holyrics da igreja.')) {
        return;
    }

    const userToEvaluate = (typeof modoSimulacaoPerfil !== 'undefined' ? modoSimulacaoPerfil : null) || (typeof usuarioLogado !== 'undefined' ? usuarioLogado : null);
    const churchId = userToEvaluate?.church_id || window.dadosGlobais?.church?.id;
    const novoToken = 'ltg_live_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);

    holyricsChurchToken = novoToken;
    atualizarExibicaoToken();

    if (churchId && typeof supabaseClient !== 'undefined' && supabaseClient) {
        try {
            let pub = window.dadosGlobais?.church?.public_permissions || {};
            if (typeof pub === 'string') {
                try { pub = JSON.parse(pub); } catch(e) { pub = {}; }
            }
            if (!pub) pub = {};
            pub.holyrics_api_token = novoToken;

            await supabaseClient.from('churches').update({
                public_permissions: pub
            }).eq('id', churchId);

            if (window.dadosGlobais?.church) {
                window.dadosGlobais.church.public_permissions = pub;
            }
        } catch (e) {
            console.error('Erro ao salvar novo token:', e);
        }
    }

    if (churchId) localStorage.setItem('holyrics_token_' + churchId, novoToken);
    if (typeof mostrarToast === 'function') mostrarToast('Novo Token gerado com sucesso! Baixe o módulo novamente.', 'sucesso');
}

/**
 * Renderiza o construtor visual de seções
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

    const coresPredefinidas = ['#1E3A8A', '#0284C7', '#B45309', '#047857', '#6D28D9', '#BE185D'];

    container.innerHTML = secoesHolyricsConfig.map((sec, idx) => {
        const isFirst = idx === 0;
        const isLast = idx === secoesHolyricsConfig.length - 1;
        const cor = sec.color || '#1E3A8A';
        const hideIfEmpty = sec.hide_if_empty === true;

        const botoesCores = coresPredefinidas.map(c => `
            <button type="button" onclick="alterarCorSecao(${idx}, '${c}')"
                class="w-4 h-4 rounded-full border ${cor.toLowerCase() === c.toLowerCase() ? 'border-white scale-110 shadow-sm' : 'border-transparent opacity-70 hover:opacity-100'} transition cursor-pointer"
                style="background-color: ${c};" title="${c}">
            </button>
        `).join('');

        return `
            <div class="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-3 transition hover:border-slate-700 shadow-sm">
                <!-- Cabeçalho da Seção -->
                <div class="flex items-center justify-between gap-2">
                    <div class="flex items-center gap-2 flex-1">
                        <span class="w-3 h-3 rounded-full shrink-0 shadow-sm" style="background-color: ${cor}"></span>
                        <input type="text" value="${sec.name || ''}" 
                            oninput="atualizarNomeSecao(${idx}, this.value)"
                            placeholder="Ex: ABERTURA, LOUVOR, AVISOS..."
                            class="flex-1 bg-slate-900 border border-slate-700 focus:border-cyan-500 rounded-lg px-3 py-1.5 text-xs text-white font-bold tracking-wide uppercase focus:outline-none transition">
                    </div>

                    <div class="flex items-center gap-1">
                        <button onclick="moverSecao(${idx}, -1)" ${isFirst ? 'disabled class="opacity-20 cursor-not-allowed p-1 text-slate-500"' : 'class="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition cursor-pointer"'} title="Mover para cima">
                            ⬆️
                        </button>
                        <button onclick="moverSecao(${idx}, 1)" ${isLast ? 'disabled class="opacity-20 cursor-not-allowed p-1 text-slate-500"' : 'class="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition cursor-pointer"'} title="Mover para baixo">
                            ⬇️
                        </button>
                        <button onclick="removerSecao(${idx})" class="p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded transition ml-1 cursor-pointer" title="Excluir Seção">
                            🗑️
                        </button>
                    </div>
                </div>

                <!-- Configuração de Conteúdo e Cor -->
                <div class="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center text-xs">
                    
                    <!-- Tipo de Conteúdo -->
                    <div class="sm:col-span-6 flex items-center gap-2">
                        <span class="text-slate-400 whitespace-nowrap text-[11px]">Tipo:</span>
                        <select onchange="atualizarTipoConteudo(${idx}, this.value)"
                            class="flex-1 bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-cyan-500 cursor-pointer">
                            <option value="videos" ${sec.content_type === 'videos' ? 'selected' : ''}>🎬 Vídeos Anexados</option>
                            <option value="musicas" ${(sec.content_type === 'musicas' || sec.content_type === 'songs') ? 'selected' : ''}>🎵 Músicas do Culto (Letras)</option>
                            <option value="imagens" ${(sec.content_type === 'imagens' || sec.content_type === 'images') ? 'selected' : ''}>🖼️ Imagens Anexadas</option>
                            <option value="audios" ${sec.content_type === 'audios' ? 'selected' : ''}>🎧 Áudios Anexados</option>
                            <option value="apenas_titulo" ${sec.content_type === 'apenas_titulo' ? 'selected' : ''}>🏷️ Apenas Marcador de Timeline</option>
                        </select>
                    </div>

                    <!-- Seletor de Cor -->
                    <div class="sm:col-span-6 flex items-center justify-start sm:justify-end gap-2">
                        <span class="text-slate-400 text-[11px]">Cor:</span>
                        <div class="flex items-center gap-1.5">
                            ${botoesCores}
                            <input type="color" value="${cor}" onchange="alterarCorSecao(${idx}, this.value)"
                                class="w-6 h-6 rounded border border-slate-700 cursor-pointer bg-transparent" title="Personalizar cor">
                        </div>
                    </div>

                </div>

                <!-- Toggle Ocultar se Vazia -->
                <div class="pt-2 border-t border-slate-800 flex items-center justify-between">
                    <label class="flex items-center gap-2 cursor-pointer select-none text-[11px] text-slate-400 hover:text-slate-300">
                        <input type="checkbox" ${hideIfEmpty ? 'checked' : ''} 
                            onchange="atualizarOcultarVazia(${idx}, this.checked)"
                            class="rounded bg-slate-900 border-slate-700 text-cyan-500 focus:ring-0 w-3.5 h-3.5 cursor-pointer">
                        <span>Ocultar esta seção se o culto não tiver arquivos desse tipo</span>
                    </label>
                    <span class="text-[10px] font-mono text-slate-500 uppercase">${cor}</span>
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Atualizadores do estado local
 */
function atualizarNomeSecao(idx, val) {
    if (secoesHolyricsConfig[idx]) {
        secoesHolyricsConfig[idx].name = val.toUpperCase();
        renderizarPreviewHolyrics();
    }
}

function alterarCorSecao(idx, cor) {
    if (secoesHolyricsConfig[idx]) {
        secoesHolyricsConfig[idx].color = cor;
        renderizarEditorHolyrics();
        renderizarPreviewHolyrics();
    }
}

function atualizarTipoConteudo(idx, tipo) {
    if (secoesHolyricsConfig[idx]) {
        secoesHolyricsConfig[idx].content_type = tipo;
        renderizarPreviewHolyrics();
    }
}

function atualizarOcultarVazia(idx, checked) {
    if (secoesHolyricsConfig[idx]) {
        secoesHolyricsConfig[idx].hide_if_empty = checked;
        renderizarPreviewHolyrics();
    }
}

function moverSecao(idx, direcao) {
    const novoIdx = idx + direcao;
    if (novoIdx < 0 || novoIdx >= secoesHolyricsConfig.length) return;
    const item = secoesHolyricsConfig.splice(idx, 1)[0];
    secoesHolyricsConfig.splice(novoIdx, 0, item);
    renderizarEditorHolyrics();
    renderizarPreviewHolyrics();
}

function removerSecao(idx) {
    if (!confirm(`Remover a seção "${secoesHolyricsConfig[idx]?.name || ''}" do modelo padrão?`)) return;
    secoesHolyricsConfig.splice(idx, 1);
    renderizarEditorHolyrics();
    renderizarPreviewHolyrics();
}

function adicionarSecaoHolyrics() {
    secoesHolyricsConfig.push({
        id: 'sec_' + Date.now(),
        name: 'NOVA SEÇÃO',
        color: '#0284C7',
        content_type: 'apenas_titulo',
        hide_if_empty: false
    });
    renderizarEditorHolyrics();
    renderizarPreviewHolyrics();
}

function restaurarPadraoHolyrics() {
    if (!confirm('Deseja restaurar as seções padrão do Holyrics? Suas personalizações não salvas serão substituídas.')) return;
    secoesHolyricsConfig = JSON.parse(JSON.stringify(PADRAO_SECOES_HOLYRICS));
    renderizarEditorHolyrics();
    renderizarPreviewHolyrics();
    if (typeof mostrarToast === 'function') mostrarToast('Modelo restaurado para o padrão!', 'info');
}

/**
 * Salva a configuração no Supabase
 */
async function salvarConfiguracaoHolyrics() {
    const userToEvaluate = (typeof modoSimulacaoPerfil !== 'undefined' ? modoSimulacaoPerfil : null) || (typeof usuarioLogado !== 'undefined' ? usuarioLogado : null);
    const churchId = userToEvaluate?.church_id || window.dadosGlobais?.church?.id;

    if (churchId) {
        localStorage.setItem('holyrics_template_' + churchId, JSON.stringify(secoesHolyricsConfig));
    }

    if (churchId && typeof supabaseClient !== 'undefined' && supabaseClient) {
        try {
            let pub = window.dadosGlobais?.church?.public_permissions || {};
            if (typeof pub === 'string') {
                try { pub = JSON.parse(pub); } catch(e) { pub = {}; }
            }
            if (!pub) pub = {};
            pub.holyrics_template = secoesHolyricsConfig;
            if (holyricsChurchToken) pub.holyrics_api_token = holyricsChurchToken;

            await supabaseClient.from('churches').update({
                public_permissions: pub
            }).eq('id', churchId);

            if (window.dadosGlobais?.church) {
                window.dadosGlobais.church.public_permissions = pub;
            }

            if (typeof mostrarToast === 'function') mostrarToast('Estrutura de seções salva com sucesso no Liturge!', 'sucesso');
            return;
        } catch (err) {
            console.error('Erro ao salvar template Holyrics no Supabase:', err);
            if (typeof mostrarToast === 'function') mostrarToast('Salvo localmente (aviso ao sincronizar nuvem: ' + err.message + ')', 'aviso');
            return;
        }
    }

    if (typeof mostrarToast === 'function') mostrarToast('Estrutura salva localmente!', 'sucesso');
}

/**
 * Renderiza o simulador visual da Timeline do Holyrics
 */
function renderizarPreviewHolyrics() {
    const container = document.getElementById('preview-playlist-holyrics');
    const badgeTotal = document.getElementById('preview-total-secoes');
    if (!container) return;

    if (badgeTotal) badgeTotal.textContent = secoesHolyricsConfig.length;

    if (!secoesHolyricsConfig || secoesHolyricsConfig.length === 0) {
        container.innerHTML = `
            <div class="text-center py-16 text-zinc-600 text-xs">
                Nenhuma seção na timeline.
            </div>
        `;
        return;
    }

    container.innerHTML = secoesHolyricsConfig.map((sec, idx) => {
        const cor = sec.color || '#1E3A8A';
        const tipo = sec.content_type || 'apenas_titulo';
        const hideIfEmpty = sec.hide_if_empty === true;

        let itensSimuladosHtml = '';

        if (tipo === 'musicas' || tipo === 'songs') {
            itensSimuladosHtml = `
                <div class="pl-4 py-1 flex items-center gap-2 text-xs text-zinc-300 hover:bg-zinc-800/40 rounded px-2 transition">
                    <span class="text-cyan-400">🎵</span>
                    <span class="font-medium truncate">Bondade de Deus</span>
                    <span class="text-[10px] text-zinc-500">Isaías Saad</span>
                </div>
                <div class="pl-4 py-1 flex items-center gap-2 text-xs text-zinc-300 hover:bg-zinc-800/40 rounded px-2 transition">
                    <span class="text-cyan-400">🎵</span>
                    <span class="font-medium truncate">Ousado Amor</span>
                    <span class="text-[10px] text-zinc-500">Isaías Saad</span>
                </div>
            `;
        } else if (tipo === 'videos') {
            itensSimuladosHtml = `
                <div class="pl-4 py-1 flex items-center gap-2 text-xs text-zinc-300 hover:bg-zinc-800/40 rounded px-2 transition">
                    <span class="text-purple-400">🎬</span>
                    <span class="font-mono text-[11px] truncate">Liturge/video_abertura.mp4</span>
                </div>
            `;
        } else if (tipo === 'imagens' || tipo === 'images') {
            itensSimuladosHtml = `
                <div class="pl-4 py-1 flex items-center gap-2 text-xs text-zinc-300 hover:bg-zinc-800/40 rounded px-2 transition">
                    <span class="text-amber-400">🖼️</span>
                    <span class="font-mono text-[11px] truncate">Liturge/slide_conferencia.jpg</span>
                </div>
            `;
        } else if (tipo === 'audios') {
            itensSimuladosHtml = `
                <div class="pl-4 py-1 flex items-center gap-2 text-xs text-zinc-300 hover:bg-zinc-800/40 rounded px-2 transition">
                    <span class="text-indigo-400">🎧</span>
                    <span class="font-mono text-[11px] truncate">Liturge/fundo_oracao.mp3</span>
                </div>
            `;
        } else {
            itensSimuladosHtml = `
                <div class="pl-4 py-0.5 text-[11px] text-zinc-500 italic">
                    (Marcador de tempo da liturgia)
                </div>
            `;
        }

        return `
            <div class="space-y-1">
                <!-- Título da Seção do Holyrics -->
                <div class="w-full px-3 py-1.5 rounded text-white font-bold text-xs uppercase tracking-wide flex items-center justify-between shadow-sm"
                    style="background-color: ${cor};">
                    <span class="truncate">${sec.name || 'SEÇÃO'}</span>
                    ${hideIfEmpty ? '<span class="text-[9px] bg-black/40 px-1.5 py-0.5 rounded font-normal lowercase tracking-normal">ocultar se vazia</span>' : ''}
                </div>
                <!-- Itens da Seção -->
                <div class="space-y-0.5 pt-0.5 pb-1">
                    ${itensSimuladosHtml}
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Obtém o código-fonte base do módulo da pasta /scripts/liturge_sync.js
 */
async function obterTemplateModulo() {
    if (templateModuloCache) return templateModuloCache;
    try {
        const resp = await fetch('scripts/liturge_sync.js?v=' + Date.now());
        if (resp.ok) {
            templateModuloCache = await resp.text();
            return templateModuloCache;
        }
    } catch (e) {
        console.warn('Aviso ao carregar template via fetch:', e);
    }
    return null;
}

/**
 * Gera o código-fonte final do módulo JavaScript do Holyrics com credenciais embutidas
 */
async function gerarCodigoModuloFinal() {
    const apiUrl = 'https://app.liturge.app.br/api/v1';
    const token = holyricsChurchToken || '';

    let template = await obterTemplateModulo();
    if (!template) {
        throw new Error('Arquivo base do módulo (scripts/liturge_sync.js) não pôde ser carregado.');
    }

    // Substituir token e URL na definição de settings do módulo
    template = template.replace(
        /id:\s*['"]church_api_token['"],\s*name:[^,]+,\s*type:[^,]+,\s*default_value:\s*['"][^'"]*['"]/g,
        "id: 'church_api_token', name: 'Token da Igreja (API Key)', type: 'password', default_value: '" + token + "'"
    );

    template = template.replace(
        /id:\s*['"]liturge_api_url['"],\s*name:[^,]+,\s*type:[^,]+,\s*default_value:\s*['"][^'"]*['"]/g,
        "id: 'liturge_api_url', name: 'URL da API Liturge', type: 'string', default_value: '" + apiUrl + "'"
    );

    return template;
}

/**
 * Dispara o download direto do módulo .js pré-configurado
 */
async function baixarArquivoModuloHolyrics() {
    try {
        const codigo = await gerarCodigoModuloFinal();
        const blob = new Blob([codigo], { type: 'application/javascript;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'liturge_sync.js';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        if (typeof mostrarToast === 'function') {
            mostrarToast('Módulo "liturge_sync.js" baixado! Agora basta adicioná-lo no Holyrics.', 'sucesso');
        }
    } catch (err) {
        console.error('Erro ao baixar módulo:', err);
        if (typeof mostrarToast === 'function') mostrarToast('Erro ao baixar arquivo: ' + err.message, 'erro');
    }
}

/**
 * Copia o código completo do módulo com token para a área de transferência
 */
async function copiarCodigoModuloHolyrics() {
    try {
        const codigo = await gerarCodigoModuloFinal();
        navigator.clipboard.writeText(codigo).then(() => {
            if (typeof mostrarToast === 'function') {
                mostrarToast('Código do módulo copiado! Cole no editor do Holyrics.', 'sucesso');
            }
        }).catch(() => {
            if (typeof mostrarToast === 'function') mostrarToast('Erro ao copiar código.', 'erro');
        });
    } catch (err) {
        console.error('Erro ao copiar módulo:', err);
        if (typeof mostrarToast === 'function') mostrarToast('Erro ao gerar código: ' + err.message, 'erro');
    }
}

// Expor funções globalmente para chamadas nos eventos onclick dos botões HTML
window.carregarConfiguracaoHolyrics = carregarConfiguracaoHolyrics;
window.salvarConfiguracaoHolyrics = salvarConfiguracaoHolyrics;
window.restaurarPadraoHolyrics = restaurarPadraoHolyrics;
window.adicionarSecaoHolyrics = adicionarSecaoHolyrics;
window.removerSecao = removerSecao;
window.moverSecao = moverSecao;
window.alterarCorSecao = alterarCorSecao;
window.atualizarNomeSecao = atualizarNomeSecao;
window.atualizarTipoConteudo = atualizarTipoConteudo;
window.atualizarOcultarVazia = atualizarOcultarVazia;
window.toggleVisibilidadeTokenHolyrics = toggleVisibilidadeTokenHolyrics;
window.copiarTokenHolyrics = copiarTokenHolyrics;
window.gerarNovoTokenHolyrics = gerarNovoTokenHolyrics;
window.baixarArquivoModuloHolyrics = baixarArquivoModuloHolyrics;
window.copiarCodigoModuloHolyrics = copiarCodigoModuloHolyrics;
