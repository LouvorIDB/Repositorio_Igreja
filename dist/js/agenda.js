/**
 * agenda.js - Módulo de Agenda, Eventos e Calendário do LouvorIDB
 */

let mesAtualAgenda = new Date().getMonth();
let anoAtualAgenda = new Date().getFullYear();
let eventosMemoria = [];

function obterChurchIdAtual() {
    return window.dadosGlobais?.church?.id 
        || (typeof modoSimulacaoPerfil !== 'undefined' && modoSimulacaoPerfil?.church_id) 
        || (typeof usuarioLogado !== 'undefined' && usuarioLogado?.church_id) 
        || 'ae125cfd-96ef-4324-b1f0-f96a4f34eecf';
}

/**
 * Retorna os eventos carregados (memória local + sincronização)
 */
function obterEventosIgreja() {
    const churchId = obterChurchIdAtual();
    
    // Tenta carregar do localStorage por igreja
    const salvos = localStorage.getItem(`louvoridb_events_${churchId}`);
    if (salvos) {
        try {
            eventosMemoria = JSON.parse(salvos);
        } catch(e) {
            eventosMemoria = [];
        }
    } else if (eventosMemoria.length === 0) {
        // Eventos de demonstração iniciais se estiver vazio
        eventosMemoria = [
            {
                id: 'evt-1',
                church_id: churchId,
                title: '🎉 Aniversário da Igreja',
                date: `${anoAtualAgenda}-${String(mesAtualAgenda + 1).padStart(2, '0')}-22`,
                time: '20:00',
                location: 'Templo Principal',
                description: 'Culto especial em celebração ao aniversário da nossa igreja.'
            },
            {
                id: 'evt-2',
                church_id: churchId,
                title: '🔥 Culto de Jovens',
                date: `${anoAtualAgenda}-${String(mesAtualAgenda + 1).padStart(2, '0')}-15`,
                time: '19:00',
                location: 'Salão Jovem',
                description: 'Noite de louvor, palavra e comunhão para toda a juventude.'
            }
        ];
        salvarEventosMemoria(churchId);
    }
    return eventosMemoria;
}

function salvarEventosMemoria(churchIdParam) {
    const churchId = churchIdParam || obterChurchIdAtual();
    localStorage.setItem(`louvoridb_events_${churchId}`, JSON.stringify(eventosMemoria));
}

/**
 * Carrega e renderiza a tela de agenda
 */
function carregarAgenda() {
    renderizarCalendario();
    renderizarListaEventosProximos();
    if (typeof renderizarAdminListaEventos === 'function') renderizarAdminListaEventos();
}

/**
 * Navegação de mês no calendário
 */
function navegarMesAgenda(delta) {
    mesAtualAgenda += delta;
    if (mesAtualAgenda < 0) {
        mesAtualAgenda = 11;
        anoAtualAgenda--;
    } else if (mesAtualAgenda > 11) {
        mesAtualAgenda = 0;
        anoAtualAgenda++;
    }
    renderizarCalendario();
}

/**
 * Renderiza a grade do calendário mensal
 */
function renderizarCalendario() {
    const elGrid = document.getElementById('grid-dias-calendario');
    const elTituloMes = document.getElementById('titulo-mes-ano-agenda');
    if (!elGrid) return;

    const nomesMeses = [
        'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];

    if (elTituloMes) {
        elTituloMes.textContent = `${nomesMeses[mesAtualAgenda]} de ${anoAtualAgenda}`;
    }

    const eventos = obterEventosIgreja();
    const cultosArray = window.dadosGlobais?.servicesDataList || window.dadosGlobais?.cultos || [];

    // Primeiro dia do mês e total de dias
    const primeiroDia = new Date(anoAtualAgenda, mesAtualAgenda, 1).getDay();
    const totalDiasNoMes = new Date(anoAtualAgenda, mesAtualAgenda + 1, 0).getDate();
    const totalDiasMesAnterior = new Date(anoAtualAgenda, mesAtualAgenda, 0).getDate();

    const hoje = new Date();
    const hojeStr = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;

    let html = '';

    // Dias do mês anterior (padding)
    for (let i = primeiroDia - 1; i >= 0; i--) {
        const diaNum = totalDiasMesAnterior - i;
        html += `
            <div class="bg-slate-950/40 p-2 border border-slate-800/40 min-h-[85px] opacity-40 select-none">
                <span class="text-xs font-semibold text-slate-600">${diaNum}</span>
            </div>
        `;
    }

    // Dias do mês atual
    for (let dia = 1; dia <= totalDiasNoMes; dia++) {
        const diaFormatted = String(dia).padStart(2, '0');
        const mesFormatted = String(mesAtualAgenda + 1).padStart(2, '0');
        const dataStr = `${anoAtualAgenda}-${mesFormatted}-${diaFormatted}`;

        const ehHoje = (dataStr === hojeStr);

        // Filtra eventos e cultos do dia
        const evtsDoDia = eventos.filter(e => e.date === dataStr || (e.date && e.date.startsWith(dataStr)));
        const cultosDoDia = cultosArray.filter(c => {
            if (c.date && c.date.startsWith(dataStr)) return true; // Para objects do servicesDataList
            if (Array.isArray(c) && c[0]) {
                // Fallback para o array form formatado: '23/08 - CULTO DE DOMINGO'
                const match = String(c[0]).match(/^(\d{2})\/(\d{2})/);
                if (match && `${anoAtualAgenda}-${match[2]}-${match[1]}` === dataStr) return true;
            }
            return false;
        });

        const temItens = evtsDoDia.length > 0 || cultosDoDia.length > 0;

        let bordaHoje = ehHoje ? 'border-2 border-brand-500 bg-brand-950/20' : 'border border-slate-800/80 bg-slate-900/60 hover:bg-slate-800/80';

        html += `
            <div onclick="abrirModalDetalhesDia('${dataStr}')" class="p-2 ${bordaHoje} min-h-[85px] rounded-xl transition cursor-pointer flex flex-col justify-between group">
                <div class="flex items-center justify-between">
                    <span class="text-xs font-bold ${ehHoje ? 'text-brand-400 bg-brand-900/60 px-1.5 py-0.5 rounded-md' : 'text-slate-300'}">${dia}</span>
                    ${temItens ? `<span class="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>` : ''}
                </div>

                <div class="space-y-1 mt-1">
                    ${cultosDoDia.slice(0, 1).map(c => `
                        <div class="text-[10px] bg-cyan-950/80 text-cyan-300 border border-cyan-800/60 px-1.5 py-0.5 rounded truncate font-medium">
                            ⛪ Culto
                        </div>
                    `).join('')}

                    ${evtsDoDia.slice(0, 1).map(e => `
                        <div class="text-[10px] bg-purple-950/80 text-purple-300 border border-purple-800/60 px-1.5 py-0.5 rounded truncate font-medium">
                            📅 ${e.title}
                        </div>
                    `).join('')}

                    ${(evtsDoDia.length + cultosDoDia.length) > 2 ? `
                        <span class="text-[9px] text-slate-400 font-semibold block text-right">+${(evtsDoDia.length + cultosDoDia.length) - 2} mais</span>
                    ` : ''}
                </div>
            </div>
        `;
    }

    // Dias do próximo mês (padding final)
    const totalQuadradosAtuais = primeiroDia + totalDiasNoMes;
    const quadradosRestantes = (7 - (totalQuadradosAtuais % 7)) % 7;
    for (let i = 1; i <= quadradosRestantes; i++) {
        html += `
            <div class="bg-slate-950/40 p-2 border border-slate-800/40 min-h-[85px] opacity-40 select-none">
                <span class="text-xs font-semibold text-slate-600">${i}</span>
            </div>
        `;
    }

    elGrid.innerHTML = html;
}

/**
 * Renderiza a lista lateral dos próximos eventos
 */
function renderizarListaEventosProximos() {
    const container = document.getElementById('lista-eventos-proximos');
    if (!container) return;

    const eventos = obterEventosIgreja();
    const hObj = new Date();
    const anoH = hObj.getFullYear();
    const mesH = String(hObj.getMonth() + 1).padStart(2, '0');
    const diaH = String(hObj.getDate()).padStart(2, '0');
    const hojeStr = `${anoH}-${mesH}-${diaH}`;

    const proximos = eventos
        .filter(e => e.date >= hojeStr)
        .sort((a, b) => a.date.localeCompare(b.date));

    if (proximos.length === 0) {
        container.innerHTML = `<p class="text-xs text-slate-500 py-4 italic text-center">Nenhum evento futuro cadastrado.</p>`;
        return;
    }

    const userToEvaluate = (typeof modoSimulacaoPerfil !== 'undefined' ? modoSimulacaoPerfil : null) || (window.usuarioLogado || null);
    const roleUsuario = userToEvaluate ? (userToEvaluate.system_role || userToEvaluate.role || 'membro') : 'visitante';
    const podeEditar = (roleUsuario === 'admin' || roleUsuario === 'lider');

    container.innerHTML = proximos.map(evt => {
        const parts = evt.date.split('-');
        const dataFmt = `${parts[2]}/${parts[1]}/${parts[0]}`;

        return `
            <div class="bg-slate-900 border border-slate-800 p-3.5 rounded-xl space-y-2.5 hover:border-slate-700 transition">
                ${evt.image_url ? `
                    <div class="rounded-lg overflow-hidden border border-slate-800 bg-slate-950">
                        <img src="${evt.image_url}" alt="${evt.title}" class="w-full max-h-36 object-cover hover:scale-105 transition duration-300">
                    </div>
                ` : ''}
                <div class="flex items-start justify-between gap-2">
                    <div>
                        <h4 class="text-sm font-bold text-white">${evt.title}</h4>
                        <p class="text-xs text-brand-400 font-medium">📅 ${dataFmt} ${evt.time ? `às ${evt.time}` : ''}</p>
                    </div>
                    ${podeEditar ? `
                        <div class="flex items-center gap-1">
                            <button onclick="abrirModalEventoAdmin('${evt.id}')" class="text-slate-400 hover:text-white p-1 text-xs" title="Editar">✏️</button>
                            <button onclick="excluirEventoAgenda('${evt.id}')" class="text-slate-400 hover:text-red-400 p-1 text-xs" title="Excluir">🗑️</button>
                        </div>
                    ` : ''}
                </div>
                ${evt.location ? `<p class="text-xs text-slate-400 flex items-center gap-1">📍 <span>${evt.location}</span></p>` : ''}
                ${evt.description ? `<p class="text-xs text-slate-300 border-t border-slate-800/80 pt-1.5 leading-relaxed">${evt.description}</p>` : ''}
            </div>
        `;
    }).join('');
}

/**
 * Abre o modal de seleção e detalhes da data clicada no calendário
 */
function abrirModalDetalhesDia(dataStr) {
    const modal = document.getElementById('modal-detalhes-dia-agenda');
    if (!modal) return;

    const parts = dataStr.split('-');
    const dateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    const diasSemana = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
    const diaSemana = diasSemana[dateObj.getDay()] || '';
    const dataFmt = `${parts[2]}/${parts[1]}/${parts[0]}`;

    const tituloModal = document.getElementById('titulo-modal-dia-agenda');
    if (tituloModal) {
        tituloModal.textContent = `📅 ${diaSemana}, ${dataFmt}`;
    }

    const containerConteudo = document.getElementById('conteudo-detalhes-dia-agenda');
    if (!containerConteudo) return;

    // 1. Obter perfil do usuário
    const userToEvaluate = (typeof modoSimulacaoPerfil !== 'undefined' ? modoSimulacaoPerfil : null) || (window.usuarioLogado || null);
    const roleUsuario = userToEvaluate ? (userToEvaluate.system_role || userToEvaluate.role || 'membro') : 'visitante';
    const isLiderOuAdmin = (roleUsuario === 'admin' || roleUsuario === 'lider');

    // 2. Obter cultos do dia
    const rawServices = window.dadosGlobais?.services || [];
    const cultosDoDia = rawServices.filter(s => s.date && s.date.startsWith(dataStr));

    // Fallback cultos formatados
    if (cultosDoDia.length === 0 && window.dadosGlobais?.cultos) {
        window.dadosGlobais.cultos.forEach(row => {
            if (Array.isArray(row) && row[0]) {
                const match = String(row[0]).match(/^(\d{2})\/(\d{2})/);
                if (match && `${anoAtualAgenda}-${match[2]}-${match[1]}` === dataStr) {
                    cultosDoDia.push({
                        id: row[8] || 'culto-row',
                        title: row[0],
                        date: dataStr,
                        location: 'Templo Principal'
                    });
                }
            }
        });
    }

    // 3. Obter eventos do dia
    const todosEventos = obterEventosIgreja();
    const evtsDoDia = todosEventos.filter(e => e.date === dataStr || (e.date && e.date.startsWith(dataStr)));

    const totalItens = cultosDoDia.length + evtsDoDia.length;

    // CENÁRIO A: NENHUMA PROGRAMAÇÃO NO DIA
    if (totalItens === 0) {
        if (isLiderOuAdmin) {
            containerConteudo.innerHTML = `
                <div class="text-center py-5 space-y-4">
                    <div class="w-14 h-14 bg-slate-900 border border-slate-700/80 rounded-2xl flex items-center justify-center text-2xl mx-auto shadow-inner text-slate-300">
                        🗓️
                    </div>
                    <div>
                        <h3 class="text-sm font-bold text-white">Nenhuma programação neste dia</h3>
                        <p class="text-xs text-slate-400 mt-1">O que você gostaria de criar para <strong>${dataFmt}</strong>?</p>
                    </div>
                    
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                        <button onclick="fecharModalDetalhesDia(); window.pendingDataClick = '${dataStr}'; mostrarFormCulto(null);" 
                            class="bg-gradient-to-br from-brand-950/80 to-slate-900 hover:from-brand-900/80 hover:to-slate-800 border border-brand-500/40 hover:border-brand-400 p-4 rounded-xl text-left transition group shadow-md flex flex-col justify-between">
                            <div>
                                <span class="text-2xl block mb-1">⛪</span>
                                <h4 class="text-sm font-bold text-white group-hover:text-brand-300">Criar Culto</h4>
                                <p class="text-[11px] text-slate-400 mt-1 leading-relaxed">Configurar escalas de ministérios, vocal e repertório de músicas.</p>
                            </div>
                            <span class="text-xs font-semibold text-brand-400 mt-3 flex items-center gap-1">Prosseguir ➔</span>
                        </button>

                        <button onclick="fecharModalDetalhesDia(); abrirModalEventoAdmin(null, '${dataStr}');" 
                            class="bg-gradient-to-br from-purple-950/80 to-slate-900 hover:from-purple-900/80 hover:to-slate-800 border border-purple-500/40 hover:border-purple-400 p-4 rounded-xl text-left transition group shadow-md flex flex-col justify-between">
                            <div>
                                <span class="text-2xl block mb-1">🎉</span>
                                <h4 class="text-sm font-bold text-white group-hover:text-purple-300">Criar Evento</h4>
                                <p class="text-[11px] text-slate-400 mt-1 leading-relaxed">Cadastrar conferência, vigília, retiro com foto de divulgação.</p>
                            </div>
                            <span class="text-xs font-semibold text-purple-400 mt-3 flex items-center gap-1">Prosseguir ➔</span>
                        </button>
                    </div>
                </div>
            `;
        } else {
            containerConteudo.innerHTML = `
                <div class="text-center py-8 space-y-2">
                    <span class="text-3xl">☕</span>
                    <p class="text-sm font-semibold text-slate-300">Nenhuma programação agendada</p>
                    <p class="text-xs text-slate-500">Não há cultos ou eventos marcados para este dia.</p>
                </div>
            `;
        }
    } else {
        // CENÁRIO B: JÁ EXISTEM ITENS NO DIA
        let html = '<div class="space-y-3">';
        html += `<p class="text-xs font-semibold text-slate-400">Programação agendada para este dia:</p>`;

        // Renderizar Cultos
        cultosDoDia.forEach(s => {
            const timeStr = s.date && s.date.includes('T') ? s.date.split('T')[1].substring(0, 5) : (s.time || '');
            const rows = window.dadosGlobais?.cultos || [];
            let cIndex = rows.findIndex(row => row[8] === s.id);
            if (cIndex === -1 && s.title) {
                cIndex = rows.findIndex(row => row[0] === s.title);
            }
            const editAction = cIndex !== -1 ? `mostrarFormCulto(${cIndex})` : `window.pendingDataClick = '${dataStr}'; mostrarFormCulto(null);`;

            let sLoc = s.location || '';
            if (!sLoc && s.notes) {
                try {
                    const pn = JSON.parse(s.notes);
                    if (pn.location) sLoc = pn.location;
                } catch(e) {}
            }

            html += `
                <div class="bg-slate-900 border border-slate-700/80 hover:border-brand-500/80 p-3.5 rounded-xl flex items-center justify-between gap-3 transition shadow-sm">
                    <div class="space-y-1 min-w-0 flex-1">
                        <div class="flex items-center gap-2">
                            <span class="text-[10px] bg-brand-950 text-brand-400 border border-brand-800/80 px-2 py-0.5 rounded-md font-bold uppercase">⛪ Culto</span>
                            ${timeStr ? `<span class="text-xs text-slate-400 font-semibold">⏰ ${timeStr}</span>` : ''}
                        </div>
                        <p class="text-sm font-bold text-white truncate">${s.title || 'Culto de Adoração'}</p>
                        ${sLoc ? `<p class="text-xs text-slate-400 flex items-center gap-1">📍 <span>${sLoc}</span></p>` : ''}
                    </div>
                    ${isLiderOuAdmin ? `
                        <button onclick="fecharModalDetalhesDia(); ${editAction}" class="bg-brand-600 hover:bg-brand-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition shrink-0">
                            ✏️ Editar
                        </button>
                    ` : ''}
                </div>
            `;
        });

        // Renderizar Eventos
        evtsDoDia.forEach(evt => {
            html += `
                <div class="bg-slate-900 border border-slate-700/80 hover:border-purple-500/80 p-3.5 rounded-xl flex items-start justify-between gap-3 transition shadow-sm">
                    <div class="flex items-start gap-3 min-w-0 flex-1">
                        ${evt.image_url ? `
                            <img src="${evt.image_url}" alt="${evt.title}" class="w-14 h-14 rounded-lg object-cover border border-slate-700 shrink-0">
                        ` : ''}
                        <div class="space-y-1 min-w-0 flex-1">
                            <div class="flex items-center gap-2">
                                <span class="text-[10px] bg-purple-950 text-purple-300 border border-purple-800/80 px-2 py-0.5 rounded-md font-bold uppercase">🎉 Evento</span>
                                ${evt.time ? `<span class="text-xs text-slate-400 font-semibold">⏰ ${evt.time}</span>` : ''}
                            </div>
                            <p class="text-sm font-bold text-white truncate">${evt.title}</p>
                            ${evt.location ? `<p class="text-xs text-slate-400 flex items-center gap-1">📍 <span>${evt.location}</span></p>` : ''}
                            ${evt.description ? `<p class="text-xs text-slate-300 pt-1 leading-relaxed border-t border-slate-800/80 mt-1">${evt.description}</p>` : ''}
                        </div>
                    </div>
                    ${isLiderOuAdmin ? `
                        <div class="flex items-center gap-1 shrink-0">
                            <button onclick="fecharModalDetalhesDia(); abrirModalEventoAdmin('${evt.id}');" class="bg-purple-600 hover:bg-purple-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition">
                                ✏️ Editar
                            </button>
                            <button onclick="excluirEventoAgenda('${evt.id}')" class="bg-red-950/60 hover:bg-red-900 text-red-300 border border-red-800/60 p-1.5 rounded-lg text-xs transition" title="Excluir">
                                🗑️
                            </button>
                        </div>
                    ` : ''}
                </div>
            `;
        });

        html += `</div>`;

        // Se for admin ou líder, disponibilizar botões de criação para adicionar mais um
        if (isLiderOuAdmin) {
            html += `
                <div class="mt-4 pt-3 border-t border-slate-700/60 space-y-2">
                    <p class="text-xs font-semibold text-slate-400">➕ Adicionar nova programação neste dia:</p>
                    <div class="grid grid-cols-2 gap-2">
                        <button onclick="fecharModalDetalhesDia(); window.pendingDataClick = '${dataStr}'; mostrarFormCulto(null);"
                            class="bg-slate-800 hover:bg-brand-900/60 text-slate-200 hover:text-brand-300 border border-slate-700 hover:border-brand-500/60 p-2.5 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1.5 shadow-sm">
                            <span>⛪</span> Criar Culto
                        </button>
                        <button onclick="fecharModalDetalhesDia(); abrirModalEventoAdmin(null, '${dataStr}');"
                            class="bg-slate-800 hover:bg-purple-900/60 text-slate-200 hover:text-purple-300 border border-slate-700 hover:border-purple-500/60 p-2.5 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1.5 shadow-sm">
                            <span>🎉</span> Criar Evento
                        </button>
                    </div>
                </div>
            `;
        }

        containerConteudo.innerHTML = html;
    }

    modal.classList.remove('hidden');
}

function fecharModalDetalhesDia() {
    document.getElementById('modal-detalhes-dia-agenda')?.classList.add('hidden');
}

/**
 * Funções de Imagem de Divulgação do Evento
 */
let currentEventoImageUrl = '';

function previewImagemEventoArquivo(input) {
    if (input.files && input.files[0]) {
        const file = input.files[0];
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = document.getElementById('evento-imagem-preview');
            const container = document.getElementById('evento-imagem-preview-container');
            if (img && container) {
                img.src = e.target.result;
                container.classList.remove('hidden');
            }
        };
        reader.readAsDataURL(file);
        document.getElementById('evento-imagem-url').value = '';
    }
}

function previewImagemEventoUrl(url) {
    const img = document.getElementById('evento-imagem-preview');
    const container = document.getElementById('evento-imagem-preview-container');
    if (!img || !container) return;

    if (url && url.trim().startsWith('http')) {
        img.src = url.trim();
        container.classList.remove('hidden');
        document.getElementById('evento-imagem-file').value = '';
    } else if (!url) {
        container.classList.add('hidden');
    }
}

function removerImagemEvento() {
    currentEventoImageUrl = '';
    const fileInput = document.getElementById('evento-imagem-file');
    const urlInput = document.getElementById('evento-imagem-url');
    const container = document.getElementById('evento-imagem-preview-container');
    const img = document.getElementById('evento-imagem-preview');

    if (fileInput) fileInput.value = '';
    if (urlInput) urlInput.value = '';
    if (img) img.src = '';
    if (container) container.classList.add('hidden');
}

/**
 * Modal de cadastro/edição de evento
 */
function abrirModalEventoAdmin(eventoId = null, dataStr = null) {
    const modal = document.getElementById('modal-evento-admin');
    if (!modal) return;

    document.getElementById('evento-id').value = eventoId || '';
    document.getElementById('evento-titulo').value = '';
    document.getElementById('evento-data').value = dataStr || new Date().toISOString().split('T')[0];
    document.getElementById('evento-hora').value = '19:30';
    document.getElementById('evento-local').value = '';
    document.getElementById('evento-descricao').value = '';
    removerImagemEvento();

    if (eventoId) {
        const eventos = obterEventosIgreja();
        const evt = eventos.find(e => e.id === eventoId);
        if (evt) {
            document.getElementById('evento-titulo').value = evt.title || '';
            document.getElementById('evento-data').value = evt.date || '';
            document.getElementById('evento-hora').value = evt.time || '';
            document.getElementById('evento-local').value = evt.location || '';
            document.getElementById('evento-descricao').value = evt.description || '';

            if (evt.image_url) {
                currentEventoImageUrl = evt.image_url;
                document.getElementById('evento-imagem-url').value = evt.image_url;
                const img = document.getElementById('evento-imagem-preview');
                const container = document.getElementById('evento-imagem-preview-container');
                if (img && container) {
                    img.src = evt.image_url;
                    container.classList.remove('hidden');
                }
            }
        }
    }

    modal.classList.remove('hidden');
}

function fecharModalEventoAdmin() {
    document.getElementById('modal-evento-admin')?.classList.add('hidden');
}

/**
 * Salvar evento (Admin/Líder)
 */
async function salvarEventoAdmin(e) {
    if (e && e.preventDefault) e.preventDefault();

    const btn = document.getElementById('btn-salvar-evento');
    const id = document.getElementById('evento-id').value;
    const title = document.getElementById('evento-titulo').value.trim();
    const date = document.getElementById('evento-data').value;
    const time = document.getElementById('evento-hora').value;
    const location = document.getElementById('evento-local').value.trim();
    const description = document.getElementById('evento-descricao').value.trim();
    const urlDigitada = document.getElementById('evento-imagem-url').value.trim();
    const fileInput = document.getElementById('evento-imagem-file');

    if (!title || !date) {
        if (typeof mostrarToast === 'function') mostrarToast('Preencha o título e a data do evento.', 'aviso');
        return;
    }

    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Salvando...';
    }

    try {
        let finalImageUrl = urlDigitada || currentEventoImageUrl || null;

        // Se o usuário selecionou um arquivo de imagem local, fazer upload para o Supabase
        if (fileInput && fileInput.files && fileInput.files[0]) {
            const file = fileInput.files[0];
            if (typeof uploadArquivoSupabase === 'function') {
                finalImageUrl = await uploadArquivoSupabase(file, 'media-inbox', 'eventos');
            } else if (typeof window.uploadArquivoSupabase === 'function') {
                finalImageUrl = await window.uploadArquivoSupabase(file, 'media-inbox', 'eventos');
            }
        }

        const userToEvaluate = (typeof modoSimulacaoPerfil !== 'undefined' ? modoSimulacaoPerfil : null) || (window.usuarioLogado || null);
        const churchId = userToEvaluate?.church_id || window.dadosGlobais?.church?.id || 'ae125cfd-96ef-4324-b1f0-f96a4f34eecf';

        let eventos = obterEventosIgreja();

        if (id) {
            const idx = eventos.findIndex(evt => evt.id === id);
            if (idx !== -1) {
                eventos[idx] = { 
                    ...eventos[idx], 
                    title, 
                    date, 
                    time, 
                    location, 
                    description,
                    image_url: finalImageUrl 
                };
            }
        } else {
            const novoEvento = {
                id: 'evt-' + Date.now(),
                church_id: churchId,
                title,
                date,
                time,
                location,
                description,
                image_url: finalImageUrl
            };
            eventos.push(novoEvento);
        }

        eventosMemoria = eventos;
        salvarEventosMemoria(churchId);

        fecharModalEventoAdmin();
        carregarAgenda();

        if (typeof mostrarToast === 'function') mostrarToast('Evento salvo com sucesso!', 'sucesso');
    } catch (err) {
        console.error("Erro ao salvar evento:", err);
        if (typeof mostrarToast === 'function') mostrarToast('Erro ao salvar evento: ' + err.message, 'erro');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = 'Salvar Evento';
        }
    }
}

function excluirEventoAgenda(eventoId) {
    if (!confirm('Deseja realmente excluir este evento?')) return;

    const userToEvaluate = (typeof modoSimulacaoPerfil !== 'undefined' ? modoSimulacaoPerfil : null) || (window.usuarioLogado || null);
    const churchId = userToEvaluate?.church_id || window.dadosGlobais?.church?.id || 'ae125cfd-96ef-4324-b1f0-f96a4f34eecf';

    eventosMemoria = obterEventosIgreja().filter(e => e.id !== eventoId);
    salvarEventosMemoria(churchId);

    carregarAgenda();
    if (typeof mostrarToast === 'function') mostrarToast('Evento excluído.', 'info');
}

function renderizarAdminListaEventos() {
    const container = document.getElementById('admin-lista-eventos-agenda');
    if (!container) return;

    const eventos = obterEventosIgreja().sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    if (eventos.length === 0) {
        container.innerHTML = `
            <div class="col-span-full bg-slate-900 border border-slate-800 p-8 rounded-2xl text-center space-y-2">
                <span class="text-3xl">🎉</span>
                <p class="text-sm font-semibold text-slate-300">Nenhum evento especial cadastrado.</p>
                <p class="text-xs text-slate-500">Clique no botão acima para adicionar conferências, retiros ou cultos especiais.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = eventos.map(evt => {
        const parts = (evt.date || '').split('-');
        const dataFmt = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : evt.date;

        return `
            <div class="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-3 hover:border-slate-700 transition">
                ${evt.image_url ? `
                    <div class="rounded-lg overflow-hidden border border-slate-800 bg-slate-950">
                        <img src="${evt.image_url}" alt="${evt.title}" class="w-full max-h-40 object-cover">
                    </div>
                ` : ''}
                <div class="flex items-start justify-between gap-2">
                    <div>
                        <h4 class="text-sm font-bold text-white">${evt.title}</h4>
                        <p class="text-xs text-brand-400 font-medium">📅 Data: ${dataFmt} ${evt.time ? `às ${evt.time}` : ''}</p>
                    </div>
                    <div class="flex items-center gap-1.5">
                        <button onclick="abrirModalEventoAdmin('${evt.id}')" class="bg-slate-800 hover:bg-slate-700 text-slate-300 px-2.5 py-1 rounded-lg text-xs font-medium transition">✏️ Editar</button>
                        <button onclick="excluirEventoAgenda('${evt.id}')" class="bg-red-950/60 hover:bg-red-900/80 text-red-300 border border-red-800/60 px-2.5 py-1 rounded-lg text-xs font-medium transition">🗑️ Excluir</button>
                    </div>
                </div>
                ${evt.location ? `<p class="text-xs text-slate-400">📍 Local: <span class="text-slate-300 font-medium">${evt.location}</span></p>` : ''}
                ${evt.description ? `<p class="text-xs text-slate-400 border-t border-slate-800/80 pt-2 leading-relaxed">${evt.description}</p>` : ''}
            </div>
        `;
    }).join('');
}


/**
 * LÓGICA DA ABA UNIFICADA CULTOS & EVENTOS
 */

let mesAtualAdmin = new Date().getMonth();
let anoAtualAdmin = new Date().getFullYear();

function navegarCalendarioAdmin(delta) {
    mesAtualAdmin += delta;
    if (mesAtualAdmin < 0) {
        mesAtualAdmin = 11;
        anoAtualAdmin--;
    } else if (mesAtualAdmin > 11) {
        mesAtualAdmin = 0;
        anoAtualAdmin++;
    }
    renderizarAdminCultosEventos();
}

async function renderizarAdminCultosEventos() {
    const containerMain = document.getElementById('calendario-admin-container');
    if (!containerMain) return;

    // Atualiza label
    const mesesStr = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    const label = document.getElementById('label-mes-calendario');
    if (label) label.textContent = `${mesesStr[mesAtualAdmin]} ${anoAtualAdmin}`;

    const eventosLocais = typeof obterEventosIgreja === 'function' ? obterEventosIgreja() : [];
    const servicesDb = window.dadosGlobais?.services || [];
    
    // Unificar serviços do banco e eventos locais em uma lista única sem duplicatas
    const todosServicosEEventos = [...servicesDb];
    eventosLocais.forEach(e => {
        if (!todosServicosEEventos.some(s => s.id === e.id)) {
            todosServicosEEventos.push(e);
        }
    });

    // Container do calendário
    const container = containerMain;

    const tituloMesAno = document.getElementById('calendario-mes-ano-admin');
    if (tituloMesAno) {
        const nomesMeses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
        tituloMesAno.textContent = `${nomesMeses[mesAtualAdmin]} ${anoAtualAdmin}`;
    }

    const primeiroDia = new Date(anoAtualAdmin, mesAtualAdmin, 1).getDay();
    const ultimoDia = new Date(anoAtualAdmin, mesAtualAdmin + 1, 0).getDate();

    let html = `
        <div class="grid grid-cols-7 gap-1 text-center font-semibold text-xs text-slate-400 mb-2">
            <div>Dom</div><div>Seg</div><div>Ter</div><div>Qua</div><div>Qui</div><div>Sex</div><div>Sáb</div>
        </div>
        <div class="grid grid-cols-7 gap-1">
    `;

    // Dias em branco antes do início do mês
    for (let i = 0; i < primeiroDia; i++) {
        html += `<div class="rounded p-2 min-h-[50px]"></div>`;
    }

    // Dias do mês
    for (let d = 1; d <= ultimoDia; d++) {
        const dataStr = `${anoAtualAdmin}-${String(mesAtualAdmin + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        
        // Encontrar eventos ou cultos do dia
        const todosHoje = todosServicosEEventos.filter(e => e.date && e.date.startsWith(dataStr));
        const totalNoDia = todosHoje.length;

        const tagDiaMes = `${String(d).padStart(2, '0')}/${String(mesAtualAdmin + 1).padStart(2, '0')}`;
        
        let cultoIndex = -1;
        if (totalNoDia > 0) {
            cultoIndex = (window.dadosGlobais?.cultos || []).findIndex(row => row[8] === todosHoje[0].id);
        }
        if (cultoIndex === -1) {
            cultoIndex = (window.dadosGlobais?.cultos || []).findIndex(row => (row[0] || '').includes(tagDiaMes));
        }

        const temCulto = cultoIndex !== -1 || totalNoDia > 0;

        let bgClass = "bg-slate-900 border-slate-700 hover:border-brand-500 cursor-pointer transition";
        let indicator = "";

        if (temCulto) {
            bgClass = "bg-brand-900/30 border-brand-500/50 hover:bg-brand-900/50 cursor-pointer transition text-brand-300";
            if (totalNoDia > 1) {
                indicator += `<span class="block w-2 h-2 rounded-full bg-purple-500 mt-1"></span><span class="block w-2 h-2 rounded-full bg-brand-500 mt-1"></span>`;
            } else {
                indicator += `<span class="block w-2 h-2 rounded-full bg-brand-500 mt-1 mx-auto"></span>`;
            }
        }

        // Ao clicar em uma data no calendário do admin, abrir sempre o modal de seleção do dia
        let acaoClique = `abrirModalDetalhesDia('${dataStr}')`;

        html += `
            <div onclick="${acaoClique}" class="rounded p-2 border flex flex-col items-center justify-center min-h-[50px] ${bgClass}">
                <span class="text-sm font-semibold">${d}</span>
                <div class="flex gap-1">${indicator}</div>
            </div>
        `;
    }

    html += `</div>`;
    container.innerHTML = html;

    // Atualiza barras laterais
    renderizarEventosLateral(todosServicosEEventos);
    carregarE_RenderizarCultosRecorrentes();
    if (typeof carregarMesAtivoUI === 'function') carregarMesAtivoUI();
}

function editarEventoPorId(serviceId, dateStr = '') {
    if (dateStr) window.pendingDataClick = dateStr;
    const cultos = window.dadosGlobais?.cultos || [];
    const idx = cultos.findIndex(row => row[8] === serviceId);
    if (typeof mostrarFormCulto === 'function') {
        mostrarFormCulto(idx !== -1 ? idx : null);
    }
}
window.editarEventoPorId = editarEventoPorId;

function renderizarEventosLateral(eventos) {
    const container = document.getElementById('lista-eventos-lateral');
    if (!container) return;

    // Filtra para o mês atual
    const mesFormatado = `-${String(mesAtualAdmin + 1).padStart(2, '0')}-`;
    const eventosMes = eventos.filter(e => (e.date || '').includes(mesFormatado)).sort((a, b) => (a.date || '').localeCompare(b.date || ''));

    if (eventosMes.length === 0) {
        container.innerHTML = `<p class="text-xs text-slate-500 p-2 text-center">Nenhum evento neste mês.</p>`;
        return;
    }

    container.innerHTML = eventosMes.map(evt => {
        const dStr = evt.date ? evt.date.split('T')[0] : '';
        return `
            <div class="bg-slate-900 border border-slate-800 p-3 rounded-lg flex items-center justify-between group">
                <div>
                    <p class="text-xs font-bold text-white truncate max-w-[150px]">${evt.title}</p>
                    <p class="text-[10px] text-slate-400">${evt.date} ${evt.time ? `às ${evt.time}` : ''}</p>
                </div>
                <div class="flex gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition">
                    <button onclick="editarEventoPorId('${evt.id}', '${dStr}')" class="text-slate-400 hover:text-white p-1" title="Editar Evento">✏️</button>
                </div>
            </div>
        `;
    }).join('');
}


/**
 * REGRAS DE CULTOS RECORRENTES (SaaS / Supabase)
 */

async function carregarE_RenderizarCultosRecorrentes() {
    const container = document.getElementById('lista-recorrentes-lateral');
    if (!container) return;

    try {
        container.innerHTML = `<p class="text-xs text-slate-500 p-2 text-center">Carregando regras...</p>`;
        const churchId = obterChurchIdAtual();
        
        let regras = [];
        if (supabaseClient) {
            const { data, error } = await supabaseClient.from('recurrent_services').select('*').order('day_of_week', { ascending: true });
            if (!error && data) regras = data;
        }

        if (regras.length === 0) {
            container.innerHTML = `<p class="text-xs text-slate-500 p-2 text-center">Nenhuma regra cadastrada.</p>`;
            return;
        }

        const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

        container.innerHTML = regras.map(r => `
            <div class="bg-slate-900 border border-slate-800 p-3 rounded-lg">
                <div class="flex items-start justify-between mb-1">
                    <p class="text-xs font-bold text-indigo-300">${r.name}</p>
                    <div class="flex gap-2">
                        <button onclick="gerarCultosDaRegra('${r.id}')" class="text-[10px] bg-indigo-900/50 text-indigo-300 px-1.5 py-0.5 rounded hover:bg-indigo-800">Gerar</button>
                        <button onclick="excluirRegraRecorrente('${r.id}')" class="text-red-400 hover:text-red-300 text-[10px]">🗑️</button>
                    </div>
                </div>
                <p class="text-[10px] text-slate-400">${diasSemana[r.day_of_week]} às ${r.time} • ${r.location || '-'}</p>
            </div>
        `).join('');

    } catch (e) {
        console.error(e);
        container.innerHTML = `<p class="text-xs text-red-400 p-2">Erro ao ler regras.</p>`;
    }
}

function abrirModalCultoRecorrenteAdmin() {
    const modal = document.getElementById('modal-culto-recorrente-admin');
    if (modal) modal.classList.remove('hidden');
}

function fecharModalCultoRecorrenteAdmin() {
    const modal = document.getElementById('modal-culto-recorrente-admin');
    if (modal) modal.classList.add('hidden');
}

// Salva a regra e já gera os próximos cultos
async function salvarCultoRecorrenteAdmin(e) {
    if (e && e.preventDefault) e.preventDefault();

    const nomeCulto = document.getElementById('recorrente-nome').value.trim();
    const diaSemana = parseInt(document.getElementById('recorrente-diasemana').value, 10);
    const horario = document.getElementById('recorrente-hora').value || '19:00';
    const local = document.getElementById('recorrente-local')?.value || '';
    const desc = document.getElementById('recorrente-desc')?.value || '';
    const meses = parseInt(document.getElementById('recorrente-periodo').value, 10) || 3;

    if (!nomeCulto) {
        if (typeof mostrarToast === 'function') mostrarToast('Digite o nome do culto.', 'aviso');
        return;
    }

    const btn = document.getElementById('btn-salvar-recorrente');
    if (btn) { btn.disabled = true; btn.textContent = 'Salvando Regra...'; }

    try {
        const churchId = obterChurchIdAtual();
        
        // 1. Salvar na tabela recurrent_services
        let regraId = null;
        if (supabaseClient) {
            const { data, error } = await supabaseClient.from('recurrent_services').insert([{
                church_id: churchId,
                name: nomeCulto,
                day_of_week: diaSemana,
                time: horario,
                location: local,
                description: desc
            }]).select('id').single();
            
            if (error) throw error;
            regraId = data.id;
        }

        // 2. Gerar cultos baseados na regra
        if (regraId) {
            await logicGerarCultos(nomeCulto, diaSemana, horario, meses, churchId);
        }

        fecharModalCultoRecorrenteAdmin();
        if (typeof mostrarToast === 'function') mostrarToast(`🎉 Regra criada e cultos gerados!`, 'sucesso');

        renderizarAdminCultosEventos();
        if (typeof carregarDados === 'function') await carregarDados();

    } catch(err) {
        console.error(err);
        if (typeof mostrarToast === 'function') mostrarToast('Erro: ' + err.message, 'erro');
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = '🔄 Salvar e Gerar'; }
    }
}

async function logicGerarCultos(nomeCulto, diaSemana, horario, meses, churchId) {
    const datasCultos = [];
    const hoje = new Date();
    const dataFim = new Date();
    dataFim.setMonth(dataFim.getMonth() + meses);

    let curr = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 12, 0, 0);

    while (curr <= dataFim) {
        if (curr.getDay() === diaSemana) {
            const diaStr = String(curr.getDate()).padStart(2, '0');
            const mesStr = String(curr.getMonth() + 1).padStart(2, '0');
            const anoStr = curr.getFullYear();
            
            const titleStr = `${diaStr}/${mesStr} - CULTO DE ${nomeCulto.toUpperCase()}`;
            
            const [hH, mM] = horario.split(':');
            const dateIso = new Date(anoStr, curr.getMonth(), curr.getDate(), parseInt(hH || 19), parseInt(mM || 0)).toISOString();

            // Prevenir duplicatas checando se já existe esse culto nessa data exata (verificando o titleStr)
            const jaExiste = (window.dadosGlobais?.cultos || []).some(row => row[0] === titleStr);

            if (!jaExiste) {
                datasCultos.push({
                    church_id: churchId,
                    title: titleStr,
                    date: dateIso
                });
            }
        }
        curr.setDate(curr.getDate() + 1);
    }

    if (datasCultos.length > 0 && supabaseClient) {
        await supabaseClient.from('services').insert(datasCultos);
    }
}

async function gerarCultosDaRegra(regraId) {
    try {
        const { data, error } = await supabaseClient.from('recurrent_services').select('*').eq('id', regraId).single();
        if (error || !data) return;

        if (confirm(`Gerar cultos futuros para "${data.name}"?`)) {
            await logicGerarCultos(data.name, data.day_of_week, data.time, 3, data.church_id);
            if (typeof mostrarToast === 'function') mostrarToast(`Cultos gerados com sucesso!`, 'sucesso');
            if (typeof carregarDados === 'function') await carregarDados();
            renderizarAdminCultosEventos();
        }
    } catch(err) {
        console.error(err);
    }
}

async function excluirRegraRecorrente(regraId) {
    if (confirm("Tem certeza que deseja excluir esta regra? (Os cultos já gerados não serão apagados automaticamente, use a limpeza em massa).")) {
        try {
            await supabaseClient.from('recurrent_services').delete().eq('id', regraId);
            renderizarAdminCultosEventos();
        } catch(err) {
            console.error(err);
        }
    }
}

/**
 * LIMPEZA DE DUPLICATAS
 */
function abrirLimpezaEmMassa() {
    const nome = prompt("LIMPEZA: Digite o nome do culto que deseja EXCLUIR do calendário futuramente. (Ex: 'DOMINGO' apagará todos os 'CULTO DE DOMINGO' do mês que vem em diante)");
    if (!nome) return;

    if (confirm(`ATENÇÃO: Você vai apagar definitivamente todos os cultos com nome contendo "${nome.toUpperCase()}" a partir de hoje. Confirmar?`)) {
        excluirServicosDuplicados(nome);
    }
}

async function excluirServicosDuplicados(nomeCulto) {
    try {
        const churchId = obterChurchIdAtual();
        const hojeIso = new Date().toISOString(); // Apaga do futuro

        // Precisamos primeiro buscar os IDs (a query no supabase com ilike e gt)
        const { data, error } = await supabaseClient
            .from('services')
            .select('id, title')
            .eq('church_id', churchId)
            .ilike('title', `%${nomeCulto}%`)
            .gte('date', hojeIso);

        if (error) throw error;
        
        if (!data || data.length === 0) {
            if (typeof mostrarToast === 'function') mostrarToast(`Nenhum culto encontrado contendo "${nomeCulto}".`, 'aviso');
            return;
        }

        const ids = data.map(c => c.id);
        const { error: deleteError } = await supabaseClient
            .from('services')
            .delete()
            .in('id', ids);

        if (deleteError) throw deleteError;

        if (typeof mostrarToast === 'function') mostrarToast(`🗑️ ${ids.length} cultos excluídos!`, 'sucesso');
        
        if (typeof carregarDados === 'function') await carregarDados();
        renderizarAdminCultosEventos();

    } catch (err) {
        console.error(err);
        if (typeof mostrarToast === 'function') mostrarToast('Erro ao limpar duplicatas: ' + err.message, 'erro');
    }
}

// Exportações Globais Atualizadas
window.carregarAgenda = carregarAgenda;
window.navegarMesAgenda = navegarMesAgenda;
window.renderizarCalendario = renderizarCalendario;
window.renderizarListaEventosProximos = renderizarListaEventosProximos;
window.renderizarAdminListaEventos = renderizarAdminListaEventos;
window.navegarCalendarioAdmin = navegarCalendarioAdmin;
window.renderizarAdminCultosEventos = renderizarAdminCultosEventos;
window.abrirModalCultoRecorrenteAdmin = abrirModalCultoRecorrenteAdmin;
window.fecharModalCultoRecorrenteAdmin = fecharModalCultoRecorrenteAdmin;
window.salvarCultoRecorrenteAdmin = salvarCultoRecorrenteAdmin;
window.gerarCultosDaRegra = gerarCultosDaRegra;
window.excluirRegraRecorrente = excluirRegraRecorrente;
window.abrirLimpezaEmMassa = abrirLimpezaEmMassa;
window.abrirModalDetalhesDia = abrirModalDetalhesDia;
window.fecharModalDetalhesDia = fecharModalDetalhesDia;
window.abrirModalEventoAdmin = abrirModalEventoAdmin;
window.fecharModalEventoAdmin = fecharModalEventoAdmin;
window.salvarEventoAdmin = salvarEventoAdmin;
window.excluirEventoAgenda = excluirEventoAgenda;
window.previewImagemEventoArquivo = previewImagemEventoArquivo;
window.previewImagemEventoUrl = previewImagemEventoUrl;
window.removerImagemEvento = removerImagemEvento;


function carregarMesAtivoUI() {
    const input = document.getElementById('admin-active-month');
    if (input && window.dadosGlobais?.church?.active_month) {
        input.value = window.dadosGlobais.church.active_month;
    }
}

async function salvarMesAtivo() {
    const input = document.getElementById('admin-active-month');
    if (!input) return;
    
    const valor = input.value; // ex: '2026-09'
    const churchId = obterChurchIdAtual();
    
    if (window.supabaseClient) {
        try {
            const { error } = await window.supabaseClient
                .from('churches')
                .update({ active_month: valor || null })
                .eq('id', churchId);
                
            if (error) throw error;
            
            if (window.dadosGlobais?.church) {
                window.dadosGlobais.church.active_month = valor || null;
            }
            
            if (typeof mostrarToast === 'function') mostrarToast('Mês padrão atualizado com sucesso!', 'sucesso');
        } catch(e) {
            console.error(e);
            if (typeof mostrarToast === 'function') mostrarToast('Erro ao atualizar mês padrão.', 'erro');
        }
    }
}

window.carregarMesAtivoUI = carregarMesAtivoUI;
window.salvarMesAtivo = salvarMesAtivo;
