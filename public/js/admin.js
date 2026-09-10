// ===================== ADMIN: LOGIN =====================

window.addEventListener('DOMContentLoaded', async () => {
    // Checa se já existe sessão ativa no Supabase Auth
    if (supabaseClient) {
        try {
            const { data } = await supabaseClient.auth.getSession();
            if (data && data.session) {
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
    // Se o usuário já estiver logado e possuir privilégios, abre direto o painel
    const user = (typeof usuarioLogado !== 'undefined' && usuarioLogado) ? usuarioLogado : null;
    const role = user ? (user.system_role || user.role || 'membro') : null;
    if (role === 'admin' || role === 'lider' || (typeof isAdmin !== 'undefined' && isAdmin)) {
        abrirPainelAdmin();
        return;
    }
    if (user && role !== 'admin' && role !== 'lider') {
        if (typeof mostrarToast === 'function') {
            mostrarToast('Seu perfil logado não possui permissão de Administrador ou Líder.', 'aviso');
        }
        return;
    }

    // Se não estiver logado, abre o modal de credenciais administrativas
    const modalAdmin = document.getElementById('modal-admin');
    if (modalAdmin) {
        modalAdmin.classList.remove('hidden');
        const emailInput = document.getElementById('input-email-admin');
        const senhaInput = document.getElementById('input-senha-admin');
        if (emailInput && !emailInput.value) emailInput.value = '';
        if (senhaInput) senhaInput.value = '';
        const erroSenha = document.getElementById('erro-senha');
        if (erroSenha) erroSenha.classList.add('hidden');
        setTimeout(() => {
            if (emailInput && !emailInput.value) emailInput.focus();
            else if (senhaInput) senhaInput.focus();
        }, 100);
    } else if (typeof abrirModalLoginUsuario === 'function') {
        abrirModalLoginUsuario();
    }
}

function fecharModalAdmin() {
    const modalAdmin = document.getElementById('modal-admin');
    if (modalAdmin) modalAdmin.classList.add('hidden');
}

async function entrarAdmin() {
    const inputEmail = document.getElementById('input-email-admin') || document.getElementById('login-email');
    const inputSenha = document.getElementById('input-senha-admin') || document.getElementById('login-senha');
    const erroSenha = document.getElementById('erro-senha') || document.getElementById('login-erro-msg');
    const btnEntrar = document.querySelector('#modal-admin button[onclick="entrarAdmin()"]') || document.querySelector('#modal-admin button:last-child');

    const email = inputEmail ? inputEmail.value.trim().toLowerCase() : (usuarioLogado?.email || '');
    const senha = inputSenha ? inputSenha.value.trim() : '';

    if (!email || !senha) {
        if (erroSenha) {
            erroSenha.textContent = 'Informe e-mail e senha.';
            erroSenha.classList.remove('hidden');
        }
        return;
    }

    const textoOriginalBtn = btnEntrar ? btnEntrar.textContent : 'Entrar';
    if (btnEntrar) {
        btnEntrar.textContent = 'Validando...';
        btnEntrar.disabled = true;
    }
    if (erroSenha) erroSenha.classList.add('hidden');

    try {
        if (!supabaseClient) {
            throw new Error("Cliente Supabase não inicializado.");
        }

        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email: email,
            password: senha
        });

        if (error || !data || (!data.session && !data.user)) {
            throw error || new Error("Credenciais incorretas.");
        }

        if (typeof verificarSessaoAtiva === 'function') {
            await verificarSessaoAtiva();
        }

        fecharModalAdmin();
        abrirPainelAdmin();
        if (typeof mostrarToast === 'function') {
            mostrarToast('Acesso administrativo concedido!', 'sucesso');
        }
    } catch (error) {
        console.error('Erro na autenticação administrativa:', error);
        if (erroSenha) {
            erroSenha.textContent = 'E-mail ou senha incorretos.';
            erroSenha.classList.remove('hidden');
        }
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
    
    const tabsToHideIfNotAdmin = ['btn-admin-aba-cultos-eventos', 'tab-admin-ministerios', 'btn-admin-aba-repertorio', 'btn-admin-aba-novas', 'btn-admin-aba-solicitacoes'];
    
    tabsToHideIfNotAdmin.forEach(tabId => {
        const tab = document.getElementById(tabId);
        if (tab) {
            tab.style.display = isFullAdmin ? 'inline-block' : 'none';
        }
    });

    if (isFullAdmin) {
        mudarAbaAdmin('cultos-eventos');
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

    const userToEvaluate = (typeof modoSimulacaoPerfil !== 'undefined' ? modoSimulacaoPerfil : null) || usuarioLogado;
    const roleUsuario = userToEvaluate ? (userToEvaluate.system_role || userToEvaluate.role || 'membro') : 'visitante';
    const isLiderOuAdmin = roleUsuario === 'admin' || roleUsuario === 'lider';

    const services = dadosGlobais.services || [];
    const rows = dadosGlobais.cultos || [];

    // Se temos dados relacionais de services
    if (services.length > 0) {
        let html = '';
        services.forEach((s, bIdx) => {
            let emMontagem = s.is_draft || s.status === 'aberto' || (s.title && s.title.toUpperCase().includes('EM MONTAGEM'));
            let oculto = s.is_hidden || s.status === 'arquivado' || (s.title && s.title.toUpperCase().includes('OCULTO'));
            if (s.notes) {
                try {
                    const pn = JSON.parse(s.notes);
                    if (pn && typeof pn === 'object') {
                        if (pn.em_montagem !== undefined) emMontagem = !!pn.em_montagem;
                        else if (pn.is_draft !== undefined) emMontagem = !!pn.is_draft;
                        if (pn.oculto !== undefined) oculto = !!pn.oculto;
                        else if (pn.is_hidden !== undefined) oculto = !!pn.is_hidden;
                    }
                } catch(e){}
            }

            const cor = oculto ? 'border-slate-700 bg-slate-800/30 opacity-60'
                : (emMontagem ? 'border-red-700/50 bg-red-900/20' : 'border-slate-700 bg-slate-800/60');
            const corTexto = oculto ? 'text-slate-400' : (emMontagem ? 'text-red-300' : 'text-brand-300');
            
            const tituloExibicao = (s.title || 'Culto').replace(/ - OCULTO/i, '').replace(/ - EM MONTAGEM/i, '').trim();

            let dataBadge = '';
            if (s.date) {
                const parts = s.date.split('T')[0].split('-');
                if (parts.length === 3) {
                    dataBadge = `<span class="text-[11px] bg-slate-900/80 text-slate-400 px-2 py-0.5 rounded-md border border-slate-700 font-mono">${parts[2]}/${parts[1]}</span>`;
                }
            }

            const legacyIndex = rows.findIndex(r => r && r[8] === s.id);
            const editAction = legacyIndex !== -1 ? `editarCulto(${legacyIndex})` : `mostrarFormCulto(null)`;

            const botaoExcluir = isLiderOuAdmin
                ? `<button onclick="excluirCulto('${s.id}')" class="bg-slate-700 hover:bg-red-700 text-slate-200 hover:text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1 shadow-sm">🗑️ Excluir</button>`
                : '';

            html += `
                <div class="flex items-center justify-between px-4 py-3 rounded-xl border ${cor} gap-3">
                    <div class="flex items-center gap-3 min-w-0 flex-1">
                        ${dataBadge}
                        <span class="text-sm font-semibold ${corTexto} uppercase truncate">${tituloExibicao}${oculto ? ' 🙈' : ''}${emMontagem ? ' 🛠️' : ''}</span>
                    </div>
                    <div class="flex gap-2 shrink-0">
                        <button onclick="${editAction}" class="bg-slate-700 hover:bg-brand-700 text-slate-200 hover:text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition">✏️ Editar</button>
                        ${botaoExcluir}
                    </div>
                </div>
            `;
        });
        container.innerHTML = html;
        return;
    }

    // Fallback legado caso services ainda não tenha populado
    let blocos = [];
    let blocoAtual = null;
    let blocoIndex = null;

    for (let i = 0; i < rows.length; i++) {
        const texto = rows[i][0] ? rows[i][0].toString() : '';
        if (texto.includes("CULTO DE") || (rows[i][8] && rows[i][8].length > 10)) {
            if (blocoAtual !== null) blocos.push({ titulo: blocoAtual, startIndex: blocoIndex });
            blocoAtual = texto;
            blocoIndex = i;
        }
    }
    if (blocoAtual !== null) blocos.push({ titulo: blocoAtual, startIndex: blocoIndex });

    if (blocos.length === 0) {
        container.innerHTML = '<p class="text-slate-500 text-sm py-4 text-center">Nenhum culto encontrado no banco de dados.</p>';
        return;
    }

    let html = '';
    blocos.forEach((bloco, bIdx) => {
        const emMontagem = bloco.titulo.toUpperCase().includes('EM MONTAGEM');
        const oculto = bloco.titulo.toUpperCase().includes('OCULTO');

        const cor = oculto ? 'border-slate-700 bg-slate-800/30 opacity-60'
            : (emMontagem ? 'border-red-700/50 bg-red-900/20' : 'border-slate-700 bg-slate-800/60');
        const corTexto = oculto ? 'text-slate-400' : (emMontagem ? 'text-red-300' : 'text-brand-300');
        const tituloExibicao = bloco.titulo.replace(/ - OCULTO/i, '').replace(/ - EM MONTAGEM/i, '').trim();

        const botaoExcluir = isLiderOuAdmin
            ? `<button onclick="excluirCulto(${bloco.startIndex})" class="bg-slate-700 hover:bg-red-700 text-slate-200 hover:text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition">🗑️ Excluir</button>`
            : '';

        html += `
            <div class="flex items-center justify-between px-4 py-3 rounded-xl border ${cor} gap-3">
                <div class="flex items-center gap-3">
                    <span class="text-sm font-semibold ${corTexto} uppercase">${tituloExibicao}${oculto ? ' 🙈' : ''}</span>
                </div>
                <div class="flex gap-2 shrink-0">
                    <button onclick="editarCulto(${bloco.startIndex})" class="bg-slate-700 hover:bg-brand-700 text-slate-200 hover:text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition">✏️ Editar</button>
                    ${botaoExcluir}
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

async function excluirCultoAdmin(startIndex) {
    if (typeof window.excluirCulto === 'function') {
        await window.excluirCulto(startIndex);
    }
}

// ===================== ADMIN: GERENCIAMENTO DE EQUIPE =====================

function mudarAbaAdmin(aba) {
    const abas = {
        'cultos-eventos': document.getElementById('admin-aba-cultos-eventos'),
        historico: document.getElementById('admin-aba-historico'),
        ministerios: document.getElementById('admin-aba-ministerios'),
        repertorio: document.getElementById('admin-aba-repertorio'),
        novas: document.getElementById('admin-aba-novas'),
        solicitacoes: document.getElementById('admin-aba-solicitacoes'),
        igrejas: document.getElementById('admin-aba-igrejas'),
        configuracoes: document.getElementById('admin-aba-configuracoes'),
        'mensagens-membros': document.getElementById('admin-aba-mensagens-membros')
    };

    const botoes = {
        'cultos-eventos': document.getElementById('btn-admin-aba-cultos-eventos'),
        historico: document.getElementById('btn-admin-aba-historico'),
        ministerios: document.getElementById('tab-admin-ministerios'),
        repertorio: document.getElementById('btn-admin-aba-repertorio'),
        novas: document.getElementById('btn-admin-aba-novas'),
        solicitacoes: document.getElementById('btn-admin-aba-solicitacoes'),
        igrejas: document.getElementById('btn-admin-aba-igrejas'),
        configuracoes: document.getElementById('btn-admin-aba-configuracoes'),
        'mensagens-membros': document.getElementById('btn-admin-aba-whatsapp')
    };

    const ativo = "w-full text-left px-4 py-2.5 rounded-xl font-medium text-sm transition bg-brand-600/20 text-brand-400 border border-brand-500/30 flex items-center gap-3";
    const inativo = "w-full text-left px-4 py-2.5 rounded-xl font-medium text-sm transition text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 flex items-center gap-3";

    const userToEvaluate = (typeof modoSimulacaoPerfil !== 'undefined' ? modoSimulacaoPerfil : null) || (window.usuarioLogado || null);
    const role = userToEvaluate ? (userToEvaluate.system_role || 'membro') : 'visitante';

    Object.keys(abas).forEach(key => {
        if (abas[key]) abas[key].classList.toggle('hidden', key !== aba);
        if (botoes[key]) {
            let shouldHide = false;
            if (key === 'configuracoes' && role !== 'admin') shouldHide = true;
            if (key === 'ministerios' && role !== 'admin' && role !== 'lider') shouldHide = true;
            if (key === 'mensagens-membros' && role !== 'admin' && role !== 'lider') shouldHide = true;
            if (key === 'igrejas' && !window.isSuperAdmin) shouldHide = true;

            if (shouldHide) {
                botoes[key].className = 'hidden';
            } else {
                botoes[key].className = key === aba ? ativo : inativo;
            }
        }
    });

    if (aba === 'cultos-eventos') { if (typeof renderizarAdminCultosEventos === 'function') renderizarAdminCultosEventos(); }
    else if (aba === 'historico') { if (typeof renderizarHistoricoCultos === 'function') renderizarHistoricoCultos(); }
    else if (aba === 'equipe') renderizarAdminListaEquipe();
    else if (aba === 'ministerios') renderizarAdminMinisterios();
    else if (aba === 'repertorio') renderizarAdminListaRepertorio();
    else if (aba === 'novas') renderizarAdminListaNovas();
    else if (aba === 'midia') { if (typeof carregarMidiasAdmin === 'function') carregarMidiasAdmin(); }
    else if (aba === 'solicitacoes') renderizarAdminListaSolicitacoes();
    else if (aba === 'igrejas') renderizarAdminListaIgrejas();
    else if (aba === 'configuracoes') carregarConfiguracoesGlobaisAdmin();
    else if (aba === 'mensagens-membros') { if (typeof renderizarAdminMensagensMembros === 'function') renderizarAdminMensagensMembros(); }
}

function carregarConfiguracoesGlobaisAdmin() {
    const selectCor = document.getElementById('config-cor-global');
    if (selectCor && dadosGlobais.church && dadosGlobais.church.theme_color_secondary) {
        selectCor.value = dadosGlobais.church.theme_color_secondary;
    }
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
            const currentChurchId = (typeof dadosGlobais !== 'undefined' && dadosGlobais.church?.id) 
                ? dadosGlobais.church.id 
                : (usuarioLogado?.church_id || null);
            let query = supabaseClient.from('profiles').select('*').order('name', { ascending: true });
            if (currentChurchId) query = query.eq('church_id', currentChurchId);
            const { data, error } = await query;
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
            const currentChurchId = (typeof dadosGlobais !== 'undefined' && dadosGlobais.church?.id) 
                ? dadosGlobais.church.id 
                : (usuarioLogado?.church_id || null);

            let query = supabaseClient
                .from('songs')
                .select('id, title, artist, status, lyrics, song_versions(id, key, variation, drive_vs_url, youtube_url, lyrics)')
                .neq('status', 'nova')
                .order('title', { ascending: true });

            if (currentChurchId) {
                query = query.eq('church_id', currentChurchId);
            }

            const { data, error } = await query;

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
            const currentChurchId = (typeof dadosGlobais !== 'undefined' && dadosGlobais.church?.id) 
                ? dadosGlobais.church.id 
                : (usuarioLogado?.church_id || null);

            let query = supabaseClient
                .from('songs')
                .select('id, title, status, lyrics, song_versions(id, key, variation)')
                .eq('status', 'nova')
                .order('title', { ascending: true });

            if (currentChurchId) {
                query = query.eq('church_id', currentChurchId);
            }

            const { data, error } = await query;

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

let solicitacoesSubAbaAtual = 'pendentes'; // 'pendentes' ou 'concluidas'
let solicitacoesCategoriaAtual = 'todas'; // 'todas', 'ajuste_tom', 'musica_nova', 'culto_especifico', 'indisponibilidade'
let solicitacoesMesAtual = 'todos'; // 'todos' ou 'YYYY-MM'
let todasSolicitacoesCache = [];

const METADATA_CATEGORIAS_SOLICITACOES = {
    whatsapp: {
        chave: 'whatsapp',
        label: 'WhatsApp',
        icone: '📱',
        badgeClasse: 'bg-emerald-900/60 text-emerald-300 border-emerald-700/50'
    },
    ajuste_tom: {
        chave: 'ajuste_tom',
        label: 'Ajuste de Tom',
        icone: '🎸',
        badgeClasse: 'bg-indigo-900/60 text-indigo-300 border-indigo-700/50'
    },
    musica_nova: {
        chave: 'musica_nova',
        label: 'Sugestão de Música Nova',
        icone: '🌟',
        badgeClasse: 'bg-amber-900/60 text-amber-300 border-amber-700/50'
    },
    culto_especifico: {
        chave: 'culto_especifico',
        label: 'Sugestão para Culto',
        icone: '📅',
        badgeClasse: 'bg-cyan-900/60 text-cyan-300 border-cyan-700/50'
    },
    indisponibilidade: {
        chave: 'indisponibilidade',
        label: 'Indisponibilidade',
        icone: '🚫',
        badgeClasse: 'bg-rose-900/60 text-rose-300 border-rose-700/50'
    }
};

function normalizarCategoriaSolicitacao(item) {
    if (!item) return 'ajuste_tom';
    const cat = (item.category || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    const txt = (item.comment_text || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

    // 0. WhatsApp (mensagens, recados ou justificativas pelo bot do WhatsApp)
    if (cat.includes('whatsapp') || cat.includes('zap') || txt.includes('[whatsapp]')) {
        return 'whatsapp';
    }

    // 1. Indisponibilidade (aceita 'indisponibilidade', 'escala/compromissos', 'mes seguinte', etc.)
    if (cat.includes('indisponib') || cat.includes('escala') || cat.includes('compromisso') || cat.includes('mes seguinte') || txt.includes('indisponib') || txt.includes('nao estarei disponivel')) {
        return 'indisponibilidade';
    }

    // 2. Sugestão para culto específico
    if (cat.includes('culto') || cat.includes('especifico')) {
        return 'culto_especifico';
    }

    // 3. Sugestão de música nova
    if ((cat.includes('nova') || cat.includes('musica nova') || cat.includes('repertorio geral')) && !cat.includes('tom')) {
        return 'musica_nova';
    }

    // 4. Ajuste de tom
    if (cat.includes('tom') || txt.includes('tom ') || txt.includes('ajuste de tom') || txt.includes('tom:')) {
        return 'ajuste_tom';
    }

    // Fallbacks inteligentes por contexto de texto
    if (txt.includes('dia ') || txt.includes('dias ') || txt.includes('ferias') || txt.includes('viagem')) {
        return 'indisponibilidade';
    }

    return 'ajuste_tom';
}

function selecionarCategoriaSolicitacoes(cat) {
    solicitacoesCategoriaAtual = cat;

    const categorias = ['todas', 'whatsapp', 'ajuste_tom', 'musica_nova', 'culto_especifico', 'indisponibilidade'];
    categorias.forEach(c => {
        const btn = document.getElementById(`btn-solic-cat-${c}`);
        if (!btn) return;
        if (c === cat) {
            btn.className = "px-3 py-2 rounded-xl font-semibold transition bg-brand-600 text-white shrink-0 flex items-center gap-1.5 shadow";
        } else {
            btn.className = "px-3 py-2 rounded-xl font-medium transition bg-slate-700/80 text-slate-300 hover:text-white shrink-0 flex items-center gap-1.5";
        }
    });

    renderizarAdminListaSolicitacoes(false);
}

function filtrarSubAbaSolicitacoes(subAba) {
    if (subAba === 'pendente' || subAba === 'pendentes') {
        solicitacoesSubAbaAtual = 'pendentes';
    } else {
        solicitacoesSubAbaAtual = 'concluidas';
    }

    const btnPendentes = document.getElementById('btn-solic-sub-pendentes');
    const btnConcluidas = document.getElementById('btn-solic-sub-concluidas');

    const ativo = "flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-semibold transition bg-brand-600 text-white flex items-center justify-center gap-1.5 shadow";
    const inativo = "flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-semibold transition bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center gap-1.5";

    if (btnPendentes) btnPendentes.className = solicitacoesSubAbaAtual === 'pendentes' ? ativo : inativo;
    if (btnConcluidas) btnConcluidas.className = solicitacoesSubAbaAtual === 'concluidas' ? ativo : inativo;

    renderizarAdminListaSolicitacoes(false);
}

function selecionarMesSolicitacoes(mesAno) {
    solicitacoesMesAtual = mesAno || 'todos';
    renderizarAdminListaSolicitacoes(false);
}

function atualizarDropdownMesesSolicitacoes(itens) {
    const select = document.getElementById('admin-filtro-mes-solicitacoes');
    if (!select) return;

    const mesesSet = new Set();
    (itens || []).forEach(item => {
        if (item.created_at && typeof item.created_at === 'string') {
            const mesAno = item.created_at.substring(0, 7);
            if (mesAno && mesAno.length === 7) mesesSet.add(mesAno);
        }
    });

    const mesesOrdenados = Array.from(mesesSet).sort().reverse();
    const valorAtual = select.value || solicitacoesMesAtual || 'todos';

    let html = '<option value="todos">📅 Todos os meses</option>';
    mesesOrdenados.forEach(mesAno => {
        const partes = mesAno.split('-');
        if (partes.length === 2) {
            const ano = parseInt(partes[0]);
            const mes = parseInt(partes[1]) - 1;
            const dataRef = new Date(ano, mes, 1);
            const nomeMes = dataRef.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
            const nomeMesCap = nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1);
            html += `<option value="${mesAno}">${nomeMesCap}</option>`;
        }
    });

    select.innerHTML = html;

    if (mesesSet.has(valorAtual)) {
        select.value = valorAtual;
        solicitacoesMesAtual = valorAtual;
    } else {
        select.value = 'todos';
        solicitacoesMesAtual = 'todos';
    }
}

function salvarStatusSolicitacaoLocal(id, status) {
    try {
        const mapa = JSON.parse(localStorage.getItem('admin_solicitacoes_status') || '{}');
        mapa[id] = status;
        localStorage.setItem('admin_solicitacoes_status', JSON.stringify(mapa));
    } catch (e) {
        console.warn('Erro ao salvar status no localStorage:', e);
    }
}

function obterStatusSolicitacaoLocal(id) {
    try {
        const mapa = JSON.parse(localStorage.getItem('admin_solicitacoes_status') || '{}');
        return mapa[id] || null;
    } catch (e) {
        return null;
    }
}

function removerStatusSolicitacaoLocal(id) {
    try {
        const mapa = JSON.parse(localStorage.getItem('admin_solicitacoes_status') || '{}');
        delete mapa[id];
        localStorage.setItem('admin_solicitacoes_status', JSON.stringify(mapa));
    } catch (e) {}
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
                const currentChurchId = (typeof dadosGlobais !== 'undefined' && dadosGlobais.church?.id) 
                    ? dadosGlobais.church.id 
                    : (usuarioLogado?.church_id || null);

                let query = supabaseClient
                    .from('availability_comments')
                    .select('*, profiles:user_id(id, name, phone, ministry_id)')
                    .neq('status', 'aguardando_texto')
                    .order('created_at', { ascending: false });

                if (currentChurchId) {
                    query = query.eq('church_id', currentChurchId);
                }

                const { data, error } = await query;

                if (!error && data) {
                    // Filtra rascunhos em andamento do WhatsApp
                    const limpo = data.filter(item => item.status !== 'aguardando_texto' && item.category !== 'whatsapp_draft');

                    // Mescla o status do banco de dados com a persistência local espelho
                    limpo.forEach(item => {
                        const localStatus = obterStatusSolicitacaoLocal(item.id);
                        if (localStatus) {
                            item.status = localStatus;
                        } else if (!item.status) {
                            item.status = 'pendente';
                        } else if (item.status && !localStatus) {
                            salvarStatusSolicitacaoLocal(item.id, item.status);
                        }
                    });
                    todasSolicitacoesCache = limpo;
                }

                // Busca perfis e cargos ministeriais para escopo de líder
                let profQuery = supabaseClient.from('profiles').select('*');
                if (currentChurchId) profQuery = profQuery.eq('church_id', currentChurchId);
                const { data: profData } = await profQuery;
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

                // Atualiza as opções do dropdown de meses
                atualizarDropdownMesesSolicitacoes(todasSolicitacoesCache);
            }
        } catch (err) {
            console.error('Erro ao buscar solicitações do Supabase:', err);
        }
    }

    const userToEvaluate = (typeof modoSimulacaoPerfil !== 'undefined' ? modoSimulacaoPerfil : null) || usuarioLogado;
    const roleUsuario = userToEvaluate ? (userToEvaluate.system_role || userToEvaluate.role || 'membro') : 'visitante';
    const ministryIdUsuario = userToEvaluate ? userToEvaluate.ministry_id : null;

    let solicitacoesPermitidas = todasSolicitacoesCache || [];

    // Filtro de privacidade para Líder de Ministério
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

        solicitacoesPermitidas = solicitacoesPermitidas.filter(item => {
            if (item.profiles) {
                return item.profiles.ministry_id === ministryIdUsuario || equipeIds.includes(item.profiles.id);
            }
            const matchParenteses = item.comment_text ? item.comment_text.match(/\(([^)]+)\)/) : null;
            if (matchParenteses && matchParenteses[1]) {
                const autorNome = matchParenteses[1].toLowerCase().trim();
                return equipeNomes.some(n => n.includes(autorNome) || autorNome.includes(n));
            }
            return false;
        });
    }

    // Classifica cada solicitação com a categoria normalizada
    solicitacoesPermitidas.forEach(item => {
        item._catNormalizada = normalizarCategoriaSolicitacao(item);
    });

    // 1. Atualizar badges de contagem de pendências por categoria no topo
    const pendentesGerais = solicitacoesPermitidas.filter(item => !item.status || item.status === 'pendente');
    const badgeCatTodas = document.getElementById('badge-solic-cat-todas');
    const badgeCatWhatsApp = document.getElementById('badge-solic-cat-whatsapp');
    const badgeCatTom = document.getElementById('badge-solic-cat-ajuste_tom');
    const badgeCatNova = document.getElementById('badge-solic-cat-musica_nova');
    const badgeCatCulto = document.getElementById('badge-solic-cat-culto_especifico');
    const badgeCatIndisp = document.getElementById('badge-solic-cat-indisponibilidade');

    if (badgeCatTodas) badgeCatTodas.textContent = pendentesGerais.length;
    if (badgeCatWhatsApp) badgeCatWhatsApp.textContent = pendentesGerais.filter(i => i._catNormalizada === 'whatsapp').length;
    if (badgeCatTom) badgeCatTom.textContent = pendentesGerais.filter(i => i._catNormalizada === 'ajuste_tom').length;
    if (badgeCatNova) badgeCatNova.textContent = pendentesGerais.filter(i => i._catNormalizada === 'musica_nova').length;
    if (badgeCatCulto) badgeCatCulto.textContent = pendentesGerais.filter(i => i._catNormalizada === 'culto_especifico').length;
    if (badgeCatIndisp) badgeCatIndisp.textContent = pendentesGerais.filter(i => i._catNormalizada === 'indisponibilidade').length;

    // 2. Filtrar pela Categoria Selecionada
    let listaFiltrada = solicitacoesPermitidas;
    if (solicitacoesCategoriaAtual !== 'todas') {
        listaFiltrada = listaFiltrada.filter(item => item._catNormalizada === solicitacoesCategoriaAtual);
    }

    // 3. Filtrar pelo Mês Selecionado
    if (solicitacoesMesAtual !== 'todos') {
        listaFiltrada = listaFiltrada.filter(item => {
            return item.created_at && typeof item.created_at === 'string' && item.created_at.startsWith(solicitacoesMesAtual);
        });
    }

    // 4. Separar por status (Pendentes vs Concluídas) e atualizar os badges da sub-aba
    const pendentesSubAba = listaFiltrada.filter(item => !item.status || item.status === 'pendente');
    const concluidasSubAba = listaFiltrada.filter(item => item.status && item.status !== 'pendente');

    const badgeSubPendentes = document.getElementById('badge-solic-pendentes');
    const badgeSubConcluidas = document.getElementById('badge-solic-concluidas');
    if (badgeSubPendentes) badgeSubPendentes.textContent = pendentesSubAba.length;
    if (badgeSubConcluidas) badgeSubConcluidas.textContent = concluidasSubAba.length;

    let listaExibida = solicitacoesSubAbaAtual === 'pendentes' ? pendentesSubAba : concluidasSubAba;

    // 5. Aplicar Busca Textual
    const busca = (document.getElementById('admin-search-solicitacoes')?.value || '').toLowerCase().trim();
    if (busca) {
        listaExibida = listaExibida.filter(item => {
            const cat = (item.category || '').toLowerCase();
            const txt = (item.comment_text || '').toLowerCase();
            const autor = (item.profiles?.name || '').toLowerCase();
            return cat.includes(busca) || txt.includes(busca) || autor.includes(busca);
        });
    }

    // Se estiver vazia, exibir mensagem contextualizada
    if (listaExibida.length === 0) {
        const catLabel = solicitacoesCategoriaAtual === 'todas' 
            ? '' 
            : ` em "${METADATA_CATEGORIAS_SOLICITACOES[solicitacoesCategoriaAtual]?.label || solicitacoesCategoriaAtual}"`;
        const statusLabel = solicitacoesSubAbaAtual === 'pendentes' ? 'pendente' : 'concluída';
        const mesLabel = solicitacoesMesAtual === 'todos' ? '' : ' neste mês';

        container.innerHTML = `
            <div class="py-12 text-center bg-slate-800/30 rounded-2xl border border-slate-700/50">
                <p class="text-2xl mb-2">📭</p>
                <p class="text-slate-400 text-sm font-medium">Nenhuma solicitação ${statusLabel}${catLabel}${mesLabel}.</p>
                <p class="text-slate-500 text-xs mt-1">Altere a categoria, mês ou status para visualizar outros registros.</p>
            </div>
        `;
        return;
    }

    // 6. Renderizar Cards
    container.innerHTML = listaExibida.map(item => {
        const idEscapado = (item.id || '').toString().replace(/'/g, "\\'");
        const catChave = item._catNormalizada || 'ajuste_tom';
        const metaCat = METADATA_CATEGORIAS_SOLICITACOES[catChave] || { label: item.category || 'Solicitação', icone: '💬', badgeClasse: 'bg-slate-700 text-slate-300' };
        
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

        const isTom = catChave === 'ajuste_tom';
        const textoEscapado = texto.replace(/'/g, "\\'").replace(/"/g, "&quot;");

        // Nome do autor do perfil ou extraído do texto
        const autorNome = item.profiles?.name || '';
        const autorTelRaw = (item.profiles?.phone || '').replace(/\D/g, '');
        const zapLink = autorTelRaw ? `https://wa.me/${autorTelRaw.startsWith('55') ? autorTelRaw : '55' + autorTelRaw}` : null;

        return `
            <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 rounded-xl border border-slate-700/80 bg-slate-800/80 hover:bg-slate-800 transition gap-3 shadow-sm">
                <div class="space-y-1.5 w-full">
                    <div class="flex items-center gap-2 flex-wrap">
                        <span class="${metaCat.badgeClasse} border text-xs px-2.5 py-0.5 rounded-full font-medium flex items-center gap-1">
                            <span>${metaCat.icone}</span>
                            <span>${metaCat.label}</span>
                        </span>
                        ${badgeStatusHtml}
                        ${dataStr ? `<span class="text-xs text-slate-500 font-mono">🕒 ${dataStr}</span>` : ''}
                        ${autorNome ? `<span class="text-xs bg-slate-900/80 border border-slate-700 text-slate-300 px-2 py-0.5 rounded-md font-medium">👤 ${autorNome}</span>` : ''}
                    </div>
                    <p class="text-sm text-white font-medium mt-1 leading-relaxed break-words">${texto}</p>
                </div>
                <div class="flex items-center gap-2 shrink-0 flex-wrap mt-2 sm:mt-0">
                    ${zapLink ? `
                        <a href="${zapLink}" target="_blank" rel="noopener noreferrer" class="bg-emerald-700/80 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-xs transition font-medium flex items-center gap-1 shadow" title="Abrir conversa no WhatsApp">
                            💬 WhatsApp
                        </a>
                    ` : ''}
                    ${status === 'pendente' ? `
                        ${isTom ? `
                            <button onclick="abrirModalAprovarTomAdmin('${idEscapado}', '${textoEscapado}')" class="bg-brand-600 hover:bg-brand-500 text-white px-3 py-1.5 rounded-lg text-xs transition font-medium flex items-center gap-1 shadow">
                                🎶 Aprovar & Alterar Tom
                            </button>
                        ` : `
                            <button onclick="alterarStatusSolicitacaoAdmin('${idEscapado}', 'aprovado')" class="bg-brand-600 hover:bg-brand-500 text-white px-3 py-1.5 rounded-lg text-xs transition font-medium flex items-center gap-1 shadow">
                                ✅ Aprovar
                            </button>
                        `}
                        <button onclick="alterarStatusSolicitacaoAdmin('${idEscapado}', 'rejeitado')" class="bg-red-800/80 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg text-xs transition font-medium flex items-center gap-1">
                            ❌ Rejeitar
                        </button>
                    ` : `
                        <button onclick="alterarStatusSolicitacaoAdmin('${idEscapado}', 'pendente')" class="bg-slate-700 hover:bg-slate-600 text-amber-300 hover:text-white px-3 py-1.5 rounded-lg text-xs transition font-medium flex items-center gap-1" title="Reabrir como pendente">
                            ↩️ Reabrir
                        </button>
                    `}
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
        if (!id) throw new Error("ID inválido.");

        // 1. Salva imediatamente na persistência local espelho
        salvarStatusSolicitacaoLocal(id, novoStatus);

        // 2. Atualiza o item em memória no cache
        const item = todasSolicitacoesCache.find(s => s.id == id);
        if (item) item.status = novoStatus;

        // 3. Tenta persistir no Supabase
        if (supabaseClient) {
            try {
                const { error } = await supabaseClient
                    .from('availability_comments')
                    .update({ status: novoStatus })
                    .eq('id', id);

                if (error) {
                    console.warn('Aviso ao atualizar campo status no Supabase (mantido no cache local):', error);
                }
            } catch (sbErr) {
                console.warn('Exceção ao persistir no Supabase (mantido no cache local):', sbErr);
            }
        }

        let mensagemToast = 'Solicitação atualizada!';
        let tipoToast = 'sucesso';
        if (novoStatus === 'aprovado') {
            mensagemToast = 'Solicitação aprovada com sucesso!';
            tipoToast = 'sucesso';
        } else if (novoStatus === 'rejeitado') {
            mensagemToast = 'Solicitação marcada como rejeitada.';
            tipoToast = 'aviso';
        } else if (novoStatus === 'pendente') {
            mensagemToast = 'Solicitação reaberta como pendente!';
            tipoToast = 'aviso';
        }

        mostrarToast(mensagemToast, tipoToast);
        renderizarAdminListaSolicitacoes(false);
    } catch (err) {
        console.error('Erro ao alterar status da solicitação:', err);
        mostrarToast('Erro ao atualizar solicitação.', 'erro');
    }
}

async function excluirSolicitacaoAdmin(id) {
    if (!confirm('Deseja realmente excluir esta solicitação permanentemente?')) return;

    try {
        if (!id) throw new Error("ID inválido.");

        removerStatusSolicitacaoLocal(id);

        if (supabaseClient) {
            const { error } = await supabaseClient
                .from('availability_comments')
                .delete()
                .eq('id', id);

            if (error) throw error;
        }

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

// ===================== CORRESPONDÊNCIA INTELIGENTE DE MÚSICA & TOM =====================

function normalizarTextoComparacao(str) {
    return (str || '')
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // remove acentos e crases
        .replace(/[^a-z0-9]/g, " ")     // substitui pontuação por espaço
        .replace(/\s+/g, " ")           // reduz múltiplos espaços para um só
        .trim();
}

function extrairDadosSolicitacaoTom(textoSolic) {
    let nomeMusica = '';
    let autor = '';
    let mensagem = textoSolic || '';

    // Padrão canônico salvo pelo app: "Nome da Música - (Autor): Mensagem"
    const matchCanonic = (textoSolic || '').match(/^(.*?)\s*-\s*\((.*?)\):\s*(.*)$/s);
    if (matchCanonic) {
        nomeMusica = matchCanonic[1].trim();
        autor = matchCanonic[2].trim();
        mensagem = matchCanonic[3].trim();
    } else {
        const idxParenteses = textoSolic.indexOf(' - (');
        if (idxParenteses !== -1) {
            nomeMusica = textoSolic.substring(0, idxParenteses).trim();
            mensagem = textoSolic.substring(idxParenteses + 4).trim();
        } else {
            const partes = textoSolic.split('-');
            if (partes.length > 1) {
                nomeMusica = partes[0].trim();
                mensagem = partes.slice(1).join('-').trim();
            }
        }
    }

    return { nomeMusica, autor, mensagem };
}

function encontrarMusicaCorrespondente(nomeMusicaAlvo, todasMusicas, textoCompleto) {
    if (!todasMusicas || todasMusicas.length === 0) return null;

    const normAlvo = normalizarTextoComparacao(nomeMusicaAlvo);

    // 1. Casamento Exato Normalizado pelo nome extraído
    if (normAlvo) {
        const matchExato = todasMusicas.find(s => normalizarTextoComparacao(s.title) === normAlvo);
        if (matchExato) return matchExato;
    }

    // 2. Se for Medley com barras "/" (ex: "Te Agradeço / Grande É o Senhor / Abra Os Olhos...")
    if (nomeMusicaAlvo && nomeMusicaAlvo.includes('/')) {
        const faixasMedley = nomeMusicaAlvo.split('/').map(f => f.trim()).filter(Boolean);
        for (const faixa of faixasMedley) {
            const normFaixa = normalizarTextoComparacao(faixa);
            if (normFaixa) {
                const matchFaixa = todasMusicas.find(s => normalizarTextoComparacao(s.title) === normFaixa);
                if (matchFaixa) return matchFaixa;
            }
        }
    }

    // 3. Casamento por Início de Título ou Contenção com Palavras Inteiras
    if (normAlvo && normAlvo.length >= 3) {
        // Ordena pelo tamanho do título decrescente para dar prioridade a títulos específicos
        const musicasOrdenadas = [...todasMusicas].sort((a, b) => (b.title || '').length - (a.title || '').length);
        
        const matchPrefixo = musicasOrdenadas.find(s => {
            const normTitulo = normalizarTextoComparacao(s.title);
            return normTitulo.startsWith(normAlvo) || normAlvo.startsWith(normTitulo);
        });
        if (matchPrefixo) return matchPrefixo;

        const regexPalavra = new RegExp(`(?:^|\\s)${normAlvo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\s|$)`, 'i');
        const matchContem = musicasOrdenadas.find(s => regexPalavra.test(normalizarTextoComparacao(s.title)));
        if (matchContem) return matchContem;
    }

    // 4. Fallback seguro: se não encontrou pelo nome extraído, busca títulos contidos no texto completo,
    // mas apenas títulos com mais de 3 caracteres como palavra delimitada (evita "Rio" dentro de "necessário")
    if (textoCompleto) {
        const musicasOrdenadas = [...todasMusicas]
            .filter(s => (s.title || '').trim().length >= 4)
            .sort((a, b) => b.title.length - a.title.length);

        const normTexto = normalizarTextoComparacao(textoCompleto);
        const matchTexto = musicasOrdenadas.find(s => {
            const normTitulo = normalizarTextoComparacao(s.title);
            if (normTitulo.length < 4) return false;
            const regex = new RegExp(`(?:^|\\s)${normTitulo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\s|$)`, 'i');
            return regex.test(normTexto);
        });
        if (matchTexto) return matchTexto;
    }

    return null;
}

function extrairTomSugeridoSeguro(texto) {
    if (!texto) return '';

    // Se for indicação de transposição relativa (ex: "1 tom a baixo", "tom abaixo", "baixar tom"), não extrai nota
    const ehRelativo = /\b(?:\d+\s*)?tom\s*(?:a\s*baixo|abaixo|a\s*cima|acima|menos|mais)\b/i.test(texto) ||
                       /\b(?:baixar|descer|subir|aumentar)\s+(?:o\s+)?tom\b/i.test(texto);
    if (ehRelativo) {
        return '';
    }

    // Padrões de notas reais como "tom C", "tom: G", "mudar para Dm", "em F#", "novo tom Bb"
    const regexTom = /\b(?:tom(?:\s*[:=-]|\s+para|\s+de)?|mudar\s+para|ir\s+para|fazer\s+em|tocar\s+em|em)\s+([A-G][b#]?(?:m|maj|min)?)(?!\w)/i;
    const match = texto.match(regexTom);
    if (match && match[1]) {
        const nota = match[1].trim();
        if (nota.toUpperCase() === 'A') {
            const indexApos = match.index + match[0].length;
            const resto = texto.slice(indexApos).trim().toLowerCase();
            if (resto.startsWith('baixo') || resto.startsWith('cima') || resto.startsWith('mais') || resto.startsWith('menos')) {
                return '';
            }
        }
        return nota.toUpperCase();
    }

    return '';
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

    // 1. Extrai nome da música e mensagem
    const { nomeMusica, mensagem } = extrairDadosSolicitacaoTom(textoSolic);

    // 2. Encontra a música correta com o algoritmo inteligente
    const songEncontrada = encontrarMusicaCorrespondente(nomeMusica, todasMusicas, textoSolic);
    if (songEncontrada) {
        selectMusica.value = songEncontrada.id;
        atualizarVersoesSelectAprovarTom();
    } else {
        selectMusica.value = '';
        atualizarVersoesSelectAprovarTom();
    }

    // 3. Extrai o tom sugerido com proteção contra falsos positivos
    const tomDetectado = extrairTomSugeridoSeguro(mensagem);
    document.getElementById('aprovar-tom-input-novo-tom').value = tomDetectado;

    // 4. Configura sugestão de variação
    const ehAcima = /\b(?:a\s*cima|acima|subir|aumentar)\b/i.test(mensagem);
    document.getElementById('aprovar-tom-input-variacao-nova').value = ehAcima ? 'Tom Acima' : 'Tom Abaixo';
    document.getElementById('aprovar-tom-input-vs-nova').value = '';
    document.getElementById('aprovar-tom-input-yt-nova').value = '';
    const fileInput = document.getElementById('aprovar-tom-input-vs-file');
    if (fileInput) fileInput.value = '';

    alternarModoAprovacaoTom('existente');
    modal.classList.remove('hidden');
}

function fecharModalAprovarTomAdmin() {
    const modal = document.getElementById('modal-aprovar-tom-admin');
    if (modal) modal.classList.add('hidden');
    const fileInput = document.getElementById('aprovar-tom-input-vs-file');
    if (fileInput) fileInput.value = '';
}

function atualizarVersoesSelectAprovarTom() {
    const songId = document.getElementById('aprovar-tom-select-musica').value;
    const selectVersao = document.getElementById('aprovar-tom-select-versao');
    selectVersao.innerHTML = '<option value="">Selecione a versão...</option>';

    if (!songId) return;

    const repertorio = (typeof Store !== 'undefined' ? Store.getRepertorio() : dadosGlobais.repertorio) || [];
    const novas = (typeof Store !== 'undefined' ? Store.getNovas() : dadosGlobais.novas) || [];
    const song = [...repertorio, ...novas].find(s => s.id == songId);

    // Suporta tanto song.song_versions quanto song.versions
    const versoes = (song && (song.song_versions || song.versions)) || [];

    if (versoes.length > 0) {
        versoes.forEach(v => {
            const option = document.createElement('option');
            option.value = v.id;
            const tomAtual = v.key || v.key_note || 'Padrão';
            const variacao = v.variation || v.variation_name || 'Original';
            option.textContent = `Versão: ${variacao} (Tom: ${tomAtual})`;
            selectVersao.appendChild(option);
        });
        selectVersao.value = versoes[0].id;
    } else {
        const option = document.createElement('option');
        option.value = "";
        option.textContent = "Nenhuma versão encontrada (use Criar Nova Versão)";
        selectVersao.appendChild(option);
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
 * Envia um arquivo físico prioritariamente para o Cloudflare R2 via Worker.
 * Caso o Worker falhe, realiza fallback automático para o Supabase Storage (bucket 'media-inbox').
 */
async function uploadArquivoSupabase(file, bucketName = 'media-inbox', subFolder = 'vs_tracks') {
    if (!file) return null;

    const churchId = (typeof dadosGlobais !== 'undefined' && dadosGlobais.church?.id)
        || (typeof usuarioLogado !== 'undefined' && usuarioLogado?.church_id)
        || 'geral';

    const ext = file.name.split('.').pop() || 'bin';
    const nomeLimpo = file.name.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "_");
    const fileName = `${Date.now()}_${nomeLimpo}.${ext}`;

    // 1. TENTATIVA 1: Cloudflare R2 através do Cloudflare Worker
    try {
        const filePathR2 = `${churchId}/${subFolder}/${fileName}`;
        const workerUrl = `https://liturge-upload-worker.erickrosquero.workers.dev/${filePathR2}`;
        const response = await fetch(workerUrl, {
            method: 'PUT',
            body: file,
            headers: { 'Content-Type': file.type || 'application/octet-stream' }
        });

        if (response.ok) {
            const resData = await response.json();
            if (resData && resData.file_url) {
                console.log("Upload realizado com sucesso no Cloudflare R2:", resData.file_url);
                return resData.file_url;
            }
        } else {
            console.warn("Cloudflare Worker retornou status não-ok:", response.status);
        }
    } catch (r2Err) {
        console.warn("Falha no envio para Cloudflare R2, acionando fallback para Supabase Storage:", r2Err);
    }

    // 2. FALLBACK DE CONTINGÊNCIA: Supabase Storage
    if (!supabaseClient) throw new Error("Cliente Supabase não está inicializado.");

    let targetBucket = bucketName || 'media-inbox';
    let filePath = `${subFolder}/${fileName}`;

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
        filePath = `${fileName}`;

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
    const artistaEl = document.getElementById('admin-musica-artista');
    if (artistaEl) artistaEl.value = '';
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
    const artista = document.getElementById('admin-musica-artista')?.value.trim() || '';
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
        if (artista) songPayload.artist = artista;
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
                .select('id, title, artist, status, song_versions(id, key, variation, drive_vs_url, youtube_url)')
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
    const artistaEl = document.getElementById('edit-admin-musica-artista');
    if (artistaEl) artistaEl.value = song.artist || '';
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
    const artista = document.getElementById('edit-admin-musica-artista')?.value.trim() || '';
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
            .update({ title: titulo, artist: artista, status: status })
            .eq('id', songId);

        if (songErr) throw songErr;

        const cached = adminSongsCache.find(s => s.id === songId);
        if (cached) {
            cached.title = titulo;
            cached.artist = artista;
            cached.status = status;
        }

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
        if (!currentChurchId) throw new Error("Igreja ativa não identificada.");

        // 1. Obter IDs das músicas da igreja para apagar suas versões
        const { data: churchSongs } = await supabaseClient.from('songs').select('id').eq('church_id', currentChurchId);
        const songIds = (churchSongs || []).map(s => s.id);
        if (songIds.length > 0) {
            await supabaseClient.from('song_versions').delete().in('song_id', songIds);
        }

        // 2. Apagar músicas da igreja
        const { error: errSongs } = await supabaseClient.from('songs').delete().eq('church_id', currentChurchId);
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

        const currentChurchId = (typeof dadosGlobais !== 'undefined' && dadosGlobais.church?.id) 
            ? dadosGlobais.church.id 
            : (usuarioLogado?.church_id || null);
        if (!currentChurchId) throw new Error("Igreja ativa não identificada.");

        // 1. Limpar coluna lyrics em 'songs' da igreja ativa
        await supabaseClient.from('songs').update({ lyrics: '' }).eq('church_id', currentChurchId);

        // 2. Limpar coluna lyrics em 'song_versions' da igreja ativa
        const { data: churchSongs } = await supabaseClient.from('songs').select('id').eq('church_id', currentChurchId);
        const songIds = (churchSongs || []).map(s => s.id);
        if (songIds.length > 0) {
            await supabaseClient.from('song_versions').update({ lyrics: '' }).in('song_id', songIds);
        }

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
                .select('id, title, artist, chords, song_versions(id, key, variation, chords)')
                .eq('id', songId)
                .single();
            if (!error && data) songData = data;
        }
    } catch (e) {
        console.warn("Erro ao carregar cifra do Supabase:", e);
    }

    if (!songData) {
        const rep = (adminSongsCache || []).find(s => s.id === songId);
        if (rep) songData = rep;
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
        songArtist: songData.artist || '',
        songChords: songData.chords || '',
        versions: versions,
        activeVersionId: null,
        previaTexto: ''
    };

    document.getElementById('edit-cifra-admin-song-id').value = songData.id;
    const titleEl = document.getElementById('edit-cifra-admin-titulo-musica');
    if (titleEl) {
        titleEl.textContent = songData.title ? `${songData.title}${songData.artist ? ' — ' + songData.artist : ''}` : '';
    }

    const buscaMusicaEl = document.getElementById('edit-cifra-busca-musica');
    if (buscaMusicaEl) buscaMusicaEl.value = songData.title || '';

    const buscaArtistaEl = document.getElementById('edit-cifra-busca-artista');
    if (buscaArtistaEl) buscaArtistaEl.value = songData.artist || '';

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

    if (!stateModalCifras.versions || stateModalCifras.versions.length === 0) {
        container.innerHTML = '<p class="text-xs text-slate-500">Nenhuma versão cadastrada.</p>';
        return;
    }

    container.innerHTML = stateModalCifras.versions.map(v => {
        const isActive = stateModalCifras.activeVersionId === v.id;
        const btnClass = isActive
            ? 'bg-brand-600 text-white font-bold'
            : 'bg-slate-700 hover:bg-slate-600 text-slate-300';
        return `
            <button type="button" onclick="selecionarVersaoCifraAdmin('${v.id}')"
                class="text-xs px-3 py-1.5 rounded-lg border border-slate-600 transition ${btnClass}">
                ${v.variation || 'Versão'} (${v.key || 'Tom N/A'})
            </button>
        `;
    }).join('');
}

function selecionarVersaoCifraAdmin(vId) {
    if (stateModalCifras.activeVersionId) {
        const conteudoEl = document.getElementById('edit-cifra-admin-versao-conteudo');
        const vAntiga = stateModalCifras.versions.find(v => v.id === stateModalCifras.activeVersionId);
        if (vAntiga && conteudoEl) {
            vAntiga.chords = conteudoEl.value;
        }
    }

    stateModalCifras.activeVersionId = vId;
    renderizarBotoesVersoesCifraAdmin();

    const container = document.getElementById('edit-cifra-admin-versao-container');
    const label = document.getElementById('edit-cifra-admin-versao-label');
    const conteudo = document.getElementById('edit-cifra-admin-versao-conteudo');
    const vNova = stateModalCifras.versions.find(v => v.id === vId);

    if (container && vNova) {
        container.classList.remove('hidden');
        if (label) label.textContent = `Cifra da Versão: ${vNova.variation || ''} (${vNova.key || ''})`;
        if (conteudo) conteudo.value = vNova.chords || '';
    }
}

async function buscarCifraAutomaticaAdmin() {
    const inputTitulo = document.getElementById('edit-cifra-busca-musica')?.value.trim();
    const inputArtista = document.getElementById('edit-cifra-busca-artista')?.value.trim();

    const titulo = inputTitulo || stateModalCifras.songTitle || 'Música';
    const artista = (inputArtista !== undefined && inputArtista !== null) ? inputArtista : (stateModalCifras.songArtist || '');
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
            // 1ª Tentativa: busca refinada com artista e música
            let queryUrl = `https://api.vagalume.com.br/search.php?art=${encodeURIComponent(artista)}&mus=${encodeURIComponent(titulo)}&extra=cifra`;
            let resp = await fetch(queryUrl);
            let data = null;
            if (resp.ok) {
                try { data = await resp.json(); } catch (e) {}
            }

            // 2ª Tentativa (fallback): se não encontrou e artista foi informado, tenta apenas pelo título da música
            if ((!data || !data.mus || !data.mus[0] || !data.mus[0].cifra) && artista) {
                queryUrl = `https://api.vagalume.com.br/search.php?art=&mus=${encodeURIComponent(titulo)}&extra=cifra`;
                resp = await fetch(queryUrl);
                if (resp.ok) {
                    try { data = await resp.json(); } catch (e) {}
                }
            }

            if (data && data.mus && data.mus[0] && data.mus[0].cifra) {
                const rawCifra = data.mus[0].cifra.text || '';
                const rawTom = data.mus[0].cifra.key || 'C';
                if (rawCifra) {
                    cifraEncontrada = typeof transporCifra === 'function' ? transporCifra(rawCifra, rawTom, tomAlvo) : rawCifra;
                }
            }
        } catch (e) {
            console.warn("Não foi possível acessar API externa de cifras:", e);
        }

        if (!cifraEncontrada) {
            const container = document.getElementById('edit-cifra-previa-container');
            if (container) container.classList.add('hidden');
            mostrarToast('Cifra não encontrada na API automática. Use o botão "🌐 Abrir Cifra Club" e depois "📋 Colar Cifra"!', 'aviso');
            return;
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

function abrirPesquisaCifraClubExterno() {
    const inputTitulo = document.getElementById('edit-cifra-busca-musica')?.value.trim();
    const inputArtista = document.getElementById('edit-cifra-busca-artista')?.value.trim();
    const termo = [inputTitulo || stateModalCifras.songTitle, inputArtista || stateModalCifras.songArtist].filter(Boolean).join(' ');
    const url = `https://www.cifraclub.com.br/?q=${encodeURIComponent(termo)}`;
    window.open(url, '_blank');
}
window.abrirPesquisaCifraClubExterno = abrirPesquisaCifraClubExterno;

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
            vAtiva.chords = typeof sanitizarTextoCifraClub === 'function' ? sanitizarTextoCifraClub(conteudoEl.value) : conteudoEl.value;
        }
    }

    const padraoEl = document.getElementById('edit-cifra-admin-padrao');
    const chordsPadrao = padraoEl ? (typeof sanitizarTextoCifraClub === 'function' ? sanitizarTextoCifraClub(padraoEl.value) : padraoEl.value) : '';

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
            const vChordsLimpo = typeof sanitizarTextoCifraClub === 'function' ? sanitizarTextoCifraClub(v.chords) : v.chords;
            await supabaseClient
                .from('song_versions')
                .update({ chords: vChordsLimpo })
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
    const matchTom = textoCifra.match(/Tom:\s*([A-G][#b]?)/i);
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

    const canUploadCb = document.getElementById('ministerio-admin-can-upload-media');
    if (canUploadCb) {
        canUploadCb.checked = !!(minData && minData.can_upload_media);
    }

    modal.classList.remove('hidden');
}

function fecharModalMinisterioAdmin() {
    const modal = document.getElementById('modal-ministerio-admin');
    if (modal) modal.classList.add('hidden');
}

function abrirModalFuncaoAdmin(ministerioId = null, roleData = null) {
    const modal = document.getElementById('modal-funcao-admin');
    if (!modal) return;
    const selectMin = document.getElementById('funcao-admin-ministerio-id');
    const inputNome = document.getElementById('funcao-admin-nome');
    const inputId = document.getElementById('funcao-admin-id');
    const titleEl = document.getElementById('modal-funcao-admin-titulo');

    if (inputId) inputId.value = roleData ? roleData.id : '';
    if (inputNome) inputNome.value = roleData ? (roleData.name || '') : '';
    if (titleEl) titleEl.textContent = roleData ? '✏️ Editar Função' : '➕ Nova Função no Ministério';

    const scope = roleData?.scale_scope || (roleData && (roleData.name.toLowerCase().includes('cantor') || roleData.name.toLowerCase().includes('vocal')) ? 'song' : 'service');
    const rService = document.getElementById('funcao-escopo-service');
    const rSong = document.getElementById('funcao-escopo-song');
    if (scope === 'song' && rSong) rSong.checked = true;
    else if (rService) rService.checked = true;

    if (selectMin) {
        selectMin.innerHTML = '<option value="">Selecione um ministério...</option>';
        (dadosGlobais.ministries || []).forEach(m => {
            const opt = document.createElement('option');
            opt.value = m.id;
            opt.textContent = `${m.icon || '🏢'} ${m.name}`;
            const targetMinId = roleData ? (roleData.ministry_id || ministerioId) : ministerioId;
            if (targetMinId && m.id === targetMinId) opt.selected = true;
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

        const currentChurchId = (dadosGlobais.church && dadosGlobais.church.id) 
            || (usuarioLogado && usuarioLogado.church_id);

        if (supabaseClient) {
            let minQuery = supabaseClient
                .from('ministries')
                .select('*, ministry_roles(*)')
                .order('name');
            if (currentChurchId) {
                minQuery = minQuery.eq('church_id', currentChurchId);
            }
            const { data: minData, error: minErr } = await minQuery;
            if (!minErr && minData) {
                ministries = minData;
                dadosGlobais.ministries = minData;
            }

            let profQuery = supabaseClient
                .from('profiles')
                .select('*')
                .order('name');
            if (currentChurchId) {
                profQuery = profQuery.eq('church_id', currentChurchId);
            }
            const { data: profData } = await profQuery;

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
                const isSong = r.scale_scope === 'song' || (r.name && (r.name.toLowerCase().includes('cantor') || r.name.toLowerCase().includes('vocal')));
                const scopeBadge = isSong
                    ? `<span class="text-[9px] bg-purple-900/60 text-purple-300 border border-purple-700/50 px-1.5 py-0.2 rounded font-semibold" title="Escalado em cada música individual">🎵 Por Música</span>`
                    : `<span class="text-[9px] bg-indigo-900/60 text-indigo-300 border border-indigo-700/50 px-1.5 py-0.2 rounded font-semibold" title="Escalado no culto geral">⛪ Culto</span>`;
                const botaoEditarRole = roleUsuario === 'admin'
                    ? `<button onclick='abrirModalFuncaoAdmin("${min.id}", ${JSON.stringify(r).replace(/'/g, "&apos;")})' class="text-slate-400 hover:text-white font-bold text-[10px] ml-0.5" title="Editar Função">✏️</button>`
                    : '';
                const botaoDeletarRole = roleUsuario === 'admin'
                    ? `<button onclick="excluirFuncaoMinisterioAdmin('${r.id}')" class="text-slate-400 hover:text-red-400 font-bold text-[10px] ml-0.5" title="Excluir Função">✕</button>`
                    : '';
                return `<span class="bg-slate-900 border border-slate-700 text-slate-300 text-[11px] px-2 py-0.5 rounded-full font-medium inline-flex items-center gap-1">
                    ${r.name || r.role_name}
                    ${scopeBadge}
                    ${botaoEditarRole}
                    ${botaoDeletarRole}
                 </span>`;
            }).join('');

            const membrosHtml = membros.map(m => {
                const sysRole = (m.system_role || m.role || 'voluntario').toLowerCase();
                const isLiderDesteMin = (m.lider_de && Array.isArray(m.lider_de) && m.lider_de.includes(min.id)) || (min.leader_id === m.id);

                let badgeText = 'VOLUNTÁRIO';
                let roleBadge = rolesBadgesCor.voluntario;

                if (sysRole === 'admin') {
                    badgeText = 'ADMIN';
                    roleBadge = rolesBadgesCor.admin;
                } else if (isLiderDesteMin) {
                    badgeText = 'LÍDER';
                    roleBadge = rolesBadgesCor.lider;
                } else if (sysRole === 'membro') {
                    badgeText = 'MEMBRO';
                    roleBadge = rolesBadgesCor.membro;
                }

                return `
                    <div class="flex items-center justify-between p-2 rounded-lg bg-slate-900/60 border border-slate-700/50 text-xs">
                        <div class="truncate mr-2">
                            <span class="font-medium text-white block truncate">${m.name}</span>
                            <span class="text-[11px] text-slate-400 block truncate">${m.email || 'Sem e-mail'}${m.phone ? ' • ' + m.phone : ''}</span>
                        </div>
                        <div class="flex items-center gap-1.5 flex-shrink-0">
                            <span class="${roleBadge} border text-[10px] px-2 py-0.5 rounded-full font-bold uppercase">${badgeText}</span>
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

            const mediaBadge = min.can_upload_media 
                ? `<span class="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800/60 px-2 py-0.5 rounded-full font-semibold inline-flex items-center gap-1">📁 Upload de Mídias</span>`
                : '';

            html += `
                <div class="bg-slate-800/80 border ${corEstilo.split(' ')[0]} rounded-2xl p-5 shadow-lg flex flex-col justify-between space-y-4">
                    <div>
                        <div class="flex items-start justify-between">
                            <div class="flex items-center gap-3">
                                <span class="text-2xl p-2 bg-slate-900/60 border border-slate-700/60 rounded-xl">${min.icon || '🏢'}</span>
                                <div>
                                    <div class="flex items-center gap-2 flex-wrap">
                                        <h3 class="font-bold text-base text-white">${min.name}</h3>
                                        ${mediaBadge}
                                    </div>
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
                        <div class="truncate mr-2 flex items-center gap-2">
                            <span class="font-medium text-white truncate block">${name}</span>
                            <span class="text-[10px] px-1.5 py-0.5 rounded ${badgeClass} flex-shrink-0">${badgeText}</span>
                        </div>
                        <div class="flex items-center gap-1.5 flex-shrink-0">
                            <button onclick="abrirModalIntegranteMinisterio('${p.id}')" class="text-slate-400 hover:text-white p-1 text-xs" title="Editar Perfil">✏️</button>
                            <button onclick="excluirIntegranteMinisterioAdmin('${p.id}')" class="text-red-400 hover:text-red-300 p-1 text-xs" title="Excluir Perfil">🗑️</button>
                        </div>
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

        const can_upload_media = !!document.getElementById('ministerio-admin-can-upload-media')?.checked;
        const churchId = (dadosGlobais.church && dadosGlobais.church.id) || (usuarioLogado && usuarioLogado.church_id);

        const payload = { name, description, icon, color, permissions, can_upload_media };
        if (!id && churchId) {
            payload.church_id = churchId;
        }

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
        if (typeof aplicarVisibilidadePermissoes === 'function') aplicarVisibilidadePermissoes();
        if (typeof popularSelectsInstrumentos === 'function') popularSelectsInstrumentos();
        const wizardModal = document.getElementById('modal-onboarding-wizard');
        if (wizardModal && !wizardModal.classList.contains('hidden')) {
            if (typeof renderizarOnboardingStep === 'function') {
                renderizarOnboardingStep(window.onboardingCurrentStep || 1);
            }
        }
    } catch (err) {
        console.error('Erro ao salvar ministério:', err);
        if (typeof mostrarToast === 'function') mostrarToast(`Erro ao salvar ministério: ${err.message}`, 'erro');
    }
}

async function salvarFuncaoAdmin() {
    const id = document.getElementById('funcao-admin-id')?.value;
    const ministry_id = document.getElementById('funcao-admin-ministerio-id').value;
    const name = document.getElementById('funcao-admin-nome').value.trim();
    const scale_scope = document.querySelector('input[name="funcao-admin-escopo"]:checked')?.value || 'service';

    if (!ministry_id || !name) {
        if (typeof mostrarToast === 'function') mostrarToast('Selecione o ministério e digite o nome da função.', 'aviso');
        return;
    }

    try {
        if (!supabaseClient) throw new Error('Cliente Supabase não inicializado.');

        let error = null;
        if (id) {
            const { error: err } = await supabaseClient
                .from('ministry_roles')
                .update({ ministry_id, name, scale_scope })
                .eq('id', id);
            error = err;
        } else {
            const { error: err } = await supabaseClient
                .from('ministry_roles')
                .insert([{ ministry_id, name, scale_scope }]);
            error = err;
        }

        if (error) throw error;

        fecharModalFuncaoAdmin();
        if (typeof mostrarToast === 'function') mostrarToast(id ? 'Função atualizada com sucesso!' : 'Função adicionada com sucesso!', 'sucesso');
        await renderizarAdminMinisterios();
        if (typeof popularSelectsInstrumentos === 'function') popularSelectsInstrumentos();
        const wizardModal = document.getElementById('modal-onboarding-wizard');
        if (wizardModal && !wizardModal.classList.contains('hidden')) {
            if (typeof renderizarOnboardingStep === 'function') {
                renderizarOnboardingStep(window.onboardingCurrentStep || 1);
            }
        }
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

    const idInput = document.getElementById('integrante-ministerio-id');
    if (idInput) idInput.value = profileId || '';

    const tituloEl = document.getElementById('modal-integrante-ministerio-titulo');
    if (tituloEl) tituloEl.textContent = profileId ? 'Editar Integrante' : 'Novo Integrante';

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

    // Limpar campos se for novo cadastro
    if (!profileId) {
        if (inputNome) inputNome.value = '';
        const inputEmail = document.getElementById('integrante-ministerio-email');
        if (inputEmail) inputEmail.value = '';
        const inputTel = document.getElementById('integrante-ministerio-telefone');
        if (inputTel) inputTel.value = '';
    }

    if (profileId && supabaseClient) {
        // Redundância com cache de perfis locais
        const cachedProf = (dadosGlobais.profiles || []).find(p => p.id === profileId);
        if (cachedProf) {
            if (cachedProf.ministry_id && !selectedMinistryIds.includes(cachedProf.ministry_id)) {
                selectedMinistryIds.push(cachedProf.ministry_id);
            }
            if (cachedProf.user_ministry_roles && Array.isArray(cachedProf.user_ministry_roles)) {
                cachedProf.user_ministry_roles.forEach(ur => {
                    const rId = ur.role_id || ur.ministry_role_id;
                    if (rId && !userRoleIds.includes(rId)) userRoleIds.push(rId);
                });
            }
            if (cachedProf.lider_de && Array.isArray(cachedProf.lider_de)) {
                cachedProf.lider_de.forEach(mId => {
                    if (!leaderMinistryIds.includes(mId)) leaderMinistryIds.push(mId);
                    if (!selectedMinistryIds.includes(mId)) selectedMinistryIds.push(mId);
                });
            }
        }

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
                    
                    if (umr && umr.length > 0) {
                        profile.user_ministry_roles = umr;
                        umr.forEach(ur => {
                            const rId = ur.role_id || ur.ministry_role_id;
                            if (rId && !userRoleIds.includes(rId)) userRoleIds.push(rId);
                        });

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
                phone
            }).eq('id', id);
            if (err) throw err;
        } else {
            const payload = { 
                name, 
                email, 
                phone, 
                system_role,
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
            // Remove registros anteriores
            try {
                await supabaseClient.from('user_ministry_roles').delete().or(`user_id.eq.${profileId},profile_id.eq.${profileId}`);
            } catch(e) {
                console.warn('Aviso ao limpar user_ministry_roles anteriores:', e);
            }

            if (roleIds.length > 0) {
                const insertData = roleIds.map(rId => ({
                    user_id: profileId,
                    profile_id: profileId,
                    role_id: rId
                }));

                let { error: insErr } = await supabaseClient.from('user_ministry_roles').insert(insertData);
                
                if (insErr) {
                    console.warn("Tentativa com fallback em user_ministry_roles:", insErr);
                    const fallbackData = roleIds.map(rId => ({
                        profile_id: profileId,
                        role_id: rId
                    }));
                    const { error: fbErr } = await supabaseClient.from('user_ministry_roles').insert(fallbackData);
                    if (fbErr) {
                        const fallbackData2 = roleIds.map(rId => ({
                            user_id: profileId,
                            role_id: rId
                        }));
                        const { error: fbErr2 } = await supabaseClient.from('user_ministry_roles').insert(fallbackData2);
                        if (fbErr2) {
                            console.error("Falha final ao inserir user_ministry_roles:", fbErr2);
                            throw new Error("Não foi possível salvar as funções do integrante: " + (fbErr2.message || 'Erro no banco'));
                        }
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
    if (!id) return;
    if (!confirm('Tem certeza que deseja excluir este ministério? Todas as funções associadas e os vínculos de integrantes serão removidos.')) return;
    try {
        if (!supabaseClient) throw new Error('Cliente Supabase não inicializado.');

        // 1. Desvincular membros que apontavam diretamente para este ministério
        try {
            await supabaseClient.from('profiles').update({ ministry_id: null }).eq('ministry_id', id);
        } catch(e) {}

        // 2. Limpar cargos dos integrantes vinculados a este ministério
        try {
            await supabaseClient.from('user_ministry_roles').delete().eq('ministry_id', id);
        } catch(e) {}

        // 3. Buscar e apagar funções vinculadas a este ministério
        try {
            await supabaseClient.from('ministry_roles').delete().eq('ministry_id', id);
        } catch(e) {}

        // 4. Excluir o ministério
        const { error } = await supabaseClient.from('ministries').delete().eq('id', id);
        if (error) throw error;

        if (typeof mostrarToast === 'function') mostrarToast('Ministério excluído com sucesso!', 'sucesso');
        if (typeof carregarDados === 'function') await carregarDados();
        await renderizarAdminMinisterios();
        if (typeof renderizarAdminListaMembros === 'function') renderizarAdminListaMembros();
        const wizardModal = document.getElementById('modal-onboarding-wizard');
        if (wizardModal && !wizardModal.classList.contains('hidden')) {
            if (typeof renderizarOnboardingStep === 'function') {
                renderizarOnboardingStep(window.onboardingCurrentStep || 1);
            }
        }
    } catch (err) {
        console.error('Erro ao excluir ministério:', err);
        if (typeof mostrarToast === 'function') mostrarToast(`Erro ao excluir: ${err.message}`, 'erro');
    }
}

async function excluirFuncaoMinisterioAdmin(id) {
    if (!id) return;
    if (!confirm('Tem certeza que deseja excluir esta função?')) return;
    try {
        if (!supabaseClient) throw new Error('Cliente Supabase não inicializado.');

        // 1. Limpar vínculos na tabela intermediária user_ministry_roles
        try {
            await supabaseClient.from('user_ministry_roles').delete().eq('role_id', id);
        } catch(e) {}

        // 2. Excluir a função
        const { error } = await supabaseClient.from('ministry_roles').delete().eq('id', id);
        if (error) throw error;

        if (typeof mostrarToast === 'function') mostrarToast('Função excluída com sucesso!', 'sucesso');
        if (typeof carregarDados === 'function') await carregarDados();
        await renderizarAdminMinisterios();
        const wizardModal = document.getElementById('modal-onboarding-wizard');
        if (wizardModal && !wizardModal.classList.contains('hidden')) {
            if (typeof renderizarOnboardingStep === 'function') {
                renderizarOnboardingStep(window.onboardingCurrentStep || 1);
            }
        }
    } catch (err) {
        console.error('Erro ao excluir função:', err);
        if (typeof mostrarToast === 'function') mostrarToast(`Erro ao excluir: ${err.message}`, 'erro');
    }
}

async function excluirIntegranteMinisterioAdmin(id) {
    if (!id) return;
    if (!confirm('Tem certeza que deseja excluir este perfil do sistema? Todos os vínculos associados a ele serão removidos.')) return;
    try {
        if (!supabaseClient) throw new Error('Cliente Supabase não inicializado.');

        // 1. Limpar vínculos em tabelas filhas para evitar conflito de Foreign Key
        try { await supabaseClient.from('user_ministry_roles').delete().or(`user_id.eq.${id},profile_id.eq.${id}`); } catch(e) {}
        try { await supabaseClient.from('service_volunteers').delete().eq('user_id', id); } catch(e) {}
        try { await supabaseClient.from('service_scales').delete().or(`user_id.eq.${id},profile_id.eq.${id}`); } catch(e) {}
        try { await supabaseClient.from('availability_comments').delete().eq('user_id', id); } catch(e) {}

        // 2. Excluir o perfil
        const { error } = await supabaseClient.from('profiles').delete().eq('id', id);
        if (error) throw error;

        if (typeof mostrarToast === 'function') mostrarToast('Perfil excluído com sucesso!', 'sucesso');
        if (typeof carregarDados === 'function') await carregarDados();
        await renderizarAdminMinisterios();
        if (typeof renderizarAdminListaMembros === 'function') renderizarAdminListaMembros();
    } catch (err) {
        console.error('Erro ao excluir integrante:', err);
        if (typeof mostrarToast === 'function') mostrarToast(`Erro ao excluir: ${err.message}`, 'erro');
    }
}

// ===================== ADMIN: MÍDIAS (UPLOAD E STORAGE) =====================

function setupUploadMidias() {
    const dropzone = document.getElementById('dropzone-midia');
    const inputUpload = document.getElementById('input-upload-midia');

    if (dropzone && inputUpload && !dropzone.dataset.bound) {
        dropzone.dataset.bound = 'true';

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
}

window.addEventListener('DOMContentLoaded', setupUploadMidias);

async function lidarComUploadMidia(files) {
    if (!files || files.length === 0) return;

    const progressBar = document.getElementById('midia-upload-progress');
    const bar = document.getElementById('midia-upload-bar');
    const text = document.getElementById('midia-upload-text');

    const churchId = (typeof dadosGlobais !== 'undefined' && dadosGlobais.church?.id)
        || (typeof usuarioLogado !== 'undefined' && usuarioLogado?.church_id)
        || (typeof window !== 'undefined' && (window.dadosGlobais?.church?.id || window.usuarioLogado?.church_id));

    if (!churchId) {
        const msg = 'Igreja não identificada no escopo global para upload de mídias.';
        console.error(msg);
        if (typeof mostrarToast === 'function') mostrarToast(msg, 'erro');
        else alert(msg);
        return;
    }

    if (!supabaseClient) {
        const msg = 'Cliente Supabase não inicializado.';
        if (typeof mostrarToast === 'function') mostrarToast(msg, 'erro');
        else alert(msg);
        return;
    }

    if (progressBar) progressBar.classList.remove('hidden');
    if (text) text.textContent = 'Verificando limite de armazenamento...';
    if (bar) bar.style.width = '0%';

    try {
        // Consultar limites e uso atual da igreja
        const { data: churchData, error: churchErr } = await supabaseClient
            .from('churches')
            .select('storage_limit_mb, storage_used_bytes')
            .eq('id', churchId)
            .maybeSingle();

        if (churchErr) {
            console.error('Erro ao consultar tabela churches:', churchErr);
        }

        const limitMb = Number(churchData?.storage_limit_mb || 1024);
        const limitBytes = limitMb * 1024 * 1024;
        let currentUsedBytes = Number(churchData?.storage_used_bytes || 0);

        // Verificar o tamanho total dos arquivos a serem enviados
        let totalUploadBytes = 0;
        for (let i = 0; i < files.length; i++) {
            totalUploadBytes += files[i].size;
        }

        if (currentUsedBytes + totalUploadBytes > limitBytes) {
            const usedMbFormatted = (currentUsedBytes / (1024 * 1024)).toFixed(2);
            const uploadMbFormatted = (totalUploadBytes / (1024 * 1024)).toFixed(2);
            const freeMbFormatted = Math.max(0, (limitBytes - currentUsedBytes) / (1024 * 1024)).toFixed(2);
            const msg = `Limite de armazenamento excedido! O envio de ${uploadMbFormatted} MB ultrapassa o limite disponível (${freeMbFormatted} MB restantes de ${limitMb} MB). Uso atual: ${usedMbFormatted} MB.`;
            
            console.warn(msg);
            if (progressBar) progressBar.classList.add('hidden');
            if (typeof mostrarToast === 'function') mostrarToast(msg, 'erro');
            alert(msg);
            return;
        }

        let sucessoCount = 0;

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (text) text.textContent = `Enviando ${file.name} (${i + 1}/${files.length})...`;
            if (bar) bar.style.width = `${((i) / files.length) * 100}%`;

            if (currentUsedBytes + file.size > limitBytes) {
                const msg = `Limite de armazenamento atingido ao tentar enviar "${file.name}".`;
                if (typeof mostrarToast === 'function') mostrarToast(msg, 'erro');
                alert(msg);
                break;
            }

            try {
                const fileExt = file.name.split('.').pop();
                const randomPrefix = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
                const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
                const fileName = `${randomPrefix}_${sanitizedName}`;
                const filePath = `${churchId}/${fileName}`;

                // 1. Upload via Cloudflare Worker
                const workerUrl = `https://liturge-upload-worker.erickrosquero.workers.dev/${filePath}`;
                const response = await fetch(workerUrl, {
                    method: 'PUT',
                    body: file,
                    headers: { 'Content-Type': file.type || 'application/octet-stream' }
                });

                if (!response.ok) {
                    const errText = await response.text();
                    console.error("Erro ao subir arquivo para o Worker:", errText);
                    if (typeof mostrarToast === 'function') mostrarToast(`Erro ao enviar ${file.name}`, 'erro');
                    continue;
                }

                const resData = await response.json();
                const fileUrl = resData.file_url || '';
                const targetMinistryId = document.getElementById('upload-midia-ministerio-destino')?.value || null;

                // 3. Inserir registro na tabela church_media associando ao ministério selecionado
                const { error: insertErr } = await supabaseClient
                    .from('church_media')
                    .insert([{
                        church_id: churchId,
                        ministry_id: targetMinistryId || null,
                        file_name: file.name,
                        file_url: fileUrl,
                        file_size_bytes: file.size,
                        mime_type: file.type || `application/${fileExt}`
                    }]);

                if (insertErr) {
                    console.error("Erro ao inserir na tabela church_media:", insertErr);
                    if (typeof mostrarToast === 'function') mostrarToast(`Arquivo enviado, mas erro ao registrar no banco: ${insertErr.message}`, 'aviso');
                }

                // 4. Atualizar storage_used_bytes na tabela churches
                currentUsedBytes += file.size;
                const { error: updateErr } = await supabaseClient
                    .from('churches')
                    .update({ storage_used_bytes: currentUsedBytes })
                    .eq('id', churchId);

                if (updateErr) {
                    console.error("Erro ao atualizar storage_used_bytes na igreja:", updateErr);
                }

                sucessoCount++;
            } catch (err) {
                console.error(`Erro inesperado no envio de ${file.name}:`, err);
            }
        }

        if (bar) bar.style.width = `100%`;
        if (text) text.textContent = `Concluído! ${sucessoCount} de ${files.length} arquivos enviados.`;
        if (sucessoCount > 0 && typeof mostrarToast === 'function') {
            mostrarToast(`${sucessoCount} mídia(s) enviada(s) com sucesso!`, 'sucesso');
        }
    } catch (err) {
        console.error("Erro geral no processo de upload:", err);
        if (typeof mostrarToast === 'function') mostrarToast(`Erro no upload: ${err.message}`, 'erro');
    } finally {
        setTimeout(() => {
            if (progressBar) progressBar.classList.add('hidden');
            carregarMidiasAdmin();
        }, 1500);
    }
}

let midiasAdminCache = [];
let filtroMidiaMinisterioAtivo = '';

function filtrarMidiasPorMinisterio(minId) {
    filtroMidiaMinisterioAtivo = minId || '';
    renderizarGridMidiasFiltradas();
}
window.filtrarMidiasPorMinisterio = filtrarMidiasPorMinisterio;

function renderizarGridMidiasFiltradas() {
    const grid = document.getElementById('lista-midias-grid');
    if (!grid) return;

    let midias = midiasAdminCache || [];
    if (filtroMidiaMinisterioAtivo) {
        midias = midias.filter(m => m.ministry_id === filtroMidiaMinisterioAtivo);
    }

    if (midias.length === 0) {
        grid.innerHTML = `
            <div class="col-span-full py-12 text-center text-slate-500">
                <p class="text-3xl mb-2">📭</p>
                <p class="text-sm font-medium">Nenhuma mídia encontrada para este filtro.</p>
                <p class="text-xs text-slate-600 mt-1">Selecione outro ministério ou envie novos arquivos acima.</p>
            </div>
        `;
        return;
    }

    let html = '';
    for (const item of midias) {
        const url = item.file_url || '';
        const fileName = item.file_name || 'arquivo';
        const mime = (item.mime_type || '').toLowerCase();
        const sizeBytes = Number(item.file_size_bytes || 0);
        const sizeFormatted = sizeBytes > 0 ? (sizeBytes / (1024 * 1024)).toFixed(2) + ' MB' : '';
        const minObj = (dadosGlobais.ministries || []).find(m => m.id === item.ministry_id);
        const minBadge = minObj 
            ? `<span class="inline-block text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-indigo-300 border border-slate-700 font-medium mb-1 truncate max-w-full">${minObj.icon || '🏢'} ${minObj.name}</span>`
            : `<span class="inline-block text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700 font-medium mb-1">Geral</span>`;

        let previewHtml = '';
        if (mime.startsWith('image/')) {
            previewHtml = `
                <div class="h-32 bg-slate-950 overflow-hidden flex items-center justify-center relative">
                    <img src="${url}" alt="${fileName}" class="w-full h-full object-cover transition duration-300 group-hover:scale-105" loading="lazy" />
                    <span class="absolute top-2 right-2 text-[10px] bg-black/60 backdrop-blur-sm text-white px-1.5 py-0.5 rounded">IMG</span>
                </div>
            `;
        } else if (mime.startsWith('video/')) {
            previewHtml = `
                <div class="h-32 bg-slate-950 flex flex-col items-center justify-center relative text-slate-400">
                    <span class="text-3xl mb-1">🎬</span>
                    <span class="text-[10px] uppercase tracking-wider font-bold">Vídeo</span>
                    <span class="absolute top-2 right-2 text-[10px] bg-indigo-900/80 text-indigo-200 px-1.5 py-0.5 rounded">VÍDEO</span>
                </div>
            `;
        } else {
            previewHtml = `
                <div class="h-32 bg-slate-950 flex flex-col items-center justify-center relative text-slate-400">
                    <span class="text-3xl mb-1">📄</span>
                    <span class="text-[10px] uppercase tracking-wider font-bold">Arquivo</span>
                    <span class="absolute top-2 right-2 text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded">DOC</span>
                </div>
            `;
        }

        const safeMediaId = item.id;
        const safeNameEscaped = fileName.replace(/'/g, "\\'").replace(/"/g, '&quot;');
        const safeUrlEscaped = url.replace(/'/g, "\\'");

        html += `
            <div class="bg-slate-900 border border-slate-700/80 rounded-xl shadow-sm flex flex-col hover:border-indigo-500/60 transition group overflow-hidden">
                ${previewHtml}
                <div class="p-3 flex-1 flex flex-col justify-between">
                    <div>
                        <div class="mb-1">${minBadge}</div>
                        <p class="text-xs text-slate-200 font-medium truncate mb-1" title="${fileName}">${fileName}</p>
                        ${sizeFormatted ? `<span class="inline-block text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono mb-2">${sizeFormatted}</span>` : ''}
                    </div>
                    <div class="flex items-center justify-between mt-auto pt-2 border-t border-slate-800/80">
                        <div class="flex items-center gap-2.5">
                            <a href="${url}" target="_blank" download="${fileName}" class="text-indigo-400 hover:text-indigo-300 text-xs font-medium">Baixar</a>
                            <button onclick="abrirModalVincularMidia('${safeNameEscaped}', '${safeUrlEscaped}')" class="text-emerald-400 hover:text-emerald-300 text-xs font-medium opacity-80 sm:opacity-0 group-hover:opacity-100 transition">Vincular</button>
                        </div>
                        <button onclick="excluirMidiaAdmin('${safeMediaId}')" class="text-slate-500 hover:text-red-400 text-xs opacity-80 sm:opacity-0 group-hover:opacity-100 transition font-medium">Excluir</button>
                    </div>
                </div>
            </div>
        `;
    }

    grid.innerHTML = html;
}

async function carregarMidiasAdmin() {
    setupUploadMidias();

    const grid = document.getElementById('lista-midias-grid');
    if (!grid) return;

    if (!supabaseClient) {
        grid.innerHTML = '<p class="text-yellow-400 text-sm col-span-full">Aguardando inicialização do banco de dados...</p>';
        return;
    }

    grid.innerHTML = '<p class="text-slate-500 text-sm col-span-full animate-pulse">Carregando mídias...</p>';

    const churchId = (typeof dadosGlobais !== 'undefined' && dadosGlobais.church?.id)
        || (typeof usuarioLogado !== 'undefined' && usuarioLogado?.church_id)
        || (typeof window !== 'undefined' && (window.dadosGlobais?.church?.id || window.usuarioLogado?.church_id));

    try {
        // Popular selects de ministérios no cabeçalho de mídias
        const selectFiltro = document.getElementById('filtro-midia-ministerio');
        const selectDestino = document.getElementById('upload-midia-ministerio-destino');
        if (selectFiltro && dadosGlobais.ministries) {
            const valAtual = selectFiltro.value;
            let opts = '<option value="">📂 Todos os Ministérios</option>';
            dadosGlobais.ministries.forEach(m => {
                opts += `<option value="${m.id}" ${valAtual === m.id ? 'selected' : ''}>${m.icon || '🏢'} ${m.name}</option>`;
            });
            selectFiltro.innerHTML = opts;
        }
        if (selectDestino && dadosGlobais.ministries) {
            const valAtual = selectDestino.value;
            let opts = '<option value="">📂 Geral da Igreja (Sem ministério)</option>';
            dadosGlobais.ministries.forEach(m => {
                opts += `<option value="${m.id}" ${valAtual === m.id ? 'selected' : ''}>${m.icon || '🏢'} ${m.name}</option>`;
            });
            selectDestino.innerHTML = opts;
        }

        // 1. Buscar informações de limite e uso de armazenamento da igreja
        let storageUsedBytes = 0;
        let storageLimitMb = 1024;

        if (churchId) {
            const { data: churchInfo } = await supabaseClient
                .from('churches')
                .select('storage_limit_mb, storage_used_bytes')
                .eq('id', churchId)
                .maybeSingle();

            if (churchInfo) {
                storageLimitMb = Number(churchInfo.storage_limit_mb || 1024);
                storageUsedBytes = Number(churchInfo.storage_used_bytes || 0);
            }
        }

        // 2. Buscar mídias cadastradas na tabela church_media
        let query = supabaseClient.from('church_media').select('*').order('created_at', { ascending: false });
        if (churchId) {
            query = query.eq('church_id', churchId);
        }

        const { data: midias, error } = await query;

        if (error) throw error;

        midiasAdminCache = midias || [];

        // Se storage_used_bytes estiver zerado mas houver mídias no banco, calcular a soma dos arquivos
        if (storageUsedBytes === 0 && midias && midias.length > 0) {
            storageUsedBytes = midias.reduce((acc, m) => acc + Number(m.file_size_bytes || 0), 0);
        }

        renderizarGridMidiasFiltradas();
    } catch (err) {
        console.error("Erro ao carregar mídias da tabela church_media:", err);
        grid.innerHTML = '<p class="text-red-400 text-sm col-span-full">Erro ao carregar mídias do Supabase. Verifique se a tabela "church_media" existe e se as políticas RLS estão configuradas.</p>';
    }
}

window.carregarMidiasAdmin = carregarMidiasAdmin;
window.renderizarAdminMidias = carregarMidiasAdmin;

async function excluirMidiaAdmin(mediaIdOrFileName) {
    if (!mediaIdOrFileName) return;

    const churchId = (typeof dadosGlobais !== 'undefined' && dadosGlobais.church?.id)
        || (typeof usuarioLogado !== 'undefined' && usuarioLogado?.church_id)
        || (typeof window !== 'undefined' && (window.dadosGlobais?.church?.id || window.usuarioLogado?.church_id));

    try {
        // 1. Obter registro completo da mídia no banco
        let media = null;
        if (typeof mediaIdOrFileName === 'object') {
            media = mediaIdOrFileName;
        } else {
            const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(mediaIdOrFileName);
            if (isUuid) {
                const { data } = await supabaseClient
                    .from('church_media')
                    .select('*')
                    .eq('id', mediaIdOrFileName)
                    .maybeSingle();
                media = data;
            }
            
            if (!media) {
                let query = supabaseClient.from('church_media').select('*').eq('file_name', mediaIdOrFileName);
                if (churchId) query = query.eq('church_id', churchId);
                const { data } = await query.maybeSingle();
                media = data;
            }
        }

        const fileNameDisplay = media?.file_name || mediaIdOrFileName;
        if (!confirm(`Deseja realmente excluir o arquivo "${fileNameDisplay}"?`)) return;

        // 2. Extrair o caminho de arquivo no bucket Storage
        let storagePath = null;
        if (media?.file_url) {
            try {
                const urlObj = new URL(media.file_url);
                // O pathname tem uma barra no início (ex: /church_id/arquivo.jpg), pegamos a partir do índice 1
                const pathSemBarra = decodeURIComponent(urlObj.pathname.slice(1));
                
                // Se for URL do Supabase Storage antigo, o pathname inclui "storage/v1/object/public/bucket/"
                if (pathSemBarra.includes('liturge-media-inbox/')) {
                    storagePath = pathSemBarra.split('liturge-media-inbox/')[1];
                } else {
                    storagePath = pathSemBarra; // Para URLs do Cloudflare R2, o pathname já é a chave
                }
            } catch (e) {
                console.error("Erro ao fazer parse da URL da mídia:", e);
            }
        }

        if (!storagePath) {
            const targetChurchId = media?.church_id || churchId;
            storagePath = targetChurchId ? `${targetChurchId}/${fileNameDisplay}` : fileNameDisplay;
        }

        // 3. Excluir via Cloudflare Worker
        try {
            const workerUrl = `https://liturge-upload-worker.erickrosquero.workers.dev/${storagePath}`;
            await fetch(workerUrl, { method: 'DELETE' });
        } catch (sErr) {
            console.warn("Aviso ao remover do Cloudflare Worker:", sErr);
        }

        // 4. Excluir da tabela church_media
        if (media?.id) {
            const { error: delDbErr } = await supabaseClient
                .from('church_media')
                .delete()
                .eq('id', media.id);
            if (delDbErr) throw delDbErr;
        } else {
            let delQuery = supabaseClient.from('church_media').delete().eq('file_name', fileNameDisplay);
            if (churchId) delQuery = delQuery.eq('church_id', churchId);
            const { error: delDbErr } = await delQuery;
            if (delDbErr) throw delDbErr;
        }

        // 5. Subtrair o tamanho do arquivo em storage_used_bytes na tabela churches
        const sizeToSubtract = Number(media?.file_size_bytes || 0);
        const targetChurchId = media?.church_id || churchId;

        if (targetChurchId && sizeToSubtract > 0) {
            const { data: churchData, error: churchFetchErr } = await supabaseClient
                .from('churches')
                .select('storage_used_bytes')
                .eq('id', targetChurchId)
                .maybeSingle();

            if (!churchFetchErr && churchData) {
                const currentBytes = Number(churchData.storage_used_bytes || 0);
                const newUsedBytes = Math.max(0, currentBytes - sizeToSubtract);

                const { error: updateErr } = await supabaseClient
                    .from('churches')
                    .update({ storage_used_bytes: newUsedBytes })
                    .eq('id', targetChurchId);

                if (updateErr) {
                    console.error("Erro ao subtrair storage_used_bytes na igreja:", updateErr);
                }
            }
        }

        if (typeof mostrarToast === 'function') mostrarToast('Arquivo excluído com sucesso!', 'sucesso');
        carregarMidiasAdmin();
    } catch (err) {
        console.error("Erro ao excluir mídia:", err);
        if (typeof mostrarToast === 'function') mostrarToast(`Erro ao excluir mídia: ${err.message}`, 'erro');
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
            const currentChurchId = (typeof dadosGlobais !== 'undefined' && dadosGlobais.church?.id) 
                ? dadosGlobais.church.id 
                : (usuarioLogado?.church_id || null);

            let query = supabaseClient.from('profiles').select('id, name, email, system_role, role, ministry_id');
            if (currentChurchId) query = query.eq('church_id', currentChurchId);

            const { data, error } = await query;
            if (!error && data) {
                profiles = data;
            } else if (error) {
                console.error("Erro ao consultar membros da igreja:", error);
            }
        }

        if (profiles.length === 0 && dadosGlobais.voluntarios && Array.isArray(dadosGlobais.voluntarios)) {
            const currentChurchId = (typeof dadosGlobais !== 'undefined' && dadosGlobais.church?.id) 
                ? dadosGlobais.church.id 
                : (usuarioLogado?.church_id || null);
            profiles = currentChurchId 
                ? dadosGlobais.voluntarios.filter(v => v.church_id === currentChurchId) 
                : dadosGlobais.voluntarios;
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

let listaIgrejasAdminCache = [];

async function renderizarAdminListaIgrejas() {
    const listBody = document.getElementById('admin-lista-igrejas-body');
    if (!listBody) return;
    
    listBody.innerHTML = '<div class="text-center py-8 text-slate-400">Carregando igrejas cadastradas...</div>';
    
    try {
        if (!supabaseClient) throw new Error("Cliente Supabase não inicializado.");
        const { data: churches, error } = await supabaseClient
            .from('churches')
            .select('*')
            .order('created_at', { ascending: false });
            
        if (error) throw error;
        
        listaIgrejasAdminCache = churches || [];

        if (!churches || churches.length === 0) {
            listBody.innerHTML = '<div class="text-center py-8 text-slate-400 bg-slate-800/30 rounded-2xl border border-slate-700/60">Nenhuma igreja cadastrada até o momento.</div>';
            return;
        }
        
        listBody.innerHTML = '';
        churches.forEach(church => {
            const card = document.createElement('div');
            card.className = "bg-slate-900/90 border border-slate-700/80 hover:border-slate-600 rounded-2xl p-4 sm:p-5 shadow-lg transition duration-200 space-y-3.5";
            
            const isPending = church.status === 'pending';
            const statusBadge = isPending 
                ? '<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30"><span class="w-1.5 h-1.5 rounded-full bg-amber-400"></span> Pendente</span>'
                : '<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"><span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Ativo</span>';
                
            const actionButton = isPending
                ? `<button onclick="alterarStatusIgreja('${church.id}', 'active')" class="bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-1.5 rounded-xl text-xs font-semibold transition shadow-md shadow-emerald-900/20 active:scale-95 whitespace-nowrap flex items-center gap-1">✓ Ativar</button>`
                : `<button onclick="alterarStatusIgreja('${church.id}', 'pending')" class="bg-slate-800 hover:bg-amber-700/80 text-slate-300 hover:text-white px-3.5 py-1.5 rounded-xl text-xs font-semibold border border-slate-700 transition active:scale-95 whitespace-nowrap flex items-center gap-1">⏸ Suspender</button>`;
                
            const storageLimitMb = church.storage_limit_mb !== null && church.storage_limit_mb !== undefined ? church.storage_limit_mb : 1024;
            
            const whatsappFormatted = church.leader_whatsapp 
                ? `<a href="https://wa.me/55${String(church.leader_whatsapp).replace(/\D/g, '')}" target="_blank" rel="noopener" class="text-emerald-400 hover:underline font-mono text-xs flex items-center gap-1 font-semibold">📱 ${church.leader_whatsapp}</a>`
                : `<span class="text-slate-500 text-xs italic">Não informado</span>`;

            const valorFormatado = church.agreed_payment
                ? `<span class="text-xs font-bold text-amber-300 bg-amber-950/40 border border-amber-800/40 px-2 py-0.5 rounded-md">R$ ${church.agreed_payment}</span>`
                : `<span class="text-xs text-slate-500 italic">A combinar</span>`;

            card.innerHTML = `
                <!-- Linha Superior: Cabeçalho com Nome, Slug, Status e Ações -->
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
                    <div class="flex items-center gap-3 min-w-0">
                        <div class="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-lg shrink-0 shadow-inner">
                            ⛪
                        </div>
                        <div class="min-w-0">
                            <div class="flex items-center gap-2 flex-wrap">
                                <h4 class="font-bold text-white text-base leading-tight truncate">${church.name}</h4>
                                <span class="px-2 py-0.5 rounded-md bg-slate-950 text-cyan-400 font-mono text-[11px] border border-slate-800 shrink-0">${church.slug}</span>
                            </div>
                            <div class="text-[10px] text-slate-500 font-mono truncate">ID: ${church.id || '-'}</div>
                        </div>
                    </div>

                    <!-- Grupo de Status & Ações -->
                    <div class="flex items-center gap-2 flex-wrap sm:justify-end shrink-0">
                        ${statusBadge}
                        ${actionButton}
                        <button onclick="abrirModalEditarIgrejaAdmin('${church.id}')" 
                            class="bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-3 py-1.5 rounded-xl text-xs font-semibold border border-slate-700 transition active:scale-95 flex items-center gap-1 shadow-sm"
                            title="Editar Dados da Igreja">
                            <span>✏️</span> Editar
                        </button>
                        <button onclick="abrirModalExcluirIgreja('${church.id}', '${church.name.replace(/'/g, "\\'")}', '${church.slug}')" 
                            class="bg-slate-800 hover:bg-red-700/80 text-slate-400 hover:text-white p-2 rounded-xl text-xs font-semibold border border-slate-700 hover:border-red-600 transition active:scale-95 flex items-center justify-center shadow-sm" 
                            title="Excluir Igreja e Todos os Dados">
                            <span class="text-sm">🗑️</span>
                        </button>
                    </div>
                </div>

                <!-- Linha Inferior: Grid de Informações Detalhadas -->
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <!-- WhatsApp -->
                    <div class="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between gap-2">
                        <span class="text-slate-400 font-medium">WhatsApp:</span>
                        <div class="text-right truncate">${whatsappFormatted}</div>
                    </div>

                    <!-- Mensalidade -->
                    <div class="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between gap-2">
                        <span class="text-slate-400 font-medium">Valor Combinado:</span>
                        <div class="text-right">${valorFormatado}</div>
                    </div>

                    <!-- Cota de Armazenamento -->
                    <div class="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between gap-2">
                        <span class="text-slate-400 font-medium">💾 Cota de Mídia:</span>
                        <div class="font-bold text-white font-mono text-right">${storageLimitMb} MB</div>
                    </div>
                </div>
            `;
            listBody.appendChild(card);
        });
    } catch (err) {
        console.error(err);
        listBody.innerHTML = '<div class="text-center py-8 text-red-400 bg-red-950/20 rounded-2xl border border-red-800/40">Erro ao carregar lista de igrejas.</div>';
    }
}

async function salvarCotaIgreja(churchId) {
    if (!churchId) return;
    const input = document.getElementById(`cota-igreja-${churchId}`);
    if (!input) return;

    const valorCota = parseInt(input.value, 10);
    if (isNaN(valorCota) || valorCota < 0) {
        if (typeof mostrarToast === 'function') mostrarToast('Por favor, informe uma cota válida em MB.', 'aviso');
        else alert('Por favor, informe uma cota válida em MB.');
        return;
    }

    try {
        if (!supabaseClient) throw new Error("Cliente Supabase não inicializado.");
        
        const { error } = await supabaseClient
            .from('churches')
            .update({ storage_limit_mb: valorCota })
            .eq('id', churchId);

        if (error) throw error;

        if (typeof mostrarToast === 'function') {
            mostrarToast(`Cota de armazenamento atualizada para ${valorCota} MB com sucesso!`, 'sucesso');
        } else {
            alert(`Cota de armazenamento atualizada para ${valorCota} MB com sucesso!`);
        }
    } catch (err) {
        console.error("Erro ao salvar cota da igreja:", err);
        if (typeof mostrarToast === 'function') mostrarToast(`Erro ao salvar cota: ${err.message || 'Falha no banco.'}`, 'erro');
        else alert('Erro ao salvar cota da igreja.');
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

let igrejaParaExcluir = null;

function abrirModalExcluirIgreja(churchId, churchName, churchSlug) {
    if (!churchId) return;

    if (churchSlug === 'idb-louvor' || churchId === 'ae125cfd-96ef-4324-b1f0-f96a4f34eecf') {
        if (typeof mostrarToast === 'function') mostrarToast('⚠️ A igreja matriz principal do sistema não pode ser excluída.', 'aviso');
        else alert('A igreja matriz principal do sistema não pode ser excluída.');
        return;
    }

    igrejaParaExcluir = { id: churchId, name: churchName, slug: churchSlug };

    const elNome = document.getElementById('excluir-igreja-nome');
    const elSlug = document.getElementById('excluir-igreja-slug');
    const elConfirm = document.getElementById('excluir-igreja-confirm-texto');
    const input = document.getElementById('input-confirmar-exclusao-igreja');
    const btn = document.getElementById('btn-confirmar-excluir-igreja');

    const textoEsperado = `EXCLUIR ${churchSlug}`;
    if (elNome) elNome.textContent = churchName;
    if (elSlug) elSlug.textContent = churchSlug;
    if (elConfirm) elConfirm.textContent = textoEsperado;
    if (input) { input.value = ''; input.placeholder = textoEsperado; }
    if (btn) { btn.disabled = true; btn.textContent = '🗑️ Excluir Definitivamente'; }

    const modal = document.getElementById('modal-excluir-igreja');
    if (modal) modal.classList.remove('hidden');
    if (input) input.focus();
}

function validarTextoConfirmacaoExclusao() {
    if (!igrejaParaExcluir) return;
    const input = document.getElementById('input-confirmar-exclusao-igreja');
    const btn = document.getElementById('btn-confirmar-excluir-igreja');
    if (!input || !btn) return;

    const textoEsperado = `EXCLUIR ${igrejaParaExcluir.slug}`.trim().toLowerCase();
    const digitado = input.value.trim().toLowerCase();

    if (digitado === textoEsperado) {
        btn.disabled = false;
    } else {
        btn.disabled = true;
    }
}

function fecharModalExcluirIgreja() {
    const modal = document.getElementById('modal-excluir-igreja');
    if (modal) modal.classList.add('hidden');
    igrejaParaExcluir = null;
}

async function executarExclusaoIgrejaDefinitiva() {
    if (!igrejaParaExcluir) return;
    const churchId = igrejaParaExcluir.id;
    const churchName = igrejaParaExcluir.name;
    const btn = document.getElementById('btn-confirmar-excluir-igreja');

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span class="animate-spin inline-block mr-1">⏳</span> Excluindo todos os dados...';
    }

    try {
        if (!supabaseClient) throw new Error("Cliente Supabase não inicializado.");

        let excluiuComSucesso = false;

        // 1. Tentar primeiro via função RPC com SECURITY DEFINER
        try {
            const { data: rpcRes, error: rpcErr } = await supabaseClient.rpc('delete_church_cascade', {
                target_church_id: churchId
            });
            if (!rpcErr && rpcRes === true) {
                excluiuComSucesso = true;
            }
        } catch(eRpc) {
            console.warn("RPC delete_church_cascade não disponível ou erro:", eRpc);
        }

        // 2. Se a RPC não estiver criada, executar exclusão direta passo a passo
        if (!excluiuComSucesso) {
            // A. Mídias, Documentos, Patrimônio e Regras
            try { await supabaseClient.from('church_media').delete().eq('church_id', churchId); } catch(e) {}
            try { await supabaseClient.from('church_assets').delete().eq('church_id', churchId); } catch(e) {}
            try { await supabaseClient.from('church_documents').delete().eq('church_id', churchId); } catch(e) {}
            try { await supabaseClient.from('recurring_rules').delete().eq('church_id', churchId); } catch(e) {}

            // B. Cultos e tabelas dependentes
            const { data: servicos } = await supabaseClient.from('services').select('id').eq('church_id', churchId);
            if (servicos && servicos.length > 0) {
                const serviceIds = servicos.map(s => s.id);
                try { await supabaseClient.from('service_songs').delete().in('service_id', serviceIds); } catch(e) {}
                try { await supabaseClient.from('service_volunteers').delete().in('service_id', serviceIds); } catch(e) {}
                try { await supabaseClient.from('availability_comments').delete().in('service_id', serviceIds); } catch(e) {}
                try { await supabaseClient.from('service_suggestions').delete().in('service_id', serviceIds); } catch(e) {}
                await supabaseClient.from('services').delete().eq('church_id', churchId);
            }

            // C. Músicas e Versões
            const { data: musicas } = await supabaseClient.from('songs').select('id').eq('church_id', churchId);
            if (musicas && musicas.length > 0) {
                const songIds = musicas.map(m => m.id);
                try { await supabaseClient.from('song_versions').delete().in('song_id', songIds); } catch(e) {}
                try { await supabaseClient.from('song_change_requests').delete().in('song_id', songIds); } catch(e) {}
                await supabaseClient.from('songs').delete().eq('church_id', churchId);
            }

            // D. Ministérios e Roles
            const { data: ministerios } = await supabaseClient.from('ministries').select('id').eq('church_id', churchId);
            if (ministerios && ministerios.length > 0) {
                const minIds = ministerios.map(m => m.id);
                try { await supabaseClient.from('user_ministry_roles').delete().in('ministry_id', minIds); } catch(e) {}
                await supabaseClient.from('ministries').delete().eq('church_id', churchId);
            }

            // E. Desvincular Perfis
            try {
                await supabaseClient.from('profiles').update({ church_id: null }).eq('church_id', churchId);
            } catch(e) {}

            // F. Excluir a Igreja com verificação de linhas afetadas
            const { data: deletedRows, error: errChurch } = await supabaseClient.from('churches').delete().eq('id', churchId).select();
            if (errChurch) throw errChurch;
            if (deletedRows && deletedRows.length > 0) {
                excluiuComSucesso = true;
            }
        }

        fecharModalExcluirIgreja();
        if (typeof mostrarToast === 'function') {
            mostrarToast(`🗑️ Igreja "${churchName}" e todos os seus registros foram excluídos!`, 'sucesso');
        } else {
            alert(`Igreja "${churchName}" excluída com sucesso!`);
        }

        await renderizarAdminListaIgrejas();

    } catch (err) {
        console.error("Erro ao excluir igreja:", err);
        if (typeof mostrarToast === 'function') {
            mostrarToast(`Erro ao excluir igreja: ${err.message || 'Falha no banco.'}`, 'erro');
        } else {
            alert('Erro ao excluir igreja: ' + err.message);
        }
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<span>🗑️</span> Excluir Definitivamente';
        }
    }
}

function abrirModalEditarIgrejaAdmin(churchId) {
    if (!churchId) return;
    const church = listaIgrejasAdminCache.find(c => c.id === churchId);
    if (!church) return;

    const inputId = document.getElementById('edit-igreja-id');
    const inputNome = document.getElementById('edit-igreja-nome');
    const inputWhatsapp = document.getElementById('edit-igreja-whatsapp');
    const inputValor = document.getElementById('edit-igreja-valor');
    const inputCota = document.getElementById('edit-igreja-cota');
    const selectStatus = document.getElementById('edit-igreja-status');

    if (inputId) inputId.value = church.id;
    if (inputNome) inputNome.value = church.name || '';
    if (inputWhatsapp) inputWhatsapp.value = church.leader_whatsapp || '';
    if (inputValor) inputValor.value = church.agreed_payment || '';
    if (inputCota) inputCota.value = church.storage_limit_mb ?? 1024;
    if (selectStatus) selectStatus.value = church.status || 'pending';

    const modal = document.getElementById('modal-editar-igreja-admin');
    if (modal) modal.classList.remove('hidden');
}

function fecharModalEditarIgrejaAdmin() {
    const modal = document.getElementById('modal-editar-igreja-admin');
    if (modal) modal.classList.add('hidden');
}

async function salvarEdicaoIgrejaAdmin(e) {
    if (e) e.preventDefault();

    const churchId = document.getElementById('edit-igreja-id')?.value;
    const nome = document.getElementById('edit-igreja-nome')?.value?.trim();
    const whatsapp = document.getElementById('edit-igreja-whatsapp')?.value?.trim();
    const valor = document.getElementById('edit-igreja-valor')?.value?.trim();
    const cota = parseInt(document.getElementById('edit-igreja-cota')?.value, 10);
    const status = document.getElementById('edit-igreja-status')?.value;
    const btn = document.getElementById('btn-salvar-edit-igreja');

    if (!churchId || !nome) {
        if (typeof mostrarToast === 'function') mostrarToast('Por favor, informe o nome da igreja.', 'aviso');
        else alert('Por favor, informe o nome da igreja.');
        return;
    }

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span class="animate-spin inline-block mr-1">⏳</span> Salvando...';
    }

    try {
        if (!supabaseClient) throw new Error("Cliente Supabase não inicializado.");

        const payload = {
            name: nome,
            leader_whatsapp: whatsapp || null,
            agreed_payment: valor || null,
            storage_limit_mb: isNaN(cota) ? 1024 : cota,
            status: status || 'pending'
        };

        const { error } = await supabaseClient
            .from('churches')
            .update(payload)
            .eq('id', churchId);

        if (error) throw error;

        fecharModalEditarIgrejaAdmin();
        if (typeof mostrarToast === 'function') {
            mostrarToast(`✅ Dados da igreja "${nome}" atualizados com sucesso!`, 'sucesso');
        } else {
            alert(`Dados da igreja "${nome}" atualizados com sucesso!`);
        }

        await renderizarAdminListaIgrejas();

    } catch (err) {
        console.error("Erro ao editar dados da igreja:", err);
        if (typeof mostrarToast === 'function') {
            mostrarToast(`Erro ao atualizar dados: ${err.message || 'Falha no banco.'}`, 'erro');
        } else {
            alert('Erro ao atualizar dados: ' + err.message);
        }
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '💾 Salvar Alterações';
        }
    }
}

window.alterarStatusIgreja = alterarStatusIgreja;
window.salvarCotaIgreja = salvarCotaIgreja;
window.renderizarAdminListaIgrejas = renderizarAdminListaIgrejas;
window.abrirModalExcluirIgreja = abrirModalExcluirIgreja;
window.validarTextoConfirmacaoExclusao = validarTextoConfirmacaoExclusao;
window.fecharModalExcluirIgreja = fecharModalExcluirIgreja;
window.executarExclusaoIgrejaDefinitiva = executarExclusaoIgrejaDefinitiva;
window.abrirModalEditarIgrejaAdmin = abrirModalEditarIgrejaAdmin;
window.fecharModalEditarIgrejaAdmin = fecharModalEditarIgrejaAdmin;
window.salvarEdicaoIgrejaAdmin = salvarEdicaoIgrejaAdmin;
window.excluirIntegranteMinisterioAdmin = excluirIntegranteMinisterioAdmin;
window.excluirMinisterioAdmin = excluirMinisterioAdmin;
window.excluirFuncaoMinisterioAdmin = excluirFuncaoMinisterioAdmin;
window.selecionarCategoriaSolicitacoes = selecionarCategoriaSolicitacoes;
window.filtrarSubAbaSolicitacoes = filtrarSubAbaSolicitacoes;
window.selecionarMesSolicitacoes = selecionarMesSolicitacoes;
window.filtrarListaSolicitacoesInput = filtrarListaSolicitacoesInput;
window.renderizarAdminListaSolicitacoes = renderizarAdminListaSolicitacoes;
window.alterarStatusSolicitacaoAdmin = alterarStatusSolicitacaoAdmin;
window.excluirSolicitacaoAdmin = excluirSolicitacaoAdmin;
window.abrirModalAprovarTomAdmin = abrirModalAprovarTomAdmin;
window.fecharModalAprovarTomAdmin = fecharModalAprovarTomAdmin;
window.atualizarVersoesSelectAprovarTom = atualizarVersoesSelectAprovarTom;
window.alternarModoAprovacaoTom = alternarModoAprovacaoTom;
window.confirmarAprovacaoTomAdmin = confirmarAprovacaoTomAdmin;

// ===================== ASSISTENTE DE ONBOARDING INICIAL =====================

let onboardingCurrentStep = 1;

function abrirModalOnboardingWizard() {
    const modal = document.getElementById('modal-onboarding-wizard');
    if (!modal) return;

    const churchNameEl = document.getElementById('onboarding-church-name');
    if (churchNameEl) {
        churchNameEl.textContent = dadosGlobais.church?.name || 'Sua Igreja';
    }

    onboardingCurrentStep = 1;
    modal.classList.remove('hidden');
    renderizarOnboardingStep(1);
}
window.abrirModalOnboardingWizard = abrirModalOnboardingWizard;

function fecharModalOnboardingWizard() {
    const modal = document.getElementById('modal-onboarding-wizard');
    if (modal) modal.classList.add('hidden');
}
window.fecharModalOnboardingWizard = fecharModalOnboardingWizard;

async function navegarOnboardingStep(delta) {
    if (delta > 0 && onboardingCurrentStep === 4) {
        await concluirOnboardingWizard();
        return;
    }

    const nextStep = onboardingCurrentStep + delta;
    if (nextStep >= 1 && nextStep <= 4) {
        onboardingCurrentStep = nextStep;
        renderizarOnboardingStep(nextStep);
    }
}
window.navegarOnboardingStep = navegarOnboardingStep;

async function renderizarOnboardingStep(step) {
    // 1. Atualizar Stepper UI
    for (let i = 1; i <= 4; i++) {
        const indicator = document.getElementById(`onboarding-step-indicator-${i}`);
        const content = document.getElementById(`onboarding-step-content-${i}`);

        if (content) {
            content.classList.toggle('hidden', i !== step);
        }

        if (indicator) {
            if (i === step) {
                indicator.className = 'p-2 rounded-xl border border-brand-500 bg-brand-500/20 text-brand-300 font-bold transition flex flex-col items-center gap-1';
            } else if (i < step) {
                indicator.className = 'p-2 rounded-xl border border-emerald-600/60 bg-emerald-950/30 text-emerald-400 transition flex flex-col items-center gap-1';
            } else {
                indicator.className = 'p-2 rounded-xl border border-slate-800 bg-slate-900/60 text-slate-500 transition flex flex-col items-center gap-1';
            }
        }
    }

    // 2. Atualizar Botões de Navegação
    const btnVoltar = document.getElementById('btn-onboarding-voltar');
    const btnAvancar = document.getElementById('btn-onboarding-avancar');

    if (btnVoltar) {
        btnVoltar.disabled = step === 1;
        btnVoltar.className = step === 1 
            ? 'bg-slate-800 text-slate-600 px-4 py-2 rounded-xl text-xs font-semibold cursor-not-allowed transition'
            : 'bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer';
    }

    if (btnAvancar) {
        if (step === 4) {
            btnAvancar.innerHTML = '<span>✨ Concluir Configuração</span>';
            btnAvancar.className = 'bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2.5 rounded-xl text-xs font-bold shadow-lg shadow-emerald-900/30 transition flex items-center gap-1.5 cursor-pointer';
        } else {
            btnAvancar.innerHTML = '<span>Avançar</span> →';
            btnAvancar.className = 'bg-brand-600 hover:bg-brand-500 text-white px-6 py-2.5 rounded-xl text-xs font-bold shadow-lg shadow-brand-900/30 transition flex items-center gap-1.5 cursor-pointer';
        }
    }

    const churchId = dadosGlobais.church?.id || usuarioLogado?.church_id;

    // 3. Renderizar Conteúdo Específico de cada Passo
    if (step === 1) {
        // Passo 1: Ministérios e Funções
        const containerMin = document.getElementById('onboarding-lista-ministerios');
        if (!containerMin) return;

        let ministries = dadosGlobais.ministries || [];
        if (supabaseClient && churchId) {
            const { data } = await supabaseClient.from('ministries').select('*, ministry_roles(*)').eq('church_id', churchId).order('name');
            if (data) {
                ministries = data;
                dadosGlobais.ministries = data;
            }
        }

        if (ministries.length === 0) {
            containerMin.innerHTML = '<div class="text-center py-6 text-slate-500 bg-slate-950/40 rounded-2xl border border-slate-800">Nenhum ministério encontrado. Clique em "+ Novo Ministério" para adicionar.</div>';
            return;
        }

        containerMin.innerHTML = ministries.map(min => {
            const roles = min.ministry_roles || [];
            const rolesBadges = roles.map(r => {
                const isSong = r.scale_scope === 'song' || (r.name && (r.name.toLowerCase().includes('cantor') || r.name.toLowerCase().includes('vocal')));
                return `<span class="bg-slate-900 border border-slate-700/80 text-slate-300 text-[10px] px-2 py-0.5 rounded-full inline-flex items-center gap-1 font-medium">
                    ${r.name}
                    ${isSong ? '<span class="text-purple-300 font-bold">🎵 Por Música</span>' : '<span class="text-indigo-300 font-bold">⛪ Culto</span>'}
                    <button onclick='abrirModalFuncaoAdmin(\"${min.id}\", ${JSON.stringify(r).replace(/'/g, "&apos;")})' class="text-slate-400 hover:text-white font-bold text-[10px] ml-0.5" title="Editar Função">✏️</button>
                    <button onclick="excluirFuncaoMinisterioAdmin('${r.id}')" class="text-red-400 hover:text-red-300 font-bold text-[10px] ml-0.5" title="Excluir Função">✕</button>
                </span>`;
            }).join('');

            const mediaUploadBadge = min.can_upload_media 
                ? '<span class="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800 px-2 py-0.5 rounded-full font-semibold">📁 Upload de Mídias Ativo</span>'
                : '<span class="text-[10px] bg-slate-800 text-slate-500 px-2 py-0.5 rounded-full">Sem Upload de Mídias</span>';

            return `
                <div class="bg-slate-950/70 border border-slate-800 rounded-2xl p-3.5 flex flex-col gap-2">
                    <div class="flex items-center justify-between gap-2">
                        <div class="flex items-center gap-2">
                            <span class="text-lg p-1.5 bg-slate-900 rounded-lg border border-slate-800">${min.icon || '🏢'}</span>
                            <span class="font-bold text-sm text-white">${min.name}</span>
                            ${mediaUploadBadge}
                        </div>
                        <div class="flex items-center gap-1.5">
                            <button onclick="abrirModalFuncaoAdmin('${min.id}')" class="text-xs text-brand-400 hover:text-brand-300 font-medium px-2 py-1 rounded bg-slate-900/80 border border-brand-500/30">+ Função</button>
                            <button onclick='abrirModalMinisterioAdmin(${JSON.stringify(min).replace(/'/g, "&apos;")})' class="text-slate-400 hover:text-white text-xs px-2 py-1 rounded bg-slate-800/80 border border-slate-700">✏️ Editar</button>
                            <button onclick="excluirMinisterioAdmin('${min.id}')" class="text-red-400 hover:text-red-300 text-xs px-1.5 py-1 rounded bg-slate-800/80 border border-slate-700" title="Excluir Ministério">🗑️</button>
                        </div>
                    </div>
                    <div class="flex items-center gap-1.5 flex-wrap pt-1 border-t border-slate-800/60">
                        <span class="text-[10px] text-slate-500 font-medium mr-1">Funções:</span>
                        ${rolesBadges || '<span class="text-[10px] text-slate-500 italic">Nenhuma função ainda. Clique em "+ Função" acima.</span>'}
                    </div>
                </div>
            `;
        }).join('');

    } else if (step === 2) {
        // Passo 2: Permissões Públicas e Ministérios
        const gridPublic = document.getElementById('onboarding-grid-permissoes-publicas');
        if (gridPublic) {
            const defaultPermissions = {
                ver_escala: false,
                ver_letra: true,
                ver_cifra: false,
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

            const labels = {
                ver_escala: '📅 Ver Escala de Voluntários',
                ver_letra: '📜 Ver Botão e Texto da Letra',
                ver_cifra: '🎸 Ver Botão e Texto da Cifra',
                ver_vs: '▶ Ver e Ouvir Áudio / VS',
                ver_youtube: '📺 Ver Botão do YouTube',
                ver_cantor: '🎤 Ver Vocalistas Escalados',
                ver_midia: '🖼️ Ver Mídias de Projeção',
                enviar_solic_musica: '💬 Pedir Ajuste de Tom',
                enviar_sugestao_culto: '💡 Sugerir Música no Culto',
                ver_repertorio: '🎼 Acessar Aba Repertório',
                ver_musicas_novas: '🌟 Acessar Aba Músicas Novas',
                ver_aba_midias_upadas: '📥 Acessar Aba Mídias Upadas',
                ver_agenda: '📅 Acessar Aba Agenda & Eventos',
                gerar_script_holyrics: '📋 Exportar Holyrics',
                ver_almoxarifado: '📦 Ver Almoxarifado'
            };

            let churchPerms = dadosGlobais.church?.public_permissions || {};
            if (typeof churchPerms === 'string') {
                try { churchPerms = JSON.parse(churchPerms); } catch(e){}
            }

            gridPublic.innerHTML = Object.keys(defaultPermissions).map(key => {
                const checked = typeof churchPerms[key] !== 'undefined' ? !!churchPerms[key] : !!defaultPermissions[key];
                return `
                    <label class="flex items-center gap-2 p-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 cursor-pointer select-none">
                        <input type="checkbox" id="onboarding-pub-${key}" onchange="salvarPermissaoPublicaOnboarding('${key}', this.checked)" ${checked ? 'checked' : ''} class="accent-brand-500 rounded">
                        <span>${labels[key] || key}</span>
                    </label>
                `;
            }).join('');
        }

    } else if (step === 3) {
        // Passo 3: Equipe Inicial
        const selectMinMembro = document.getElementById('onboarding-membro-ministerio');
        if (selectMinMembro) {
            let opts = '<option value="">Selecione o ministério principal...</option>';
            (dadosGlobais.ministries || []).forEach(m => {
                opts += `<option value="${m.id}">${m.icon || '🏢'} ${m.name}</option>`;
            });
            selectMinMembro.innerHTML = opts;
        }

        renderizarMembrosOnboarding();

    } else if (step === 4) {
        // Passo 4: Mídias por Ministério
        const containerMidias = document.getElementById('onboarding-lista-midias-permissoes');
        if (!containerMidias) return;

        const ministries = dadosGlobais.ministries || [];
        if (ministries.length === 0) {
            containerMidias.innerHTML = '<p class="text-xs text-slate-500">Nenhum ministério cadastrado.</p>';
            return;
        }

        containerMidias.innerHTML = ministries.map(min => {
            const isChecked = min.can_upload_media === true;
            return `
                <div class="flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-slate-800">
                    <div class="flex items-center gap-2.5">
                        <span class="text-lg">${min.icon || '🏢'}</span>
                        <div>
                            <span class="text-xs font-bold text-white block">${min.name}</span>
                            <span class="text-[10px] text-slate-400 block">${min.description || 'Equipe interna'}</span>
                        </div>
                    </div>
                    <label class="flex items-center gap-2 cursor-pointer select-none">
                        <input type="checkbox" onchange="alternarUploadMidiaMinisterioOnboarding('${min.id}', this.checked)" ${isChecked ? 'checked' : ''} class="w-4 h-4 accent-brand-500 rounded">
                        <span class="text-xs text-slate-300 font-medium">Permitir Upload</span>
                    </label>
                </div>
            `;
        }).join('');
    }
}

async function alternarUploadMidiaMinisterioOnboarding(minId, checked) {
    try {
        if (!supabaseClient) return;
        await supabaseClient.from('ministries').update({ can_upload_media: checked }).eq('id', minId);
        const target = (dadosGlobais.ministries || []).find(m => m.id === minId);
        if (target) target.can_upload_media = checked;
        if (typeof mostrarToast === 'function') {
            mostrarToast(checked ? 'Upload de mídias liberado para o ministério!' : 'Upload de mídias desativado para o ministério.', 'sucesso');
        }
    } catch(e) {
        console.error('Erro ao atualizar can_upload_media:', e);
    }
}
window.alternarUploadMidiaMinisterioOnboarding = alternarUploadMidiaMinisterioOnboarding;

async function salvarPermissaoPublicaOnboarding(key, checked) {
    try {
        if (!supabaseClient) return;
        const churchId = dadosGlobais.church?.id || usuarioLogado?.church_id;
        if (!churchId) return;

        let pub = dadosGlobais.church?.public_permissions || {};
        if (typeof pub === 'string') {
            try { pub = JSON.parse(pub); } catch(e){ pub = {}; }
        }
        pub[key] = checked;

        await supabaseClient.from('churches').update({ public_permissions: pub }).eq('id', churchId);
        if (dadosGlobais.church) dadosGlobais.church.public_permissions = pub;
        if (typeof aplicarVisibilidadePermissoes === 'function') aplicarVisibilidadePermissoes();
    } catch(e) {
        console.error('Erro ao atualizar permissão pública:', e);
    }
}
window.salvarPermissaoPublicaOnboarding = salvarPermissaoPublicaOnboarding;

async function salvarMembroOnboarding() {
    const nome = document.getElementById('onboarding-membro-nome')?.value?.trim();
    const email = document.getElementById('onboarding-membro-email')?.value?.trim();
    const senha = document.getElementById('onboarding-membro-senha')?.value;
    const role = document.getElementById('onboarding-membro-role')?.value || 'voluntario';
    const ministryId = document.getElementById('onboarding-membro-ministerio')?.value || null;
    const btn = document.getElementById('btn-onboarding-salvar-membro');

    if (!nome || !email) {
        if (typeof mostrarToast === 'function') mostrarToast('Preencha nome e e-mail do membro.', 'aviso');
        return;
    }

    if (btn) { btn.disabled = true; btn.textContent = 'Adicionando...'; }

    try {
        if (!supabaseClient) throw new Error("Cliente Supabase não inicializado.");
        const churchId = dadosGlobais.church?.id || usuarioLogado?.church_id;

        let newUserId = null;
        if (senha && senha.length >= 6) {
            const { data: authRes, error: authErr } = await supabaseClient.auth.signUp({
                email,
                password: senha,
                options: { data: { full_name: nome, name: nome, church_id: churchId, role: role, system_role: role } }
            });
            if (!authErr && authRes && authRes.user) {
                newUserId = authRes.user.id;
            }
        }

        const profilePayload = {
            church_id: churchId,
            name: nome,
            email: email,
            role: role,
            system_role: role,
            ministry_id: ministryId || null
        };
        if (newUserId) profilePayload.id = newUserId;

        const { error: profErr } = await supabaseClient.from('profiles').insert([profilePayload]);
        if (profErr) throw profErr;

        // Limpar campos
        document.getElementById('onboarding-membro-nome').value = '';
        document.getElementById('onboarding-membro-email').value = '';
        document.getElementById('onboarding-membro-senha').value = '';

        if (typeof mostrarToast === 'function') mostrarToast('Integrante adicionado com sucesso!', 'sucesso');
        await renderizarMembrosOnboarding();

    } catch(err) {
        console.error("Erro ao salvar membro no onboarding:", err);
        if (typeof mostrarToast === 'function') mostrarToast(`Erro: ${err.message}`, 'erro');
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = '+ Adicionar Membro à Lista'; }
    }
}
window.salvarMembroOnboarding = salvarMembroOnboarding;

async function renderizarMembrosOnboarding() {
    const listEl = document.getElementById('onboarding-lista-membros');
    if (!listEl) return;

    const churchId = dadosGlobais.church?.id || usuarioLogado?.church_id;
    if (!churchId || !supabaseClient) return;

    const { data: profiles } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('church_id', churchId)
        .order('created_at', { ascending: false });

    if (!profiles || profiles.length === 0) {
        listEl.innerHTML = '<p class="text-slate-500 text-xs text-center py-4">Nenhum integrante adicionado ainda.</p>';
        return;
    }

    listEl.innerHTML = profiles.map(p => {
        const minObj = (dadosGlobais.ministries || []).find(m => m.id === p.ministry_id);
        return `
            <div class="flex items-center justify-between p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs">
                <div class="truncate">
                    <span class="font-bold text-white block truncate">${p.name}</span>
                    <span class="text-[10px] text-slate-400 block truncate">${p.email || 'Sem e-mail'} • ${minObj ? minObj.name : 'Sem ministério'}</span>
                </div>
                <span class="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 uppercase font-semibold border border-slate-700 shrink-0">${p.system_role || p.role || 'voluntario'}</span>
            </div>
        `;
    }).join('');
}

async function concluirOnboardingWizard() {
    const churchId = dadosGlobais.church?.id || usuarioLogado?.church_id;
    if (!churchId || !supabaseClient) return;

    try {
        const { error } = await supabaseClient
            .from('churches')
            .update({ onboarding_completed: true })
            .eq('id', churchId);

        if (error) throw error;

        if (dadosGlobais.church) {
            dadosGlobais.church.onboarding_completed = true;
        }

        fecharModalOnboardingWizard();
        if (typeof mostrarToast === 'function') {
            mostrarToast('🎉 Configuração inicial concluída com sucesso! Bem-vindo(a) ao sistema.', 'sucesso');
        }

        if (typeof carregarDados === 'function') {
            await carregarDados();
        }
    } catch(e) {
        console.error("Erro ao concluir onboarding:", e);
        if (typeof mostrarToast === 'function') mostrarToast(`Erro ao concluir onboarding: ${e.message}`, 'erro');
    }
}
window.concluirOnboardingWizard = concluirOnboardingWizard;



