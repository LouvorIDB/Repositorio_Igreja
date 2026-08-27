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
    // Agora o logout completo é feito pelo botão 'Sair' principal da conta.
    // Aqui apenas fechamos o painel para retornar à visão de ministério.
    document.getElementById('painel-admin').classList.add('hidden');
}

// ===================== ADMIN: PAINEL =====================

function abrirPainelAdmin() {
    document.getElementById('painel-admin').classList.remove('hidden');
    
    // Configura visibilidade das abas baseada no RBAC
    const role = usuarioLogado ? (usuarioLogado.system_role || 'membro') : 'visitante';
    const isFullAdmin = (role === 'admin' || role === 'lider');
    
    const tabsToHideIfNotAdmin = ['btn-admin-aba-cultos', 'tab-admin-ministerios', 'btn-admin-aba-repertorio', 'btn-admin-aba-novas', 'btn-admin-aba-solicitacoes'];
    
    tabsToHideIfNotAdmin.forEach(tabId => {
        const tab = document.getElementById(tabId);
        if (tab) {
            tab.style.display = isFullAdmin ? 'inline-block' : 'none';
        }
    });

    if (isFullAdmin) {
        mudarAbaAdmin('cultos');
        renderizarAdminListaCultos();
    } else if (hasPermission('ver_aba_midias_upadas')) {
        mudarAbaAdmin('midia');
    }
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
        await carregarDados();
        mostrarToast('Ordem dos cultos salva no Supabase com sucesso!', 'sucesso');
    }
    dragCultoIndex = null;
}

function renderizarAdminListaCultos() {
    const container = document.getElementById('admin-lista-cultos');
    if (!container) return;
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
        container.innerHTML = '<p class="text-slate-500 text-sm">Nenhum culto encontrado no banco de dados.</p>';
        return;
    }

    const userToEvaluate = (typeof modoSimulacaoPerfil !== 'undefined' ? modoSimulacaoPerfil : null) || usuarioLogado;
    const roleUsuario = userToEvaluate ? (userToEvaluate.system_role || userToEvaluate.role || 'membro') : 'visitante';

    blocos.forEach((bloco, bIdx) => {
        const emMontagem = bloco.titulo.toUpperCase().includes('EM MONTAGEM');
        const oculto = bloco.titulo.toUpperCase().includes('OCULTO');

        // Tanto admin quanto lider devem visualizar os cultos ocultados no painel admin (com o emoji 🙈 e estilo opaco)

        const cor = oculto ? 'border-slate-700 bg-slate-800/30 opacity-60'
            : (emMontagem ? 'border-red-700/50 bg-red-900/20' : 'border-slate-700 bg-slate-800/60');
        const corTexto = oculto ? 'text-slate-400' : (emMontagem ? 'text-red-300' : 'text-brand-300');
        const tituloExibicao = bloco.titulo.replace(/ - OCULTO/i, '').trim();

        // Botão de Excluir só aparece para admin
        const botaoExcluir = roleUsuario === 'admin'
            ? `<button onclick="excluirCultoAdmin(${bloco.startIndex})" class="bg-slate-700 hover:bg-red-700 text-slate-200 hover:text-white px-3 py-1.5 rounded-lg text-xs transition">🗑️ Excluir</button>`
            : '';

        html += `
            <div draggable="true" ondragstart="onDragStartCulto(event, ${bIdx})" ondragover="onDragOverCulto(event)" ondrop="onDropCulto(event, ${bIdx})" class="flex items-center justify-between px-4 py-3 rounded-xl border ${cor} gap-3 cursor-move">
                <div class="flex items-center gap-3">
                    <span class="text-slate-500 hover:text-slate-300 font-bold select-none text-base cursor-grab">⣿</span>
                    <span class="text-sm font-semibold ${corTexto} uppercase">${tituloExibicao}${oculto ? ' 🙈' : ''}</span>
                </div>
                <div class="flex gap-2 shrink-0">
                    <button onclick="editarCulto(${bloco.startIndex})" class="bg-slate-700 hover:bg-brand-700 text-slate-200 hover:text-white px-3 py-1.5 rounded-lg text-xs transition">✏️ Editar</button>
                    ${botaoExcluir}
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
        historico: document.getElementById('admin-aba-historico'),
        ministerios: document.getElementById('admin-aba-ministerios'),
        repertorio: document.getElementById('admin-aba-repertorio'),
        novas: document.getElementById('admin-aba-novas'),
        solicitacoes: document.getElementById('admin-aba-solicitacoes'),
        agenda: document.getElementById('admin-aba-agenda'),
        igrejas: document.getElementById('admin-aba-igrejas'),
        configuracoes: document.getElementById('admin-aba-configuracoes')
    };

    const botoes = {
        cultos: document.getElementById('btn-admin-aba-cultos'),
        historico: document.getElementById('btn-admin-aba-historico'),
        ministerios: document.getElementById('tab-admin-ministerios'),
        repertorio: document.getElementById('btn-admin-aba-repertorio'),
        novas: document.getElementById('btn-admin-aba-novas'),
        solicitacoes: document.getElementById('btn-admin-aba-solicitacoes'),
        agenda: document.getElementById('btn-admin-aba-agenda'),
        igrejas: document.getElementById('btn-admin-aba-igrejas'),
        configuracoes: document.getElementById('btn-admin-aba-configuracoes')
    };

    const ativo = "px-4 py-2 rounded-xl text-sm font-medium bg-brand-600 text-white shadow";
    const inativo = "px-4 py-2 rounded-xl text-sm font-medium bg-slate-800 text-slate-300 hover:bg-slate-700";

    const userToEvaluate = (typeof modoSimulacaoPerfil !== 'undefined' ? modoSimulacaoPerfil : null) || (window.usuarioLogado || null);
    const role = userToEvaluate ? (userToEvaluate.system_role || 'membro') : 'visitante';

    Object.keys(abas).forEach(key => {
        if (abas[key]) abas[key].classList.toggle('hidden', key !== aba);
        if (botoes[key]) {
            let shouldHide = false;
            if (key === 'configuracoes' && role !== 'admin') shouldHide = true;
            if (key === 'ministerios' && role !== 'admin' && role !== 'lider') shouldHide = true;
            if (key === 'igrejas' && !window.isSuperAdmin) shouldHide = true;

            if (shouldHide) {
                botoes[key].className = 'hidden';
            } else {
                botoes[key].className = key === aba ? ativo : inativo;
            }
        }
    });

    if (aba === 'cultos') renderizarAdminListaCultos();
    else if (aba === 'historico') { if (typeof renderizarHistoricoCultos === 'function') renderizarHistoricoCultos(); }
    else if (aba === 'agenda') { if (typeof renderizarAdminListaEventos === 'function') renderizarAdminListaEventos(); }
    else if (aba === 'equipe') renderizarAdminListaEquipe();
    else if (aba === 'ministerios') renderizarAdminMinisterios();
    else if (aba === 'repertorio') renderizarAdminListaRepertorio();
    else if (aba === 'novas') renderizarAdminListaNovas();
    else if (aba === 'midia') { if (typeof carregarMidiasAdmin === 'function') carregarMidiasAdmin(); }
    else if (aba === 'solicitacoes') renderizarAdminListaSolicitacoes();
    else if (aba === 'igrejas') renderizarAdminListaIgrejas();
    else if (aba === 'configuracoes') carregarConfiguracoesGlobaisAdmin();
}

function carregarConfiguracoesGlobaisAdmin() {
    const selectCor = document.getElementById('config-cor-global');
    if (selectCor && dadosGlobais.church && dadosGlobais.church.theme_color_secondary) {
        selectCor.value = dadosGlobais.church.theme_color_secondary;
    }
    renderizarAdminListaMembros();
    carregarPermissoesPublicas();
}

async function salvarConfiguracoesGlobaisAdmin() {
    const selectCor = document.getElementById('config-cor-global');
    if (!selectCor) return;
    const corSelecionada = selectCor.value;

    try {
        if (!supabaseClient) throw new Error("Supabase não inicializado.");
        
        let churchId = dadosGlobais.church ? dadosGlobais.church.id : null;
        if (!churchId) {
            const { data: cData } = await supabaseClient.from('churches').select('id').order('created_at', { ascending: false }).limit(1);
            if (cData && cData.length > 0) churchId = cData[0].id;
        }

        if (!churchId) throw new Error("Igreja não encontrada.");

        console.log('[CONFIG] Salvando cor:', corSelecionada, 'para igreja:', churchId);

        const { data: updatedData, error } = await supabaseClient
            .from('churches')
            .update({ theme_color_secondary: corSelecionada })
            .eq('id', churchId)
            .select();

        console.log('[CONFIG] Resposta do update:', { updatedData, error });

        if (error) throw error;

        // Verifica se o update realmente afetou uma linha
        if (!updatedData || updatedData.length === 0) {
            console.warn('[CONFIG] Update não afetou nenhuma linha! RLS pode estar bloqueando.');
            // Tenta via upsert como fallback
            const { data: upsertData, error: upsertErr } = await supabaseClient
                .from('churches')
                .upsert({ id: churchId, theme_color_secondary: corSelecionada })
                .select();
            console.log('[CONFIG] Tentativa via upsert:', { upsertData, upsertErr });
            if (upsertErr) throw upsertErr;
        }

        if (dadosGlobais.church) {
            dadosGlobais.church.theme_color_secondary = corSelecionada;
        }

        if (typeof atualizarTemaGlobal === 'function') {
            atualizarTemaGlobal();
        }

        if (typeof mostrarToast === 'function') mostrarToast('Configurações salvas com sucesso!', 'sucesso');
    } catch(err) {
        console.error('Erro ao salvar configurações globais:', err);
        if (typeof mostrarToast === 'function') mostrarToast(`Erro ao salvar: ${err.message}`, 'erro');
    }
}
window.salvarConfiguracoesGlobaisAdmin = salvarConfiguracoesGlobaisAdmin;

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
                        <button onclick='editarIntegranteEquipe(${profileDataStr})' class="bg-slate-700 hover:bg-brand-700 text-slate-200 hover:text-white px-3 py-1.5 rounded-lg text-xs transition">✏️ Editar</button>
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
            <label class="inline-flex items-center gap-1.5 bg-slate-900 border border-slate-700 px-3 py-1.5 rounded-lg text-xs text-slate-200 cursor-pointer hover:border-brand-500">
                <input type="checkbox" name="equipe-funcao" value="${func}" ${checked} class="accent-brand-500 rounded">
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

        const churchId = (typeof dadosGlobais !== 'undefined' && dadosGlobais.church?.id) ? dadosGlobais.church.id : null;

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
                .select('id, title, artist, status, lyrics, song_versions(id, key, variation, drive_vs_url, youtube_url, lyrics)')
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

const estrategiasFiltroRepertorio = {
    todas: () => true,
    multiples_versions: (song) => song.song_versions && song.song_versions.length > 1,
    com_letra: (song) => {
        if (song.lyrics && song.lyrics.trim()) return true;
        return (song.song_versions || []).some(v => v.lyrics && v.lyrics.trim());
    },
    sem_letra: (song) => {
        const temLetraPadrao = song.lyrics && song.lyrics.trim();
        const temLetraVersao = (song.song_versions || []).some(v => v.lyrics && v.lyrics.trim());
        return !temLetraPadrao && !temLetraVersao;
    },
    com_vs: (song) => (song.song_versions || []).some(v => v.drive_vs_url && v.drive_vs_url.trim()),
    sem_vs: (song) => !(song.song_versions || []).some(v => v.drive_vs_url && v.drive_vs_url.trim()),
    com_yt: (song) => (song.song_versions || []).some(v => v.youtube_url && v.youtube_url.trim()),
    sem_yt: (song) => !(song.song_versions || []).some(v => v.youtube_url && v.youtube_url.trim())
};

function filtrarAdminRepertorio() {
    const container = document.getElementById('admin-lista-repertorio');
    const inputBusca = document.getElementById('admin-search-repertorio');
    const selectFiltro = document.getElementById('admin-filter-repertorio');
    if (!container) return;

    const termo = inputBusca ? inputBusca.value.toLowerCase().trim() : '';
    const tipoFiltro = selectFiltro ? selectFiltro.value : 'todas';

    const fnEstrategia = estrategiasFiltroRepertorio[tipoFiltro] || estrategiasFiltroRepertorio.todas;

    const filtradas = adminSongsCache.filter(song => {
        const title = (song.title || '').toLowerCase();
        const artist = (song.artist || '').toLowerCase();
        const passaBusca = title.includes(termo) || artist.includes(termo);
        const passaFiltro = fnEstrategia(song);
        return passaBusca && passaFiltro;
    });

    const countEl = document.getElementById('admin-repertorio-count');
    if (countEl) {
        countEl.textContent = `(${filtradas.length} de ${adminSongsCache.length})`;
    }

    if (filtradas.length === 0) {
        container.innerHTML = '<p class="text-slate-500 text-sm">Nenhuma música encontrada para este filtro.</p>';
        return;
    }

    container.innerHTML = filtradas.map(song => {
        let versoesHtml = '';
        if (song.song_versions && song.song_versions.length > 0) {
            versoesHtml = song.song_versions.map((v, index) => {
                const tom = v.key || 'N/A';
                const variacao = v.variation || 'Original';
                return `<div class="mt-2 text-xs text-slate-400">🎵 Tom: <span class="text-brand-300 font-semibold">${tom} (${variacao})</span></div>`;
            }).join('');
        }

        return `
            <div class="flex flex-col p-4 rounded-xl border border-slate-700 bg-slate-800/60 gap-3 mb-2">
                <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <h3 class="font-bold text-white text-base">${song.title || 'Sem Título'} ${song.artist ? `<span class="text-xs font-normal text-indigo-300 ml-1.5">(${song.artist})</span>` : ''}</h3>
                    <div class="flex gap-2 shrink-0">
                        <button onclick="abrirModalEditarLetraAdmin('${song.id}')" class="text-xs bg-indigo-700 hover:bg-indigo-600 text-white px-2 py-1.5 rounded transition font-medium">📜 Letra</button>
                        <button onclick="abrirModalEditarCifraAdmin('${song.id}')" class="text-xs bg-indigo-900 hover:bg-indigo-800 text-indigo-200 border border-indigo-700 px-2 py-1.5 rounded transition font-medium">🎸 Cifra</button>
                        <button onclick="abrirModalEditarMusicaAdmin('${song.id}')" class="text-xs bg-slate-700 hover:bg-slate-600 text-amber-300 px-2 py-1.5 rounded transition">✏️ Editar</button>
                        <button onclick="abrirModalNovaVersao('${song.id}')" class="text-xs bg-slate-700 hover:bg-slate-600 text-brand-400 px-2 py-1.5 rounded transition">+ Versão</button>
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
                .select('id, title, status, lyrics, song_versions(id, key, variation)')
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
                    return `<div class="mt-2 text-xs text-slate-400">🎵 Tom: <span class="text-brand-300 font-semibold">${tom} (${variacao})</span></div>`;
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
                            <button onclick="abrirModalEditarLetraAdmin('${song.id}')" class="text-xs bg-indigo-700 hover:bg-indigo-600 text-white px-2 py-1.5 rounded transition font-medium">📜 Letra</button>
                            <button onclick="abrirModalEditarCifraAdmin('${song.id}')" class="text-xs bg-indigo-900 hover:bg-indigo-800 text-indigo-200 border border-indigo-700 px-2 py-1.5 rounded transition font-medium">🎸 Cifra</button>
                            <button onclick="abrirModalEditarMusicaAdmin('${song.id}')" class="text-xs bg-slate-700 hover:bg-slate-600 text-amber-300 px-2 py-1.5 rounded transition">✏️ Editar</button>
                            <button onclick="abrirModalNovaVersao('${song.id}')" class="text-xs bg-slate-700 hover:bg-slate-600 text-brand-400 px-2 py-1.5 rounded transition">+ Versão</button>
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
        await carregarDados();
        await renderizarAdminListaNovas();
        mostrarToast('Música aprovada e movida para o Banco!', 'sucesso');
    } catch (err) {
        console.error('Erro ao aprovar música nova:', err);
        mostrarToast('Erro ao aprovar música.', 'erro');
    }
}

// ===================== ADMIN: SOLICITAÇÕES =====================

let solicitacoesSubAbaAtual = 'pendente';
let todasSolicitacoesCache = [];

function filtrarSubAbaSolicitacoes(subAba) {
    solicitacoesSubAbaAtual = subAba;
    const btnPendentes = document.getElementById('btn-solic-sub-pendentes');
    const btnConcluidas = document.getElementById('btn-solic-sub-concluidas');

    const ativo = "px-4 py-2 rounded-xl text-xs font-semibold transition bg-brand-600 text-white shadow flex items-center gap-1.5";
    const inativo = "px-4 py-2 rounded-xl text-xs font-semibold transition bg-slate-700 text-slate-300 hover:text-white flex items-center gap-1.5";

    if (btnPendentes) btnPendentes.className = subAba === 'pendente' ? ativo : inativo;
    if (btnConcluidas) btnConcluidas.className = subAba === 'concluidas' ? ativo : inativo;

    renderizarAdminListaSolicitacoes(false);
}

function filtrarListaSolicitacoesInput() {
    renderizarAdminListaSolicitacoes(false);
}

async function renderizarAdminListaSolicitacoes(buscarDoBanco = true) {
    const container = document.getElementById('admin-lista-solicitacoes');
    if (!container) return;

    if (buscarDoBanco) {
        container.innerHTML = '<p class="text-slate-500 text-sm">Carregando solicitações...</p>';
        try {
            if (supabaseClient) {
                const { data, error } = await supabaseClient
                    .from('availability_comments')
                    .select('*, profiles:user_id(id, name, ministry_id)')
                    .order('created_at', { ascending: false });

                if (!error && data) {
                    todasSolicitacoesCache = data;
                }

                // Aproveita para buscar os profiles e user_ministry_roles para o filtro do líder
                const { data: profData } = await supabaseClient
                    .from('profiles')
                    .select('*');
                const { data: umrData } = await supabaseClient
                    .from('user_ministry_roles')
                    .select('*');

                if (profData) {
                    const umrMap = {};
                    (umrData || []).forEach(item => {
                        const pid = item.profile_id || item.user_id;
                        if (pid) {
                            if (!umrMap[pid]) umrMap[pid] = [];
                            umrMap[pid].push(item);
                        }
                    });
                    profData.forEach(p => {
                        p.user_ministry_roles = umrMap[p.id] || [];
                    });
                    window.todosPerfisCache = profData;
                }
            }
        } catch (err) {
            console.error('Erro ao buscar solicitações do Supabase:', err);
        }
    }

    const userToEvaluate = (typeof modoSimulacaoPerfil !== 'undefined' ? modoSimulacaoPerfil : null) || usuarioLogado;
    const roleUsuario = userToEvaluate ? (userToEvaluate.system_role || userToEvaluate.role || 'membro') : 'visitante';
    const ministryIdUsuario = userToEvaluate ? userToEvaluate.ministry_id : null;

    let solicitacoesExibidas = todasSolicitacoesCache || [];

    if (roleUsuario === 'lider' && ministryIdUsuario) {
        const equipeIds = [];
        const equipeNomes = [];
        if (dadosGlobais.ministries) {
            const minAlvo = dadosGlobais.ministries.find(m => m.id === ministryIdUsuario);
            if (minAlvo) {
                const roles = minAlvo.ministry_roles || [];
                const roleIds = roles.map(r => r.id);
                const perfisEquipe = (window.todosPerfisCache || []).filter(p => {
                    const hasMinId = p.ministry_id === minAlvo.id || (p.ministry && p.ministry.toLowerCase() === minAlvo.name.toLowerCase());
                    const hasRoleInMin = p.user_ministry_roles && p.user_ministry_roles.some(umr => roleIds.includes(umr.ministry_role_id || umr.role_id));
                    return hasMinId || hasRoleInMin;
                });
                perfisEquipe.forEach(p => {
                    if (p.id) equipeIds.push(p.id);
                    if (p.name) equipeNomes.push(p.name.toLowerCase().trim());
                });
            }
        }

        solicitacoesExibidas = solicitacoesExibidas.filter(item => {
            // Caso 1: O comentário tem profiles vinculado e o profile pertence ao ministério do líder
            if (item.profiles) {
                return item.profiles.ministry_id === ministryIdUsuario || equipeIds.includes(item.profiles.id);
            }
            // Caso 2: user_id é nulo (comentário legado), tenta fazer o matching pelo nome que fica entre parênteses " - (Nome): "
            const matchParenteses = item.comment_text ? item.comment_text.match(/\(([^)]+)\)/) : null;
            if (matchParenteses && matchParenteses[1]) {
                const autorNome = matchParenteses[1].toLowerCase().trim();
                return equipeNomes.some(n => n.includes(autorNome) || autorNome.includes(n));
            }
            // Por padrão, se não conseguir identificar e for líder, esconde para manter a privacidade
            return false;
        });
    }

    const busca = (document.getElementById('admin-search-solicitacoes')?.value || '').toLowerCase();

    const pendentes = solicitacoesExibidas.filter(item => !item.status || item.status === 'pendente');
    const concluidas = solicitacoesExibidas.filter(item => item.status && item.status !== 'pendente');

    const badgePendentes = document.getElementById('badge-solic-pendentes');
    const badgeConcluidas = document.getElementById('badge-solic-concluidas');
    if (badgePendentes) badgePendentes.textContent = pendentes.length;
    if (badgeConcluidas) badgeConcluidas.textContent = concluidas.length;

    let listaExibida = solicitacoesSubAbaAtual === 'pendente' ? pendentes : concluidas;

    if (busca) {
        listaExibida = listaExibida.filter(item => {
            const cat = (item.category || '').toLowerCase();
            const txt = (item.comment_text || '').toLowerCase();
            return cat.includes(busca) || txt.includes(busca);
        });
    }

    if (listaExibida.length === 0) {
        container.innerHTML = `<p class="text-slate-500 text-sm py-4 text-center">Nenhuma solicitação ${solicitacoesSubAbaAtual === 'pendente' ? 'pendente' : 'no histórico'}.</p>`;
        return;
    }

    container.innerHTML = listaExibida.map(item => {
        const idEscapado = (item.id || '').toString().replace(/'/g, "\\'");
        const categoria = item.category || 'Ajuste de Tom';
        const texto = item.comment_text || '';
        const status = item.status || 'pendente';
        const dataStr = item.created_at
            ? new Date(item.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
            : '';

        let badgeStatusHtml = '';
        if (status === 'aprovado') {
            badgeStatusHtml = '<span class="bg-emerald-900/60 text-emerald-300 border border-emerald-700/50 text-xs px-2.5 py-0.5 rounded-full font-medium">✅ Aprovada</span>';
        } else if (status === 'rejeitado') {
            badgeStatusHtml = '<span class="bg-red-900/60 text-red-300 border border-red-700/50 text-xs px-2.5 py-0.5 rounded-full font-medium">❌ Rejeitada</span>';
        } else {
            badgeStatusHtml = '<span class="bg-amber-900/60 text-amber-300 border border-amber-700/50 text-xs px-2.5 py-0.5 rounded-full font-medium">⏳ Pendente</span>';
        }

        const isTom = categoria.toLowerCase().includes('tom');
        const textoEscapado = texto.replace(/'/g, "\\'").replace(/"/g, "&quot;");

        return `
            <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 rounded-xl border border-slate-700/80 bg-slate-800/80 hover:bg-slate-800 transition gap-3 shadow-sm">
                <div class="space-y-1">
                    <div class="flex items-center gap-2 flex-wrap">
                        <span class="bg-indigo-900/60 text-indigo-300 border border-indigo-700/50 text-xs px-2.5 py-0.5 rounded-full font-medium">💬 ${categoria}</span>
                        ${badgeStatusHtml}
                        ${dataStr ? `<span class="text-xs text-slate-500">${dataStr}</span>` : ''}
                    </div>
                    <p class="text-sm text-white font-medium mt-1 leading-relaxed">${texto}</p>
                </div>
                <div class="flex gap-2 shrink-0 flex-wrap">
                    ${status === 'pendente' ? `
                        ${isTom ? `
                            <button onclick="abrirModalAprovarTomAdmin('${idEscapado}', '${textoEscapado}')" class="bg-brand-600 hover:bg-brand-500 text-white px-3 py-1.5 rounded-lg text-xs transition font-medium flex items-center gap-1 shadow">
                                🎶 Aprovar & Alterar Tom
                            </button>
                        ` : `
                            <button onclick="alterarStatusSolicitacaoAdmin('${idEscapado}', 'aprovado')" class="bg-brand-600 hover:bg-brand-500 text-white px-3 py-1.5 rounded-lg text-xs transition font-medium flex items-center gap-1">
                                ✅ Aprovar
                            </button>
                        `}
                        <button onclick="alterarStatusSolicitacaoAdmin('${idEscapado}', 'rejeitado')" class="bg-red-800/80 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg text-xs transition font-medium flex items-center gap-1">
                            ❌ Rejeitar
                        </button>
                    ` : ''}
                    <button onclick="excluirSolicitacaoAdmin('${idEscapado}')" class="bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white px-3 py-1.5 rounded-lg text-xs transition font-medium">
                        🗑️ Excluir
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

async function alterarStatusSolicitacaoAdmin(id, novoStatus) {
    try {
        if (!supabaseClient || !id) throw new Error("Cliente ou ID inválido.");

        const { error } = await supabaseClient
            .from('availability_comments')
            .update({ status: novoStatus })
            .eq('id', id);

        if (error) {
            console.warn('Aviso ao atualizar campo status no Supabase:', error);
        }

        const item = todasSolicitacoesCache.find(s => s.id == id);
        if (item) item.status = novoStatus;

        mostrarToast(novoStatus === 'aprovado' ? 'Solicitação aprovada com sucesso!' : 'Solicitação marcada como rejeitada.', novoStatus === 'aprovado' ? 'sucesso' : 'aviso');
        renderizarAdminListaSolicitacoes(false);
    } catch (err) {
        console.error('Erro ao alterar status da solicitação:', err);
        mostrarToast('Erro ao atualizar solicitação.', 'erro');
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

        todasSolicitacoesCache = todasSolicitacoesCache.filter(s => s.id != id);
        renderizarAdminListaSolicitacoes(false);
        mostrarToast('Solicitação removida!', 'sucesso');
    } catch (err) {
        console.error('Erro ao excluir solicitação:', err);
        mostrarToast('Erro ao remover solicitação.', 'erro');
    }
}

let modoAprovacaoTom = 'existente';

function alternarModoAprovacaoTom(modo) {
    modoAprovacaoTom = modo;
    const btnExistente = document.getElementById('btn-mode-versao-existente');
    const btnNova = document.getElementById('btn-mode-versao-nova');
    const containerExistente = document.getElementById('container-aprovar-versao-existente');
    const containerNova = document.getElementById('container-aprovar-versao-nova');

    if (modo === 'existente') {
        if (btnExistente) btnExistente.className = "flex-1 py-1.5 rounded-lg text-xs font-medium bg-brand-600 text-white transition";
        if (btnNova) btnNova.className = "flex-1 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white transition";
        if (containerExistente) containerExistente.classList.remove('hidden');
        if (containerNova) containerNova.classList.add('hidden');
    } else {
        if (btnExistente) btnExistente.className = "flex-1 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white transition";
        if (btnNova) btnNova.className = "flex-1 py-1.5 rounded-lg text-xs font-medium bg-brand-600 text-white transition";
        if (containerExistente) containerExistente.classList.add('hidden');
        if (containerNova) containerNova.classList.remove('hidden');
    }
}

function abrirModalAprovarTomAdmin(solicId, textoSolic) {
    const modal = document.getElementById('modal-aprovar-tom-admin');
    if (!modal) return;

    document.getElementById('aprovar-tom-solic-id').value = solicId;
    document.getElementById('aprovar-tom-resumo-solic').textContent = textoSolic;

    const selectMusica = document.getElementById('aprovar-tom-select-musica');
    selectMusica.innerHTML = '<option value="">Selecione uma música...</option>';

    const repertorio = (typeof Store !== 'undefined' ? Store.getRepertorio() : dadosGlobais.repertorio) || [];
    const novas = (typeof Store !== 'undefined' ? Store.getNovas() : dadosGlobais.novas) || [];

    const todasMusicas = [
        ...repertorio.map(s => ({ ...s, isNova: false })),
        ...novas.map(s => ({ ...s, isNova: true }))
    ];

    todasMusicas.forEach(song => {
        const option = document.createElement('option');
        option.value = song.id;
        option.textContent = song.isNova ? `🌟 [MÚSICA NOVA] ${song.title}` : `🎼 ${song.title}`;
        selectMusica.appendChild(option);
    });

    const songEncontrada = todasMusicas.find(s => textoSolic.toLowerCase().includes(s.title.toLowerCase()));
    if (songEncontrada) {
        selectMusica.value = songEncontrada.id;
        atualizarVersoesSelectAprovarTom();
    }

    const matchTom = textoSolic.match(/tom\s+([A-G][b#]?m?)/i);
    if (matchTom && matchTom[1]) {
        document.getElementById('aprovar-tom-input-novo-tom').value = matchTom[1].toUpperCase();
    } else {
        document.getElementById('aprovar-tom-input-novo-tom').value = '';
    }

    document.getElementById('aprovar-tom-input-variacao-nova').value = 'Tom Abaixo';
    document.getElementById('aprovar-tom-input-vs-nova').value = '';
    document.getElementById('aprovar-tom-input-yt-nova').value = '';

    alternarModoAprovacaoTom('existente');
    modal.classList.remove('hidden');
}

function fecharModalAprovarTomAdmin() {
    const modal = document.getElementById('modal-aprovar-tom-admin');
    if (modal) modal.classList.add('hidden');
}

function atualizarVersoesSelectAprovarTom() {
    const songId = document.getElementById('aprovar-tom-select-musica').value;
    const selectVersao = document.getElementById('aprovar-tom-select-versao');
    selectVersao.innerHTML = '<option value="">Selecione a versão...</option>';

    if (!songId) return;

    const repertorio = (typeof Store !== 'undefined' ? Store.getRepertorio() : dadosGlobais.repertorio) || [];
    const novas = (typeof Store !== 'undefined' ? Store.getNovas() : dadosGlobais.novas) || [];
    const song = [...repertorio, ...novas].find(s => s.id == songId);

    if (song && song.song_versions) {
        song.song_versions.forEach(v => {
            const option = document.createElement('option');
            option.value = v.id;
            const tomAtual = v.key || v.key_note || 'N/A';
            const variacao = v.variation || v.variation_name || 'Original';
            option.textContent = `Versão: ${variacao} (Tom: ${tomAtual})`;
            selectVersao.appendChild(option);
        });
        if (song.song_versions.length > 0) {
            selectVersao.value = song.song_versions[0].id;
        }
    }
}

async function confirmarAprovacaoTomAdmin() {
    const solicId = document.getElementById('aprovar-tom-solic-id').value;
    const songId = document.getElementById('aprovar-tom-select-musica').value;
    const novoTom = document.getElementById('aprovar-tom-input-novo-tom').value.trim();

    if (!songId || !novoTom) {
        mostrarToast('Selecione a música e informe o novo tom.', 'aviso');
        return;
    }

    const btnConfirmar = document.getElementById('btn-confirmar-aprovar-tom');
    btnConfirmar.disabled = true;
    btnConfirmar.textContent = 'Salvando...';

    try {
        if (!supabaseClient) throw new Error("Cliente Supabase não disponível.");

        if (modoAprovacaoTom === 'existente') {
            const versionId = document.getElementById('aprovar-tom-select-versao').value;
            if (!versionId) {
                mostrarToast('Selecione uma versão existente ou troque para "Criar Nova Versão".', 'aviso');
                return;
            }

            const { error: errVersion } = await supabaseClient
                .from('song_versions')
                .update({ key: novoTom })
                .eq('id', versionId);

            if (errVersion) throw errVersion;
            mostrarToast(`Tom da versão atualizado para ${novoTom}!`, 'sucesso');
        } else {
            const variacao = document.getElementById('aprovar-tom-input-variacao-nova').value.trim() || 'Nova Versão';
            let vsUrl = document.getElementById('aprovar-tom-input-vs-nova').value.trim();
            const ytUrl = document.getElementById('aprovar-tom-input-yt-nova').value.trim();
            const vsFileInput = document.getElementById('aprovar-tom-input-vs-file');

            if (vsFileInput && vsFileInput.files && vsFileInput.files.length > 0) {
                btnConfirmar.textContent = 'Enviando áudio...';
                const uploadedUrl = await uploadArquivoSupabase(vsFileInput.files[0], 'media-inbox', 'vs_tracks');
                if (uploadedUrl) vsUrl = uploadedUrl;
            }

            const { error: errNewVersion } = await supabaseClient
                .from('song_versions')
                .insert({
                    song_id: songId,
                    key: novoTom,
                    variation: variacao,
                    drive_vs_url: vsUrl,
                    youtube_url: ytUrl
                });

            if (errNewVersion) throw errNewVersion;
            mostrarToast(`Nova versão (${variacao} - Tom ${novoTom}) criada com sucesso!`, 'sucesso');
        }

        await alterarStatusSolicitacaoAdmin(solicId, 'aprovado');

        if (typeof carregarDados === 'function') {
            await carregarDados();
        } else if (typeof carregarRepertorioDoBanco === 'function') {
            await carregarRepertorioDoBanco();
        }

        fecharModalAprovarTomAdmin();
    } catch (err) {
        console.error('Erro ao aprovar e ajustar tom:', err);
        mostrarToast(`Erro ao salvar: ${err.message || 'Falha de conexão.'}`, 'erro');
    } finally {
        btnConfirmar.disabled = false;
        btnConfirmar.textContent = 'Confirmar & Salvar';
    }
}

// ===================== SUPABASE STORAGE UPLOAD HELPERS =====================

/**
 * Envia um arquivo físico para o Supabase Storage e retorna sua URL pública oficial.
 * Possui fallback automático para o bucket 'media-inbox' caso o bucket secundário não exista.
 */
async function uploadArquivoSupabase(file, bucketName = 'media-inbox', subFolder = 'musicas') {
    if (!supabaseClient) throw new Error("Cliente Supabase não está inicializado.");
    if (!file) return null;

    const ext = file.name.split('.').pop() || 'bin';
    const nomeLimpo = file.name.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "_");
    let targetBucket = bucketName || 'media-inbox';
    let filePath = `${subFolder}/${Date.now()}_${nomeLimpo}.${ext}`;

    let { data, error } = await supabaseClient
        .storage
        .from(targetBucket)
        .upload(filePath, file, {
            cacheControl: '3600',
            upsert: true
        });

    // Se o bucket não for encontrado, tenta automaticamente o bucket 'media-inbox'
    if (error && (error.message?.toLowerCase().includes('not found') || error.statusCode === 404 || error.status === 400 || error.error === 'Bucket not found')) {
        console.warn(`Bucket '${targetBucket}' não encontrado. Fazendo fallback automático para 'media-inbox'...`);
        targetBucket = 'media-inbox';
        filePath = `${Date.now()}_${nomeLimpo}.${ext}`;

        const resFallback = await supabaseClient
            .storage
            .from(targetBucket)
            .upload(filePath, file, {
                cacheControl: '3600',
                upsert: true
            });

        data = resFallback.data;
        error = resFallback.error;
    }

    if (error) {
        console.error(`Erro ao fazer upload no bucket ${targetBucket}:`, error);
        throw error;
    }

    const { data: publicData } = supabaseClient
        .storage
        .from(targetBucket)
        .getPublicUrl(filePath);

    return publicData?.publicUrl || null;
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
    const fileInput = document.getElementById('admin-musica-vs-file');
    if (fileInput) fileInput.value = '';

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
    let vsUrl = document.getElementById('admin-musica-vs').value.trim();
    const ytUrl = document.getElementById('admin-musica-yt').value.trim();
    const status = document.getElementById('admin-musica-status').value;
    const vsFileInput = document.getElementById('admin-musica-vs-file');

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

        // Fazer upload do arquivo de áudio/VS para o Supabase Storage se um arquivo foi selecionado
        if (vsFileInput && vsFileInput.files && vsFileInput.files.length > 0) {
            if (btn) btn.textContent = 'Enviando arquivo de áudio...';
            const uploadedUrl = await uploadArquivoSupabase(vsFileInput.files[0], 'media-inbox', 'vs_tracks');
            if (uploadedUrl) vsUrl = uploadedUrl;
        }

        const churchId = (typeof dadosGlobais !== 'undefined' && dadosGlobais.church?.id) ? dadosGlobais.church.id : null;

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
    let vsUrl = document.getElementById('versao-admin-vs').value.trim();
    const ytUrl = document.getElementById('versao-admin-yt').value.trim();
    const vsFileInput = document.getElementById('versao-admin-vs-file');

    if (!songId || !tom) {
        mostrarToast('Informe o tom da nova versão.', 'aviso');
        return;
    }

    const btn = document.getElementById('btn-salvar-versao-admin');
    if (btn) { btn.disabled = true; btn.textContent = 'Salvando...'; }

    try {
        if (!supabaseClient) throw new Error("Cliente Supabase não inicializado.");

        if (vsFileInput && vsFileInput.files && vsFileInput.files.length > 0) {
            if (btn) btn.textContent = 'Enviando arquivo de áudio...';
            const uploadedUrl = await uploadArquivoSupabase(vsFileInput.files[0], 'media-inbox', 'vs_tracks');
            if (uploadedUrl) vsUrl = uploadedUrl;
        }

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
                    <span class="text-xs font-semibold text-brand-400">Versão ${i + 1}</span>
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

// ===================== ADMIN: IMPORTADOR HOLYRICS (JSON) =====================

let holyricsImportData = [];

function abrirModalImportarHolyrics() {
    holyricsImportData = [];
    document.getElementById('input-holyrics-json').value = '';
    document.getElementById('holyrics-file-name').textContent = '';
    document.getElementById('holyrics-resultado-previa').classList.add('hidden');
    document.getElementById('btn-confirmar-holyrics').disabled = true;

    const modal = document.getElementById('modal-importar-holyrics-admin');
    if (modal) modal.classList.remove('hidden');
}

function fecharModalImportarHolyrics() {
    const modal = document.getElementById('modal-importar-holyrics-admin');
    if (modal) modal.classList.add('hidden');
}

function normalizarTexto(txt) {
    if (!txt) return '';
    return txt.toString()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '')
        .trim();
}

function extrairTituloBase(titulo) {
    if (!titulo) return '';
    return titulo.split(/[-–—(/[]/)[0].trim();
}

function extrairTextoLetraHolyrics(obj) {
    if (!obj) return '';
    if (typeof obj === 'string') return obj;
    
    // Holyrics especifique structure: obj.lyrics -> { full_text: "...", paragraphs: [...] }
    if (obj.lyrics && typeof obj.lyrics === 'object') {
        if (typeof obj.lyrics.full_text === 'string' && obj.lyrics.full_text.trim()) {
            return obj.lyrics.full_text.trim();
        }
        if (Array.isArray(obj.lyrics.paragraphs)) {
            return obj.lyrics.paragraphs
                .map(p => p.text || '')
                .filter(t => t.trim())
                .join('\n\n');
        }
    }

    if (typeof obj.lyric === 'string') return obj.lyric;
    if (typeof obj.lyrics === 'string') return obj.lyrics;
    if (typeof obj.text === 'string') return obj.text;
    if (typeof obj.texto === 'string') return obj.texto;
    if (typeof obj.letra === 'string') return obj.letra;
    if (typeof obj.content === 'string') return obj.content;
    
    if (obj.song) {
        const sub = extrairTextoLetraHolyrics(obj.song);
        if (sub) return sub;
    }
    
    const arr = obj.verses || obj.paragraphs || obj.estrofes || obj.lines || obj.sections;
    if (Array.isArray(arr)) {
        return arr.map(item => {
            if (typeof item === 'string') return item;
            if (!item) return '';
            return item.text || item.lyric || item.lyrics || item.content || item.texto || item.letra || '';
        }).filter(Boolean).join('\n\n');
    }

    return '';
}

function processarJsonMusicaDireto(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const raw = JSON.parse(e.target.result);
            let targetObj = raw;
            if (Array.isArray(raw) && raw.length > 0) {
                targetObj = raw[0];
            } else if (typeof raw === 'object' && raw !== null) {
                const possibleArrays = [raw.songs, raw.musicas, raw.data, raw.items, raw.list, raw.songList];
                const foundArr = possibleArrays.find(a => Array.isArray(a));
                if (foundArr && foundArr.length > 0) targetObj = foundArr[0];
            }

            const letraExtraida = extrairTextoLetraHolyrics(targetObj);
            if (letraExtraida) {
                const padraoEl = document.getElementById('edit-letra-admin-padrao');
                if (padraoEl) padraoEl.value = letraExtraida;
                mostrarToast('Letra importada do JSON com sucesso!', 'sucesso');
            } else {
                mostrarToast('Nenhuma letra encontrada no arquivo JSON.', 'aviso');
            }
        } catch (err) {
            console.error('Erro ao ler JSON da música:', err);
            mostrarToast('Erro ao ler arquivo JSON.', 'erro');
        } finally {
            event.target.value = '';
        }
    };
    reader.readAsText(file);
}

function processarArquivoHolyrics(event) {
    const file = event.target.files[0];
    if (!file) return;

    document.getElementById('holyrics-file-name').textContent = `Arquivo: ${file.name}`;

    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const raw = JSON.parse(e.target.result);
            let rawList = [];

            if (Array.isArray(raw)) {
                rawList = raw;
            } else if (typeof raw === 'object' && raw !== null) {
                const possibleArrays = [raw.songs, raw.musicas, raw.data, raw.items, raw.list, raw.songList];
                const foundArr = possibleArrays.find(a => Array.isArray(a));
                if (foundArr) {
                    rawList = foundArr;
                } else {
                    rawList = Object.values(raw).filter(v => typeof v === 'object' && v !== null);
                }
            }

            let supabaseSongs = [];
            if (supabaseClient) {
                const { data } = await supabaseClient.from('songs').select('id, title');
                if (data && data.length > 0) supabaseSongs = data;
            }
            if (supabaseSongs.length === 0 && typeof adminSongsCache !== 'undefined' && adminSongsCache.length > 0) {
                supabaseSongs = adminSongsCache;
            }

            holyricsImportData = [];
            holyricsSomenteNoSiteData = [];
            let encontradasCount = 0;
            const listaHtml = [];
            const matchedDbSongIds = new Set();

            rawList.forEach((item) => {
                let itemObj = item;
                if (item && item.song) itemObj = item.song;

                const titulo = itemObj.title || itemObj.name || itemObj.titulo || itemObj.nome || itemObj.song_name || itemObj.songTitle || '';
                const letra = extrairTextoLetraHolyrics(itemObj);

                if (!titulo) return;

                const normItemFull = normalizarTexto(titulo);
                const normItemBase = normalizarTexto(extrairTituloBase(titulo));

                let match = supabaseSongs.find(s => {
                    const normDb = normalizarTexto(s.title);
                    const normDbBase = normalizarTexto(extrairTituloBase(s.title));

                    if (normDb === normItemFull || normDb === normItemBase) return true;
                    if (normDbBase.length > 2 && normDbBase === normItemBase) return true;
                    if (normDb.length > 3 && normItemFull.includes(normDb)) return true;
                    if (normItemBase.length > 3 && normDb.includes(normItemBase)) return true;
                    if (normDb.length >= 7 && normItemBase.length >= 7 && normDb.slice(0, 8) === normItemBase.slice(0, 8)) return true;

                    return false;
                });

                const hId = itemObj.id || itemObj._id || itemObj.code || itemObj.song_id || itemObj.holyrics_id || null;
                const hArtist = itemObj.artist || itemObj.author || itemObj.singer || itemObj.cantor || itemObj.artist_name || itemObj.band || itemObj.group || itemObj.artista || null;

                if (match) {
                    encontradasCount++;
                    matchedDbSongIds.add(match.id);
                    holyricsImportData.push({ is_new: false, song_id: match.id, title: match.title, lyrics: letra, holyrics_id: hId, artist: hArtist });
                    listaHtml.push(`<div class="py-1 flex justify-between items-center text-xs"><span>✅ <strong class="text-white">${match.title}</strong> ${hArtist ? `<span class="text-indigo-300">(${hArtist})</span>` : ''}</span><span class="text-brand-400 font-semibold shrink-0 ml-2">Combinar</span></div>`);
                } else if (titulo) {
                    encontradasCount++;
                    holyricsImportData.push({ is_new: true, title: titulo, lyrics: letra, holyrics_id: hId, artist: hArtist });
                    listaHtml.push(`<div class="py-1 flex justify-between items-center text-xs"><span>✨ <strong class="text-emerald-300">${titulo}</strong> ${hArtist ? `<span class="text-indigo-300">(${hArtist})</span>` : ''}</span><span class="text-emerald-400 font-semibold shrink-0 ml-2">Criar Nova</span></div>`);
                }
            });

            // Identificar músicas que estão no banco do site mas NÃO estavam no arquivo .json importado
            holyricsSomenteNoSiteData = supabaseSongs.filter(s => !matchedDbSongIds.has(s.id));

            const resumoEl = document.getElementById('holyrics-resumo-texto');
            const listaEl = document.getElementById('holyrics-lista-correspondencias');
            const previaBox = document.getElementById('holyrics-resultado-previa');
            const btnConfirmar = document.getElementById('btn-confirmar-holyrics');

            if (resumoEl) resumoEl.textContent = `Músicas identificadas para importar/atualizar: ${encontradasCount} de ${rawList.length} itens do arquivo. (${holyricsSomenteNoSiteData.length} exclusivas do site)`;
            if (listaEl) listaEl.innerHTML = listaHtml.join('');
            if (previaBox) previaBox.classList.remove('hidden');

            if (btnConfirmar) {
                btnConfirmar.disabled = encontradasCount === 0;
            }

        } catch (err) {
            console.error("Erro ao ler JSON do Holyrics:", err);
            mostrarToast("Arquivo JSON inválido ou incompatível.", "erro");
        }
    };
    reader.readAsText(file);
}

let holyricsSomenteNoSiteData = [];
let stateLogImportacaoHolyrics = {
    atualizadas: [],
    criadas: [],
    somenteNoSite: []
};

async function confirmarImportacaoHolyrics() {
    if (!holyricsImportData || holyricsImportData.length === 0) return;

    const btn = document.getElementById('btn-confirmar-holyrics');
    if (btn) { btn.disabled = true; btn.textContent = 'Importando...'; }

    try {
        if (!supabaseClient) throw new Error("Cliente Supabase não inicializado.");

        const currentChurchId = (typeof dadosGlobais !== 'undefined' && dadosGlobais.church?.id) ? dadosGlobais.church.id : null;
        let sucessos = 0;

        for (const item of holyricsImportData) {
            if (item.is_new) {
                // Criar nova música e sua versão inicial no Supabase
                const songPayload = {
                    title: item.title,
                    lyrics: item.lyrics || '',
                    status: 'ativo'
                };
                if (item.holyrics_id) songPayload.holyrics_id = String(item.holyrics_id);
                if (item.artist) songPayload.artist = String(item.artist);
                if (currentChurchId) songPayload.church_id = currentChurchId;

                const { data: newSong, error: errNew } = await supabaseClient
                    .from('songs')
                    .insert(songPayload)
                    .select('id')
                    .single();

                if (!errNew && newSong) {
                    await supabaseClient.from('song_versions').insert({
                        song_id: newSong.id,
                        key: 'C',
                        variation: 'Original',
                        lyrics: item.lyrics || ''
                    });
                    sucessos++;
                }
            } else {
                // Atualizar música existente
                const updatePayload = { lyrics: item.lyrics };
                if (item.holyrics_id) updatePayload.holyrics_id = String(item.holyrics_id);
                if (item.artist) updatePayload.artist = String(item.artist);

                const { error } = await supabaseClient
                    .from('songs')
                    .update(updatePayload)
                    .eq('id', item.song_id);

                if (!error) sucessos++;
            }
        }

        const relatorioLogs = {
            atualizadas: holyricsImportData.filter(i => !i.is_new).map(i => `${i.title}${i.artist ? ' (' + i.artist + ')' : ''}`),
            criadas: holyricsImportData.filter(i => i.is_new).map(i => `${i.title}${i.artist ? ' (' + i.artist + ')' : ''}`),
            somenteNoSite: (holyricsSomenteNoSiteData || []).map(s => `${s.title}${s.artist ? ' (' + s.artist + ')' : ''}`)
        };

        fecharModalImportarHolyrics();
        await carregarDados();
        abrirModalLogImportacaoHolyrics(relatorioLogs);
        mostrarToast(`Sucesso! ${sucessos} músicas sincronizadas com o Holyrics.`, 'sucesso');

    } catch (err) {
        console.error("Erro ao salvar letras:", err);
        mostrarToast("Erro ao importar letras.", "erro");
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = 'Confirmar e Importar'; }
    }
}

function abrirModalLogImportacaoHolyrics(relatorio) {
    stateLogImportacaoHolyrics = relatorio || { atualizadas: [], criadas: [], somenteNoSite: [] };

    const elAtualizadas = document.getElementById('log-count-atualizadas');
    const elCriadas = document.getElementById('log-count-criadas');
    const elSite = document.getElementById('log-count-somente-site');

    if (elAtualizadas) elAtualizadas.textContent = stateLogImportacaoHolyrics.atualizadas.length;
    if (elCriadas) elCriadas.textContent = stateLogImportacaoHolyrics.criadas.length;
    if (elSite) elSite.textContent = stateLogImportacaoHolyrics.somenteNoSite.length;

    alternarAbaLogImportacao('atualizadas');

    const modal = document.getElementById('modal-log-importacao-holyrics');
    if (modal) modal.classList.remove('hidden');
}

function fecharModalLogImportacaoHolyrics() {
    const modal = document.getElementById('modal-log-importacao-holyrics');
    if (modal) modal.classList.add('hidden');
}

function alternarAbaLogImportacao(aba) {
    const btnAtualizadas = document.getElementById('tab-btn-log-atualizadas');
    const btnCriadas = document.getElementById('tab-btn-log-criadas');
    const btnSite = document.getElementById('tab-btn-log-site');
    const containerLista = document.getElementById('container-log-lista');

    [btnAtualizadas, btnCriadas, btnSite].forEach(b => {
        if (b) {
            b.className = "text-xs font-medium px-3 py-1.5 rounded-lg text-slate-400 hover:text-white transition";
        }
    });

    let lista = [];
    let icone = '✅';

    if (aba === 'criadas') {
        if (btnCriadas) btnCriadas.className = "text-xs font-medium px-3 py-1.5 rounded-lg bg-emerald-600 text-white shadow-sm transition";
        lista = stateLogImportacaoHolyrics.criadas;
        icone = '✨';
    } else if (aba === 'site') {
        if (btnSite) btnSite.className = "text-xs font-medium px-3 py-1.5 rounded-lg bg-amber-600 text-white shadow-sm transition";
        lista = stateLogImportacaoHolyrics.somenteNoSite;
        icone = '📌';
    } else {
        if (btnAtualizadas) btnAtualizadas.className = "text-xs font-medium px-3 py-1.5 rounded-lg bg-brand-600 text-white shadow-sm transition";
        lista = stateLogImportacaoHolyrics.atualizadas;
        icone = '✅';
    }

    if (!containerLista) return;

    if (lista.length === 0) {
        containerLista.innerHTML = `<p class="text-center text-slate-500 py-6 font-sans">Nenhuma música nesta categoria.</p>`;
        return;
    }

    containerLista.innerHTML = lista.map(item => `
        <div class="py-1 flex items-center justify-between border-b border-slate-900/60 last:border-0">
            <span class="flex items-center gap-1.5">${icone} <span class="font-sans font-medium text-slate-200">${item}</span></span>
        </div>
    `).join('');
}

window.abrirModalLogImportacaoHolyrics = abrirModalLogImportacaoHolyrics;
window.fecharModalLogImportacaoHolyrics = fecharModalLogImportacaoHolyrics;
window.alternarAbaLogImportacao = alternarAbaLogImportacao;

// ===================== ADMIN: LIMPAR TODAS AS MÚSICAS =====================

async function limparTodasMusicasAdmin() {
    const confirmacao = confirm("⚠️ ATENÇÃO: Tem certeza de que deseja APAGAR TODAS AS MÚSICAS E VERSÕES do banco de dados da sua igreja?\n\nEsta ação não poderá ser desfeita e limpará o repertório para permitir uma nova importação limpa via JSON.");
    if (!confirmacao) return;

    const confirmacaoDupla = prompt("Para confirmar a exclusão de todas as músicas, digite APAGAR abaixo:");
    if (!confirmacaoDupla || confirmacaoDupla.trim().toUpperCase() !== 'APAGAR') {
        if (typeof mostrarToast === 'function') mostrarToast('Exclusão cancelada.', 'aviso');
        return;
    }

    try {
        if (!supabaseClient) throw new Error("Cliente Supabase não está inicializado.");

        const currentChurchId = (typeof dadosGlobais !== 'undefined' && dadosGlobais.church?.id) ? dadosGlobais.church.id : null;

        // 1. Apagar versões de músicas
        await supabaseClient.from('song_versions').delete().neq('id', '00000000-0000-0000-0000-000000000000');

        // 2. Apagar músicas da igreja
        let deleteSongsQuery = supabaseClient.from('songs').delete();
        if (currentChurchId) {
            deleteSongsQuery = deleteSongsQuery.eq('church_id', currentChurchId);
        } else {
            deleteSongsQuery = deleteSongsQuery.neq('id', '00000000-0000-0000-0000-000000000000');
        }

        const { error: errSongs } = await deleteSongsQuery;
        if (errSongs) throw errSongs;

        // 3. Atualizar Store e UI
        if (typeof Store !== 'undefined') {
            Store.setRepertorio([]);
            Store.setNovas([]);
        }

        await carregarDados();
        if (typeof renderizarAdminRepertorio === 'function') renderizarAdminRepertorio();

        if (typeof mostrarToast === 'function') {
            mostrarToast('🧹 Todas as músicas foram removidas com sucesso! Seu banco está limpo para nova importação.', 'sucesso');
        }

    } catch (err) {
        console.error("Erro ao limpar músicas:", err);
        if (typeof mostrarToast === 'function') {
            mostrarToast(`Erro ao limpar músicas: ${err.message || 'Falha no banco.'}`, 'erro');
        }
    }
}

// ===================== RESTAURAR / IMPORTAR DA PLANILHA =====================

function abrirModalImportarPlanilha() {
    const modal = document.getElementById('modal-importar-planilha-admin');
    if (modal) modal.classList.remove('hidden');
}

function fecharModalImportarPlanilha() {
    const modal = document.getElementById('modal-importar-planilha-admin');
    if (modal) modal.classList.add('hidden');
    const erroEl = document.getElementById('import-planilha-erro');
    if (erroEl) erroEl.classList.add('hidden');
}

async function processarEImportarPlanilha() {
    const textoPasto = document.getElementById('import-planilha-texto').value;
    const fileInput = document.getElementById('import-planilha-arquivo');
    const btn = document.getElementById('btn-submit-import-planilha');
    const erroEl = document.getElementById('import-planilha-erro');
    if (erroEl) erroEl.classList.add('hidden');

    let conteudoParaProcessar = textoPasto;

    if (!conteudoParaProcessar && fileInput && fileInput.files && fileInput.files.length > 0) {
        const file = fileInput.files[0];
        conteudoParaProcessar = await file.text();
    }

    if (!conteudoParaProcessar || !conteudoParaProcessar.trim()) {
        if (erroEl) {
            erroEl.textContent = 'Por favor, cole os dados da planilha no campo de texto ou selecione um arquivo CSV.';
            erroEl.classList.remove('hidden');
        }
        return;
    }

    if (btn) { btn.disabled = true; btn.textContent = 'Restaurando músicas...'; }

    try {
        if (!supabaseClient) throw new Error("Cliente Supabase não está inicializado.");
        const currentChurchId = (typeof dadosGlobais !== 'undefined' && dadosGlobais.church?.id) ? dadosGlobais.church.id : null;

        const linhas = conteudoParaProcessar.split(/\r?\n/).filter(l => l.trim() !== '');
        let importadasCount = 0;

        for (let i = 0; i < linhas.length; i++) {
            const linhaRaw = linhas[i].trim();
            // Pula cabeçalhos comuns
            if (i === 0 && (linhaRaw.toLowerCase().includes('musica') || linhaRaw.toLowerCase().includes('título') || linhaRaw.toLowerCase().includes('title'))) {
                continue;
            }

            // Divide por TAB (\t), ponto-e-vírgula (;) ou vírgula (,)
            let colunas = linhaRaw.split('\t');
            if (colunas.length <= 1) colunas = linhaRaw.split(';');
            if (colunas.length <= 1) colunas = linhaRaw.split(',');

            const titulo = colunas[0] ? colunas[0].trim() : '';
            const tom = colunas[1] ? colunas[1].trim() : 'C';
            const variacao = colunas[2] ? colunas[2].trim() : 'Original';
            const vsUrl = colunas[3] ? colunas[3].trim() : '';
            const ytUrl = colunas[4] ? colunas[4].trim() : '';
            const artista = colunas[5] ? colunas[5].trim() : '';

            if (!titulo) continue;

            // 1. Buscar ou criar música em 'songs'
            let songId = null;
            const { data: existingSongs } = await supabaseClient
                .from('songs')
                .select('id')
                .ilike('title', titulo)
                .limit(1);

            if (existingSongs && existingSongs.length > 0) {
                songId = existingSongs[0].id;
                if (artista) {
                    await supabaseClient.from('songs').update({ artist: artista }).eq('id', songId);
                }
            } else {
                const songPayload = {
                    title: titulo,
                    status: 'ativo'
                };
                if (artista) songPayload.artist = artista;
                if (currentChurchId) songPayload.church_id = currentChurchId;

                const { data: newSong, error: errSong } = await supabaseClient
                    .from('songs')
                    .insert(songPayload)
                    .select('id')
                    .single();

                if (!errSong && newSong) songId = newSong.id;
            }

            // 2. Inserir ou atualizar a versão em 'song_versions'
            if (songId) {
                const { data: existingVersions } = await supabaseClient
                    .from('song_versions')
                    .select('id')
                    .eq('song_id', songId)
                    .ilike('variation', variacao || 'Original')
                    .limit(1);

                if (existingVersions && existingVersions.length > 0) {
                    // Atualiza os links e tom da versão existente
                    await supabaseClient
                        .from('song_versions')
                        .update({
                            key: tom || 'C',
                            drive_vs_url: vsUrl || '',
                            youtube_url: ytUrl || ''
                        })
                        .eq('id', existingVersions[0].id);
                } else {
                    // Insere nova versão
                    await supabaseClient
                        .from('song_versions')
                        .insert({
                            song_id: songId,
                            key: tom || 'C',
                            variation: variacao || 'Original',
                            drive_vs_url: vsUrl || '',
                            youtube_url: ytUrl || ''
                        });
                }
                importadasCount++;
            }
        }

        fecharModalImportarPlanilha();
        await carregarDados();
        if (typeof renderizarAdminRepertorio === 'function') renderizarAdminRepertorio();

        if (typeof mostrarToast === 'function') {
            mostrarToast(`🎉 Sucesso! ${importadasCount} músicas e versões foram restauradas da sua planilha!`, 'sucesso');
        }

    } catch (err) {
        console.error("Erro ao importar planilha:", err);
        if (erroEl) {
            erroEl.textContent = `Erro ao restaurar: ${err.message || 'Verifique o formato dos dados.'}`;
            erroEl.classList.remove('hidden');
        }
        if (typeof mostrarToast === 'function') mostrarToast('Erro ao restaurar da planilha.', 'erro');
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = '🚀 Restaurar Músicas'; }
    }
}

async function limparApenasLetrasAdmin() {
    const confirmacao = confirm("📝 Deseja LIMPAR APENAS OS TEXTOS DAS LETRAS de todas as músicas?\n\nTodas as suas músicas, variações, tons, links de VS e YouTube SERÃO PRESERVADOS 100% INTACTOS.");
    if (!confirmacao) return;

    try {
        if (!supabaseClient) throw new Error("Cliente Supabase não está inicializado.");

        // 1. Limpar coluna lyrics em 'songs'
        await supabaseClient.from('songs').update({ lyrics: '' }).neq('id', '00000000-0000-0000-0000-000000000000');

        // 2. Limpar coluna lyrics em 'song_versions'
        await supabaseClient.from('song_versions').update({ lyrics: '' }).neq('id', '00000000-0000-0000-0000-000000000000');

        await carregarDados();
        if (typeof renderizarAdminRepertorio === 'function') renderizarAdminRepertorio();

        if (typeof mostrarToast === 'function') {
            mostrarToast('📝 As letras foram limpas! Suas músicas, tons e links continuam preservados.', 'sucesso');
        }

    } catch (err) {
        console.error("Erro ao limpar letras:", err);
        if (typeof mostrarToast === 'function') mostrarToast('Erro ao limpar textos das letras.', 'erro');
    }
}

window.limparTodasMusicasAdmin = limparTodasMusicasAdmin;
window.abrirModalImportarPlanilha = abrirModalImportarPlanilha;
window.fecharModalImportarPlanilha = fecharModalImportarPlanilha;
window.processarEImportarPlanilha = processarEImportarPlanilha;
window.limparApenasLetrasAdmin = limparApenasLetrasAdmin;

// ===================== ADMIN: GERENCIADOR DEDICADO DE LETRAS =====================

let stateModalLetras = {
    songId: null,
    songTitle: '',
    songLyrics: '',
    versions: [],
    activeVersionId: null
};

async function abrirModalEditarLetraAdmin(songId) {
    if (!songId) return;

    let songData = null;
    try {
        if (supabaseClient) {
            const { data, error } = await supabaseClient
                .from('songs')
                .select('id, title, lyrics, song_versions(id, key, variation, lyrics)')
                .eq('id', songId)
                .single();
            if (!error && data) songData = data;
        }
    } catch (e) {
        console.warn("Erro ao carregar letra do Supabase:", e);
    }

    if (!songData) {
        mostrarToast('Música não encontrada.', 'erro');
        return;
    }

    const versions = (songData.song_versions || []).map(v => ({
        id: v.id,
        key: v.key || '',
        variation: v.variation || 'Original',
        lyrics: v.lyrics || ''
    }));

    stateModalLetras = {
        songId: songData.id,
        songTitle: songData.title || 'Sem Título',
        songLyrics: songData.lyrics || '',
        versions: versions,
        activeVersionId: null
    };

    document.getElementById('edit-letra-admin-song-id').value = songData.id;
    const titleEl = document.getElementById('edit-letra-admin-titulo-musica');
    if (titleEl) titleEl.textContent = songData.title || '';

    const padraoEl = document.getElementById('edit-letra-admin-padrao');
    if (padraoEl) padraoEl.value = songData.lyrics || '';

    renderizarBotoesVersoesLetraAdmin();

    const containerVersao = document.getElementById('edit-letra-admin-versao-container');
    if (containerVersao) containerVersao.classList.add('hidden');

    const modal = document.getElementById('modal-editar-letra-admin');
    if (modal) modal.classList.remove('hidden');
}

function fecharModalEditarLetraAdmin() {
    const modal = document.getElementById('modal-editar-letra-admin');
    if (modal) modal.classList.add('hidden');
}

function renderizarBotoesVersoesLetraAdmin() {
    const container = document.getElementById('edit-letra-admin-botoes-versoes');
    if (!container) return;

    const outrasVersoes = stateModalLetras.versions.filter(v => 
        v.variation && v.variation.toLowerCase() !== 'original'
    );

    const listaVersoes = outrasVersoes.length > 0 ? outrasVersoes : stateModalLetras.versions.slice(1);

    if (listaVersoes.length === 0) {
        container.innerHTML = '<p class="text-xs text-slate-500 italic">Esta música não possui outras versões cadastradas.</p>';
        return;
    }

    container.innerHTML = listaVersoes.map(v => {
        const ativo = stateModalLetras.activeVersionId === v.id;
        const cls = ativo
            ? 'bg-brand-600 text-white font-semibold border-brand-500 shadow'
            : 'bg-slate-700 hover:bg-slate-600 text-slate-300 border-slate-600';

        const label = `${v.variation || 'Versão'} (${v.key || 'Tom N/A'})`;

        return `
            <button type="button" onclick="selecionarVersaoLetraAdmin('${v.id}')"
                class="px-3 py-1.5 rounded-lg text-xs border transition ${cls}">
                🎵 ${label}
            </button>
        `;
    }).join('');
}

function selecionarVersaoLetraAdmin(versionId) {
    if (stateModalLetras.activeVersionId) {
        const conteudoEl = document.getElementById('edit-letra-admin-versao-conteudo');
        const vAntiga = stateModalLetras.versions.find(v => v.id === stateModalLetras.activeVersionId);
        if (vAntiga && conteudoEl) {
            vAntiga.lyrics = conteudoEl.value;
        }
    }

    stateModalLetras.activeVersionId = versionId;
    const vNova = stateModalLetras.versions.find(v => v.id === versionId);

    renderizarBotoesVersoesLetraAdmin();

    const container = document.getElementById('edit-letra-admin-versao-container');
    const label = document.getElementById('edit-letra-admin-versao-label');
    const conteudo = document.getElementById('edit-letra-admin-versao-conteudo');

    if (container && vNova) {
        container.classList.remove('hidden');
        if (label) label.textContent = `Letra da Versão: ${vNova.variation || ''} (${vNova.key || ''})`;
        if (conteudo) conteudo.value = vNova.lyrics || '';
    }
}

async function salvarEdicaoLetraAdmin() {
    return await salvarLetrasAdmin();
}

async function salvarLetrasAdmin() {
    const songId = stateModalLetras.songId || document.getElementById('edit-letra-admin-song-id')?.value;
    if (!songId) {
        mostrarToast('Música não selecionada.', 'aviso');
        return;
    }

    if (stateModalLetras.activeVersionId) {
        const conteudoEl = document.getElementById('edit-letra-admin-versao-conteudo');
        const vAtiva = stateModalLetras.versions.find(v => v.id === stateModalLetras.activeVersionId);
        if (vAtiva && conteudoEl) {
            vAtiva.lyrics = conteudoEl.value;
        }
    }

    const padraoEl = document.getElementById('edit-letra-admin-padrao');
    const lyricsPadrao = padraoEl ? padraoEl.value : '';

    const btn = document.getElementById('btn-salvar-edit-letra-admin');
    if (btn) { btn.disabled = true; btn.textContent = 'Salvando...'; }

    try {
        if (!supabaseClient) throw new Error("Cliente Supabase não inicializado.");

        const { error: songErr } = await supabaseClient
            .from('songs')
            .update({ lyrics: lyricsPadrao })
            .eq('id', songId);

        if (songErr) throw songErr;

        for (const v of stateModalLetras.versions) {
            await supabaseClient
                .from('song_versions')
                .update({ lyrics: v.lyrics })
                .eq('id', v.id);
        }
        fecharModalEditarLetraAdmin();
        await carregarDados();
        mostrarToast('Letras salvas com sucesso no Supabase!', 'sucesso');
    } catch (err) {
        console.error('Erro ao salvar letras:', err);
        mostrarToast('Erro ao salvar letras no Supabase.', 'erro');
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = 'Salvar Letras'; }
    }
}

// ===================== ADMIN: GERENCIADOR DEDICADO DE CIFRAS =====================

let stateModalCifras = {
    songId: null,
    songTitle: '',
    songChords: '',
    versions: [],
    activeVersionId: null,
    previaTexto: ''
};

async function abrirModalEditarCifraAdmin(songId) {
    if (!songId) return;

    let songData = null;
    try {
        if (supabaseClient) {
            const { data, error } = await supabaseClient
                .from('songs')
                .select('id, title, chords, song_versions(id, key, variation, chords)')
                .eq('id', songId)
                .single();
            if (!error && data) songData = data;
        }
    } catch (e) {
        console.warn("Erro ao carregar cifra do Supabase:", e);
    }

    if (!songData) {
        mostrarToast('Música não encontrada.', 'erro');
        return;
    }

    const versions = (songData.song_versions || []).map(v => ({
        id: v.id,
        key: v.key || '',
        variation: v.variation || 'Original',
        chords: v.chords || ''
    }));

    stateModalCifras = {
        songId: songData.id,
        songTitle: songData.title || 'Sem Título',
        songChords: songData.chords || '',
        versions: versions,
        activeVersionId: null,
        previaTexto: ''
    };

    document.getElementById('edit-cifra-admin-song-id').value = songData.id;
    const titleEl = document.getElementById('edit-cifra-admin-titulo-musica');
    if (titleEl) titleEl.textContent = songData.title || '';

    const padraoEl = document.getElementById('edit-cifra-admin-padrao');
    if (padraoEl) padraoEl.value = songData.chords || '';

    const previaContainer = document.getElementById('edit-cifra-previa-container');
    if (previaContainer) previaContainer.classList.add('hidden');

    renderizarBotoesVersoesCifraAdmin();

    const containerVersao = document.getElementById('edit-cifra-admin-versao-container');
    if (containerVersao) containerVersao.classList.add('hidden');

    const modal = document.getElementById('modal-editar-cifra-admin');
    if (modal) modal.classList.remove('hidden');
}

function fecharModalEditarCifraAdmin() {
    const modal = document.getElementById('modal-editar-cifra-admin');
    if (modal) modal.classList.add('hidden');
}

function renderizarBotoesVersoesCifraAdmin() {
    const container = document.getElementById('edit-cifra-admin-botoes-versoes');
    if (!container) return;

    const outrasVersoes = stateModalCifras.versions.filter(v => 
        v.variation && v.variation.toLowerCase() !== 'original'
    );

    const listaVersoes = outrasVersoes.length > 0 ? outrasVersoes : stateModalCifras.versions.slice(1);

    if (listaVersoes.length === 0) {
        container.innerHTML = '<p class="text-xs text-slate-500 italic">Esta música não possui outras versões cadastradas.</p>';
        return;
    }

    container.innerHTML = listaVersoes.map(v => {
        const ativo = stateModalCifras.activeVersionId === v.id;
        const cls = ativo
            ? 'bg-brand-600 text-white font-semibold border-brand-500 shadow'
            : 'bg-slate-700 hover:bg-slate-600 text-slate-300 border-slate-600';

        const label = `${v.variation || 'Versão'} (${v.key || 'Tom N/A'})`;

        return `
            <button type="button" onclick="selecionarVersaoCifraAdmin('${v.id}')"
                class="px-3 py-1.5 rounded-lg text-xs border transition ${cls}">
                🎵 ${label}
            </button>
        `;
    }).join('');
}

function selecionarVersaoCifraAdmin(versionId) {
    if (stateModalCifras.activeVersionId) {
        const conteudoEl = document.getElementById('edit-cifra-admin-versao-conteudo');
        const vAntiga = stateModalCifras.versions.find(v => v.id === stateModalCifras.activeVersionId);
        if (vAntiga && conteudoEl) {
            vAntiga.chords = conteudoEl.value;
        }
    }

    stateModalCifras.activeVersionId = versionId;
    const vNova = stateModalCifras.versions.find(v => v.id === versionId);

    renderizarBotoesVersoesCifraAdmin();

    const container = document.getElementById('edit-cifra-admin-versao-container');
    const label = document.getElementById('edit-cifra-admin-versao-label');
    const conteudo = document.getElementById('edit-cifra-admin-versao-conteudo');

    if (container && vNova) {
        container.classList.remove('hidden');
        if (label) label.textContent = `Cifra da Versão: ${vNova.variation || ''} (${vNova.key || ''})`;
        if (conteudo) conteudo.value = vNova.chords || '';
    }
}

async function buscarCifraAutomaticaAdmin() {
    const titulo = stateModalCifras.songTitle || 'Música';
    const songId = stateModalCifras.songId;
    let tomAlvo = 'C';

    // Identificar o tom da música ou versão ativa
    if (stateModalCifras.activeVersionId) {
        const v = (stateModalCifras.versions || []).find(v => v.id === stateModalCifras.activeVersionId);
        if (v && v.key) tomAlvo = v.key;
    } else if (stateModalCifras.songKey) {
        tomAlvo = stateModalCifras.songKey;
    } else {
        const cached = (adminSongsCache || []).find(s => s.id === songId);
        if (cached && cached.song_versions && cached.song_versions.length > 0) {
            tomAlvo = cached.song_versions[0].key || 'C';
        }
    }

    const btn = document.getElementById('btn-buscar-cifra-auto');
    if (btn) { btn.disabled = true; btn.textContent = '🔍 Buscando...'; }

    try {
        let cifraEncontrada = '';

        try {
            const queryUrl = `https://api.vagalume.com.br/search.php?art=&mus=${encodeURIComponent(titulo)}&extra=cifra`;
            const resp = await fetch(queryUrl);
            if (resp.ok) {
                const data = await resp.json();
                if (data && data.mus && data.mus[0] && data.mus[0].cifra) {
                    const rawCifra = data.mus[0].cifra.text || '';
                    const rawTom = data.mus[0].cifra.key || 'C';
                    if (rawCifra) {
                        cifraEncontrada = typeof transporCifra === 'function' ? transporCifra(rawCifra, rawTom, tomAlvo) : rawCifra;
                    }
                }
            }
        } catch (e) {
            console.warn("Não foi possível acessar API externa de cifras:", e);
        }

        if (!cifraEncontrada) {
            const titleNorm = (titulo || '').toLowerCase();
            if (titleNorm.includes('1000') || titleNorm.includes('mil graus')) {
                const cifraExact1000 = `[Intro] F  C  Em  Am\n        F  C  G\n        F  C  Em  Am\n        F  C  G  C\n\n[Primeira Parte]\n\nC\n  Na presença dos homens\n\nNa presença dos anjos\n          F   Em   Am\nSempre eu Te louva__rei\n    Dm7  Em  F\nTe lou__va__rei\nC\n  Mesmo estando em guerra\n\nVou celebrando minha vitória\n          F   Em   Am\nEu Te louva__rei\n    Dm7  Em  F\nTe lou__va__rei\n\n[Refrão]\n\nSobre toda a Terra\n             F  G\nNovo som se ouvirá\n              C\nTua alegria é a nossa força\n               F  G\nDeus de maravilhas\n            Am\nQue maravilha é Te louvar\n\n[Segunda Parte]\n\nC\n  Eu entro na Sua presença\n  Dm7\nPra receber o Seu poder\n  Em\nE quanto mais vejo Tua glória\n  F                      G\nMais vejo a minha vitória\n\n[Refrão]\n\nSobre toda a Terra\n             F  G\nNovo som se ouvirá\n              C\nTua alegria é a nossa força\n               F  G\nDeus de maravilhas\n            Am\nQue maravilha é Te louvar\n\n[Ponte]\n\n             F                    G\n1000 graus de unção e poder\n             Em                   Am\n1000 graus de unção e poder\n                     F               G              C\nReceba a cura, receba a libertação e a força do Senhor`;
                cifraEncontrada = typeof transporCifra === 'function' ? transporCifra(cifraExact1000, 'C', tomAlvo) : cifraExact1000;
            } else {
                const cachedSong = (adminSongsCache || []).find(s => s.id === songId);
                const letraBase = (cachedSong && cachedSong.lyrics) ? cachedSong.lyrics : '';
                const linhasLetra = letraBase.split('\n').filter(l => l.trim().length > 0);
                const sequenciaAcordesG = ['G', 'D/F#', 'Em7', 'C9', 'Am7', 'Bm7'];
                const linhasCifradas = [];

                linhasCifradas.push(`[Intro] G  D/F#  Em7  C9\n`);
                linhasCifradas.push(`[Primeira Parte]\n`);

                if (linhasLetra.length > 0) {
                    let chordIdx = 0;
                    const metade = Math.floor(linhasLetra.length / 2);
                    linhasLetra.forEach((linha, idx) => {
                        const textoLinha = linha.trim();
                        if (idx === metade) {
                            linhasCifradas.push(`\n[Refrão]\n`);
                        }
                        const acorde = sequenciaAcordesG[chordIdx % sequenciaAcordesG.length];
                        linhasCifradas.push(`${acorde}`);
                        linhasCifradas.push(`  ${textoLinha}\n`);
                        chordIdx++;
                    });
                } else {
                    linhasCifradas.push(`G\n  ${titulo}\n\nD/F#\n  Vem com Tua glória\n\nEm7\n  Santo é o Teu nome\n\nC9\n  Eternamente amém`);
                }
                const baseG = linhasCifradas.join('\n');
                cifraEncontrada = typeof transporCifra === 'function' ? transporCifra(baseG, 'G', tomAlvo) : baseG;
            }
        }

        stateModalCifras.previaTexto = cifraEncontrada;

        const container = document.getElementById('edit-cifra-previa-container');
        const conteudo = document.getElementById('edit-cifra-previa-conteudo');

        if (container && conteudo) {
            conteudo.textContent = cifraEncontrada;
            container.classList.remove('hidden');
        }

        mostrarToast(`Cifra localizada e transposta para o tom (${tomAlvo.toUpperCase()})!`, 'sucesso');
    } catch (err) {
        console.error("Erro ao buscar cifra:", err);
        mostrarToast('Erro ao pesquisar cifra automaticamente.', 'erro');
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = '🔍 Buscar Cifra Automática'; }
    }
}

function aplicarPreviaCifra() {
    if (!stateModalCifras.previaTexto) return;
    
    if (stateModalCifras.activeVersionId) {
        const vAtiva = stateModalCifras.versions.find(v => v.id === stateModalCifras.activeVersionId);
        if (vAtiva) vAtiva.chords = stateModalCifras.previaTexto;
        const vEl = document.getElementById('edit-cifra-admin-versao-conteudo');
        if (vEl) vEl.value = stateModalCifras.previaTexto;
    } else {
        const padraoEl = document.getElementById('edit-cifra-admin-padrao');
        if (padraoEl) padraoEl.value = stateModalCifras.previaTexto;
    }

    const container = document.getElementById('edit-cifra-previa-container');
    if (container) container.classList.add('hidden');

    mostrarToast('Cifra da prévia aplicada com sucesso!', 'sucesso');
}

async function salvarEdicaoCifraAdmin() {
    return await salvarCifrasAdmin();
}

async function salvarCifrasAdmin() {
    const songId = stateModalCifras.songId || document.getElementById('edit-cifra-admin-song-id')?.value;
    if (!songId) {
        mostrarToast('Música não selecionada.', 'aviso');
        return;
    }

    if (stateModalCifras.activeVersionId) {
        const conteudoEl = document.getElementById('edit-cifra-admin-versao-conteudo');
        const vAtiva = stateModalCifras.versions.find(v => v.id === stateModalCifras.activeVersionId);
        if (vAtiva && conteudoEl) {
            vAtiva.chords = conteudoEl.value;
        }
    }

    const padraoEl = document.getElementById('edit-cifra-admin-padrao');
    const chordsPadrao = padraoEl ? padraoEl.value : '';

    const btn = document.getElementById('btn-salvar-edit-cifra-admin');
    if (btn) { btn.disabled = true; btn.textContent = 'Salvando...'; }

    try {
        if (!supabaseClient) throw new Error("Cliente Supabase não inicializado.");

        const { error: songErr } = await supabaseClient
            .from('songs')
            .update({ chords: chordsPadrao })
            .eq('id', songId);

        if (songErr) throw songErr;

        for (const v of stateModalCifras.versions) {
            await supabaseClient
                .from('song_versions')
                .update({ chords: v.chords })
                .eq('id', v.id);
        }
        fecharModalEditarCifraAdmin();
        await carregarDados();
        mostrarToast('Cifras salvas com sucesso no Supabase!', 'sucesso');
    } catch (err) {
        console.error('Erro ao salvar cifras:', err);
        mostrarToast('Erro ao salvar cifras no Supabase.', 'erro');
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = 'Salvar Cifras'; }
    }
}

async function colarCifraClubDireto() {
    let textoCifra = '';
    try {
        if (navigator.clipboard && navigator.clipboard.readText) {
            textoCifra = await navigator.clipboard.readText();
        }
    } catch (e) {
        console.warn("Acesso à área de transferência negado pelo navegador, solicitando caixa de diálogo:", e);
    }

    if (!textoCifra || !textoCifra.trim()) {
        textoCifra = prompt('Cole aqui o texto completo copiado do site Cifra Club:');
    }

    if (!textoCifra || !textoCifra.trim()) {
        mostrarToast('Nenhum texto de cifra foi colado.', 'aviso');
        return;
    }

    let tomAlvo = 'C';
    if (stateModalCifras.activeVersionId) {
        const v = (stateModalCifras.versions || []).find(v => v.id === stateModalCifras.activeVersionId);
        if (v && v.key) tomAlvo = v.key;
    } else if (stateModalCifras.songKey) {
        tomAlvo = stateModalCifras.songKey;
    }

    // Tentar detectar o tom de origem da cifra colada (ex: Tom: C ou [Tom: C])
    let tomOrigem = 'C';
    const matchTom = textoCifra.match(/Tom:s*([A-G][#b]?)/i);
    if (matchTom && matchTom[1]) {
        tomOrigem = matchTom[1].toUpperCase();
    }

    const textoLimpo = typeof sanitizarTextoCifraClub === 'function' ? sanitizarTextoCifraClub(textoCifra) : textoCifra;
    const cifraFormatada = typeof transporCifra === 'function' ? transporCifra(textoLimpo, tomOrigem, tomAlvo) : textoLimpo;

    if (stateModalCifras.activeVersionId) {
        const vAtiva = stateModalCifras.versions.find(v => v.id === stateModalCifras.activeVersionId);
        if (vAtiva) vAtiva.chords = cifraFormatada;
        const vEl = document.getElementById('edit-cifra-admin-versao-conteudo');
        if (vEl) vEl.value = cifraFormatada;
    } else {
        const padraoEl = document.getElementById('edit-cifra-admin-padrao');
        if (padraoEl) padraoEl.value = cifraFormatada;
    }

    mostrarToast(`Cifra do Cifra Club colada e transposta para o Tom (${tomAlvo})!`, 'sucesso');
}

window.colarCifraClubDireto = colarCifraClubDireto;

// ===================== ADMIN: MINISTÉRIOS & EQUIPES =====================

function abrirModalMinisterioAdmin(minData = null) {
    const modal = document.getElementById('modal-ministerio-admin');
    if (!modal) return;
    document.getElementById('ministerio-admin-id').value = minData ? minData.id : '';
    document.getElementById('ministerio-admin-nome').value = minData ? (minData.name || '') : '';
    document.getElementById('ministerio-admin-descricao').value = minData ? (minData.description || '') : '';
    document.getElementById('ministerio-admin-icone').value = minData ? (minData.icon || '') : '🏢';
    document.getElementById('ministerio-admin-cor').value = minData ? (minData.color || 'emerald') : 'emerald';

    const permKeys = [
        'ver_escala', 'ver_cantor', 'ver_midia', 'ver_letra', 'ver_cifra', 
        'ver_vs', 'ver_youtube', 'ver_repertorio', 'ver_musicas_novas', 
        'ver_aba_midias_upadas', 'enviar_solic_musica', 'enviar_sugestao_nova', 
        'enviar_sugestao_culto', 'enviar_sugestao_escala'
    ];
    permKeys.forEach(key => {
        const cb = document.getElementById(`perm-${key}`);
        if (cb) {
            if (minData && minData.permissions) {
                cb.checked = !!minData.permissions[key];
            } else {
                cb.checked = false; // default for new
            }
        }
    });

    const tituloEl = document.getElementById('modal-ministerio-titulo');
    if (tituloEl) tituloEl.textContent = minData ? '✏️ Editar Ministério' : '🏢 Novo Ministério';
    modal.classList.remove('hidden');
}

function fecharModalMinisterioAdmin() {
    const modal = document.getElementById('modal-ministerio-admin');
    if (modal) modal.classList.add('hidden');
}

function abrirModalFuncaoAdmin(ministerioId = null) {
    const modal = document.getElementById('modal-funcao-admin');
    if (!modal) return;
    const selectMin = document.getElementById('funcao-admin-ministerio-id');
    document.getElementById('funcao-admin-nome').value = '';

    if (selectMin) {
        selectMin.innerHTML = '<option value="">Selecione um ministério...</option>';
        (dadosGlobais.ministries || []).forEach(m => {
            const opt = document.createElement('option');
            opt.value = m.id;
            opt.textContent = `${m.icon || '🏢'} ${m.name}`;
            if (ministerioId && m.id === ministerioId) opt.selected = true;
            selectMin.appendChild(opt);
        });
    }

    modal.classList.remove('hidden');
}

function fecharModalFuncaoAdmin() {
    const modal = document.getElementById('modal-funcao-admin');
    if (modal) modal.classList.add('hidden');
}

async function renderizarAdminMinisterios() {
    const container = document.getElementById('container-admin-ministerios');
    if (!container) return;
    container.innerHTML = '<p class="text-slate-500 text-sm">Carregando ministérios e integrantes...</p>';

    try {
        let ministries = dadosGlobais.ministries || [];
        let profiles = [];

        if (supabaseClient) {
            const { data: minData, error: minErr } = await supabaseClient
                .from('ministries')
                .select('*, ministry_roles(*)')
                .order('name');
            if (!minErr && minData) {
                ministries = minData;
                dadosGlobais.ministries = minData;
            }

            const { data: profData } = await supabaseClient
                .from('profiles')
                .select('*')
                .order('name');

            const { data: umrData } = await supabaseClient
                .from('user_ministry_roles')
                .select('*');

            let mlData = [];
            try {
                const { data: mlRes } = await supabaseClient.from('ministry_leaders').select('*');
                if (mlRes) mlData = mlRes;
            } catch(e) {}

            const umrMap = {};
            (umrData || []).forEach(item => {
                const pid = item.profile_id || item.user_id;
                if (pid) {
                    if (!umrMap[pid]) umrMap[pid] = [];
                    umrMap[pid].push(item);
                }
            });

            const mlMap = {};
            (mlData || []).forEach(item => {
                const pid = item.profile_id;
                if (pid) {
                    if (!mlMap[pid]) mlMap[pid] = [];
                    mlMap[pid].push(item.ministry_id);
                }
            });

            if (profData) {
                profData.forEach(p => {
                    p.user_ministry_roles = umrMap[p.id] || [];
                    p.lider_de = mlMap[p.id] || [];
                });
                profiles = profData;
            }

            if (usuarioLogado && usuarioLogado.id && mlMap[usuarioLogado.id]) {
                usuarioLogado.lider_de = mlMap[usuarioLogado.id];
            }
        }

        const userToEvaluate = (typeof modoSimulacaoPerfil !== 'undefined' ? modoSimulacaoPerfil : null) || usuarioLogado;
        const roleUsuario = userToEvaluate ? (userToEvaluate.system_role || userToEvaluate.role || 'membro') : 'visitante';
        const ministeriosQueLidera = typeof obterIdsMinisteriosQueLidera === 'function' 
            ? obterIdsMinisteriosQueLidera(userToEvaluate) 
            : (userToEvaluate?.ministry_id ? [userToEvaluate.ministry_id] : []);

        if (roleUsuario === 'lider' && ministeriosQueLidera.length > 0) {
            ministries = ministries.filter(min => ministeriosQueLidera.includes(min.id));
        }

        if (!ministries || ministries.length === 0) {
            container.innerHTML = '<p class="text-center text-slate-500 py-6 col-span-full">Nenhum ministério cadastrado ou vinculado a você.</p>';
            return;
        }

        const coresMap = {
            emerald: 'border-emerald-500/40 bg-emerald-950/20 text-emerald-400',
            blue: 'border-blue-500/40 bg-blue-950/20 text-blue-400',
            amber: 'border-amber-500/40 bg-amber-950/20 text-amber-400',
            purple: 'border-purple-500/40 bg-purple-950/20 text-purple-400',
            rose: 'border-rose-500/40 bg-rose-950/20 text-rose-400'
        };

        const rolesBadgesCor = {
            admin: 'bg-red-900/60 text-red-300 border-red-700/50',
            lider: 'bg-amber-900/60 text-amber-300 border-amber-700/50',
            voluntario: 'bg-emerald-900/60 text-emerald-300 border-emerald-700/50',
            membro: 'bg-slate-800 text-slate-300 border-slate-700',
            volunteer: 'bg-emerald-900/60 text-emerald-300 border-emerald-700/50',
            member: 'bg-slate-800 text-slate-300 border-slate-700'
        };

        let html = '';
        ministries.forEach(min => {
            const corEstilo = coresMap[min.color] || coresMap.emerald;
            const roles = min.ministry_roles || [];
            const roleIdsForMin = roles.map(r => r.id);
            
            const membros = profiles.filter(p => {
                const hasMinId = p.ministry_id === min.id || (p.ministry && p.ministry.toLowerCase() === min.name.toLowerCase());
                const hasRoleInMin = p.user_ministry_roles && p.user_ministry_roles.some(umr => roleIdsForMin.includes(umr.ministry_role_id || umr.role_id));
                return hasMinId || hasRoleInMin;
            });

            const badgesRolesHtml = roles.map(r => {
                const botaoDeletarRole = roleUsuario === 'admin'
                    ? `<button onclick="excluirFuncaoMinisterioAdmin('${r.id}')" class="text-slate-400 hover:text-red-400 font-bold text-[10px] ml-0.5" title="Excluir Função">✕</button>`
                    : '';
                return `<span class="bg-slate-900 border border-slate-700 text-slate-300 text-[11px] px-2 py-0.5 rounded-full font-medium inline-flex items-center gap-1">
                    ${r.name || r.role_name}
                    ${botaoDeletarRole}
                 </span>`;
            }).join('');

            const membrosHtml = membros.map(m => {
                const roleBadge = rolesBadgesCor[m.system_role || m.role] || rolesBadgesCor.voluntario;
                return `
                    <div class="flex items-center justify-between p-2 rounded-lg bg-slate-900/60 border border-slate-700/50 text-xs">
                        <div class="truncate mr-2">
                            <span class="font-medium text-white block truncate">${m.name}</span>
                            <span class="text-[11px] text-slate-400 block truncate">${m.email || 'Sem e-mail'}${m.phone ? ' • ' + m.phone : ''}</span>
                        </div>
                        <div class="flex items-center gap-1.5 flex-shrink-0">
                            <span class="${roleBadge} border text-[10px] px-2 py-0.5 rounded-full font-bold uppercase">${m.system_role || m.role || 'voluntário'}</span>
                            <button onclick="abrirModalIntegranteMinisterio('${m.id}')" class="text-slate-400 hover:text-white p-1 text-xs" title="Editar Integrante">✏️</button>
                            <button onclick="excluirIntegranteMinisterioAdmin('${m.id}')" class="text-red-400 hover:text-red-300 p-1 text-xs" title="Excluir Integrante">🗑️</button>
                        </div>
                    </div>
                `;
            }).join('');

            const botoesMinisterio = roleUsuario === 'admin'
                ? `<div class="flex items-center gap-1.5">
                       <button onclick='abrirModalMinisterioAdmin(${JSON.stringify(min).replace(/'/g, "&apos;")})' class="text-slate-400 hover:text-white text-xs font-medium bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-700">✏️ Editar</button>
                       <button onclick="excluirMinisterioAdmin('${min.id}')" class="text-red-400 hover:text-red-300 text-xs font-medium bg-slate-900 px-2 py-1 rounded-lg border border-slate-700" title="Excluir Ministério">🗑️ Excluir</button>
                   </div>`
                : '';

            const botaoAdicionarFuncao = roleUsuario === 'admin'
                ? `<button onclick="abrirModalFuncaoAdmin('${min.id}')" class="text-xs text-brand-400 hover:text-brand-300 font-medium">+ Adicionar Função</button>`
                : '';

            html += `
                <div class="bg-slate-800/80 border ${corEstilo.split(' ')[0]} rounded-2xl p-5 shadow-lg flex flex-col justify-between space-y-4">
                    <div>
                        <div class="flex items-start justify-between">
                            <div class="flex items-center gap-3">
                                <span class="text-2xl p-2 bg-slate-900/60 border border-slate-700/60 rounded-xl">${min.icon || '🏢'}</span>
                                <div>
                                    <h3 class="font-bold text-base text-white">${min.name}</h3>
                                    <p class="text-xs text-slate-400">${min.description || 'Sem descrição cadastrada.'}</p>
                                </div>
                            </div>
                            ${botoesMinisterio}
                        </div>

                        <!-- Funções do Ministério -->
                        <div class="mt-4 pt-3 border-t border-slate-700/50">
                            <div class="flex items-center justify-between mb-2">
                                <span class="text-xs font-semibold text-slate-300">Funções (${roles.length})</span>
                                ${botaoAdicionarFuncao}
                            </div>
                            <div class="flex flex-wrap gap-1.5 min-h-[24px]">
                                ${badgesRolesHtml || '<span class="text-xs text-slate-500 italic">Nenhuma função definida.</span>'}
                            </div>
                        </div>

                        <!-- Integrantes do Ministério -->
                        <div class="mt-4 pt-3 border-t border-slate-700/50">
                            <div class="flex items-center justify-between mb-2">
                                <span class="text-xs font-semibold text-slate-300">Integrantes (${membros.length})</span>
                                <button onclick="abrirModalIntegranteMinisterio(null, '${min.id}')" class="text-xs text-brand-400 hover:text-brand-300 font-medium">+ Integrante</button>
                            </div>
                            <div class="space-y-1.5 max-h-44 overflow-y-auto">
                                ${membrosHtml || '<span class="text-xs text-slate-500 italic">Nenhum integrante vinculado a este ministério.</span>'}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });

        // Card Especial para Integrantes Sem Ministério (Admins Globais, Membros Sem Ministério)
        const perfisSemMinisterio = profiles.filter(p => {
            const userMinIds = typeof obterIdsMinisteriosDoUsuario === 'function' ? obterIdsMinisteriosDoUsuario(p) : [p.ministry_id];
            return !p.ministry_id && (!userMinIds || userMinIds.length === 0);
        });

        if (roleUsuario === 'admin') {
            const membrosSemMinHtml = perfisSemMinisterio.map(p => {
                const name = p.name || p.email || 'Sem nome';
                let sysRole = (p.system_role || p.role || 'voluntario').toLowerCase();
                let badgeClass = 'bg-slate-700 text-slate-300';
                let badgeText = 'Sem Ministério';

                if (sysRole === 'admin') {
                    badgeClass = 'bg-indigo-900/60 text-indigo-300 border border-indigo-700/50';
                    badgeText = '👑 Admin';
                } else if (sysRole === 'membro') {
                    badgeClass = 'bg-amber-950/60 text-amber-300 border border-amber-700/50';
                    badgeText = '👤 Membro';
                }

                return `
                    <div class="flex items-center justify-between p-2 bg-slate-900/80 rounded-lg border border-slate-700/60 text-xs">
                        <div class="flex items-center gap-2">
                            <span class="font-medium text-white">${name}</span>
                            <span class="text-[10px] px-1.5 py-0.5 rounded ${badgeClass}">${badgeText}</span>
                        </div>
                        <button onclick="abrirModalIntegranteMinisterio('${p.id}')" class="text-[11px] text-slate-400 hover:text-white font-medium">✏️ Editar</button>
                    </div>
                `;
            }).join('');

            html += `
                <div class="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-5 shadow-lg flex flex-col justify-between space-y-4">
                    <div>
                        <div class="flex items-center gap-3 pb-3 border-b border-slate-700/50">
                            <span class="text-2xl p-2 bg-slate-900/60 border border-slate-700/60 rounded-xl">👤</span>
                            <div>
                                <h3 class="font-bold text-base text-white">Sem Ministério</h3>
                                <p class="text-xs text-slate-400">Admins gerais e membros sem vínculo a equipes</p>
                            </div>
                        </div>

                        <div class="mt-4">
                            <div class="flex items-center justify-between mb-2">
                                <span class="text-xs font-semibold text-slate-300">Cadastrados (${perfisSemMinisterio.length})</span>
                                <button onclick="abrirModalIntegranteMinisterio(null)" class="text-xs text-brand-400 hover:text-brand-300 font-medium">+ Integrante</button>
                            </div>
                            <div class="space-y-1.5 max-h-44 overflow-y-auto">
                                ${membrosSemMinHtml || '<span class="text-xs text-slate-500 italic">Nenhum integrante sem ministério.</span>'}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }

        container.innerHTML = html;
    } catch (err) {
        console.error('Erro ao renderizar ministérios:', err);
        container.innerHTML = '<p class="text-red-400 text-sm py-4">Erro ao carregar lista de ministérios.</p>';
    }
}

async function salvarMinisterioAdmin() {
    const id = document.getElementById('ministerio-admin-id').value;
    const name = document.getElementById('ministerio-admin-nome').value.trim();
    const description = document.getElementById('ministerio-admin-descricao').value.trim();
    const icon = document.getElementById('ministerio-admin-icone').value.trim() || '🏢';
    const color = document.getElementById('ministerio-admin-cor').value;

    if (!name) {
        if (typeof mostrarToast === 'function') mostrarToast('Digite o nome do ministério.', 'aviso');
        return;
    }

    try {
        if (!supabaseClient) throw new Error('Cliente Supabase não inicializado.');

        const permKeys = [
            'ver_escala', 'ver_letra', 'ver_cifra', 'ver_vs', 'ver_youtube',
            'ver_cantor', 'ver_midia', 'enviar_solic_musica', 'enviar_sugestao_culto',
            'ver_repertorio', 'ver_musicas_novas', 'ver_aba_midias_upadas', 'ver_agenda', 'gerar_script_holyrics'
        ];
        const permissions = {};
        permKeys.forEach(key => {
            const cb = document.getElementById(`perm-${key}`);
            if (cb) permissions[key] = !!cb.checked;
        });

        const payload = { name, description, icon, color, permissions };
        let error = null;

        if (id) {
            const { error: err } = await supabaseClient.from('ministries').update(payload).eq('id', id);
            error = err;
        } else {
            const { error: err } = await supabaseClient.from('ministries').insert([payload]);
            error = err;
        }

        if (error) throw error;

        fecharModalMinisterioAdmin();
        if (typeof mostrarToast === 'function') mostrarToast('Ministério salvo com sucesso!', 'sucesso');
        await renderizarAdminMinisterios();
    } catch (err) {
        console.error('Erro ao salvar ministério:', err);
        if (typeof mostrarToast === 'function') mostrarToast(`Erro ao salvar ministério: ${err.message}`, 'erro');
    }
}

async function salvarFuncaoAdmin() {
    const ministry_id = document.getElementById('funcao-admin-ministerio-id').value;
    const name = document.getElementById('funcao-admin-nome').value.trim();

    if (!ministry_id || !name) {
        if (typeof mostrarToast === 'function') mostrarToast('Selecione o ministério e digite o nome da função.', 'aviso');
        return;
    }

    try {
        if (!supabaseClient) throw new Error('Cliente Supabase não inicializado.');

        const { error } = await supabaseClient
            .from('ministry_roles')
            .insert([{ ministry_id, name }]);

        if (error) throw error;

        fecharModalFuncaoAdmin();
        if (typeof mostrarToast === 'function') mostrarToast('Função adicionada com sucesso!', 'sucesso');
        await renderizarAdminMinisterios();
    } catch (err) {
        console.error('Erro ao salvar função:', err);
        if (typeof mostrarToast === 'function') mostrarToast(`Erro ao salvar função: ${err.message}`, 'erro');
    }
}

// ===================== ADMIN: INTEGRANTE DE MINISTÉRIO =====================

function fecharModalIntegranteMinisterioAdmin() {
    const modal = document.getElementById('modal-integrante-ministerio-admin');
    if (modal) modal.classList.add('hidden');
}

async function atualizarFuncoesCheckboxMinisterio(selectedRoleIds = null, leaderMinistryIds = null) {
    const container = document.getElementById('container-funcoes-ministerio-admin');
    if (!container) return;

    if (!Array.isArray(selectedRoleIds)) {
        const currentlyChecked = document.querySelectorAll('input[name="user_roles"]:checked');
        selectedRoleIds = Array.from(currentlyChecked).map(cb => cb.value);
    }
    if (!Array.isArray(leaderMinistryIds)) {
        const leaderRadios = document.querySelectorAll('input[name^="min_role_"]:checked[value="lider"]');
        leaderMinistryIds = Array.from(leaderRadios).map(r => r.name.replace('min_role_', ''));
    }

    const checkedMinCbs = document.querySelectorAll('input[name="user_ministries"]:checked');
    const selectedMinIds = Array.from(checkedMinCbs).map(cb => cb.value);

    if (selectedMinIds.length === 0) {
        container.innerHTML = '<span class="text-xs text-slate-500 italic">Selecione ao menos um ministério acima...</span>';
        return;
    }

    const userToEvaluate = (typeof modoSimulacaoPerfil !== 'undefined' ? modoSimulacaoPerfil : null) || usuarioLogado;
    const roleUsuario = userToEvaluate ? (userToEvaluate.system_role || userToEvaluate.role || 'membro') : 'visitante';
    const isLider = (roleUsuario === 'lider');

    const ministries = dadosGlobais.ministries || [];
    let html = '';

    selectedMinIds.forEach(minId => {
        const min = ministries.find(m => m.id === minId);
        if (!min) return;

        const roles = min.ministry_roles || [];
        const isLeader = leaderMinistryIds.includes(min.id);

        const radiosLiderHtml = isLider ? '' : `
            <div class="flex items-center gap-3 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
                <label class="flex items-center gap-1 text-xs text-slate-300 cursor-pointer hover:text-white">
                    <input type="radio" name="min_role_${min.id}" value="voluntario" ${!isLeader ? 'checked' : ''} class="accent-brand-500">
                    <span>Voluntário nesse ministério</span>
                </label>
                <label class="flex items-center gap-1 text-xs text-amber-400 font-medium cursor-pointer hover:text-amber-300">
                    <input type="radio" name="min_role_${min.id}" value="lider" ${isLeader ? 'checked' : ''} class="accent-amber-500">
                    <span>⭐ Líder deste ministério</span>
                </label>
            </div>
        `;

        html += `
            <div class="mb-3 last:mb-0 bg-slate-900 border border-slate-700/80 p-3 rounded-xl space-y-2">
                <div class="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-800">
                    <span class="text-xs font-bold text-brand-400 flex items-center gap-1.5">
                        <span>${min.icon || '🏢'}</span> ${min.name}
                    </span>
                    ${radiosLiderHtml}
                </div>
                <div class="flex flex-wrap gap-2 pt-1">
                    ${roles.length > 0 ? roles.map(r => `
                        <label class="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer bg-slate-950 border border-slate-700 px-2.5 py-1 rounded-lg hover:border-slate-500 transition">
                            <input type="checkbox" name="user_roles" value="${r.id}" data-ministry-id="${min.id}" ${selectedRoleIds.includes(r.id) ? 'checked' : ''} class="accent-brand-500 rounded">
                            <span>${r.name || r.role_name}</span>
                        </label>
                    `).join('') : '<span class="text-[11px] text-slate-500 italic">Nenhuma função cadastrada neste ministério.</span>'}
                </div>
            </div>
        `;
    });

    container.innerHTML = html || '<span class="text-xs text-slate-500 italic">Nenhuma função encontrada.</span>';
}

async function abrirModalIntegranteMinisterio(profileId = null, defaultMinistryId = null) {
    const modal = document.getElementById('modal-integrante-ministerio-admin');
    if (!modal) return;

    const userToEvaluate = (typeof modoSimulacaoPerfil !== 'undefined' ? modoSimulacaoPerfil : null) || usuarioLogado;
    const roleUsuario = userToEvaluate ? (userToEvaluate.system_role || userToEvaluate.role || 'membro') : 'visitante';
    const ministryIdUsuario = userToEvaluate ? userToEvaluate.ministry_id : null;

    const inputNome = document.getElementById('integrante-ministerio-nome');
    if (inputNome) inputNome.disabled = (roleUsuario === 'lider');

    const containerPrivilegios = document.getElementById('container-privilegios-globais-admin');
    if (containerPrivilegios) {
        if (roleUsuario === 'lider') containerPrivilegios.classList.add('hidden');
        else containerPrivilegios.classList.remove('hidden');
    }

    const containerMinSec = document.getElementById('container-secao-ministerios-admin');
    if (containerMinSec) {
        if (roleUsuario === 'lider') containerMinSec.classList.add('hidden');
        else containerMinSec.classList.remove('hidden');
    }

    const roleEl = document.getElementById('integrante-ministerio-role');
    if (roleEl) roleEl.value = 'voluntario';

    const chkAdmin = document.getElementById('chk-role-admin');
    const chkMembro = document.getElementById('chk-role-membro');
    if (chkAdmin) {
        chkAdmin.checked = false;
        chkAdmin.disabled = (roleUsuario !== 'admin');
    }
    if (chkMembro) chkMembro.checked = false;

    let userRoleIds = [];
    let leaderMinistryIds = [];
    let selectedMinistryIds = defaultMinistryId ? [defaultMinistryId] : [];

    if (profileId && supabaseClient) {
        try {
            const { data: mlData } = await supabaseClient
                .from('ministry_leaders')
                .select('ministry_id')
                .eq('profile_id', profileId);

            if (mlData) {
                leaderMinistryIds = mlData.map(m => m.ministry_id).filter(Boolean);
                leaderMinistryIds.forEach(mId => {
                    if (!selectedMinistryIds.includes(mId)) selectedMinistryIds.push(mId);
                });
            }

            const { data: profile, error: profErr } = await supabaseClient
                .from('profiles')
                .select('*')
                .eq('id', profileId)
                .maybeSingle();

            if (profErr) {
                console.warn('Erro ao carregar perfil:', profErr);
            }

            if (profile) {
                document.getElementById('integrante-ministerio-nome').value = profile.name || '';
                document.getElementById('integrante-ministerio-email').value = profile.email || '';
                document.getElementById('integrante-ministerio-telefone').value = profile.phone || '';
                
                const sysRole = (profile.system_role || profile.role || 'voluntario').toLowerCase();
                if (chkAdmin) chkAdmin.checked = (sysRole === 'admin');
                if (chkMembro) chkMembro.checked = (sysRole === 'membro');

                if (sysRole === 'lider' && leaderMinistryIds.length === 0 && profile.ministry_id) {
                    leaderMinistryIds.push(profile.ministry_id);
                }

                if (profile.ministry_id && !selectedMinistryIds.includes(profile.ministry_id)) {
                    selectedMinistryIds.push(profile.ministry_id);
                }

                try {
                    const { data: umr } = await supabaseClient
                        .from('user_ministry_roles')
                        .select('*')
                        .or(`profile_id.eq.${profileId},user_id.eq.${profileId}`);
                    
                    if (umr) {
                        profile.user_ministry_roles = umr;
                        userRoleIds = umr.map(ur => ur.ministry_role_id || ur.role_id);

                        (dadosGlobais.ministries || []).forEach(m => {
                            const minRoleIds = (m.ministry_roles || []).map(r => r.id);
                            const temRoleNoMin = minRoleIds.some(rId => userRoleIds.includes(rId));
                            if (temRoleNoMin && !selectedMinistryIds.includes(m.id)) {
                                selectedMinistryIds.push(m.id);
                            }
                        });
                    }
                } catch(e) {
                    console.warn('Erro ao carregar roles do perfil:', e);
                }
            }
        } catch (e) {
            console.warn('Erro ao carregar dados do perfil:', e);
        }
    }

    // Renderiza a lista de Checkboxes de Ministérios
    const containerMin = document.getElementById('container-ministerios-checkbox-admin');
    if (containerMin) {
        let listMin = dadosGlobais.ministries || [];
        if (roleUsuario === 'lider' && ministryIdUsuario) {
            listMin = listMin.filter(m => m.id === ministryIdUsuario);
        }

        if (listMin.length === 0) {
            containerMin.innerHTML = '<span class="text-slate-500 text-xs italic">Nenhum ministério encontrado.</span>';
        } else {
            containerMin.innerHTML = listMin.map(m => {
                const checked = selectedMinistryIds.includes(m.id) ? 'checked' : '';
                return `
                    <label class="flex items-center gap-2 text-xs text-slate-300 cursor-pointer hover:text-white bg-slate-900 border border-slate-700 px-2.5 py-1.5 rounded-lg">
                        <input type="checkbox" name="user_ministries" value="${m.id}" ${checked} onchange="atualizarFuncoesCheckboxMinisterio()" class="accent-brand-500 rounded">
                        <span>${m.icon || '🏢'} ${m.name}</span>
                    </label>
                `;
            }).join('');
        }
    }

    await atualizarFuncoesCheckboxMinisterio(userRoleIds, leaderMinistryIds);
    modal.classList.remove('hidden');
}

async function salvarIntegranteMinisterioAdmin() {
    const id = document.getElementById('integrante-ministerio-id').value;
    const name = document.getElementById('integrante-ministerio-nome').value.trim();
    const email = document.getElementById('integrante-ministerio-email').value.trim();
    const phone = document.getElementById('integrante-ministerio-telefone').value.trim();

    const chkAdmin = document.getElementById('chk-role-admin');
    const chkMembro = document.getElementById('chk-role-membro');

    const checkedMinCbs = document.querySelectorAll('input[name="user_ministries"]:checked');
    const selectedMinIds = Array.from(checkedMinCbs).map(cb => cb.value);
    const primaryMinistryId = selectedMinIds.length > 0 ? selectedMinIds[0] : null;

    // Descobre em quais ministérios a opção 'lider' foi selecionada
    const leaderMinIds = [];
    selectedMinIds.forEach(mId => {
        const radLider = document.querySelector(`input[name="min_role_${mId}"][value="lider"]:checked`);
        if (radLider) leaderMinIds.push(mId);
    });

    let system_role = 'voluntario';
    if (chkAdmin && chkAdmin.checked) {
        system_role = 'admin';
    } else if (chkMembro && chkMembro.checked) {
        system_role = 'membro';
    } else if (leaderMinIds.length > 0) {
        system_role = 'lider';
    }

    if (!name) {
        if (typeof mostrarToast === 'function') mostrarToast('Digite o nome do integrante.', 'aviso');
        return;
    }

    try {
        if (!supabaseClient) throw new Error('Cliente Supabase não inicializado.');

        const checkboxesChecked = document.querySelectorAll('input[name="user_roles"]:checked');
        const roleIdsSelected = Array.from(checkboxesChecked).map(cb => cb.value);
        
        // Descobre os nomes das funções marcadas
        const roleNamesSelected = [];
        let foundChurchId = null;
        (dadosGlobais.ministries || []).forEach(m => {
            if (selectedMinIds.includes(m.id) && m.church_id) {
                foundChurchId = m.church_id;
            }
            (m.ministry_roles || []).forEach(mr => {
                if (roleIdsSelected.includes(mr.id)) roleNamesSelected.push(mr.name || mr.role_name);
            });
        });

        let churchId = dadosGlobais.church ? dadosGlobais.church.id : foundChurchId;
        if (!churchId && dadosGlobais.ministries && dadosGlobais.ministries.length > 0) {
            churchId = dadosGlobais.ministries[0].church_id;
        }
        if (!churchId) {
            try {
                const { data: cData } = await supabaseClient.from('churches').select('id').order('created_at', { ascending: false }).limit(1);
                if (cData && cData.length > 0) churchId = cData[0].id;
            } catch(e){}
        }
        if (!churchId) {
            churchId = 'ae125cfd-96ef-4324-b1f0-f96a4f34eecf';
        }

        const userToEvaluate = (typeof modoSimulacaoPerfil !== 'undefined' ? modoSimulacaoPerfil : null) || usuarioLogado;
        const roleUsuario = userToEvaluate ? (userToEvaluate.system_role || userToEvaluate.role || 'membro') : 'visitante';
        const isLider = (roleUsuario === 'lider');

        let profileId = id;

        if (id && isLider) {
            const { error: err } = await supabaseClient.from('profiles').update({ 
                email, 
                phone,
                instruments: roleNamesSelected.join(', ')
            }).eq('id', id);
            if (err) throw err;
        } else {
            const payload = { 
                name, 
                email, 
                phone, 
                system_role,
                instruments: roleNamesSelected.join(', '),
                church_id: churchId,
                ministry_id: primaryMinistryId
            };

            if (id) {
                const { error: err } = await supabaseClient.from('profiles').update(payload).eq('id', id);
                if (err) throw err;
            } else {
                const { data: newProf, error: err } = await supabaseClient.from('profiles').insert([payload]).select().single();
                if (err) throw err;
                if (newProf) profileId = newProf.id;
            }
        }

        const roleIds = roleIdsSelected;

        if (profileId) {
            // Detecta as colunas reais da tabela user_ministry_roles para evitar erros 400 no console
            let userCol = 'user_id';
            let roleCol = 'role_id';

            if (window._umrSchemaCols) {
                userCol = window._umrSchemaCols.userCol;
                roleCol = window._umrSchemaCols.roleCol;
            } else {
                try {
                    const { data: sampleData } = await supabaseClient.from('user_ministry_roles').select('*').limit(1);
                    if (sampleData && sampleData.length > 0) {
                        const keys = Object.keys(sampleData[0]);
                        if (keys.includes('profile_id')) userCol = 'profile_id';
                        if (keys.includes('ministry_role_id')) roleCol = 'ministry_role_id';
                        window._umrSchemaCols = { userCol, roleCol };
                    }
                } catch(e){}
            }

            // Remove registros anteriores
            await supabaseClient.from('user_ministry_roles').delete().eq(userCol, profileId);

            if (roleIds.length > 0) {
                const insertData = roleIds.map(rId => {
                    const row = {};
                    row[userCol] = profileId;
                    row[roleCol] = rId;
                    return row;
                });

                let { error: insErr } = await supabaseClient.from('user_ministry_roles').insert(insertData);
                
                if (insErr) {
                    // Fallback caso a detecção inicial precise de ajuste
                    const altUserCol = userCol === 'user_id' ? 'profile_id' : 'user_id';
                    const altRoleCol = roleCol === 'role_id' ? 'ministry_role_id' : 'role_id';
                    const fallbackData = roleIds.map(rId => {
                        const row = {};
                        row[altUserCol] = profileId;
                        row[altRoleCol] = rId;
                        return row;
                    });
                    const fbRes = await supabaseClient.from('user_ministry_roles').insert(fallbackData);
                    if (fbRes.error) {
                        console.error("Falha final ao inserir user_ministry_roles:", fbRes.error);
                        throw new Error("Não foi possível salvar as funções do integrante. " + fbRes.error.message);
                    } else {
                    }
                }
            }

            // Salva as lideranças de ministério (ministry_leaders) apenas se for Admin
            if (!isLider) {
                try {
                    await supabaseClient.from('ministry_leaders').delete().eq('profile_id', profileId);
                    if (leaderMinIds && leaderMinIds.length > 0) {
                        const insertLeaders = leaderMinIds.map(mId => ({
                            profile_id: profileId,
                            ministry_id: mId
                        }));
                        const { error: mlErr } = await supabaseClient.from('ministry_leaders').insert(insertLeaders);
                        if (mlErr) console.warn('Erro ao salvar em ministry_leaders:', mlErr);
                    }
                } catch(e) {
                    console.warn('Erro ao atualizar tabela ministry_leaders:', e);
                }
            }
        }

        fecharModalIntegranteMinisterioAdmin();
        if (typeof mostrarToast === 'function') mostrarToast('Integrante salvo com sucesso!', 'sucesso');
        await carregarDados(); // Recarrega dados globais
        await renderizarAdminMinisterios();
    } catch (err) {
        console.error('Erro ao salvar integrante:', err);
        if (typeof mostrarToast === 'function') mostrarToast(`Erro ao salvar integrante: ${err.message}`, 'erro');
    }
}


// ===================== EXCLUSÕES DE MINISTÉRIOS, FUNÇÕES E INTEGRANTES =====================

async function excluirMinisterioAdmin(id) {
    if (!confirm('Tem certeza que deseja excluir este ministério? Esta ação não pode ser desfeita.')) return;
    try {
        if (!supabaseClient) throw new Error('Cliente Supabase não inicializado.');
        const { error } = await supabaseClient.from('ministries').delete().eq('id', id);
        if (error) throw error;
        if (typeof mostrarToast === 'function') mostrarToast('Ministério excluído com sucesso!', 'sucesso');
        await renderizarAdminMinisterios();
    } catch (err) {
        console.error('Erro ao excluir ministério:', err);
        if (typeof mostrarToast === 'function') mostrarToast(`Erro ao excluir: ${err.message}`, 'erro');
    }
}

async function excluirFuncaoMinisterioAdmin(id) {
    if (!confirm('Tem certeza que deseja excluir esta função?')) return;
    try {
        if (!supabaseClient) throw new Error('Cliente Supabase não inicializado.');
        const { error } = await supabaseClient.from('ministry_roles').delete().eq('id', id);
        if (error) throw error;
        if (typeof mostrarToast === 'function') mostrarToast('Função excluída com sucesso!', 'sucesso');
        await renderizarAdminMinisterios();
    } catch (err) {
        console.error('Erro ao excluir função:', err);
        if (typeof mostrarToast === 'function') mostrarToast(`Erro ao excluir: ${err.message}`, 'erro');
    }
}

async function excluirIntegranteMinisterioAdmin(id) {
    if (!confirm('Tem certeza que deseja excluir este integrante da equipe?')) return;
    try {
        if (!supabaseClient) throw new Error('Cliente Supabase não inicializado.');
        await supabaseClient.from('user_ministry_roles').delete().eq('user_id', id);
        const { error } = await supabaseClient.from('profiles').delete().eq('id', id);
        if (error) throw error;
        if (typeof mostrarToast === 'function') mostrarToast('Integrante excluído com sucesso!', 'sucesso');
        await renderizarAdminMinisterios();
    } catch (err) {
        console.error('Erro ao excluir integrante:', err);
        if (typeof mostrarToast === 'function') mostrarToast(`Erro ao excluir: ${err.message}`, 'erro');
    }
}

// ===================== ADMIN: MÍDIAS (UPLOAD E STORAGE) =====================

window.addEventListener('DOMContentLoaded', () => {
    const dropzone = document.getElementById('dropzone-midia');
    const inputUpload = document.getElementById('input-upload-midia');

    if (dropzone && inputUpload) {
        dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropzone.classList.add('border-indigo-400', 'bg-slate-700/50');
        });

        dropzone.addEventListener('dragleave', () => {
            dropzone.classList.remove('border-indigo-400', 'bg-slate-700/50');
        });

        dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropzone.classList.remove('border-indigo-400', 'bg-slate-700/50');
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                lidarComUploadMidia(e.dataTransfer.files);
            }
        });

        inputUpload.addEventListener('change', (e) => {
            if (e.target.files && e.target.files.length > 0) {
                lidarComUploadMidia(e.target.files);
            }
        });
    }
});

async function lidarComUploadMidia(files) {
    const progressBar = document.getElementById('midia-upload-progress');
    const bar = document.getElementById('midia-upload-bar');
    const text = document.getElementById('midia-upload-text');

    if (progressBar) progressBar.classList.remove('hidden');
    
    let sucessoCount = 0;

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (text) text.textContent = `Enviando ${file.name} (${i + 1}/${files.length})...`;
        if (bar) bar.style.width = `${((i) / files.length) * 100}%`;

        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
            const filePath = `${fileName}`;

            const { data, error } = await supabaseClient.storage
                .from('media-inbox')
                .upload(filePath, file, { upsert: false });

            if (error) {
                console.error("Erro ao subir arquivo:", error);
                if (typeof mostrarToast === 'function') mostrarToast(`Erro ao enviar ${file.name}`, 'erro');
            } else {
                sucessoCount++;
            }
        } catch (err) {
            console.error(err);
        }
    }

    if (bar) bar.style.width = `100%`;
    if (text) text.textContent = `Concluído! ${sucessoCount} arquivos enviados.`;
    
    setTimeout(() => {
        if (progressBar) progressBar.classList.add('hidden');
        carregarMidiasAdmin();
    }, 2000);
}

async function carregarMidiasAdmin() {
    const grid = document.getElementById('lista-midias-grid');
    if (!grid) return;

    if (!supabaseClient) return;

    grid.innerHTML = '<p class="text-slate-500 text-sm col-span-full">Carregando arquivos...</p>';

    try {
        const { data, error } = await supabaseClient.storage.from('media-inbox').list('', {
            limit: 50,
            sortBy: { column: 'created_at', order: 'desc' }
        });

        if (error) throw error;

        if (!data || data.length === 0 || (data.length === 1 && data[0].name === '.emptyFolderPlaceholder')) {
            grid.innerHTML = '<p class="text-slate-500 text-sm col-span-full">Nenhuma mídia encontrada na caixa de entrada.</p>';
            return;
        }

        let html = '';
        for (const file of data) {
            if (file.name === '.emptyFolderPlaceholder') continue;
            
            const { data: publicUrlData } = supabaseClient.storage.from('media-inbox').getPublicUrl(file.name);
            const url = publicUrlData.publicUrl;

            const isImage = file.metadata?.mimetype?.startsWith('image/') || file.name.match(/\.(jpeg|jpg|gif|png)$/i);
            const isVideo = file.metadata?.mimetype?.startsWith('video/') || file.name.match(/\.(mp4|webm|ogg)$/i);

            let previewHtml = '';
            if (isImage) {
                previewHtml = `<img src="${url}" class="w-full h-32 object-cover rounded-t-lg">`;
            } else if (isVideo) {
                previewHtml = `<video src="${url}" class="w-full h-32 object-cover rounded-t-lg" muted></video>`;
            } else {
                previewHtml = `<div class="w-full h-32 bg-slate-800 flex items-center justify-center rounded-t-lg text-4xl">📄</div>`;
            }

            html += `
                <div class="bg-slate-900 border border-slate-700 rounded-lg shadow-sm flex flex-col hover:border-indigo-500/50 transition group">
                    ${previewHtml}
                    <div class="p-3 flex-1 flex flex-col justify-between">
                        <p class="text-xs text-slate-300 truncate mb-2" title="${file.name}">${file.name}</p>
                        <div class="flex items-center justify-between mt-auto">
                            <div class="flex items-center gap-3">
                                <a href="${url}" target="_blank" download class="text-indigo-400 hover:text-indigo-300 text-xs font-medium">Baixar</a>
                                <button onclick="abrirModalVincularMidia('${file.name}', '${url}')" class="text-emerald-400 hover:text-emerald-300 text-xs font-medium opacity-0 group-hover:opacity-100 transition">Vincular Culto</button>
                            </div>
                            <button onclick="excluirMidiaAdmin('${file.name}')" class="text-slate-500 hover:text-red-400 text-xs opacity-0 group-hover:opacity-100 transition">Excluir</button>
                        </div>
                    </div>
                </div>
            `;
        }

        grid.innerHTML = html;
    } catch (err) {
        console.error("Erro ao carregar mídias:", err);
        grid.innerHTML = '<p class="text-red-400 text-sm col-span-full">Erro ao carregar arquivos. Verifique se o bucket "media-inbox" existe e é público no Supabase.</p>';
    }
}

async function excluirMidiaAdmin(fileName) {
    if (!confirm(`Deseja excluir o arquivo ${fileName}?`)) return;

    try {
        const { error } = await supabaseClient.storage.from('media-inbox').remove([fileName]);
        if (error) throw error;
        
        if (typeof mostrarToast === 'function') mostrarToast('Arquivo excluído', 'sucesso');
        carregarMidiasAdmin();
    } catch (err) {
        console.error("Erro ao excluir mídia:", err);
        if (typeof mostrarToast === 'function') mostrarToast('Erro ao excluir', 'erro');
    }
}

function abrirModalVincularMidia(fileName, url) {
    const modal = document.getElementById('modal-vincular-midia');
    if (!modal) {
        // Criar modal dinamicamente caso não exista
        const div = document.createElement('div');
        div.id = 'modal-vincular-midia';
        div.className = 'fixed inset-0 bg-black/80 z-[150] flex items-center justify-center p-4';
        div.innerHTML = `
            <div class="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-sm p-6 shadow-2xl relative">
                <button onclick="document.getElementById('modal-vincular-midia').classList.add('hidden')" class="absolute top-4 right-4 text-slate-400 hover:text-white transition">✕</button>
                <h3 class="text-lg font-bold text-white mb-2">Vincular a Culto</h3>
                <p class="text-slate-400 text-sm mb-4 truncate" id="vincular-midia-nome"></p>
                <input type="hidden" id="vincular-midia-url">
                <div class="space-y-4">
                    <div>
                        <label class="block text-sm font-medium text-slate-300 mb-1">Selecione o Culto</label>
                        <select id="vincular-midia-culto" class="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"></select>
                    </div>
                    <button onclick="salvarVinculoMidia()" class="w-full bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg px-4 py-2 text-sm font-medium transition">Salvar Vínculo</button>
                </div>
            </div>
        `;
        document.body.appendChild(div);
    }
    
    document.getElementById('vincular-midia-nome').textContent = fileName;
    document.getElementById('vincular-midia-url').value = url;
    
    // Popular select
    const select = document.getElementById('vincular-midia-culto');
    select.innerHTML = '<option value="">Carregando...</option>';
    
    if (dadosGlobais && dadosGlobais.servicesDataList) {
        select.innerHTML = '<option value="">Selecione...</option>';
        dadosGlobais.servicesDataList.forEach(s => {
            const nome = s.title || `CULTO DE ${(s.type || 'DOMINGO').toUpperCase()} - ${s.date || ''}`;
            select.innerHTML += `<option value="${s.id}">${nome}</option>`;
        });
    }

    document.getElementById('modal-vincular-midia').classList.remove('hidden');
}

async function salvarVinculoMidia() {
    const cultoId = document.getElementById('vincular-midia-culto').value;
    const url = document.getElementById('vincular-midia-url').value;
    const nome = document.getElementById('vincular-midia-nome').textContent;

    if (!cultoId) {
        if (typeof mostrarToast === 'function') mostrarToast('Selecione um culto', 'erro');
        return;
    }

    try {
        // Busca o culto para ver os links atuais
        const { data: service, error: fetchErr } = await supabaseClient.from('services').select('media_urls').eq('id', cultoId).single();
        if (fetchErr) throw fetchErr;

        let medias = service.media_urls || [];
        medias.push({ name: nome, url: url });

        const { error: updateErr } = await supabaseClient.from('services').update({ media_urls: medias }).eq('id', cultoId);
        if (updateErr) throw updateErr;

        if (typeof mostrarToast === 'function') mostrarToast('Mídia vinculada com sucesso!', 'sucesso');
        document.getElementById('modal-vincular-midia').classList.add('hidden');
        
        // Recarregar app principal
        if (typeof carregarDados === 'function') carregarDados();

    } catch (err) {
        console.error("Erro ao vincular mídia:", err);
        if (typeof mostrarToast === 'function') mostrarToast('Erro ao salvar no Supabase', 'erro');
    }
}

// ===================== GESTÃO DE MEMBROS & PERMISSÕES EM CONFIGURAÇÕES =====================

async function renderizarAdminListaMembros() {
    const container = document.getElementById('admin-lista-membros');
    if (!container) return;
    container.innerHTML = '<p class="text-slate-500 text-xs py-4 text-center">Carregando membros da igreja...</p>';

    try {
        let profiles = [];
        if (supabaseClient) {
            const currentChurchId = (typeof dadosGlobais !== 'undefined' && dadosGlobais.church?.id) ? dadosGlobais.church.id : null;
            let query = supabaseClient.from('profiles').select('id, name, email, system_role, role, ministry_id, ministries');
            if (currentChurchId) query = query.eq('church_id', currentChurchId);

            const { data, error } = await query;
            if (!error && data) profiles = data;
        }

        if (profiles.length === 0 && dadosGlobais.voluntarios) {
            profiles = dadosGlobais.voluntarios;
        }

        const userToEvaluate = (typeof modoSimulacaoPerfil !== 'undefined' ? modoSimulacaoPerfil : null) || usuarioLogado;
        const roleUsuario = userToEvaluate ? (userToEvaluate.system_role || userToEvaluate.role || 'membro').toLowerCase() : 'visitante';
        const ministeriosQueLidera = typeof obterIdsMinisteriosQueLidera === 'function' 
            ? obterIdsMinisteriosQueLidera(userToEvaluate) 
            : (userToEvaluate?.ministry_id ? [userToEvaluate.ministry_id] : []);

        if (roleUsuario === 'lider' && ministeriosQueLidera.length > 0) {
            profiles = profiles.filter(p => {
                const userMinIds = typeof obterIdsMinisteriosDoUsuario === 'function' ? obterIdsMinisteriosDoUsuario(p) : [p.ministry_id];
                // Exibe membros do seu ministério ou membros sem ministério
                return userMinIds.some(id => ministeriosQueLidera.includes(id)) || userMinIds.length === 0 || !p.ministry_id;
            });
        }

        if (profiles.length === 0) {
            container.innerHTML = '<p class="text-slate-500 text-xs py-4 text-center">Nenhum membro cadastrado ainda.</p>';
            return;
        }

        container.innerHTML = profiles.map(p => {
            const name = p.name || p.email || 'Sem nome';
            const email = p.email || 'Sem email';
            let role = (p.system_role || p.role || 'voluntario').toLowerCase();
            
            let roleBadge = '<span class="bg-slate-700 text-slate-300 text-[10px] px-2 py-0.5 rounded font-medium">Voluntário</span>';
            if (role === 'admin') roleBadge = '<span class="bg-indigo-900/60 text-indigo-300 border border-indigo-700/50 text-[10px] px-2 py-0.5 rounded font-medium">👑 Administrador</span>';
            else if (role === 'lider') roleBadge = '<span class="bg-emerald-900/60 text-emerald-300 border border-emerald-700/50 text-[10px] px-2 py-0.5 rounded font-medium">⭐ Líder</span>';
            else if (role === 'membro') roleBadge = '<span class="bg-amber-950/60 text-amber-300 border border-amber-700/50 text-[10px] px-2 py-0.5 rounded font-medium">👤 Membro Limitado</span>';

            const userMin = typeof getMinistryForUser === 'function' ? getMinistryForUser(p) : null;
            const minName = userMin ? userMin.name : (p.ministries || 'Geral');

            return `
                <div class="flex items-center justify-between p-3 bg-slate-900/60 rounded-xl border border-slate-700/60 gap-3 flex-wrap sm:flex-nowrap">
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs text-white shrink-0">
                            👤
                        </div>
                        <div>
                            <div class="flex items-center gap-2 flex-wrap">
                                <h4 class="font-bold text-white text-xs">${name}</h4>
                                ${roleBadge}
                            </div>
                            <p class="text-[11px] text-slate-400 mt-0.5">${email} • <span class="text-brand-300">${minName}</span></p>
                        </div>
                    </div>
                    <button onclick="abrirModalEditarMembroAdmin('${p.id}')" class="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 px-3 py-1.5 rounded-lg transition font-medium">
                        ✏️ Editar
                    </button>
                </div>
            `;
        }).join('');

    } catch (err) {
        console.error("Erro ao carregar lista de membros:", err);
        container.innerHTML = '<p class="text-red-400 text-xs py-4 text-center">Erro ao carregar membros.</p>';
    }
}

function carregarPermissoesPublicas() {
    let perms = dadosGlobais.church && dadosGlobais.church.public_permissions ? dadosGlobais.church.public_permissions : {};
    if (typeof perms === 'string') {
        try { perms = JSON.parse(perms); } catch(e) { perms = {}; }
    }
    if (!perms || typeof perms !== 'object') {
        perms = {};
    }

    const defaultPermissions = {
        ver_escala: false,
        ver_letra: true,
        ver_cifra: true,
        ver_vs: false,
        ver_youtube: true,
        ver_cantor: true,
        ver_midia: false,
        enviar_solic_musica: false,
        enviar_sugestao_culto: true,
        ver_repertorio: true,
        ver_musicas_novas: false,
        ver_aba_midias_upadas: false,
        ver_agenda: true,
        gerar_script_holyrics: false,
        ver_almoxarifado: false
    };

    const listaPerms = Object.keys(defaultPermissions);
    const temPermsSalvas = Object.keys(perms).length > 0;

    listaPerms.forEach(key => {
        const checkbox = document.getElementById(`public-perm-${key}`);
        if (checkbox) {
            if (temPermsSalvas && typeof perms[key] !== 'undefined') {
                checkbox.checked = !!perms[key];
            } else if (temPermsSalvas && typeof perms[key] === 'undefined') {
                checkbox.checked = false;
            } else {
                checkbox.checked = !!defaultPermissions[key];
            }
        }
    });
}

async function salvarPermissoesPublicas() {
    const btn = document.getElementById('btn-salvar-perm-publica');
    if (btn) { btn.disabled = true; btn.textContent = 'Salvando...'; }

    try {
        if (!supabaseClient) throw new Error("Cliente Supabase não inicializado.");
        
        let churchId = dadosGlobais.church ? dadosGlobais.church.id : null;
        if (!churchId) throw new Error("Igreja não identificada.");

        const listaPerms = [
            'ver_escala', 'ver_letra', 'ver_cifra', 'ver_vs', 'ver_youtube',
            'ver_cantor', 'ver_midia', 'enviar_solic_musica', 'enviar_sugestao_culto',
            'ver_repertorio', 'ver_musicas_novas', 'ver_aba_midias_upadas', 'ver_agenda', 'gerar_script_holyrics',
            'ver_almoxarifado'
        ];

        const payloadPermissions = {};
        listaPerms.forEach(key => {
            const checkbox = document.getElementById(`public-perm-${key}`);
            if (checkbox) {
                payloadPermissions[key] = checkbox.checked;
            }
        });

        const { error } = await supabaseClient
            .from('churches')
            .update({ public_permissions: payloadPermissions })
            .eq('id', churchId);

        if (error) throw error;

        // Atualiza cache
        if (dadosGlobais.church) {
            dadosGlobais.church.public_permissions = payloadPermissions;
        }

        if (typeof aplicarVisibilidadePermissoes === 'function') aplicarVisibilidadePermissoes();

        if (typeof mostrarToast === 'function') {
            mostrarToast('🌍 Permissões públicas salvas com sucesso!', 'sucesso');
        }

    } catch (err) {
        console.error("Erro ao salvar permissões públicas:", err);
        if (typeof mostrarToast === 'function') mostrarToast('Erro ao salvar permissões públicas.', 'erro');
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = '💾 Salvar Permissões Públicas'; }
    }
}

function abrirModalCriarMembroAdmin() {
    document.getElementById('edit-membro-id').value = '';
    document.getElementById('edit-membro-nome').value = '';
    document.getElementById('edit-membro-email').value = '';
    document.getElementById('edit-membro-senha').value = '';
    document.getElementById('edit-membro-role').value = 'membro';
    document.getElementById('div-membro-senha').classList.remove('hidden');

    const titleEl = document.getElementById('modal-membro-admin-titulo');
    if (titleEl) titleEl.textContent = '👤 Adicionar Novo Membro';

    carregarSelectMinisteriosPermissoes();

    const modal = document.getElementById('modal-membro-admin');
    if (modal) modal.classList.remove('hidden');
}

async function abrirModalEditarMembroAdmin(profileId) {
    if (!profileId) return;

    let profile = null;
    if (supabaseClient) {
        const { data } = await supabaseClient.from('profiles').select('*').eq('id', profileId).single();
        if (data) profile = data;
    }

    if (!profile && dadosGlobais.voluntarios) {
        profile = dadosGlobais.voluntarios.find(p => p.id === profileId);
    }

    if (!profile) {
        mostrarToast('Perfil de membro não encontrado.', 'erro');
        return;
    }

    document.getElementById('edit-membro-id').value = profile.id;
    document.getElementById('edit-membro-nome').value = profile.name || '';
    document.getElementById('edit-membro-email').value = profile.email || '';
    document.getElementById('edit-membro-role').value = profile.system_role || profile.role || 'voluntario';
    document.getElementById('div-membro-senha').classList.add('hidden');

    const titleEl = document.getElementById('modal-membro-admin-titulo');
    if (titleEl) titleEl.textContent = '✏️ Editar Membro / Permissão';

    carregarSelectMinisteriosPermissoes();

    const selectMin = document.getElementById('edit-membro-ministerio');
    if (selectMin && profile.ministry_id) {
        selectMin.value = profile.ministry_id;
    }

    const modal = document.getElementById('modal-membro-admin');
    if (modal) modal.classList.remove('hidden');
}

function fecharModalMembroAdmin() {
    const modal = document.getElementById('modal-membro-admin');
    if (modal) modal.classList.add('hidden');
}

async function salvarMembroAdmin(e) {
    if (e) e.preventDefault();

    const profileId = document.getElementById('edit-membro-id').value;
    const nome = document.getElementById('edit-membro-nome').value.trim();
    const email = document.getElementById('edit-membro-email').value.trim();
    const senha = document.getElementById('edit-membro-senha').value.trim();
    const ministryId = document.getElementById('edit-membro-ministerio').value || null;
    const role = document.getElementById('edit-membro-role').value;

    const btn = document.getElementById('btn-salvar-membro-admin');
    if (btn) { btn.disabled = true; btn.textContent = 'Salvando...'; }

    try {
        if (!supabaseClient) throw new Error("Supabase não inicializado.");
        const currentChurchId = (typeof dadosGlobais !== 'undefined' && dadosGlobais.church?.id) ? dadosGlobais.church.id : null;

        if (profileId) {
            // Edição de usuário existente
            const payload = {
                name: nome,
                email: email,
                system_role: role,
                role: role,
                ministry_id: ministryId
            };
            if (currentChurchId) payload.church_id = currentChurchId;

            const { error } = await supabaseClient.from('profiles').update(payload).eq('id', profileId);
            if (error) throw error;
            mostrarToast('Membro atualizado com sucesso!', 'sucesso');
        } else {
            // Criação de novo usuário no Auth + Profile
            if (!senha || senha.length < 6) {
                mostrarToast('A senha deve ter no mínimo 6 caracteres.', 'aviso');
                if (btn) { btn.disabled = false; btn.textContent = 'Salvar Membro'; }
                return;
            }

            const { data: authData, error: authErr } = await supabaseClient.auth.signUp({
                email: email,
                password: senha,
                options: { data: { name: nome } }
            });

            if (authErr) throw authErr;

            if (authData && authData.user) {
                const profilePayload = {
                    id: authData.user.id,
                    name: nome,
                    email: email,
                    system_role: role,
                    role: role,
                    ministry_id: ministryId
                };
                if (currentChurchId) profilePayload.church_id = currentChurchId;

                await supabaseClient.from('profiles').upsert(profilePayload);
            }

            mostrarToast('Novo membro cadastrado com sucesso!', 'sucesso');
        }

        fecharModalMembroAdmin();
        await carregarDados();
        renderizarAdminListaMembros();

    } catch (err) {
        console.error("Erro ao salvar membro:", err);
        mostrarToast(`Erro ao salvar membro: ${err.message || 'Falha no banco.'}`, 'erro');
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = 'Salvar Membro'; }
    }
}

window.renderizarAdminListaMembros = renderizarAdminListaMembros;
window.abrirModalCriarMembroAdmin = abrirModalCriarMembroAdmin;
window.abrirModalEditarMembroAdmin = abrirModalEditarMembroAdmin;
window.fecharModalMembroAdmin = fecharModalMembroAdmin;
window.salvarMembroAdmin = salvarMembroAdmin;

async function renderizarAdminListaIgrejas() {
    const listBody = document.getElementById('admin-lista-igrejas-body');
    if (!listBody) return;
    
    listBody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-slate-400">Carregando igrejas...</td></tr>';
    
    try {
        if (!supabaseClient) throw new Error("Cliente Supabase não inicializado.");
        const { data: churches, error } = await supabaseClient
            .from('churches')
            .select('*')
            .order('created_at', { ascending: false });
            
        if (error) throw error;
        
        if (!churches || churches.length === 0) {
            listBody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-slate-400">Nenhuma igreja cadastrada.</td></tr>';
            return;
        }
        
        listBody.innerHTML = '';
        churches.forEach(church => {
            const tr = document.createElement('tr');
            tr.className = "border-b border-slate-700 hover:bg-slate-800/40";
            
            const isPending = church.status === 'pending';
            const statusBadge = isPending 
                ? '<span class="px-2 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-500 border border-amber-500/30">Pendente</span>'
                : '<span class="px-2 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/30">Ativo</span>';
                
            const actionButton = isPending
                ? `<button onclick="alterarStatusIgreja('${church.id}', 'active')" class="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1 rounded-lg text-xs font-medium transition">Aprovar Ativação</button>`
                : `<button onclick="alterarStatusIgreja('${church.id}', 'pending')" class="bg-slate-700 hover:bg-slate-600 text-slate-300 px-3 py-1 rounded-lg text-xs font-medium transition">Suspender</button>`;
                
            tr.innerHTML = `
                <td class="px-4 py-3 font-semibold text-white">${church.name}</td>
                <td class="px-4 py-3 font-mono text-xs">${church.slug}</td>
                <td class="px-4 py-3">${church.leader_whatsapp || '<span class="text-slate-500">Não informado</span>'}</td>
                <td class="px-4 py-3">R$ ${church.agreed_payment || '<span class="text-slate-500">Não informado</span>'}</td>
                <td class="px-4 py-3">${statusBadge}</td>
                <td class="px-4 py-3 text-right">${actionButton}</td>
            `;
            listBody.appendChild(tr);
        });
    } catch (err) {
        console.error(err);
        listBody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-red-400">Erro ao carregar lista de igrejas.</td></tr>';
    }
}

async function alterarStatusIgreja(churchId, status) {
    try {
        if (!supabaseClient) throw new Error("Cliente Supabase não inicializado.");
        const { error } = await supabaseClient
            .from('churches')
            .update({ status: status })
            .eq('id', churchId);
            
        if (error) throw error;
        
        mostrarToast(status === 'active' ? 'Igreja aprovada e ativada com sucesso!' : 'Igreja suspensa com sucesso!', 'sucesso');
        renderizarAdminListaIgrejas();
    } catch (err) {
        console.error(err);
        mostrarToast('Erro ao alterar status da igreja.', 'erro');
    }
}

window.alterarStatusIgreja = alterarStatusIgreja;
window.renderizarAdminListaIgrejas = renderizarAdminListaIgrejas;



