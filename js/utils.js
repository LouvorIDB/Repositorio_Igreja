// Retorna lista de nomes que têm o instrumento na coluna C
function cantoresPorInstrumento(instrumento) {
    return dadosGlobais.cantores.slice(1)
        .filter(row => {
            const instrumentos = (row[2] || '').toString().split(',').map(s => s.trim().toLowerCase());
            return instrumentos.includes(instrumento.toLowerCase());
        })
        .map(row => row[0] ? row[0].toString().trim() : '')
        .filter(Boolean);
}

// Popula um <select> com a lista de nomes, mantendo o valor selecionado
function popularSelect(idSelect, nomes, valorAtual) {
    const sel = document.getElementById(idSelect);
    sel.innerHTML = '<option value="">— Nenhum —</option>';
    nomes.forEach(nome => {
        const opt = document.createElement('option');
        opt.value = nome;
        opt.textContent = nome;
        if (nome === valorAtual) opt.selected = true;
        sel.appendChild(opt);
    });
}

function extrairIdDrive(url) {
    if (!url) return '';
    const m1 = url.match(/\/d\/([a-zA-Z0-9_-]+)/); if (m1) return m1[1];
    const m2 = url.match(/[?&]id=([a-zA-Z0-9_-]+)/); if (m2) return m2[1];
    return '';
}

function extrairIdYoutube(url) {
    if (!url) return '';
    const m1 = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/); if (m1) return m1[1];
    const m2 = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/); if (m2) return m2[1];
    return '';
}

function obterLinkYoutube(ytDado, nomeMusica) {
    if (!ytDado) return '';
    if (ytDado.startsWith('http')) return ytDado;
    return `https://www.youtube.com/results?search_query=${encodeURIComponent(ytDado || nomeMusica)}`;
}

function mostrarToast(mensagem, tipo = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'fixed top-5 right-5 z-[200] flex flex-col gap-2 pointer-events-none max-w-sm w-full px-4 sm:px-0';
        document.body.appendChild(container);
    }

    const cores = {
        sucesso: 'bg-emerald-600 border-emerald-500 text-white',
        erro: 'bg-red-600 border-red-500 text-white',
        aviso: 'bg-amber-600 border-amber-500 text-white',
        info: 'bg-slate-800 border-slate-700 text-slate-100 shadow-xl'
    };

    const corClasse = cores[tipo] || cores.info;
    const toast = document.createElement('div');
    toast.className = `pointer-events-auto flex items-center justify-between px-4 py-3 rounded-xl border shadow-2xl transition-all duration-300 transform -translate-y-2 opacity-0 text-sm font-medium ${corClasse}`;

    toast.innerHTML = `
        <span class="flex-1 mr-2">${mensagem}</span>
        <button onclick="this.parentElement.remove()" class="text-white/70 hover:text-white text-base leading-none font-bold">&times;</button>
    `;

    container.appendChild(toast);

    requestAnimationFrame(() => {
        toast.classList.remove('-translate-y-2', 'opacity-0');
        toast.classList.add('translate-y-0', 'opacity-100');
    });

    setTimeout(() => {
        toast.classList.remove('translate-y-0', 'opacity-100');
        toast.classList.add('-translate-y-2', 'opacity-0');
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}
