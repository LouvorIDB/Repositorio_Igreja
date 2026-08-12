// ===================== ADMIN: CRIAR / EDITAR CULTO =====================

function mostrarFormCulto(startIndex) {
    cultoEditandoIndex = startIndex;
    musicasCultoAtual = [];
    cantoresCultoAtual = [];
    escalaInstrumentos = { violao: '', bateria: '', teclado: '' };

    document.getElementById('status-salvar-culto').classList.add('hidden');
    document.getElementById('erro-salvar-culto').classList.add('hidden');

    if (startIndex === null) {
        document.getElementById('modal-culto-titulo').textContent = 'Novo Culto';
        document.getElementById('culto-data').value = '';
        document.getElementById('culto-tipo').value = 'DOMINGO';
        document.getElementById('culto-em-montagem').checked = false;
        document.getElementById('culto-oculto').checked = false;
    } else {
        const rows = dadosGlobais.cultos;
        const tituloCulto = rows[startIndex][0].toString();
        document.getElementById('modal-culto-titulo').textContent = 'Editar Culto';
        document.getElementById('culto-em-montagem').checked = tituloCulto.toUpperCase().includes('EM MONTAGEM');
        document.getElementById('culto-oculto').checked = tituloCulto.toUpperCase().includes('OCULTO');

        const partes = tituloCulto.split(' - ');
        document.getElementById('culto-data').value = partes[0] || '';
        if (tituloCulto.includes('DOMINGO')) document.getElementById('culto-tipo').value = 'DOMINGO';
        else if (tituloCulto.includes('SABADO')) document.getElementById('culto-tipo').value = 'SABADO';
        else if (tituloCulto.includes('QUARTA')) document.getElementById('culto-tipo').value = 'QUARTA';

        // Lê coluna F: instrumentos (JSON) e coluna G: cantores do culto
        try {
            const colF = rows[startIndex][5] ? rows[startIndex][5].toString() : '{}';
            escalaInstrumentos = JSON.parse(colF);
        } catch(e) { escalaInstrumentos = { violao: '', bateria: '', teclado: '' }; }

        const colG = rows[startIndex][6] ? rows[startIndex][6].toString() : '';
        cantoresCultoAtual = colG ? colG.split(',').map(s => s.trim()).filter(Boolean) : [];

        // Carrega músicas (colunas A-G de cada linha, sendo G os cantores da música)
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

    popularSelectsInstrumentos();
    renderizarCantoresCulto();
    renderizarMusicasCulto();
    document.getElementById('seletor-musica').classList.add('hidden');
    document.getElementById('modal-culto').classList.remove('hidden');
}

function editarCulto(startIndex) { mostrarFormCulto(startIndex); }

function fecharModalCulto() {
    document.getElementById('modal-culto').classList.add('hidden');
}

// ===================== ADMIN: INSTRUMENTISTAS =====================

function popularSelectsInstrumentos() {
    popularSelect('escala-violao', cantoresPorInstrumento('Violão'), escalaInstrumentos.violao || '');
    popularSelect('escala-bateria', cantoresPorInstrumento('Bateria'), escalaInstrumentos.bateria || '');
    popularSelect('escala-teclado', cantoresPorInstrumento('Teclado'), escalaInstrumentos.teclado || '');
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
            ? 'bg-emerald-600 text-white border-emerald-500'
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
                    ? 'bg-emerald-700 text-white border-emerald-600'
                    : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-500';
                return `<button type="button" onclick="toggleCantorMusica(${idx},'${nome.replace(/'/g, "\\'")}')" class="px-2 py-0.5 rounded-full text-xs border transition ${cls}">${ativo ? '✓ ' : ''}${nome}</button>`;
            }).join('');

        return `
            <div draggable="true" ondragstart="onDragStartMusica(event, ${idx})" ondragover="onDragOverMusica(event)" ondrop="onDropMusica(event, ${idx})" class="bg-slate-900 border border-slate-700 px-3 py-2 rounded-lg space-y-2 cursor-move">
                <div class="flex items-center justify-between gap-2">
                    <span class="text-slate-500 hover:text-slate-300 font-bold select-none text-base cursor-grab mr-1">⣿</span>
                    <div class="flex-1 min-w-0">
                        <p class="text-sm text-white font-medium truncate">${m.nome}</p>
                        <p class="text-xs text-emerald-300">${m.tom} ${m.variacao ? '('+m.variacao+')' : ''}</p>
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

    const filtradas = banco.slice(1).filter(row => {
        const nome = row[0] ? row[0].toString().toLowerCase() : '';
        return nome && nome.includes(termo);
    });

    if (filtradas.length === 0) {
        container.innerHTML = '<p class="text-slate-500 text-xs px-2">Nenhuma música encontrada.</p>';
        return;
    }

    container.innerHTML = filtradas.slice(0, 50).map(row => {
        const nome = row[0] || '';
        const tom = row[1] || '';
        const variacao = row[2] || 'Original';
        const vs = row[3] || '';
        const yt = row[4] || '';
        return `
            <button onclick="adicionarMusicaDoBanco('${nome.toString().replace(/'/g, "\\'")}','${tom.toString().replace(/'/g, "\\'")}','${variacao.toString().replace(/'/g, "\\'")}','${vs.toString().replace(/'/g, "\\'")}','${yt.toString().replace(/'/g, "\\'")}')"
                class="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-700 transition flex items-center justify-between gap-2">
                <span class="text-sm text-white truncate">${nome}</span>
                <span class="text-xs text-emerald-300 shrink-0">${tom} (${variacao})</span>
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
    const tipo = document.getElementById('culto-tipo').value;
    const emMontagem = document.getElementById('culto-em-montagem').checked;
    const oculto = document.getElementById('culto-oculto').checked;

    if (!data) { mostrarToast('Preencha a data do culto.', 'aviso'); return; }

    const titulo = `${data} - CULTO DE ${tipo}${emMontagem ? ' - EM MONTAGEM' : ''}${oculto ? ' - OCULTO' : ''}`;

    escalaInstrumentos = {
        violao: document.getElementById('escala-violao').value,
        bateria: document.getElementById('escala-bateria').value,
        teclado: document.getElementById('escala-teclado').value
    };

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

        // 1. Buscar a igreja tenant principal na tabela 'churches'
        let churchId = null;
        try {
            const { data: churches } = await supabaseClient.from('churches').select('id').limit(1);
            if (churches && churches.length > 0) {
                churchId = churches[0].id;
            }
        } catch (e) {
            console.warn('Tabela churches não consultada:', e);
        }

        const serviceData = {
            title: titulo,
            status: oculto ? 'arquivado' : (emMontagem ? 'aberto' : 'confirmado'),
            notes: JSON.stringify({
                escala: escalaInstrumentos,
                cantores: cantoresCultoAtual
            })
        };
        if (cultoEditandoIndex === null) {
            serviceData.date = new Date().toISOString();
        }
        if (churchId) serviceData.church_id = churchId;

        let serviceId = null;

        // 2. Edição vs Novo Culto
        if (cultoEditandoIndex !== null && dadosGlobais.cultos && dadosGlobais.cultos[cultoEditandoIndex]) {
            const tituloAnterior = dadosGlobais.cultos[cultoEditandoIndex][0] ? dadosGlobais.cultos[cultoEditandoIndex][0].toString() : '';
            const tituloLimpo = tituloAnterior.replace(/ - OCULTO/i, '').replace(/ - EM MONTAGEM/i, '').trim();

            const { data: existing } = await supabaseClient
                .from('services')
                .select('id')
                .or(`title.eq.${tituloAnterior},title.eq.${tituloLimpo}`)
                .maybeSingle();

            if (existing && existing.id) {
                serviceId = existing.id;
                const { error: updateErr } = await supabaseClient
                    .from('services')
                    .update(serviceData)
                    .eq('id', serviceId);
                if (updateErr) throw updateErr;

                // Remove músicas associadas antigas para recriar com a nova ordem/cantores
                await supabaseClient.from('service_songs').delete().eq('service_id', serviceId);
            }
        }

        // Se for Novo Culto ou se não encontrou o ID existente para atualizar
        if (!serviceId) {
            const { data: newService, error: insertErr } = await supabaseClient
                .from('services')
                .insert([serviceData])
                .select('id')
                .single();
            if (insertErr) throw insertErr;
            serviceId = newService.id;
        }

        // 3. Inserir itens associados em 'service_songs'
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

        // 4. Pós-gravação
        limparCacheLocal();
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
