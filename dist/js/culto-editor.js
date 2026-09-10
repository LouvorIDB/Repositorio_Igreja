// ===================== ADMIN: CRIAR / EDITAR CULTO =====================
let cultoEditandoId = null;
let flatpickrInstancia = null;
let midiasCultoAtual = [];

// ===================== GESTÃO DE ACCORDIONS (PAINÉIS EXPANSÍVEIS) =====================

const ACCORDIONS_CULTO = ['sec-culto-geral', 'accordion-sec-escala', 'sec-culto-cantores', 'sec-culto-musicas', 'sec-culto-midias'];
let todosAccordionsAbertos = false;

function toggleAccordionCulto(secId) {
    const sec = document.getElementById(secId);
    if (!sec) return;
    const content = document.getElementById(`content-${secId}`);
    if (!content) return;

    const isHidden = content.classList.contains('hidden');
    if (isHidden) {
        content.classList.remove('hidden');
        sec.classList.add('accordion-open');
        const arrow = sec.querySelector('.accordion-arrow');
        if (arrow) arrow.textContent = '▲';
    } else {
        content.classList.add('hidden');
        sec.classList.remove('accordion-open');
        const arrow = sec.querySelector('.accordion-arrow');
        if (arrow) arrow.textContent = '▼';
    }
}

function toggleAccordionMinisterio(minId) {
    const content = document.getElementById(`content-min-accordion-${minId}`);
    const arrow = document.getElementById(`arrow-min-${minId}`);
    const card = document.getElementById(`min-accordion-${minId}`);
    if (!content) return;

    const isHidden = content.classList.contains('hidden');
    if (isHidden) {
        content.classList.remove('hidden');
        if (arrow) arrow.textContent = '▲';
        if (card) card.classList.add('border-slate-700');
    } else {
        content.classList.add('hidden');
        if (arrow) arrow.textContent = '▼';
        if (card) card.classList.remove('border-slate-700');
    }
}

function atualizarBadgeMinisterio(minId) {
    const content = document.getElementById(`content-min-accordion-${minId}`);
    const badge = document.getElementById(`badge-min-count-${minId}`);
    if (!content || !badge) return;

    const inputs = content.querySelectorAll('.escala-dinamica-input');
    let preenchidos = 0;
    inputs.forEach(inp => {
        if (inp.value && inp.value.trim() !== '') preenchidos++;
    });

    badge.textContent = `${preenchidos} ${preenchidos === 1 ? 'escalado' : 'escalados'}`;
    if (preenchidos > 0) {
        badge.className = 'text-[10px] bg-brand-950 text-brand-400 border border-brand-800/80 px-2 py-0.5 rounded-full font-bold';
    } else {
        badge.className = 'text-[10px] bg-slate-800 text-slate-400 border border-slate-700/60 px-2 py-0.5 rounded-full font-medium';
    }
}

function recolherTodosAccordionsCulto() {
    todosAccordionsAbertos = false;
    ACCORDIONS_CULTO.forEach(id => {
        const sec = document.getElementById(id);
        const content = document.getElementById(`content-${id}`);
        if (sec && content) {
            content.classList.add('hidden');
            sec.classList.remove('accordion-open');
            const arrow = sec.querySelector('.accordion-arrow');
            if (arrow) arrow.textContent = '▼';
        }
    });

    // Sub-accordions de cada ministério
    document.querySelectorAll('[id^="content-min-accordion-"]').forEach(el => {
        el.classList.add('hidden');
    });
    document.querySelectorAll('[id^="arrow-min-"]').forEach(el => {
        el.textContent = '▼';
    });

    const label = document.getElementById('btn-toggle-accordions-label');
    if (label) {
        label.textContent = '⌄ Expandir Todos';
    }
}

function expandirTodosAccordionsCulto() {
    todosAccordionsAbertos = true;
    ACCORDIONS_CULTO.forEach(id => {
        const sec = document.getElementById(id);
        const content = document.getElementById(`content-${id}`);
        if (sec && content) {
            content.classList.remove('hidden');
            sec.classList.add('accordion-open');
            const arrow = sec.querySelector('.accordion-arrow');
            if (arrow) arrow.textContent = '▲';
        }
    });

    // Sub-accordions de cada ministério
    document.querySelectorAll('[id^="content-min-accordion-"]').forEach(el => {
        el.classList.remove('hidden');
    });
    document.querySelectorAll('[id^="arrow-min-"]').forEach(el => {
        el.textContent = '▲';
    });

    const label = document.getElementById('btn-toggle-accordions-label');
    if (label) {
        label.textContent = '⌃ Recolher Todos';
    }
}

function toggleTodosAccordionsCulto() {
    if (todosAccordionsAbertos) {
        recolherTodosAccordionsCulto();
    } else {
        expandirTodosAccordionsCulto();
    }
}

function atualizarContadoresAccordions() {
    // 0. Geral (Data & Horário)
    const badgeGeral = document.getElementById('badge-geral-count');
    if (badgeGeral) {
        const dataVal = document.getElementById('culto-data')?.value;
        const horaVal = document.getElementById('culto-hora-input')?.value;
        if (dataVal) {
            badgeGeral.textContent = horaVal ? `${dataVal} • ${horaVal}` : dataVal;
            badgeGeral.className = 'text-[10px] bg-slate-800 text-brand-400 border border-slate-700/80 px-2 py-0.5 rounded-full font-bold';
        } else {
            badgeGeral.textContent = 'Data & Horário';
            badgeGeral.className = 'text-[10px] bg-slate-800 text-slate-400 border border-slate-700/80 px-2 py-0.5 rounded-full font-bold';
        }
    }

    // 1. Escalas Geral
    const inputsDinamicos = document.querySelectorAll('.escala-dinamica-input');
    let escalaPreenchida = 0;
    inputsDinamicos.forEach(inp => {
        if (inp.value && inp.value.trim() !== '') escalaPreenchida++;
    });
    const badgeEscala = document.getElementById('badge-escala-count');
    if (badgeEscala) {
        badgeEscala.textContent = `${escalaPreenchida} ${escalaPreenchida === 1 ? 'escalado' : 'escalados'}`;
        if (escalaPreenchida > 0) {
            badgeEscala.className = 'text-[10px] bg-brand-950 text-brand-400 border border-brand-800/80 px-2 py-0.5 rounded-full font-bold';
        } else {
            badgeEscala.className = 'text-[10px] bg-slate-800 text-slate-400 border border-slate-700/60 px-2 py-0.5 rounded-full font-medium';
        }
    }

    // 1.1 Badges individuais de cada ministério
    if (window.dadosGlobais?.ministries) {
        window.dadosGlobais.ministries.forEach(min => {
            atualizarBadgeMinisterio(min.id);
        });
    }

    // 2. Cantores
    const badgeCantores = document.getElementById('badge-cantores-count');
    if (badgeCantores) {
        const totalC = cantoresCultoAtual.length;
        badgeCantores.textContent = `${totalC} ${totalC === 1 ? 'selecionado' : 'selecionados'}`;
    }

    // 3. Músicas
    const badgeMusicas = document.getElementById('badge-musicas-count');
    if (badgeMusicas) {
        const totalM = musicasCultoAtual.length;
        badgeMusicas.textContent = `${totalM} ${totalM === 1 ? 'música' : 'músicas'}`;
    }

    // 4. Mídias
    const badgeMidias = document.getElementById('badge-midias-count');
    if (badgeMidias) {
        const totalMid = midiasCultoAtual.length;
        badgeMidias.textContent = `${totalMid} ${totalMid === 1 ? 'anexo' : 'anexos'}`;
    }
}

function inicializarCalendarioCulto(dataInicialStr) {
    const inputEl = document.getElementById('culto-data');
    if (!inputEl) return;

    if (typeof flatpickr === 'undefined') {
        inputEl.value = dataInicialStr || '';
        return;
    }

    if (flatpickrInstancia) {
        flatpickrInstancia.destroy();
        flatpickrInstancia = null;
    }

    const busyDates = [];
    const services = (typeof dadosGlobais !== 'undefined' && dadosGlobais.services) ? dadosGlobais.services : [];
    services.forEach(s => {
        if (s.id !== cultoEditandoId && s.date) {
            const dateOnly = s.date.split('T')[0];
            if (dateOnly && !busyDates.includes(dateOnly)) {
                busyDates.push(dateOnly);
            }
        }
    });

    flatpickrInstancia = flatpickr(inputEl, {
        locale: 'pt',
        dateFormat: 'd/m/Y',
        defaultDate: dataInicialStr || null,
        disableMobile: "true",
        onChange: function() {
            if (typeof atualizarContadoresAccordions === 'function') {
                atualizarContadoresAccordions();
            }
        },
        onDayCreate: function(dObj, dStr, fp, dayElem) {
            if (!dayElem.dateObj) return;
            const year = dayElem.dateObj.getFullYear();
            const month = String(dayElem.dateObj.getMonth() + 1).padStart(2, '0');
            const day = String(dayElem.dateObj.getDate()).padStart(2, '0');
            const formatted = `${year}-${month}-${day}`;

            if (busyDates.includes(formatted)) {
                dayElem.classList.add('dia-culto-ocupado');
                dayElem.title = 'Já existe um culto cadastrado nesta data';
            }
        }
    });
}

function mostrarFormCulto(startIndex) {
    cultoEditandoIndex = startIndex;
    cultoEditandoId = startIndex !== null && dadosGlobais.cultos[startIndex] ? dadosGlobais.cultos[startIndex][8] : null;
    musicasCultoAtual = [];
    cantoresCultoAtual = [];
    midiasCultoAtual = [];
    escalaInstrumentos = { violao: '', bateria: '', teclado: '' };

    document.getElementById('status-salvar-culto').classList.add('hidden');
    document.getElementById('erro-salvar-culto').classList.add('hidden');

    let dataFormatar = null;

    const inputTitulo = document.getElementById('culto-titulo-input');
    const inputHora = document.getElementById('culto-hora-input');
    const inputLocal = document.getElementById('culto-local-input');
    const inputDesc = document.getElementById('culto-descricao-input');

    if (inputTitulo) inputTitulo.value = '';
    if (inputHora) inputHora.value = '19:30';
    if (inputLocal) inputLocal.value = '';
    if (inputDesc) inputDesc.value = '';

    if (startIndex === null) {
        document.getElementById('modal-culto-titulo').textContent = 'Novo Evento / Culto';
        document.getElementById('culto-em-montagem').checked = false;
        document.getElementById('culto-oculto').checked = false;
        const checkDestaque = document.getElementById('culto-destaque-evento');
        if (checkDestaque) checkDestaque.checked = false;
        
        // Check if there is a pending date from calendar click
        if (window.pendingDataClick) {
            const p = window.pendingDataClick.split('-');
            if (p.length === 3) dataFormatar = `${p[2]}/${p[1]}/${p[0]}`;
            window.pendingDataClick = null;
        }

    } else {
        const rows = dadosGlobais.cultos;
        const tituloCulto = rows[startIndex][0].toString();
        document.getElementById('modal-culto-titulo').textContent = 'Editar Evento / Culto';
        
        const sTarget = (dadosGlobais.services || []).find(s => s.id === cultoEditandoId);

        let isEmMontagem = tituloCulto.toUpperCase().includes('EM MONTAGEM');
        let isOculto = tituloCulto.toUpperCase().includes('OCULTO');

        if (sTarget) {
            if (sTarget.status === 'aberto' || sTarget.is_draft === true) isEmMontagem = true;
            if (sTarget.status === 'arquivado' || sTarget.is_hidden === true) isOculto = true;
            if (sTarget.title) {
                if (sTarget.title.toUpperCase().includes('EM MONTAGEM')) isEmMontagem = true;
                if (sTarget.title.toUpperCase().includes('OCULTO')) isOculto = true;
            }
            if (sTarget.notes) {
                try {
                    const pn = JSON.parse(sTarget.notes);
                    if (pn && typeof pn === 'object') {
                        if (pn.em_montagem !== undefined) isEmMontagem = !!pn.em_montagem;
                        else if (pn.is_draft !== undefined) isEmMontagem = !!pn.is_draft;
                        if (pn.oculto !== undefined) isOculto = !!pn.oculto;
                        else if (pn.is_hidden !== undefined) isOculto = !!pn.is_hidden;
                    }
                } catch(e){}
            }
        }

        document.getElementById('culto-em-montagem').checked = isEmMontagem;
        document.getElementById('culto-oculto').checked = isOculto;
        const checkDestaque = document.getElementById('culto-destaque-evento');
        if (checkDestaque) checkDestaque.checked = false;

        if (sTarget) {
            if (sTarget.title && inputTitulo) {
                inputTitulo.value = sTarget.title.replace(/ - OCULTO/i, '').replace(/ - EM MONTAGEM/i, '').trim();
            }
            
            if (sTarget.date) {
                // Leitura 100% literal: o horário que você salvou é exatamente o horário carregado
                const parts = sTarget.date.split('T');
                const dateOnly = parts[0];
                if (parts[1] && inputHora) {
                    inputHora.value = parts[1].substring(0, 5);
                }
                const p = dateOnly.split('-');
                if (p.length === 3) dataFormatar = `${p[2]}/${p[1]}/${p[0]}`;
            }
            if (sTarget.location && inputLocal) inputLocal.value = sTarget.location;
            if (sTarget.description && inputDesc) inputDesc.value = sTarget.description;
            if (sTarget.notes) {
                try {
                    const parsedNotes = JSON.parse(sTarget.notes);
                    if (parsedNotes && typeof parsedNotes === 'object') {
                        if (parsedNotes.location && inputLocal && !inputLocal.value) inputLocal.value = parsedNotes.location;
                        if (parsedNotes.description && inputDesc && !inputDesc.value) inputDesc.value = parsedNotes.description;
                        if (parsedNotes.destaque_evento && checkDestaque) checkDestaque.checked = true;
                    }
                } catch(e) {
                    if (inputDesc && !inputDesc.value && typeof sTarget.notes === 'string') inputDesc.value = sTarget.notes;
                }
            }

            // Carregar mídias do service
            if (sTarget.media_urls) {
                if (Array.isArray(sTarget.media_urls)) {
                    midiasCultoAtual = [...sTarget.media_urls];
                } else if (typeof sTarget.media_urls === 'string') {
                    try { midiasCultoAtual = JSON.parse(sTarget.media_urls); } catch(e) { midiasCultoAtual = []; }
                }
            }
        }
        
        if (!dataFormatar) {
            const partes = tituloCulto.split(' - ');
            dataFormatar = partes[0] || '';
            if (inputTitulo) inputTitulo.value = tituloCulto.replace(/ - OCULTO/i, '').replace(/ - EM MONTAGEM/i, '').trim();
        }

        // Fallback de mídias a partir da linha bruta se estiver vazia
        if (midiasCultoAtual.length === 0 && rows[startIndex][7]) {
            try {
                const parsed = JSON.parse(rows[startIndex][7].toString());
                if (Array.isArray(parsed)) midiasCultoAtual = parsed;
            } catch(e) {}
        }

        try {
            const colF = rows[startIndex][5] ? rows[startIndex][5].toString() : '{}';
            escalaInstrumentos = JSON.parse(colF);
        } catch(e) { escalaInstrumentos = { violao: '', bateria: '', teclado: '' }; }

        // Carrega cantores com máxima redundância para garantir que nunca sumam
        let cantoresCarregados = [];

        // 1. Do array em memória formatado (colG)
        if (rows[startIndex] && rows[startIndex][6]) {
            cantoresCarregados = rows[startIndex][6].toString().split(',').map(s => s.trim()).filter(Boolean);
        }

        // 2. Do sTarget (registro do banco relacional)
        if (sTarget) {
            if (cantoresCarregados.length === 0 && (sTarget.singers_list || sTarget.singers)) {
                cantoresCarregados = (sTarget.singers_list || sTarget.singers).split(',').map(s => s.trim()).filter(Boolean);
            }
            if (cantoresCarregados.length === 0 && sTarget.notes) {
                try {
                    const pn = JSON.parse(sTarget.notes);
                    if (pn.cantores && Array.isArray(pn.cantores)) cantoresCarregados = [...pn.cantores];
                } catch(e){}
            }
            if (cantoresCarregados.length === 0 && sTarget.service_scales && sTarget.service_scales.length > 0) {
                sTarget.service_scales.forEach(sc => {
                    const rName = (sc.ministry_roles?.name || sc.role_name || '').toLowerCase();
                    const rScope = sc.ministry_roles?.scale_scope;
                    const pName = sc.profiles?.name || sc.profile_name || '';
                    const isSongScope = rScope === 'song' || (!rScope && (rName.includes('cantor') || rName.includes('vocal') || !rName));
                    if (pName && isSongScope) {
                        if (!cantoresCarregados.includes(pName)) cantoresCarregados.push(pName);
                    }
                });
            }
        }

        // 3. Migra chaves de vocalista/cantor ou funções por música legadas da escala para cantores unificados
        const ministriesListForMigration = (typeof Store !== 'undefined' && Store.getMinistries) ? Store.getMinistries() : (dadosGlobais.ministries || []);
        Object.keys(escalaInstrumentos).forEach(k => {
            const kLow = k.toLowerCase();
            let isSong = kLow.includes('vocal') || kLow.includes('cantor');
            if (!isSong) {
                for (const m of ministriesListForMigration) {
                    const rFound = (m.ministry_roles || []).find(r => (r.name || '').toLowerCase() === kLow);
                    if (rFound && rFound.scale_scope === 'song') {
                        isSong = true;
                        break;
                    }
                }
            }
            if (isSong) {
                const val = escalaInstrumentos[k];
                if (val) {
                    val.split(',').map(s => s.trim()).filter(Boolean).forEach(n => {
                        if (!cantoresCarregados.includes(n)) cantoresCarregados.push(n);
                    });
                }
                delete escalaInstrumentos[k];
            }
        });

        // 4. Fallback inteligente: unifica com os cantores escalados nas músicas desse culto
        for (let i = startIndex + 1; i < rows.length; i++) {
            const texto = rows[i][0] ? rows[i][0].toString() : '';
            if (texto.includes("CULTO DE")) break;
            if (rows[i][6]) {
                const cM = rows[i][6].toString().split(',').map(s => s.trim()).filter(Boolean);
                cM.forEach(c => {
                    if (!cantoresCarregados.includes(c)) cantoresCarregados.push(c);
                });
            }
        }

        cantoresCultoAtual = cantoresCarregados;

        for (let i = startIndex + 1; i < rows.length; i++) {
            const texto = rows[i][0] ? rows[i][0].toString() : '';
            if (texto.includes("CULTO DE")) break;
            if (texto.trim() === '') continue;
            musicasCultoAtual.push({
                nome: rows[i][0] || '',
                tom: rows[i][1] || '',
                variacao: rows[i][2] || 'Original',
                vs: rows[i][3] || '',
                yt: rows[i][4] || '',
                cantores: rows[i][6] ? rows[i][6].toString().split(',').map(s => s.trim()).filter(Boolean) : []
            });
        }
    }

    inicializarCalendarioCulto(dataFormatar);

    popularSelectsInstrumentos();
    renderizarCantoresCulto();
    renderizarMusicasCulto();
    renderizarMidiasCulto();
    atualizarContadoresAccordions();
    recolherTodosAccordionsCulto();
    document.getElementById('seletor-musica').classList.add('hidden');

    const userToEvaluate = modoSimulacaoPerfil || usuarioLogado;
    const roleUsuario = userToEvaluate ? (userToEvaluate.system_role || userToEvaluate.role || 'membro') : 'visitante';
    const userMinistryIds = typeof obterIdsMinisteriosDoUsuario === 'function' 
        ? obterIdsMinisteriosDoUsuario(userToEvaluate) 
        : (userToEvaluate?.ministry_id ? [userToEvaluate.ministry_id] : []);

    const ministeriosDoUsuario = (dadosGlobais.ministries || []).filter(m => userMinistryIds.includes(m.id));
    const temLouvorOuMusica = ministeriosDoUsuario.some(m => (m.name || '').toLowerCase().includes('louvor') || (m.name || '').toLowerCase().includes('musica'));
    const isLiderNaoLouvor = (roleUsuario === 'lider') && ministeriosDoUsuario.length > 0 && !temLouvorOuMusica;

    const secCantores = document.getElementById('sec-culto-cantores');
    if (secCantores) {
        if (!isLiderNaoLouvor && (roleUsuario === 'admin' || hasPermission('ver_cantor') || hasPermission('enviar_sugestao_culto'))) {
            secCantores.classList.remove('hidden');
        } else {
            secCantores.classList.add('hidden');
        }
    }

    const secMusicas = document.getElementById('sec-culto-musicas');
    if (secMusicas) {
        if (!isLiderNaoLouvor && (roleUsuario === 'admin' || hasPermission('enviar_sugestao_culto') || hasPermission('ver_repertorio'))) {
            secMusicas.classList.remove('hidden');
        } else {
            secMusicas.classList.add('hidden');
        }
    }

    const btnExcluir = document.getElementById('btn-excluir-culto-modal');
    if (btnExcluir) {
        if (startIndex !== null && (roleUsuario === 'admin' || roleUsuario === 'lider')) {
            btnExcluir.classList.remove('hidden');
        } else {
            btnExcluir.classList.add('hidden');
        }
    }

    document.getElementById('modal-culto').classList.remove('hidden');
}

function editarCulto(startIndex) { mostrarFormCulto(startIndex); }

function fecharModalCulto() {
    document.getElementById('modal-culto').classList.add('hidden');
}

async function excluirCulto(serviceIdOuIndex) {
    let serviceId = null;
    let tituloCulto = 'este culto';

    // 1. Identifica o serviceId (por UUID ou por índice do array legado)
    if (typeof serviceIdOuIndex === 'string' && serviceIdOuIndex.length > 10) {
        serviceId = serviceIdOuIndex;
        const sTarget = (dadosGlobais.services || []).find(s => s.id === serviceId);
        if (sTarget) tituloCulto = sTarget.title || 'este culto';
    } else if (typeof serviceIdOuIndex === 'number' || (serviceIdOuIndex !== null && !isNaN(serviceIdOuIndex) && serviceIdOuIndex !== '')) {
        const idx = Number(serviceIdOuIndex);
        if (dadosGlobais.cultos && dadosGlobais.cultos[idx]) {
            serviceId = dadosGlobais.cultos[idx][8];
            tituloCulto = dadosGlobais.cultos[idx][0] ? dadosGlobais.cultos[idx][0].toString() : 'este culto';
        }
    } else if (typeof cultoEditandoId !== 'undefined' && cultoEditandoId) {
        serviceId = cultoEditandoId;
        const sTarget = (dadosGlobais.services || []).find(s => s.id === serviceId);
        if (sTarget) tituloCulto = sTarget.title || 'este culto';
    }

    if (!serviceId) {
        if (typeof mostrarToast === 'function') mostrarToast('Erro: Identificador do culto não encontrado.', 'erro');
        return;
    }

    tituloCulto = tituloCulto.replace(/ - OCULTO/i, '').replace(/ - EM MONTAGEM/i, '').trim();

    if (!confirm(`Tem certeza que deseja excluir o culto "${tituloCulto}"?\n\nEsta ação apagará permanentemente o culto, sua escala, mídias e repertório associado.`)) {
        return;
    }

    try {
        if (!supabaseClient) throw new Error("Cliente Supabase não inicializado.");

        // 1. Apagar registros dependentes para evitar erro de Foreign Key
        await supabaseClient.from('service_songs').delete().eq('service_id', serviceId);
        await supabaseClient.from('service_scales').delete().eq('service_id', serviceId);
        await supabaseClient.from('service_media').delete().eq('service_id', serviceId);
        try {
            await supabaseClient.from('availability_comments').delete().eq('service_id', serviceId);
        } catch (eComments) {}

        // 2. Apagar o registro principal na tabela services
        const { error } = await supabaseClient.from('services').delete().eq('id', serviceId);
        if (error) throw error;

        // 3. Fechar modais abertos
        if (typeof fecharModalCulto === 'function') fecharModalCulto();
        if (typeof fecharModalDetalhesDia === 'function') fecharModalDetalhesDia();

        // 4. Recarregar dados e atualizar telas
        if (typeof carregarDados === 'function') await carregarDados();
        if (typeof carregarAgenda === 'function') carregarAgenda();
        if (typeof renderizarAdminCultosEventos === 'function') renderizarAdminCultosEventos();
        if (typeof renderizarAdminListaCultos === 'function') renderizarAdminListaCultos();

        if (typeof mostrarToast === 'function') mostrarToast(`Culto "${tituloCulto}" excluído com sucesso!`, 'sucesso');
    } catch (err) {
        console.error('Erro ao excluir culto:', err);
        if (typeof mostrarToast === 'function') mostrarToast(`Erro ao excluir culto: ${err.message}`, 'erro');
    }
}
window.excluirCulto = excluirCulto;
window.excluirCultoAtual = () => excluirCulto(cultoEditandoId);


// ===================== ADMIN: INSTRUMENTISTAS =====================

function popularSelectsInstrumentos() {
    const container = document.getElementById('escala-dinamica-container');
    if (!container) return;

    if (!dadosGlobais.ministries || dadosGlobais.ministries.length === 0) {
        container.innerHTML = '<p class="text-xs text-slate-500">Nenhum ministério cadastrado.</p>';
        return;
    }

    const userToEvaluate = modoSimulacaoPerfil || usuarioLogado;
    const roleUsuario = userToEvaluate ? (userToEvaluate.system_role || userToEvaluate.role || 'membro') : 'visitante';
    const userMinistryIds = typeof obterIdsMinisteriosDoUsuario === 'function' 
        ? obterIdsMinisteriosDoUsuario(userToEvaluate) 
        : (userToEvaluate?.ministry_id ? [userToEvaluate.ministry_id] : []);

    let html = '';
    dadosGlobais.ministries.forEach(min => {
        // Regra de visibilidade: Admin vê tudo, Líder vê os ministérios que pertence/lidera
        if (roleUsuario !== 'admin' && roleUsuario !== 'lider') return;
        if (roleUsuario === 'lider' && userMinistryIds.length > 0 && !userMinistryIds.includes(min.id)) return;

        const roles = min.ministry_roles || [];
        // Filtra funções com escopo por música (pois são escaladas na seção de músicas)
        const isPerSong = (r) => {
            if (!r) return false;
            if (r.scale_scope === 'song') return true;
            if (r.scale_scope === 'service') return false;
            const n = (r.name || '').toLowerCase();
            return n.includes('cantor') || n.includes('vocal');
        };
        const rolesFiltrados = roles.filter(r => !isPerSong(r));

        if (rolesFiltrados.length === 0) return;

        html += `
            <div id="min-accordion-${min.id}" class="border border-slate-800/80 rounded-xl overflow-hidden bg-slate-950/40 mb-3 transition-colors hover:border-slate-700">
                <div onclick="toggleAccordionMinisterio('${min.id}')" 
                    class="flex items-center justify-between p-3.5 cursor-pointer hover:bg-slate-800/50 transition select-none">
                    <div class="flex items-center gap-2.5">
                        <span class="text-sm">${min.icon || '🏷️'}</span>
                        <h4 class="text-xs font-bold text-slate-200 uppercase tracking-wider">${min.name}</h4>
                        <span id="badge-min-count-${min.id}" class="text-[10px] bg-slate-800 text-slate-400 border border-slate-700/60 px-2 py-0.5 rounded-full font-medium">0 escalados</span>
                    </div>
                    <div class="flex items-center gap-2">
                        <span id="arrow-min-${min.id}" class="text-slate-400 text-xs font-bold transition-transform">▼</span>
                    </div>
                </div>
                <div id="content-min-accordion-${min.id}" class="hidden p-3.5 border-t border-slate-800/70 bg-slate-900/30">
                    <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        `;

        rolesFiltrados.forEach(role => {
            const roleName = role.name;
            const selectId = `escala-dinamica-${role.id}`;
            const keySemAcento = typeof removerAcentos === 'function' ? removerAcentos(roleName.toLowerCase()) : roleName.toLowerCase();
            const valorSalvo = escalaInstrumentos[roleName] || escalaInstrumentos[roleName.toLowerCase()] || escalaInstrumentos[keySemAcento] || '';
            
            // Busca voluntários filtrando por cargo e ministério (com fallback)
            let listaVoluntarios = cantoresPorInstrumento(roleName, min.id);
            if (listaVoluntarios.length === 0) {
                listaVoluntarios = cantoresPorInstrumento(roleName);
            }

            // Identifica a data do culto para checar disponibilidade
            const dataInputVal = document.getElementById('culto-data')?.value || '';
            let dataIsoCulto = '';
            if (dataInputVal) {
                const partsD = dataInputVal.split('/');
                if (partsD.length === 3) dataIsoCulto = `${partsD[2]}-${partsD[1]}-${partsD[0]}`;
                else dataIsoCulto = dataInputVal;
            }

            const todosVoluntarios = (typeof Store !== 'undefined' && Store.getVoluntarios) ? Store.getVoluntarios() : (window.dadosGlobais?.voluntarios || []);
            const churchIdAtual = window.dadosGlobais?.church?.id || null;
            
            let optionsHtml = `<option value="">— Nenhum —</option>`;
            listaVoluntarios.forEach(vol => {
                const selected = vol === valorSalvo ? 'selected' : '';
                let labelVol = vol;

                if (dataIsoCulto) {
                    const prof = todosVoluntarios.find(p => p.name === vol || p.id === vol);
                    if (prof) {
                        const cId = churchIdAtual || prof.church_id;
                        const storageKey = `liturge_avail_${cId}_${prof.id}`;
                        try {
                            const localAvail = JSON.parse(localStorage.getItem(storageKey) || '{}');
                            if (localAvail[dataIsoCulto]?.status === 'indisponivel') {
                                const mot = localAvail[dataIsoCulto].notes ? ` (${localAvail[dataIsoCulto].notes})` : '';
                                labelVol += ` (🔴 Indisponível${mot})`;
                            } else if (localAvail[dataIsoCulto]?.status === 'disponivel') {
                                labelVol += ' (🟢 Disponível)';
                            }
                        } catch(e){}
                    }
                }

                optionsHtml += `<option value="${vol}" ${selected}>${labelVol}</option>`;
            });

            html += `
                <div>
                    <label class="text-xs text-slate-400 mb-1 block font-medium">${roleName}</label>
                    <select id="${selectId}" data-role-name="${roleName}" data-role-id="${role.id}" onchange="verificarAlertasEscalacao('${selectId}', this.value); if (typeof atualizarContadoresAccordions === 'function') atualizarContadoresAccordions(); if (typeof atualizarBadgeMinisterio === 'function') atualizarBadgeMinisterio('${min.id}');" class="escala-dinamica-input w-full bg-slate-950 border border-slate-700 px-3 py-2 rounded-lg text-sm text-white focus:outline-none focus:border-brand-500">
                        ${optionsHtml}
                    </select>
                    <div id="aviso-${selectId}" class="mt-1 space-y-0.5"></div>
                </div>
            `;
        });

        html += `
                    </div>
                </div>
            </div>
        `;
    });

    if (!html) {
        html = '<p class="text-xs text-slate-500">Nenhum campo de escala disponível para o seu acesso.</p>';
    }

    container.innerHTML = html;

    if (window.dadosGlobais?.ministries) {
        window.dadosGlobais.ministries.forEach(min => {
            if (typeof atualizarBadgeMinisterio === 'function') {
                atualizarBadgeMinisterio(min.id);
            }
        });
    }
}

// ===================== ADMIN: CANTORES DO CULTO =====================

function renderizarCantoresCulto() {
    const container = document.getElementById('culto-cantores-lista');
    let lista = typeof obterVoluntariosEscopoMusica === 'function' ? obterVoluntariosEscopoMusica() : [];
    if (lista.length === 0) {
        lista = cantoresPorInstrumento('Cantor');
    }
    if (lista.length === 0) {
        lista = cantoresPorInstrumento('Vocal');
    }

    if (lista.length === 0) {
        container.innerHTML = '<p class="text-slate-500 text-xs">Nenhum voluntário cadastrado com função de escala por música (ex: Vocal/Cantor).</p>';
        return;
    }

    container.innerHTML = lista.map(nome => {
        const ativo = cantoresCultoAtual.includes(nome);
        const cls = ativo
            ? 'bg-brand-600 text-white border-brand-500'
            : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-slate-500';
        return `<button type="button" onclick="toggleCantorCulto('${nome.replace(/'/g, "\\'")}')" class="px-3 py-1.5 rounded-full text-xs font-medium border transition ${cls}">${ativo ? '✓ ' : ''}${nome}</button>`;
    }).join('');
}

function toggleCantorCulto(nome) {
    const idx = cantoresCultoAtual.indexOf(nome);
    if (idx === -1) cantoresCultoAtual.push(nome);
    else cantoresCultoAtual.splice(idx, 1);
    renderizarCantoresCulto();
    renderizarMusicasCulto(); // atualiza seletores de cantor por música
    atualizarContadoresAccordions();
}

// ===================== ADMIN: MÚSICAS =====================

let dragMusicaIndex = null;

function onDragStartMusica(e, idx) {
    dragMusicaIndex = idx;
    e.dataTransfer.effectAllowed = 'move';
}

function onDragOverMusica(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
}

function onDropMusica(e, targetIdx) {
    e.preventDefault();
    if (dragMusicaIndex === null || dragMusicaIndex === targetIdx) return;
    const [moved] = musicasCultoAtual.splice(dragMusicaIndex, 1);
    musicasCultoAtual.splice(targetIdx, 0, moved);
    dragMusicaIndex = null;
    renderizarMusicasCulto();
}

function renderizarMusicasCulto() {
    const container = document.getElementById('culto-musicas-lista');
    if (musicasCultoAtual.length === 0) {
        container.innerHTML = '<p class="text-slate-500 text-xs">Nenhuma música adicionada.</p>';
        return;
    }

    container.innerHTML = musicasCultoAtual.map((m, idx) => {
        // Seletor de cantores por música (multi — chips clicáveis)
        const cantoresChips = cantoresCultoAtual.length === 0
            ? '<span class="text-slate-600 text-xs">Selecione cantores do culto primeiro</span>'
            : cantoresCultoAtual.map(nome => {
                const ativo = (m.cantores || []).includes(nome);
                const cls = ativo
                    ? 'bg-brand-700 text-white border-brand-600'
                    : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-500';
                return `<button type="button" onclick="toggleCantorMusica(${idx},'${nome.replace(/'/g, "\\'")}')" class="px-2 py-0.5 rounded-full text-xs border transition ${cls}">${ativo ? '✓ ' : ''}${nome}</button>`;
            }).join('');

        return `
            <div draggable="true" ondragstart="onDragStartMusica(event, ${idx})" ondragover="onDragOverMusica(event)" ondrop="onDropMusica(event, ${idx})" class="bg-slate-900 border border-slate-700 px-3 py-2 rounded-lg space-y-2 cursor-move">
                <div class="flex items-center justify-between gap-2">
                    <span class="text-slate-500 hover:text-slate-300 font-bold select-none text-base cursor-grab mr-1">⣿</span>
                    <div class="flex-1 min-w-0">
                        <p class="text-sm text-white font-medium truncate">${m.nome}</p>
                        <p class="text-xs text-brand-300">${m.tom} ${m.variacao ? '('+m.variacao+')' : ''}</p>
                    </div>
                    <div class="flex gap-1 shrink-0">
                        <button onclick="removerMusica(${idx})" class="text-red-400 hover:text-red-300 px-1.5 py-1 rounded text-xs">✕</button>
                    </div>
                </div>
                ${cantoresCultoAtual.length > 0 ? `
                <div class="flex flex-wrap gap-1 items-center">
                    <span class="text-xs text-slate-500 mr-1">🎤</span>
                    ${cantoresChips}
                </div>` : ''}
            </div>
        `;
    }).join('');
}

function toggleCantorMusica(idxMusica, nome) {
    const cantores = musicasCultoAtual[idxMusica].cantores || [];
    const idx = cantores.indexOf(nome);
    if (idx === -1) cantores.push(nome);
    else cantores.splice(idx, 1);
    musicasCultoAtual[idxMusica].cantores = cantores;
    renderizarMusicasCulto();
}

function moverMusica(idx, direcao) {
    const novo = idx + direcao;
    if (novo < 0 || novo >= musicasCultoAtual.length) return;
    [musicasCultoAtual[idx], musicasCultoAtual[novo]] = [musicasCultoAtual[novo], musicasCultoAtual[idx]];
    renderizarMusicasCulto();
}

function removerMusica(idx) {
    musicasCultoAtual.splice(idx, 1);
    renderizarMusicasCulto();
    atualizarContadoresAccordions();
}

// ===================== ADMIN: BANCO DE MÚSICAS =====================

function abrirSeletorMusica() {
    const seletor = document.getElementById('seletor-musica');
    seletor.classList.toggle('hidden');
    document.getElementById('busca-banco').value = '';
    filtrarBanco();
}

function filtrarBanco() {
    const termo = document.getElementById('busca-banco').value.toLowerCase();
    const banco = dadosGlobais.banco;
    const container = document.getElementById('resultado-banco');

    if (!banco || banco.length === 0) {
        container.innerHTML = '<p class="text-slate-500 text-xs px-2">Nenhuma música encontrada.</p>';
        return;
    }

    const filtradas = banco.filter(item => {
        const nome = (item.nome || (item[0] ? item[0].toString() : '')).toLowerCase();
        return nome && nome.includes(termo);
    });

    if (filtradas.length === 0) {
        container.innerHTML = '<p class="text-slate-500 text-xs px-2">Nenhuma música encontrada.</p>';
        return;
    }

    container.innerHTML = filtradas.slice(0, 50).map(item => {
        const nome = item.nome || item[0] || '';
        const tom = item.tom || item[1] || '';
        const variacao = item.variacao || item[2] || 'Original';
        const vs = item.vs || item[3] || '';
        const yt = item.yt || item[4] || '';
        return `
            <button onclick="adicionarMusicaDoBanco('${nome.toString().replace(/'/g, "\\'")}','${tom.toString().replace(/'/g, "\\'")}','${variacao.toString().replace(/'/g, "\\'")}','${vs.toString().replace(/'/g, "\\'")}','${yt.toString().replace(/'/g, "\\'")}')"
                class="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-700 transition flex items-center justify-between gap-2">
                <span class="text-sm text-white truncate">${nome}</span>
                <span class="text-xs text-brand-300 shrink-0">${tom} (${variacao})</span>
            </button>
        `;
    }).join('');
}

function adicionarMusicaDoBanco(nome, tom, variacao, vs, yt) {
    if (musicasCultoAtual.find(m => m.nome === nome)) {
        mostrarToast(`"${nome}" já está na playlist.`, 'aviso');
        return;
    }
    musicasCultoAtual.push({ nome, tom, variacao, vs, yt, cantores: [] });
    renderizarMusicasCulto();
    atualizarContadoresAccordions();
    document.getElementById('seletor-musica').classList.add('hidden');
}

// ===================== ADMIN: GESTÃO DE MÍDIAS DO CULTO =====================

function renderizarMidiasCulto() {
    const container = document.getElementById('culto-midias-lista');
    if (!container) return;

    if (!midiasCultoAtual || midiasCultoAtual.length === 0) {
        container.innerHTML = '<p class="text-xs text-slate-500 italic py-2">Nenhuma mídia vinculada a este culto.</p>';
        return;
    }

    container.innerHTML = midiasCultoAtual.map((m, idx) => {
        let icone = '📁';
        const urlLower = (m.url || '').toLowerCase();
        const nomeLower = (m.name || '').toLowerCase();

        if (urlLower.includes('youtube.com') || urlLower.includes('youtu.be') || m.type?.includes('video') || nomeLower.endsWith('.mp4')) {
            icone = '🎬';
        } else if (m.type?.includes('image') || nomeLower.endsWith('.png') || nomeLower.endsWith('.jpg') || nomeLower.endsWith('.jpeg') || nomeLower.endsWith('.webp')) {
            icone = '🖼️';
        } else if (m.type?.includes('pdf') || nomeLower.endsWith('.pdf')) {
            icone = '📄';
        } else if (urlLower.includes('canva.com')) {
            icone = '🎨';
        } else if (urlLower.includes('drive.google.com')) {
            icone = '☁️';
        } else if (m.type === 'link') {
            icone = '🔗';
        }

        return `
            <div class="bg-slate-900 border border-slate-700/80 hover:border-slate-600 px-3.5 py-2.5 rounded-xl flex items-center justify-between gap-3 transition">
                <div class="flex items-center gap-2.5 min-w-0 flex-1">
                    <span class="text-base shrink-0">${icone}</span>
                    <div class="min-w-0 flex-1">
                        <p class="text-xs font-semibold text-white truncate">${m.name || 'Mídia sem título'}</p>
                        <a href="${m.url}" target="_blank" class="text-[11px] text-indigo-400 hover:text-indigo-300 underline truncate block max-w-xs sm:max-w-sm">
                            ${m.url}
                        </a>
                    </div>
                </div>
                <div class="flex items-center gap-1.5 shrink-0">
                    <a href="${m.url}" target="_blank" class="bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-2.5 py-1 rounded-lg text-xs font-medium transition" title="Abrir em nova aba">
                        ↗ Abrir
                    </a>
                    <button type="button" onclick="removerMidiaCulto(${idx})" class="bg-red-950/60 hover:bg-red-900 text-red-300 border border-red-800/60 px-2.5 py-1 rounded-lg text-xs font-medium transition" title="Remover Mídia">
                        🗑️
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function toggleFormLinkMidiaCulto() {
    const form = document.getElementById('form-link-midia-culto');
    if (!form) return;
    form.classList.toggle('hidden');
    document.getElementById('link-midia-nome').value = '';
    document.getElementById('link-midia-url').value = '';
}

function salvarLinkMidiaCulto() {
    const nome = document.getElementById('link-midia-nome').value.trim();
    const url = document.getElementById('link-midia-url').value.trim();

    if (!url) {
        if (typeof mostrarToast === 'function') mostrarToast('Insira a URL da mídia.', 'aviso');
        return;
    }

    midiasCultoAtual.push({
        name: nome || url,
        url: url,
        type: 'link'
    });

    renderizarMidiasCulto();
    atualizarContadoresAccordions();
    toggleFormLinkMidiaCulto();
    if (typeof mostrarToast === 'function') mostrarToast('Link de mídia adicionado!', 'sucesso');
}

async function fazerUploadMidiaCulto(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    const progressBar = document.getElementById('culto-midia-upload-progress');
    const bar = document.getElementById('culto-midia-upload-bar');
    const txt = document.getElementById('culto-midia-upload-text');

    if (progressBar) progressBar.classList.remove('hidden');
    if (bar) bar.style.width = '30%';
    if (txt) txt.textContent = `Enviando "${file.name}"...`;

    try {
        let uploadedUrl = null;
        if (typeof uploadArquivoSupabase === 'function') {
            uploadedUrl = await uploadArquivoSupabase(file, 'media-inbox', 'cultos');
        } else if (typeof window.uploadArquivoSupabase === 'function') {
            uploadedUrl = await window.uploadArquivoSupabase(file, 'media-inbox', 'cultos');
        } else {
            throw new Error("Função de upload do Supabase não disponível.");
        }

        if (bar) bar.style.width = '100%';

        if (uploadedUrl) {
            midiasCultoAtual.push({
                name: file.name,
                url: uploadedUrl,
                type: file.type || 'file',
                size: file.size || 0
            });

            renderizarMidiasCulto();
            atualizarContadoresAccordions();
            if (typeof mostrarToast === 'function') mostrarToast(`Mídia "${file.name}" anexada com sucesso!`, 'sucesso');
        }
    } catch (err) {
        console.error("Erro no upload de mídia do culto:", err);
        if (typeof mostrarToast === 'function') mostrarToast('Erro ao enviar arquivo: ' + err.message, 'erro');
    } finally {
        setTimeout(() => {
            if (progressBar) progressBar.classList.add('hidden');
            if (bar) bar.style.width = '0%';
        }, 600);
        event.target.value = '';
    }
}

function removerMidiaCulto(idx) {
    if (idx >= 0 && idx < midiasCultoAtual.length) {
        midiasCultoAtual.splice(idx, 1);
        renderizarMidiasCulto();
        atualizarContadoresAccordions();
        if (typeof mostrarToast === 'function') mostrarToast('Mídia removida.', 'info');
    }
}

// ===================== ADMIN: SALVAR =====================

async function salvarCulto() {
    const data = document.getElementById('culto-data').value.trim();
    const emMontagem = document.getElementById('culto-em-montagem').checked;
    const oculto = document.getElementById('culto-oculto').checked;

    const customTitle = document.getElementById('culto-titulo-input')?.value.trim();
    const customTime = document.getElementById('culto-hora-input')?.value.trim() || '19:30';
    const customLocation = document.getElementById('culto-local-input')?.value.trim();
    const customDesc = document.getElementById('culto-descricao-input')?.value.trim();

    if (!data) { mostrarToast('Escolha a data do culto no calendário.', 'aviso'); return; }

    const [hH, mM] = customTime.split(':');
    const horaNum = parseInt(hH || 19, 10);
    const minNum = parseInt(mM || 0, 10);
    let dia = new Date().getDate();
    let mes = new Date().getMonth();
    let ano = new Date().getFullYear();

    const partesData = data.split('/');
    if (partesData.length === 3) {
        dia = parseInt(partesData[0], 10);
        mes = parseInt(partesData[1], 10) - 1;
        ano = parseInt(partesData[2], 10);
    } else if (partesData.length === 2) {
        dia = parseInt(partesData[0], 10);
        mes = parseInt(partesData[1], 10) - 1;
        ano = new Date().getFullYear();
    } else {
        const dp = data.split('-');
        if (dp.length === 3) {
            ano = parseInt(dp[0], 10);
            mes = parseInt(dp[1], 10) - 1;
            dia = parseInt(dp[2], 10);
        }
    }
    const dataFinalObj = new Date(ano, mes, dia, horaNum, minNum, 0);

    const diaPad = String(dia).padStart(2, '0');
    const mesPad = String(mes + 1).padStart(2, '0');
    const horaPad = String(horaNum).padStart(2, '0');
    const minPad = String(minNum).padStart(2, '0');
    const dataLocalIso = `${ano}-${mesPad}-${diaPad}T${horaPad}:${minPad}:00`;

    const diasSemana = ["DOMINGO", "SEGUNDA", "TERÇA", "QUARTA", "QUINTA", "SEXTA", "SÁBADO"];
    const diaIndex = dataFinalObj.getDay();
    let tipo = diasSemana[diaIndex];
    if (diaIndex === 6) tipo = "SABADO";

    const dataFormatadaTitle = `${diaPad}/${mesPad}`;

    let tituloBase = customTitle;
    if (!tituloBase) {
        tituloBase = `${dataFormatadaTitle} - CULTO DE ${tipo}`;
    } else {
        // Limpa quaisquer sufixos de status anteriores para evitar repetição/duplicação
        tituloBase = tituloBase.replace(/ - OCULTO/i, '').replace(/ - EM MONTAGEM/i, '').trim();
    }

    let titulo = tituloBase;
    if (emMontagem) {
        titulo += ' - EM MONTAGEM';
    }
    if (oculto) {
        titulo += ' - OCULTO';
    }

    escalaInstrumentos = {};
    const inputsDinamicos = document.querySelectorAll('.escala-dinamica-input');
    inputsDinamicos.forEach(input => {
        const roleName = input.getAttribute('data-role-name');
        if (roleName) {
            escalaInstrumentos[roleName] = input.value;
        }
    });

    const btn = document.getElementById('btn-salvar-culto');
    const statusEl = document.getElementById('status-salvar-culto');
    const erroEl = document.getElementById('erro-salvar-culto');

    btn.textContent = 'Salvando...';
    btn.disabled = true;
    statusEl.classList.add('hidden');
    erroEl.classList.add('hidden');

    try {
        if (!supabaseClient) {
            throw new Error("Cliente Supabase não inicializado.");
        }

        // 1. Obter a igreja tenant atual a partir do estado global com máxima resiliência
        const userToEvaluate = (typeof modoSimulacaoPerfil !== 'undefined' ? modoSimulacaoPerfil : null) || (window.usuarioLogado || null);
        let churchId = window.dadosGlobais?.church?.id 
            || userToEvaluate?.church_id 
            || (typeof obterChurchIdAtual === 'function' ? obterChurchIdAtual() : null);

        if (!churchId && window.dadosGlobais?.churches && window.dadosGlobais.churches.length > 0) {
            churchId = window.dadosGlobais.churches[0].id;
        }

        if (!churchId) {
            throw new Error("Igreja não identificada. Por favor, recarregue a página para autenticar a congregação.");
        }

        const cantoresStr = Array.isArray(cantoresCultoAtual) ? cantoresCultoAtual.join(', ') : '';

        const destaqueEvento = document.getElementById('culto-destaque-evento')?.checked || false;

        const notesData = JSON.stringify({
            location: customLocation || '',
            description: customDesc || '',
            cantores: cantoresCultoAtual || [],
            escala: escalaInstrumentos || {},
            destaque_evento: destaqueEvento,
            em_montagem: emMontagem,
            is_draft: emMontagem,
            oculto: oculto,
            is_hidden: oculto
        });

        const serviceData = {
            title: titulo,
            status: oculto ? 'arquivado' : (emMontagem ? 'aberto' : 'confirmado'),
            date: dataLocalIso,
            media_urls: midiasCultoAtual,
            notes: notesData,
            description: customDesc || '',
            church_id: churchId
        };

        let serviceId = cultoEditandoId;

        // 2. Edição vs Novo Culto
        if (serviceId) {
            const { error: updateErr } = await supabaseClient
                .from('services')
                .update(serviceData)
                .eq('id', serviceId);
            if (updateErr) throw updateErr;

            // Remove músicas associadas antigas para recriar com a nova ordem/cantores
            await supabaseClient.from('service_songs').delete().eq('service_id', serviceId);
        } else {
            const { data: newService, error: insertErr } = await supabaseClient
                .from('services')
                .insert([serviceData])
                .select('id')
                .single();
            if (insertErr) throw insertErr;
            serviceId = newService.id;
        }

        // 3. Inserir escalas relacionais na tabela 'service_scales'
        if (serviceId) {
            try {
                // Deletar escalas existentes deste culto para ressalvar
                await supabaseClient.from('service_scales').delete().eq('service_id', serviceId);

                const voluntariosList = (typeof Store !== 'undefined' && Store.getVoluntarios) ? Store.getVoluntarios() : (dadosGlobais.voluntarios || []);
                const ministriesList = (typeof Store !== 'undefined' && Store.getMinistries) ? Store.getMinistries() : (dadosGlobais.ministries || []);
                const scalesToInsert = [];

                let cantorRoleId = null;
                for (const m of ministriesList) {
                    const found = (m.ministry_roles || []).find(r => r.scale_scope === 'song' || (r.name || '').toLowerCase().includes('cantor') || (r.name || '').toLowerCase().includes('vocal'));
                    if (found) { cantorRoleId = found.id; break; }
                }

                // A) Escala de instrumentistas/funções dinâmicas
                inputsDinamicos.forEach(input => {
                    const roleName = input.getAttribute('data-role-name');
                    const roleId = input.getAttribute('data-role-id');
                    const val = input.value;
                    if (roleName && val) {
                        const prof = voluntariosList.find(p => p.name === val || p.id === val);
                        if (prof && prof.id) {
                            const item = {
                                service_id: serviceId,
                                user_id: prof.id,
                                role_name: roleName
                            };
                            if (roleId) item.role_id = roleId;
                            if (churchId) item.church_id = churchId;
                            scalesToInsert.push(item);
                        }
                    }
                });

                // B) Cantores do Culto
                if (Array.isArray(cantoresCultoAtual)) {
                    cantoresCultoAtual.forEach(nomeCantor => {
                        if (nomeCantor) {
                            const prof = voluntariosList.find(p => p.name === nomeCantor || p.id === nomeCantor);
                            const item = {
                                service_id: serviceId,
                                role_name: 'cantor'
                            };
                            if (prof && prof.id) item.user_id = prof.id;
                            if (cantorRoleId) item.role_id = cantorRoleId;
                            if (churchId) item.church_id = churchId;
                            scalesToInsert.push(item);
                        }
                    });
                }

                if (scalesToInsert.length > 0) {
                    const { error: scalesErr } = await supabaseClient.from('service_scales').insert(scalesToInsert);
                    if (scalesErr) {
                        console.warn('Aviso ao inserir service_scales:', scalesErr);
                    }
                }
            } catch (errScale) {
                console.warn('Erro ao processar salvamento de service_scales:', errScale);
            }
        }

        // 4. Inserir itens associados em 'service_songs'
        if (musicasCultoAtual && musicasCultoAtual.length > 0 && serviceId) {
            for (let idx = 0; idx < musicasCultoAtual.length; idx++) {
                const m = musicasCultoAtual[idx];
                let vId = m.song_version_id || m.version_id || null;

                if (!vId && m.nome) {
                    try {
                        const { data: sData } = await supabaseClient
                            .from('songs')
                            .select('id, song_versions(id)')
                            .eq('title', m.nome)
                            .maybeSingle();

                        if (sData && sData.song_versions && sData.song_versions.length > 0) {
                            vId = sData.song_versions[0].id;
                        }
                    } catch (errSearch) {
                        console.warn('Erro ao buscar song_version_id para:', m.nome, errSearch);
                    }
                }

                if (vId) {
                    const { error: songInsertErr } = await supabaseClient
                        .from('service_songs')
                        .insert({
                            service_id: serviceId,
                            song_version_id: vId,
                            song_order: idx + 1,
                            singers_list: Array.isArray(m.cantores) ? m.cantores.join(', ') : (m.cantores || '')
                        });
                    if (songInsertErr) {
                        console.warn('Aviso ao inserir service_song:', songInsertErr);
                    }
                }
            }
        }

        // 5. Pós-gravação
        fecharModalCulto();
        await carregarDados();
        mostrarToast('Culto e músicas salvos com sucesso no Supabase!', 'sucesso');
    } catch (err) {
        console.error('Erro ao salvar culto no Supabase:', err);
        erroEl.textContent = 'Erro ao salvar. Tente novamente.';
        erroEl.classList.remove('hidden');
    } finally {
        btn.textContent = 'Salvar Culto';
        btn.disabled = false;
    }
}

// ===================== MOTOR DE ESCALA INTELIGENTE (ALERTAS DE FADIGA E CONFLITOS) =====================

function verificarAlertasEscalacao(selectId, nomeOuId) {
    const containerAviso = document.getElementById(`aviso-${selectId}`);
    if (!containerAviso) return;
    containerAviso.innerHTML = '';

    if (!nomeOuId) return;

    const dataCultoStr = document.getElementById('culto-data').value;
    const voluntariosList = (typeof Store !== 'undefined' && Store.getVoluntarios) ? Store.getVoluntarios() : (window.dadosGlobais?.voluntarios || []);
    const prof = voluntariosList.find(p => p.name === nomeOuId || p.id === nomeOuId);
    if (!prof) return;

    let htmlAviso = '';

    // 1. Checar Conflito Cruzado no Mesmo Culto / Formulário
    let conflitoNoForm = false;
    const outrosSelects = document.querySelectorAll('.escala-dinamica-input');
    outrosSelects.forEach(sel => {
        if (sel.id !== selectId && sel.value === nomeOuId) {
            conflitoNoForm = true;
        }
    });

    if (conflitoNoForm) {
        htmlAviso += `<p class="text-[11px] text-red-400 font-semibold flex items-center gap-1">⚠️ Conflito Cruzado: ${prof.name} já selecionado em outra função neste culto!</p>`;
    }

    // 2. Checar Fadiga / Teto Mensal (Burnout Protection)
    const maxPermitido = prof.max_services_per_month || prof.monthly_limit || 4;
    let totalEscalasNoMes = 0;

    if (dataCultoStr) {
        const partes = dataCultoStr.split('-');
        let anoTarget = partes[0];
        let mesTarget = partes[1];
        if (partes.length === 3 && partes[0].length === 2) {
            // Se formato DD/MM/YYYY
            anoTarget = partes[2];
            mesTarget = partes[1];
        }

        const servicesList = window.dadosGlobais?.servicesDataList || [];
        
        servicesList.forEach(s => {
            if (s.date && anoTarget && mesTarget && s.date.includes(`${anoTarget}-${mesTarget}`)) {
                const escalados = s.service_scales || [];
                const estaEscalado = escalados.some(sc => sc.user_id === prof.id || sc.profile_id === prof.id);
                if (estaEscalado) totalEscalasNoMes++;
            }
        });

        if (totalEscalasNoMes >= maxPermitido) {
            htmlAviso += `<p class="text-[11px] text-amber-400 font-semibold flex items-center gap-1">🔥 Risco de Fadiga: ${prof.name} possui ${totalEscalasNoMes} escalas no mês (Limite: ${maxPermitido})</p>`;
        }
    }

    // 3. Checar Disponibilidade Informada pelo Membro na Data do Culto
    if (dataCultoStr) {
        let dataIso = dataCultoStr;
        const pData = dataCultoStr.split('/');
        if (pData.length === 3) dataIso = `${pData[2]}-${pData[1]}-${pData[0]}`;

        const churchId = window.dadosGlobais?.church?.id || prof.church_id;
        const storageKey = `liturge_avail_${churchId}_${prof.id}`;
        try {
            const localAvail = JSON.parse(localStorage.getItem(storageKey) || '{}');
            const itemDisp = localAvail[dataIso];
            if (itemDisp) {
                if (itemDisp.status === 'indisponivel') {
                    const motivoStr = itemDisp.notes ? `: "${itemDisp.notes}"` : '';
                    htmlAviso += `<p class="text-[11px] text-red-400 font-bold flex items-center gap-1">⛔ Indisponível: ${prof.name} informou que NÃO PODE servir nesta data${motivoStr}!</p>`;
                } else if (itemDisp.status === 'disponivel') {
                    htmlAviso += `<p class="text-[11px] text-emerald-400 font-medium flex items-center gap-1">🟢 Disponível: ${prof.name} confirmou disponibilidade para servir nesta data.</p>`;
                }
            }
        } catch(e){}
    }

    containerAviso.innerHTML = htmlAviso;
}

window.verificarAlertasEscalacao = verificarAlertasEscalacao;
window.toggleAccordionCulto = toggleAccordionCulto;
window.toggleAccordionMinisterio = toggleAccordionMinisterio;
window.atualizarBadgeMinisterio = atualizarBadgeMinisterio;
window.recolherTodosAccordionsCulto = recolherTodosAccordionsCulto;
window.expandirTodosAccordionsCulto = expandirTodosAccordionsCulto;
window.toggleTodosAccordionsCulto = toggleTodosAccordionsCulto;
window.atualizarContadoresAccordions = atualizarContadoresAccordions;
window.renderizarMidiasCulto = renderizarMidiasCulto;
window.toggleFormLinkMidiaCulto = toggleFormLinkMidiaCulto;
window.salvarLinkMidiaCulto = salvarLinkMidiaCulto;
window.fazerUploadMidiaCulto = fazerUploadMidiaCulto;
window.removerMidiaCulto = removerMidiaCulto;
