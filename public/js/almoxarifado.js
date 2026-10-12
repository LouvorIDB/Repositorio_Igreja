/**
 * almoxarifado.js - Gestão do Almoxarifado Virtual e Base de Conhecimento (Wiki)
 * Redesign: Cards compactos estilo streaming (músicas), formulários em linha (sem modais flutuantes)
 * e captura direta de foto (câmera) e gravação de vídeo/tutorial sem necessidade de links.
 */

let almoxarifadoAssets = [];
let almoxarifadoDocs = [];
let abaAlmoxarifadoAtiva = 'equipamentos';
let drawerAbertoEquipamentoId = null;
let drawerAbertoWikiId = null;

function obterIdsMinisteriosDoUsuario(user) {
    if (!user) return [];
    const minIds = new Set();
    if (user.ministry_id) minIds.add(user.ministry_id);

    const userUmr = user.user_ministry_roles || [];
    const userRoleIds = userUmr.map(ur => ur.ministry_role_id || ur.role_id).filter(Boolean);

    const ministries = window.dadosGlobais?.ministries || [];
    ministries.forEach(m => {
        if (m.id === user.ministry_id) minIds.add(m.id);
        const roles = m.ministry_roles || [];
        if (roles.some(r => userRoleIds.includes(r.id))) {
            minIds.add(m.id);
        }
    });

    userUmr.forEach(ur => {
        if (ur.ministry_id) minIds.add(ur.ministry_id);
        if (ur.ministry_roles && ur.ministry_roles.ministry_id) minIds.add(ur.ministry_roles.ministry_id);
    });

    return Array.from(minIds);
}

async function carregarAlmoxarifado() {
    if (!supabaseClient) return;

    try {
        const userToEvaluate = modoSimulacaoPerfil || usuarioLogado;
        const isAdmin = userToEvaluate?.system_role === 'admin' || userToEvaluate?.role === 'admin';
        const userMinistryIds = obterIdsMinisteriosDoUsuario(userToEvaluate);

        // Bloqueio Silencioso: se não for admin e não tiver nenhum ministério vinculado, limpa a tela
        if (!isAdmin && userMinistryIds.length === 0) {
            almoxarifadoAssets = [];
            almoxarifadoDocs = [];
            const containerEq = document.getElementById('grid-equipamentos');
            const containerDocs = document.getElementById('grid-docs-wiki');
            if (containerEq) containerEq.innerHTML = '';
            if (containerDocs) containerDocs.innerHTML = '';
            atualizarBotoesPermissaoAlmoxarifado();
            return;
        }

        const currentChurchId = userToEvaluate?.church_id || window.dadosGlobais?.church?.id || null;

        // 1. Buscar Equipamentos / Assets
        let queryAssets = supabaseClient.from('ministry_assets').select('*, ministries(name, icon)').order('name');
        if (currentChurchId) queryAssets = queryAssets.eq('church_id', currentChurchId);
        
        const { data: assetsData, error: assetsErr } = await queryAssets;
        if (!assetsErr && assetsData) {
            almoxarifadoAssets = isAdmin 
                ? assetsData 
                : assetsData.filter(item => !item.ministry_id || userMinistryIds.includes(item.ministry_id));
        }

        // 2. Buscar Documentos / Wiki
        let queryDocs = supabaseClient.from('ministry_docs').select('*, ministries(name, icon)').order('title');
        if (currentChurchId) queryDocs = queryDocs.eq('church_id', currentChurchId);

        const { data: docsData, error: docsErr } = await queryDocs;
        if (!docsErr && docsData) {
            almoxarifadoDocs = isAdmin 
                ? docsData 
                : docsData.filter(doc => !doc.ministry_id || userMinistryIds.includes(doc.ministry_id));
        }

        renderizarAlmoxarifado();
        atualizarBotoesPermissaoAlmoxarifado();
    } catch (err) {
        console.warn('Aviso ao carregar dados do almoxarifado:', err);
    }
}

let filtroStatusEquipamento = 'todos';
let filtroBuscaEquipamento = '';
let filtroBuscaWiki = '';

function filtrarEquipamentosPorBusca(texto) {
    filtroBuscaEquipamento = (texto || '').toLowerCase().trim();
    renderizarEquipamentos();
}
window.filtrarEquipamentosPorBusca = filtrarEquipamentosPorBusca;

function limparBuscaEquipamentos() {
    filtroBuscaEquipamento = '';
    const input = document.getElementById('input-busca-equipamentos');
    if (input) input.value = '';
    renderizarEquipamentos();
}
window.limparBuscaEquipamentos = limparBuscaEquipamentos;

function selecionarFiltroStatusEquipamento(status) {
    filtroStatusEquipamento = status || 'todos';

    const statuses = ['todos', 'disponivel', 'em_uso', 'manutencao', 'quebrado'];
    statuses.forEach(st => {
        const btn = document.getElementById(`filtro-status-eq-${st}`);
        if (btn) {
            if (st === filtroStatusEquipamento) {
                btn.className = 'px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer bg-brand-500 text-night-950 shadow-sm shadow-brand-500/20';
            } else {
                btn.className = 'px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700';
            }
        }
    });

    renderizarEquipamentos();
}
window.selecionarFiltroStatusEquipamento = selecionarFiltroStatusEquipamento;

function filtrarWikiPorBusca(texto) {
    filtroBuscaWiki = (texto || '').toLowerCase().trim();
    renderizarDocsWiki();
}
window.filtrarWikiPorBusca = filtrarWikiPorBusca;

function limparBuscaWiki() {
    filtroBuscaWiki = '';
    const input = document.getElementById('input-busca-wiki');
    if (input) input.value = '';
    renderizarDocsWiki();
}
window.limparBuscaWiki = limparBuscaWiki;

function renderizarAlmoxarifado() {
    renderizarEquipamentos();
    renderizarDocsWiki();
    atualizarBadgeTotalAlmoxarifado();
}

function atualizarBadgeTotalAlmoxarifado() {
    const el = document.getElementById('badge-total-almoxarifado');
    if (el) {
        const totalEq = (almoxarifadoAssets || []).length;
        const totalWk = (almoxarifadoDocs || []).length;
        el.textContent = `${totalEq} itens • ${totalWk} tutoriais`;
    }
}

const statusBadges = {
    disponivel: { label: 'Disponível / OK', bg: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30' },
    em_uso: { label: 'Em Uso', bg: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30' },
    manutencao: { label: 'Na Manutenção', bg: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30' },
    quebrado: { label: 'Com Defeito', bg: 'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30' }
};

// ===================== EQUIPAMENTOS: CARDS COMPACTOS =====================

function extrairFotoEquipamento(item) {
    if (item.photo_url) return { photoUrl: item.photo_url, cleanDesc: item.description || '' };
    
    const desc = item.description || '';
    if (desc.includes('<!--PHOTO:')) {
        const match = desc.match(/<!--PHOTO:(.*?)-->/);
        if (match && match[1]) {
            return {
                photoUrl: match[1],
                cleanDesc: desc.replace(/<!--PHOTO:.*?-->\n?/, '').trim()
            };
        }
    }
    return { photoUrl: '', cleanDesc: desc };
}

function renderizarEquipamentos() {
    const container = document.getElementById('grid-equipamentos');
    if (!container) return;

    let items = almoxarifadoAssets || [];

    // Filtro por busca
    if (filtroBuscaEquipamento) {
        items = items.filter(item => {
            const n = (item.name || '').toLowerCase();
            const l = (item.location || '').toLowerCase();
            const d = (item.description || '').toLowerCase();
            return n.includes(filtroBuscaEquipamento) || l.includes(filtroBuscaEquipamento) || d.includes(filtroBuscaEquipamento);
        });
    }

    // Filtro por status
    if (filtroStatusEquipamento !== 'todos') {
        items = items.filter(item => item.status === filtroStatusEquipamento);
    }

    if (items.length === 0) {
        container.innerHTML = `
            <div class="py-16 text-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-night-900/40 space-y-2">
                <span class="text-3xl block">📦</span>
                <p class="text-sm font-bold text-slate-700 dark:text-slate-300">Nenhum equipamento encontrado</p>
                <p class="text-xs text-slate-500 dark:text-slate-400">Tente ajustar o termo de busca ou altere o filtro de status acima.</p>
            </div>
        `;
        return;
    }

    const podeEditar = usuarioPodeEditarAlmoxarifado();

    container.innerHTML = items.map(item => {
        const badge = statusBadges[item.status] || statusBadges.disponivel;
        const minNome = item.ministries ? item.ministries.name : 'Geral';
        const minIcon = item.ministries?.icon || '🏢';
        const { photoUrl, cleanDesc } = extrairFotoEquipamento(item);

        const isAberto = drawerAbertoEquipamentoId === item.id;

        const thumbHtml = photoUrl 
            ? `<img src="${photoUrl}" alt="${item.name}" class="w-full h-full object-cover" loading="lazy">`
            : `<div class="w-full h-full flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-lg">${minIcon !== '🏢' ? minIcon : '📦'}</div>`;

        const drawerId = `drawer-equip-${item.id}`;
        const chevronId = `chevron-equip-${item.id}`;

        return `
            <div class="w-full rounded-2xl bg-white dark:bg-night-900/90 border border-slate-200/80 dark:border-slate-800/80 transition-all overflow-hidden shadow-xs hover:border-brand-500/40">
                <!-- Linha Compacta Estilo Músicas -->
                <div onclick="toggleDrawerEquipamento('${item.id}')" class="p-2.5 sm:p-3 flex items-center justify-between gap-3 cursor-pointer active:scale-[0.99] transition">
                    <div class="flex items-center gap-3 min-w-0 flex-1">
                        <div class="relative w-11 h-11 sm:w-12 sm:h-12 rounded-xl overflow-hidden shrink-0 border border-slate-200 dark:border-slate-700/60 shadow-xs bg-slate-900">
                            ${thumbHtml}
                        </div>
                        <div class="min-w-0 flex-1">
                            <h4 class="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                                ${item.name}
                            </h4>
                            <p class="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5 font-medium flex items-center gap-1.5">
                                ${item.location ? `<span>📍 ${item.location}</span>` : '<span>📍 Sem local</span>'}
                                <span class="text-slate-300 dark:text-slate-700">•</span>
                                <span>${minIcon} ${minNome}</span>
                            </p>
                        </div>
                    </div>

                    <div class="flex items-center gap-2 shrink-0">
                        <span class="text-[10px] font-bold px-2 py-0.5 rounded-full border ${badge.bg}">
                            ${badge.label}
                        </span>
                        <span id="${chevronId}" class="text-slate-300 dark:text-slate-600 transition-transform duration-200 text-base font-bold pl-0.5 ${isAberto ? 'rotate-90 text-brand-500' : ''}">›</span>
                    </div>
                </div>

                <!-- Gaveta de Detalhes Inline (Accordion Suave) -->
                <div id="${drawerId}" class="${isAberto ? '' : 'hidden'} border-t border-slate-100 dark:border-slate-800 p-3 sm:p-4 bg-slate-50/50 dark:bg-slate-900/40 space-y-3">
                    ${photoUrl ? `
                        <div class="w-full sm:w-72 max-h-48 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-black cursor-pointer group relative" onclick="if (typeof abrirLightboxMidia === 'function') abrirLightboxMidia('${photoUrl}', '${item.name.replace(/'/g, "\\'")}', 'imagem')">
                            <img src="${photoUrl}" class="w-full h-full object-cover group-hover:scale-105 transition duration-300" alt="${item.name}">
                            <div class="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-xs font-bold gap-1">
                                <span>🔍 Ver Foto em Tela Cheia</span>
                            </div>
                        </div>
                    ` : ''}

                    ${cleanDesc ? `
                        <div class="p-2.5 rounded-xl bg-white dark:bg-night-950/80 border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 whitespace-pre-line leading-relaxed">
                            ${cleanDesc}
                        </div>
                    ` : ''}

                    <!-- Troca Rápida de Status (1 Toque) -->
                    ${podeEditar ? `
                        <div class="space-y-1.5 pt-1">
                            <span class="text-[10px] uppercase font-bold tracking-wider text-slate-400">Alterar Status Rápido:</span>
                            <div class="flex flex-wrap items-center gap-1.5">
                                <button type="button" onclick="alterarStatusEquipamentoRapido('${item.id}', 'disponivel')" class="px-2.5 py-1 rounded-lg text-[11px] font-bold transition border cursor-pointer ${item.status === 'disponivel' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' : 'bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:text-white'}">🟢 OK</button>
                                <button type="button" onclick="alterarStatusEquipamentoRapido('${item.id}', 'em_uso')" class="px-2.5 py-1 rounded-lg text-[11px] font-bold transition border cursor-pointer ${item.status === 'em_uso' ? 'bg-blue-500/20 text-blue-400 border-blue-500/40' : 'bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:text-white'}">🔵 Em Uso</button>
                                <button type="button" onclick="alterarStatusEquipamentoRapido('${item.id}', 'manutencao')" class="px-2.5 py-1 rounded-lg text-[11px] font-bold transition border cursor-pointer ${item.status === 'manutencao' ? 'bg-amber-500/20 text-amber-400 border-amber-500/40' : 'bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:text-white'}">🟡 Manutenção</button>
                                <button type="button" onclick="alterarStatusEquipamentoRapido('${item.id}', 'quebrado')" class="px-2.5 py-1 rounded-lg text-[11px] font-bold transition border cursor-pointer ${item.status === 'quebrado' ? 'bg-red-500/20 text-red-400 border-red-500/40' : 'bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:text-white'}">🔴 Defeito</button>
                            </div>
                        </div>

                        <div class="flex items-center justify-end gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-800/80">
                            <button type="button" onclick="editarEquipamento('${item.id}')" class="px-3 py-1.5 text-xs text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl transition font-semibold cursor-pointer">✏️ Editar</button>
                            <button type="button" onclick="deletarEquipamento('${item.id}')" class="px-3 py-1.5 text-xs text-red-600 dark:text-red-400 hover:text-red-700 bg-red-500/10 hover:bg-red-500/20 rounded-xl transition font-semibold cursor-pointer">🗑️ Excluir</button>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');
}

function toggleDrawerEquipamento(id) {
    const drawer = document.getElementById(`drawer-equip-${id}`);
    const chevron = document.getElementById(`chevron-equip-${id}`);
    if (!drawer) return;

    const isHidden = drawer.classList.contains('hidden');
    drawer.classList.toggle('hidden', !isHidden);

    if (chevron) {
        chevron.classList.toggle('rotate-90', isHidden);
        chevron.classList.toggle('text-brand-500', isHidden);
    }
    drawerAbertoEquipamentoId = isHidden ? id : null;
}
window.toggleDrawerEquipamento = toggleDrawerEquipamento;

async function alterarStatusEquipamentoRapido(id, novoStatus) {
    if (!supabaseClient) return;
    try {
        await supabaseClient.from('ministry_assets').update({ status: novoStatus }).eq('id', id);
        const item = almoxarifadoAssets.find(a => a.id === id);
        if (item) item.status = novoStatus;
        renderizarEquipamentos();
        if (typeof mostrarToast === 'function') mostrarToast('Status atualizado!', 'sucesso');
    } catch (err) {
        console.error('Erro ao atualizar status:', err);
    }
}
window.alterarStatusEquipamentoRapido = alterarStatusEquipamentoRapido;

// ===================== WIKI & TUTORIAIS: CARDS COMPACTOS =====================

function renderizarMidiaInlineWiki(url) {
    if (!url) return '';
    const isVideo = url.match(/\.(mp4|webm|ogg)(?:\?.*)?$/i);
    const isImage = url.match(/\.(jpeg|jpg|gif|png|webp)(?:\?.*)?$/i);
    const isPdf = url.match(/\.pdf(?:\?.*)?$/i);
    const ytMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?]+)/);

    if (ytMatch && ytMatch[1]) {
        return `
            <div class="aspect-video w-full rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-black shadow-inner">
                <iframe class="w-full h-full" src="https://www.youtube.com/embed/${ytMatch[1]}" title="Tutorial" frameborder="0" allowfullscreen></iframe>
            </div>
        `;
    }
    if (isVideo) {
        return `
            <div class="aspect-video w-full rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-black shadow-inner">
                <video class="w-full h-full" controls preload="metadata">
                    <source src="${url}">
                </video>
            </div>
        `;
    }
    if (isImage) {
        return `
            <div class="max-h-64 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-black flex justify-center cursor-pointer" onclick="if (typeof abrirLightboxMidia === 'function') abrirLightboxMidia('${url}', 'Guia', 'imagem')">
                <img src="${url}" class="max-h-64 w-auto object-contain" alt="Guia Visual">
            </div>
        `;
    }
    if (isPdf) {
        return `
            <div class="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <span class="text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                    <span>📄</span> <span>Manual em PDF anexo</span>
                </span>
                <a href="${url}" target="_blank" class="px-2.5 py-1 rounded-lg bg-brand-500 text-night-950 text-xs font-bold hover:underline">Abrir PDF ↗</a>
            </div>
        `;
    }
    return `
        <a href="${url}" target="_blank" class="text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1">
            <span>🔗 Acessar Conteúdo Externo</span> <span>↗</span>
        </a>
    `;
}

function renderizarDocsWiki() {
    const container = document.getElementById('grid-docs-wiki');
    const badgeWiki = document.getElementById('badge-total-wiki');
    if (!container) return;

    let docs = almoxarifadoDocs || [];

    // Filtro por busca
    if (filtroBuscaWiki) {
        docs = docs.filter(doc => {
            const t = (doc.title || '').toLowerCase();
            const d = (doc.description || '').toLowerCase();
            const u = (doc.content_url || '').toLowerCase();
            return t.includes(filtroBuscaWiki) || d.includes(filtroBuscaWiki) || u.includes(filtroBuscaWiki);
        });
    }

    if (badgeWiki) {
        badgeWiki.textContent = `${docs.length} tutorial${docs.length === 1 ? '' : 'is'}`;
    }

    if (docs.length === 0) {
        container.innerHTML = `
            <div class="py-16 text-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-night-900/40 space-y-2">
                <span class="text-3xl block">📚</span>
                <p class="text-sm font-bold text-slate-700 dark:text-slate-300">Nenhum tutorial ou manual encontrado</p>
                <p class="text-xs text-slate-500 dark:text-slate-400">Grave um vídeo com o celular ou crie tutoriais de culto.</p>
            </div>
        `;
        return;
    }

    const podeEditar = usuarioPodeEditarAlmoxarifado();

    container.innerHTML = docs.map(doc => {
        const minNome = doc.ministries ? doc.ministries.name : 'Geral';
        const minIcon = doc.ministries?.icon || '🏢';
        const url = (doc.content_url || '').trim();

        const isVideo = url.match(/\.(mp4|webm|ogg)(?:\?.*)?$/i) || url.match(/(?:youtu\.be\/|youtube\.com)/i);
        const isImage = url.match(/\.(jpeg|jpg|gif|png|webp)(?:\?.*)?$/i);
        const isPdf = url.match(/\.pdf(?:\?.*)?$/i);

        let icone = '📝';
        let tipoBadge = 'Guia';
        if (isVideo) { icone = '🎬'; tipoBadge = 'Vídeo'; }
        else if (isPdf) { icone = '📄'; tipoBadge = 'Manual PDF'; }
        else if (isImage) { icone = '🖼️'; tipoBadge = 'Foto/Guia'; }

        const isAberto = drawerAbertoWikiId === doc.id;
        const drawerId = `drawer-wiki-${doc.id}`;
        const chevronId = `chevron-wiki-${doc.id}`;

        return `
            <div class="w-full rounded-2xl bg-white dark:bg-night-900/90 border border-slate-200/80 dark:border-slate-800/80 transition-all overflow-hidden shadow-xs hover:border-brand-500/40">
                <!-- Linha Compacta Estilo Músicas -->
                <div onclick="toggleDrawerWiki('${doc.id}')" class="p-2.5 sm:p-3 flex items-center justify-between gap-3 cursor-pointer active:scale-[0.99] transition">
                    <div class="flex items-center gap-3 min-w-0 flex-1">
                        <div class="relative w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-brand-500/10 border border-brand-500/20 shrink-0 flex items-center justify-center text-xl shadow-xs">
                            ${icone}
                        </div>
                        <div class="min-w-0 flex-1">
                            <h4 class="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                                ${doc.title}
                            </h4>
                            <p class="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5 font-medium flex items-center gap-1.5">
                                <span>${minIcon} ${minNome}</span>
                                <span class="text-slate-300 dark:text-slate-700">•</span>
                                <span>${tipoBadge}</span>
                            </p>
                        </div>
                    </div>

                    <div class="flex items-center gap-2 shrink-0">
                        <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                            ${tipoBadge}
                        </span>
                        <span id="${chevronId}" class="text-slate-300 dark:text-slate-600 transition-transform duration-200 text-base font-bold pl-0.5 ${isAberto ? 'rotate-90 text-brand-500' : ''}">›</span>
                    </div>
                </div>

                <!-- Gaveta de Conteúdo Inline (Accordion Suave) -->
                <div id="${drawerId}" class="${isAberto ? '' : 'hidden'} border-t border-slate-100 dark:border-slate-800 p-3 sm:p-4 bg-slate-50/50 dark:bg-slate-900/40 space-y-3">
                    ${renderizarMidiaInlineWiki(url)}

                    ${doc.description ? `
                        <div class="p-3 rounded-xl bg-white dark:bg-night-950/80 border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 whitespace-pre-line leading-relaxed font-sans">
                            ${doc.description}
                        </div>
                    ` : ''}

                    ${podeEditar ? `
                        <div class="flex items-center justify-end gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-800/80">
                            <button type="button" onclick="editarDocWiki('${doc.id}')" class="px-3 py-1.5 text-xs text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl transition font-semibold cursor-pointer">✏️ Editar</button>
                            <button type="button" onclick="deletarDocWiki('${doc.id}')" class="px-3 py-1.5 text-xs text-red-600 dark:text-red-400 hover:text-red-700 bg-red-500/10 hover:bg-red-500/20 rounded-xl transition font-semibold cursor-pointer">🗑️ Excluir</button>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');
}

function toggleDrawerWiki(id) {
    const drawer = document.getElementById(`drawer-wiki-${id}`);
    const chevron = document.getElementById(`chevron-wiki-${id}`);
    if (!drawer) return;

    const isHidden = drawer.classList.contains('hidden');
    drawer.classList.toggle('hidden', !isHidden);

    if (chevron) {
        chevron.classList.toggle('rotate-90', isHidden);
        chevron.classList.toggle('text-brand-500', isHidden);
    }
    drawerAbertoWikiId = isHidden ? id : null;
}
window.toggleDrawerWiki = toggleDrawerWiki;

// ===================== FORMULÁRIOS EM LINHA (SEM MODAIS FLUTUANTES) =====================

function popularSelectsMinisterioAlmoxarifado() {
    const userToEvaluate = modoSimulacaoPerfil || usuarioLogado;
    const isAdmin = userToEvaluate?.system_role === 'admin' || userToEvaluate?.role === 'admin';
    const userMinistryIds = obterIdsMinisteriosDoUsuario(userToEvaluate);

    let mins = (typeof dadosGlobais !== 'undefined' ? dadosGlobais.ministries : window.dadosGlobais?.ministries) || [];
    if (!isAdmin) {
        mins = mins.filter(m => userMinistryIds.includes(m.id));
    }

    const options = mins.map(m => `<option value="${m.id}">${m.icon || ''} ${m.name}</option>`).join('');
    
    const selEq = document.getElementById('equipamento-ministerio');
    const selDoc = document.getElementById('doc-ministerio');

    if (selEq) selEq.innerHTML = `<option value="">— Geral da Igreja —</option>${options}`;
    if (selDoc) selDoc.innerHTML = `<option value="">— Geral da Igreja —</option>${options}`;
}

// FORM EQUIPAMENTO EM LINHA
function abrirFormEquipamento(item = null) {
    popularSelectsMinisterioAlmoxarifado();
    const painel = document.getElementById('painel-form-equipamento');
    if (!painel) return;

    document.getElementById('equipamento-id').value = item ? item.id : '';
    document.getElementById('equipamento-nome').value = item ? item.name : '';
    document.getElementById('equipamento-ministerio').value = item ? (item.ministry_id || '') : '';
    document.getElementById('equipamento-status').value = item ? (item.status || 'disponivel') : 'disponivel';
    document.getElementById('equipamento-local').value = item ? (item.location || '') : '';
    
    const { photoUrl, cleanDesc } = item ? extrairFotoEquipamento(item) : { photoUrl: '', cleanDesc: '' };
    document.getElementById('equipamento-desc').value = cleanDesc;
    document.getElementById('equipamento-foto-url').value = photoUrl;

    const previewContainer = document.getElementById('container-foto-equipamento-preview');
    const previewImg = document.getElementById('img-preview-equipamento');
    if (photoUrl && previewContainer && previewImg) {
        previewImg.src = photoUrl;
        previewContainer.classList.remove('hidden');
    } else if (previewContainer) {
        previewContainer.classList.add('hidden');
    }

    document.getElementById('form-equipamento-titulo').textContent = item ? 'Editar Item no Almoxarifado' : 'Cadastrar Item no Almoxarifado';
    painel.classList.remove('hidden');
    painel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
window.abrirFormEquipamento = abrirFormEquipamento;
window.abrirModalEquipamento = abrirFormEquipamento;

function fecharFormEquipamento() {
    const painel = document.getElementById('painel-form-equipamento');
    if (painel) painel.classList.add('hidden');
    removerFotoEquipamento();
}
window.fecharFormEquipamento = fecharFormEquipamento;
window.fecharModalEquipamento = fecharFormEquipamento;

// FOTO DO EQUIPAMENTO (UPLOAD E CÂMERA DIRETA)
async function lidarComUploadFotoEquipamento(files) {
    const file = files && files[0];
    if (!file) return;

    const progresso = document.getElementById('equipamento-foto-progresso');
    const previewContainer = document.getElementById('container-foto-equipamento-preview');
    const previewImg = document.getElementById('img-preview-equipamento');
    const fotoUrlInput = document.getElementById('equipamento-foto-url');

    // Prévia instantânea com Object URL
    if (previewImg && previewContainer) {
        previewImg.src = URL.createObjectURL(file);
        previewContainer.classList.remove('hidden');
    }
    if (progresso) progresso.classList.remove('hidden');

    try {
        let uploadedUrl = null;
        if (typeof window.uploadArquivoSupabase === 'function') {
            uploadedUrl = await window.uploadArquivoSupabase(file, 'media-inbox', 'equipamentos');
        } else if (typeof uploadArquivoSupabase === 'function') {
            uploadedUrl = await uploadArquivoSupabase(file, 'media-inbox', 'equipamentos');
        }

        if (uploadedUrl) {
            if (fotoUrlInput) fotoUrlInput.value = uploadedUrl;
            if (previewImg) previewImg.src = uploadedUrl;
            if (typeof mostrarToast === 'function') mostrarToast('Foto do equipamento anexada com sucesso!', 'sucesso');
        }
    } catch (err) {
        console.error("Erro no envio da foto do equipamento:", err);
        if (typeof mostrarToast === 'function') mostrarToast('Erro ao enviar foto: ' + err.message, 'erro');
    } finally {
        if (progresso) progresso.classList.add('hidden');
    }
}
window.lidarComUploadFotoEquipamento = lidarComUploadFotoEquipamento;

function removerFotoEquipamento() {
    const fotoUrlInput = document.getElementById('equipamento-foto-url');
    const previewContainer = document.getElementById('container-foto-equipamento-preview');
    const previewImg = document.getElementById('img-preview-equipamento');
    const inputCamera = document.getElementById('equipamento-camera-input');
    const inputGaleria = document.getElementById('equipamento-foto-input');

    if (fotoUrlInput) fotoUrlInput.value = '';
    if (previewContainer) previewContainer.classList.add('hidden');
    if (previewImg) previewImg.src = '';
    if (inputCamera) inputCamera.value = '';
    if (inputGaleria) inputGaleria.value = '';
}
window.removerFotoEquipamento = removerFotoEquipamento;

// FORM WIKI / TUTORIAL EM LINHA
function abrirFormWiki(doc = null) {
    popularSelectsMinisterioAlmoxarifado();
    const painel = document.getElementById('painel-form-wiki');
    if (!painel) return;

    document.getElementById('doc-id').value = doc ? doc.id : '';
    document.getElementById('doc-titulo-input').value = doc ? doc.title : '';
    document.getElementById('doc-ministerio').value = doc ? (doc.ministry_id || '') : '';
    document.getElementById('doc-tipo').value = doc ? (doc.doc_type || 'video_link') : 'video_link';
    document.getElementById('doc-url').value = doc ? (doc.content_url || '') : '';
    document.getElementById('doc-desc').value = doc ? (doc.description || '') : '';

    const previewContainer = document.getElementById('container-midia-wiki-preview');
    const videoPreview = document.getElementById('video-preview-wiki');
    const fileBadge = document.getElementById('file-preview-wiki-badge');
    const fileNameEl = document.getElementById('file-preview-wiki-name');

    if (doc && doc.content_url) {
        if (previewContainer) previewContainer.classList.remove('hidden');
        if (doc.content_url.match(/\.(mp4|webm|ogg)(?:\?.*)?$/i) && videoPreview) {
            videoPreview.src = doc.content_url;
            videoPreview.classList.remove('hidden');
        }
        if (fileNameEl) fileNameEl.textContent = 'Mídia anexada';
    } else {
        if (previewContainer) previewContainer.classList.add('hidden');
        if (videoPreview) videoPreview.classList.add('hidden');
    }

    document.getElementById('form-doc-titulo').textContent = doc ? 'Editar Tutorial ou Manual' : 'Cadastrar Tutorial ou Manual';
    painel.classList.remove('hidden');
    painel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
window.abrirFormWiki = abrirFormWiki;
window.abrirModalDocWiki = abrirFormWiki;

function fecharFormWiki() {
    const painel = document.getElementById('painel-form-wiki');
    if (painel) painel.classList.add('hidden');
    removerMidiaWiki();
}
window.fecharFormWiki = fecharFormWiki;
window.fecharModalDocWiki = fecharFormWiki;

// MÍDIA DA WIKI (GRAVAÇÃO DE VÍDEO E ARQUIVOS)
async function lidarComUploadMidiaWiki(files) {
    const file = files && files[0];
    if (!file) return;

    const progresso = document.getElementById('doc-upload-progresso');
    const previewContainer = document.getElementById('container-midia-wiki-preview');
    const videoPreview = document.getElementById('video-preview-wiki');
    const fileBadge = document.getElementById('file-preview-wiki-badge');
    const fileNameEl = document.getElementById('file-preview-wiki-name');
    const urlInput = document.getElementById('doc-url');
    const tipoInput = document.getElementById('doc-tipo');

    if (previewContainer) previewContainer.classList.remove('hidden');
    if (fileNameEl) fileNameEl.textContent = file.name;

    if (file.type?.startsWith('video/') && videoPreview) {
        videoPreview.src = URL.createObjectURL(file);
        videoPreview.classList.remove('hidden');
        if (tipoInput) tipoInput.value = 'video_link';
    } else if (videoPreview) {
        videoPreview.classList.add('hidden');
        if (tipoInput) tipoInput.value = file.type?.includes('pdf') ? 'manual_pdf' : 'wiki_texto';
    }

    if (progresso) progresso.classList.remove('hidden');

    try {
        let uploadedUrl = null;
        if (typeof window.uploadArquivoSupabase === 'function') {
            uploadedUrl = await window.uploadArquivoSupabase(file, 'media-inbox', 'tutoriais');
        } else if (typeof uploadArquivoSupabase === 'function') {
            uploadedUrl = await uploadArquivoSupabase(file, 'media-inbox', 'tutoriais');
        }

        if (uploadedUrl) {
            if (urlInput) urlInput.value = uploadedUrl;
            if (file.type?.startsWith('video/') && videoPreview) videoPreview.src = uploadedUrl;
            if (typeof mostrarToast === 'function') mostrarToast(`Mídia "${file.name}" anexada com sucesso!`, 'sucesso');
        }
    } catch (err) {
        console.error("Erro no envio de mídia do tutorial:", err);
        if (typeof mostrarToast === 'function') mostrarToast('Erro ao enviar mídia: ' + err.message, 'erro');
    } finally {
        if (progresso) progresso.classList.add('hidden');
    }
}
window.lidarComUploadMidiaWiki = lidarComUploadMidiaWiki;

function removerMidiaWiki() {
    const urlInput = document.getElementById('doc-url');
    const previewContainer = document.getElementById('container-midia-wiki-preview');
    const videoPreview = document.getElementById('video-preview-wiki');
    const inputCamera = document.getElementById('doc-camera-video-input');
    const inputArquivo = document.getElementById('doc-arquivo-input');

    if (urlInput) urlInput.value = '';
    if (previewContainer) previewContainer.classList.add('hidden');
    if (videoPreview) {
        videoPreview.src = '';
        videoPreview.classList.add('hidden');
    }
    if (inputCamera) inputCamera.value = '';
    if (inputArquivo) inputArquivo.value = '';
}
window.removerMidiaWiki = removerMidiaWiki;

function alternarCampoLinkExternoWiki() {
    const div = document.getElementById('div-doc-link-externo');
    if (div) div.classList.toggle('hidden');
}
window.alternarCampoLinkExternoWiki = alternarCampoLinkExternoWiki;

function atualizarLinkExternoWiki(val) {
    const urlInput = document.getElementById('doc-url');
    if (urlInput) urlInput.value = val.trim();
}
window.atualizarLinkExternoWiki = atualizarLinkExternoWiki;

// ===================== OPERAÇÕES DE SALVAR / EXCLUIR =====================

async function salvarEquipamento(e) {
    e.preventDefault();
    if (!supabaseClient) return;

    const id = document.getElementById('equipamento-id').value;
    const name = document.getElementById('equipamento-nome').value.trim();
    const ministry_id = document.getElementById('equipamento-ministerio').value || null;
    const status = document.getElementById('equipamento-status').value;
    const location = document.getElementById('equipamento-local').value.trim();
    let description = document.getElementById('equipamento-desc').value.trim();
    const photoUrl = document.getElementById('equipamento-foto-url').value.trim();

    const userToEvaluate = modoSimulacaoPerfil || usuarioLogado;
    const church_id = userToEvaluate?.church_id || window.dadosGlobais?.church?.id || null;

    // Tentativa primária: salvar com photo_url como coluna nativa
    const payload = { name, ministry_id, status, location, description };
    if (church_id) payload.church_id = church_id;
    if (photoUrl) payload.photo_url = photoUrl;

    try {
        let opError = null;
        if (id) {
            const { error } = await supabaseClient.from('ministry_assets').update(payload).eq('id', id);
            opError = error;
        } else {
            const { error } = await supabaseClient.from('ministry_assets').insert([payload]);
            opError = error;
        }

        // Se deu erro de coluna photo_url inexistente, faz fallback inteligente salvando na description
        if (opError && opError.message?.toLowerCase().includes('photo_url')) {
            console.warn("Coluna photo_url não existe na tabela. Salvando foto na description como fallback...");
            const descComFoto = photoUrl ? `<!--PHOTO:${photoUrl}-->\n${description}` : description;
            delete payload.photo_url;
            payload.description = descComFoto;

            if (id) {
                await supabaseClient.from('ministry_assets').update(payload).eq('id', id);
            } else {
                await supabaseClient.from('ministry_assets').insert([payload]);
            }
        } else if (opError) {
            throw opError;
        }

        fecharFormEquipamento();
        await carregarAlmoxarifado();
        if (typeof mostrarToast === 'function') mostrarToast('Equipamento salvo com sucesso!', 'sucesso');
    } catch (err) {
        console.error('Erro ao salvar equipamento:', err);
        if (typeof mostrarToast === 'function') mostrarToast('Erro ao salvar equipamento: ' + err.message, 'erro');
    }
}
window.salvarEquipamento = salvarEquipamento;

async function salvarDocWiki(e) {
    e.preventDefault();
    if (!supabaseClient) return;

    const id = document.getElementById('doc-id').value;
    const title = document.getElementById('doc-titulo-input').value.trim();
    const ministry_id = document.getElementById('doc-ministerio').value || null;
    const doc_type = document.getElementById('doc-tipo').value || 'video_link';
    const content_url = document.getElementById('doc-url').value.trim();
    const description = document.getElementById('doc-desc').value.trim();

    const userToEvaluate = modoSimulacaoPerfil || usuarioLogado;
    const church_id = userToEvaluate?.church_id || window.dadosGlobais?.church?.id || null;

    const payload = { title, ministry_id, doc_type, content_url, description };
    if (church_id) payload.church_id = church_id;

    try {
        if (id) {
            const { error } = await supabaseClient.from('ministry_docs').update(payload).eq('id', id);
            if (error) throw error;
        } else {
            const { error } = await supabaseClient.from('ministry_docs').insert([payload]);
            if (error) throw error;
        }
        fecharFormWiki();
        await carregarAlmoxarifado();
        if (typeof mostrarToast === 'function') mostrarToast('Tutorial salvo com sucesso!', 'sucesso');
    } catch (err) {
        console.error('Erro ao salvar documento:', err);
        if (typeof mostrarToast === 'function') mostrarToast('Erro ao salvar tutorial: ' + err.message, 'erro');
    }
}
window.salvarDocWiki = salvarDocWiki;

function editarEquipamento(id) {
    const item = almoxarifadoAssets.find(a => a.id === id);
    if (item) abrirFormEquipamento(item);
}
window.editarEquipamento = editarEquipamento;

function editarDocWiki(id) {
    const doc = almoxarifadoDocs.find(d => d.id === id);
    if (doc) abrirFormWiki(doc);
}
window.editarDocWiki = editarDocWiki;

async function deletarEquipamento(id) {
    if (!confirm('Deseja realmente excluir este item do almoxarifado?')) return;
    try {
        await supabaseClient.from('ministry_assets').delete().eq('id', id);
        await carregarAlmoxarifado();
        if (typeof mostrarToast === 'function') mostrarToast('Item excluído com sucesso.', 'sucesso');
    } catch (err) {
        console.error('Erro ao excluir equipamento:', err);
    }
}
window.deletarEquipamento = deletarEquipamento;

async function deletarDocWiki(id) {
    if (!confirm('Deseja realmente excluir este manual/wiki?')) return;
    try {
        await supabaseClient.from('ministry_docs').delete().eq('id', id);
        await carregarAlmoxarifado();
        if (typeof mostrarToast === 'function') mostrarToast('Tutorial excluído com sucesso.', 'sucesso');
    } catch (err) {
        console.error('Erro ao excluir documento:', err);
    }
}
window.deletarDocWiki = deletarDocWiki;

function mudarAbaAlmoxarifado(aba) {
    abaAlmoxarifadoAtiva = aba;
    const isEquip = aba === 'equipamentos';
    
    document.getElementById('subsecao-almox-equipamentos')?.classList.toggle('hidden', !isEquip);
    document.getElementById('subsecao-almox-wiki')?.classList.toggle('hidden', isEquip);

    const tabEquip = document.getElementById('tab-almox-equipamentos');
    const tabWiki = document.getElementById('tab-almox-wiki');

    if (tabEquip && tabWiki) {
        tabEquip.className = isEquip 
            ? "flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm border border-slate-200 dark:border-slate-700" 
            : "flex-1 py-2 px-3 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-2 cursor-pointer text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-transparent";

        tabWiki.className = !isEquip 
            ? "flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm border border-slate-200 dark:border-slate-700" 
            : "flex-1 py-2 px-3 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-2 cursor-pointer text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-transparent";
    }
}
window.mudarAbaAlmoxarifado = mudarAbaAlmoxarifado;

function usuarioPodeEditarAlmoxarifado() {
    const user = modoSimulacaoPerfil || usuarioLogado;
    if (!user) return false;
    if (user.system_role === 'admin' || user.role === 'admin') return true;
    if (user.system_role === 'lider' || user.role === 'lider') return true;
    return false;
}

function atualizarBotoesPermissaoAlmoxarifado() {
    const podeEditar = usuarioPodeEditarAlmoxarifado();
    const btnNovoEq = document.getElementById('btn-novo-equipamento');
    const btnNovoDoc = document.getElementById('btn-novo-doc');
    if (btnNovoEq) {
        btnNovoEq.classList.toggle('hidden', !podeEditar);
        if (podeEditar) btnNovoEq.classList.add('flex');
    }
    if (btnNovoDoc) {
        btnNovoDoc.classList.toggle('hidden', !podeEditar);
        if (podeEditar) btnNovoDoc.classList.add('flex');
    }
}

window.carregarAlmoxarifado = carregarAlmoxarifado;
window.renderizarAlmoxarifado = renderizarAlmoxarifado;
