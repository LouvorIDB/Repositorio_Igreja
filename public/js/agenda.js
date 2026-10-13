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
 * Formata data YYYY-MM-DD para string por extenso em português
 */
function formatarDataPorExtenso(dataStr) {
    if (!dataStr) return '';
    const parts = dataStr.split('-');
    if (parts.length !== 3) return dataStr;
    const ano = parseInt(parts[0], 10);
    const mes = parseInt(parts[1], 10) - 1;
    const dia = parseInt(parts[2], 10);
    const d = new Date(ano, mes, dia);
    const diasSemana = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
    const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    return `${diasSemana[d.getDay()]}, ${dia} de ${meses[mes]} de ${ano}`;
}

function obterIconeFuncaoAgenda(roleStr) {
    if (typeof extrairIconeFuncao === 'function') return extrairIconeFuncao(roleStr);
    const r = (roleStr || '').toLowerCase();
    if (r.includes('bateria')) return '🥁';
    if (r.includes('violao') || r.includes('violão') || r.includes('guitarra')) return '🎸';
    if (r.includes('baixo')) return '🎸';
    if (r.includes('teclado') || r.includes('piano')) return '🎹';
    if (r.includes('vocal') || r.includes('cantor') || r.includes('voz')) return '🎤';
    if (r.includes('midia') || r.includes('mídia') || r.includes('projec') || r.includes('slide')) return '💻';
    if (r.includes('som') || r.includes('audio') || r.includes('áudio') || r.includes('mesa')) return '🎛️';
    return '🎯';
}

/**
 * Atualiza o Hero Card da Agenda destacando a próxima escala do usuário logado
 */
function atualizarHeroAgenda() {
    const elIconeContainer = document.getElementById('agenda-hero-icone-container');
    const elBadge = document.getElementById('agenda-hero-badge');
    const elData = document.getElementById('agenda-hero-data');
    const elTitulo = document.getElementById('agenda-hero-titulo');
    const elDetalhe = document.getElementById('agenda-hero-detalhe');
    const btnNovoEvento = document.getElementById('btn-agenda-novo-evento');

    // Visibilidade do botão de novo evento para administradores/líderes
    if (btnNovoEvento) {
        const userToEvaluate = (typeof modoSimulacaoPerfil !== 'undefined' ? modoSimulacaoPerfil : null) || (window.usuarioLogado || null);
        const roleUsuario = userToEvaluate ? (userToEvaluate.system_role || userToEvaluate.role || 'membro') : 'visitante';
        const isLiderOuAdmin = (roleUsuario === 'admin' || roleUsuario === 'lider');
        btnNovoEvento.classList.toggle('hidden', !isLiderOuAdmin);
        if (isLiderOuAdmin) btnNovoEvento.classList.add('flex');
    }

    if (!elTitulo) return;

    const h = new Date();
    const hojeStr = `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}-${String(h.getDate()).padStart(2, '0')}`;

    const cultosArray = window.dadosGlobais?.servicesDataList || window.dadosGlobais?.services || window.dadosGlobais?.cultos || [];
    const eventos = obterEventosIgreja();
    const user = (typeof modoSimulacaoPerfil !== 'undefined' && modoSimulacaoPerfil) || window.usuarioLogado || null;

    // 1. Procurar a PRÓXIMA ESCALA do usuário logado (cultos a partir de hoje)
    let proximaEscala = null;
    let proximoCultoGeral = null;

    // Normaliza cultos futuros
    const cultosFuturos = [];
    cultosArray.forEach(c => {
        let dStr = '';
        let tStr = '19:00';
        let id = c.id || '';
        let title = c.title || '';

        if (c.date) {
            dStr = c.date.split('T')[0];
            if (c.date.includes('T')) tStr = c.date.split('T')[1].substring(0, 5);
        } else if (Array.isArray(c) && c[0]) {
            title = c[0];
            id = c[8] || 'culto-row';
            const match = String(c[0]).match(/^(\d{2})\/(\d{2})/);
            if (match) {
                const anoAtual = new Date().getFullYear();
                dStr = `${anoAtual}-${match[2]}-${match[1]}`;
            }
        }

        if (dStr && dStr >= hojeStr) {
            cultosFuturos.push({
                id,
                title,
                date: dStr,
                time: tStr,
                raw: c
            });
        }
    });

    cultosFuturos.sort((a, b) => a.date.localeCompare(b.date));

    // Verifica se usuário está escalado em algum culto futuro
    for (const c of cultosFuturos) {
        const check = verificarEscalaUsuarioNoCulto(c.raw, user);
        if (check.escalado && !proximaEscala) {
            proximaEscala = {
                ...c,
                funcoes: check.roles
            };
            break;
        }
    }

    if (cultosFuturos.length > 0) {
        proximoCultoGeral = cultosFuturos[0];
    }

    // Normaliza eventos futuros
    const eventosFuturos = eventos.filter(e => (e.date || '') >= hojeStr).sort((a, b) => a.date.localeCompare(b.date));
    const proximoEvento = eventosFuturos.length > 0 ? eventosFuturos[0] : null;

    if (proximaEscala) {
        // Usuário tem escala confirmada!
        const [ano, mes, dia] = proximaEscala.date.split('-').map(Number);
        const dataObj = new Date(ano, mes - 1, dia);
        const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
        const diaSemanaCurto = diasSemana[dataObj.getDay()] || '';
        const dataFmt = `${diaSemanaCurto}, ${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}`;
        const iconeRole = obterIconeFuncaoAgenda(proximaEscala.funcoes[0] || '');

        if (elIconeContainer) {
            elIconeContainer.innerHTML = iconeRole || '🎯';
            elIconeContainer.className = 'w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-2xl shrink-0 shadow-sm';
        }
        if (elBadge) {
            elBadge.textContent = 'Sua Próxima Escala';
            elBadge.className = 'text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30';
        }
        if (elData) {
            elData.textContent = `${dataFmt} • ${proximaEscala.time || '19:00'}`;
        }
        elTitulo.textContent = proximaEscala.title || 'Culto de Adoração';
        if (elDetalhe) {
            elDetalhe.textContent = `Sua função: ${proximaEscala.funcoes.join(', ')} • Fique atento aos ensaios e horários!`;
        }
    } else if (proximoCultoGeral) {
        // Próximo culto geral da igreja
        const [ano, mes, dia] = proximoCultoGeral.date.split('-').map(Number);
        const dataObj = new Date(ano, mes - 1, dia);
        const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
        const diaSemanaCurto = diasSemana[dataObj.getDay()] || '';
        const dataFmt = `${diaSemanaCurto}, ${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}`;

        if (elIconeContainer) {
            elIconeContainer.innerHTML = '⛪';
            elIconeContainer.className = 'w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 flex items-center justify-center text-2xl shrink-0 shadow-sm';
        }
        if (elBadge) {
            elBadge.textContent = 'Próximo Culto';
            elBadge.className = 'text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30';
        }
        if (elData) {
            elData.textContent = `${dataFmt} • ${proximoCultoGeral.time || '19:00'}`;
        }
        elTitulo.textContent = proximoCultoGeral.title || 'Culto de Adoração';
        if (elDetalhe) {
            elDetalhe.textContent = 'Você não possui escala marcada neste culto. Participe e adore conosco!';
        }
    } else if (proximoEvento) {
        // Próximo evento
        const [ano, mes, dia] = proximoEvento.date.split('-').map(Number);
        const dataObj = new Date(ano, mes - 1, dia);
        const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
        const diaSemanaCurto = diasSemana[dataObj.getDay()] || '';
        const dataFmt = `${diaSemanaCurto}, ${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}`;

        if (elIconeContainer) {
            elIconeContainer.innerHTML = '🎉';
            elIconeContainer.className = 'w-12 h-12 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-2xl shrink-0 shadow-sm';
        }
        if (elBadge) {
            elBadge.textContent = 'Próximo Evento';
            elBadge.className = 'text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30';
        }
        if (elData) {
            elData.textContent = `${dataFmt} ${proximoEvento.time ? `• ${proximoEvento.time}` : ''}`;
        }
        elTitulo.textContent = proximoEvento.title || 'Evento Especial';
        if (elDetalhe) {
            elDetalhe.textContent = proximoEvento.location ? `Local: ${proximoEvento.location}` : 'Fique atento aos comunicados da igreja!';
        }
    } else {
        // Nada agendado
        if (elIconeContainer) {
            elIconeContainer.innerHTML = '📅';
            elIconeContainer.className = 'w-12 h-12 rounded-2xl bg-brand-500/10 border border-brand-500/20 text-brand-600 dark:text-brand-400 flex items-center justify-center text-2xl shrink-0 shadow-sm';
        }
        if (elBadge) {
            elBadge.textContent = 'Programação Geral';
            elBadge.className = 'text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-brand-500/15 text-brand-600 dark:text-brand-400 border border-brand-500/30';
        }
        if (elData) {
            elData.textContent = 'Calendário Atualizado';
        }
        elTitulo.textContent = 'Nenhuma escala futura agendada';
        if (elDetalhe) {
            elDetalhe.textContent = 'Acompanhe as próximas divulgações de escalas e ensaios dos ministérios.';
        }
    }
}

/**
 * Carrega e renderiza a tela de agenda
 */
function carregarAgenda() {
    atualizarHeroAgenda();
    renderizarCalendario();
    renderizarListaEventosProximos();

    // Seleciona automaticamente o dia de hoje se nenhum dia estiver selecionado
    if (!window.diaSelecionadoAgendaStr) {
        const h = new Date();
        const hStr = `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}-${String(h.getDate()).padStart(2, '0')}`;
        selecionarDiaCalendario(hStr, false);
    } else {
        selecionarDiaCalendario(window.diaSelecionadoAgendaStr, false);
    }

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
 * Volta diretamente para o mês e dia de hoje
 */
function voltarParaMesAtualAgenda() {
    const h = new Date();
    mesAtualAgenda = h.getMonth();
    anoAtualAgenda = h.getFullYear();
    renderizarCalendario();
    const hStr = `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}-${String(h.getDate()).padStart(2, '0')}`;
    selecionarDiaCalendario(hStr);
}

/**
 * Verifica se um nome corresponde ao usuário (considerando acentos e variações de nome)
 */
function usuarioCorrespondeNome(nomeCandidato, nomeUsuario) {
    if (!nomeCandidato || !nomeUsuario) return false;
    const n1 = (typeof removerAcentos === 'function' ? removerAcentos(nomeCandidato) : String(nomeCandidato).toLowerCase()).trim();
    const n2 = (typeof removerAcentos === 'function' ? removerAcentos(nomeUsuario) : String(nomeUsuario).toLowerCase()).trim();
    if (!n1 || !n2) return false;
    if (n1 === n2) return true;

    const partes1 = n1.split(/\s+/).filter(Boolean);
    const partes2 = n2.split(/\s+/).filter(Boolean);

    // Se ambos têm primeiro e segundo nome coincidentes (ex: "João Marcos")
    if (partes1.length >= 2 && partes2.length >= 2) {
        if (partes1[0] === partes2[0] && partes1[1] === partes2[1]) {
            return true;
        }
    }

    // Se um é prefixo do outro por palavra completa (ex: "João Marcos" e "João Marcos Silva")
    if (n1.startsWith(n2 + ' ') || n2.startsWith(n1 + ' ')) {
        return true;
    }

    return false;
}

/**
 * Normaliza e formata o nome do instrumento / função para exibição
 */
function formatarNomeFuncaoEscala(raw) {
    if (!raw) return 'Escala';
    const norm = (typeof removerAcentos === 'function' ? removerAcentos(raw) : String(raw).toLowerCase()).trim();
    if (norm === 'bateria') return 'Bateria';
    if (norm === 'violao' || norm === 'violao 1' || norm === 'violao 2') return 'Violão';
    if (norm === 'baixo') return 'Baixo';
    if (norm === 'teclado') return 'Teclado';
    if (norm === 'guitarra' || norm === 'guitarra 1' || norm === 'guitarra 2') return 'Guitarra';
    if (norm.includes('vocal') || norm.includes('cantor') || norm.includes('voz')) return 'Vocal';
    if (norm.includes('som') || norm.includes('audio')) return 'Som';
    if (norm.includes('midia') || norm.includes('projecao') || norm.includes('slide')) return 'Mídia';
    if (norm.includes('iluminacao') || norm.includes('luz')) return 'Luz';
    if (norm.includes('transmissao') || norm.includes('live')) return 'Transmissão';
    if (norm.includes('recepcao')) return 'Recepção';
    return String(raw).charAt(0).toUpperCase() + String(raw).slice(1);
}

/**
 * Verifica se um usuário está escalado em um culto específico e retorna suas funções
 */
function verificarEscalaUsuarioNoCulto(service, userParam = null) {
    const resultado = {
        escalado: false,
        roles: []
    };

    if (!service) return resultado;

    // Se estiver simulando membro geral (sem escalas)
    if (typeof modoSimulacaoPerfil !== 'undefined' && modoSimulacaoPerfil && modoSimulacaoPerfil.key === 'membro') {
        return resultado;
    }

    const user = userParam || (
        (typeof modoSimulacaoPerfil !== 'undefined' && modoSimulacaoPerfil && (modoSimulacaoPerfil.id || modoSimulacaoPerfil.name))
            ? modoSimulacaoPerfil
            : (window.usuarioLogado || (typeof modoSimulacaoPerfil !== 'undefined' ? modoSimulacaoPerfil : null))
    );

    if (!user) return resultado;

    const userId = user.id || null;
    const userName = user.name || (typeof modoSimulacaoPerfil !== 'undefined' && modoSimulacaoPerfil?.label ? modoSimulacaoPerfil.label.replace(/^Voluntário - |^Líder - /, '') : '');

    const rolesSet = new Set();

    // 1. service_scales (relacional Supabase)
    if (Array.isArray(service.service_scales)) {
        service.service_scales.forEach(sc => {
            const scProfileId = sc.profile_id || sc.user_id || sc.profiles?.id;
            const scName = sc.profile_name || sc.profiles?.name;
            const matchId = userId && scProfileId && (scProfileId === userId);
            const matchName = userName && scName && usuarioCorrespondeNome(scName, userName);

            if (matchId || matchName) {
                const rName = sc.ministry_roles?.name || sc.role_name || sc.role || 'Ministério';
                rolesSet.add(formatarNomeFuncaoEscala(rName));
            }
        });
    }

    // 2. notes (JSON com escala de instrumentos e cantores)
    if (service.notes) {
        try {
            const pn = typeof service.notes === 'string' ? JSON.parse(service.notes) : service.notes;
            if (pn && typeof pn === 'object') {
                if (pn.escala && typeof pn.escala === 'object') {
                    Object.entries(pn.escala).forEach(([instKey, instVol]) => {
                        if (!instVol) return;
                        const matchId = userId && (instVol === userId);
                        const matchName = userName && usuarioCorrespondeNome(instVol, userName);
                        if (matchId || matchName) {
                            rolesSet.add(formatarNomeFuncaoEscala(instKey));
                        }
                    });
                }
                if (Array.isArray(pn.cantores)) {
                    pn.cantores.forEach(c => {
                        if (!c) return;
                        const matchId = userId && (c === userId);
                        const matchName = userName && usuarioCorrespondeNome(c, userName);
                        if (matchId || matchName) {
                            rolesSet.add('Vocal');
                        }
                    });
                }
            }
        } catch(e){}
    }

    // 3. singers_list / singers direto no service
    const directSingers = service.singers_list || service.singers || '';
    if (directSingers && userName) {
        const list = directSingers.split(',').map(x => x.trim()).filter(Boolean);
        if (list.some(c => usuarioCorrespondeNome(c, userName))) {
            rolesSet.add('Vocal');
        }
    }

    // 4. service_songs
    if (Array.isArray(service.service_songs) && userName) {
        service.service_songs.forEach(ss => {
            const ssSingers = ss.singers_list || ss.singers || '';
            if (ssSingers) {
                const list = ssSingers.split(',').map(x => x.trim()).filter(Boolean);
                if (list.some(c => usuarioCorrespondeNome(c, userName))) {
                    rolesSet.add('Vocal');
                }
            }
        });
    }

    // 5. Fallback da matriz dadosGlobais.cultos
    if (rolesSet.size === 0 && window.dadosGlobais?.cultos) {
        const row = window.dadosGlobais.cultos.find(r => Array.isArray(r) && (r[8] === service.id || (service.title && r[0] === service.title)));
        if (row) {
            if (row[5]) {
                try {
                    const esc = typeof row[5] === 'string' ? JSON.parse(row[5]) : row[5];
                    if (esc && typeof esc === 'object') {
                        Object.entries(esc).forEach(([instKey, instVol]) => {
                            if (!instVol) return;
                            const matchId = userId && (instVol === userId);
                            const matchName = userName && usuarioCorrespondeNome(instVol, userName);
                            if (matchId || matchName) {
                                rolesSet.add(formatarNomeFuncaoEscala(instKey));
                            }
                        });
                    }
                } catch(e){}
            }
            if (row[6] && userName) {
                const list = String(row[6]).split(',').map(x => x.trim()).filter(Boolean);
                if (list.some(c => usuarioCorrespondeNome(c, userName))) {
                    rolesSet.add('Vocal');
                }
            }
        }
    }

    if (rolesSet.size > 0) {
        resultado.escalado = true;
        resultado.roles = Array.from(rolesSet);
    }

    return resultado;
}

/**
 * Obtém se o usuário logado/simulado está escalado para um dia específico (YYYY-MM-DD)
 */
function obterEscalaUsuarioNoDia(dataStr, userParam = null) {
    const resultado = {
        escalado: false,
        funcoes: [],
        funcaoResumo: '',
        detalhesCultos: []
    };

    if (!userParam && typeof modoSimulacaoPerfil !== 'undefined' && modoSimulacaoPerfil && modoSimulacaoPerfil.key === 'membro') {
        return resultado;
    }

    const user = userParam || (
        (typeof modoSimulacaoPerfil !== 'undefined' && modoSimulacaoPerfil && (modoSimulacaoPerfil.id || modoSimulacaoPerfil.name))
            ? modoSimulacaoPerfil
            : (window.usuarioLogado || (typeof modoSimulacaoPerfil !== 'undefined' ? modoSimulacaoPerfil : null))
    );

    if (!user) return resultado;

    const cultosArray = window.dadosGlobais?.servicesDataList || window.dadosGlobais?.services || [];
    const cultosDoDia = cultosArray.filter(c => c.date && c.date.startsWith(dataStr));
    const cultosExaminados = new Set();

    cultosDoDia.forEach(s => {
        cultosExaminados.add(s.id);
        const check = verificarEscalaUsuarioNoCulto(s, user);
        if (check.escalado) {
            resultado.detalhesCultos.push({
                serviceId: s.id,
                serviceTitle: s.title || 'Culto',
                funcoes: check.roles
            });
            check.roles.forEach(f => {
                if (!resultado.funcoes.includes(f)) resultado.funcoes.push(f);
            });
        }
    });

    // Fallback matriz dadosGlobais.cultos caso o culto não esteja em services
    if (window.dadosGlobais?.cultos) {
        window.dadosGlobais.cultos.forEach(row => {
            if (!Array.isArray(row) || !row[0]) return;
            const match = String(row[0]).match(/^(\d{2})\/(\d{2})/);
            if (match) {
                const diaC = match[1];
                const mesC = match[2];
                const parts = dataStr.split('-');
                if (parts.length === 3 && parts[1] === mesC && parts[2] === diaC) {
                    const rowId = row[8] || 'culto-row';
                    if (!cultosExaminados.has(rowId)) {
                        const fakeService = { id: rowId, title: row[0], date: dataStr };
                        const check = verificarEscalaUsuarioNoCulto(fakeService, user);
                        if (check.escalado) {
                            resultado.detalhesCultos.push({
                                serviceId: rowId,
                                serviceTitle: row[0],
                                funcoes: check.roles
                            });
                            check.roles.forEach(f => {
                                if (!resultado.funcoes.includes(f)) resultado.funcoes.push(f);
                            });
                        }
                    }
                }
            }
        });
    }

    if (resultado.funcoes.length > 0) {
        resultado.escalado = true;
        if (resultado.funcoes.length === 1) {
            resultado.funcaoResumo = resultado.funcoes[0];
        } else {
            resultado.funcaoResumo = `${resultado.funcoes[0]} +${resultado.funcoes.length - 1}`;
        }
    }

    return resultado;
}

/**
 * Renderiza a grade do calendário mensal (Híbrido Mobile e Desktop)
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
    const cultosArray = window.dadosGlobais?.servicesDataList || window.dadosGlobais?.services || window.dadosGlobais?.cultos || [];

    // Primeiro dia do mês e total de dias
    const primeiroDia = new Date(anoAtualAgenda, mesAtualAgenda, 1).getDay();
    const totalDiasNoMes = new Date(anoAtualAgenda, mesAtualAgenda + 1, 0).getDate();
    const totalDiasMesAnterior = new Date(anoAtualAgenda, mesAtualAgenda, 0).getDate();

    const hoje = new Date();
    const hojeStr = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
    const diaSelecionado = window.diaSelecionadoAgendaStr || hojeStr;

    let html = '';

    // Dias do mês anterior (padding)
    for (let i = primeiroDia - 1; i >= 0; i--) {
        const diaNum = totalDiasMesAnterior - i;
        html += `
            <div class="bg-slate-100/40 dark:bg-slate-950/40 p-1 sm:p-2 border border-slate-100 dark:border-slate-800/40 min-h-[56px] sm:min-h-[78px] opacity-35 select-none rounded-xl">
                <span class="text-[11px] sm:text-xs font-semibold text-slate-400 dark:text-slate-600">${diaNum}</span>
            </div>
        `;
    }

    // Dias do mês atual
    for (let dia = 1; dia <= totalDiasNoMes; dia++) {
        const diaFormatted = String(dia).padStart(2, '0');
        const mesFormatted = String(mesAtualAgenda + 1).padStart(2, '0');
        const dataStr = `${anoAtualAgenda}-${mesFormatted}-${diaFormatted}`;

        const ehHoje = (dataStr === hojeStr);
        const ehSelecionado = (dataStr === diaSelecionado);

        // Filtra eventos e cultos do dia
        const evtsDoDia = eventos.filter(e => e.date === dataStr || (e.date && e.date.startsWith(dataStr)));
        const cultosDoDia = cultosArray.filter(c => {
            if (c.date && c.date.startsWith(dataStr)) return true;
            if (Array.isArray(c) && c[0]) {
                const match = String(c[0]).match(/^(\d{2})\/(\d{2})/);
                if (match && `${anoAtualAgenda}-${match[2]}-${match[1]}` === dataStr) return true;
            }
            return false;
        });

        // Escala do usuário para este dia
        const escalaInfo = obterEscalaUsuarioNoDia(dataStr);
        const estaEscalado = escalaInfo.escalado;

        // Estilização base do card do dia
        let bordaDia = 'border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-night-900/60 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:border-slate-300 dark:hover:border-slate-700';
        if (ehSelecionado) {
            bordaDia = 'ring-2 ring-brand-500 bg-brand-500/10 dark:bg-brand-500/20 border border-brand-500/60 shadow-sm';
        } else if (estaEscalado) {
            bordaDia = 'border-2 border-emerald-500/80 bg-emerald-500/5 dark:bg-emerald-950/30 hover:border-emerald-500 shadow-sm';
        } else if (ehHoje) {
            bordaDia = 'border-2 border-brand-500/80 bg-brand-500/5 dark:bg-brand-950/20';
        }

        html += `
            <div data-agenda-dia="${dataStr}" onclick="selecionarDiaCalendario('${dataStr}', true)" 
                class="p-1 sm:p-2 ${bordaDia} min-h-[56px] sm:min-h-[78px] rounded-xl transition cursor-pointer flex flex-col justify-between group relative overflow-hidden select-none active:scale-98">
                
                <div class="flex items-center justify-between gap-1 w-full">
                    <span class="text-xs sm:text-sm font-bold ${
                        estaEscalado 
                            ? 'text-emerald-700 dark:text-emerald-300' 
                            : (ehHoje ? 'text-brand-600 dark:text-brand-400 font-black' : 'text-slate-700 dark:text-slate-300')
                    }">${dia}</span>

                    ${estaEscalado ? `
                        <span class="inline-flex items-center gap-0.5 text-[8px] sm:text-[9px] font-black text-emerald-700 dark:text-emerald-300 bg-emerald-500/20 border border-emerald-500/40 px-1 py-0.2 rounded" title="Você está escalado neste dia!">
                            ⭐<span class="hidden sm:inline"> ESCALA</span>
                        </span>
                    ` : (ehHoje ? `
                        <span class="w-1.5 h-1.5 rounded-full bg-brand-500"></span>
                    ` : '')}
                </div>

                <!-- PONTOS INDICADORES COMPACTOS (MOBILE) -->
                <div class="flex md:hidden items-center justify-center gap-1 mt-1 flex-wrap">
                    ${estaEscalado ? `<span class="w-2 h-2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/80" title="Sua Escala"></span>` : ''}
                    ${cultosDoDia.length > 0 ? `<span class="w-2 h-2 rounded-full bg-amber-500" title="Culto da Igreja"></span>` : ''}
                    ${evtsDoDia.length > 0 ? `<span class="w-2 h-2 rounded-full bg-indigo-500" title="Evento Especial"></span>` : ''}
                </div>

                <!-- BADGES COMPLETOS (DESKTOP) -->
                <div class="hidden md:flex flex-col gap-1 mt-1">
                    ${estaEscalado ? `
                        <div class="text-[9.5px] bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 px-1.5 py-0.5 rounded truncate font-bold flex items-center gap-1 shadow-sm" title="Sua função: ${escalaInfo.funcoes.join(', ')}">
                            <span>⭐</span>
                            <span class="truncate">${escalaInfo.funcaoResumo}</span>
                        </div>
                    ` : ''}

                    ${cultosDoDia.slice(0, estaEscalado ? 0 : 1).map(() => `
                        <div class="text-[9.5px] bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded truncate font-medium">
                            ⛪ Culto
                        </div>
                    `).join('')}

                    ${evtsDoDia.slice(0, 1).map(e => `
                        <div class="text-[9.5px] bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 border border-indigo-500/30 px-1.5 py-0.5 rounded truncate font-medium">
                            📅 ${e.title}
                        </div>
                    `).join('')}

                    ${(evtsDoDia.length + (estaEscalado ? 0 : cultosDoDia.length)) > (estaEscalado ? 1 : 2) ? `
                        <span class="text-[8.5px] text-slate-400 font-semibold block text-right">+${(evtsDoDia.length + cultosDoDia.length) - (estaEscalado ? 1 : 2)} mais</span>
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
            <div class="bg-slate-100/40 dark:bg-slate-950/40 p-1 sm:p-2 border border-slate-100 dark:border-slate-800/40 min-h-[56px] sm:min-h-[78px] opacity-35 select-none rounded-xl">
                <span class="text-[11px] sm:text-xs font-semibold text-slate-400 dark:text-slate-600">${i}</span>
            </div>
        `;
    }

    elGrid.innerHTML = html;
}

/**
 * Seleciona um dia no calendário e atualiza o painel integrado de detalhes
 */
function selecionarDiaCalendario(dataStr, scrollParaPainel = true) {
    if (!dataStr) return;
    window.diaSelecionadoAgendaStr = dataStr;

    // Atualiza título e subtítulo
    const elTitulo = document.getElementById('painel-dia-selecionado-titulo');
    const elSubtitulo = document.getElementById('painel-dia-selecionado-subtitulo');
    const elConteudo = document.getElementById('painel-dia-selecionado-conteudo');
    const btnVerCompleto = document.getElementById('btn-abrir-modal-dia-completo');

    if (elTitulo) {
        elTitulo.textContent = formatarDataPorExtenso(dataStr);
    }

    // Obter dados do dia
    const cultosArray = window.dadosGlobais?.servicesDataList || window.dadosGlobais?.services || window.dadosGlobais?.cultos || [];
    const eventos = obterEventosIgreja();
    const userToEvaluate = (typeof modoSimulacaoPerfil !== 'undefined' ? modoSimulacaoPerfil : null) || (window.usuarioLogado || null);
    const roleUsuario = userToEvaluate ? (userToEvaluate.system_role || userToEvaluate.role || 'membro') : 'visitante';
    const isLiderOuAdmin = (roleUsuario === 'admin' || roleUsuario === 'lider');

    const cultosDoDia = cultosArray.filter(c => {
        if (c.date && c.date.startsWith(dataStr)) return true;
        if (Array.isArray(c) && c[0]) {
            const match = String(c[0]).match(/^(\d{2})\/(\d{2})/);
            if (match && `${anoAtualAgenda}-${match[2]}-${match[1]}` === dataStr) return true;
        }
        return false;
    });

    const evtsDoDia = eventos.filter(e => e.date === dataStr || (e.date && e.date.startsWith(dataStr)));
    const escalaInfo = obterEscalaUsuarioNoDia(dataStr);
    const totalItens = cultosDoDia.length + evtsDoDia.length;

    if (elSubtitulo) {
        if (totalItens === 0) {
            elSubtitulo.textContent = 'Nenhuma programação cadastrada para esta data';
        } else {
            const partesContagem = [];
            if (cultosDoDia.length > 0) partesContagem.push(`${cultosDoDia.length} culto${cultosDoDia.length > 1 ? 's' : ''}`);
            if (evtsDoDia.length > 0) partesContagem.push(`${evtsDoDia.length} evento${evtsDoDia.length > 1 ? 's' : ''}`);
            if (escalaInfo.escalado) partesContagem.push('⭐ Você está escalado');
            elSubtitulo.textContent = partesContagem.join(' • ');
        }
    }

    if (btnVerCompleto) {
        btnVerCompleto.classList.remove('hidden');
    }

    // Renderiza conteúdo dos cards
    if (elConteudo) {
        if (totalItens === 0) {
            elConteudo.innerHTML = `
                <div class="py-6 px-4 text-center rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 space-y-3">
                    <span class="text-3xl block">☕</span>
                    <div>
                        <h5 class="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300">Dia livre na programação</h5>
                        <p class="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Nenhum culto ou evento agendado para este dia.</p>
                    </div>
                </div>
            `;
        } else {
            let cardsHtml = '';

            // 1. Cultos do dia
            cultosDoDia.forEach(s => {
                const sId = s.id || (Array.isArray(s) ? s[8] : '');
                const sTitle = s.title || (Array.isArray(s) ? s[0] : 'Culto de Adoração');
                const timeStr = s.date && s.date.includes('T') ? s.date.split('T')[1].substring(0, 5) : (s.time || '19:00');
                const check = verificarEscalaUsuarioNoCulto(s, userToEvaluate);

                let sLoc = s.location || 'Templo Principal';
                if (s.notes) {
                    try {
                        const pn = typeof s.notes === 'string' ? JSON.parse(s.notes) : s.notes;
                        if (pn.location) sLoc = pn.location;
                    } catch(e) {}
                }

                cardsHtml += `
                    <div class="border ${check.escalado ? 'border-emerald-500/60 bg-emerald-500/5 dark:bg-emerald-950/20' : 'border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60'} rounded-xl p-3.5 space-y-3 transition shadow-sm">
                        
                        ${check.escalado ? `
                            <div class="flex items-center justify-between gap-2 bg-emerald-500/15 border border-emerald-500/30 rounded-lg px-2.5 py-1.5">
                                <div class="flex items-center gap-1.5 min-w-0">
                                    <span class="text-sm">⭐</span>
                                    <span class="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 truncate">
                                        Sua Função: <strong class="uppercase">${check.roles.join(', ')}</strong>
                                    </span>
                                </div>
                                <span class="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500 text-white shrink-0">
                                    Escalado
                                </span>
                            </div>
                        ` : ''}

                        <div class="flex items-start justify-between gap-3">
                            <div class="space-y-1 min-w-0">
                                <div class="flex items-center gap-1.5 flex-wrap">
                                    <span class="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                                        Culto
                                    </span>
                                    <span class="text-xs font-mono font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                        ⏰ ${timeStr}
                                    </span>
                                </div>
                                <h5 class="text-sm font-bold text-slate-900 dark:text-white truncate">
                                    ${sTitle}
                                </h5>
                                <p class="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 truncate">
                                    📍 <span>${sLoc}</span>
                                </p>
                            </div>

                            <div class="flex items-center gap-1.5 shrink-0">
                                <button type="button" onclick="irParaCultoDaAgenda('${sId}', '${sTitle.replace(/'/g, "\\'")}', '${dataStr}')"
                                    class="px-2.5 py-1.5 rounded-lg bg-brand-500 hover:bg-brand-400 text-night-950 text-xs font-bold transition flex items-center gap-1 cursor-pointer shadow-sm active:scale-95"
                                    title="Abrir este culto com lista de músicas e escalas">
                                    <span>Ver Culto</span>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            });

            // 2. Eventos do dia
            evtsDoDia.forEach(evt => {
                cardsHtml += `
                    <div class="border border-indigo-500/30 bg-indigo-500/5 dark:bg-indigo-950/20 rounded-xl p-3.5 space-y-3 transition shadow-sm">
                        <div class="flex items-start gap-3">
                            ${evt.image_url ? `
                                <img src="${evt.image_url}" alt="${evt.title}" class="w-14 h-14 rounded-lg object-cover border border-slate-200 dark:border-slate-800 shrink-0">
                            ` : ''}
                            <div class="space-y-1 min-w-0 flex-1">
                                <div class="flex items-center gap-1.5 flex-wrap">
                                    <span class="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 border border-indigo-500/30">
                                        Evento
                                    </span>
                                    ${evt.time ? `<span class="text-xs font-mono font-bold text-slate-500 dark:text-slate-400">⏰ ${evt.time}</span>` : ''}
                                </div>
                                <h5 class="text-sm font-bold text-slate-900 dark:text-white truncate">
                                    ${evt.title}
                                </h5>
                                ${evt.location ? `<p class="text-[11px] text-slate-500 dark:text-slate-400 truncate">📍 ${evt.location}</p>` : ''}
                                ${evt.description ? `<p class="text-[11px] text-slate-600 dark:text-slate-300 border-t border-slate-200 dark:border-slate-800 pt-1.5 line-clamp-2">${evt.description}</p>` : ''}
                            </div>
                        </div>

                        <div class="flex items-center justify-end gap-1.5 pt-1 border-t border-slate-200 dark:border-slate-800">
                            <button type="button" onclick="abrirModalExportarCalendario('${evt.id}')"
                                class="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium transition cursor-pointer flex items-center gap-1">
                                <span>📲 Sincronizar</span>
                            </button>
                        </div>
                    </div>
                `;
            });

            elConteudo.innerHTML = cardsHtml;
        }
    }

    // Atualiza a seleção visual dos dias no calendário
    const diasGrid = document.querySelectorAll('#grid-dias-calendario > [data-agenda-dia]');
    diasGrid.forEach(el => {
        const diaAttr = el.getAttribute('data-agenda-dia');
        if (diaAttr === dataStr) {
            el.classList.add('ring-2', 'ring-brand-500', 'bg-brand-500/10', 'dark:bg-brand-500/20', 'border-brand-500/60');
        } else {
            el.classList.remove('ring-2', 'ring-brand-500', 'bg-brand-500/10', 'dark:bg-brand-500/20', 'border-brand-500/60');
        }
    });

    // Em telas mobile, dá um scroll suave até o painel se solicitado
    if (scrollParaPainel && window.innerWidth < 1024) {
        const painel = document.getElementById('painel-dia-selecionado-container');
        if (painel) {
            painel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }
}

/**
 * Navega da Agenda diretamente para os detalhes do culto na aba Cultos
 */
function irParaCultoDaAgenda(serviceId, serviceTitle, serviceDate) {
    if (typeof mudarAba === 'function') {
        mudarAba('cultos');
    }

    if (!window.cultosProcessados || window.cultosProcessados.length === 0) {
        if (typeof mostrarToast === 'function') mostrarToast('Navegando para programação de cultos...', 'info');
        return;
    }

    let matchIndex = -1;

    // 1. Pelo ID
    if (serviceId) {
        matchIndex = window.cultosProcessados.findIndex(c => c.id === serviceId);
    }

    // 2. Pelo título
    if (matchIndex === -1 && serviceTitle) {
        const normTitle = serviceTitle.toLowerCase().trim();
        matchIndex = window.cultosProcessados.findIndex(c => {
            const cNome = (c.nome || '').toLowerCase().trim();
            const cRaw = (c.rawTitle || '').toLowerCase().trim();
            return cNome === normTitle || cRaw.includes(normTitle) || normTitle.includes(cNome);
        });
    }

    // 3. Pela data (DD/MM)
    if (matchIndex === -1 && serviceDate) {
        const parts = serviceDate.split('-');
        if (parts.length === 3) {
            const dataFmt = `${parts[2]}/${parts[1]}`;
            matchIndex = window.cultosProcessados.findIndex(c => c.dataStr === dataFmt);
        }
    }

    if (matchIndex !== -1 && typeof abrirDetalhesCulto === 'function') {
        abrirDetalhesCulto(matchIndex);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
        if (typeof mostrarToast === 'function') mostrarToast('Culto selecionado na programação.', 'info');
    }
}

/**
 * Abre o modal completo de detalhes para o dia selecionado atualmente
 */
function abrirModalDiaSelecionadoAtual() {
    const dataStr = window.diaSelecionadoAgendaStr || (() => {
        const h = new Date();
        return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}-${String(h.getDate()).padStart(2, '0')}`;
    })();
    abrirModalDetalhesDia(dataStr);
}

/**
 * Renderiza a lista lateral dos próximos eventos com estilo e contagem atualizados
 */
function renderizarListaEventosProximos() {
    const container = document.getElementById('lista-eventos-proximos');
    const badgeTotal = document.getElementById('badge-total-proximos-agenda');
    if (!container) return;

    const userToEvaluate = (typeof modoSimulacaoPerfil !== 'undefined' ? modoSimulacaoPerfil : null) || (window.usuarioLogado || null);
    const roleUsuario = userToEvaluate ? (userToEvaluate.system_role || userToEvaluate.role || 'membro') : 'visitante';
    const podeEditar = (roleUsuario === 'admin' || roleUsuario === 'lider');

    // 1. Eventos cadastrados
    const eventos = [...obterEventosIgreja()];

    // 2. Cultos marcados como evento ou onde o usuário está escalado
    const rawServices = window.dadosGlobais?.servicesDataList || window.dadosGlobais?.services || [];
    rawServices.forEach(s => {
        let pn = {};
        if (s.notes) {
            try { pn = typeof s.notes === 'string' ? JSON.parse(s.notes) : s.notes; } catch(e){}
        }

        const escalaCulto = verificarEscalaUsuarioNoCulto(s, userToEvaluate);

        if (pn.destaque_evento || pn.exibir_em_eventos || escalaCulto.escalado) {
            const dStr = s.date ? s.date.split('T')[0] : '';
            let tStr = '';
            if (s.date && s.date.includes('T')) {
                tStr = s.date.split('T')[1].substring(0, 5);
            }
            eventos.push({
                id: s.id,
                is_service: true,
                title: s.title || 'Culto de Adoração',
                date: dStr,
                time: tStr || '19:00',
                location: pn.location || s.location || 'Templo Principal',
                description: pn.description || s.description || '',
                user_escalado: escalaCulto.escalado,
                user_roles: escalaCulto.roles
            });
        }
    });

    const hObj = new Date();
    const anoH = hObj.getFullYear();
    const mesH = String(hObj.getMonth() + 1).padStart(2, '0');
    const diaH = String(hObj.getDate()).padStart(2, '0');
    const hojeStr = `${anoH}-${mesH}-${diaH}`;

    const proximos = eventos
        .filter(e => (e.date || '') >= hojeStr)
        .sort((a, b) => (a.date || '').localeCompare(b.date || ''));

    if (badgeTotal) {
        badgeTotal.textContent = proximos.length;
    }

    if (proximos.length === 0) {
        container.innerHTML = `
            <div class="text-center py-8 space-y-1">
                <span class="text-2xl block">🗓️</span>
                <p class="text-xs text-slate-500 dark:text-slate-400 italic">Nenhum evento futuro cadastrado.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = proximos.map(evt => {
        const parts = (evt.date || '').split('-');
        const dataFmt = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : evt.date;

        const acoesBtn = '';

        const isEscalado = !!evt.user_escalado;
        let cardBorda = 'border-slate-200 dark:border-slate-800 bg-white dark:bg-night-900/70';
        if (isEscalado) {
            cardBorda = 'border-emerald-500/60 bg-emerald-500/5 dark:bg-emerald-950/20 shadow-sm';
        } else if (evt.is_service) {
            cardBorda = 'border-amber-500/40 bg-amber-500/5 dark:bg-slate-900/90 shadow-sm';
        }

        return `
            <div class="border ${cardBorda} p-3 sm:p-3.5 rounded-xl space-y-2.5 hover:border-slate-300 dark:hover:border-slate-700 transition">
                ${evt.image_url ? `
                    <div class="rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-950">
                        <img src="${evt.image_url}" alt="${evt.title}" class="w-full max-h-36 object-cover hover:scale-105 transition duration-300">
                    </div>
                ` : ''}
                <div class="flex items-start justify-between gap-2">
                    <div class="space-y-1 min-w-0">
                        <div class="flex items-center gap-1.5 flex-wrap">
                            ${isEscalado ? `
                                <span class="text-[9px] bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/50 px-2 py-0.5 rounded font-bold uppercase tracking-wider flex items-center gap-1">
                                    ⭐ SUA ESCALA: ${(evt.user_roles || []).join(', ')}
                                </span>
                            ` : (evt.is_service ? '<span class="text-[9px] bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/40 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">🌟 CULTO</span>' : '<span class="text-[9px] bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-500/40 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">🎉 EVENTO</span>')}
                        </div>
                        <h4 class="text-sm font-bold text-slate-900 dark:text-white truncate">${evt.title}</h4>
                        <p class="text-xs text-brand-600 dark:text-brand-400 font-medium">📅 ${dataFmt} ${evt.time ? `às ${evt.time}` : ''}</p>
                    </div>
                    ${acoesBtn}
                </div>
                ${evt.location ? `<p class="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 truncate">📍 <span>${evt.location}</span></p>` : ''}
                ${evt.description ? `<p class="text-xs text-slate-600 dark:text-slate-300 border-t border-slate-200 dark:border-slate-800/80 pt-1.5 leading-relaxed line-clamp-2">${evt.description}</p>` : ''}
                
                ${evt.is_service ? `
                    <div class="pt-1">
                        <button type="button" onclick="irParaCultoDaAgenda('${evt.id}', '${evt.title.replace(/'/g, "\\'")}', '${evt.date}')"
                            class="w-full text-center py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-brand-500 hover:text-night-950 text-slate-700 dark:text-slate-300 text-xs font-semibold transition cursor-pointer">
                            Ver Programação do Culto ➔
                        </button>
                    </div>
                ` : ''}
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
        containerConteudo.innerHTML = `
            <div class="text-center py-8 space-y-2">
                <span class="text-3xl">☕</span>
                <p class="text-sm font-semibold text-slate-300">Nenhuma programação agendada</p>
                <p class="text-xs text-slate-500">Não há cultos ou eventos marcados para este dia.</p>
            </div>
        `;
    } else {
        // CENÁRIO B: JÁ EXISTEM ITENS NO DIA
        let html = '<div class="space-y-3">';
        html += `<p class="text-xs font-semibold text-slate-400">Programação agendada para este dia:</p>`;

        // Renderizar Cultos
        cultosDoDia.forEach(s => {
            const timeStr = s.date && s.date.includes('T') ? s.date.split('T')[1].substring(0, 5) : (s.time || '');

            let sLoc = s.location || '';
            if (!sLoc && s.notes) {
                try {
                    const pn = JSON.parse(s.notes);
                    if (pn.location) sLoc = pn.location;
                } catch(e) {}
            }

            // Verifica se o usuário logado/simulado está escalado neste culto
            const escalaCulto = verificarEscalaUsuarioNoCulto(s, userToEvaluate);
            const userEstaEscaladoNeste = escalaCulto.escalado;

            const cardBorda = userEstaEscaladoNeste
                ? 'border-2 border-emerald-500/80 bg-gradient-to-br from-emerald-950/30 via-slate-900 to-slate-900 shadow-md shadow-emerald-950/30'
                : 'border border-slate-700/80 hover:border-brand-500/80 bg-slate-900';

            html += `
                <div class="${cardBorda} p-3.5 rounded-xl flex flex-col gap-3 transition shadow-sm">
                    ${userEstaEscaladoNeste ? `
                        <div class="bg-emerald-500/15 border border-emerald-500/40 rounded-xl p-2.5 flex items-center justify-between gap-2">
                            <div class="flex items-center gap-2">
                                <span class="text-xl">⭐</span>
                                <div>
                                    <h5 class="text-xs font-bold text-emerald-300">Você está escalado neste culto!</h5>
                                    <p class="text-[11px] text-emerald-400 font-medium">Sua função: <strong class="text-emerald-200 uppercase font-bold">${escalaCulto.roles.join(', ')}</strong></p>
                                </div>
                            </div>
                            <span class="text-[10px] bg-emerald-500/30 text-emerald-200 border border-emerald-400/60 font-black px-2 py-0.5 rounded-full uppercase tracking-wider">Confirmado</span>
                        </div>
                    ` : ''}

                    <!-- Informações do Culto (Parte Superior - 100% visíveis) -->
                    <div class="space-y-1.5 min-w-0">
                        <div class="flex items-center gap-2 flex-wrap">
                            <span class="text-[10px] bg-brand-950 text-brand-400 border border-brand-800/80 px-2 py-0.5 rounded-md font-bold uppercase tracking-wider">⛪ Culto</span>
                            ${userEstaEscaladoNeste ? `
                                <span class="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-700/80 px-2 py-0.5 rounded-md font-bold uppercase tracking-wider">⭐ Sua Escala: ${escalaCulto.roles.join(', ')}</span>
                            ` : ''}
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
                    </div>
                </div>
            `;
        });

        html += `</div>`;
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
 * Visão Dedicada de cadastro/edição de evento no Admin (sem modal flutuante)
 */
function abrirEditorEventoAdmin(eventoId = null, dataStr = null) {
    const hub = document.getElementById('admin-cultos-eventos-hub');
    const visaoRecorrente = document.getElementById('admin-visao-recorrente-editor');
    const visaoEvento = document.getElementById('admin-visao-evento-editor');
    if (!visaoEvento) return;

    if (hub) hub.classList.add('hidden');
    if (visaoRecorrente) visaoRecorrente.classList.add('hidden');
    visaoEvento.classList.remove('hidden');

    const inpId = document.getElementById('evento-id');
    const inpTitulo = document.getElementById('evento-titulo');
    const inpData = document.getElementById('evento-data');
    const inpHora = document.getElementById('evento-hora');
    const inpLocal = document.getElementById('evento-local');
    const inpDesc = document.getElementById('evento-descricao');

    if (inpId) inpId.value = eventoId || '';
    if (inpTitulo) inpTitulo.value = '';
    if (inpData) inpData.value = dataStr || new Date().toISOString().split('T')[0];
    if (inpHora) inpHora.value = '19:30';
    if (inpLocal) inpLocal.value = '';
    if (inpDesc) inpDesc.value = '';
    removerImagemEvento();

    const tituloEl = document.getElementById('admin-evento-editor-titulo');

    if (eventoId) {
        const eventos = obterEventosIgreja();
        const evt = eventos.find(e => e.id === eventoId);
        if (evt) {
            if (tituloEl) tituloEl.innerHTML = `<span>🎉</span> Editar Evento: ${evt.title}`;
            if (inpTitulo) inpTitulo.value = evt.title || '';
            if (inpData) inpData.value = evt.date || '';
            if (inpHora) inpHora.value = evt.time || '';
            if (inpLocal) inpLocal.value = evt.location || '';
            if (inpDesc) inpDesc.value = evt.description || '';

            if (evt.image_url) {
                currentEventoImageUrl = evt.image_url;
                const inpImgUrl = document.getElementById('evento-imagem-url');
                if (inpImgUrl) inpImgUrl.value = evt.image_url;
                const img = document.getElementById('evento-imagem-preview');
                const container = document.getElementById('evento-imagem-preview-container');
                if (img && container) {
                    img.src = evt.image_url;
                    container.classList.remove('hidden');
                }
            }
        }
    } else {
        if (tituloEl) tituloEl.innerHTML = `<span>🎉</span> Cadastrar Evento Especial`;
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
}
window.abrirEditorEventoAdmin = abrirEditorEventoAdmin;

function fecharEditorEventoAdmin() {
    const visaoEvento = document.getElementById('admin-visao-evento-editor');
    const hub = document.getElementById('admin-cultos-eventos-hub');
    if (visaoEvento) visaoEvento.classList.add('hidden');
    if (hub) hub.classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}
window.fecharEditorEventoAdmin = fecharEditorEventoAdmin;

function abrirModalEventoAdmin(eventoId = null, dataStr = null) {
    abrirEditorEventoAdmin(eventoId, dataStr);
}
window.abrirModalEventoAdmin = abrirModalEventoAdmin;

function fecharModalEventoAdmin() {
    fecharEditorEventoAdmin();
}
window.fecharModalEventoAdmin = fecharModalEventoAdmin;

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
        if (typeof renderizarAdminCultosEventos === 'function') renderizarAdminCultosEventos();

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
    if (typeof renderizarAdminCultosEventos === 'function') renderizarAdminCultosEventos();
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

function navegarHojeAdmin() {
    const hoje = new Date();
    mesAtualAdmin = hoje.getMonth();
    anoAtualAdmin = hoje.getFullYear();
    const dataHojeStr = `${anoAtualAdmin}-${String(mesAtualAdmin + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
    window.adminDiaSelecionadoStr = dataHojeStr;
    renderizarAdminCultosEventos();
}
window.navegarHojeAdmin = navegarHojeAdmin;

async function renderizarAdminCultosEventos() {
    const containerMain = document.getElementById('calendario-admin-container');
    if (!containerMain) return;

    // Atualiza label do mês
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

        let bgClass = "bg-night-950 border-slate-800/80 hover:border-liturge-500/50 cursor-pointer transition text-slate-300";
        let indicator = "";

        if (temCulto) {
            bgClass = "bg-liturge-500/10 border-liturge-500/40 hover:bg-liturge-500/20 cursor-pointer transition text-white font-bold shadow-sm";
            if (totalNoDia > 1) {
                indicator += `<span class="block w-2 h-2 rounded-full bg-purple-400 mt-1"></span><span class="block w-2 h-2 rounded-full bg-liturge-400 glow-node mt-1"></span>`;
            } else {
                indicator += `<span class="block w-2 h-2 rounded-full bg-liturge-400 glow-node mt-1 mx-auto"></span>`;
            }
        }

        const isSelected = (window.adminDiaSelecionadoStr === dataStr);
        const borderSelectedClass = isSelected ? "ring-2 ring-liturge-500 border-liturge-400 shadow-md" : "";

        // Ao clicar em uma data no calendário do admin, seleciona o dia e renderiza os cards no painel lateral sem popup modal
        const acaoClique = `selecionarDiaCalendarioAdmin('${dataStr}')`;

        html += `
            <div data-admin-dia-cell="${dataStr}" onclick="${acaoClique}" class="rounded-xl p-2 border flex flex-col items-center justify-center min-h-[52px] ${bgClass} ${borderSelectedClass}">
                <span class="text-sm font-semibold">${d}</span>
                <div class="flex gap-1">${indicator}</div>
            </div>
        `;
    }

    html += `</div>`;
    containerMain.innerHTML = html;

    // Garantir que um dia esteja selecionado no mês atual
    const prefixoMes = `${anoAtualAdmin}-${String(mesAtualAdmin + 1).padStart(2, '0')}`;
    if (!window.adminDiaSelecionadoStr || !window.adminDiaSelecionadoStr.startsWith(prefixoMes)) {
        const hoje = new Date();
        const hojeStr = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
        if (hojeStr.startsWith(prefixoMes)) {
            window.adminDiaSelecionadoStr = hojeStr;
        } else {
            window.adminDiaSelecionadoStr = `${prefixoMes}-01`;
        }
    }
    selecionarDiaCalendarioAdmin(window.adminDiaSelecionadoStr);

    // Atualiza barras laterais
    renderizarEventosLateral(todosServicosEEventos);
    carregarE_RenderizarCultosRecorrentes();
    if (typeof carregarMesAtivoUI === 'function') carregarMesAtivoUI();
}

/**
 * Seleciona um dia no calendário do Admin e atualiza o painel lateral com cards compactos
 */
function selecionarDiaCalendarioAdmin(dataStr) {
    window.adminDiaSelecionadoStr = dataStr;
    renderizarDetalhesDiaAdmin(dataStr);
    
    // Atualiza anel visual de seleção no calendário
    const container = document.getElementById('calendario-admin-container');
    if (container) {
        container.querySelectorAll('[data-admin-dia-cell]').forEach(cell => {
            if (cell.getAttribute('data-admin-dia-cell') === dataStr) {
                cell.classList.add('ring-2', 'ring-liturge-500', 'border-liturge-400', 'shadow-md');
            } else {
                cell.classList.remove('ring-2', 'ring-liturge-500', 'border-liturge-400', 'shadow-md');
            }
        });
    }
}
window.selecionarDiaCalendarioAdmin = selecionarDiaCalendarioAdmin;

/**
 * Renderiza os cards compactos dos cultos e eventos do dia selecionado
 */
function renderizarDetalhesDiaAdmin(dataStr) {
    const tituloEl = document.getElementById('admin-detalhe-dia-titulo');
    const container = document.getElementById('admin-detalhe-dia-lista');
    if (!container) return;

    if (!dataStr) {
        if (tituloEl) tituloEl.textContent = 'Selecione um dia no calendário';
        container.innerHTML = '<p class="text-xs text-slate-500 text-center py-6">Nenhum dia selecionado.</p>';
        return;
    }

    const parts = dataStr.split('-');
    if (parts.length !== 3) return;
    const ano = parseInt(parts[0], 10);
    const mes = parseInt(parts[1], 10);
    const dia = parseInt(parts[2], 10);
    const dateObj = new Date(ano, mes - 1, dia);
    const diasSemana = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
    const diaSemana = diasSemana[dateObj.getDay()] || '';
    const dataFmt = `${parts[2]}/${parts[1]}/${parts[0]}`;
    const tagDiaMes = `${parts[2]}/${parts[1]}`;

    if (tituloEl) {
        tituloEl.textContent = `${diaSemana}, ${dataFmt}`;
    }

    // 1. Obter cultos do dia
    const rawServices = window.dadosGlobais?.services || [];
    let cultosDoDia = rawServices.filter(s => s.date && s.date.startsWith(dataStr));

    // Fallback cultos do array tabular
    const rowsCultos = window.dadosGlobais?.cultos || [];
    let blocosCultosTabular = [];
    if (window.cultosProcessados && window.cultosProcessados.length > 0) {
        blocosCultosTabular = window.cultosProcessados.filter(c => c.dataStr === tagDiaMes || (c.nome && c.nome.includes(tagDiaMes)));
    } else {
        for (let i = 0; i < rowsCultos.length; i++) {
            const col0 = rowsCultos[i][0] ? String(rowsCultos[i][0]) : '';
            if ((col0.includes('CULTO DE') || col0.includes('CULTO ')) && col0.includes(tagDiaMes)) {
                blocosCultosTabular.push({
                    startIndex: i,
                    serviceId: rowsCultos[i][8] || null,
                    nome: col0,
                    dataStr: tagDiaMes,
                    horario: rowsCultos[i][5] || '19:00',
                    songs: [],
                    escala: []
                });
            }
        }
    }

    // 2. Obter eventos do dia
    const todosEventos = typeof obterEventosIgreja === 'function' ? obterEventosIgreja() : [];
    const evtsDoDia = todosEventos.filter(e => e.date === dataStr || (e.date && e.date.startsWith(dataStr)));

    let html = '';

    // Renderizar Cultos do Dia
    if (blocosCultosTabular.length > 0) {
        blocosCultosTabular.forEach(c => {
            const nomeLimpo = (c.nome || 'Culto de Louvor').replace(/ - OCULTO/i, '').replace(/ - EM MONTAGEM/i, '').trim();
            const numMusicas = c.songs ? c.songs.length : 0;
            const numEscalados = c.escala ? c.escala.length : 0;
            const horario = c.horario || '19:00';
            const sId = c.serviceId || (c.startIndex !== null && rowsCultos[c.startIndex] ? rowsCultos[c.startIndex][8] : '');

            html += `
                <div class="bg-night-950 border border-slate-800 hover:border-liturge-500/50 rounded-2xl p-3.5 shadow-sm transition space-y-2.5">
                    <div class="flex items-start justify-between gap-2.5">
                        <div class="flex items-center gap-2.5 min-w-0">
                            <div class="w-8 h-8 rounded-xl bg-liturge-500/15 border border-liturge-500/30 text-liturge-400 flex items-center justify-center text-base shrink-0 font-bold">
                                ⛪
                            </div>
                            <div class="min-w-0">
                                <span class="text-[10px] font-bold uppercase tracking-wider text-liturge-400 block leading-tight">Culto de Louvor</span>
                                <h4 class="text-xs sm:text-sm font-bold text-white truncate max-w-[200px]" title="${nomeLimpo}">${nomeLimpo}</h4>
                            </div>
                        </div>
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-night-900 border border-slate-800 text-slate-300 shrink-0">
                            ${horario}
                        </span>
                    </div>

                    <div class="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-400">
                        ${numMusicas > 0 ? `<span class="bg-night-900 px-2 py-0.5 rounded-lg border border-slate-800 text-slate-300">🎵 ${numMusicas} ${numMusicas === 1 ? 'música' : 'músicas'}</span>` : ''}
                        ${numEscalados > 0 ? `<span class="bg-night-900 px-2 py-0.5 rounded-lg border border-slate-800 text-slate-300">👥 ${numEscalados} escalados</span>` : ''}
                        <span class="bg-night-900 px-2 py-0.5 rounded-lg border border-slate-800 text-slate-400">📍 Templo Principal</span>
                    </div>

                    <div class="flex items-center justify-end gap-2 pt-2 border-t border-slate-800/80">
                        <button type="button" onclick="abrirEditorCultoAdmin(${c.startIndex})"
                            class="px-3 py-1.5 rounded-xl bg-night-900 hover:bg-slate-800 text-slate-200 hover:text-white border border-slate-700/80 text-xs font-semibold flex items-center gap-1 transition cursor-pointer">
                            <span>✏️</span> Editar
                        </button>
                        <button type="button" onclick="confirmarExcluirCultoAdmin(${c.startIndex}, '${sId}')"
                            class="px-2.5 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs font-semibold flex items-center gap-1 transition cursor-pointer" title="Excluir culto">
                            <span>🗑️</span>
                        </button>
                    </div>
                </div>
            `;
        });
    } else if (cultosDoDia.length > 0) {
        cultosDoDia.forEach(s => {
            const idx = (rowsCultos || []).findIndex(row => row[8] === s.id);
            let horario = s.time || '19:00';
            if (s.date && s.date.includes('T')) {
                const hPart = s.date.split('T')[1];
                if (hPart) horario = hPart.substring(0, 5);
            }

            html += `
                <div class="bg-night-950 border border-slate-800 hover:border-liturge-500/50 rounded-2xl p-3.5 shadow-sm transition space-y-2.5">
                    <div class="flex items-start justify-between gap-2.5">
                        <div class="flex items-center gap-2.5 min-w-0">
                            <div class="w-8 h-8 rounded-xl bg-liturge-500/15 border border-liturge-500/30 text-liturge-400 flex items-center justify-center text-base shrink-0 font-bold">
                                ⛪
                            </div>
                            <div class="min-w-0">
                                <span class="text-[10px] font-bold uppercase tracking-wider text-liturge-400 block leading-tight">Culto Programado</span>
                                <h4 class="text-xs sm:text-sm font-bold text-white truncate max-w-[200px]" title="${s.title}">${s.title}</h4>
                            </div>
                        </div>
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-night-900 border border-slate-800 text-slate-300 shrink-0">
                            ${horario}
                        </span>
                    </div>

                    <div class="flex items-center justify-end gap-2 pt-2 border-t border-slate-800/80">
                        <button type="button" onclick="abrirEditorCultoAdmin(${idx !== -1 ? idx : null})"
                            class="px-3 py-1.5 rounded-xl bg-night-900 hover:bg-slate-800 text-slate-200 hover:text-white border border-slate-700/80 text-xs font-semibold flex items-center gap-1 transition cursor-pointer">
                            <span>✏️</span> Editar
                        </button>
                        <button type="button" onclick="confirmarExcluirCultoAdmin(${idx !== -1 ? idx : null}, '${s.id}')"
                            class="px-2.5 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs font-semibold flex items-center gap-1 transition cursor-pointer" title="Excluir culto">
                            <span>🗑️</span>
                        </button>
                    </div>
                </div>
            `;
        });
    }

    // Renderizar Eventos do Dia
    if (evtsDoDia.length > 0) {
        evtsDoDia.forEach(evt => {
            html += `
                <div class="bg-night-950 border border-slate-800 hover:border-amber-500/50 rounded-2xl p-3.5 shadow-sm transition space-y-2.5">
                    <div class="flex items-start justify-between gap-2.5">
                        <div class="flex items-center gap-2.5 min-w-0">
                            <div class="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center text-base shrink-0 font-bold">
                                🎉
                            </div>
                            <div class="min-w-0">
                                <span class="text-[10px] font-bold uppercase tracking-wider text-amber-400 block leading-tight">Evento Especial</span>
                                <h4 class="text-xs sm:text-sm font-bold text-white truncate max-w-[200px]" title="${evt.title}">${evt.title}</h4>
                            </div>
                        </div>
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-night-900 border border-slate-800 text-slate-300 shrink-0">
                            ${evt.time || '19:30'}
                        </span>
                    </div>

                    ${evt.image_url ? `
                        <div class="rounded-xl overflow-hidden border border-slate-800 max-h-28">
                            <img src="${evt.image_url}" alt="${evt.title}" class="w-full h-full object-cover">
                        </div>
                    ` : ''}

                    <div class="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-400">
                        <span class="bg-night-900 px-2 py-0.5 rounded-lg border border-slate-800 text-slate-400">📍 ${evt.location || 'Templo Principal'}</span>
                    </div>
                    ${evt.description ? `<p class="text-xs text-slate-400 line-clamp-2 leading-relaxed">${evt.description}</p>` : ''}

                    <div class="flex items-center justify-end gap-2 pt-2 border-t border-slate-800/80">
                        <button type="button" onclick="abrirEditorEventoAdmin('${evt.id}')"
                            class="px-3 py-1.5 rounded-xl bg-night-900 hover:bg-slate-800 text-slate-200 hover:text-white border border-slate-700/80 text-xs font-semibold flex items-center gap-1 transition cursor-pointer">
                            <span>✏️</span> Editar
                        </button>
                        <button type="button" onclick="excluirEventoAgenda('${evt.id}')"
                            class="px-2.5 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs font-semibold flex items-center gap-1 transition cursor-pointer" title="Excluir evento">
                            <span>🗑️</span>
                        </button>
                    </div>
                </div>
            `;
        });
    }

    if (blocosCultosTabular.length === 0 && cultosDoDia.length === 0 && evtsDoDia.length === 0) {
        html = `
            <div class="bg-night-950/60 border border-dashed border-slate-800 rounded-2xl p-5 text-center space-y-3">
                <div class="w-9 h-9 rounded-xl bg-slate-800/60 text-slate-400 flex items-center justify-center text-lg mx-auto">
                    📅
                </div>
                <div>
                    <p class="text-xs font-semibold text-slate-300">Nenhum culto ou evento agendado</p>
                    <p class="text-[11px] text-slate-500 mt-0.5">Utilize os botões abaixo para programar este dia.</p>
                </div>
                <div class="flex items-center justify-center gap-2 pt-1">
                    <button type="button" onclick="abrirEditorCultoAdmin(null, '${dataStr}')"
                        class="px-3 py-1.5 rounded-xl bg-liturge-500/15 hover:bg-liturge-500/25 text-liturge-400 border border-liturge-500/30 text-xs font-semibold transition cursor-pointer">
                        + Culto
                    </button>
                    <button type="button" onclick="abrirEditorEventoAdmin(null, '${dataStr}')"
                        class="px-3 py-1.5 rounded-xl bg-night-900 hover:bg-slate-800 text-slate-300 border border-slate-700/80 text-xs font-semibold transition cursor-pointer">
                        + Evento
                    </button>
                </div>
            </div>
        `;
    }

    container.innerHTML = html;
}
window.renderizarDetalhesDiaAdmin = renderizarDetalhesDiaAdmin;

function confirmarExcluirCultoAdmin(idx, serviceId) {
    if (!confirm('Deseja realmente excluir este culto e sua programação?')) return;
    if (typeof excluirCulto === 'function') {
        excluirCulto(serviceId || idx);
    } else if (typeof window.excluirCulto === 'function') {
        window.excluirCulto(serviceId || idx);
    }
}
window.confirmarExcluirCultoAdmin = confirmarExcluirCultoAdmin;

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
        
        // Extração literal da data e do horário
        if (evt.date && evt.date.includes('T')) {
            const parts = evt.date.split('T');
            const p = parts[0].split('-');
            if (p.length === 3) dStr = `${p[2]}/${p[1]}/${p[0]}`;
            if (parts[1]) horaFormatada = parts[1].substring(0, 5);
        } else if (dStr && dStr.includes('-')) {
            const p = dStr.split('-');
            if (p.length === 3) dStr = `${p[2]}/${p[1]}/${p[0]}`;
        }

        const subtitulo = horaFormatada ? `${dStr} às ${horaFormatada}` : `${dStr}`;
 
        return `
            <div class="bg-night-950 border border-slate-800/80 hover:border-liturge-500/40 p-3 rounded-xl flex items-center justify-between group transition">
                <div class="min-w-0 flex-1 mr-2">
                    <p class="text-xs font-bold text-white truncate max-w-[180px]">${evt.title}</p>
                    <p class="text-[10px] text-slate-400 font-mono truncate flex items-center gap-1.5 mt-0.5">
                        <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-liturge-400 shrink-0">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                            <line x1="16" y1="2" x2="16" y2="6"></line>
                            <line x1="8" y1="2" x2="8" y2="6"></line>
                            <line x1="3" y1="10" x2="21" y2="10"></line>
                        </svg>
                        <span>${subtitulo}</span>
                    </p>
                </div>
                <div class="flex gap-1.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition shrink-0">
                    <button onclick="abrirEditorEventoAdmin('${evt.id}')" class="text-slate-400 hover:text-liturge-400 p-1 transition cursor-pointer" title="Editar Evento">
                        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
                        </svg>
                    </button>
                    <button onclick="excluirEventoAgenda('${evt.id}')" class="text-slate-400 hover:text-rose-400 p-1 transition cursor-pointer" title="Excluir Evento">
                        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                    </button>
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
            <div class="bg-slate-900 border border-slate-800 p-3 rounded-xl flex items-center justify-between gap-2">
                <div class="min-w-0">
                    <p class="text-xs font-bold text-liturge-400 truncate">${r.name}</p>
                    <p class="text-[10px] text-slate-400">${diasSemana[r.day_of_week]} às ${r.time} • ${r.location || '-'}</p>
                </div>
                <div class="flex items-center gap-1 shrink-0">
                    <button onclick="gerarCultosDaRegra('${r.id}')" class="text-[10px] bg-liturge-500/15 hover:bg-liturge-500/25 text-liturge-400 border border-liturge-500/30 px-2 py-0.5 rounded-lg font-bold transition cursor-pointer">Gerar</button>
                    <button onclick="excluirRegraRecorrente('${r.id}')" class="text-rose-400 hover:text-rose-300 text-xs p-1 cursor-pointer" title="Excluir regra">🗑️</button>
                </div>
            </div>
        `).join('');

    } catch (e) {
        console.error(e);
        container.innerHTML = `<p class="text-xs text-red-400 p-2">Erro ao ler regras.</p>`;
    }
}

/**
 * Gerenciador de Regras Recorrentes em tela dedicada (sem modal flutuante)
 */
function abrirEditorRecorrenteAdmin() {
    const hub = document.getElementById('admin-cultos-eventos-hub');
    const visaoEvento = document.getElementById('admin-visao-evento-editor');
    const visaoRecorrente = document.getElementById('admin-visao-recorrente-editor');
    if (!visaoRecorrente) return;

    if (hub) hub.classList.add('hidden');
    if (visaoEvento) visaoEvento.classList.add('hidden');
    visaoRecorrente.classList.remove('hidden');

    renderizarRecorrentesGerenciador();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}
window.abrirEditorRecorrenteAdmin = abrirEditorRecorrenteAdmin;

function fecharEditorRecorrenteAdmin() {
    const visaoRecorrente = document.getElementById('admin-visao-recorrente-editor');
    const hub = document.getElementById('admin-cultos-eventos-hub');
    if (visaoRecorrente) visaoRecorrente.classList.add('hidden');
    if (hub) hub.classList.remove('hidden');
    carregarE_RenderizarCultosRecorrentes();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}
window.fecharEditorRecorrenteAdmin = fecharEditorRecorrenteAdmin;

function abrirModalCultoRecorrenteAdmin() {
    abrirEditorRecorrenteAdmin();
}
window.abrirModalCultoRecorrenteAdmin = abrirModalCultoRecorrenteAdmin;

function fecharModalCultoRecorrenteAdmin() {
    fecharEditorRecorrenteAdmin();
}
window.fecharModalCultoRecorrenteAdmin = fecharModalCultoRecorrenteAdmin;

async function renderizarRecorrentesGerenciador() {
    const container = document.getElementById('admin-recorrentes-gerenciador-lista');
    if (!container) return;

    try {
        container.innerHTML = '<p class="text-xs text-slate-500 text-center py-6">Carregando regras cadastradas...</p>';
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
            container.innerHTML = `
                <div class="bg-night-950 border border-slate-800 p-6 rounded-2xl text-center space-y-2">
                    <span class="text-2xl">🔄</span>
                    <p class="text-xs font-semibold text-slate-300">Nenhuma regra recorrente cadastrada.</p>
                    <p class="text-[11px] text-slate-500">Cadastre uma regra ao lado para automatizar seus cultos fixos semanais.</p>
                </div>
            `;
            return;
        }

        const diasSemana = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

        container.innerHTML = regras.map(r => `
            <div class="bg-night-950 border border-slate-800 hover:border-slate-700 p-3.5 rounded-2xl flex items-center justify-between gap-3 group transition">
                <div class="min-w-0">
                    <h4 class="text-xs sm:text-sm font-bold text-white truncate">${r.name}</h4>
                    <p class="text-[11px] text-liturge-400 font-medium mt-0.5">
                        🗓️ Toda semana: ${diasSemana[r.day_of_week]} às ${r.time}
                    </p>
                    ${r.location ? `<p class="text-[10px] text-slate-400 mt-0.5">📍 ${r.location}</p>` : ''}
                </div>
                <div class="flex items-center gap-2 shrink-0">
                    <button type="button" onclick="gerarCultosDaRegra('${r.id}')"
                        class="px-3 py-1.5 rounded-xl bg-liturge-500/15 hover:bg-liturge-500/25 text-liturge-400 border border-liturge-500/30 text-xs font-bold transition cursor-pointer">
                        Gerar Cultos
                    </button>
                    <button type="button" onclick="excluirRegraRecorrente('${r.id}')"
                        class="p-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs font-bold transition cursor-pointer" title="Excluir regra">
                        🗑️
                    </button>
                </div>
            </div>
        `).join('');
    } catch(e) {
        console.error(e);
        container.innerHTML = '<p class="text-xs text-rose-400 text-center py-4">Erro ao carregar regras recorrentes.</p>';
    }
}
window.renderizarRecorrentesGerenciador = renderizarRecorrentesGerenciador;

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
            if (typeof renderizarRecorrentesGerenciador === 'function') renderizarRecorrentesGerenciador();
            if (typeof carregarE_RenderizarCultosRecorrentes === 'function') carregarE_RenderizarCultosRecorrentes();
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
            if (typeof renderizarRecorrentesGerenciador === 'function') renderizarRecorrentesGerenciador();
            if (typeof carregarE_RenderizarCultosRecorrentes === 'function') carregarE_RenderizarCultosRecorrentes();
            if (typeof mostrarToast === 'function') mostrarToast('Regra excluída com sucesso.', 'info');
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
window.atualizarHeroAgenda = atualizarHeroAgenda;
window.navegarMesAgenda = navegarMesAgenda;
window.voltarParaMesAtualAgenda = voltarParaMesAtualAgenda;
window.renderizarCalendario = renderizarCalendario;
window.selecionarDiaCalendario = selecionarDiaCalendario;
window.irParaCultoDaAgenda = irParaCultoDaAgenda;
window.abrirModalDiaSelecionadoAtual = abrirModalDiaSelecionadoAtual;
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
window.abrirEditorEventoAdmin = abrirEditorEventoAdmin;
window.fecharEditorEventoAdmin = fecharEditorEventoAdmin;
window.abrirEditorRecorrenteAdmin = abrirEditorRecorrenteAdmin;
window.fecharEditorRecorrenteAdmin = fecharEditorRecorrenteAdmin;
window.renderizarRecorrentesGerenciador = renderizarRecorrentesGerenciador;
window.selecionarDiaCalendarioAdmin = selecionarDiaCalendarioAdmin;
window.renderizarDetalhesDiaAdmin = renderizarDetalhesDiaAdmin;
window.confirmarExcluirCultoAdmin = confirmarExcluirCultoAdmin;
window.navegarHojeAdmin = navegarHojeAdmin;
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

        let badgeEscala = '';
        if (isCulto) {
            const rawServices = window.dadosGlobais?.servicesDataList || window.dadosGlobais?.services || [];
            const targetService = rawServices.find(s => s.id === item.id) || { id: item.id, title: item.title, date: item.dateIso };
            const checkEsc = verificarEscalaUsuarioNoCulto(targetService);
            if (checkEsc.escalado) {
                badgeEscala = `<span class="text-[9px] px-1.5 py-0.5 rounded font-bold border bg-emerald-950 text-emerald-300 border-emerald-500/60">⭐ SUA ESCALA (${checkEsc.roles.join(', ')})</span>`;
            }
        }

        return `
            <label class="flex items-start gap-3 p-2.5 rounded-xl border ${badgeEscala ? 'border-emerald-500/50 bg-slate-900 shadow-sm' : 'border-slate-800 bg-slate-900'} hover:border-slate-700 transition cursor-pointer select-none">
                <input type="checkbox" value="${item.id}" ${isChecked ? 'checked' : ''} onchange="atualizarContadorSelecaoExportacao()"
                    class="check-item-export mt-1 w-4 h-4 rounded text-indigo-600 bg-slate-950 border-slate-700 focus:ring-indigo-500">
                <div class="min-w-0 flex-1 space-y-1">
                    <div class="flex items-center gap-2 flex-wrap">
                        <span class="text-[9px] px-1.5 py-0.5 rounded font-bold border ${badgeCor}">${badgeTexto}</span>
                        ${badgeEscala}
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
window.obterEscalaUsuarioNoDia = obterEscalaUsuarioNoDia;
window.verificarEscalaUsuarioNoCulto = verificarEscalaUsuarioNoCulto;
