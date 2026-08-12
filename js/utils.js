function removerAcentos(str) {
    return (str || '').toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

// Retorna lista de nomes que têm o instrumento na coluna C
function cantoresPorInstrumento(instrumento) {
    const termoBuscado = removerAcentos(instrumento);
    return dadosGlobais.cantores.slice(1)
        .filter(row => {
            const lista = removerAcentos(row[2] || '').split(',').map(s => s.trim());
            return lista.some(inst => inst.includes(termoBuscado) || termoBuscado.includes(inst));
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
    const firstLink = ytDado.split(/[\n,]+/)[0].trim();
    if (firstLink.startsWith('http')) return firstLink;
    return `https://www.youtube.com/results?search_query=${encodeURIComponent(firstLink || nomeMusica)}`;
}

function obterLinksYoutubeArray(ytDado, nomeMusica) {
    if (!ytDado) return [];
    const rawLinks = ytDado.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
    return rawLinks.map((link, idx) => {
        let finalUrl = link;
        if (!link.startsWith('http')) {
            finalUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(link || nomeMusica)}`;
        }
        return {
            url: finalUrl,
            label: rawLinks.length > 1 ? `📺 YouTube (${idx + 1})` : `📺 YouTube`
        };
    });
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

// ===================== MODAL DE LETRA PÚBLICA / GLOBAL =====================

function abrirModalLetraPublica(titulo, subtitulo, lyricsEncoded) {
    const tituloEl = document.getElementById('letra-publica-titulo');
    const subtituloEl = document.getElementById('letra-publica-subtitulo');
    const conteudoEl = document.getElementById('letra-publica-conteudo');

    if (tituloEl) tituloEl.textContent = titulo || 'Letra da Música';
    if (subtituloEl) subtituloEl.textContent = subtitulo || '';
    
    let lyricsText = '';
    try {
        lyricsText = decodeURIComponent(lyricsEncoded || '');
    } catch(e) {
        lyricsText = lyricsEncoded || '';
    }

    if (conteudoEl) {
        conteudoEl.textContent = lyricsText || 'Letra não disponível.';
    }

    const modal = document.getElementById('modal-letra-publica');
    if (modal) modal.classList.remove('hidden');
}

function fecharModalLetraPublica() {
    const modal = document.getElementById('modal-letra-publica');
    if (modal) modal.classList.add('hidden');
}

window.abrirModalLetraPublica = abrirModalLetraPublica;
window.fecharModalLetraPublica = fecharModalLetraPublica;

// ===================== TRANSPOSITOR DE CIFRAS =====================

const NOTAS_SEMITONS_MAP = {
    'C': 0, 'C#': 1, 'DB': 1,
    'D': 2, 'D#': 3, 'EB': 3,
    'E': 4, 'FB': 4, 'E#': 5,
    'F': 5, 'F#': 6, 'GB': 6,
    'G': 7, 'G#': 8, 'AB': 8,
    'A': 9, 'A#': 10, 'BB': 10,
    'B': 11, 'CB': 11, 'B#': 0
};

const ESCALA_NOTAS_SUSTENIDOS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const ESCALA_NOTAS_BEMOIS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

function extrairNotaRaiz(tomStr) {
    if (!tomStr) return null;
    const match = tomStr.trim().match(/^([A-G][#b]?)/i);
    return match ? match[1].toUpperCase() : null;
}

function transporNotaIndividual(acorde, diferenca, escalaAlvo) {
    if (!acorde) return '';
    const match = acorde.match(/^([A-G][#b]?)(.*)$/i);
    if (!match) return acorde;

    const notaBase = match[1].toUpperCase();
    const sufixo = match[2] || '';

    const semitomAtual = NOTAS_SEMITONS_MAP[notaBase];
    if (semitomAtual === undefined) return acorde;

    const novoSemitom = (semitomAtual + diferenca + 12) % 12;
    const novaNota = escalaAlvo[novoSemitom];

    return novaNota + sufixo;
}

function transporAcorde(acordeStr, diferenca, escalaAlvo) {
    if (!acordeStr) return '';
    if (acordeStr.includes('/')) {
        const partes = acordeStr.split('/');
        return partes.map(p => transporNotaIndividual(p.trim(), diferenca, escalaAlvo)).join('/');
    }
    return transporNotaIndividual(acordeStr.trim(), diferenca, escalaAlvo);
}

function transporCifra(textoCifra, tomOrigem, tomDestino) {
    if (!textoCifra || typeof textoCifra !== 'string') return textoCifra || '';
    if (!tomOrigem || !tomDestino) return textoCifra;

    const raizOrigem = extrairNotaRaiz(tomOrigem);
    const raizDestino = extrairNotaRaiz(tomDestino);

    if (!raizOrigem || !raizDestino) return textoCifra;

    const semitomOrigem = NOTAS_SEMITONS_MAP[raizOrigem];
    const semitomDestino = NOTAS_SEMITONS_MAP[raizDestino];

    if (semitomOrigem === undefined || semitomDestino === undefined) return textoCifra;

    const diferenca = (semitomDestino - semitomOrigem + 12) % 12;
    if (diferenca === 0) return textoCifra;

    const usarBemois = /b/i.test(tomDestino) || tomDestino.trim().toUpperCase() === 'F';
    const escalaAlvo = usarBemois ? ESCALA_NOTAS_BEMOIS : ESCALA_NOTAS_SUSTENIDOS;

    return textoCifra.replace(/\[([^\]]+)\]/g, (match, acordeInterno) => {
        const acordeTransposto = transporAcorde(acordeInterno, diferenca, escalaAlvo);
        return `[${acordeTransposto}]`;
    });
}

window.transporCifra = transporCifra;

// ===================== MODAL DE CIFRA PÚBLICA / GLOBAL =====================

let stateCifraPublica = {
    titulo: '',
    tomOriginal: 'C',
    tomAtual: 'C',
    cifraBruta: ''
};

function abrirModalCifraPublica(titulo, tomOriginal, chordsEncoded) {
    let chordsText = '';
    try {
        chordsText = decodeURIComponent(chordsEncoded || '');
    } catch(e) {
        chordsText = chordsEncoded || '';
    }

    const tomInicial = tomOriginal || 'C';

    stateCifraPublica = {
        titulo: titulo || 'Cifra da Música',
        tomOriginal: tomInicial,
        tomAtual: tomInicial,
        cifraBruta: chordsText
    };

    const tituloEl = document.getElementById('cifra-publica-titulo');
    if (tituloEl) tituloEl.textContent = stateCifraPublica.titulo;

    renderizarCifraPublica();

    const modal = document.getElementById('modal-cifra-publica');
    if (modal) modal.classList.remove('hidden');
}

function fecharModalCifraPublica() {
    const modal = document.getElementById('modal-cifra-publica');
    if (modal) modal.classList.add('hidden');
}

function alterarTomCifraPublica(semitones) {
    if (!stateCifraPublica.tomAtual) return;

    const raizAtual = extrairNotaRaiz(stateCifraPublica.tomAtual);
    if (!raizAtual) return;

    const semitomAtual = NOTAS_SEMITONS_MAP[raizAtual];
    if (semitomAtual === undefined) return;

    const novoSemitom = (semitomAtual + semitones + 12) % 12;
    const usarBemois = /b/i.test(stateCifraPublica.tomAtual) || stateCifraPublica.tomAtual.trim().toUpperCase() === 'F';
    const escalaAlvo = usarBemois ? ESCALA_NOTAS_BEMOIS : ESCALA_NOTAS_SUSTENIDOS;
    const novaRaiz = escalaAlvo[novoSemitom];

    const sufixoTom = stateCifraPublica.tomAtual.replace(/^([A-G][#b]?)/i, '');
    stateCifraPublica.tomAtual = novaRaiz + sufixoTom;

    renderizarCifraPublica();
}

function restaurarTomCifraPublica() {
    stateCifraPublica.tomAtual = stateCifraPublica.tomOriginal;
    renderizarCifraPublica();
}

function renderizarCifraPublica() {
    const subtituloEl = document.getElementById('cifra-publica-subtitulo');
    const conteudoEl = document.getElementById('cifra-publica-conteudo');

    if (subtituloEl) {
        subtituloEl.textContent = `Tom Original: ${stateCifraPublica.tomOriginal} | Tom Exibido: ${stateCifraPublica.tomAtual}`;
    }

    if (!conteudoEl) return;

    const cifraTransposta = transporCifra(
        stateCifraPublica.cifraBruta,
        stateCifraPublica.tomOriginal,
        stateCifraPublica.tomAtual
    );

    if (!cifraTransposta) {
        conteudoEl.innerHTML = '<p class="text-slate-400 text-sm">Cifra não disponível.</p>';
        return;
    }

    const linhas = cifraTransposta.split('\n');
    const htmlFormatado = linhas.map(linha => {
        const txt = linha;
        
        // Seções Cifra Club ex: [Intro], [Primeira Parte], [Refrão], [Ponte]
        if (/^\s*\[(Intro|Primeira Parte|Segunda Parte|Refrão|Ponte|Final|Solo|Interlúdio|Pré-Refrão)[^\]]*\]/i.test(txt)) {
            return `<div class="text-emerald-400 font-bold text-sm mt-4 mb-2 tracking-wide font-sans">${txt}</div>`;
        }

        // Linha com marcadores de acorde [C], [G/B]
        if (/\[([^\]]+)\]/.test(txt)) {
            const linhaTratada = txt.replace(/\[([^\]]+)\]/g, '<span class="text-amber-400 font-bold font-mono text-sm inline-block mr-1">[$1]</span>');
            return `<div class="py-0.5">${linhaTratada}</div>`;
        }

        // Linha de acordes soltos do Cifra Club
        const eLinhaDeAcordes = /^\s*([A-G][#b]?(m|maj|min|dim|aug|sus|[0-9])?(\/[A-G][#b]?)?\s*)+$/i.test(txt);
        if (eLinhaDeAcordes && txt.trim()) {
            return `<div class="text-amber-400 font-bold font-mono text-sm whitespace-pre">${txt}</div>`;
        }

        // Linha normal de letra
        return `<div class="text-slate-200 text-sm font-sans py-0.5 whitespace-pre-wrap">${txt}</div>`;
    }).join('');

    conteudoEl.innerHTML = `<div class="font-mono text-sm leading-relaxed space-y-1 select-text bg-slate-900/90 p-4 rounded-xl border border-slate-800">${htmlFormatado}</div>`;
}

window.abrirModalCifraPublica = abrirModalCifraPublica;
window.fecharModalCifraPublica = fecharModalCifraPublica;
window.alterarTomCifraPublica = alterarTomCifraPublica;
window.restaurarTomCifraPublica = restaurarTomCifraPublica;



