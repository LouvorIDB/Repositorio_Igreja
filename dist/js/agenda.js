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
        || null;
}

/**
 * Retorna os eventos carregados (memória local + sincronização)
 */
function obterEventosIgreja() {
    const churchId = obterChurchIdAtual();
    if (!churchId) {
        eventosMemoria = [];
        return [];
    }
    
    // Tenta carregar do localStorage por igreja
    const salvos = localStorage.getItem(`louvoridb_events_${churchId}`);
    if (salvos) {
        try {
            const parsed = JSON.parse(salvos);
            if (Array.isArray(parsed)) {
                // Purga qualquer resquício de eventos de demonstração/mock legados
                const limpos = parsed.filter(e => {
                    if (e.id === 'evt-1' || e.id === 'evt-2') return false;
                    const t = (e.title || '').toLowerCase();
                    if ((t.includes('aniversário da igreja') || t.includes('culto de jovens')) && (e.location === 'Templo Principal' || e.location === 'Salão Jovem')) {
                        return false;
                    }
                    return true;
                });
                if (limpos.length !== parsed.length) {
                    eventosMemoria = limpos;
                    salvarEventosMemoria(churchId);
                } else {
                    eventosMemoria = limpos;
                }
            } else {
                eventosMemoria = [];
            }
        } catch(e) {
            eventosMemoria = [];
        }
    } else {
        eventosMemoria = [];
    }

    // Limpa também chaves legadas de teste sem tenant se existirem
    try {
        localStorage.removeItem('louvoridb_events');
        if (churchId !== 'ae125cfd-96ef-4324-b1f0-f96a4f34eecf') {
            localStorage.removeItem('louvoridb_events_ae125cfd-96ef-4324-b1f0-f96a4f34eecf');
        }
    } catch(e){}

    return eventosMemoria;
}

function salvarEventosMemoria(churchIdParam) {
    const churchId = churchIdParam || obterChurchIdAtual();
    if (!churchId) return;
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

    // 1. Eventos locais / cadastrados
    const eventos = [...obterEventosIgreja()];

    // 2. Cultos marcados para aparecer em "Próximos Eventos"
    const rawServices = window.dadosGlobais?.services || [];
    rawServices.forEach(s => {
        let pn = {};
        if (s.notes) {
            try { pn = typeof s.notes === 'string' ? JSON.parse(s.notes) : s.notes; } catch(e){}
        }
        if (pn.destaque_evento || pn.exibir_em_eventos) {
            const dStr = s.date ? s.date.split('T')[0] : '';
            let tStr = '';
            if (s.date && s.date.includes('T')) {
                tStr = s.date.split('T')[1].substring(0, 5);
            }
            eventos.push({
                id: s.id,
                is_service: true,
                title: s.title,
                date: dStr,
                time: tStr,
                location: pn.location || 'Templo Principal',
                description: pn.description || s.description || ''
            });
        }
    });

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
        const dataFmt = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : evt.date;

        const acoesBtn = podeEditar ? (
            evt.is_service ? `
                <div class="flex items-center gap-1">
                    <button onclick="editarEventoPorId('${evt.id}', '${evt.date}')" class="text-slate-400 hover:text-white p-1 text-xs" title="Editar Culto">✏️</button>
                </div>
            ` : `
                <div class="flex items-center gap-1">
                    <button onclick="abrirModalEventoAdmin('${evt.id}')" class="text-slate-400 hover:text-white p-1 text-xs" title="Editar">✏️</button>
                    <button onclick="excluirEventoAgenda('${evt.id}')" class="text-slate-400 hover:text-red-400 p-1 text-xs" title="Excluir">🗑️</button>
                </div>
            `
        ) : '';

        return `
            <div class="bg-slate-900 border ${evt.is_service ? 'border-amber-500/40 bg-slate-900/90 shadow-sm' : 'border-slate-800'} p-3.5 rounded-xl space-y-2.5 hover:border-slate-700 transition">
                ${evt.image_url ? `
                    <div class="rounded-lg overflow-hidden border border-slate-800 bg-slate-950">
                        <img src="${evt.image_url}" alt="${evt.title}" class="w-full max-h-36 object-cover hover:scale-105 transition duration-300">
                    </div>
                ` : ''}
                <div class="flex items-start justify-between gap-2">
                    <div>
                        <div class="flex items-center gap-1.5 flex-wrap">
                            ${evt.is_service ? '<span class="text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">🌟 CULTO</span>' : ''}
                            <h4 class="text-sm font-bold text-white">${evt.title}</h4>
                        </div>
                        <p class="text-xs text-brand-400 font-medium mt-0.5">📅 ${dataFmt} ${evt.time ? `às ${evt.time}` : ''}</p>
                    </div>
                    ${acoesBtn}
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
                <div class="bg-slate-900 border border-slate-700/80 hover:border-brand-500/80 p-3.5 rounded-xl flex flex-col gap-3 transition shadow-sm">
                    <!-- Informações do Culto (Parte Superior - 100% visíveis) -->
                    <div class="space-y-1.5 min-w-0">
                        <div class="flex items-center gap-2 flex-wrap">
                            <span class="text-[10px] bg-brand-950 text-brand-400 border border-brand-800/80 px-2 py-0.5 rounded-md font-bold uppercase tracking-wider">⛪ Culto</span>
                            ${timeStr ? `<span class="text-xs text-slate-300 font-semibold flex items-center gap-1"><span>⏰</span> <span>${timeStr}</span></span>` : ''}
                        </div>
                        <p class="text-sm font-bold text-white break-words leading-snug">${s.title || 'Culto de Adoração'}</p>
                        ${sLoc ? `<p class="text-xs text-slate-400 flex items-center gap-1">📍 <span>${sLoc}</span></p>` : ''}
                    </div>

                    <!-- Botões de Ação (Parte Inferior) -->
                    <div class="flex items-center justify-end gap-2 pt-2 border-t border-slate-800/80 flex-wrap">
                        <button onclick="abrirModalExportarCalendario('${s.id}')" 
                            class="bg-indigo-950/70 hover:bg-indigo-900 text-indigo-300 border border-indigo-800/70 px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer shadow-sm" 
                            title="Adicionar este culto à minha agenda">
                            <span>📲</span> <span>Exportar Agenda</span>
                        </button>
                        ${isLiderOuAdmin ? `
                            <button onclick="fecharModalDetalhesDia(); ${editAction}" 
                                class="bg-brand-600 hover:bg-brand-500 text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1 cursor-pointer shadow-sm">
                                <span>✏️</span> <span>Editar</span>
                            </button>
                            <button onclick="excluirCulto('${s.id}')" 
                                class="bg-slate-800 hover:bg-red-700 text-slate-400 hover:text-white border border-slate-700 hover:border-red-600 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1 cursor-pointer" 
                                title="Excluir este culto">
                                <span>🗑️</span>
                            </button>
                        ` : ''}
                    </div>
                </div>
            `;
        });

        // Renderizar Eventos
        evtsDoDia.forEach(evt => {
            html += `
                <div class="bg-slate-900 border border-slate-700/80 hover:border-purple-500/80 p-3.5 rounded-xl flex flex-col gap-3 transition shadow-sm">
                    <!-- Informações do Evento (Parte Superior - 100% visíveis) -->
                    <div class="flex items-start gap-3">
                        ${evt.image_url ? `
                            <img src="${evt.image_url}" alt="${evt.title}" class="w-16 h-16 rounded-lg object-cover border border-slate-700 shrink-0">
                        ` : ''}
                        <div class="space-y-1.5 min-w-0 flex-1">
                            <div class="flex items-center gap-2 flex-wrap">
                                <span class="text-[10px] bg-purple-950 text-purple-300 border border-purple-800/80 px-2 py-0.5 rounded-md font-bold uppercase tracking-wider">🎉 Evento</span>
                                ${evt.time ? `<span class="text-xs text-slate-300 font-semibold flex items-center gap-1"><span>⏰</span> <span>${evt.time}</span></span>` : ''}
                            </div>
                            <p class="text-sm font-bold text-white break-words leading-snug">${evt.title}</p>
                            ${evt.location ? `<p class="text-xs text-slate-400 flex items-center gap-1">📍 <span>${evt.location}</span></p>` : ''}
                            ${evt.description ? `<p class="text-xs text-slate-300 pt-1 leading-relaxed border-t border-slate-800/80 mt-1">${evt.description}</p>` : ''}
                        </div>
                    </div>

                    <!-- Botões de Ação (Parte Inferior) -->
                    <div class="flex items-center justify-end gap-2 pt-2 border-t border-slate-800/80 flex-wrap">
                        <button onclick="abrirModalExportarCalendario('${evt.id}')" 
                            class="bg-indigo-950/70 hover:bg-indigo-900 text-indigo-300 border border-indigo-800/70 px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer shadow-sm" 
                            title="Adicionar este evento à minha agenda">
                            <span>📲</span> <span>Exportar Agenda</span>
                        </button>
                        ${isLiderOuAdmin ? `
                            <button onclick="fecharModalDetalhesDia(); abrirModalEventoAdmin('${evt.id}');" 
                                class="bg-purple-600 hover:bg-purple-500 text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1 cursor-pointer shadow-sm">
                                <span>✏️</span> <span>Editar</span>
                            </button>
                            <button onclick="excluirEventoAgenda('${evt.id}')" 
                                class="bg-slate-800 hover:bg-red-700 text-slate-400 hover:text-white border border-slate-700 hover:border-red-600 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1 cursor-pointer" 
                                title="Excluir este evento">
                                <span>🗑️</span>
                            </button>
                        ` : ''}
                    </div>
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
        const churchId = userToEvaluate?.church_id || window.dadosGlobais?.church?.id || obterChurchIdAtual();

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
    const churchId = userToEvaluate?.church_id || window.dadosGlobais?.church?.id || obterChurchIdAtual();

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
        let dStr = evt.date ? evt.date.split('T')[0] : '';
        let horaFormatada = evt.time || '';
        
        // Extração 100% literal da data e do horário
        if (evt.date && evt.date.includes('T')) {
            const parts = evt.date.split('T');
            const p = parts[0].split('-');
            if (p.length === 3) dStr = `${p[2]}/${p[1]}/${p[0]}`;
            if (parts[1]) horaFormatada = parts[1].substring(0, 5);
        } else if (dStr && dStr.includes('-')) {
            const p = dStr.split('-');
            if (p.length === 3) dStr = `${p[2]}/${p[1]}/${p[0]}`;
        }

        const subtitulo = horaFormatada ? `📅 ${dStr} às ${horaFormatada}` : `📅 ${dStr}`;

        return `
            <div class="bg-slate-900 border border-slate-800 p-3 rounded-lg flex items-center justify-between group">
                <div class="min-w-0 flex-1 mr-2">
                    <p class="text-xs font-bold text-white truncate max-w-[150px]">${evt.title}</p>
                    <p class="text-[10px] text-slate-400 truncate">${subtitulo}</p>
                </div>
                <div class="flex gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition shrink-0">
                    <button onclick="editarEventoPorId('${evt.id}', '${evt.date}')" class="text-slate-400 hover:text-white p-1" title="Editar Evento">✏️</button>
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
        if (supabaseClient && churchId) {
            const { data, error } = await supabaseClient
                .from('recurrent_services')
                .select('*')
                .eq('church_id', churchId)
                .order('day_of_week', { ascending: true });
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
            
            const [hH, mM] = (horario || '19:00').split(':');
            const hStr = String(parseInt(hH || 19, 10)).padStart(2, '0');
            const mStr = String(parseInt(mM || 0, 10)).padStart(2, '0');
            const dateLocalIso = `${anoStr}-${mesStr}-${diaStr}T${hStr}:${mStr}:00`;

            // Prevenir duplicatas checando se já existe esse culto nessa data exata (verificando o titleStr)
            const jaExiste = (window.dadosGlobais?.cultos || []).some(row => row && row[0] === titleStr) ||
                             (window.dadosGlobais?.services || []).some(s => s.title === titleStr);

            if (!jaExiste) {
                datasCultos.push({
                    church_id: churchId,
                    title: titleStr,
                    date: dateLocalIso
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
 * LIMPEZA EM MASSA DE CULTOS GERADOS
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
        const hojeIso = new Date().toISOString().split('T')[0];

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
        await supabaseClient.from('service_songs').delete().in('service_id', ids);
        await supabaseClient.from('service_scales').delete().in('service_id', ids);
        await supabaseClient.from('service_media').delete().in('service_id', ids);
        try {
            await supabaseClient.from('availability_comments').delete().in('service_id', ids);
        } catch(e) {}

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

/**
 * =========================================================================
 * EXPORTAÇÃO PARA CALENDÁRIO MOBILE (.ICS / GOOGLE / APPLE / SAMSUNG)
 * =========================================================================
 */

let periodoExportacaoAtual = '30d';
let itensExportacaoCarregados = [];
let itemPreSelecionadoExportId = null;

/**
 * Coleta todos os cultos e eventos futuros unificados
 */
function obterTodosItensProgramacao() {
    const itens = [];
    const idsVistos = new Set();

    // 1. Cultos do banco (services)
    const rawServices = window.dadosGlobais?.services || [];
    rawServices.forEach(s => {
        let pn = {};
        if (s.notes) {
            try { pn = typeof s.notes === 'string' ? JSON.parse(s.notes) : s.notes; } catch(e){}
        }

        let dStr = '';
        let tStr = '19:30';

        if (s.date) {
            if (s.date.includes('T')) {
                const parts = s.date.split('T');
                dStr = parts[0];
                if (parts[1]) tStr = parts[1].substring(0, 5);
            } else {
                dStr = s.date;
            }
        }

        if (!dStr) return;

        const itemId = s.id || `serv-${dStr}-${tStr}`;
        if (!idsVistos.has(itemId)) {
            idsVistos.add(itemId);
            itens.push({
                id: itemId,
                tipo: 'culto',
                title: s.title || 'Culto de Adoração',
                dateIso: dStr,
                timeStr: tStr,
                location: pn.location || s.location || 'Templo Principal',
                description: pn.description || s.description || 'Programação de culto da igreja.'
            });
        }
    });

    // 2. Fallback de cultos formatados da planilha se não houver no banco
    if (itens.length === 0 && window.dadosGlobais?.cultos) {
        window.dadosGlobais.cultos.forEach(row => {
            if (Array.isArray(row) && row[0]) {
                const match = String(row[0]).match(/^(\d{2})\/(\d{2})/);
                if (match) {
                    const dStr = `${anoAtualAgenda}-${match[2]}-${match[1]}`;
                    const cId = row[8] || `culto-row-${dStr}`;
                    if (!idsVistos.has(cId)) {
                        idsVistos.add(cId);
                        itens.push({
                            id: cId,
                            tipo: 'culto',
                            title: row[0],
                            dateIso: dStr,
                            timeStr: '19:30',
                            location: 'Templo Principal',
                            description: 'Culto de Adoração'
                        });
                    }
                }
            }
        });
    }

    // 3. Eventos locais / cadastrados
    const eventos = obterEventosIgreja();
    eventos.forEach(evt => {
        if (!evt.date) return;
        const dStr = evt.date.includes('T') ? evt.date.split('T')[0] : evt.date;
        const tStr = evt.time || '19:30';
        const evtId = evt.id || `evt-${dStr}-${tStr}`;

        if (!idsVistos.has(evtId)) {
            idsVistos.add(evtId);
            itens.push({
                id: evtId,
                tipo: evt.is_service ? 'culto' : 'evento',
                title: evt.title || 'Evento da Igreja',
                dateIso: dStr,
                timeStr: tStr,
                location: evt.location || 'Templo Principal',
                description: evt.description || ''
            });
        }
    });

    // Ordenar cronologicamente
    itens.sort((a, b) => {
        const dtA = `${a.dateIso}T${a.timeStr || '00:00'}`;
        const dtB = `${b.dateIso}T${b.timeStr || '00:00'}`;
        return dtA.localeCompare(dtB);
    });

    return itens;
}

/**
 * Abre o modal de exportação para calendário
 * @param {string|null} preSelectedId ID de culto/evento específico (opcional)
 */
function abrirModalExportarCalendario(preSelectedId = null) {
    const modal = document.getElementById('modal-exportar-calendario');
    if (!modal) return;

    itemPreSelecionadoExportId = preSelectedId;
    periodoExportacaoAtual = preSelectedId ? 'todos' : '30d';

    // Atualizar botões de filtro
    atualizarBotoesFiltroPeriodo();

    // Carregar e renderizar itens
    renderizarItensModalExportacao();

    modal.classList.remove('hidden');
}

/**
 * Fecha o modal de exportação
 */
function fecharModalExportarCalendario() {
    const modal = document.getElementById('modal-exportar-calendario');
    if (modal) modal.classList.add('hidden');
    itemPreSelecionadoExportId = null;
}

/**
 * Altera o período do filtro de exportação
 */
function mudarPeriodoExportacao(periodo) {
    periodoExportacaoAtual = periodo;
    itemPreSelecionadoExportId = null;
    atualizarBotoesFiltroPeriodo();
    renderizarItensModalExportacao();
}

function atualizarBotoesFiltroPeriodo() {
    const periodos = ['30d', 'mes', '90d', 'todos'];
    periodos.forEach(p => {
        const btn = document.getElementById(`btn-periodo-${p}`);
        if (!btn) return;
        if (p === periodoExportacaoAtual) {
            btn.className = 'btn-filtro-export px-2.5 py-1 text-xs font-semibold rounded-lg bg-indigo-600 text-white transition shadow-sm';
        } else {
            btn.className = 'btn-filtro-export px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 transition';
        }
    });
}

/**
 * Alterna exibição do container de opções de lembretes
 */
function alternarVisualizacaoLembretesExport() {
    const checkbox = document.getElementById('export-lembrete-ativo');
    const container = document.getElementById('container-opcoes-lembrete');
    if (!container || !checkbox) return;
    if (checkbox.checked) {
        container.classList.remove('hidden');
    } else {
        container.classList.add('hidden');
    }
}

/**
 * Filtra e renderiza os itens no modal de exportação
 */
function renderizarItensModalExportacao() {
    const container = document.getElementById('lista-itens-exportar-calendario');
    if (!container) return;

    const todosItens = obterTodosItensProgramacao();
    const filtroTipo = document.getElementById('filtro-tipo-exportacao')?.value || 'todos';

    // Determinar limites de data
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const hojeStr = hoje.toISOString().split('T')[0];

    let limiteFim = null;
    let mesFiltroStr = null;

    if (periodoExportacaoAtual === '30d') {
        const dFim = new Date(hoje);
        dFim.setDate(dFim.getDate() + 30);
        limiteFim = dFim.toISOString().split('T')[0];
    } else if (periodoExportacaoAtual === 'mes') {
        const mesFmt = String(mesAtualAgenda + 1).padStart(2, '0');
        mesFiltroStr = `${anoAtualAgenda}-${mesFmt}`;
    } else if (periodoExportacaoAtual === '90d') {
        const dFim = new Date(hoje);
        dFim.setDate(dFim.getDate() + 90);
        limiteFim = dFim.toISOString().split('T')[0];
    }

    // Filtrar itens
    const itensFiltrados = todosItens.filter(item => {
        // Filtro de tipo
        if (filtroTipo === 'cultos' && item.tipo !== 'culto') return false;
        if (filtroTipo === 'eventos' && item.tipo !== 'evento') return false;

        // Se veio de um clique em item pré-selecionado específico
        if (itemPreSelecionadoExportId) {
            return item.id === itemPreSelecionadoExportId;
        }

        // Filtro de data: apenas de hoje em diante (não exportar passado por padrão)
        if (item.dateIso < hojeStr) return false;

        if (mesFiltroStr) {
            return item.dateIso.startsWith(mesFiltroStr);
        }

        if (limiteFim) {
            return item.dateIso <= limiteFim;
        }

        return true;
    });

    itensExportacaoCarregados = itensFiltrados;

    if (itensFiltrados.length === 0) {
        container.innerHTML = `
            <div class="text-center py-8 space-y-2">
                <span class="text-3xl">🗓️</span>
                <p class="text-xs font-semibold text-slate-300">Nenhum culto ou evento encontrado neste período.</p>
                <p class="text-[11px] text-slate-500">Tente selecionar outro período acima ou cadastre novos eventos.</p>
            </div>
        `;
        atualizarContadorSelecaoExportacao();
        return;
    }

    const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

    container.innerHTML = itensFiltrados.map((item, idx) => {
        const [ano, mes, dia] = item.dateIso.split('-');
        const dObj = new Date(parseInt(ano), parseInt(mes) - 1, parseInt(dia));
        const diaSemana = diasSemana[dObj.getDay()] || '';
        const dataFmt = `${dia}/${mes}/${ano}`;

        const isChecked = true; // Selecionado por padrão

        const isCulto = item.tipo === 'culto';
        const badgeCor = isCulto ? 'bg-cyan-950 text-cyan-300 border-cyan-800/80' : 'bg-purple-950 text-purple-300 border-purple-800/80';
        const badgeTexto = isCulto ? '⛪ Culto' : '🎉 Evento';

        return `
            <label class="flex items-start gap-3 p-2.5 rounded-xl border border-slate-800 bg-slate-900 hover:border-slate-700 transition cursor-pointer select-none">
                <input type="checkbox" value="${item.id}" ${isChecked ? 'checked' : ''} onchange="atualizarContadorSelecaoExportacao()"
                    class="check-item-export mt-1 w-4 h-4 rounded text-indigo-600 bg-slate-950 border-slate-700 focus:ring-indigo-500">
                <div class="min-w-0 flex-1 space-y-1">
                    <div class="flex items-center gap-2 flex-wrap">
                        <span class="text-[9px] px-1.5 py-0.5 rounded font-bold border ${badgeCor}">${badgeTexto}</span>
                        <span class="text-xs font-bold text-white truncate">${item.title}</span>
                    </div>
                    <div class="flex items-center gap-2 text-[11px] text-slate-400">
                        <span>📅 <strong>${diaSemana}, ${dataFmt}</strong></span>
                        ${item.timeStr ? `<span>⏰ às <strong>${item.timeStr}</strong></span>` : ''}
                        ${item.location ? `<span class="truncate">📍 ${item.location}</span>` : ''}
                    </div>
                </div>
            </label>
        `;
    }).join('');

    const checkMaster = document.getElementById('check-exportar-todos');
    if (checkMaster) checkMaster.checked = true;

    atualizarContadorSelecaoExportacao();
}

/**
 * Marca ou desmarca todos os checkboxes da lista
 */
function alternarSelecaoTodosExportacao(marcado) {
    const checkboxes = document.querySelectorAll('.check-item-export');
    checkboxes.forEach(cb => cb.checked = marcado);
    atualizarContadorSelecaoExportacao();
}

/**
 * Retorna os itens atualmente selecionados
 */
function obterItensSelecionadosExport() {
    const checkboxes = document.querySelectorAll('.check-item-export:checked');
    const idsSelecionados = new Set(Array.from(checkboxes).map(cb => cb.value));
    return itensExportacaoCarregados.filter(it => idsSelecionados.has(it.id));
}

/**
 * Atualiza o contador de selecionados e visibilidade dos botões
 */
function atualizarContadorSelecaoExportacao() {
    const selecionados = obterItensSelecionadosExport();
    const totalVisiveis = itensExportacaoCarregados.length;

    const contadorEl = document.getElementById('contador-exportar-selecionados');
    if (contadorEl) {
        contadorEl.textContent = `${selecionados.length} de ${totalVisiveis} selecionados`;
    }

    const checkMaster = document.getElementById('check-exportar-todos');
    if (checkMaster) {
        checkMaster.checked = (totalVisiveis > 0 && selecionados.length === totalVisiveis);
        checkMaster.indeterminate = (selecionados.length > 0 && selecionados.length < totalVisiveis);
    }

    const btnExport = document.getElementById('btn-executar-exportacao-ics');
    if (btnExport) {
        btnExport.disabled = (selecionados.length === 0);
        if (selecionados.length === 0) {
            btnExport.classList.add('opacity-50', 'cursor-not-allowed');
        } else {
            btnExport.classList.remove('opacity-50', 'cursor-not-allowed');
        }
    }

    // Botão de Google Agenda Web (apenas quando 1 item estiver selecionado)
    const btnGoogleWeb = document.getElementById('btn-exportar-google-web');
    if (btnGoogleWeb) {
        if (selecionados.length === 1) {
            btnGoogleWeb.style.display = 'inline-flex';
        } else {
            btnGoogleWeb.style.display = 'none';
        }
    }
}

/**
 * Escapa strings para formato iCalendar RFC 5545
 */
function escaparTextoICS(texto) {
    if (!texto) return '';
    return String(texto)
        .replace(/\\/g, '\\\\')
        .replace(/;/g, '\\;')
        .replace(/,/g, '\\,')
        .replace(/\r\n|\n|\r/g, '\\n');
}

/**
 * Gera a string completa no formato iCalendar (.ics)
 */
function gerarConteudoICS(itens, configLembretes) {
    const agora = new Date();
    const dtstamp = agora.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const churchName = window.dadosGlobais?.church?.name || 'Igreja';
    const safeCalName = escaparTextoICS(`Agenda - ${churchName}`);

    const linhas = [];
    linhas.push('BEGIN:VCALENDAR');
    linhas.push('VERSION:2.0');
    linhas.push('PRODID:-//LouvorIDB//Liturge Agenda//PT-BR');
    linhas.push('CALSCALE:GREGORIAN');
    linhas.push('METHOD:PUBLISH');
    linhas.push(`X-WR-CALNAME:${safeCalName}`);
    linhas.push(`NAME:${safeCalName}`);
    linhas.push('X-WR-TIMEZONE:America/Sao_Paulo');

    for (const item of itens) {
        linhas.push('BEGIN:VEVENT');
        linhas.push(`UID:${item.id || Date.now()}-${Math.random().toString(36).substring(2, 7)}@liturge.app`);
        linhas.push(`DTSTAMP:${dtstamp}`);

        const [ano, mes, dia] = item.dateIso.split('-');

        if (item.timeStr && item.timeStr.includes(':')) {
            const [hora, min] = item.timeStr.split(':');
            const hNum = parseInt(hora, 10);
            const mNum = parseInt(min, 10);

            const dtStartStr = `${ano}${mes}${dia}T${String(hNum).padStart(2, '0')}${String(mNum).padStart(2, '0')}00`;

            // Duração padrão estimada de 2 horas
            const endHour = (hNum + 2) % 24;
            let endDay = dia;
            let endMonth = mes;
            let endYear = ano;
            if (hNum + 2 >= 24) {
                const dSeguinte = new Date(parseInt(ano), parseInt(mes) - 1, parseInt(dia) + 1);
                endYear = dSeguinte.getFullYear();
                endMonth = String(dSeguinte.getMonth() + 1).padStart(2, '0');
                endDay = String(dSeguinte.getDate()).padStart(2, '0');
            }
            const dtEndStr = `${endYear}${endMonth}${endDay}T${String(endHour).padStart(2, '0')}${String(mNum).padStart(2, '0')}00`;

            linhas.push(`DTSTART:${dtStartStr}`);
            linhas.push(`DTEND:${dtEndStr}`);
        } else {
            // Evento de dia inteiro
            linhas.push(`DTSTART;VALUE=DATE:${ano}${mes}${dia}`);
            const dSeguinte = new Date(parseInt(ano), parseInt(mes) - 1, parseInt(dia) + 1);
            const nextStr = `${dSeguinte.getFullYear()}${String(dSeguinte.getMonth() + 1).padStart(2, '0')}${String(dSeguinte.getDate()).padStart(2, '0')}`;
            linhas.push(`DTEND;VALUE=DATE:${nextStr}`);
        }

        const prefixo = item.tipo === 'culto' ? '⛪ ' : '🎉 ';
        linhas.push(`SUMMARY:${escaparTextoICS(prefixo + item.title)}`);

        let descFinal = item.description || '';
        if (item.tipo === 'culto') {
            descFinal = descFinal ? `${descFinal}\n\nCulto da igreja.` : 'Programação de culto da igreja.';
        }
        linhas.push(`DESCRIPTION:${escaparTextoICS(descFinal)}`);

        if (item.location) {
            linhas.push(`LOCATION:${escaparTextoICS(item.location)}`);
        }

        linhas.push('STATUS:CONFIRMED');

        // Adicionar Alarmes / Lembretes se habilitado
        if (configLembretes && configLembretes.ativo) {
            if (configLembretes.tempoPrincipal) {
                linhas.push('BEGIN:VALARM');
                linhas.push(`TRIGGER:${configLembretes.tempoPrincipal}`);
                linhas.push('ACTION:DISPLAY');
                linhas.push(`DESCRIPTION:${escaparTextoICS(`Lembrete: ${item.title}`)}`);
                linhas.push('END:VALARM');
            }
            if (configLembretes.tempoSegundo && configLembretes.tempoSegundo !== 'none') {
                linhas.push('BEGIN:VALARM');
                linhas.push(`TRIGGER:${configLembretes.tempoSegundo}`);
                linhas.push('ACTION:DISPLAY');
                linhas.push(`DESCRIPTION:${escaparTextoICS(`Lembrete Antecipado: ${item.title}`)}`);
                linhas.push('END:VALARM');
            }
        }

        linhas.push('END:VEVENT');
    }

    linhas.push('END:VCALENDAR');

    return linhas.join('\r\n');
}

/**
 * Executa a exportação do arquivo .ics para o celular ou download
 */
async function executarExportacaoCalendario() {
    const selecionados = obterItensSelecionadosExport();

    if (selecionados.length === 0) {
        if (typeof mostrarToast === 'function') mostrarToast('Selecione ao menos um culto ou evento para exportar.', 'aviso');
        return;
    }

    const btn = document.getElementById('btn-executar-exportacao-ics');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<span>⏳</span> Gerando Calendário...`;
    }

    try {
        const lembreteAtivo = document.getElementById('export-lembrete-ativo')?.checked || false;
        const tempoPrincipal = document.getElementById('export-lembrete-tempo')?.value || '-PT30M';
        const tempoSegundo = document.getElementById('export-lembrete-segundo')?.value || 'none';

        const configLembretes = {
            ativo: lembreteAtivo,
            tempoPrincipal,
            tempoSegundo
        };

        const icsContent = gerarConteudoICS(selecionados, configLembretes);

        const churchName = (window.dadosGlobais?.church?.name || 'igreja')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]/g, '-');
        const nomeArquivo = `agenda-${churchName}-${selecionados.length}-eventos.ics`;

        const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });

        // 1. PRIORIDADE NATIVA (App Android / Galaxy S24): Abre direto no app de Calendário (Samsung/Google Agenda)
        if (window.AndroidCalendar && typeof window.AndroidCalendar.abrirNoCalendarioNativo === 'function') {
            const abriuNativo = window.AndroidCalendar.abrirNoCalendarioNativo(icsContent, nomeArquivo);
            if (abriuNativo) {
                if (typeof mostrarToast === 'function') {
                    mostrarToast(`📅 Abrindo ${selecionados.length} evento(s) no seu Calendário...`, 'sucesso');
                }
                fecharModalExportarCalendario();
                return;
            }
        }

        // 2. Se suportar compartilhamento nativo com arquivo (smartphones modernos / iOS)
        if (navigator.canShare && typeof File !== 'undefined') {
            try {
                const file = new File([blob], nomeArquivo, { type: 'text/calendar;charset=utf-8' });
                if (navigator.canShare({ files: [file] })) {
                    await navigator.share({
                        files: [file],
                        title: 'Agenda da Igreja',
                        text: `${selecionados.length} cultos/eventos adicionados.`
                    });
                    if (typeof mostrarToast === 'function') {
                        mostrarToast('📲 Compartilhado com o calendário com sucesso!', 'sucesso');
                    }
                    fecharModalExportarCalendario();
                    return;
                }
            } catch (shareErr) {
                if (shareErr.name === 'AbortError') {
                    // Usuário cancelou a tela de compartilhamento
                    return;
                }
                console.warn('Web Share falhou, usando download padrão:', shareErr);
            }
        }

        // Fallback direto: download do arquivo .ics
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = nomeArquivo;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1500);

        if (typeof mostrarToast === 'function') {
            mostrarToast(`⬇️ ${selecionados.length} eventos exportados! Toque no arquivo para adicionar ao seu calendário.`, 'sucesso');
        }

        fecharModalExportarCalendario();

    } catch (err) {
        console.error('Erro na exportação de calendário:', err);
        if (typeof mostrarToast === 'function') mostrarToast('Erro ao exportar calendário: ' + err.message, 'erro');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = `<span>📲</span> Exportar para o Celular (.ics)`;
        }
    }
}

/**
 * Atalho para abrir evento individual diretamente no Google Agenda Web
 */
function abrirNoGoogleAgendaWeb() {
    const selecionados = obterItensSelecionadosExport();
    if (selecionados.length !== 1) {
        if (typeof mostrarToast === 'function') mostrarToast('Selecione exatamente 1 item para abrir no Google Agenda Web.', 'aviso');
        return;
    }

    const item = selecionados[0];
    const [ano, mes, dia] = item.dateIso.split('-');
    let dtStart = `${ano}${mes}${dia}`;
    let dtEnd = `${ano}${mes}${dia}`;

    if (item.timeStr && item.timeStr.includes(':')) {
        const [hora, min] = item.timeStr.split(':');
        const hNum = parseInt(hora, 10);
        const mNum = parseInt(min, 10);
        dtStart += `T${String(hNum).padStart(2, '0')}${String(mNum).padStart(2, '0')}00`;
        const endHour = (hNum + 2) % 24;
        dtEnd += `T${String(endHour).padStart(2, '0')}${String(mNum).padStart(2, '0')}00`;
    }

    const prefixo = item.tipo === 'culto' ? '⛪ ' : '🎉 ';
    const title = encodeURIComponent(prefixo + item.title);
    const details = encodeURIComponent(item.description || (item.tipo === 'culto' ? 'Culto da igreja.' : 'Evento da igreja.'));
    const location = encodeURIComponent(item.location || 'Templo Principal');

    const gcalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dtStart}/${dtEnd}&details=${details}&location=${location}`;
    window.open(gcalUrl, '_blank');
}

// Exportações Globais do Módulo de Exportação
window.abrirModalExportarCalendario = abrirModalExportarCalendario;
window.fecharModalExportarCalendario = fecharModalExportarCalendario;
window.mudarPeriodoExportacao = mudarPeriodoExportacao;
window.alternarVisualizacaoLembretesExport = alternarVisualizacaoLembretesExport;
window.renderizarItensModalExportacao = renderizarItensModalExportacao;
window.alternarSelecaoTodosExportacao = alternarSelecaoTodosExportacao;
window.atualizarContadorSelecaoExportacao = atualizarContadorSelecaoExportacao;
window.executarExportacaoCalendario = executarExportacaoCalendario;
window.abrirNoGoogleAgendaWeb = abrirNoGoogleAgendaWeb;
