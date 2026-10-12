/**
 * almoxarifado.js - Gestão do Almoxarifado Virtual e Base de Conhecimento (Wiki)
 */

let almoxarifadoAssets = [];
let almoxarifadoDocs = [];
let abaAlmoxarifadoAtiva = 'equipamentos';

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

        // Bloqueio Silencioso: se não for admin e não tiver nenhum ministério vinculado, limpa a tela em branco sem nenhuma mensagem
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
            <div class="col-span-full py-16 text-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-night-900/40 space-y-2">
                <span class="text-3xl block">📦</span>
                <p class="text-sm font-bold text-slate-700 dark:text-slate-300">Nenhum equipamento encontrado</p>
                <p class="text-xs text-slate-500 dark:text-slate-400">Tente ajustar o termo de busca ou altere o filtro de status acima.</p>
            </div>
        `;
        return;
    }

    const statusBadges = {
        disponivel: { label: 'Disponível / OK', bg: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30' },
        em_uso: { label: 'Em Uso', bg: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30' },
        manutencao: { label: 'Na Manutenção', bg: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30' },
        quebrado: { label: 'Com Defeito', bg: 'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30' }
    };

    const podeEditar = usuarioPodeEditarAlmoxarifado();

    container.innerHTML = items.map(item => {
        const badge = statusBadges[item.status] || statusBadges.disponivel;
        const minNome = item.ministries ? item.ministries.name : 'Geral';
        const minIcon = item.ministries?.icon || '🏢';

        return `
            <div class="bg-white dark:bg-night-900/90 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-4.5 flex flex-col justify-between space-y-3 shadow-sm hover:border-brand-500/60 dark:hover:border-brand-500/60 transition duration-200 group">
                <div class="space-y-2">
                    <div class="flex items-center justify-between gap-2 flex-wrap">
                        <span class="text-[10px] font-bold px-2 py-0.5 rounded-full border ${badge.bg}">
                            ${badge.label}
                        </span>
                        <span class="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                            <span>${minIcon}</span> <span>${minNome}</span>
                        </span>
                    </div>

                    <h4 class="text-sm sm:text-base font-bold text-slate-900 dark:text-white">${item.name}</h4>
                    ${item.location ? `
                        <p class="text-xs text-brand-600 dark:text-brand-400 font-semibold flex items-center gap-1">
                            <span>📍</span> <span>${item.location}</span>
                        </p>
                    ` : ''}
                    ${item.description ? `
                        <p class="text-xs text-slate-600 dark:text-slate-400 line-clamp-3 leading-relaxed pt-1 border-t border-slate-100 dark:border-slate-800/80">${item.description}</p>
                    ` : ''}
                </div>

                ${podeEditar ? `
                <div class="flex items-center justify-end gap-2 pt-2.5 border-t border-slate-100 dark:border-slate-800/80">
                    <button type="button" onclick="editarEquipamento('${item.id}')" class="px-2.5 py-1 text-xs text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition font-semibold cursor-pointer">Editar</button>
                    <button type="button" onclick="deletarEquipamento('${item.id}')" class="px-2.5 py-1 text-xs text-red-600 dark:text-red-400 hover:text-red-700 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition font-semibold cursor-pointer">Excluir</button>
                </div>
                ` : ''}
            </div>
        `;
    }).join('');
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
            <div class="col-span-full py-16 text-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-night-900/40 space-y-2">
                <span class="text-3xl block">📚</span>
                <p class="text-sm font-bold text-slate-700 dark:text-slate-300">Nenhum tutorial ou manual encontrado</p>
                <p class="text-xs text-slate-500 dark:text-slate-400">Líderes podem cadastrar checklists, senhas e instruções técnicas.</p>
            </div>
        `;
        return;
    }

    const podeEditar = usuarioPodeEditarAlmoxarifado();

    container.innerHTML = docs.map(doc => {
        const minNome = doc.ministries ? doc.ministries.name : 'Geral';
        const minIcon = doc.ministries?.icon || '🏢';
        
        let linksHtml = '';
        let videosHtml = '';
        
        if (doc.content_url) {
            const urls = doc.content_url.split(',').map(u => u.trim()).filter(Boolean);
            
            urls.forEach((url, idx) => {
                const isVideo = url.match(/\.(mp4|webm|ogg)(?:\?.*)?$/i);
                const isImage = url.match(/\.(jpeg|jpg|gif|png|webp)(?:\?.*)?$/i);
                const ytMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?]+)/);
                
                let linkLabel = `Link ${urls.length > 1 ? idx+1 : ''}`;
                
                if (ytMatch || isVideo) {
                    linkLabel = `🎬 Vídeo ${urls.length > 1 ? idx+1 : ''}`;
                    if (ytMatch && ytMatch[1]) {
                        videosHtml += `
                            <div class="mt-3 aspect-video rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-inner bg-black">
                                <iframe class="w-full h-full" src="https://www.youtube.com/embed/${ytMatch[1]}" title="Video tutorial" frameborder="0" allowfullscreen></iframe>
                            </div>
                        `;
                    } else {
                        videosHtml += `
                            <div class="mt-3 aspect-video rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-black shadow-inner">
                                <video class="w-full h-full" controls preload="metadata">
                                    <source src="${url}" type="video/mp4">
                                </video>
                            </div>
                        `;
                    }
                } else if (isImage) {
                    linkLabel = `🖼️ Imagem ${urls.length > 1 ? idx+1 : ''}`;
                    videosHtml += `
                        <div class="mt-3 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-black flex justify-center">
                            <img src="${url}" class="max-h-72 w-auto object-contain" alt="Guia anexo ${idx+1}">
                        </div>
                    `;
                } else {
                    linkLabel = `📄 Manual / PDF ${urls.length > 1 ? idx+1 : ''}`;
                }
                
                linksHtml += `
                    <a href="${url}" target="_blank" class="text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1">
                        <span>${linkLabel}</span> <span>↗</span>
                    </a>
                `;
            });
        }

        return `
            <div class="bg-white dark:bg-night-900/90 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col justify-between space-y-3 shadow-sm hover:border-brand-500/60 dark:hover:border-brand-500/60 transition duration-200">
                <div class="space-y-2.5">
                    <div class="flex items-start justify-between gap-2">
                        <span class="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                            <span>${minIcon}</span> <span>${minNome}</span>
                        </span>
                        <div class="flex flex-wrap items-center gap-2">
                            ${linksHtml}
                        </div>
                    </div>

                    <h4 class="text-base font-bold text-slate-900 dark:text-white">${doc.title}</h4>
                    ${doc.description ? `
                        <div class="p-3 rounded-xl bg-slate-50 dark:bg-night-950/70 border border-slate-200 dark:border-slate-800/80">
                            <p class="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-line leading-relaxed font-sans">${doc.description}</p>
                        </div>
                    ` : ''}
                    
                    ${videosHtml}
                </div>

                ${podeEditar ? `
                <div class="flex items-center justify-end gap-2 pt-2.5 border-t border-slate-100 dark:border-slate-800/80">
                    <button type="button" onclick="editarDocWiki('${doc.id}')" class="px-2.5 py-1 text-xs text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition font-semibold cursor-pointer">Editar</button>
                    <button type="button" onclick="deletarDocWiki('${doc.id}')" class="px-2.5 py-1 text-xs text-red-600 dark:text-red-400 hover:text-red-700 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition font-semibold cursor-pointer">Excluir</button>
                </div>
                ` : ''}
            </div>
        `;
    }).join('');
}

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

function popularSelectsMinisterioAlmoxarifado() {
    const userToEvaluate = modoSimulacaoPerfil || usuarioLogado;
    const isAdmin = userToEvaluate?.system_role === 'admin' || userToEvaluate?.role === 'admin';
    const userMinistryIds = obterIdsMinisteriosDoUsuario(userToEvaluate);

    let mins = dadosGlobais.ministries || [];
    if (!isAdmin) {
        mins = mins.filter(m => userMinistryIds.includes(m.id));
    }

    const options = mins.map(m => `<option value="${m.id}">${m.icon || ''} ${m.name}</option>`).join('');
    
    const selEq = document.getElementById('equipamento-ministerio');
    const selDoc = document.getElementById('doc-ministerio');

    if (selEq) selEq.innerHTML = `<option value="">— Geral / Todos —</option>${options}`;
    if (selDoc) selDoc.innerHTML = `<option value="">— Geral / Todos —</option>${options}`;
}

function abrirModalEquipamento(item = null) {
    popularSelectsMinisterioAlmoxarifado();
    document.getElementById('equipamento-id').value = item ? item.id : '';
    document.getElementById('equipamento-nome').value = item ? item.name : '';
    document.getElementById('equipamento-ministerio').value = item ? (item.ministry_id || '') : '';
    document.getElementById('equipamento-status').value = item ? (item.status || 'disponivel') : 'disponivel';
    document.getElementById('equipamento-local').value = item ? (item.location || '') : '';
    document.getElementById('equipamento-desc').value = item ? (item.description || '') : '';

    document.getElementById('modal-equipamento-titulo').textContent = item ? 'Editar Item no Almoxarifado' : 'Cadastrar Item no Almoxarifado';
    document.getElementById('modal-equipamento')?.classList.remove('hidden');
}

function fecharModalEquipamento() {
    document.getElementById('modal-equipamento')?.classList.add('hidden');
}

function abrirModalDocWiki(doc = null) {
    popularSelectsMinisterioAlmoxarifado();
    document.getElementById('doc-id').value = doc ? doc.id : '';
    document.getElementById('doc-titulo-input').value = doc ? doc.title : '';
    document.getElementById('doc-ministerio').value = doc ? (doc.ministry_id || '') : '';
    document.getElementById('doc-tipo').value = doc ? (doc.doc_type || 'wiki_texto') : 'wiki_texto';
    document.getElementById('doc-url').value = doc ? (doc.content_url || '') : '';
    document.getElementById('doc-desc').value = doc ? (doc.description || '') : '';

    document.getElementById('modal-doc-titulo').textContent = doc ? 'Editar Tutorial ou Manual' : 'Cadastrar Tutorial ou Manual';
    document.getElementById('modal-doc-wiki')?.classList.remove('hidden');
    
    verificarTipoDocWiki();
}

function verificarTipoDocWiki() {
    const tipo = document.getElementById('doc-tipo').value;
    const divSelect = document.getElementById('div-doc-media-select');
    
    // Mostra a seleção de mídias para vídeos ou PDFs (exclui o wiki_texto que não usa URL)
    if (tipo === 'video_link' || tipo === 'manual_pdf') {
        if (divSelect) divSelect.classList.remove('hidden');
        carregarVideosParaWiki();
    } else {
        if (divSelect) divSelect.classList.add('hidden');
    }
}

async function carregarVideosParaWiki() {
    const select = document.getElementById('doc-media-select');
    if (!select || !supabaseClient) return;
    
    // Evita recarregar se já tiver options além da primeira
    if (select.options.length > 1) return;
    
    const churchId = (typeof window.dadosGlobais !== 'undefined' && window.dadosGlobais.church?.id)
        || (typeof usuarioLogado !== 'undefined' && usuarioLogado?.church_id);
        
    try {
        let query = supabaseClient.from('church_media').select('file_name, file_url, mime_type').order('created_at', { ascending: false });
        if (churchId) query = query.eq('church_id', churchId);
        
        const { data, error } = await query;
        if (error) throw error;
        
        if (data.length === 0) {
            select.innerHTML = '<option value="">Nenhum arquivo encontrado no seu Banco de Mídias</option>';
            return;
        }
        
        select.innerHTML = '<option value="">Selecione um arquivo da sua nuvem...</option>' + 
            data.map(m => {
                let icon = '📁';
                if (m.mime_type && m.mime_type.startsWith('video/')) icon = '🎬';
                else if (m.mime_type && m.mime_type.startsWith('image/')) icon = '🖼️';
                else if (m.mime_type && m.mime_type.includes('pdf')) icon = '📄';
                return `<option value="${m.file_url}">${icon} ${m.file_name}</option>`;
            }).join('');
            
    } catch (e) {
        console.error("Erro ao buscar mídias para a wiki:", e);
        select.innerHTML = '<option value="">Erro ao buscar arquivos</option>';
    }
}

function selecionarMidiaWiki() {
    const select = document.getElementById('doc-media-select');
    const inputUrl = document.getElementById('doc-url');
    if (select && inputUrl) {
        const valoresSelecionados = Array.from(select.selectedOptions)
                                         .map(opt => opt.value)
                                         .filter(val => val !== "");
        if (valoresSelecionados.length > 0) {
            inputUrl.value = valoresSelecionados.join(', ');
        }
    }
}

function fecharModalDocWiki() {
    document.getElementById('modal-doc-wiki')?.classList.add('hidden');
}

async function salvarEquipamento(e) {
    e.preventDefault();
    if (!supabaseClient) return;

    const id = document.getElementById('equipamento-id').value;
    const name = document.getElementById('equipamento-nome').value.trim();
    const ministry_id = document.getElementById('equipamento-ministerio').value || null;
    const status = document.getElementById('equipamento-status').value;
    const location = document.getElementById('equipamento-local').value.trim();
    const description = document.getElementById('equipamento-desc').value.trim();

    const userToEvaluate = modoSimulacaoPerfil || usuarioLogado;
    const church_id = userToEvaluate?.church_id || window.dadosGlobais?.church?.id || null;

    const payload = { name, ministry_id, status, location, description };
    if (church_id) payload.church_id = church_id;

    try {
        if (id) {
            await supabaseClient.from('ministry_assets').update(payload).eq('id', id);
        } else {
            await supabaseClient.from('ministry_assets').insert([payload]);
        }
        fecharModalEquipamento();
        await carregarAlmoxarifado();
        mostrarToast('Equipamento salvo com sucesso!', 'sucesso');
    } catch (err) {
        console.error('Erro ao salvar equipamento:', err);
        mostrarToast('Erro ao salvar equipamento.', 'erro');
    }
}

async function salvarDocWiki(e) {
    e.preventDefault();
    if (!supabaseClient) return;

    const id = document.getElementById('doc-id').value;
    const title = document.getElementById('doc-titulo-input').value.trim();
    const ministry_id = document.getElementById('doc-ministerio').value || null;
    const doc_type = document.getElementById('doc-tipo').value;
    const content_url = document.getElementById('doc-url').value.trim();
    const description = document.getElementById('doc-desc').value.trim();

    const userToEvaluate = modoSimulacaoPerfil || usuarioLogado;
    const church_id = userToEvaluate?.church_id || window.dadosGlobais?.church?.id || null;

    const payload = { title, ministry_id, doc_type, content_url, description };
    if (church_id) payload.church_id = church_id;

    try {
        if (id) {
            await supabaseClient.from('ministry_docs').update(payload).eq('id', id);
        } else {
            await supabaseClient.from('ministry_docs').insert([payload]);
        }
        fecharModalDocWiki();
        await carregarAlmoxarifado();
        mostrarToast('Documento salvo com sucesso!', 'sucesso');
    } catch (err) {
        console.error('Erro ao salvar documento:', err);
        mostrarToast('Erro ao salvar documento.', 'erro');
    }
}

function editarEquipamento(id) {
    const item = almoxarifadoAssets.find(a => a.id === id);
    if (item) abrirModalEquipamento(item);
}

function editarDocWiki(id) {
    const doc = almoxarifadoDocs.find(d => d.id === id);
    if (doc) abrirModalDocWiki(doc);
}

async function deletarEquipamento(id) {
    if (!confirm('Deseja realmente excluir este item do almoxarifado?')) return;
    try {
        await supabaseClient.from('ministry_assets').delete().eq('id', id);
        await carregarAlmoxarifado();
        mostrarToast('Item excluído.', 'sucesso');
    } catch (err) {
        console.error('Erro ao excluir equipamento:', err);
    }
}

async function deletarDocWiki(id) {
    if (!confirm('Deseja realmente excluir este manual/wiki?')) return;
    try {
        await supabaseClient.from('ministry_docs').delete().eq('id', id);
        await carregarAlmoxarifado();
        mostrarToast('Documento excluído.', 'sucesso');
    } catch (err) {
        console.error('Erro ao excluir documento:', err);
    }
}

window.carregarAlmoxarifado = carregarAlmoxarifado;
window.mudarAbaAlmoxarifado = mudarAbaAlmoxarifado;
window.filtrarEquipamentosPorBusca = filtrarEquipamentosPorBusca;
window.limparBuscaEquipamentos = limparBuscaEquipamentos;
window.selecionarFiltroStatusEquipamento = selecionarFiltroStatusEquipamento;
window.filtrarWikiPorBusca = filtrarWikiPorBusca;
window.limparBuscaWiki = limparBuscaWiki;
window.abrirModalEquipamento = abrirModalEquipamento;
window.fecharModalEquipamento = fecharModalEquipamento;
window.abrirModalDocWiki = abrirModalDocWiki;
window.fecharModalDocWiki = fecharModalDocWiki;
window.salvarEquipamento = salvarEquipamento;
window.salvarDocWiki = salvarDocWiki;
window.editarEquipamento = editarEquipamento;
window.editarDocWiki = editarDocWiki;
window.deletarEquipamento = deletarEquipamento;
window.deletarDocWiki = deletarDocWiki;
