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
