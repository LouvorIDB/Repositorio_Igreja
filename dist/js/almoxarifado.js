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

function renderizarAlmoxarifado() {
    renderizarEquipamentos();
    renderizarDocsWiki();
}

function renderizarEquipamentos() {
    const container = document.getElementById('grid-equipamentos');
    if (!container) return;

    if (!almoxarifadoAssets || almoxarifadoAssets.length === 0) {
        container.innerHTML = `
            <div class="col-span-full py-12 text-center bg-slate-900/40 border border-slate-800 rounded-2xl">
                <p class="text-slate-400 text-sm font-medium">Nenhum equipamento ou patrimônio cadastrado.</p>
                <p class="text-slate-500 text-xs mt-1">Líderes podem adicionar microfones, cabos, mesas de som e instrumentos.</p>
            </div>
        `;
        return;
    }

    const statusBadges = {
        disponivel: { label: 'Disponível', bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
        em_uso: { label: 'Em Uso', bg: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
        manutencao: { label: 'Na Manutenção', bg: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
        quebrado: { label: 'Defeito / Quebrado', bg: 'bg-red-500/10 text-red-400 border-red-500/20' }
    };

    const podeEditar = usuarioPodeEditarAlmoxarifado();

    container.innerHTML = almoxarifadoAssets.map(item => {
        const badge = statusBadges[item.status] || statusBadges.disponivel;
        const minNome = item.ministries ? item.ministries.name : 'Geral';
        const minIcon = item.ministries?.icon || '📦';

        return `
            <div class="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between space-y-3">
                <div>
                    <div class="flex items-start justify-between gap-2 mb-2">
                        <span class="text-xs font-semibold px-2 py-0.5 rounded-full border ${badge.bg}">
                            ${badge.label}
                        </span>
                        <span class="text-xs text-slate-400 flex items-center gap-1">
                            <span>${minIcon}</span> ${minNome}
                        </span>
                    </div>

                    <h4 class="text-base font-bold text-white">${item.name}</h4>
                    ${item.location ? `<p class="text-xs text-brand-400 font-medium mt-0.5">📍 ${item.location}</p>` : ''}
                    ${item.description ? `<p class="text-xs text-slate-400 mt-2 line-clamp-3">${item.description}</p>` : ''}
                </div>

                ${podeEditar ? `
                <div class="flex justify-end gap-2 pt-2 border-t border-slate-800/80">
                    <button onclick="editarEquipamento('${item.id}')" class="px-2.5 py-1 text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-md transition">Editar</button>
                    <button onclick="deletarEquipamento('${item.id}')" class="px-2.5 py-1 text-xs text-red-400 hover:text-red-300 bg-red-950/40 hover:bg-red-900/60 rounded-md transition">Excluir</button>
                </div>
                ` : ''}
            </div>
        `;
    }).join('');
}

function renderizarDocsWiki() {
    const container = document.getElementById('grid-docs-wiki');
    if (!container) return;

    if (!almoxarifadoDocs || almoxarifadoDocs.length === 0) {
        container.innerHTML = `
            <div class="col-span-full py-12 text-center bg-slate-900/40 border border-slate-800 rounded-2xl">
                <p class="text-slate-400 text-sm font-medium">Nenhum tutorial ou manual cadastrado na Wiki.</p>
                <p class="text-slate-500 text-xs mt-1">Líderes podem cadastrar instruções de como ligar a mesa, senhas do roteador, PDFs e vídeos.</p>
            </div>
        `;
        return;
    }

    const podeEditar = usuarioPodeEditarAlmoxarifado();

    container.innerHTML = almoxarifadoDocs.map(doc => {
        const minNome = doc.ministries ? doc.ministries.name : 'Geral';
        
        let linksHtml = '';
        let videosHtml = '';
        
        if (doc.content_url) {
            const urls = doc.content_url.split(',').map(u => u.trim()).filter(u => u);
            
            urls.forEach((url, idx) => {
                const isVideo = url.match(/\.(mp4|webm|ogg)(?:\?.*)?$/i);
                const isImage = url.match(/\.(jpeg|jpg|gif|png|webp)(?:\?.*)?$/i);
                const ytMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?]+)/);
                
                let linkLabel = `Link ${urls.length > 1 ? idx+1 : ''}`;
                
                if (ytMatch || isVideo) {
                    linkLabel = `🎬 Vídeo ${urls.length > 1 ? idx+1 : ''}`;
                    if (ytMatch && ytMatch[1]) {
                        videosHtml += `<div class="mt-3 aspect-video rounded-lg overflow-hidden border border-slate-800">
                                         <iframe class="w-full h-full" src="https://www.youtube.com/embed/${ytMatch[1]}" title="Video tutorial" frameborder="0" allowfullscreen></iframe>
                                       </div>`;
                    } else {
                        videosHtml += `<div class="mt-3 aspect-video rounded-lg overflow-hidden border border-slate-800 bg-black">
                                         <video class="w-full h-full" controls preload="metadata">
                                             <source src="${url}" type="video/mp4">
                                         </video>
                                       </div>`;
                    }
                } else if (isImage) {
                    linkLabel = `🖼️ Imagem ${urls.length > 1 ? idx+1 : ''}`;
                    videosHtml += `<div class="mt-3 rounded-lg overflow-hidden border border-slate-800 bg-black flex justify-center">
                                     <img src="${url}" class="max-h-96 w-auto object-contain" alt="Guia anexo ${idx+1}">
                                   </div>`;
                } else {
                    linkLabel = `📄 Arquivo ${urls.length > 1 ? idx+1 : ''}`;
                }
                
                linksHtml += `<a href="${url}" target="_blank" class="text-xs text-brand-400 hover:underline flex items-center gap-1 font-medium">${linkLabel} ↗</a>`;
            });
        }

        return `
            <div class="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between space-y-3">
                <div>
                    <div class="flex items-start justify-between gap-2 mb-2">
                        <span class="text-xs text-slate-400 font-medium whitespace-nowrap">📁 ${minNome}</span>
                        <div class="flex flex-col items-end gap-1">
                            ${linksHtml}
                        </div>
                    </div>

                    <h4 class="text-base font-bold text-white">${doc.title}</h4>
                    ${doc.description ? `<p class="text-xs text-slate-300 mt-2 whitespace-pre-line leading-relaxed">${doc.description}</p>` : ''}
                    
                    ${videosHtml}
                </div>

                ${podeEditar ? `
                <div class="flex justify-end gap-2 pt-2 border-t border-slate-800/80 mt-2">
                    <button onclick="editarDocWiki('${doc.id}')" class="px-2.5 py-1 text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-md transition">Editar</button>
                    <button onclick="deletarDocWiki('${doc.id}')" class="px-2.5 py-1 text-xs text-red-400 hover:text-red-300 bg-red-950/40 hover:bg-red-900/60 rounded-md transition">Excluir</button>
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
            ? "pb-3 text-sm font-semibold text-brand-400 border-b-2 border-brand-500 transition" 
            : "pb-3 text-sm font-semibold text-slate-400 hover:text-slate-200 border-b-2 border-transparent transition";

        tabWiki.className = !isEquip 
            ? "pb-3 text-sm font-semibold text-brand-400 border-b-2 border-brand-500 transition" 
            : "pb-3 text-sm font-semibold text-slate-400 hover:text-slate-200 border-b-2 border-transparent transition";
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
    document.getElementById('btn-novo-equipamento')?.classList.toggle('hidden', !podeEditar);
    document.getElementById('btn-novo-doc')?.classList.toggle('hidden', !podeEditar);
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
