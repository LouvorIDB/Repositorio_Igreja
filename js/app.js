// ===================== INICIALIZAÇÃO =====================

window.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('admin') === 'true') {
        document.getElementById('btn-admin-wrapper').classList.remove('hidden');
    }
    carregarDados();

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js').catch(err => {
            console.warn('Falha ao registrar Service Worker:', err);
        });
    }
});

async function carregarDados() {
    const CACHE_KEY = 'dadosGlobaisCache';
    const cacheLocal = localStorage.getItem(CACHE_KEY);
    let dadosExibidosStr = null;

    // 1. Renderiza os dados do cache imediatamente (0ms de espera)
    if (cacheLocal) {
        try {
            const dataCache = JSON.parse(cacheLocal);
            dadosGlobais.cultos = dataCache.cultos || [];
            dadosGlobais.repertorio = dataCache.repertorio || [];
            dadosGlobais.banco = dataCache.banco || [];
            dadosGlobais.cantores = dataCache.cantores || [];
            dadosGlobais.novas = dataCache.novas || [];

            renderizarCultos(dadosGlobais.cultos);
            renderizarRepertorio(dadosGlobais.repertorio);
            renderizarMusicasNovas(dadosGlobais.novas);
            if (isAdmin) renderizarAdminListaCultos();

            dadosExibidosStr = cacheLocal;
        } catch (e) {
            console.warn('Erro ao ler cache local:', e);
        }
    }

    // 2. Revalidação em segundo plano via Supabase
    try {
        if (!supabaseClient) {
            throw new Error("Cliente Supabase não inicializado.");
        }

        // Buscar cultos ('services') ordenados por data com relacionamentos
        const { data: servicesData, error: servicesErr } = await supabaseClient
            .from('services')
            .select(`
                *,
                service_songs (
                    *,
                    song_versions (
                        *,
                        songs (*)
                    )
                )
            `)
            .order('date', { ascending: true });

        if (servicesErr) throw servicesErr;

        // Buscar banco de músicas ('songs') com suas versões
        const { data: songsData, error: songsErr } = await supabaseClient
            .from('songs')
            .select(`
                *,
                song_versions (*)
            `)
            .order('title', { ascending: true });

        if (songsErr) throw songsErr;

        // Buscar integrantes/cantores ('profiles') se a tabela existir
        let profilesData = [];
        try {
            const { data: pData } = await supabaseClient.from('profiles').select('*');
            if (pData) profilesData = pData;
        } catch (e) {
            console.warn('Tabela profiles não consultada ou vazia:', e);
        }

        // 3. Formatação dos resultados do Supabase no formato das matrizes dadosGlobais

        // Formata Cultos
        const cultosFormatados = [];
        (servicesData || []).forEach(service => {
            let tituloHeader = service.title || `CULTO DE ${(service.type || 'DOMINGO').toUpperCase()} - ${service.date || ''}`;
            if (service.status === 'arquivado' || (service.title && service.title.toUpperCase().includes('OCULTO'))) {
                tituloHeader = (service.title && service.title.includes('OCULTO')) ? service.title : `${tituloHeader} - OCULTO`;
            } else if (service.is_hidden && !tituloHeader.toUpperCase().includes('OCULTO')) {
                tituloHeader += " - OCULTO";
            }
            if (service.is_draft && !tituloHeader.toUpperCase().includes('EM MONTAGEM')) {
                tituloHeader += " - EM MONTAGEM";
            }

            let escala = { violao: '', bateria: '', teclado: '' };
            let cantoresCultoStr = service.singers_list || service.singers || '';
            if (service.notes) {
                try {
                    const parsedNotes = JSON.parse(service.notes);
                    if (parsedNotes.escala) escala = parsedNotes.escala;
                    if (parsedNotes.cantores && Array.isArray(parsedNotes.cantores)) cantoresCultoStr = parsedNotes.cantores.join(', ');
                } catch(e){}
            }
            const colF = JSON.stringify(escala);
            const colG = cantoresCultoStr;

            cultosFormatados.push([tituloHeader, '', '', '', '', colF, colG]);

            const songList = (service.service_songs || []).sort((a, b) => (a.order || 0) - (b.order || 0));
            songList.forEach(sSong => {
                const version = sSong.song_versions || {};
                const song = version.songs || sSong.songs || {};
                const nomeMusica = song.title || version.title || sSong.song_name || sSong.title || '';
                const tom = version.key || sSong.key || sSong.tom || '';
                const variacao = version.variation || sSong.variation || sSong.variacao || 'Original';
                const vs = version.drive_vs_url || version.drive_url || song.drive_vs_url || song.drive_url || sSong.drive_vs_url || sSong.drive_url || sSong.vs || '';
                const yt = version.youtube_url || sSong.youtube_url || sSong.yt || '';
                const cantoresMusica = sSong.singers_list || sSong.singers || '';
                const lyrics = version.lyrics || song.lyrics || sSong.lyrics || '';

                cultosFormatados.push([nomeMusica, tom, variacao, vs, yt, '', cantoresMusica, lyrics]);
            });
        });

        // Formata Banco, Repertorio e Novas
        const headerMusicas = ["Música", "Tom", "Variação", "VS", "YouTube"];
        const bancoFormatado = [headerMusicas]; // Mantém plano para o Culto Editor
        
        // Arrays estruturados para Repertório e Novas
        const repertorioFormatado = [];
        const novasFormatadas = [];

        (songsData || []).forEach(song => {
            const nomeMusica = song.title || '';
            const status = song.status || 'ativo';
            const songId = song.id || '';

            // Se não tiver versão, cria um array com dados vazios para não quebrar
            const versoes = (song.song_versions && song.song_versions.length > 0) 
                ? song.song_versions 
                : [{ id: 'fake', key: song.key || '', variation: song.variation || 'Original', drive_vs_url: song.drive_vs_url || song.drive_url || '', youtube_url: song.youtube_url || '' }];

            // Para o Editor de Culto (adiciona cada versão como linha plana)
            versoes.forEach(v => {
                bancoFormatado.push([
                    nomeMusica, 
                    v.key || '', 
                    v.variation || 'Original', 
                    v.drive_vs_url || v.drive_url || '', 
                    v.youtube_url || ''
                ]);
            });

            // Estrutura agrupada para a Interface de Repertório/Novas
            const objMusica = {
                id: songId,
                title: nomeMusica,
                status: status,
                lyrics: song.lyrics || '',
                versions: versoes.map(v => ({
                    id: v.id,
                    key: v.key || '',
                    variation: v.variation || 'Original',
                    vs: v.drive_vs_url || v.drive_url || '',
                    yt: v.youtube_url || '',
                    lyrics: v.lyrics || song.lyrics || ''
                }))
            };

            if (status === 'nova') {
                novasFormatadas.push(objMusica);
            } else {
                repertorioFormatado.push(objMusica);
            }
        });

        // Formata Cantores
        const cantoresFormatados = [["Nome", "Telefone", "Instrumentos"]];
        (profilesData || []).forEach(profile => {
            const nome = profile.name || '';
            const telefone = profile.phone || '';
            let inst = '';
            if (Array.isArray(profile.instruments)) {
                inst = profile.instruments.join(', ');
            } else if (typeof profile.instruments === 'string') {
                inst = profile.instruments.replace(/[\[\]"]/g, '').split(',').map(s => s.trim()).filter(Boolean).join(', ');
            }
            if (!inst) inst = profile.role || '';
            cantoresFormatados.push([nome, telefone, inst]);
        });

        const dataObj = {
            cultos: cultosFormatados,
            repertorio: repertorioFormatado,
            banco: bancoFormatado,
            cantores: cantoresFormatados,
            novas: novasFormatadas
        };

        const dataStr = JSON.stringify(dataObj);

        // 4. Atualiza cache e re-renderiza apenas se houver alterações
        if (dataStr !== dadosExibidosStr) {
            localStorage.setItem(CACHE_KEY, dataStr);

            dadosGlobais.cultos = dataObj.cultos;
            dadosGlobais.repertorio = dataObj.repertorio;
            dadosGlobais.banco = dataObj.banco;
            dadosGlobais.cantores = dataObj.cantores;
            dadosGlobais.novas = dataObj.novas;

            renderizarCultos(dadosGlobais.cultos);
            renderizarRepertorio(dadosGlobais.repertorio);
            renderizarMusicasNovas(dadosGlobais.novas);
            if (isAdmin) renderizarAdminListaCultos();
        }
    } catch (error) {
        console.error("Erro ao carregar dados do Supabase:", error);
        if (!dadosExibidosStr) {
            document.getElementById('secao-cultos').innerHTML = '<p class="text-red-400 text-center">Erro ao conectar com o banco de dados.</p>';
        }
    }
}

// ===================== SITE PRINCIPAL =====================

function mudarAba(aba) {
    const secoes = { cultos: 'secao-cultos', repertorio: 'secao-repertorio', novas: 'secao-novas' };
    const botoes = { cultos: 'btn-cultos', repertorio: 'btn-repertorio', novas: 'btn-novas' };
    const ativo = "px-5 py-2.5 rounded-xl font-medium text-sm transition bg-emerald-600 text-white shadow-lg";
    const inativo = "px-5 py-2.5 rounded-xl font-medium text-sm transition bg-slate-800 text-slate-300 hover:bg-slate-700";

    Object.keys(secoes).forEach(key => {
        document.getElementById(secoes[key]).classList.toggle('hidden', key !== aba);
        document.getElementById(botoes[key]).className = key === aba ? ativo : inativo;
    });
}

function renderizarCultos(rows) {
    const container = document.getElementById('secao-cultos');
    container.innerHTML = '';

    let blocoAtual = null;
    let blocoEmMontagem = false;
    let blocoOculto = false;
    let htmlCultos = '';
    let contadorCard = 0;
    let contadorBloco = 0;

    for (let i = 0; i < rows.length; i++) {
        const linha = rows[i];
        const textoPrimeiraColuna = linha[0] ? linha[0].toString() : '';

        if (textoPrimeiraColuna.includes("CULTO DE")) {
            if (blocoAtual && !blocoOculto) htmlCultos += `</div></div>`;

            contadorBloco++;
            const idPlaylist = `playlist-culto-${contadorBloco}`;
            const idSeta = `seta-culto-${contadorBloco}`;
            blocoAtual = textoPrimeiraColuna;
            blocoEmMontagem = blocoAtual.toUpperCase().includes('EM MONTAGEM');
            blocoOculto = blocoAtual.toUpperCase().includes('OCULTO');

            // Lê instrumentos (col F = JSON) e cantores do culto (col G)
            let instrObj = {};
            try { instrObj = linha[5] ? JSON.parse(linha[5].toString()) : {}; } catch (e) { }
            const cantoresCulto = linha[6] ? linha[6].toString().trim() : '';

            if (blocoOculto) continue;

            const corHeader = blocoEmMontagem
                ? 'bg-red-900/60 hover:bg-red-900/80 border-b border-red-700/50'
                : 'bg-emerald-900/60 hover:bg-emerald-900/80 border-b border-emerald-700/50';
            const corTexto = blocoEmMontagem ? 'text-red-300' : 'text-emerald-300';

            // Monta linha de escala de instrumentos + cantores
            const partsEscala = [];
            if (instrObj.violao) partsEscala.push(`🎸 Violão: <span class="text-emerald-300 font-medium">${instrObj.violao}</span>`);
            if (instrObj.bateria) partsEscala.push(`🥁 Bateria: <span class="text-emerald-300 font-medium">${instrObj.bateria}</span>`);
            if (instrObj.teclado) partsEscala.push(`🎹 Teclado: <span class="text-emerald-300 font-medium">${instrObj.teclado}</span>`);
            
            Object.keys(instrObj).forEach(key => {
                if (!['violao', 'bateria', 'teclado'].includes(key.toLowerCase()) && instrObj[key]) {
                    const nomeFormato = key.charAt(0).toUpperCase() + key.slice(1);
                    partsEscala.push(`🎵 ${nomeFormato}: <span class="text-emerald-300 font-medium">${instrObj[key]}</span>`);
                }
            });

            const linhaInstrumentos = partsEscala.length > 0
                ? `<div class="px-4 py-1.5 text-xs text-slate-300 bg-slate-900/40 border-b border-slate-700/30 flex flex-wrap gap-3">${partsEscala.join('<span class="text-slate-600">|</span>')}</div>`
                : '';
            const linhaCantores = cantoresCulto
                ? `<div class="px-4 py-1.5 text-xs bg-slate-900/40 border-b border-slate-700/30"><span class="text-slate-400">🎤 Cantores: </span><span class="text-emerald-300 font-medium">${cantoresCulto}</span></div>`
                : '';

            htmlCultos += `
                <div class="bg-slate-800/80 border border-slate-700 rounded-2xl overflow-hidden shadow-md mb-3">
                    <button onclick="toggleCultoBloco('${idPlaylist}', '${idSeta}')" class="w-full flex items-center justify-between ${corHeader} px-4 py-2.5 transition text-left">
                        <h2 class="font-bold ${corTexto} text-sm uppercase tracking-wider">${blocoAtual.replace(/ - OCULTO/i, '').replace(/ - EM MONTAGEM/i, '').trim()}</h2>
                        <span id="${idSeta}" class="${corTexto} text-xs">▼</span>
                    </button>
                    ${linhaInstrumentos}
                    ${linhaCantores}
                    <div id="${idPlaylist}" class="hidden divide-y divide-slate-700/50">
            `;

            if (blocoEmMontagem) {
                htmlCultos += `
                    <div class="p-5 text-center space-y-3">
                        <p class="text-red-400 text-sm font-medium">🚧 Incompleto — playlist em montagem</p>
                        <p class="text-slate-400 text-xs">Envie sugestões de músicas para esse culto:</p>
                        <div class="flex flex-col sm:flex-row gap-2 max-w-md mx-auto">
                            <input type="text" id="sugestao-autor-${contadorBloco}" placeholder="Seu nome" class="sm:w-1/3 bg-slate-900 border border-slate-700 px-3 py-2 rounded text-sm text-white focus:outline-none focus:border-red-500">
                            <input type="text" id="sugestao-texto-${contadorBloco}" placeholder="Nome da música sugerida" class="sm:w-2/3 bg-slate-900 border border-slate-700 px-3 py-2 rounded text-sm text-white focus:outline-none focus:border-red-500">
                        </div>
                        <button onclick="enviarComentario('${blocoAtual.replace(/'/g, "\\'")}','sugestao-autor-${contadorBloco}','sugestao-texto-${contadorBloco}','sugestao-status-${contadorBloco}','Sugestão para Culto')" class="bg-red-700 hover:bg-red-600 text-white px-4 py-2 rounded text-sm font-medium">Enviar sugestão</button>
                        <p id="sugestao-status-${contadorBloco}" class="text-xs text-emerald-400 hidden">Sugestão enviada!</p>
                    </div>
                `;
            }
        } else if (blocoAtual && !blocoOculto && textoPrimeiraColuna.trim() !== '' && !blocoEmMontagem) {
            const musica = linha[0];
            const tom = linha[1] || '';
            const variacao = linha[2] || '';
            const vsCelular = linha[3] || '';
            const ytDado = linha[4] || '';
            const cantoresMusica = linha[6] ? linha[6].toString().trim() : '';
            const lyricsTexto = linha[7] ? linha[7].toString().trim() : '';

            const fileId = extrairIdDrive(vsCelular);
            const linkYoutubeFinal = obterLinkYoutube(ytDado, musica);
            const btnLetraCulto = lyricsTexto
                ? `<button onclick="abrirModalLetraPublica('${musica.toString().replace(/'/g, "\\'")}', 'Tom: ${tom}', '${encodeURIComponent(lyricsTexto)}')" class="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition">📜 Letra</button>`
                : '';
            contadorCard++;

            htmlCultos += `
                <div class="p-4 flex flex-col gap-2 hover:bg-slate-750 transition">
                    <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <div>
                            <h3 class="font-bold text-white text-base">${musica}</h3>
                            <div class="flex flex-wrap items-center gap-2 mt-1 text-xs text-slate-400">
                                <span class="bg-slate-700 px-2 py-0.5 rounded text-emerald-300 font-semibold">Tom: ${tom} ${variacao ? '(' + variacao + ')' : ''}</span>
                                ${cantoresMusica ? `<span class="text-slate-400">🎤 <span class="text-slate-300">${cantoresMusica}</span></span>` : ''}
                            </div>
                        </div>
                        <div class="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
                            ${vsCelular ? `<button onclick="playDriveAudio('${musica.toString().replace(/'/g, "\\'")}','${fileId}')" class="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition">▶ Ouvir VS</button>` : ''}
                            ${btnLetraCulto}
                            ${linkYoutubeFinal ? `<button onclick="playYoutubeAudio('${musica.toString().replace(/'/g, "\\'")}','${linkYoutubeFinal}')" class="bg-red-600 hover:bg-red-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition">📺 YouTube</button>` : ''}
                            <button onclick="toggleComentario('culto-${contadorCard}')" class="bg-slate-700 hover:bg-slate-600 text-slate-200 px-3 py-1.5 rounded-lg text-xs font-medium transition">💬 Pedir Ajuste</button>
                        </div>
                    </div>
                </div>
                <div id="culto-${contadorCard}" class="hidden p-4 bg-slate-900/50 border-t border-slate-700/50 space-y-2">
                    <div class="flex gap-2">
                        <input type="text" id="autor-c-${contadorCard}" placeholder="Seu nome" class="w-1/3 bg-slate-900 border border-slate-700 px-3 py-1.5 rounded text-xs text-white focus:outline-none focus:border-emerald-500">
                        <input type="text" id="comentario-c-${contadorCard}" placeholder="Ex: Mudar tom para C..." class="w-2/3 bg-slate-900 border border-slate-700 px-3 py-1.5 rounded text-xs text-white focus:outline-none focus:border-emerald-500">
                        <button onclick="enviarComentario('${musica.toString().replace(/'/g, "\\'")}','autor-c-${contadorCard}','comentario-c-${contadorCard}','status-c-${contadorCard}','Ajuste de Tom')" class="bg-emerald-700 hover:bg-emerald-600 text-white px-3 py-1.5 rounded text-xs font-medium">Enviar</button>
                    </div>
                    <p id="status-c-${contadorCard}" class="text-xs text-emerald-400 hidden">Enviado com sucesso!</p>
                </div>
            `;
        }
    }

    if (blocoAtual && !blocoOculto) htmlCultos += `</div></div>`;
    container.innerHTML = htmlCultos || '<p class="text-center text-slate-500 py-10">Nenhum culto agendado encontrado na planilha.</p>';
}

function gerarHtmlCardMusica(musicaObj, prefix) {
    const isAdminMode = typeof isAdmin !== 'undefined' && isAdmin;
    let htmlVersoes = '';
    
    if (musicaObj.versions && musicaObj.versions.length > 0) {
        musicaObj.versions.forEach((v, index) => {
            const fileId = extrairIdDrive(v.vs);
            const linksYt = obterLinksYoutubeArray(v.yt, musicaObj.title);
            const versionLyrics = v.lyrics || musicaObj.lyrics || '';
            const btnLetraCard = versionLyrics.trim() 
                ? `<button onclick="abrirModalLetraPublica('${musicaObj.title.replace(/'/g, "\\'")}', 'Tom: ${v.key}', '${encodeURIComponent(versionLyrics)}')" class="bg-indigo-600 hover:bg-indigo-500 text-white px-2 py-1.5 rounded-lg text-xs font-medium transition">📜 Letra</button>`
                : '';
            const itemId = `${prefix}-${musicaObj.id}-v${index}`;
            
            const ytButtonsHtml = linksYt.map(item => 
                `<button onclick="playYoutubeAudio('${musicaObj.title.replace(/'/g, "\\'")}', '${item.url}')" class="bg-red-600 hover:bg-red-500 text-white px-2 py-1.5 rounded-lg text-xs font-medium transition">${item.label}</button>`
            ).join('');

            htmlVersoes += `
                <div class="mt-3 pt-3 border-t border-slate-700/50">
                    <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <div class="flex items-center gap-2">
                            <span class="bg-slate-700 px-2 py-0.5 rounded text-emerald-300 text-xs font-semibold">Tom: ${v.key} (${v.variation || 'Original'})</span>
                        </div>
                        <div class="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
                            ${v.vs ? `<button onclick="playDriveAudio('${musicaObj.title.replace(/'/g, "\\'")}', '${fileId}')" class="bg-emerald-600 hover:bg-emerald-500 text-white px-2 py-1.5 rounded-lg text-xs font-medium transition">▶ Ouvir VS</button>` : ''}
                            ${btnLetraCard}
                            ${ytButtonsHtml}
                            <button onclick="toggleComentario('${itemId}')" class="bg-slate-700 hover:bg-slate-600 text-slate-200 px-2 py-1.5 rounded-lg text-xs font-medium transition">💬 Pedir Ajuste</button>
                        </div>
                    </div>
                    <div id="${itemId}" class="hidden pt-2 mt-2 space-y-2">
                        <div class="flex gap-2">
                            <input type="text" id="autor-${itemId}" placeholder="Seu nome" class="w-1/3 bg-slate-900 border border-slate-700 px-3 py-1.5 rounded text-xs text-white focus:outline-none focus:border-emerald-500">
                            <input type="text" id="comentario-${itemId}" placeholder="Ex: Mudar tom para C..." class="w-2/3 bg-slate-900 border border-slate-700 px-3 py-1.5 rounded text-xs text-white focus:outline-none focus:border-emerald-500">
                            <button onclick="enviarComentario('${musicaObj.title.replace(/'/g, "\\'")}', 'autor-${itemId}', 'comentario-${itemId}', 'status-${itemId}', 'Ajuste de Tom')" class="bg-emerald-700 hover:bg-emerald-600 text-white px-3 py-1.5 rounded text-xs font-medium">Enviar</button>
                        </div>
                        <p id="status-${itemId}" class="text-xs text-emerald-400 hidden">Solicitação enviada com sucesso!</p>
                    </div>
                </div>
            `;
        });
    }

    return `
        <div class="bg-slate-800 p-4 rounded-xl border ${musicaObj.status === 'nova' ? 'border-violet-700/30 hover:border-violet-600/50' : 'border-slate-700 hover:border-slate-600'} transition mb-3">
            <div class="flex items-center justify-between">
                <h3 class="font-bold text-lg text-white">${musicaObj.title}</h3>
            </div>
            ${htmlVersoes}
        </div>
    `;
}

function renderizarRepertorio(rows) {
    const container = document.getElementById('musicList');
    container.innerHTML = '';
    if (!rows || rows.length === 0) {
        container.innerHTML = '<p class="text-center text-slate-500 py-10">Repertório vazio.</p>';
        return;
    }
    
    let html = '';
    rows.forEach((musicaObj, i) => {
        if (!musicaObj || !musicaObj.title) return;
        html += gerarHtmlCardMusica(musicaObj, 'rep');
    });
    container.innerHTML = html;
}

function renderizarMusicasNovas(rows) {
    const container = document.getElementById('novasList');
    container.innerHTML = '';
    if (!rows || rows.length === 0) {
        container.innerHTML = '<p class="text-center text-slate-500 py-10">Nenhuma música nova cadastrada ainda.</p>';
        return;
    }
    
    let html = '';
    rows.forEach((musicaObj, i) => {
        if (!musicaObj || !musicaObj.title) return;
        html += gerarHtmlCardMusica(musicaObj, 'nova');
    });
    container.innerHTML = html;
}

function filtrarMusicas() {
    const termo = document.getElementById('searchInput').value.toLowerCase();
    const rows = dadosGlobais.repertorio;
    const container = document.getElementById('musicList');
    container.innerHTML = '';
    
    let html = '';
    rows.forEach((musicaObj, i) => {
        if (!musicaObj || !musicaObj.title) return;
        if (!musicaObj.title.toLowerCase().includes(termo)) return;
        html += gerarHtmlCardMusica(musicaObj, 'filtrado');
    });
    
    if (!html) {
        container.innerHTML = '<p class="text-center text-slate-500 py-10">Nenhuma música encontrada.</p>';
    } else {
        container.innerHTML = html;
    }
}

function toggleCultoBloco(idPlaylist, idSeta) {
    const playlist = document.getElementById(idPlaylist);
    const seta = document.getElementById(idSeta);
    playlist.classList.toggle('hidden');
    seta.textContent = playlist.classList.contains('hidden') ? '▼' : '▲';
}

function toggleComentario(id) { document.getElementById(id).classList.toggle('hidden'); }

async function enviarComentario(musica, idAutor, idTexto, idStatus, categoria = 'Ajuste de Tom') {
    const autor = document.getElementById(idAutor).value;
    const texto = document.getElementById(idTexto).value;
    const statusEl = document.getElementById(idStatus);
    if (!autor || !texto) { mostrarToast('Preencha seu nome e a solicitação.', 'aviso'); return; }
    statusEl.textContent = 'Enviando...';
    statusEl.classList.remove('hidden');
    try {
        if (!supabaseClient) {
            throw new Error("Cliente Supabase não inicializado.");
        }

        const { error } = await supabaseClient
            .from('availability_comments')
            .insert({
                category: categoria || 'Ajuste de Tom',
                comment_text: `${musica} - (${autor}): ${texto}`
            });

        if (!error) {
            statusEl.textContent = 'Enviado!';
            document.getElementById(idTexto).value = '';
            setTimeout(() => statusEl.classList.add('hidden'), 4000);
        } else {
            statusEl.textContent = 'Erro ao enviar.';
        }
    } catch (error) {
        console.error('Erro ao enviar comentário:', error);
        statusEl.textContent = 'Erro ao enviar.';
    }
}
