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
            <div class="bg-slate-900 border border-slate-800 p-3.5 rounded-xl space-y-2 hover:border-slate-700 transition">
                <div class="flex items-start justify-between gap-2">
                    <div>
                        <h4 class="text-sm font-bold text-white">${evt.title}</h4>
                        <p class="text-xs text-brand-400 font-medium">📅 ${dataFmt} ${evt.time ? `às ${evt.time}` : ''}</p>
                    </div>
                    ${podeEditar ? `
                        <div class="flex items-center gap-1">
                            <button onclick="abrirModalEventoAdmin('${evt.id}')" class="text-slate-400 hover:text-white p-1 text-xs">✏️</button>
                            <button onclick="excluirEventoAgenda('${evt.id}')" class="text-slate-400 hover:text-red-400 p-1 text-xs">🗑️</button>
                        </div>
                    ` : ''}
                </div>
                ${evt.location ? `<p class="text-xs text-slate-400 flex items-center gap-1">📍 <span>${evt.location}</span></p>` : ''}
                ${evt.description ? `<p class="text-xs text-slate-300 border-t border-slate-800/80 pt-1.5">${evt.description}</p>` : ''}
            </div>
        `;
    }).join('');
}

/**
 * Abre o modal pop-up de detalhes do dia clicado
 */
function abrirModalDetalhesDia(dataStr) {
    const modal = document.getElementById('modal-detalhes-dia-agenda');
    if (!modal) return;

    const parts = dataStr.split('-');
    const dataFmt = `${parts[2]}/${parts[1]}/${parts[0]}`;

    document.getElementById('titulo-modal-dia-agenda').textContent = `📅 Programação de ${dataFmt}`;

    const eventos = obterEventosIgreja().filter(e => e.date === dataStr || (e.date && e.date.startsWith(dataStr)));
    const cultosArray = window.dadosGlobais?.servicesDataList || window.dadosGlobais?.cultos || [];
    const cultos = cultosArray.filter(c => {
        if (c.date && c.date.startsWith(dataStr)) return true;
        if (Array.isArray(c) && c[0]) {
            const match = String(c[0]).match(/^(\d{2})\/(\d{2})/);
            if (match && `${parts[0]}-${match[2]}-${match[1]}` === dataStr) return true;
        }
        return false;
    });

    const containerConteudo = document.getElementById('conteudo-detalhes-dia-agenda');
    if (!containerConteudo) return;

    if (eventos.length === 0 && cultos.length === 0) {
        containerConteudo.innerHTML = `
            <div class="text-center py-8 space-y-2">
                <span class="text-3xl">☕</span>
                <p class="text-sm font-semibold text-slate-300">Nenhuma programação nesta data.</p>
                <p class="text-xs text-slate-500">Não há cultos ou eventos registrados para este dia.</p>
            </div>
        `;
    } else {
        let html = '';

        if (cultos.length > 0) {
            html += `<h4 class="text-xs font-bold text-cyan-400 uppercase tracking-wider mb-2">⛪ Cultos Agendados</h4>`;
            cultos.forEach(c => {
                html += `
                    <div class="bg-slate-900 border border-slate-800 p-3.5 rounded-xl space-y-1 mb-3">
                        <p class="text-sm font-bold text-white">${c.title || c.nome || 'Culto de Adoração'}</p>
                        <p class="text-xs text-slate-400">📅 Data: ${dataFmt}</p>
                    </div>
                `;
            });
        }

        if (eventos.length > 0) {
            html += `<h4 class="text-xs font-bold text-purple-400 uppercase tracking-wider mb-2 mt-4">🎉 Eventos Especiais</h4>`;
            eventos.forEach(e => {
                html += `
                    <div class="bg-slate-900 border border-slate-800 p-3.5 rounded-xl space-y-2 mb-3">
                        <div class="flex items-center justify-between">
                            <p class="text-sm font-bold text-white">${e.title}</p>
                            ${e.time ? `<span class="text-xs bg-purple-950 text-purple-300 border border-purple-800 px-2 py-0.5 rounded-md font-semibold">${e.time}</span>` : ''}
                        </div>
                        ${e.location ? `<p class="text-xs text-slate-400 flex items-center gap-1">📍 <span>${e.location}</span></p>` : ''}
                        ${e.description ? `<p class="text-xs text-slate-300 border-t border-slate-800 pt-2">${e.description}</p>` : ''}
                    </div>
                `;
            });
        }

        containerConteudo.innerHTML = html;
    }

    modal.classList.remove('hidden');
}

function fecharModalDetalhesDia() {
    document.getElementById('modal-detalhes-dia-agenda')?.classList.add('hidden');
}

/**
 * Modal de cadastro/edição de evento
 */
function abrirModalEventoAdmin(eventoId = null) {
    const modal = document.getElementById('modal-evento-admin');
    if (!modal) return;

    document.getElementById('evento-id').value = eventoId || '';
    document.getElementById('evento-titulo').value = '';
    document.getElementById('evento-data').value = new Date().toISOString().split('T')[0];
    document.getElementById('evento-hora').value = '19:30';
    document.getElementById('evento-local').value = '';
    document.getElementById('evento-descricao').value = '';

    if (eventoId) {
        const eventos = obterEventosIgreja();
        const evt = eventos.find(e => e.id === eventoId);
        if (evt) {
            document.getElementById('evento-titulo').value = evt.title || '';
            document.getElementById('evento-data').value = evt.date || '';
            document.getElementById('evento-hora').value = evt.time || '';
            document.getElementById('evento-local').value = evt.location || '';
            document.getElementById('evento-descricao').value = evt.description || '';
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
function salvarEventoAdmin(e) {
    if (e && e.preventDefault) e.preventDefault();

    const id = document.getElementById('evento-id').value;
    const title = document.getElementById('evento-titulo').value.trim();
    const date = document.getElementById('evento-data').value;
    const time = document.getElementById('evento-hora').value;
    const location = document.getElementById('evento-local').value.trim();
    const description = document.getElementById('evento-descricao').value.trim();

    if (!title || !date) {
        if (typeof mostrarToast === 'function') mostrarToast('Preencha o título e a data do evento.', 'aviso');
        return;
    }

    const userToEvaluate = (typeof modoSimulacaoPerfil !== 'undefined' ? modoSimulacaoPerfil : null) || (window.usuarioLogado || null);
    const churchId = userToEvaluate?.church_id || window.dadosGlobais?.church?.id || 'ae125cfd-96ef-4324-b1f0-f96a4f34eecf';

    let eventos = obterEventosIgreja();

    if (id) {
        const idx = eventos.findIndex(evt => evt.id === id);
        if (idx !== -1) {
            eventos[idx] = { ...eventos[idx], title, date, time, location, description };
        }
    } else {
        const novoEvento = {
            id: 'evt-' + Date.now(),
            church_id: churchId,
            title,
            date,
            time,
            location,
            description
        };
        eventos.push(novoEvento);
    }

    eventosMemoria = eventos;
    salvarEventosMemoria(churchId);

    fecharModalEventoAdmin();
    carregarAgenda();

    if (typeof mostrarToast === 'function') mostrarToast('Evento salvo com sucesso!', 'sucesso');
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
            <div class="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-2 hover:border-slate-700 transition">
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
                ${evt.description ? `<p class="text-xs text-slate-400 border-t border-slate-800/80 pt-2">${evt.description}</p>` : ''}
            </div>
        `;
    }).join('');
}

/**
 * Modal de Cultos Recorrentes
 */
function abrirModalCultoRecorrenteAdmin() {
    const modal = document.getElementById('modal-culto-recorrente-admin');
    if (modal) modal.classList.remove('hidden');
}

function fecharModalCultoRecorrenteAdmin() {
    const modal = document.getElementById('modal-culto-recorrente-admin');
    if (modal) modal.classList.add('hidden');
}

async function salvarCultoRecorrenteAdmin(e) {
    if (e && e.preventDefault) e.preventDefault();

    const nomeCulto = document.getElementById('recorrente-nome').value.trim();
    const diaSemana = parseInt(document.getElementById('recorrente-diasemana').value, 10);
    const horario = document.getElementById('recorrente-hora').value || '19:00';
    const meses = parseInt(document.getElementById('recorrente-periodo').value, 10) || 3;

    if (!nomeCulto) {
        if (typeof mostrarToast === 'function') mostrarToast('Digite o nome do culto.', 'aviso');
        return;
    }

    const btn = document.getElementById('btn-salvar-recorrente');
    if (btn) { btn.disabled = true; btn.textContent = 'Gerando cultos...'; }

    try {
        const churchId = obterChurchIdAtual();
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

                datasCultos.push({
                    church_id: churchId,
                    title: titleStr,
                    date: dateIso
                });
            }
            curr.setDate(curr.getDate() + 1);
        }

        if (datasCultos.length === 0) {
            if (typeof mostrarToast === 'function') mostrarToast('Nenhum culto gerado para o período.', 'aviso');
            return;
        }

        if (supabaseClient) {
            const { error } = await supabaseClient.from('services').insert(datasCultos);
            if (error) throw error;
        }

        fecharModalCultoRecorrenteAdmin();
        if (typeof mostrarToast === 'function') mostrarToast(`🎉 ${datasCultos.length} cultos recorrentes criados com sucesso!`, 'sucesso');

        if (typeof carregarDados === 'function') {
            await carregarDados();
        } else if (typeof carregarAgenda === 'function') {
            carregarAgenda();
        }
    } catch(err) {
        console.error("Erro ao gerar cultos recorrentes:", err);
        if (typeof mostrarToast === 'function') mostrarToast('Erro ao criar cultos: ' + err.message, 'erro');
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = '🔄 Gerar Cultos Recorrentes'; }
    }
}

// Exportações globais
window.carregarAgenda = carregarAgenda;
window.navegarMesAgenda = navegarMesAgenda;
window.abrirModalDetalhesDia = abrirModalDetalhesDia;
window.fecharModalDetalhesDia = fecharModalDetalhesDia;
window.abrirModalEventoAdmin = abrirModalEventoAdmin;
window.fecharModalEventoAdmin = fecharModalEventoAdmin;
window.salvarEventoAdmin = salvarEventoAdmin;
window.excluirEventoAgenda = excluirEventoAgenda;
window.renderizarAdminListaEventos = renderizarAdminListaEventos;
window.abrirModalCultoRecorrenteAdmin = abrirModalCultoRecorrenteAdmin;
window.fecharModalCultoRecorrenteAdmin = fecharModalCultoRecorrenteAdmin;
window.salvarCultoRecorrenteAdmin = salvarCultoRecorrenteAdmin;
