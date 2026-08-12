// ===================== ADMIN: LOGIN =====================

const ADMIN_EMAIL = "joao.marcos.xavier.484@gmail.com";

window.addEventListener('DOMContentLoaded', async () => {
    // Checa se já existe sessão ativa no Supabase Auth
    if (supabaseClient) {
        try {
            const { data } = await supabaseClient.auth.getSession();
            if (data && data.session) {
                isAdmin = true;
                const btnWrapper = document.getElementById('btn-admin-wrapper');
                if (btnWrapper) btnWrapper.classList.remove('hidden');
            }
        } catch (err) {
            console.warn('Erro ao checar sessão do Supabase:', err);
        }
    }

    // 1. Atalho de teclado no computador: Ctrl + Shift + A
    window.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.shiftKey && (e.key === 'A' || e.key === 'a')) {
            e.preventDefault();
            abrirModalAdmin();
        }
    });

    // 2. Acionador no mobile/touch: 5 toques rápidos ou toque longo (2s) no #titulo-site
    const tituloEl = document.getElementById('titulo-site');
    if (tituloEl) {
        let toqueContador = 0;
        let toqueTimer = null;
        let pressTimer = null;

        // 5 toques rápidos
        tituloEl.addEventListener('click', () => {
            toqueContador++;
            if (!toqueTimer) {
                toqueTimer = setTimeout(() => {
                    toqueContador = 0;
                    toqueTimer = null;
                }, 2000);
            }
            if (toqueContador >= 5) {
                clearTimeout(toqueTimer);
                toqueContador = 0;
                toqueTimer = null;
                abrirModalAdmin();
            }
        });

        // Toque longo (2s)
        const iniciarLongPress = () => {
            pressTimer = setTimeout(() => {
                abrirModalAdmin();
            }, 2000);
        };

        const cancelarLongPress = () => {
            if (pressTimer) {
                clearTimeout(pressTimer);
                pressTimer = null;
            }
        };

        tituloEl.addEventListener('touchstart', iniciarLongPress, { passive: true });
        tituloEl.addEventListener('touchend', cancelarLongPress);
        tituloEl.addEventListener('touchcancel', cancelarLongPress);
        tituloEl.addEventListener('mousedown', iniciarLongPress);
        tituloEl.addEventListener('mouseup', cancelarLongPress);
        tituloEl.addEventListener('mouseleave', cancelarLongPress);
    }
});

function abrirModalAdmin() {
    document.getElementById('modal-admin').classList.remove('hidden');
    document.getElementById('input-senha-admin').value = '';
    document.getElementById('erro-senha').classList.add('hidden');
    setTimeout(() => document.getElementById('input-senha-admin').focus(), 100);
}

function fecharModalAdmin() {
    document.getElementById('modal-admin').classList.add('hidden');
}

async function entrarAdmin() {
    const inputSenha = document.getElementById('input-senha-admin');
    const erroSenha = document.getElementById('erro-senha');
    const btnEntrar = document.querySelector('#modal-admin button[onclick="entrarAdmin()"]') || document.querySelector('#modal-admin button:last-child');
    const senha = inputSenha ? inputSenha.value.trim() : '';

    if (!senha) {
        erroSenha.textContent = 'Digite a senha.';
        erroSenha.classList.remove('hidden');
        return;
    }

    const textoOriginalBtn = btnEntrar ? btnEntrar.textContent : 'Entrar';
    if (btnEntrar) {
        btnEntrar.textContent = 'Validando...';
        btnEntrar.disabled = true;
    }
    erroSenha.classList.add('hidden');

    try {
        if (!supabaseClient) {
            throw new Error("Cliente Supabase não inicializado.");
        }

        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email: ADMIN_EMAIL,
            password: senha
        });

        if (!error && data && (data.session || data.user)) {
            isAdmin = true;
            fecharModalAdmin();
            abrirPainelAdmin();
        } else {
            erroSenha.textContent = 'Senha incorreta.';
            erroSenha.classList.remove('hidden');
        }
    } catch (error) {
        console.error('Erro na autenticação Supabase:', error);
        erroSenha.textContent = 'Senha incorreta.';
        erroSenha.classList.remove('hidden');
    } finally {
        if (btnEntrar) {
            btnEntrar.textContent = textoOriginalBtn;
            btnEntrar.disabled = false;
        }
    }
}

async function sairAdmin() {
    try {
        if (supabaseClient) {
            await supabaseClient.auth.signOut();
        }
    } catch (err) {
        console.warn('Erro ao deslogar do Supabase:', err);
    }
    isAdmin = false;
    document.getElementById('painel-admin').classList.add('hidden');
}

// ===================== ADMIN: PAINEL =====================

function abrirPainelAdmin() {
    document.getElementById('painel-admin').classList.remove('hidden');
    renderizarAdminListaCultos();
}

let dragCultoIndex = null;

function onDragStartCulto(e, index) {
    dragCultoIndex = index;
    e.dataTransfer.effectAllowed = 'move';
}

function onDragOverCulto(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
}

async function onDropCulto(e, targetIndex) {
    e.preventDefault();
    if (dragCultoIndex === null || dragCultoIndex === targetIndex) return;

    const rows = dadosGlobais.cultos || [];
    const blocosData = [];
    let blocoAtualData = null;

    for (let i = 0; i < rows.length; i++) {
        const texto = rows[i][0] ? rows[i][0].toString() : '';
        if (texto.includes("CULTO DE")) {
            if (blocoAtualData) blocosData.push(blocoAtualData);
            blocoAtualData = [rows[i]];
        } else if (blocoAtualData) {
            blocoAtualData.push(rows[i]);
        }
    }
    if (blocoAtualData) blocosData.push(blocoAtualData);

    if (dragCultoIndex >= 0 && dragCultoIndex < blocosData.length && targetIndex >= 0 && targetIndex < blocosData.length) {
        const [moved] = blocosData.splice(dragCultoIndex, 1);
        blocosData.splice(targetIndex, 0, moved);

        const novosCultos = [];
        blocosData.forEach(b => b.forEach(row => novosCultos.push(row)));
        dadosGlobais.cultos = novosCultos;

        // Persiste a ordem de data sequencial no Supabase
        if (supabaseClient) {
            const baseTime = new Date();
            for (let i = 0; i < blocosData.length; i++) {
                const tituloBloco = blocosData[i][0][0] ? blocosData[i][0][0].toString() : '';
                const tituloLimpo = tituloBloco.replace(/ - OCULTO/i, '').replace(/ - EM MONTAGEM/i, '').trim();
                const novaData = new Date(baseTime.getTime() + (i * 60000)).toISOString();

                const { data: existing } = await supabaseClient
                    .from('services')
                    .select('id')
                    .or(`title.eq.${tituloBloco},title.eq.${tituloLimpo}`)
                    .maybeSingle();

                if (existing && existing.id) {
                    await supabaseClient
                        .from('services')
                        .update({ date: novaData })
                        .eq('id', existing.id);
                }
            }
        }

        limparCacheLocal();
        await carregarDados();
        mostrarToast('Ordem dos cultos salva no Supabase com sucesso!', 'sucesso');
    }
    dragCultoIndex = null;
}

function renderizarAdminListaCultos() {
    const container = document.getElementById('admin-lista-cultos');
    const rows = dadosGlobais.cultos;
    let html = '';
    let blocos = [];
    let blocoAtual = null;
    let blocoIndex = null;

    for (let i = 0; i < rows.length; i++) {
        const texto = rows[i][0] ? rows[i][0].toString() : '';
        if (texto.includes("CULTO DE")) {
            if (blocoAtual !== null) blocos.push({ titulo: blocoAtual, startIndex: blocoIndex });
            blocoAtual = texto;
            blocoIndex = i;
        }
    }
    if (blocoAtual !== null) blocos.push({ titulo: blocoAtual, startIndex: blocoIndex });

    if (blocos.length === 0) {
        container.innerHTML = '<p class="text-slate-500 text-sm">Nenhum culto encontrado na planilha.</p>';
        return;
    }

    blocos.forEach((bloco, bIdx) => {
        const emMontagem = bloco.titulo.toUpperCase().includes('EM MONTAGEM');
        const oculto = bloco.titulo.toUpperCase().includes('OCULTO');
        const cor = oculto ? 'border-slate-700 bg-slate-800/30 opacity-60'
            : (emMontagem ? 'border-red-700/50 bg-red-900/20' : 'border-slate-700 bg-slate-800/60');
        const corTexto = oculto ? 'text-slate-400' : (emMontagem ? 'text-red-300' : 'text-emerald-300');
        const tituloExibicao = bloco.titulo.replace(/ - OCULTO/i, '').trim();
        html += `
            <div draggable="true" ondragstart="onDragStartCulto(event, ${bIdx})" ondragover="onDragOverCulto(event)" ondrop="onDropCulto(event, ${bIdx})" class="flex items-center justify-between px-4 py-3 rounded-xl border ${cor} gap-3 cursor-move">
                <div class="flex items-center gap-3">
                    <span class="text-slate-500 hover:text-slate-300 font-bold select-none text-base cursor-grab">⣿</span>
                    <span class="text-sm font-semibold ${corTexto} uppercase">${tituloExibicao}${oculto ? ' 🙈' : ''}</span>
                </div>
                <div class="flex gap-2 shrink-0">
                    <button onclick="editarCulto(${bloco.startIndex})" class="bg-slate-700 hover:bg-emerald-700 text-slate-200 hover:text-white px-3 py-1.5 rounded-lg text-xs transition">✏️ Editar</button>
                    <button onclick="excluirCultoAdmin(${bloco.startIndex})" class="bg-slate-700 hover:bg-red-700 text-slate-200 hover:text-white px-3 py-1.5 rounded-lg text-xs transition">🗑️ Excluir</button>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

async function excluirCultoAdmin(startIndex) {
    if (!confirm('Deseja realmente excluir este culto?')) return;

    try {
        const rows = dadosGlobais.cultos;
        if (!rows || !rows[startIndex]) {
            throw new Error("Culto não encontrado.");
        }

        const tituloAlvo = rows[startIndex][0] ? rows[startIndex][0].toString() : '';
        const tituloLimpo = tituloAlvo.replace(/ - OCULTO/i, '').replace(/ - EM MONTAGEM/i, '').trim();

        if (supabaseClient) {
            const { data: servicesData } = await supabaseClient
                .from('services')
                .select('id, title');

            const targetService = (servicesData || []).find(s => {
                const t = s.title ? s.title.replace(/ - OCULTO/i, '').replace(/ - EM MONTAGEM/i, '').trim() : '';
                return s.title === tituloAlvo || t === tituloLimpo;
            });

            if (targetService && targetService.id) {
                await supabaseClient.from('service_songs').delete().eq('service_id', targetService.id);
                const { error } = await supabaseClient.from('services').delete().eq('id', targetService.id);
                if (error) throw error;
            }
        }

        limparCacheLocal();
        await carregarDados();
        mostrarToast('Culto excluído com sucesso!', 'sucesso');
    } catch (err) {
        console.error('Erro ao excluir culto:', err);
        mostrarToast('Erro ao excluir culto.', 'erro');
    }
}

// ===================== ADMIN: GERENCIAMENTO DE EQUIPE =====================

function mudarAbaAdmin(aba) {
    const abas = {
        cultos: document.getElementById('admin-aba-cultos'),
        equipe: document.getElementById('admin-aba-equipe'),
        repertorio: document.getElementById('admin-aba-repertorio'),
        novas: document.getElementById('admin-aba-novas'),
        solicitacoes: document.getElementById('admin-aba-solicitacoes')
    };

    const botoes = {
        cultos: document.getElementById('btn-admin-aba-cultos'),
        equipe: document.getElementById('btn-admin-aba-equipe'),
        repertorio: document.getElementById('btn-admin-aba-repertorio'),
        novas: document.getElementById('btn-admin-aba-novas'),
        solicitacoes: document.getElementById('btn-admin-aba-solicitacoes')
    };

    const ativo = "px-4 py-2 rounded-xl text-sm font-medium bg-emerald-600 text-white shadow";
    const inativo = "px-4 py-2 rounded-xl text-sm font-medium bg-slate-800 text-slate-300 hover:bg-slate-700";

    Object.keys(abas).forEach(key => {
        if (abas[key]) abas[key].classList.toggle('hidden', key !== aba);
        if (botoes[key]) botoes[key].className = key === aba ? ativo : inativo;
    });

    if (aba === 'cultos') renderizarAdminListaCultos();
    else if (aba === 'equipe') renderizarAdminListaEquipe();
    else if (aba === 'repertorio') renderizarAdminListaRepertorio();
    else if (aba === 'novas') renderizarAdminListaNovas();
    else if (aba === 'solicitacoes') renderizarAdminListaSolicitacoes();
}

async function renderizarAdminListaEquipe() {
    const container = document.getElementById('admin-lista-equipe');
    if (!container) return;
    container.innerHTML = '<p class="text-slate-500 text-sm">Carregando integrantes...</p>';

    try {
        let profiles = [];
        if (supabaseClient) {
            const { data, error } = await supabaseClient.from('profiles').select('*').order('name', { ascending: true });
            if (!error && data) profiles = data;
        }

        if (profiles.length === 0 && dadosGlobais.cantores && dadosGlobais.cantores.length > 1) {
            profiles = dadosGlobais.cantores.slice(1).map((row, idx) => ({
                id: `local-${idx}`,
                name: row[0] || '',
                phone: row[1] || '',
                instruments: row[2] ? row[2].split(',').map(s => s.trim()) : [],
                role: 'volunteer'
            }));
        }

        if (profiles.length === 0) {
            container.innerHTML = '<p class="text-slate-500 text-sm">Nenhum integrante cadastrado.</p>';
            return;
        }

        container.innerHTML = profiles.map(p => {
            const idEscapado = (p.id || '').toString().replace(/'/g, "\\'");
            const nome = p.name || 'Sem Nome';
            const telefone = p.phone || p.telefone || 'Não informado';
            const insts = Array.isArray(p.instruments) ? p.instruments.join(', ') : (p.instruments || p.role || '');
            const roleLabel = p.role === 'admin' ? '⚙️ Admin' : '👤 Voluntário';
            const profileDataStr = JSON.stringify(p).replace(/'/g, "&apos;");

            return `
                <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 rounded-xl border border-slate-700 bg-slate-800/60 gap-3">
                    <div>
                        <div class="flex items-center gap-2">
                            <h3 class="font-bold text-white text-base">${nome}</h3>
                            <span class="bg-slate-700 text-slate-300 text-xs px-2 py-0.5 rounded">${roleLabel}</span>
                        </div>
                        <p class="text-xs text-slate-400 mt-1">📱 ${telefone} | 🎸 ${insts || 'Sem função'}</p>
                    </div>
                    <div class="flex gap-2 shrink-0">
                        <button onclick='editarIntegranteEquipe(${profileDataStr})' class="bg-slate-700 hover:bg-emerald-700 text-slate-200 hover:text-white px-3 py-1.5 rounded-lg text-xs transition">✏️ Editar</button>
                        <button onclick="excluirIntegranteEquipe('${idEscapado}')" class="bg-slate-700 hover:bg-red-700 text-slate-200 hover:text-white px-3 py-1.5 rounded-lg text-xs transition">🗑️ Excluir</button>
                    </div>
                </div>
            `;
        }).join('');
    } catch (err) {
        console.error('Erro ao listar equipe:', err);
        container.innerHTML = '<p class="text-red-400 text-sm">Erro ao carregar lista da equipe.</p>';
    }
}

const LISTA_FUNCOES = ['Violão', 'Bateria', 'Teclado', 'Cantor', 'Projeção', 'Iluminação'];

function abrirModalEquipe(profile = null) {
    const modal = document.getElementById('modal-equipe');
    const tituloEl = document.getElementById('modal-equipe-titulo');
    const inputId = document.getElementById('equipe-id');
    const inputNome = document.getElementById('equipe-nome');
    const inputEmail = document.getElementById('equipe-email');
    const inputTelefone = document.getElementById('equipe-telefone');
    const selectRole = document.getElementById('equipe-role');
    const chipsContainer = document.getElementById('equipe-instrumentos-chips');

    if (!modal) return;

    if (profile) {
        tituloEl.textContent = 'Editar Integrante';
        inputId.value = profile.id || '';
        inputNome.value = profile.name || '';
        inputEmail.value = profile.email || '';
        inputTelefone.value = profile.phone || profile.telefone || '';
        selectRole.value = profile.role || 'volunteer';
    } else {
        tituloEl.textContent = 'Novo Integrante';
        inputId.value = '';
        inputNome.value = '';
        inputEmail.value = '';
        inputTelefone.value = '';
        selectRole.value = 'volunteer';
    }

    const selecionados = profile && Array.isArray(profile.instruments)
        ? profile.instruments
        : (profile && profile.instruments ? profile.instruments.split(',').map(s => s.trim()) : []);

    chipsContainer.innerHTML = LISTA_FUNCOES.map(func => {
        const checked = selecionados.includes(func) ? 'checked' : '';
        return `
            <label class="inline-flex items-center gap-1.5 bg-slate-900 border border-slate-700 px-3 py-1.5 rounded-lg text-xs text-slate-200 cursor-pointer hover:border-emerald-500">
                <input type="checkbox" name="equipe-funcao" value="${func}" ${checked} class="accent-emerald-500 rounded">
                ${func}
            </label>
        `;
    }).join('');

    modal.classList.remove('hidden');
}

function editarIntegranteEquipe(profile) {
    abrirModalEquipe(profile);
}

function fecharModalEquipe() {
    const modal = document.getElementById('modal-equipe');
    if (modal) modal.classList.add('hidden');
}

async function salvarIntegranteEquipe() {
    const id = document.getElementById('equipe-id').value;
    const nome = document.getElementById('equipe-nome').value.trim();
    const email = document.getElementById('equipe-email').value.trim();
    const telefone = document.getElementById('equipe-telefone').value.trim();
    const role = document.getElementById('equipe-role').value;

    const checkboxes = document.querySelectorAll('input[name="equipe-funcao"]:checked');
    const funcoes = Array.from(checkboxes).map(cb => cb.value);

    if (!nome) {
        mostrarToast('Informe o nome do integrante.', 'aviso');
        return;
    }

    const btn = document.getElementById('btn-salvar-equipe');
    if (btn) { btn.disabled = true; btn.textContent = 'Salvando...'; }

    try {
        if (!supabaseClient) {
            throw new Error("Cliente Supabase não inicializado.");
        }

        let churchId = null;
        try {
            const { data: cData } = await supabaseClient.from('churches').select('id').limit(1);
            if (cData && cData.length > 0) churchId = cData[0].id;
        } catch (e) {}

        const profilePayload = {
            name: nome,
            email: email,
            phone: telefone,
            instruments: Array.isArray(funcoes) ? funcoes.join(', ') : (funcoes || ''),
            role: role
        };
        if (churchId) profilePayload.church_id = churchId;

        if (id && !id.startsWith('local-')) {
            profilePayload.id = id;
        }

        const { error } = await supabaseClient
            .from('profiles')
            .upsert(profilePayload);

        if (error) throw error;

        limparCacheLocal();
        fecharModalEquipe();
        await carregarDados();
        renderizarAdminListaEquipe();
        if (typeof popularSelectsInstrumentos === 'function') popularSelectsInstrumentos();
        if (typeof renderizarCantoresCulto === 'function') renderizarCantoresCulto();
        mostrarToast('Integrante salvo com sucesso no Supabase!', 'sucesso');
    } catch (err) {
        console.error('Erro ao salvar integrante:', err);
        mostrarToast('Erro ao salvar integrante no Supabase.', 'erro');
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = 'Salvar Integrante'; }
    }
}

async function excluirIntegranteEquipe(id) {
    if (!confirm('Deseja realmente remover este integrante da equipe?')) return;

    try {
        if (supabaseClient && id && !id.startsWith('local-')) {
            const { error } = await supabaseClient.from('profiles').delete().eq('id', id);
            if (error) throw error;
        }

        limparCacheLocal();
        await carregarDados();
        renderizarAdminListaEquipe();
        if (typeof popularSelectsInstrumentos === 'function') popularSelectsInstrumentos();
        mostrarToast('Integrante removido com sucesso!', 'sucesso');
    } catch (err) {
        console.error('Erro ao excluir integrante:', err);
        mostrarToast('Erro ao excluir integrante.', 'erro');
    }
}

// ===================== ADMIN: REPERTÓRIO GERAL E MÚSICAS NOVAS =====================

let adminSongsCache = [];

async function renderizarAdminListaRepertorio() {
    const container = document.getElementById('admin-lista-repertorio');
    if (!container) return;
    container.innerHTML = '<p class="text-slate-500 text-sm">Carregando músicas do banco...</p>';

    try {
        if (supabaseClient) {
            const { data, error } = await supabaseClient
                .from('songs')
                .select('id, title, status, song_versions(id, key, variation, drive_vs_url, youtube_url)')
                .neq('status', 'nova')
                .order('title', { ascending: true });

            if (!error && data) {
                adminSongsCache = data;
            }
        }

        filtrarAdminRepertorio();
    } catch (err) {
        console.error('Erro ao carregar repertório admin:', err);
        container.innerHTML = '<p class="text-red-400 text-sm">Erro ao carregar banco de músicas.</p>';
    }
}

function filtrarAdminRepertorio() {
    const container = document.getElementById('admin-lista-repertorio');
    const inputBusca = document.getElementById('admin-search-repertorio');
    if (!container) return;

    const termo = inputBusca ? inputBusca.value.toLowerCase().trim() : '';

    const filtradas = adminSongsCache.filter(song => {
        const title = (song.title || '').toLowerCase();
        return title.includes(termo);
    });

    if (filtradas.length === 0) {
        container.innerHTML = '<p class="text-slate-500 text-sm">Nenhuma música encontrada.</p>';
        return;
    }

    container.innerHTML = filtradas.map(song => {
        let versoesHtml = '';
        if (song.song_versions && song.song_versions.length > 0) {
            versoesHtml = song.song_versions.map((v, index) => {
                const tom = v.key || 'N/A';
                const variacao = v.variation || 'Original';
                return `<div class="mt-2 text-xs text-slate-400">🎵 Tom: <span class="text-emerald-300 font-semibold">${tom} (${variacao})</span></div>`;
            }).join('');
        }

        return `
            <div class="flex flex-col p-4 rounded-xl border border-slate-700 bg-slate-800/60 gap-3 mb-2">
                <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <h3 class="font-bold text-white text-base">${song.title || 'Sem Título'}</h3>
                    <div class="flex gap-2 shrink-0">
                        <button onclick="abrirModalEditarMusicaAdmin('${song.id}')" class="text-xs bg-slate-700 hover:bg-slate-600 text-amber-300 px-2 py-1.5 rounded transition">✏️ Editar</button>
                        <button onclick="abrirModalNovaVersao('${song.id}')" class="text-xs bg-slate-700 hover:bg-slate-600 text-emerald-400 px-2 py-1.5 rounded transition">+ Versão</button>
                        <button onclick="excluirMusicaAdmin('${song.id}')" class="bg-slate-700 hover:bg-red-700 text-slate-200 hover:text-white px-3 py-1.5 rounded-lg text-xs transition">🗑️ Excluir</button>
                    </div>
                </div>
                <div>${versoesHtml}</div>
            </div>
        `;
    }).join('');
}

async function excluirMusicaAdmin(songId) {
    if (!confirm('Deseja realmente excluir esta música do banco?')) return;

    try {
        if (supabaseClient && songId) {
            await supabaseClient.from('song_versions').delete().eq('song_id', songId);
            const { error } = await supabaseClient.from('songs').delete().eq('id', songId);
            if (error) throw error;
        }

        limparCacheLocal();
        await carregarDados();
        await renderizarAdminListaRepertorio();
        mostrarToast('Música excluída com sucesso!', 'sucesso');
    } catch (err) {
        console.error('Erro ao excluir música:', err);
        mostrarToast('Erro ao excluir música do banco.', 'erro');
    }
}

async function renderizarAdminListaNovas() {
    const container = document.getElementById('admin-lista-novas');
    if (!container) return;
    container.innerHTML = '<p class="text-slate-500 text-sm">Carregando músicas novas...</p>';

    try {
        let novas = [];
        if (supabaseClient) {
            const { data, error } = await supabaseClient
                .from('songs')
                .select('id, title, status, song_versions(id, key, variation)')
                .eq('status', 'nova')
                .order('title', { ascending: true });

            if (!error && data) novas = data;
        }

        if (novas.length === 0) {
            container.innerHTML = '<p class="text-slate-500 text-sm">Nenhuma música nova aguardando aprovação.</p>';
            return;
        }

        container.innerHTML = novas.map(song => {
            let versoesHtml = '';
            if (song.song_versions && song.song_versions.length > 0) {
                versoesHtml = song.song_versions.map((v, index) => {
                    const tom = v.key || 'N/A';
                    const variacao = v.variation || 'Original';
                    return `<div class="mt-2 text-xs text-slate-400">🎵 Tom: <span class="text-emerald-300 font-semibold">${tom} (${variacao})</span></div>`;
                }).join('');
            }

            return `
                <div class="flex flex-col p-4 rounded-xl border border-violet-700/50 bg-violet-900/20 gap-3 mb-2">
                    <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <div class="flex items-center gap-2">
                            <h3 class="font-bold text-white text-base">${song.title || 'Sem Título'}</h3>
                            <span class="bg-violet-800/60 text-violet-300 text-xs px-2 py-0.5 rounded font-medium">🌟 Nova</span>
                        </div>
                        <div class="flex gap-2 shrink-0">
                            <button onclick="abrirModalEditarMusicaAdmin('${song.id}')" class="text-xs bg-slate-700 hover:bg-slate-600 text-amber-300 px-2 py-1.5 rounded transition">✏️ Editar</button>
                            <button onclick="abrirModalNovaVersao('${song.id}')" class="text-xs bg-slate-700 hover:bg-slate-600 text-emerald-400 px-2 py-1.5 rounded transition">+ Versão</button>
                            <button onclick="aprovarMusicaNovaAdmin('${song.id}')" class="bg-violet-600 hover:bg-violet-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition">🌟 Aprovar</button>
                            <button onclick="excluirMusicaAdmin('${song.id}')" class="bg-slate-700 hover:bg-red-700 text-slate-200 hover:text-white px-3 py-1.5 rounded-lg text-xs transition">🗑️ Excluir</button>
                        </div>
                    </div>
                    <div>${versoesHtml}</div>
                </div>
            `;
        }).join('');
    } catch (err) {
        console.error('Erro ao carregar músicas novas admin:', err);
        container.innerHTML = '<p class="text-red-400 text-sm">Erro ao carregar músicas novas.</p>';
    }
}

async function aprovarMusicaNovaAdmin(songId) {
    try {
        if (!supabaseClient || !songId) throw new Error("Cliente ou ID inválido.");

        const { error } = await supabaseClient
            .from('songs')
            .update({ status: 'ativo' })
            .eq('id', songId);

        if (error) throw error;

        limparCacheLocal();
        await carregarDados();
        await renderizarAdminListaNovas();
        mostrarToast('Música aprovada e movida para o Banco!', 'sucesso');
    } catch (err) {
        console.error('Erro ao aprovar música nova:', err);
        mostrarToast('Erro ao aprovar música.', 'erro');
    }
}

// ===================== ADMIN: SOLICITAÇÕES =====================

async function renderizarAdminListaSolicitacoes() {
    const container = document.getElementById('admin-lista-solicitacoes');
    if (!container) return;
    container.innerHTML = '<p class="text-slate-500 text-sm">Carregando solicitações...</p>';

    try {
        let comments = [];
        if (supabaseClient) {
            const { data, error } = await supabaseClient
                .from('availability_comments')
                .select('*')
                .order('created_at', { ascending: false });

            if (!error && data) comments = data;
        }

        if (comments.length === 0) {
            container.innerHTML = '<p class="text-slate-500 text-sm">Nenhuma solicitação pendente.</p>';
            return;
        }

        container.innerHTML = comments.map(item => {
            const idEscapado = (item.id || '').toString().replace(/'/g, "\\'");
            const categoria = item.category || 'Ajuste de Tom';
            const texto = item.comment_text || '';
            const dataStr = item.created_at
                ? new Date(item.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
                : '';

            return `
                <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 rounded-xl border border-slate-700 bg-slate-800/60 gap-3">
                    <div>
                        <div class="flex items-center gap-2">
                            <span class="bg-amber-900/60 text-amber-300 border border-amber-700/50 text-xs px-2.5 py-0.5 rounded-full font-medium">💬 ${categoria}</span>
                            ${dataStr ? `<span class="text-xs text-slate-500">${dataStr}</span>` : ''}
                        </div>
                        <p class="text-sm text-white font-medium mt-2">${texto}</p>
                    </div>
                    <div class="flex gap-2 shrink-0">
                        <button onclick="excluirSolicitacaoAdmin('${idEscapado}')" class="bg-slate-700 hover:bg-emerald-700 text-slate-200 hover:text-white px-3 py-1.5 rounded-lg text-xs transition font-medium">🗑️ Concluir / Remover</button>
                    </div>
                </div>
            `;
        }).join('');
    } catch (err) {
        console.error('Erro ao carregar solicitações admin:', err);
        container.innerHTML = '<p class="text-red-400 text-sm">Erro ao carregar solicitações.</p>';
    }
}

async function excluirSolicitacaoAdmin(id) {
    try {
        if (!supabaseClient || !id) throw new Error("Cliente ou ID inválido.");

        const { error } = await supabaseClient
            .from('availability_comments')
            .delete()
            .eq('id', id);

        if (error) throw error;

        await renderizarAdminListaSolicitacoes();
        mostrarToast('Solicitação concluída!', 'sucesso');
    } catch (err) {
        console.error('Erro ao excluir solicitação:', err);
        mostrarToast('Erro ao remover solicitação.', 'erro');
    }
}

// ===================== ADMIN: CRIAÇÃO DE MÚSICA =====================

function abrirModalMusicaAdmin() {
    const modal = document.getElementById('modal-musica-admin');
    if (!modal) return;

    document.getElementById('admin-musica-titulo').value = '';
    document.getElementById('admin-musica-tom').value = '';
    document.getElementById('admin-musica-variacao').value = '';
    document.getElementById('admin-musica-vs').value = '';
    document.getElementById('admin-musica-yt').value = '';
    document.getElementById('admin-musica-status').value = 'ativo';

    modal.classList.remove('hidden');
}

function fecharModalMusicaAdmin() {
    const modal = document.getElementById('modal-musica-admin');
    if (modal) modal.classList.add('hidden');
}

async function salvarMusicaAdmin() {
    const titulo = document.getElementById('admin-musica-titulo').value.trim();
    const tom = document.getElementById('admin-musica-tom').value.trim();
    const variacao = document.getElementById('admin-musica-variacao').value.trim() || 'Original';
    const vsUrl = document.getElementById('admin-musica-vs').value.trim();
    const ytUrl = document.getElementById('admin-musica-yt').value.trim();
    const status = document.getElementById('admin-musica-status').value;

    if (!titulo) {
        mostrarToast('Informe o título da música.', 'aviso');
        return;
    }

    const btn = document.getElementById('btn-salvar-musica-admin');
    if (btn) { btn.disabled = true; btn.textContent = 'Salvando...'; }

    try {
        if (!supabaseClient) {
            throw new Error("Cliente Supabase não inicializado.");
        }

        let churchId = null;
        try {
            const { data: cData } = await supabaseClient.from('churches').select('id').limit(1);
            if (cData && cData.length > 0) churchId = cData[0].id;
        } catch (e) {}

        const songPayload = {
            title: titulo,
            status: status
        };
        if (churchId) songPayload.church_id = churchId;

        // 1. Inserir na tabela 'songs'
        const { data: newSong, error: songErr } = await supabaseClient
            .from('songs')
            .insert(songPayload)
            .select('id')
            .single();

        if (songErr) throw songErr;

        // 2. Inserir a versão inicial na tabela 'song_versions'
        if (newSong && newSong.id) {
            const { error: versionErr } = await supabaseClient
                .from('song_versions')
                .insert({
                    song_id: newSong.id,
                    key: tom,
                    variation: variacao,
                    drive_vs_url: vsUrl,
                    youtube_url: ytUrl
                });

            if (versionErr) console.warn('Aviso ao criar versão da música:', versionErr);
        }

        limparCacheLocal();
        fecharModalMusicaAdmin();
        await carregarDados();
        if (status === 'nova') {
            await renderizarAdminListaNovas();
        } else {
            await renderizarAdminListaRepertorio();
        }
        mostrarToast('Música adicionada com sucesso!', 'sucesso');
    } catch (err) {
        console.error('Erro ao salvar música admin:', err);
        mostrarToast('Erro ao adicionar música no Supabase.', 'erro');
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = 'Salvar Música'; }
    }
}

// ===================== ADMIN: NOVA VERSÃO DA MÚSICA =====================

function abrirModalNovaVersao(songId) {
    if (!songId) return;
    
    let musica = null;
    const repertorio = dadosGlobais.repertorio || [];
    const novas = dadosGlobais.novas || [];
    
    musica = repertorio.find(m => m.id === songId) || novas.find(m => m.id === songId);
    
    if (!musica) {
        mostrarToast('Música não encontrada no cache.', 'erro');
        return;
    }

    document.getElementById('versao-admin-song-id').value = songId;
    document.getElementById('versao-admin-musica-titulo').textContent = musica.title;
    
    document.getElementById('versao-admin-tom').value = '';
    document.getElementById('versao-admin-variacao').value = '';
    document.getElementById('versao-admin-vs').value = '';
    document.getElementById('versao-admin-yt').value = '';
    
    const btn = document.getElementById('btn-salvar-versao-admin');
    if(btn) { btn.disabled = false; btn.textContent = 'Salvar Versão'; }

    document.getElementById('modal-versao-admin').classList.remove('hidden');
}

function fecharModalNovaVersao() {
    document.getElementById('modal-versao-admin').classList.add('hidden');
}

async function salvarNovaVersao() {
    const songId = document.getElementById('versao-admin-song-id').value;
    const tom = document.getElementById('versao-admin-tom').value.trim();
    const variacao = document.getElementById('versao-admin-variacao').value.trim() || 'Original';
    const vsUrl = document.getElementById('versao-admin-vs').value.trim();
    const ytUrl = document.getElementById('versao-admin-yt').value.trim();

    if (!songId || !tom) {
        mostrarToast('Informe o tom da nova versão.', 'aviso');
        return;
    }

    const btn = document.getElementById('btn-salvar-versao-admin');
    if (btn) { btn.disabled = true; btn.textContent = 'Salvando...'; }

    try {
        if (!supabaseClient) throw new Error("Cliente Supabase não inicializado.");

        const { error: versionErr } = await supabaseClient
            .from('song_versions')
            .insert({
                song_id: songId,
                key: tom,
                variation: variacao,
                drive_vs_url: vsUrl,
                youtube_url: ytUrl
            });

        if (versionErr) throw versionErr;

        limparCacheLocal();
        fecharModalNovaVersao();
        await carregarDados();
        mostrarToast('Versão adicionada com sucesso!', 'sucesso');
        
    } catch (err) {
        console.error("Erro ao salvar versão:", err);
        mostrarToast('Erro ao salvar versão.', 'erro');
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = 'Salvar Versão'; }
    }
}


// ===================== ADMIN: EDITAR MÚSICA E VERSÕES =====================

async function abrirModalEditarMusicaAdmin(songId) {
    if (!songId) return;

    let song = null;
    try {
        if (supabaseClient) {
            const { data, error } = await supabaseClient
                .from('songs')
                .select('id, title, status, song_versions(id, key, variation, drive_vs_url, youtube_url)')
                .eq('id', songId)
                .single();
            if (!error && data) song = data;
        }
    } catch (e) {}

    if (!song) {
        const rep = adminSongsCache.find(s => s.id === songId);
        if (rep) song = rep;
    }

    if (!song) {
        mostrarToast('Música não encontrada.', 'erro');
        return;
    }

    document.getElementById('edit-admin-song-id').value = song.id;
    document.getElementById('edit-admin-musica-titulo').value = song.title || '';
    document.getElementById('edit-admin-musica-status').value = song.status || 'ativo';

    const containerVersoes = document.getElementById('edit-admin-lista-versoes');
    const versoes = song.song_versions || [];

    if (versoes.length === 0) {
        containerVersoes.innerHTML = '<p class="text-slate-500 text-xs">Nenhuma versão cadastrada ainda.</p>';
    } else {
        containerVersoes.innerHTML = versoes.map((v, i) => `
            <div class="bg-slate-900 p-3 rounded-xl border border-slate-700 space-y-2" data-version-id="${v.id}">
                <div class="flex justify-between items-center">
                    <span class="text-xs font-semibold text-emerald-400">Versão ${i + 1}</span>
                    ${versoes.length > 1 ? `<button type="button" onclick="excluirVersaoAdmin('${v.id}')" class="text-xs text-red-400 hover:text-red-300">🗑️ Excluir Versão</button>` : ''}
                </div>
                <div class="grid grid-cols-2 gap-2">
                    <div>
                        <label class="text-[10px] text-slate-400 block">Tom</label>
                        <input type="text" id="edit-v-tom-${v.id}" value="${v.key || ''}" placeholder="Ex: G"
                            class="w-full bg-slate-800 border border-slate-700 px-2 py-1 rounded text-xs text-white">
                    </div>
                    <div>
                        <label class="text-[10px] text-slate-400 block">Variação</label>
                        <input type="text" id="edit-v-var-${v.id}" value="${v.variation || 'Original'}" placeholder="Ex: Original"
                            class="w-full bg-slate-800 border border-slate-700 px-2 py-1 rounded text-xs text-white">
                    </div>
                </div>
                <div>
                    <label class="text-[10px] text-slate-400 block">Link do VS (Google Drive)</label>
                    <input type="text" id="edit-v-vs-${v.id}" value="${v.drive_vs_url || ''}" placeholder="https://drive.google.com/..."
                        class="w-full bg-slate-800 border border-slate-700 px-2 py-1 rounded text-xs text-white">
                </div>
                <div>
                    <label class="text-[10px] text-slate-400 block">Links do YouTube (Separe múltiplos por vírgula ou linha)</label>
                    <textarea id="edit-v-yt-${v.id}" rows="2" placeholder="https://youtube.com/...
https://youtube.com/..."
                        class="w-full bg-slate-800 border border-slate-700 px-2 py-1 rounded text-xs text-white">${v.youtube_url || ''}</textarea>
                </div>
            </div>
        `).join('');
    }

    const btn = document.getElementById('btn-salvar-edit-musica-admin');
    if (btn) { btn.disabled = false; btn.textContent = 'Salvar Alterações'; }

    document.getElementById('modal-editar-musica-admin').classList.remove('hidden');
}

function fecharModalEditarMusicaAdmin() {
    document.getElementById('modal-editar-musica-admin').classList.add('hidden');
}

async function salvarEdicaoMusicaAdmin() {
    const songId = document.getElementById('edit-admin-song-id').value;
    const titulo = document.getElementById('edit-admin-musica-titulo').value.trim();
    const status = document.getElementById('edit-admin-musica-status').value;

    if (!songId || !titulo) {
        mostrarToast('Informe o título da música.', 'aviso');
        return;
    }

    const btn = document.getElementById('btn-salvar-edit-musica-admin');
    if (btn) { btn.disabled = true; btn.textContent = 'Salvando...'; }

    try {
        if (!supabaseClient) throw new Error("Cliente Supabase não inicializado.");

        const { error: songErr } = await supabaseClient
            .from('songs')
            .update({ title: titulo, status: status })
            .eq('id', songId);

        if (songErr) throw songErr;

        const versionElements = document.querySelectorAll('#edit-admin-lista-versoes [data-version-id]');
        for (const el of versionElements) {
            const vId = el.getAttribute('data-version-id');
            const tom = document.getElementById(`edit-v-tom-${vId}`)?.value.trim() || '';
            const variacao = document.getElementById(`edit-v-var-${vId}`)?.value.trim() || 'Original';
            const vsUrl = document.getElementById(`edit-v-vs-${vId}`)?.value.trim() || '';
            const ytUrl = document.getElementById(`edit-v-yt-${vId}`)?.value.trim() || '';

            await supabaseClient
                .from('song_versions')
                .update({
                    key: tom,
                    variation: variacao,
                    drive_vs_url: vsUrl,
                    youtube_url: ytUrl
                })
                .eq('id', vId);
        }

        limparCacheLocal();
        fecharModalEditarMusicaAdmin();
        await carregarDados();
        await renderizarAdminListaRepertorio();
        await renderizarAdminListaNovas();
        mostrarToast('Música atualizada com sucesso!', 'sucesso');

    } catch (err) {
        console.error('Erro ao editar música:', err);
        mostrarToast('Erro ao salvar alterações.', 'erro');
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = 'Salvar Alterações'; }
    }
}

async function excluirVersaoAdmin(versionId) {
    if (!confirm('Deseja excluir esta versão da música?')) return;
    try {
        if (supabaseClient && versionId) {
            const { error } = await supabaseClient.from('song_versions').delete().eq('id', versionId);
            if (error) throw error;
        }
        
        mostrarToast('Versão removida!', 'sucesso');
        const songId = document.getElementById('edit-admin-song-id').value;
        await abrirModalEditarMusicaAdmin(songId);
    } catch (err) {
        console.error('Erro ao excluir versão:', err);
        mostrarToast('Erro ao excluir versão.', 'erro');
    }
}
