/**
 * MÓDULO: DISPONIBILIDADE DE VOLUNTÁRIOS
 * Liturge - Sistema Eclesiástico
 * Permite que voluntários informem seus dias disponíveis e indisponíveis,
 * além de exibir onde já estão escalados. Integra alertas no editor de cultos.
 */

(function() {
    let mesAtualDisp = new Date().getMonth();
    let anoAtualDisp = new Date().getFullYear();
    let cacheDisponibilidade = {}; // Chave: 'YYYY-MM-DD' -> { status, notes, id }
    let cacheEscalasUsuario = {}; // Chave: 'YYYY-MM-DD' -> [ { serviceTitle, roleName } ]

    /**
     * Retorna o ID da igreja ativa
     */
    function getChurchId() {
        return window.dadosGlobais?.church?.id 
            || (typeof modoSimulacaoPerfil !== 'undefined' && modoSimulacaoPerfil?.church_id)
            || (typeof usuarioLogado !== 'undefined' && usuarioLogado?.church_id)
            || null;
    }

    /**
     * Retorna o perfil ativo (usuário logado ou simulação)
     */
    function getPerfilAtivo() {
        if (typeof modoSimulacaoPerfil !== 'undefined' && modoSimulacaoPerfil) {
            return modoSimulacaoPerfil;
        }
        return window.usuarioLogado || null;
    }

    /**
     * Abre o modal de disponibilidade do membro
     */
    async function abrirModalDisponibilidade(profileIdParam) {
        const modal = document.getElementById('modal-disponibilidade');
        if (!modal) {
            console.warn('[Disponibilidade] Modal modal-disponibilidade não encontrado.');
            return;
        }

        const perfil = getPerfilAtivo();
        if (!perfil && !profileIdParam) {
            alert('Por favor, faça login ou selecione um perfil para gerenciar sua disponibilidade.');
            return;
        }

        const nomeMembro = perfil ? (perfil.name || perfil.nome || 'Voluntário') : 'Voluntário';
        const elNome = document.getElementById('modal-disp-membro-nome');
        if (elNome) elNome.textContent = nomeMembro;

        modal.classList.remove('hidden');
        modal.classList.add('flex');

        await carregarDisponibilidadeMes(anoAtualDisp, mesAtualDisp);
    }
    window.abrirModalDisponibilidade = abrirModalDisponibilidade;

    /**
     * Fecha o modal de disponibilidade
     */
    function fecharModalDisponibilidade() {
        const modal = document.getElementById('modal-disponibilidade');
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }
    }
    window.fecharModalDisponibilidade = fecharModalDisponibilidade;

    /**
     * Navega pelos meses no modal de disponibilidade
     */
    async function navegarMesDisponibilidade(direcao) {
        mesAtualDisp += direcao;
        if (mesAtualDisp > 11) {
            mesAtualDisp = 0;
            anoAtualDisp++;
        } else if (mesAtualDisp < 0) {
            mesAtualDisp = 11;
            anoAtualDisp--;
        }
        await carregarDisponibilidadeMes(anoAtualDisp, mesAtualDisp);
    }
    window.navegarMesDisponibilidade = navegarMesDisponibilidade;

    /**
     * Carrega do Supabase ou localStorage os registros de disponibilidade e escalas do mês
     */
    async function carregarDisponibilidadeMes(ano, mes) {
        const perfil = getPerfilAtivo();
        const churchId = getChurchId();
        const containerGrid = document.getElementById('grid-dias-disponibilidade');
        const tituloMes = document.getElementById('titulo-mes-ano-disponibilidade');

        const nomesMeses = [
            'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
            'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
        ];

        if (tituloMes) {
            tituloMes.textContent = `${nomesMeses[mes]} de ${ano}`;
        }

        if (!containerGrid) return;
        containerGrid.innerHTML = '<div class="col-span-7 py-8 text-center text-xs text-slate-400">Carregando calendário...</div>';

        cacheDisponibilidade = {};
        cacheEscalasUsuario = {};

        const mesPad = String(mes + 1).padStart(2, '0');
        const prefixoData = `${ano}-${mesPad}`;

        // 1. Carregar do Supabase se disponível
        if (window.supabaseClient && perfil?.id) {
            try {
                const { data: dbData, error } = await window.supabaseClient
                    .from('volunteer_availability')
                    .select('*')
                    .eq('profile_id', perfil.id)
                    .gte('date', `${prefixoData}-01`)
                    .lte('date', `${prefixoData}-31`);

                if (!error && Array.isArray(dbData)) {
                    dbData.forEach(item => {
                        cacheDisponibilidade[item.date] = {
                            status: item.status,
                            notes: item.notes || '',
                            id: item.id
                        };
                    });
                }
            } catch (err) {
                console.warn('[Disponibilidade] Erro ao consultar Supabase, usando fallback local:', err);
            }
        }

        // 1.1 Fallback LocalStorage
        const storageKey = `liturge_avail_${churchId}_${perfil?.id}`;
        try {
            const localSaved = JSON.parse(localStorage.getItem(storageKey) || '{}');
            Object.keys(localSaved).forEach(d => {
                if (d.startsWith(prefixoData) && !cacheDisponibilidade[d]) {
                    cacheDisponibilidade[d] = localSaved[d];
                }
            });
        } catch(e) {}

        // 2. Mapear cultos em que o usuário já está escalado neste mês
        if (window.dadosGlobais?.services && perfil?.name) {
            const nomeMembroLower = perfil.name.toLowerCase().trim();
            window.dadosGlobais.services.forEach(serv => {
                if (serv.date && serv.date.startsWith(prefixoData)) {
                    const dataOnly = serv.date.split('T')[0];
                    let escalado = false;
                    let funcao = '';

                    // Checa escala relacional
                    if (Array.isArray(serv.service_scales)) {
                        const esc = serv.service_scales.find(s => 
                            (s.profile_id && s.profile_id === perfil.id) ||
                            (s.profile_name && s.profile_name.toLowerCase().trim() === nomeMembroLower)
                        );
                        if (esc) {
                            escalado = true;
                            funcao = esc.role_name || 'Ministério';
                        }
                    }

                    // Checa cantores em notes
                    if (!escalado && serv.notes) {
                        try {
                            const pn = typeof serv.notes === 'string' ? JSON.parse(serv.notes) : serv.notes;
                            if (Array.isArray(pn.cantores) && pn.cantores.some(c => String(c).toLowerCase().trim() === nomeMembroLower)) {
                                escalado = true;
                                funcao = 'Vocalista';
                            }
                        } catch(e){}
                    }

                    if (escalado) {
                        if (!cacheEscalasUsuario[dataOnly]) cacheEscalasUsuario[dataOnly] = [];
                        cacheEscalasUsuario[dataOnly].push({
                            serviceTitle: serv.title || 'Culto',
                            roleName: funcao
                        });
                    }
                }
            });
        }

        renderizarGradeDisponibilidade(ano, mes);
    }

    /**
     * Renderiza os dias do mês na grade do modal
     */
    function renderizarGradeDisponibilidade(ano, mes) {
        const containerGrid = document.getElementById('grid-dias-disponibilidade');
        if (!containerGrid) return;

        const primeiroDiaSemana = new Date(ano, mes, 1).getDay(); // 0 = Domingo
        const totalDiasNoMes = new Date(ano, mes + 1, 0).getDate();

        const hoje = new Date();
        const hojeStr = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;

        let html = '';

        // Dias de padding antes do início do mês
        for (let i = 0; i < primeiroDiaSemana; i++) {
            html += `<div class="bg-slate-950/40 border border-slate-800/30 rounded-xl min-h-[70px] opacity-25 select-none"></div>`;
        }

        let countDisponivel = 0;
        let countIndisponivel = 0;
        let countEscalado = 0;

        for (let dia = 1; dia <= totalDiasNoMes; dia++) {
            const diaPad = String(dia).padStart(2, '0');
            const mesPad = String(mes + 1).padStart(2, '0');
            const dataStr = `${ano}-${mesPad}-${diaPad}`;

            const ehHoje = (dataStr === hojeStr);
            const disp = cacheDisponibilidade[dataStr];
            const escalas = cacheEscalasUsuario[dataStr] || [];

            let badgeHtml = '';
            let estiloCard = 'bg-slate-900/80 border-slate-800 hover:border-slate-600';

            if (escalas.length > 0) {
                countEscalado++;
                estiloCard = 'bg-purple-950/40 border-purple-700/60 hover:border-purple-500 shadow-md shadow-purple-950/30';
                badgeHtml = `
                    <div class="mt-1">
                        <span class="text-[9px] bg-purple-900/90 text-purple-200 border border-purple-700/80 px-1.5 py-0.5 rounded font-bold block truncate" title="${escalas.map(e => `${e.serviceTitle} (${e.roleName})`).join(' | ')}">
                            🟣 Escalado
                        </span>
                    </div>
                `;
            } else if (disp?.status === 'disponivel') {
                countDisponivel++;
                estiloCard = 'bg-emerald-950/40 border-emerald-700/60 hover:border-emerald-500 shadow-md shadow-emerald-950/30';
                badgeHtml = `
                    <div class="mt-1">
                        <span class="text-[9px] bg-emerald-900/90 text-emerald-200 border border-emerald-700/80 px-1.5 py-0.5 rounded font-bold block truncate">
                            🟢 Disponível
                        </span>
                    </div>
                `;
            } else if (disp?.status === 'indisponivel') {
                countIndisponivel++;
                estiloCard = 'bg-red-950/40 border-red-700/60 hover:border-red-500 shadow-md shadow-red-950/30';
                badgeHtml = `
                    <div class="mt-1">
                        <span class="text-[9px] bg-red-900/90 text-red-200 border border-red-700/80 px-1.5 py-0.5 rounded font-bold block truncate" title="${disp.notes || 'Indisponível'}">
                            🔴 Indisponível
                        </span>
                        ${disp.notes ? `<p class="text-[8px] text-red-300/80 truncate mt-0.5">${disp.notes}</p>` : ''}
                    </div>
                `;
            } else {
                badgeHtml = `
                    <div class="mt-1">
                        <span class="text-[9px] text-slate-500 block truncate">⚪ Livre</span>
                    </div>
                `;
            }

            html += `
                <div onclick="abrirPromptDisponibilidadeDia('${dataStr}')" 
                     class="p-2 border rounded-xl min-h-[75px] transition cursor-pointer flex flex-col justify-between group ${estiloCard} ${ehHoje ? 'ring-2 ring-brand-500' : ''}">
                    <div class="flex items-center justify-between">
                        <span class="text-xs font-bold ${ehHoje ? 'text-brand-400 bg-brand-950 px-1.5 py-0.2 rounded' : 'text-slate-300'}">${dia}</span>
                        ${ehHoje ? '<span class="text-[8px] text-brand-400 font-semibold uppercase tracking-wider">Hoje</span>' : ''}
                    </div>
                    ${badgeHtml}
                </div>
            `;
        }

        containerGrid.innerHTML = html;

        // Atualiza contadores do rodapé
        const elTotalDisp = document.getElementById('disp-resumo-disponivel');
        const elTotalIndisp = document.getElementById('disp-resumo-indisponivel');
        const elTotalEscalado = document.getElementById('disp-resumo-escalado');

        if (elTotalDisp) elTotalDisp.textContent = `${countDisponivel} dias`;
        if (elTotalIndisp) elTotalIndisp.textContent = `${countIndisponivel} dias`;
        if (elTotalEscalado) elTotalEscalado.textContent = `${countEscalado} cultos`;
    }

    /**
     * Abre prompt rápido ou alterna estado do dia clicado
     */
    async function abrirPromptDisponibilidadeDia(dataStr) {
        const escalas = cacheEscalasUsuario[dataStr] || [];
        if (escalas.length > 0) {
            const detalhe = escalas.map(e => `• ${e.serviceTitle} como ${e.roleName}`).join('\n');
            alert(`Você já está escalado neste dia:\n\n${detalhe}\n\nCaso precise trocar ou não possa comparecer, avise a liderança do ministério.`);
            return;
        }

        const atual = cacheDisponibilidade[dataStr]?.status || 'neutro';
        const parts = dataStr.split('-');
        const dataFmt = `${parts[2]}/${parts[1]}/${parts[0]}`;

        // Mini modal / prompt nativo customizado
        let novoStatus = 'neutro';
        let motivo = '';

        if (atual === 'neutro') {
            novoStatus = 'disponivel';
        } else if (atual === 'disponivel') {
            novoStatus = 'indisponivel';
            motivo = prompt(`Marcar dia ${dataFmt} como INDISPONÍVEL.\nInforme o motivo (opcional: viagem, plantão, trabalho):`, cacheDisponibilidade[dataStr]?.notes || '') || '';
            if (motivo === null) return; // cancelado
        } else {
            novoStatus = 'neutro';
        }

        await salvarDisponibilidadeDia(dataStr, novoStatus, motivo);
    }
    window.abrirPromptDisponibilidadeDia = abrirPromptDisponibilidadeDia;

    /**
     * Salva o status de um dia específico no Supabase e no cache local
     */
    async function salvarDisponibilidadeDia(dataStr, status, notes) {
        const perfil = getPerfilAtivo();
        const churchId = getChurchId();

        if (!perfil?.id || !churchId) {
            alert('Não foi possível identificar o membro logado.');
            return;
        }

        const storageKey = `liturge_avail_${churchId}_${perfil.id}`;
        let localSaved = {};
        try { localSaved = JSON.parse(localStorage.getItem(storageKey) || '{}'); } catch(e){}

        if (status === 'neutro') {
            delete cacheDisponibilidade[dataStr];
            delete localSaved[dataStr];

            if (window.supabaseClient) {
                try {
                    await window.supabaseClient
                        .from('volunteer_availability')
                        .delete()
                        .eq('profile_id', perfil.id)
                        .eq('church_id', churchId)
                        .eq('date', dataStr);
                } catch(e){}
            }
        } else {
            cacheDisponibilidade[dataStr] = { status, notes: notes || '' };
            localSaved[dataStr] = { status, notes: notes || '' };

            if (window.supabaseClient) {
                try {
                    await window.supabaseClient
                        .from('volunteer_availability')
                        .upsert({
                            church_id: churchId,
                            profile_id: perfil.id,
                            date: dataStr,
                            status: status,
                            notes: notes || null
                        }, { onConflict: 'church_id,profile_id,date' });
                } catch(err) {
                    console.warn('[Disponibilidade] Erro no Supabase (salvo localmente):', err);
                }
            }
        }

        try { localStorage.setItem(storageKey, JSON.stringify(localSaved)); } catch(e){}
        renderizarGradeDisponibilidade(anoAtualDisp, mesAtualDisp);
    }
    window.salvarDisponibilidadeDia = salvarDisponibilidadeDia;

    /**
     * Função consumida pelo editor de cultos (culto-editor.js) para obter as disponibilidades de todos os voluntários para uma data específica
     */
    async function obterDisponibilidadeParaData(dataStr) {
        const churchId = getChurchId();
        if (!churchId || !dataStr) return {};

        const dataOnly = dataStr.includes('T') ? dataStr.split('T')[0] : dataStr;
        const mapa = {};

        if (window.supabaseClient) {
            try {
                const { data, error } = await window.supabaseClient
                    .from('volunteer_availability')
                    .select('profile_id, status, notes')
                    .eq('church_id', churchId)
                    .eq('date', dataOnly);

                if (!error && Array.isArray(data)) {
                    data.forEach(item => {
                        mapa[item.profile_id] = {
                            status: item.status,
                            notes: item.notes || ''
                        };
                    });
                }
            } catch(e) {}
        }

        return mapa;
    }
    window.obterDisponibilidadeParaData = obterDisponibilidadeParaData;

})();
