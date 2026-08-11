// ===================== ADMIN: LOGIN =====================

window.addEventListener('DOMContentLoaded', () => {
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
    const senha = inputSenha.value.trim();

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
        const response = await fetch(WEB_APP_URL, {
            method: 'POST',
            body: JSON.stringify({ acao: 'validarSenha', senha })
        });
        const resData = await response.json();

        if (resData && resData.autorizado === true) {
            isAdmin = true;
            fecharModalAdmin();
            abrirPainelAdmin();
        } else {
            erroSenha.textContent = 'Senha incorreta.';
            erroSenha.classList.remove('hidden');
        }
    } catch (error) {
        console.error('Erro ao validar senha:', error);
        erroSenha.textContent = 'Senha incorreta.';
        erroSenha.classList.remove('hidden');
    } finally {
        if (btnEntrar) {
            btnEntrar.textContent = textoOriginalBtn;
            btnEntrar.disabled = false;
        }
    }
}

function sairAdmin() {
    isAdmin = false;
    document.getElementById('painel-admin').classList.add('hidden');
}

// ===================== ADMIN: PAINEL =====================

function abrirPainelAdmin() {
    document.getElementById('painel-admin').classList.remove('hidden');
    renderizarAdminListaCultos();
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

    blocos.forEach((bloco) => {
        const emMontagem = bloco.titulo.toUpperCase().includes('EM MONTAGEM');
        const oculto = bloco.titulo.toUpperCase().includes('OCULTO');
        const cor = oculto ? 'border-slate-700 bg-slate-800/30 opacity-60'
            : (emMontagem ? 'border-red-700/50 bg-red-900/20' : 'border-slate-700 bg-slate-800/60');
        const corTexto = oculto ? 'text-slate-400' : (emMontagem ? 'text-red-300' : 'text-emerald-300');
        const tituloExibicao = bloco.titulo.replace(/ - OCULTO/i, '').trim();
        html += `
            <div class="flex items-center justify-between px-4 py-3 rounded-xl border ${cor} gap-3">
                <span class="text-sm font-semibold ${corTexto} uppercase">${tituloExibicao}${oculto ? ' 🙈' : ''}</span>
                <div class="flex gap-2 shrink-0">
                    <button onclick="toggleOcultoCulto(${bloco.startIndex})" class="bg-slate-700 hover:bg-slate-600 text-slate-200 px-3 py-1.5 rounded-lg text-xs transition">${oculto ? '👁️ Mostrar' : '🙈 Ocultar'}</button>
                    <button onclick="editarCulto(${bloco.startIndex})" class="bg-slate-700 hover:bg-emerald-700 text-slate-200 hover:text-white px-3 py-1.5 rounded-lg text-xs transition">✏️ Editar</button>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

async function toggleOcultoCulto(startIndex) {
    try {
        const response = await fetch(WEB_APP_URL, {
            method: 'POST',
            body: JSON.stringify({ acao: 'toggleOculto', startIndex })
        });
        const resData = await response.json();
        if (resData && resData.status === 'sucesso') {
            limparCacheLocal();
            await carregarDados();
        } else {
            mostrarToast((resData && resData.message) ? resData.message : 'Erro ao alternar a visibilidade do culto.', 'erro');
        }
    } catch (err) {
        console.error('Erro ao alternar visibilidade:', err);
        mostrarToast('Erro ao alternar a visibilidade do culto.', 'erro');
    }
}
