// ===================== ADMIN: CRIAR / EDITAR CULTO =====================
let cultoEditandoId = null;
let flatpickrInstancia = null;

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
        document.getElementById('culto-em-montagem').checked = tituloCulto.toUpperCase().includes('EM MONTAGEM');
        document.getElementById('culto-oculto').checked = tituloCulto.toUpperCase().includes('OCULTO');

        const sTarget = (dadosGlobais.services || []).find(s => s.id === cultoEditandoId);
        if (sTarget) {
            if (sTarget.title) if (inputTitulo) inputTitulo.value = sTarget.title;
            
            if (sTarget.date) {
                const parts = sTarget.date.split('T');
                const dateOnly = parts[0];
                if (parts[1] && inputHora) {
                    inputHora.value = parts[1].substring(0, 5);
                }
                const p = dateOnly.split('-');
                if (p.length === 3) dataFormatar = `${p[2]}/${p[1]}/${p[0]}`;
            }
            if (sTarget.location) if (inputLocal) inputLocal.value = sTarget.location;
            if (sTarget.description) if (inputDesc) inputDesc.value = sTarget.description;
        }
        
        if (!dataFormatar) {
            const partes = tituloCulto.split(' - ');
            dataFormatar = partes[0] || '';
            if (inputTitulo) inputTitulo.value = tituloCulto;
        }

        try {
            const colF = rows[startIndex][5] ? rows[startIndex][5].toString() : '{}';
            escalaInstrumentos = JSON.parse(colF);
        } catch(e) { escalaInstrumentos = { violao: '', bateria: '', teclado: '' }; }

        const colG = rows[startIndex][6] ? rows[startIndex][6].toString() : '';
        cantoresCultoAtual = colG ? colG.split(',').map(s => s.trim()).filter(Boolean) : [];

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

    document.getElementById('modal-culto').classList.remove('hidden');
}

function editarCulto(startIndex) { mostrarFormCulto(startIndex); }

function fecharModalCulto() {
    document.getElementById('modal-culto').classList.add('hidden');
}


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
        // Filtra "Cantor" da seção de selects (pois eles têm a seção multiselect própria)
        const rolesFiltrados = roles.filter(r => !r.name.toLowerCase().includes('cantor') && !r.name.toLowerCase().includes('vocal'));

        if (rolesFiltrados.length === 0) return;

        html += `
            <div class="mb-4 bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                <h4 class="text-xs font-bold text-brand-500 mb-3 uppercase tracking-wider">${min.icon || ''} ${min.name}</h4>
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
            
            let optionsHtml = `<option value="">— Nenhum —</option>`;
            listaVoluntarios.forEach(vol => {
                const selected = vol === valorSalvo ? 'selected' : '';
                optionsHtml += `<option value="${vol}" ${selected}>${vol}</option>`;
            });

            html += `
                <div>
                    <label class="text-xs text-slate-400 mb-1 block">${roleName}</label>
                    <select id="${selectId}" data-role-name="${roleName}" data-role-id="${role.id}" onchange="verificarAlertasEscalacao('${selectId}', this.value)" class="escala-dinamica-input w-full bg-slate-950 border border-slate-700 px-3 py-2 rounded-lg text-sm text-white focus:outline-none focus:border-brand-500">
                        ${optionsHtml}
                    </select>
                    <div id="aviso-${selectId}" class="mt-1 space-y-0.5"></div>
                </div>
            `;
        });

        html += `
                </div>
            </div>
        `;
    });

    if (!html) {
        html = '<p class="text-xs text-slate-500">Nenhum campo de escala disponível para o seu acesso.</p>';
    }

    container.innerHTML = html;
}

// ===================== ADMIN: CANTORES DO CULTO =====================

function renderizarCantoresCulto() {
    const container = document.getElementById('culto-cantores-lista');
    const lista = cantoresPorInstrumento('Cantor');

    if (lista.length === 0) {
        container.innerHTML = '<p class="text-slate-500 text-xs">Nenhum cantor cadastrado na aba Cantores com instrumento "Cantor".</p>';
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
    document.getElementById('seletor-musica').classList.add('hidden');
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
    let dataFinalObj = new Date();
    const partesData = data.split('/');
    if (partesData.length === 3) {
        const dia = parseInt(partesData[0], 10);
        const mes = parseInt(partesData[1], 10) - 1;
        const ano = parseInt(partesData[2], 10);
        dataFinalObj = new Date(ano, mes, dia, parseInt(hH || 19), parseInt(mM || 30), 0);
    } else if (partesData.length === 2) {
        const dia = parseInt(partesData[0], 10);
        const mes = parseInt(partesData[1], 10) - 1;
        dataFinalObj = new Date(new Date().getFullYear(), mes, dia, parseInt(hH || 19), parseInt(mM || 30), 0);
    } else {
        const dateParsed = Date.parse(data);
        if (!isNaN(dateParsed)) {
            dataFinalObj = new Date(dateParsed);
            dataFinalObj.setHours(parseInt(hH || 19));
            dataFinalObj.setMinutes(parseInt(mM || 30));
        }
    }

    const diasSemana = ["DOMINGO", "SEGUNDA", "TERÇA", "QUARTA", "QUINTA", "SEXTA", "SÁBADO"];
    const diaIndex = dataFinalObj.getDay();
    let tipo = diasSemana[diaIndex];
    if (diaIndex === 6) tipo = "SABADO";

    const diaStr = String(dataFinalObj.getDate()).padStart(2, '0');
    const mesStr = String(dataFinalObj.getMonth() + 1).padStart(2, '0');
    const dataFormatadaTitle = `${diaStr}/${mesStr}`;

    let titulo = customTitle;
    if (!titulo) {
        titulo = `${dataFormatadaTitle} - CULTO DE ${tipo}${emMontagem ? ' - EM MONTAGEM' : ''}${oculto ? ' - OCULTO' : ''}`;
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

        // 1. Obter a igreja tenant atual a partir do estado global
        const churchId = (typeof dadosGlobais !== 'undefined' && dadosGlobais.church?.id) ? dadosGlobais.church.id : null;

        const serviceData = {
            title: titulo,
            status: oculto ? 'arquivado' : (emMontagem ? 'aberto' : 'confirmado'),
            date: dataFinalObj.toISOString(),
            location: customLocation,
            description: customDesc,
            notes: JSON.stringify({
                escala: escalaInstrumentos,
                cantores: cantoresCultoAtual
            })
        };
        if (churchId) serviceData.church_id = churchId;

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
                    const found = (m.ministry_roles || []).find(r => (r.name || '').toLowerCase().includes('cantor') || (r.name || '').toLowerCase().includes('vocal'));
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
                                user_id: prof.id
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
                            if (prof && prof.id) {
                                const item = {
                                    service_id: serviceId,
                                    user_id: prof.id
                                };
                                if (cantorRoleId) item.role_id = cantorRoleId;
                                if (churchId) item.church_id = churchId;
                                scalesToInsert.push(item);
                            }
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

    containerAviso.innerHTML = htmlAviso;
}

window.verificarAlertasEscalacao = verificarAlertasEscalacao;

