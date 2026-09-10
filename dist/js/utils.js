// UTILITÁRIO DE SANITIZAÇÃO SEGURA VIA DOMPURIFY
function sanitizarHTML(html) {
    if (!html || typeof html !== 'string') return html || '';
    if (typeof window !== 'undefined' && window.DOMPurify && window.DOMPurify.sanitize) {
        return window.DOMPurify.sanitize(html, {
            ADD_ATTR: ['onclick', 'onsubmit', 'onchange', 'oninput', 'onkeyup', 'onkeydown', 'target', 'class', 'id', 'type', 'style', 'placeholder', 'value', 'for', 'disabled', 'checked', 'name', 'xmlns', 'viewBox', 'fill', 'd', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'required', 'minlength', 'maxlength', 'data-action'],
            ADD_TAGS: ['iframe', 'svg', 'path', 'circle', 'rect', 'line', 'polygon', 'polyline', 'g', 'defs', 'clipPath']
        });
    }
    return html;
}
window.sanitizarHTML = sanitizarHTML;

function sanitizarTextoCifraClub(texto) {
    if (!texto || typeof texto !== 'string') return texto || '';

    // Normalizar quebras de linha e remover tags HTML residuais
    let limpo = texto.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    limpo = limpo.replace(/<[^>]*>/g, '');

    const rawLinhas = limpo.split('\n');
    const resultado = [];
    let i = 0;

    // Expressão regular ampla para identificar acordes com extensões, baixos e parênteses
    const REGEX_ACORDE_TOKEN = /^([A-G][#b]?(m|maj|min|dim|aug|sus|[0-9]|°|ø|\(|\)|b|\+|-)*(\/[A-G][#b]?)?)$/i;
    const regexMarcadorAcorde = /^\s*["']?>\s*([A-G][#b]?(m|maj|min|dim|aug|sus|[0-9]|°|ø|\(|\)|b|\+|-)*(\/[A-G][#b]?)?)\s*$/i;

    function isChordLine(l) {
        if (!l || !l.trim()) return false;
        if (/^\s*\[.*\]\s*$/.test(l)) return false;
        const tokens = l.trim().split(/\s+/);
        return tokens.every(tok => REGEX_ACORDE_TOKEN.test(tok));
    }

    while (i < rawLinhas.length) {
        let curr = rawLinhas[i];
        let matchMarcador = curr.match(regexMarcadorAcorde);

        // 1. Caso encontre marcador de acorde do Cifra Club (ex: ">G, ">Em7, ">Cm/Eb)
        if (matchMarcador) {
            const acorde = matchMarcador[1];

            let bestN = 0;
            let bestOffset = 0;

            // Se houver linhas em branco antes do marcador, calcula a folga (offset)
            let maxOffset = 0;
            while (maxOffset < resultado.length && resultado[resultado.length - 1 - maxOffset].trim() === '') {
                maxOffset++;
            }

            for (let offset = 0; offset <= maxOffset; offset++) {
                let maxN = Math.min(resultado.length - offset, rawLinhas.length - 1 - i);

                for (let n = 1; n <= maxN; n++) {
                    let matches = true;
                    for (let k = 0; k < n; k++) {
                        const linhaAntes = resultado[resultado.length - offset - n + k].trim();
                        const linhaDepois = rawLinhas[i + 1 + k].trim();
                        if (linhaAntes !== linhaDepois) {
                            matches = false;
                            break;
                        }
                    }
                    if (matches && n > bestN) {
                        bestN = n;
                        bestOffset = offset;
                    }
                }
            }

            if (bestN > 0) {
                // Remove quebras em branco intermediárias entre o bloco e o marcador
                if (bestOffset > 0) {
                    resultado.splice(resultado.length - bestOffset, bestOffset);
                }

                // O acorde pertence à linha de acorde imediatamente anterior ao bloco duplicado
                const targetIdx = resultado.length - bestN - 1;
                if (targetIdx >= 0) {
                    const linhaAlvo = resultado[targetIdx];
                    if (linhaAlvo.length > 0 && !linhaAlvo.endsWith(' ') && !linhaAlvo.endsWith('\t')) {
                        resultado[targetIdx] = linhaAlvo + '  ' + acorde;
                    } else {
                        resultado[targetIdx] = linhaAlvo + acorde;
                    }
                } else {
                    resultado.splice(resultado.length - bestN, 0, acorde);
                }

                // Pula o marcador e todo o bloco de letra duplicado subsequente
                i += 1 + bestN;
                continue;
            } else {
                resultado.push(acorde);
                i++;
                continue;
            }
        }

        // 2. Caso legado de duplicação alternada (acorde1, letra1, acorde2, letra2 com letra1 == letra2)
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

    // 3. Limpeza final de linhas idênticas consecutivas que não sejam acordes
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
    if (Array.isArray(user.lider_de) && user.lider_de.length > 0) {
        return user.lider_de;
    }
    if (Array.isArray(user.ministry_leaders) && user.ministry_leaders.length > 0) {
        const ids = user.ministry_leaders.map(ml => ml.ministry_id || ml).filter(Boolean);
        if (ids.length > 0) return ids;
    }
    const roleStr = (user.system_role || user.role || '').toLowerCase();
    if (roleStr === 'lider' && user.ministry_id) {
        return [user.ministry_id];
    }
    if (user.ministry_id) {
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

    const termoBuscado = instrumento ? removerAcentos(instrumento.toLowerCase()) : '';
    const listaVoluntarios = (typeof Store !== 'undefined' && Store.getVoluntarios) ? Store.getVoluntarios() : (dadosGlobais.voluntarios || []);

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
        const normRoles = removerAcentos(rStr.toLowerCase());

        // Verifica equivalências (ex: Cantor / Vocalista / Vocal ou papéis com escopo por música)
        if (termoBuscado.includes('cantor') || termoBuscado.includes('vocal')) {
            if (v.user_ministry_roles && Array.isArray(v.user_ministry_roles)) {
                const hasSongRole = v.user_ministry_roles.some(umr => {
                    const mr = umr.ministry_roles;
                    if (mr) {
                        if (mr.scale_scope === 'song') return true;
                        if (mr.scale_scope === 'service') return false;
                        const rName = (mr.name || '').toLowerCase();
                        return rName.includes('cantor') || rName.includes('vocal');
                    }
                    return false;
                });
                if (hasSongRole) return true;
            }
            return normRoles.includes('cantor') || normRoles.includes('vocal');
        }

        return normRoles.includes(termoBuscado);
    });

    const nomes = filtrados.map(v => (v.name || '').trim()).filter(Boolean);
    return [...new Set(nomes)];
}

// Retorna todos os voluntários que possuem funções configuradas para escala por música (scale_scope === 'song')
function obterVoluntariosEscopoMusica() {
    const listaVoluntarios = (typeof Store !== 'undefined' && Store.getVoluntarios) ? Store.getVoluntarios() : (window.dadosGlobais?.voluntarios || []);
    const filtrados = listaVoluntarios.filter(v => {
        if (!v || !v.name) return false;

        // 1. Verifica vínculos em user_ministry_roles
        if (v.user_ministry_roles && Array.isArray(v.user_ministry_roles)) {
            const hasSongScope = v.user_ministry_roles.some(umr => {
                const mr = umr.ministry_roles;
                if (mr) {
                    if (mr.scale_scope === 'song') return true;
                    if (mr.scale_scope === 'service') return false;
                    const rName = (mr.name || '').toLowerCase();
                    return rName.includes('cantor') || rName.includes('vocal');
                }
                const fallbackName = (umr.role_name || '').toLowerCase();
                return fallbackName.includes('cantor') || fallbackName.includes('vocal');
            });
            if (hasSongScope) return true;
        }

        // 2. Fallback por nomes de roles legados
        const rNames = v.roleNames || v.roles || v.instruments || [];
        const rStr = Array.isArray(rNames) ? rNames.join(',') : String(rNames || '');
        const norm = typeof removerAcentos === 'function' ? removerAcentos(rStr.toLowerCase()) : rStr.toLowerCase();
        return norm.includes('cantor') || norm.includes('vocal');
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
    if (/^\s*\[(?:Intro|Primeira Parte|Segunda Parte|Refrão|Refrão Final|Ponte|Final|Solo|Interlúdio|Pré-Refrão|Base do Solo)[^\]]*\]/i.test(linha)) {
        return false;
    }
    const tokens = linha.trim().split(/\s+/);
    return tokens.every(tok => REGEX_ACORDE_TOKEN.test(tok));
}

function transporLinhaCifraClub(linha, diferenca, escalaAlvo) {
    const regexAcordeGlobal = /(^|\s)([A-G][#b]?(?:m|maj|min|dim|aug|sus|[0-9]|°|ø|\(|\)|b|\+|-)*(?:\/[A-G][#b]?)?)(?=\s|$)/gi;
    return linha.replace(regexAcordeGlobal, (match, espacoAntes, acorde) => {
        return espacoAntes + transporAcorde(acorde, diferenca, escalaAlvo);
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
        // Se for linha de seção com acordes (ex: [Intro] C7M G/B Am7 ou [Final] Bm7 Am7)
        const matchSecao = linha.match(/^(\s*\[(?:Intro|Primeira Parte|Segunda Parte|Refrão|Refrão Final|Ponte|Final|Solo|Interlúdio|Pré-Refrão|Base do Solo)[^\]]*\])(.*)$/i);
        if (matchSecao) {
            const tag = matchSecao[1];
            const resto = matchSecao[2];
            if (resto && resto.trim()) {
                return tag + transporLinhaCifraClub(resto, diferenca, escalaAlvo);
            }
            return linha;
        }

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
    const badgeTomEl = document.getElementById('cifra-publica-tom-badge');
    const conteudoEl = document.getElementById('cifra-publica-conteudo');

    if (badgeTomEl) {
        badgeTomEl.textContent = stateCifraPublica.tomAtual || stateCifraPublica.tomOriginal || 'C';
    }

    if (subtituloEl) {
        subtituloEl.textContent = `(Original: ${stateCifraPublica.tomOriginal || 'C'})`;
    }

    if (!conteudoEl) return;

    const cifraTransposta = transporCifra(
        stateCifraPublica.cifraBruta,
        stateCifraPublica.tomOriginal,
        stateCifraPublica.tomAtual
    );

    if (!cifraTransposta) {
        conteudoEl.innerHTML = '<p class="text-slate-400 text-xs sm:text-sm p-2">Cifra não disponível.</p>';
        return;
    }

    const linhas = cifraTransposta.split('\n');
    const htmlFormatado = linhas.map(linha => {
        const txt = linha;
        
        // Tags de seções com ou sem acordes (ex: [Intro] C7M G/B... ou [Primeira Parte])
        const matchSecao = txt.match(/^(\s*\[(?:Intro|Primeira Parte|Segunda Parte|Refrão|Refrão Final|Ponte|Final|Solo|Interlúdio|Pré-Refrão|Base do Solo)[^\]]*\])(.*)$/i);
        if (matchSecao) {
            const tagSecao = matchSecao[1];
            const resto = matchSecao[2];
            if (resto && resto.trim()) {
                return `<div class="mt-3 mb-1.5"><span class="text-emerald-400 font-bold text-xs sm:text-sm tracking-wide font-sans mr-2">${tagSecao}</span><span class="text-amber-400 font-bold font-mono text-xs sm:text-sm whitespace-pre">${resto}</span></div>`;
            }
            return `<div class="text-emerald-400 font-bold text-xs sm:text-sm mt-3 mb-1.5 tracking-wide font-sans">${tagSecao}</div>`;
        }

        if (/\[([^\]]+)\]/.test(txt)) {
            const linhaTratada = txt.replace(/\[([^\]]+)\]/g, '<span class="text-amber-400 font-bold font-mono text-xs sm:text-sm inline-block mr-1">[$1]</span>');
            return `<div class="py-0.5">${linhaTratada}</div>`;
        }

        if (eLinhaDeAcordesCifraClub(txt)) {
            return `<div class="text-amber-400 font-bold font-mono text-xs sm:text-sm whitespace-pre font-semibold">${txt}</div>`;
        }

        return `<div class="text-slate-100 font-mono text-xs sm:text-sm py-0.5 whitespace-pre">${txt}</div>`;
    }).join('');

    conteudoEl.innerHTML = htmlFormatado;
}

window.abrirModalCifraPublica = abrirModalCifraPublica;
window.fecharModalCifraPublica = fecharModalCifraPublica;
window.alterarTomCifraPublica = alterarTomCifraPublica;
window.restaurarTomCifraPublica = restaurarTomCifraPublica;

const COMPLETE_PALETTES = {
    emerald: {
        name: '🌲 Floresta Esmeralda',
        brand: { 50: '#ecfdf5', 100: '#d1fae5', 200: '#a7f3d0', 300: '#6ee7b7', 400: '#34d399', 500: '#10b981', 600: '#059669', 700: '#047857', 800: '#065f46', 900: '#064e3b', 950: '#022c22' },
        surfaces: { 700: '20 83 63', 800: '12 56 43', 850: '8 43 32', 900: '5 33 24', 950: '2 20 14' }
    },
    indigo: {
        name: '🌌 Céu Noturno & Índigo',
        brand: { 50: '#eef2ff', 100: '#e0e7ff', 200: '#c7d2fe', 300: '#a5b4fc', 400: '#818cf8', 500: '#6366f1', 600: '#4f46e5', 700: '#4338ca', 800: '#3730a3', 900: '#312e81', 950: '#1e1b4b' },
        surfaces: { 700: '38 45 107', 800: '24 28 71', 850: '17 21 54', 900: '12 15 41', 950: '5 6 22' }
    },
    amber: {
        name: '☀️ Âmbar Dourado & Obsidiana',
        brand: { 50: '#fffbeb', 100: '#fef3c7', 200: '#fde68a', 300: '#fcd34d', 400: '#fbbf24', 500: '#f59e0b', 600: '#d97706', 700: '#b45309', 800: '#92400e', 900: '#78350f', 950: '#451a03' },
        surfaces: { 700: '79 54 28', 800: '51 35 18', 850: '39 26 13', 900: '29 19 8', 950: '17 11 4' }
    },
    purple: {
        name: '👑 Ametista Real & Veludo',
        brand: { 50: '#faf5ff', 100: '#f3e8ff', 200: '#e9d5ff', 300: '#d8b4fe', 400: '#c084fc', 500: '#a855f7', 600: '#9333ea', 700: '#7e22ce', 800: '#6b21a8', 900: '#581c87', 950: '#3b0764' },
        surfaces: { 700: '61 35 107', 800: '40 22 71', 850: '30 15 54', 900: '22 10 41', 950: '11 4 22' }
    },
    blue: {
        name: '🌊 Safira Oceânica & Marinho',
        brand: { 50: '#f0f9ff', 100: '#e0f2fe', 200: '#bae6fd', 300: '#7dd3fc', 400: '#38bdf8', 500: '#0ea5e9', 600: '#0284c7', 700: '#0369a1', 800: '#075985', 900: '#0c4a6e', 950: '#082f49' },
        surfaces: { 700: '24 72 122', 800: '15 47 82', 850: '11 36 64', 900: '7 26 48', 950: '3 14 27' }
    },
    sky: {
        name: '❄️ Azul Glacial & Ciano',
        brand: { 50: '#f0f9ff', 100: '#e0f2fe', 200: '#bae6fd', 300: '#7dd3fc', 400: '#38bdf8', 500: '#0284c7', 600: '#0369a1', 700: '#075985', 800: '#0c4a6e', 900: '#082f49', 950: '#041d2f' },
        surfaces: { 700: '16 68 99', 800: '10 45 69', 850: '8 36 56', 900: '6 27 43', 950: '3 15 26' }
    },
    rose: {
        name: '🍷 Rubi Noir & Vinho Bordô',
        brand: { 50: '#fff1f2', 100: '#ffe4e6', 200: '#fecdd3', 300: '#fda4af', 400: '#fb7185', 500: '#f43f5e', 600: '#e11d48', 700: '#be123c', 800: '#9f1239', 900: '#881337', 950: '#4c0519' },
        surfaces: { 700: '84 32 52', 800: '56 19 33', 850: '44 13 24', 900: '32 9 17', 950: '19 4 9' }
    },
    red: {
        name: '🔥 Carmim & Chamas',
        brand: { 50: '#fef2f2', 100: '#fee2e2', 200: '#fecaca', 300: '#fca5a5', 400: '#f87171', 500: '#ef4444', 600: '#dc2626', 700: '#b91c1c', 800: '#991b1b', 900: '#7f1d1d', 950: '#450a0a' },
        surfaces: { 700: '94 28 28', 800: '64 16 16', 850: '48 11 11', 900: '36 7 7', 950: '21 3 3' }
    },
    slate: {
        name: '🪨 Grafite Ardósia (Neutro)',
        brand: { 50: '#f0fdfa', 100: '#ccfbf1', 200: '#99f6e4', 300: '#5eead4', 400: '#2dd4bf', 500: '#14b8a6', 600: '#0d9488', 700: '#0f766e', 800: '#115e59', 900: '#134e4a', 950: '#042f2e' },
        surfaces: { 700: '51 65 85', 800: '30 41 59', 850: '19 29 46', 900: '15 23 42', 950: '2 6 23' }
    },
    black: {
        name: '🖤 Ônix Minimalista / OLED (Preto Puro)',
        brand: { 50: '#f0f9ff', 100: '#e0f2fe', 200: '#bae6fd', 300: '#7dd3fc', 400: '#38bdf8', 500: '#0ea5e9', 600: '#0284c7', 700: '#0369a1', 800: '#075985', 900: '#0c4a6e', 950: '#082f49' },
        surfaces: { 700: '39 39 42', 800: '24 24 27', 850: '17 17 20', 900: '9 9 11', 950: '0 0 0' }
    }
};
window.COMPLETE_PALETTES = COMPLETE_PALETTES;

function aplicarTemaColor(corNome) {
    if (!corNome) corNome = 'emerald';
    const chave = corNome.toLowerCase().trim();
    const p = COMPLETE_PALETTES[chave] || COMPLETE_PALETTES.emerald;
    if (!p) return;

    const root = document.documentElement;

    // 1. Aplicar escala de destaque (Brand)
    Object.keys(p.brand).forEach(weight => {
        root.style.setProperty(`--brand-${weight}`, p.brand[weight]);
    });

    // 2. Aplicar superfícies, fundos e bordas temáticas (Surfaces / Slate)
    if (p.surfaces) {
        Object.keys(p.surfaces).forEach(weight => {
            root.style.setProperty(`--theme-slate-${weight}-rgb`, p.surfaces[weight]);
        });
    }

    // 3. Atualizar background do body
    if (p.surfaces && p.surfaces['950']) {
        const rgb950 = p.surfaces['950'];
        document.body.style.backgroundColor = `rgb(${rgb950})`;
        
        // Atualiza meta theme-color para navegadores mobile (Android / Galaxy S24)
        let metaTheme = document.querySelector('meta[name="theme-color"]');
        if (metaTheme) {
            metaTheme.setAttribute('content', `rgb(${rgb950})`);
        }
    }

    // 4. Salvar em cache local para evitar piscadas
    try {
        localStorage.setItem('cached_theme_color', chave);
    } catch(e) {}
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




