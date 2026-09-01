// PROTEÇÃO GLOBAL CONTRA XSS VIA DOMPURIFY
if (typeof Element !== 'undefined' && Object.defineProperty) {
    const originalInnerHTML = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
    if (originalInnerHTML) {
        Object.defineProperty(Element.prototype, 'innerHTML', {
            set: function(value) {
                if (window.DOMPurify) {
                    value = window.DOMPurify.sanitize(value, {
                        ADD_ATTR: ['onclick', 'onsubmit', 'onchange', 'oninput', 'onkeyup', 'onkeydown', 'target', 'class', 'id', 'type', 'style', 'placeholder', 'value', 'for', 'disabled', 'checked', 'name', 'xmlns', 'viewBox', 'fill', 'd', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'required', 'minlength', 'maxlength', 'data-action'],
                        ADD_TAGS: ['iframe', 'svg', 'path', 'circle', 'rect', 'line', 'polygon', 'polyline', 'g', 'defs', 'clipPath']
                    });
                }
                originalInnerHTML.set.call(this, value);
            },
            get: function() {
                return originalInnerHTML.get.call(this);
            }
        });
    }
}

function sanitizarTextoCifraClub(texto) {
    if (!texto || typeof texto !== 'string') return texto || '';

    let limpo = texto
        .replace(/<[^>]*>/g, '')
        .replace(/["']?>([A-G][#b]?(m|maj|min|dim|aug|sus|[0-9])?(\/[A-G][#b]?)?)/gi, '$1')
        .replace(/^["']+/gm, '')
        .replace(/^\s*"+/gm, '');

    const rawLinhas = limpo.split('\n');
    const regexAcordeToken = /^([A-G][#b]?(m|maj|min|dim|aug|sus|[0-9])?(\/[A-G][#b]?)?)$/i;

    function isChordLine(l) {
        if (!l || !l.trim()) return false;
        if (/^\s*\[.*\]\s*$/.test(l)) return false;
        const tokens = l.trim().split(/\s+/);
        return tokens.every(tok => regexAcordeToken.test(tok));
    }

    const resultado = [];
    let i = 0;

    while (i < rawLinhas.length) {
        let curr = rawLinhas[i];

        if (!curr.trim() || /^\s*\[.*\]\s*$/.test(curr)) {
            resultado.push(curr.trim());
            i++;
            continue;
        }

        if (isChordLine(curr) && (i + 3 < rawLinhas.length)) {
            const chord1 = curr;
            const lyric1 = rawLinhas[i + 1];
            const chord2 = rawLinhas[i + 2];
            const lyric2 = rawLinhas[i + 3];

            if (isChordLine(chord2) && lyric1.trim() && lyric1.trim() === lyric2.trim()) {
                const padLength = Math.max(14, lyric1.indexOf('te') > 0 ? lyric1.indexOf('te') : 14);
                const chord1Padded = chord1.trim().padEnd(padLength, ' ');
                const mergedChordLine = chord1Padded + chord2.trim();

                resultado.push(mergedChordLine);
                resultado.push(lyric1);
                i += 4;
                continue;
            }
        }

        resultado.push(curr);
        i++;
    }

    const finalLines = [];
    for (let j = 0; j < resultado.length; j++) {
        const line = resultado[j];
        const last = finalLines.length > 0 ? finalLines[finalLines.length - 1] : null;
        if (line.trim() && last && line.trim() === last.trim() && !isChordLine(line)) {
            continue;
        }
        finalLines.push(line);
    }

    return finalLines.join('\n');
}
window.sanitizarTextoCifraClub = sanitizarTextoCifraClub;

function removerAcentos(str) {
    return (str || '').toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function obterIdsMinisteriosDoUsuario(user) {
    if (!user) return [];
    const minIds = new Set();
    if (user.ministry_id) minIds.add(user.ministry_id);

    const userUmr = user.user_ministry_roles || [];
    const userRoleIds = userUmr.map(ur => ur.ministry_role_id || ur.role_id).filter(Boolean);

    const ministries = window.dadosGlobais?.ministries || [];
    ministries.forEach(m => {
        if (m.id === user.ministry_id) minIds.add(m.id);
        const roles = m.ministry_roles || [];
        if (roles.some(r => userRoleIds.includes(r.id))) {
            minIds.add(m.id);
        }
    });

    userUmr.forEach(ur => {
        if (ur.ministry_id) minIds.add(ur.ministry_id);
        if (ur.ministry_roles && ur.ministry_roles.ministry_id) minIds.add(ur.ministry_roles.ministry_id);
    });

    if (user.lider_de && Array.isArray(user.lider_de)) {
        user.lider_de.forEach(id => minIds.add(id));
    }

    return Array.from(minIds);
}
window.obterIdsMinisteriosDoUsuario = obterIdsMinisteriosDoUsuario;

function obterIdsMinisteriosQueLidera(user) {
    if (!user) return [];
    if (Array.isArray(user.lider_de)) {
        return user.lider_de;
    }
    if (Array.isArray(user.ministry_leaders)) {
        return user.ministry_leaders.map(ml => ml.ministry_id || ml).filter(Boolean);
    }
    const roleStr = (user.system_role || user.role || '').toLowerCase();
    if (roleStr === 'lider' && user.ministry_id) {
        return [user.ministry_id];
    }
    return [];
}
window.obterIdsMinisteriosQueLidera = obterIdsMinisteriosQueLidera;

// Retorna lista de nomes que têm o instrumento na coluna C ou pertencem ao ministério especificado
function cantoresPorInstrumento(instrumento, ministryId = null) {
    if (!instrumento && !ministryId) {
        return [...new Set((dadosGlobais.voluntarios || []).map(v => (v.name || '').trim()).filter(Boolean))];
    }

    const termoBuscado = instrumento ? removerAcentos(instrumento) : '';
    const listaVoluntarios = dadosGlobais.voluntarios || [];

    const filtrados = listaVoluntarios.filter(v => {
        if (!v || !v.name) return false;

        // Se ministryId for informado, verifica se o voluntário possui o cargo associado àquele ministério
        if (ministryId && v.user_ministry_roles && Array.isArray(v.user_ministry_roles)) {
            const pertenceAoMin = v.user_ministry_roles.some(umr => umr.ministry_id === ministryId || (umr.ministry_roles && umr.ministry_roles.ministry_id === ministryId));
            if (!pertenceAoMin) return false;
        }

        if (!termoBuscado) return true;

        const rNames = v.roleNames || v.roles || v.instruments || [];
        const rStr = Array.isArray(rNames) ? rNames.join(',') : String(rNames || '');
        const normRoles = removerAcentos(rStr);

        // Verifica equivalências (ex: Cantor / Vocalista / Vocal)
        if (termoBuscado.includes('cantor') || termoBuscado.includes('vocal')) {
            return normRoles.includes('cantor') || normRoles.includes('vocal');
        }

        return normRoles.includes(termoBuscado);
    });

    const nomes = filtrados.map(v => (v.name || '').trim()).filter(Boolean);
    return [...new Set(nomes)];
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

function obterUrlAudioVs(url) {
    if (!url) return '';
    const str = url.toString().trim();
    const m1 = str.match(/\/d\/([a-zA-Z0-9_-]+)/); if (m1) return m1[1];
    const m2 = str.match(/[?&]id=([a-zA-Z0-9_-]+)/); if (m2) return m2[1];
    // Se for URL do Supabase Storage ou link HTTP direto, retorna a própria URL
    if (str.startsWith('http://') || str.startsWith('https://')) {
        return str;
    }
    return str;
}

// Alias de retrocompatibilidade
function extrairIdDrive(url) {
    return obterUrlAudioVs(url);
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

const REGEX_ACORDE_TOKEN = /^([A-G][#b]?(m|maj|min|dim|aug|sus|[0-9]|°|ø|\(|\)|b|\+|-)*(\/[A-G][#b]?)?)$/i;

function eLinhaDeAcordesCifraClub(linha) {
    if (!linha || !linha.trim()) return false;
    if (/^\s*\[(Intro|Primeira Parte|Segunda Parte|Refrão|Ponte|Final|Solo|Interlúdio|Pré-Refrão)[^\]]*\]/i.test(linha)) {
        return false;
    }
    const tokens = linha.trim().split(/\s+/);
    return tokens.every(tok => REGEX_ACORDE_TOKEN.test(tok));
}

function transporLinhaCifraClub(linha, diferenca, escalaAlvo) {
    const regexAcordeGlobal = /\b([A-G][#b]?(m|maj|min|dim|aug|sus|[0-9]|°|ø|\(|\)|b|\+|-)*(\/[A-G][#b]?)?)\b/g;
    return linha.replace(regexAcordeGlobal, (match) => {
        return transporAcorde(match, diferenca, escalaAlvo);
    });
}

function transporCifra(textoCifra, tomOrigem, tomDestino) {
    if (!textoCifra || typeof textoCifra !== 'string') return textoCifra || '';
    textoCifra = sanitizarTextoCifraClub(textoCifra);
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

    const linhas = textoCifra.split('\n');
    const linhasTranspostas = linhas.map(linha => {
        if (/\[([^\]]+)\]/.test(linha)) {
            return linha.replace(/\[([^\]]+)\]/g, (match, acordeInterno) => {
                return `[${transporAcorde(acordeInterno, diferenca, escalaAlvo)}]`;
            });
        }
        if (eLinhaDeAcordesCifraClub(linha)) {
            return transporLinhaCifraClub(linha, diferenca, escalaAlvo);
        }
        return linha;
    });

    return linhasTranspostas.join('\n');
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
        
        if (/^\s*\[(Intro|Primeira Parte|Segunda Parte|Refrão|Ponte|Final|Solo|Interlúdio|Pré-Refrão)[^\]]*\]/i.test(txt)) {
            return `<div class="text-emerald-400 font-bold text-sm mt-4 mb-2 tracking-wide font-sans">${txt}</div>`;
        }

        if (/\[([^\]]+)\]/.test(txt)) {
            const linhaTratada = txt.replace(/\[([^\]]+)\]/g, '<span class="text-amber-400 font-bold font-mono text-sm inline-block mr-1">[$1]</span>');
            return `<div class="py-0.5">${linhaTratada}</div>`;
        }

        if (eLinhaDeAcordesCifraClub(txt)) {
            return `<div class="text-amber-400 font-bold font-mono text-sm whitespace-pre">${txt}</div>`;
        }

        return `<div class="text-slate-100 font-mono text-sm py-0.5 whitespace-pre">${txt}</div>`;
    }).join('');

    conteudoEl.innerHTML = `<div class="font-mono text-sm leading-relaxed select-text bg-slate-950 p-6 rounded-xl border border-slate-800 shadow-inner overflow-x-auto">${htmlFormatado}</div>`;
}

window.abrirModalCifraPublica = abrirModalCifraPublica;
window.fecharModalCifraPublica = fecharModalCifraPublica;
window.alterarTomCifraPublica = alterarTomCifraPublica;
window.restaurarTomCifraPublica = restaurarTomCifraPublica;

const TAILWIND_PALETTES = {
    emerald: { 50: '#ecfdf5', 100: '#d1fae5', 200: '#a7f3d0', 300: '#6ee7b7', 400: '#34d399', 500: '#10b981', 600: '#059669', 700: '#047857', 800: '#065f46', 900: '#064e3b', 950: '#022c22' },
    blue: { 50: '#eff6ff', 100: '#dbeafe', 200: '#bfdbfe', 300: '#93c5fd', 400: '#60a5fa', 500: '#3b82f6', 600: '#2563eb', 700: '#1d4ed8', 800: '#1e40af', 900: '#1e3a8a', 950: '#172554' },
    amber: { 50: '#fffbeb', 100: '#fef3c7', 200: '#fde68a', 300: '#fcd34d', 400: '#fbbf24', 500: '#f59e0b', 600: '#d97706', 700: '#b45309', 800: '#92400e', 900: '#78350f', 950: '#451a03' },
    purple: { 50: '#faf5ff', 100: '#f3e8ff', 200: '#e9d5ff', 300: '#d8b4fe', 400: '#c084fc', 500: '#a855f7', 600: '#9333ea', 700: '#7e22ce', 800: '#6b21a8', 900: '#581c87', 950: '#3b0764' },
    rose: { 50: '#fff1f2', 100: '#ffe4e6', 200: '#fecdd3', 300: '#fda4af', 400: '#fb7185', 500: '#f43f5e', 600: '#e11d48', 700: '#be123c', 800: '#9f1239', 900: '#881337', 950: '#4c0519' },
    indigo: { 50: '#eef2ff', 100: '#e0e7ff', 200: '#c7d2fe', 300: '#a5b4fc', 400: '#818cf8', 500: '#6366f1', 600: '#4f46e5', 700: '#4338ca', 800: '#3730a3', 900: '#312e81', 950: '#1e1b4b' },
    sky: { 50: '#f0f9ff', 100: '#e0f2fe', 200: '#bae6fd', 300: '#7dd3fc', 400: '#38bdf8', 500: '#0ea5e9', 600: '#0284c7', 700: '#0369a1', 800: '#075985', 900: '#0c4a6e', 950: '#082f49' },
    red: { 50: '#fef2f2', 100: '#fee2e2', 200: '#fecaca', 300: '#fca5a5', 400: '#f87171', 500: '#ef4444', 600: '#dc2626', 700: '#b91c1c', 800: '#991b1b', 900: '#7f1d1d', 950: '#450a0a' }
};

function aplicarTemaColor(corNome) {
    if (!corNome) corNome = 'emerald';
    const nomeBaixo = corNome.toLowerCase().trim();
    
    let palette = null;
    if (window.tailwind && window.tailwind.colors && window.tailwind.colors[nomeBaixo]) {
        palette = window.tailwind.colors[nomeBaixo];
    } else {
        palette = TAILWIND_PALETTES[nomeBaixo] || TAILWIND_PALETTES.emerald;
    }
    
    if (typeof palette !== 'object') return;
    
    const root = document.documentElement;
    Object.keys(palette).forEach(weight => {
        if (palette[weight]) {
            root.style.setProperty(`--brand-${weight}`, palette[weight]);
        }
    });
}
window.aplicarTemaColor = aplicarTemaColor;

function getMinistryForUser(user) {
    if (!user || !dadosGlobais.ministries || dadosGlobais.ministries.length === 0) return null;
    
    if (user.ministry_id) {
        const min = dadosGlobais.ministries.find(m => m.id === user.ministry_id);
        if (min) return min;
    }
    
    if (user.ministries && typeof user.ministries === 'string') {
        const targetName = typeof removerAcentos === 'function' ? removerAcentos(user.ministries.toLowerCase()) : user.ministries.toLowerCase();
        const min = dadosGlobais.ministries.find(m => {
            const mName = typeof removerAcentos === 'function' ? removerAcentos((m.name || '').toLowerCase()) : (m.name || '').toLowerCase();
            return mName === targetName || mName.includes(targetName) || targetName.includes(mName);
        });
        if (min) return min;
    }
    
    if (user.roleNames && Array.isArray(user.roleNames)) {
        for (const min of dadosGlobais.ministries) {
            const minRoles = (min.ministry_roles || []).map(r => typeof removerAcentos === 'function' ? removerAcentos((r.name || '').toLowerCase()) : (r.name || '').toLowerCase());
            const userRoles = user.roleNames.map(rn => typeof removerAcentos === 'function' ? removerAcentos((rn || '').toLowerCase()) : (rn || '').toLowerCase());
            if (userRoles.some(ur => minRoles.some(mr => mr.includes(ur) || ur.includes(mr)))) {
                return min;
            }
        }
    }

    return null;
}
window.getMinistryForUser = getMinistryForUser;




