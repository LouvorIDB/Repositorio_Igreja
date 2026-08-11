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

            const escala = service.musicians_scale || (service.service_scales && service.service_scales[0]) || {
                violao: service.guitar_player || '',
                bateria: service.drummer || '',
                teclado: service.keyboard_player || ''
            };
            const colF = typeof escala === 'string' ? escala : JSON.stringify(escala);
            const colG = service.singers_list || service.singers || '';

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

                cultosFormatados.push([nomeMusica, tom, variacao, vs, yt, '', cantoresMusica]);
            });
        });

        // Formata Banco, Repertorio e Novas
        const headerMusicas = ["Música", "Tom", "Variação", "VS", "YouTube"];
        const bancoFormatado = [headerMusicas];
        const repertorioFormatado = [headerMusicas];
        const novasFormatadas = [headerMusicas];

        (songsData || []).forEach(song => {
            const version = (song.song_versions && song.song_versions[0]) || {};
            const nomeMusica = song.title || '';
            const tom = version.key || song.key || '';
            const variacao = version.variation || song.variation || 'Original';
            const vs = version.drive_vs_url || version.drive_url || song.drive_vs_url || song.drive_url || '';
            const yt = version.youtube_url || song.youtube_url || '';

            const linhaMusica = [nomeMusica, tom, variacao, vs, yt];
            bancoFormatado.push(linhaMusica);

            if (song.status === 'nova') {
                novasFormatadas.push(linhaMusica);
            } else {
                repertorioFormatado.push(linhaMusica);
            }
        });

        // Formata Cantores
        const cantoresFormatados = [["Nome", "Telefone", "Instrumentos"]];
        (profilesData || []).forEach(profile => {
            const nome = profile.name || '';
            const telefone = profile.phone || '';
            const inst = Array.isArray(profile.instruments)
                ? profile.instruments.join(', ')
                : (profile.instruments || profile.role || '');
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
            if (instrObj.violao) partsEscala.push(`🎸 ${instrObj.violao}`);
            if (instrObj.bateria) partsEscala.push(`🥁 ${instrObj.bateria}`);
            if (instrObj.teclado) partsEscala.push(`🎹 ${instrObj.teclado}`);
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

            const fileId = extrairIdDrive(vsCelular);
            const linkYoutubeFinal = obterLinkYoutube(ytDado, musica);
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
                            ${vsCelular ? `<button onclick="playDriveAudio('${musica.toString().replace(/'/g, "\\'")}','${fileId}','${vsCelular}')" class="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition">▶ Ouvir VS</button>` : ''}
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

function renderizarRepertorio(rows) {
    const container = document.getElementById('musicList');
    container.innerHTML = '';
    for (let i = 1; i < rows.length; i++) {
        const [musica, tom, variacaoTom, vsCelular, ytDado] = rows[i];
        if (!musica) continue;
        const fileId = extrairIdDrive(vsCelular);
        const linkYoutubeFinal = obterLinkYoutube(ytDado, musica);
        const cardId = `rep-${i}`;
        const card = document.createElement('div');
        card.className = "bg-slate-800 p-4 rounded-xl border border-slate-700 space-y-3 hover:border-slate-600 transition";
        card.innerHTML = `
            <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h3 class="font-bold text-lg text-white">${musica}</h3>
                    <div class="flex items-center gap-2 mt-1 text-sm text-slate-400">
                        <span class="bg-slate-700 px-2 py-0.5 rounded text-emerald-300 font-semibold">Tom: ${tom} (${variacaoTom || 'Original'})</span>
                    </div>
                </div>
                <div class="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
                    ${vsCelular ? `<button onclick="playDriveAudio('${musica.toString().replace(/'/g, "\\'")}','${fileId}','${vsCelular}')" class="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-2 rounded-lg text-sm font-medium transition">▶ Ouvir VS</button>` : ''}
                    ${linkYoutubeFinal ? `<button onclick="playYoutubeAudio('${musica.toString().replace(/'/g, "\\'")}','${linkYoutubeFinal}')" class="bg-red-600 hover:bg-red-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition">📺 YouTube</button>` : ''}
                    <button onclick="toggleComentario('${cardId}')" class="bg-slate-700 hover:bg-slate-600 text-slate-200 px-3 py-2 rounded-lg text-sm font-medium transition">💬 Pedir Ajuste / Tom</button>
                </div>
            </div>
            <div id="${cardId}" class="hidden pt-3 border-t border-slate-700 mt-3 space-y-2">
                <div class="flex gap-2">
                    <input type="text" id="autor-${i}" placeholder="Seu nome" class="w-1/3 bg-slate-900 border border-slate-700 px-3 py-2 rounded text-sm text-white focus:outline-none focus:border-emerald-500">
                    <input type="text" id="comentario-${i}" placeholder="Ex: Mudar tom para C..." class="w-2/3 bg-slate-900 border border-slate-700 px-3 py-2 rounded text-sm text-white focus:outline-none focus:border-emerald-500">
                    <button onclick="enviarComentario('${musica.toString().replace(/'/g, "\\'")}','autor-${i}','comentario-${i}','status-${i}','Ajuste de Tom')" class="bg-emerald-700 hover:bg-emerald-600 text-white px-4 py-2 rounded text-sm font-medium">Enviar</button>
                </div>
                <p id="status-${i}" class="text-xs text-emerald-400 hidden">Solicitação enviada com sucesso!</p>
            </div>
        `;
        container.appendChild(card);
    }
}

function renderizarMusicasNovas(rows) {
    const container = document.getElementById('novasList');
    container.innerHTML = '';
    if (!rows || rows.length <= 1) {
        container.innerHTML = '<p class="text-center text-slate-500 py-10">Nenhuma música nova cadastrada ainda.</p>';
        return;
    }
    for (let i = 1; i < rows.length; i++) {
        const [musica, tom, variacaoTom, vsCelular, ytDado] = rows[i];
        if (!musica) continue;
        const fileId = extrairIdDrive(vsCelular);
        const linkYoutubeFinal = obterLinkYoutube(ytDado, musica);
        const cardId = `nova-${i}`;
        const card = document.createElement('div');
        card.className = "bg-slate-800 p-4 rounded-xl border border-violet-700/30 space-y-3 hover:border-violet-600/50 transition";
        card.innerHTML = `
            <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h3 class="font-bold text-lg text-white">${musica}</h3>
                    <div class="flex items-center gap-2 mt-1 text-sm text-slate-400">
                        <span class="bg-slate-700 px-2 py-0.5 rounded text-emerald-300 font-semibold">Tom: ${tom} (${variacaoTom || 'Original'})</span>
                    </div>
                </div>
                <div class="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
                    ${vsCelular ? `<button onclick="playDriveAudio('${musica.toString().replace(/'/g, "\\'")}','${fileId}','${vsCelular}')" class="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-2 rounded-lg text-sm font-medium transition">▶ Ouvir VS</button>` : ''}
                    ${linkYoutubeFinal ? `<button onclick="playYoutubeAudio('${musica.toString().replace(/'/g, "\\'")}','${linkYoutubeFinal}')" class="bg-red-600 hover:bg-red-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition">📺 YouTube</button>` : ''}
                    <button onclick="toggleComentario('${cardId}')" class="bg-slate-700 hover:bg-slate-600 text-slate-200 px-3 py-2 rounded-lg text-sm font-medium transition">💬 Pedir Ajuste / Tom</button>
                </div>
            </div>
            <div id="${cardId}" class="hidden pt-3 border-t border-slate-700 mt-3 space-y-2">
                <div class="flex gap-2">
                    <input type="text" id="autor-n-${i}" placeholder="Seu nome" class="w-1/3 bg-slate-900 border border-slate-700 px-3 py-2 rounded text-sm text-white focus:outline-none focus:border-emerald-500">
                    <input type="text" id="comentario-n-${i}" placeholder="Ex: Mudar tom para C..." class="w-2/3 bg-slate-900 border border-slate-700 px-3 py-2 rounded text-sm text-white focus:outline-none focus:border-emerald-500">
                    <button onclick="enviarComentario('${musica.toString().replace(/'/g, "\\'")}','autor-n-${i}','comentario-n-${i}','status-n-${i}','Ajuste de Tom')" class="bg-emerald-700 hover:bg-emerald-600 text-white px-4 py-2 rounded text-sm font-medium">Enviar</button>
                </div>
                <p id="status-n-${i}" class="text-xs text-emerald-400 hidden">Solicitação enviada com sucesso!</p>
            </div>
        `;
        container.appendChild(card);
    }
}

async function moverMusicasNovasParaBanco() {
    const btn = document.getElementById('btn-mover-novas');
    const statusDiv = document.getElementById('status-mover-novas');

    if (dadosGlobais.novas.length <= 1) {
        statusDiv.textContent = '⚠️ Nenhuma música nova encontrada na planilha.';
        statusDiv.classList.remove('hidden');
        return;
    }

    if (!confirm(`Mover ${dadosGlobais.novas.length - 1} música(s) da aba "Músicas Novas" para o Banco_Musicas e ordenar A-Z?\n\nEsta ação não pode ser desfeita.`)) return;

    btn.textContent = 'Movendo...';
    btn.disabled = true;
    statusDiv.classList.add('hidden');

    try {
        const response = await fetch(WEB_APP_URL, {
            method: 'POST',
            body: JSON.stringify({ acao: 'moverMusicasNovas' })
        });
        const resData = await response.json();

        if (resData && resData.status === 'sucesso') {
            limparCacheLocal();
            statusDiv.textContent = '✅ Músicas movidas para o Banco com sucesso! A planilha foi ordenada A-Z. Recarregue o site para ver as mudanças.';
            statusDiv.classList.remove('hidden');
            await carregarDados();
        } else {
            const msgErro = (resData && resData.message) ? resData.message : 'Erro ao mover músicas. Tente novamente.';
            statusDiv.textContent = '❌ Erro: ' + msgErro;
            statusDiv.classList.remove('hidden');
        }
    } catch (err) {
        console.error('Erro ao mover músicas:', err);
        statusDiv.textContent = '❌ Erro ao mover músicas. Tente novamente.';
        statusDiv.classList.remove('hidden');
    } finally {
        btn.textContent = '🌟 Mover Músicas Novas → Banco';
        btn.disabled = false;
    }
}

function filtrarMusicas() {
    const termo = document.getElementById('searchInput').value.toLowerCase();
    const rows = dadosGlobais.repertorio;
    const container = document.getElementById('musicList');
    container.innerHTML = '';
    for (let i = 1; i < rows.length; i++) {
        const [musica, tom, variacaoTom, vsCelular, ytDado] = rows[i];
        if (!musica || !musica.toString().toLowerCase().includes(termo)) continue;
        const fileId = extrairIdDrive(vsCelular);
        const linkYoutubeFinal = obterLinkYoutube(ytDado, musica);
        const cardId = `rep-filtrado-${i}`;
        const card = document.createElement('div');
        card.className = "bg-slate-800 p-4 rounded-xl border border-slate-700 space-y-3 hover:border-slate-600 transition";
        card.innerHTML = `
            <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h3 class="font-bold text-lg text-white">${musica}</h3>
                    <div class="flex items-center gap-2 mt-1 text-sm text-slate-400">
                        <span class="bg-slate-700 px-2 py-0.5 rounded text-emerald-300 font-semibold">Tom: ${tom} (${variacaoTom || 'Original'})</span>
                    </div>
                </div>
                <div class="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
                    ${vsCelular ? `<button onclick="playDriveAudio('${musica.toString().replace(/'/g, "\\'")}','${fileId}','${vsCelular}')" class="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-2 rounded-lg text-sm font-medium transition">▶ Ouvir VS</button>` : ''}
                    ${linkYoutubeFinal ? `<button onclick="playYoutubeAudio('${musica.toString().replace(/'/g, "\\'")}','${linkYoutubeFinal}')" class="bg-red-600 hover:bg-red-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition">📺 YouTube</button>` : ''}
                    <button onclick="toggleComentario('${cardId}')" class="bg-slate-700 hover:bg-slate-600 text-slate-200 px-3 py-2 rounded-lg text-sm font-medium transition">💬 Pedir Ajuste / Tom</button>
                </div>
            </div>
            <div id="${cardId}" class="hidden pt-3 border-t border-slate-700 mt-3 space-y-2">
                <div class="flex gap-2">
                    <input type="text" id="autor-f-${i}" placeholder="Seu nome" class="w-1/3 bg-slate-900 border border-slate-700 px-3 py-2 rounded text-sm text-white focus:outline-none focus:border-emerald-500">
                    <input type="text" id="comentario-f-${i}" placeholder="Ex: Mudar tom para C..." class="w-2/3 bg-slate-900 border border-slate-700 px-3 py-2 rounded text-sm text-white focus:outline-none focus:border-emerald-500">
                    <button onclick="enviarComentario('${musica.toString().replace(/'/g, "\\'")}','autor-f-${i}','comentario-f-${i}','status-f-${i}','Ajuste de Tom')" class="bg-emerald-700 hover:bg-emerald-600 text-white px-4 py-2 rounded text-sm font-medium">Enviar</button>
                </div>
                <p id="status-f-${i}" class="text-xs text-emerald-400 hidden">Solicitação enviada com sucesso!</p>
            </div>
        `;
        container.appendChild(card);
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
        const response = await fetch(WEB_APP_URL, {
            method: 'POST',
            body: JSON.stringify({ musica, autor, texto, categoria })
        });
        const resData = await response.json();
        if (resData && resData.status === 'sucesso') {
            statusEl.textContent = 'Enviado!';
            document.getElementById(idTexto).value = '';
            setTimeout(() => statusEl.classList.add('hidden'), 4000);
        } else {
            statusEl.textContent = (resData && resData.message) ? resData.message : 'Erro ao enviar.';
        }
    } catch (error) {
        console.error('Erro ao enviar comentário:', error);
        statusEl.textContent = 'Erro ao enviar.';
    }
}
