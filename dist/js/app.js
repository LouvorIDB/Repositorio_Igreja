// ===================== INICIALIZAÇÃO =====================

window.addEventListener('DOMContentLoaded', async () => {
    // 0. Fallback de segurança para a tela de carregamento (não travar em caso de erro de rede ou lentidão)
    const splashTimeout = setTimeout(() => {
        if (typeof finalizarTelaCarregamento === 'function') {
            finalizarTelaCarregamento();
        }
    }, 3500);

    // Passo 2: Pré-hidratação visual imediata com dados em cache para evitar qualquer piscada de tela
    if (window.__CACHED_CHURCH__ && !dadosGlobais.church) {
        dadosGlobais.church = window.__CACHED_CHURCH__;
    }
    if (window.__CACHED_USER__ && !usuarioLogado) {
        usuarioLogado = window.__CACHED_USER__;
        const sessionBar = document.getElementById('user-session-bar');
        const nameEl = document.getElementById('user-session-name');
        const roleEl = document.getElementById('user-session-role');
        if (sessionBar) sessionBar.classList.remove('hidden');
        if (nameEl) nameEl.textContent = usuarioLogado.name || usuarioLogado.email || 'Usuário';
        if (roleEl) {
            let rRole = (usuarioLogado.system_role || usuarioLogado.role || 'voluntário').toLowerCase();
            if (rRole === 'volunteer') rRole = 'voluntário';
            roleEl.textContent = rRole.toUpperCase();
        }
    }

    const isCapacitorApp = !!(window.Capacitor && (typeof window.Capacitor.isNativePlatform === 'function' ? window.Capacitor.isNativePlatform() : true)) || window.location.hostname === 'localhost';

    // 0.1 No app móvel nativo (Capacitor), os arquivos já são locais no APK.
    // Desregistramos qualquer Service Worker e limpamos o CacheStorage para garantir que
    // o app sempre carregue as views e scripts mais recentes sem reter cache antigo.
    if (isCapacitorApp) {
        if ('serviceWorker' in navigator) {
            try {
                const regs = await navigator.serviceWorker.getRegistrations();
                for (const reg of regs) {
                    await reg.unregister();
                }
            } catch (e) {}
        }
        if ('caches' in window) {
            try {
                const cacheNames = await caches.keys();
                for (const name of cacheNames) {
                    await caches.delete(name);
                }
            } catch (e) {}
        }
    }

    // 0.5. Aguarda que todas as views e templates HTML estejam injetados no DOM
    if (window.ViewLoader && typeof window.ViewLoader.initAllViews === 'function') {
        await window.ViewLoader.initAllViews();
    }

    const params = new URLSearchParams(window.location.search);
    if (params.get('admin') === 'true') {
        document.getElementById('btn-admin-wrapper').classList.remove('hidden');
    }

    // 1. Primeiro verifica quem é o usuário logado para saber a igreja dele
    await verificarSessaoAtiva();
    // 2. Depois carrega os dados com base na igreja identificada
    await carregarDados();

    // 3. Libera a tela de carregamento suavemente após renderização completa
    clearTimeout(splashTimeout);
    if (typeof finalizarTelaCarregamento === 'function') {
        finalizarTelaCarregamento();
    }

    // Registra Service Worker exclusivamente no navegador Web (PWA), nunca no app nativo Capacitor
    if (!isCapacitorApp && 'serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js').catch(err => {
            console.warn('Falha ao registrar Service Worker:', err);
        });
    }

    // Tenta sincronizar solicitações offline se houver pendentes
    if (navigator.onLine) {
        setTimeout(sincronizarSolicitacoesOffline, 2000);
        setTimeout(inicializarRealtimeListeners, 1500);
    }
});

let realtimeChannel = null;

function inicializarRealtimeListeners() {
    if (!supabaseClient || realtimeChannel || !navigator.onLine) return;

    try {
        realtimeChannel = supabaseClient
            .channel('louvor-realtime-channel')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'services' },
                (payload) => {
                    console.log('⚡ [Realtime] Alteração na tabela de cultos:', payload);
                    if (typeof carregarDados === 'function') carregarDados();
                    if (typeof mostrarToast === 'function') {
                        mostrarToast('⚡ Escala/Culto atualizado em tempo real!', 'sucesso');
                    }
                }
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'availability_comments' },
                (payload) => {
                    console.log('⚡ [Realtime] Nova solicitação/comentário:', payload);
                    if (typeof renderizarAdminListaSolicitacoes === 'function') {
                        renderizarAdminListaSolicitacoes();
                    }
                    if (typeof mostrarToast === 'function') {
                        mostrarToast('💬 Nova solicitação ou ajuste recebido!', 'aviso');
                    }
                }
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'songs' },
                (payload) => {
                    console.log('⚡ [Realtime] Alteração no banco de músicas:', payload);
                    if (typeof carregarDados === 'function') carregarDados();
                }
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'song_versions' },
                (payload) => {
                    console.log('⚡ [Realtime] Alteração em versão de música:', payload);
                    if (typeof carregarDados === 'function') carregarDados();
                }
            )
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    console.log('⚡ [Realtime] Conectado com sucesso ao Supabase Realtime!');
                }
            });
    } catch (err) {
        console.warn('Aviso ao inicializar Supabase Realtime:', err);
    }
}

// Listener global para reconexão
window.addEventListener('online', () => {
    if (typeof mostrarToast === 'function') mostrarToast('🟢 Conexão com a internet reestabelecida!', 'sucesso');
    sincronizarSolicitacoesOffline();
    if (typeof carregarDados === 'function') carregarDados();
});

window.addEventListener('offline', () => {
    if (typeof mostrarToast === 'function') mostrarToast('📶 Modo Offline Ativo (Navegando via cache local)', 'aviso');
});

async function carregarDadosOffline() {
    console.warn("Sem conexão. Carregando repertório e cultos do IndexedDB...");
    try {
        if (!window.LocalDB) return false;

        const repertorioLocal = await window.LocalDB.obterRepertorio();
        const novasLocais = await window.LocalDB.obterNovas();
        const cultosLocais = await window.LocalDB.obterCultos();

        if (repertorioLocal.length > 0 || cultosLocais.length > 0 || novasLocais.length > 0) {
            dadosGlobais.repertorio = repertorioLocal;
            dadosGlobais.novas = novasLocais;
            dadosGlobais.cultos = cultosLocais;

            if (typeof renderizarCultos === 'function') renderizarCultos(dadosGlobais.cultos);
            if (typeof renderizarRepertorio === 'function') renderizarRepertorio(dadosGlobais.repertorio);
            if (typeof renderizarMusicasNovas === 'function') renderizarMusicasNovas(dadosGlobais.novas);

            if (typeof mostrarToast === 'function') {
                mostrarToast('📶 Modo Offline Ativo (Dados carregados do cache local)', 'aviso');
            }
            return true;
        }
    } catch (err) {
        console.error("Erro ao carregar dados do IndexedDB:", err);
    }
    return false;
}

async function sincronizarSolicitacoesOffline() {
    if (!navigator.onLine || !supabaseClient || !window.LocalDB) return;

    try {
        const fila = await window.LocalDB.obterSolicitacoesOffline();
        if (!fila || fila.length === 0) return;

        console.log(`📶 Sincronizando ${fila.length} solicitações salvas offline...`);
        let sucessos = 0;

        for (const item of fila) {
            const { error } = await supabaseClient
                .from('availability_comments')
                .insert({
                    church_id: window.dadosGlobais?.church?.id || usuarioLogado?.church_id,
                    category: item.category || 'Ajuste de Tom',
                    comment_text: item.comment_text
                });

            if (!error) {
                sucessos++;
                if (item.id) {
                    await window.LocalDB.removerSolicitacaoOffline(item.id);
                }
            }
        }

        if (sucessos > 0) {
            mostrarToast(`🟢 Conexão reestabelecida! ${sucessos} solicitação(ões) enviada(s) offline foram sincronizadas com sucesso.`, 'sucesso');
            if (typeof renderizarAdminListaSolicitacoes === 'function') {
                renderizarAdminListaSolicitacoes();
            }
        }
    } catch (err) {
        console.error("Erro ao sincronizar solicitações offline:", err);
    }
}

// ===================== CONTROLE DA TELA DE CARREGAMENTO (SPLASH SCREEN) =====================
function finalizarTelaCarregamento() {
    const splash = document.getElementById('app-splash-screen');
    if (!splash || splash.dataset.finalizado === 'true') return;
    splash.dataset.finalizado = 'true';
    splash.classList.add('opacity-0', 'pointer-events-none');
    setTimeout(() => {
        splash.style.display = 'none';
    }, 550);
}
window.finalizarTelaCarregamento = finalizarTelaCarregamento;

async function carregarDados() {
    try {
        if (!supabaseClient) {
            throw new Error("Cliente Supabase não inicializado.");
        }

        // 1. Identificar a Igreja Ativa para Multi-Tenant RLS
        let currentChurchId = null;
        if (!dadosGlobais.church && window.__CACHED_CHURCH__) {
            dadosGlobais.church = window.__CACHED_CHURCH__;
        }
        if (dadosGlobais.church && dadosGlobais.church.id) {
            currentChurchId = dadosGlobais.church.id;
        }

        // Se o usuário está logado, a igreja dele tem prioridade
        if (usuarioLogado && usuarioLogado.church_id) {
            currentChurchId = usuarioLogado.church_id;
            const { data: cData } = await supabaseClient.from('churches').select('*').eq('id', currentChurchId).maybeSingle();
            if (cData) {
                dadosGlobais.church = cData;
                try {
                    localStorage.setItem('cached_church_data', JSON.stringify(cData));
                } catch (e) {}
            }
        }

        // Se não achou por login, tenta buscar pela TAG na URL (?tag=..., ?c=..., ?church=...)
        if (!currentChurchId) {
            const params = new URLSearchParams(window.location.search);
            const tag = params.get('tag') || params.get('c') || params.get('church');
            if (tag) {
                const { data: cData } = await supabaseClient.from('churches').select('*').eq('slug', tag.toLowerCase().trim()).maybeSingle();
                if (cData) {
                    dadosGlobais.church = cData;
                    currentChurchId = cData.id;
                    try {
                        localStorage.setItem('cached_church_data', JSON.stringify(cData));
                    } catch (e) {}
                }
            }
        }

        // Se NÃO há igreja definida (usuário deslogado sem TAG na URL)
        if (!currentChurchId) {
            dadosGlobais.church = null;
            try { localStorage.removeItem('cached_church_data'); } catch (e) {}
            exibirLandingBoasVindas();
            finalizarTelaCarregamento();
            return;
        }

        // Se a igreja está pendente de aprovação
        if (dadosGlobais.church && dadosGlobais.church.status === 'pending') {
            exibirLandingPendente(dadosGlobais.church);
            finalizarTelaCarregamento();
            return;
        }

        // Oculta a landing de boas-vindas caso estivesse aparecendo e mostra o container principal
        ocultarLandingBoasVindas();

        // 2. Buscar cultos ('services') da igreja ordenados por data
        let servicesQuery = supabaseClient
            .from('services')
            .select(`
                *,
                service_scales (
                    *,
                    profiles:user_id (id, name),
                    ministry_roles:role_id (id, name)
                ),
                service_media (*),
                service_songs (
                    *,
                    song_versions (
                        *,
                        songs (*)
                    )
                )
            `)
            .order('date', { ascending: true });

        if (currentChurchId) {
            servicesQuery = servicesQuery.eq('church_id', currentChurchId);
        }
        const { data: servicesData, error: servicesErr } = await servicesQuery;
        if (servicesErr) throw servicesErr;

        // 3. Buscar banco de músicas ('songs') da igreja com suas versões
        let songsQuery = supabaseClient
            .from('songs')
            .select(`
                *,
                song_versions (*)
            `)
            .order('title', { ascending: true });

        if (currentChurchId) {
            songsQuery = songsQuery.eq('church_id', currentChurchId);
        }
        const { data: songsData, error: songsErr } = await songsQuery;
        if (songsErr) throw songsErr;

        // Buscar integrantes/cantores ('profiles') da igreja e suas funções vinculadas
        let profilesData = [];
        try {
            let pQuery = supabaseClient.from('profiles').select('*');
            if (currentChurchId) pQuery = pQuery.eq('church_id', currentChurchId);
            const { data: pData } = await pQuery;
            const { data: umrData } = await supabaseClient.from('user_ministry_roles').select('*, ministry_roles(*)');
            let mlData = [];
            try {
                const { data: mlRes } = await supabaseClient.from('ministry_leaders').select('*');
                if (mlRes) mlData = mlRes;
            } catch(e) {}

            const rolesMap = {};
            const umrByProfile = {};
            const mlByProfile = {};

            (umrData || []).forEach(ur => {
                const pid = ur.profile_id || ur.user_id;
                if (pid) {
                    if (!rolesMap[pid]) rolesMap[pid] = [];
                    if (!umrByProfile[pid]) umrByProfile[pid] = [];
                    
                    const roleName = ur.ministry_roles ? ur.ministry_roles.name : (ur.role_name || ur.name);
                    if (roleName) rolesMap[pid].push(roleName);
                    umrByProfile[pid].push(ur);
                }
            });

            (mlData || []).forEach(ml => {
                const pid = ml.profile_id;
                if (pid) {
                    if (!mlByProfile[pid]) mlByProfile[pid] = [];
                    mlByProfile[pid].push(ml.ministry_id);
                }
            });

            if (pData) {
                pData.forEach(p => {
                    p.user_ministry_roles = umrByProfile[p.id] || [];
                    p.lider_de = mlByProfile[p.id] || [];
                    p.roleNames = (rolesMap[p.id] && rolesMap[p.id].length > 0) 
                        ? rolesMap[p.id] 
                        : (Array.isArray(p.roles) ? p.roles : (p.roles || p.instruments || '').split(',').map(s=>s.trim()).filter(Boolean));
                });
                profilesData = pData;
            }

            if (usuarioLogado && usuarioLogado.id) {
                usuarioLogado.lider_de = mlByProfile[usuarioLogado.id] || usuarioLogado.lider_de || [];
            }
        } catch (e) {
            console.warn('Tabela profiles ou user_ministry_roles não consultada:', e);
        }

        let minQuery = supabaseClient
            .from('ministries')
            .select('*, ministry_roles(*)')
            .order('name');
        if (currentChurchId) {
            minQuery = minQuery.eq('church_id', currentChurchId);
        }
        const { data: ministriesData, error: minErr } = await minQuery;

        if (minErr) {
            console.warn('Aviso ao carregar ministérios:', minErr);
        }
        dadosGlobais.ministries = ministriesData || [];
        dadosGlobais.services = servicesData || [];
        console.log('Ministérios Carregados com Sucesso:', dadosGlobais.ministries);

        if (typeof atualizarTemaGlobal === 'function') {
            atualizarTemaGlobal();
        }

        // Tentar auto-migração suave de escalas antigas em JSON (notes) para a tabela service_scales se necessário
        if (typeof migrarNotasParaServiceScalesSeNecessario === 'function') {
            migrarNotasParaServiceScalesSeNecessario(servicesData);
        }

        // 4. Formatação dos resultados do Supabase no formato das matrizes dadosGlobais

        // Formata Cultos
        const cultosFormatados = [];
        (servicesData || []).forEach(service => {
            let tituloHeader = service.title || `CULTO DE ${(service.type || 'DOMINGO').toUpperCase()} - ${service.date || ''}`;
            let isOculto = service.status === 'arquivado' || service.is_hidden || (service.title && service.title.toUpperCase().includes('OCULTO'));
            let isEmMontagem = service.is_draft || service.status === 'aberto' || (service.title && service.title.toUpperCase().includes('EM MONTAGEM'));

            if (service.notes) {
                try {
                    const pn = JSON.parse(service.notes);
                    if (pn && typeof pn === 'object') {
                        if (pn.em_montagem !== undefined) isEmMontagem = !!pn.em_montagem;
                        else if (pn.is_draft !== undefined) isEmMontagem = !!pn.is_draft;
                        if (pn.oculto !== undefined) isOculto = !!pn.oculto;
                        else if (pn.is_hidden !== undefined) isOculto = !!pn.is_hidden;
                    }
                } catch(e){}
            }

            if (isOculto && !tituloHeader.toUpperCase().includes('OCULTO')) {
                tituloHeader += " - OCULTO";
            }
            if (isEmMontagem && !tituloHeader.toUpperCase().includes('EM MONTAGEM')) {
                tituloHeader += " - EM MONTAGEM";
            }

            let escala = { violao: '', bateria: '', teclado: '' };
            let cantoresCultoList = [];
            let cantoresCultoStr = service.singers_list || service.singers || '';

            // Se existirem escalas relacionais na tabela service_scales
            if (service.service_scales && service.service_scales.length > 0) {
                service.service_scales.forEach(scaleItem => {
                    const profileName = scaleItem.profiles ? scaleItem.profiles.name : (scaleItem.profile_name || '');
                    const roleName = scaleItem.ministry_roles ? scaleItem.ministry_roles.name : (scaleItem.role_name || '');
                    const rScope = scaleItem.ministry_roles ? scaleItem.ministry_roles.scale_scope : null;
                    const rLow = roleName.toLowerCase();
                    const isSongScope = rScope === 'song' || (!rScope && (rLow.includes('cantor') || rLow.includes('vocal') || (!roleName && profileName)));
                    if (isSongScope) {
                        if (profileName && !cantoresCultoList.includes(profileName)) {
                            cantoresCultoList.push(profileName);
                        }
                    } else if (roleName) {
                        escala[roleName] = profileName;
                    }
                });
            }

            // Fallback 1: Buscar cantores e escalas em service.notes (JSON)
            if (service.notes) {
                try {
                    const parsedNotes = JSON.parse(service.notes);
                    if (cantoresCultoList.length === 0 && parsedNotes.cantores && Array.isArray(parsedNotes.cantores)) {
                        cantoresCultoList = [...parsedNotes.cantores];
                    }
                    if (parsedNotes.escala && typeof parsedNotes.escala === 'object') {
                        Object.keys(parsedNotes.escala).forEach(k => {
                            if (!escala[k] && parsedNotes.escala[k]) escala[k] = parsedNotes.escala[k];
                        });
                    }
                } catch(e){}
            }

            // Fallback 2: Se veio como string singers_list ou singers direto do service
            if (cantoresCultoList.length === 0 && cantoresCultoStr) {
                cantoresCultoList = cantoresCultoStr.split(',').map(s => s.trim()).filter(Boolean);
            }

            // Fallback 3: Se ainda não tiver cantores, agrega os cantores vinculados às músicas deste culto
            if (cantoresCultoList.length === 0 && service.service_songs && service.service_songs.length > 0) {
                service.service_songs.forEach(ss => {
                    const sSingers = (ss.singers_list || ss.singers || '').split(',').map(s => s.trim()).filter(Boolean);
                    sSingers.forEach(sName => {
                        if (!cantoresCultoList.includes(sName)) cantoresCultoList.push(sName);
                    });
                });
            }

            if (cantoresCultoList.length > 0) {
                cantoresCultoStr = cantoresCultoList.join(', ');
            }

            const colF = JSON.stringify(escala);
            const colG = cantoresCultoStr;
            const mediaUrls = JSON.stringify(service.service_media && service.service_media.length > 0 ? service.service_media : (service.media_urls || []));

            cultosFormatados.push([tituloHeader, '', '', '', '', colF, colG, mediaUrls, service.id]);

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
                const chords = version.chords || song.chords || sSong.chords || '';
                const artist = song.artist || version.artist || sSong.artist || '';

                cultosFormatados.push([nomeMusica, tom, variacao, vs, yt, '', cantoresMusica, lyrics, chords, artist]);
            });
        });

        // Formata Banco, Repertorio e Novas
        const bancoFormatado = [];
        
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
                bancoFormatado.push({
                    nome: nomeMusica, 
                    tom: v.key || '', 
                    variacao: v.variation || 'Original', 
                    vs: v.drive_vs_url || v.drive_url || '', 
                    yt: v.youtube_url || ''
                });
            });

            // Estrutura agrupada para a Interface de Repertório/Novas
            const objMusica = {
                id: songId,
                title: nomeMusica,
                artist: song.artist || '',
                status: status,
                lyrics: song.lyrics || '',
                chords: song.chords || '',
                versions: versoes.map(v => ({
                    id: v.id,
                    key: v.key || '',
                    variation: v.variation || 'Original',
                    vs: v.drive_vs_url || v.drive_url || '',
                    yt: v.youtube_url || '',
                    lyrics: v.lyrics || song.lyrics || '',
                    chords: v.chords || song.chords || ''
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

        dadosGlobais.cultos = dataObj.cultos;
        dadosGlobais.repertorio = dataObj.repertorio;
        dadosGlobais.banco = dataObj.banco;
        dadosGlobais.cantores = dataObj.cantores;
        dadosGlobais.voluntarios = profilesData || [];
        dadosGlobais.profiles = profilesData || [];
        dadosGlobais.novas = dataObj.novas;
        dadosGlobais.servicesDataList = servicesData || [];

        aplicarVisibilidadePermissoes();
        carregarOpcoesSimulacaoPerfil();

        try {
            renderizarCultos(dadosGlobais.cultos);
        } catch (errCultos) {
            console.error("Erro ao renderizar cultos:", errCultos);
        }

        try {
            renderizarRepertorio(dadosGlobais.repertorio);
        } catch (errRep) {
            console.error("Erro ao renderizar repertório:", errRep);
        }

        try {
            renderizarMusicasNovas(dadosGlobais.novas);
        } catch (errNovas) {
            console.error("Erro ao renderizar músicas novas:", errNovas);
        }
        
        if (isAdmin) {
            try {
                renderizarAdminListaCultos();
                if (typeof renderizarHistoricoCultos === 'function') {
                    renderizarHistoricoCultos();
                }
            } catch (errAdmin) {
                console.error("Erro ao renderizar painel admin:", errAdmin);
            }
        }
        if (typeof finalizarTelaCarregamento === 'function') {
            finalizarTelaCarregamento();
        }
    } catch (error) {
        console.error("Erro ao carregar dados do Supabase:", error);
        if (typeof finalizarTelaCarregamento === 'function') {
            finalizarTelaCarregamento();
        }
        const carregouOffline = await carregarDadosOffline();
        if (!carregouOffline) {
            const secaoCultos = document.getElementById('secao-cultos');
            if (secaoCultos) {
                secaoCultos.innerHTML = '<div class="text-center py-12"><p class="text-red-400 font-medium">Erro ao conectar com o banco de dados e nenhum cache offline encontrado.</p><button onclick="carregarDados()" class="mt-3 bg-brand-600 hover:bg-brand-500 text-white px-4 py-2 rounded-lg text-xs">Tentar Novamente 🔄</button></div>';
            }
        }
    }
}

// ===================== CONTROLE NAVEGACIONAL DO MENU SIDEBAR / MOBILE =====================
function toggleSidebarMenu(menuId = 'sidebar-menu') {
    const menu = document.getElementById(menuId);
    const backdropId = menuId === 'admin-sidebar-menu' ? 'admin-sidebar-backdrop' : 'sidebar-backdrop';
    const backdrop = document.getElementById(backdropId);
    if (!menu) return;

    const isHidden = menu.classList.contains('hidden');

    if (isHidden) {
        menu.classList.remove('hidden');
        menu.classList.add('flex');
        if (backdrop) backdrop.classList.remove('hidden');
        document.body.classList.add('overflow-hidden');
        if (menuId === 'sidebar-menu' && typeof atualizarSidebarPerfilUsuario === 'function') {
            atualizarSidebarPerfilUsuario();
        }
    } else {
        menu.classList.add('hidden');
        menu.classList.remove('flex');
        if (backdrop) backdrop.classList.add('hidden');
        document.body.classList.remove('overflow-hidden');
    }
}

function fecharSidebarMenu(menuId = 'sidebar-menu') {
    const menu = document.getElementById(menuId);
    const backdropId = menuId === 'admin-sidebar-menu' ? 'admin-sidebar-backdrop' : 'sidebar-backdrop';
    const backdrop = document.getElementById(backdropId);

    if (menu) {
        menu.classList.add('hidden');
        menu.classList.remove('flex');
    }
    if (backdrop) backdrop.classList.add('hidden');
    document.body.classList.remove('overflow-hidden');
}

// Atualizar informações do cabeçalho da sidebar (Avatar, Nome, Igreja, Cargo, Botão Admin)
function atualizarSidebarPerfilUsuario() {
    const userToEvaluate = (typeof modoSimulacaoPerfil !== 'undefined' && modoSimulacaoPerfil) || usuarioLogado;
    const cardLogado = document.getElementById('sidebar-user-card');
    const cardVisitante = document.getElementById('sidebar-guest-card');
    const btnAdminSidebar = document.getElementById('btn-admin-panel-sidebar');

    if (userToEvaluate) {
        if (cardLogado) cardLogado.classList.remove('hidden');
        if (cardVisitante) cardVisitante.classList.add('hidden');

        // Nome de exibição
        const nome = userToEvaluate.name || userToEvaluate.full_name || userToEvaluate.email || 'Usuário';
        const elNome = document.getElementById('sidebar-user-name');
        if (elNome) elNome.textContent = nome;

        // Iniciais para o Avatar estilizado
        const partes = String(nome).trim().split(/\s+/);
        let iniciais = 'US';
        if (partes.length >= 2) {
            iniciais = (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
        } else if (partes.length === 1 && partes[0].length >= 2) {
            iniciais = partes[0].slice(0, 2).toUpperCase();
        } else if (partes.length === 1 && partes[0].length === 1) {
            iniciais = partes[0].toUpperCase();
        }
        const elAvatar = document.getElementById('sidebar-user-avatar');
        if (elAvatar) elAvatar.textContent = iniciais;

        // Nome da Igreja vinculada
        const churchName = dadosGlobais.church?.name || dadosGlobais.church?.tag || (typeof window.obterNomeIgrejaAtual === 'function' ? window.obterNomeIgrejaAtual() : 'Liturge');
        const elChurch = document.getElementById('sidebar-church-label');
        if (elChurch) elChurch.textContent = churchName;

        // Papel e Ministério
        const role = userToEvaluate.system_role || userToEvaluate.role || 'membro';
        let roleLabel = 'Membro';
        if (role === 'admin') roleLabel = 'Administrador';
        else if (role === 'lider') roleLabel = 'Líder';
        else if (role === 'voluntario') roleLabel = 'Voluntário';

        if (role !== 'admin' && userToEvaluate.ministries) {
            roleLabel = `${roleLabel} • ${userToEvaluate.ministries}`;
        }
        const elRole = document.getElementById('sidebar-user-role');
        if (elRole) elRole.textContent = roleLabel;

        // Visibilidade do botão direto para o Painel Admin
        const isLiderOrAdmin = role === 'admin' || role === 'lider' || Boolean(window.isSuperAdmin);
        if (btnAdminSidebar) {
            btnAdminSidebar.classList.toggle('hidden', !isLiderOrAdmin);
        }
    } else {
        if (cardLogado) cardLogado.classList.add('hidden');
        if (cardVisitante) cardVisitante.classList.remove('hidden');
        if (btnAdminSidebar) btnAdminSidebar.classList.add('hidden');
    }
}

// Fechar menu com a tecla ESC no computador
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        fecharSidebarMenu('sidebar-menu');
        fecharSidebarMenu('admin-sidebar-menu');
    }
});

window.toggleSidebarMenu = toggleSidebarMenu;
window.fecharSidebarMenu = fecharSidebarMenu;
window.atualizarSidebarPerfilUsuario = atualizarSidebarPerfilUsuario;

// ===================== SITE PRINCIPAL =====================

function mudarAba(aba) {
    const secoes = { cultos: 'secao-cultos', repertorio: 'secao-repertorio', novas: 'secao-novas', midia: 'secao-midia', agenda: 'secao-agenda', almoxarifado: 'secao-almoxarifado', analytics: 'secao-analytics', holyrics: 'secao-holyrics' };
    const botoes = { cultos: 'btn-cultos', repertorio: 'btn-repertorio', novas: 'btn-novas', midia: 'btn-midia', agenda: 'btn-agenda', almoxarifado: 'btn-almoxarifado', analytics: 'btn-analytics', holyrics: 'btn-holyrics-igreja-container' };
    const ativo = "w-full text-left px-3.5 py-2.5 rounded-xl font-semibold text-sm transition bg-brand-500/15 text-brand-600 dark:text-brand-400 border border-brand-500/30 shadow-xs flex items-center gap-3";
    const inativo = "w-full text-left px-3.5 py-2.5 rounded-xl font-medium text-sm transition text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white border border-transparent flex items-center gap-3";

    const userToEvaluate = modoSimulacaoPerfil || usuarioLogado;
    const roleToEval = userToEvaluate ? (userToEvaluate.system_role || userToEvaluate.role || 'membro') : 'visitante';
    const isAdminToEval = roleToEval === 'admin';
    const isLiderOrAdminToEval = roleToEval === 'admin' || roleToEval === 'lider';
    const userMinIds = typeof obterIdsMinisteriosDoUsuario === 'function' ? obterIdsMinisteriosDoUsuario(userToEvaluate) : (userToEvaluate?.ministry_id ? [userToEvaluate.ministry_id] : []);
    const temMinToEval = userMinIds.length > 0 || isAdminToEval;

    Object.keys(secoes).forEach(key => {
        const sec = document.getElementById(secoes[key]);
        if (sec) sec.classList.toggle('hidden', key !== aba);
        const btn = document.getElementById(botoes[key]);
        if (btn) {
            let shouldHide = false;
            if (key === 'repertorio' && !hasPermission('ver_repertorio')) shouldHide = true;
            if (key === 'novas' && !hasPermission('ver_musicas_novas')) shouldHide = true;
            if (key === 'midia' && !hasPermission('ver_aba_midias_upadas')) shouldHide = true;
            if (key === 'agenda' && !hasPermission('ver_agenda')) shouldHide = true;
            if (key === 'almoxarifado' && !temMinToEval) shouldHide = true;
            if (key === 'analytics' && !isLiderOrAdminToEval) shouldHide = true;
            if (key === 'holyrics' && !hasPermission('gerar_script_holyrics')) shouldHide = true;

            if (shouldHide) {
                btn.className = 'hidden';
            } else {
                if (key === 'holyrics') {
                    btn.className = key === aba 
                        ? "w-full text-left px-3.5 py-2.5 rounded-xl font-semibold text-sm transition bg-cyan-500/15 text-cyan-600 dark:text-cyan-300 border border-cyan-500/30 flex items-center gap-3"
                        : "w-full text-left px-3.5 py-2.5 rounded-xl font-medium text-sm transition text-cyan-600 dark:text-cyan-400 hover:bg-cyan-500/10 border border-transparent flex items-center gap-3";
                } else {
                    btn.className = key === aba ? ativo : inativo;
                }
            }
        }
    });

    if (aba === 'midia') {
        if (typeof carregarMidiasAdmin === 'function') carregarMidiasAdmin();
        else if (typeof renderizarAdminMidias === 'function') renderizarAdminMidias();
    }
    if (aba === 'almoxarifado' && typeof carregarAlmoxarifado === 'function') {
        carregarAlmoxarifado();
    }
    if (aba === 'analytics' && typeof carregarAnalytics === 'function') {
        carregarAnalytics();
    }
    if (aba === 'agenda' && typeof carregarAgenda === 'function') {
        carregarAgenda();
    }
    if (aba === 'holyrics' && typeof carregarConfiguracaoHolyrics === 'function') {
        carregarConfiguracaoHolyrics();
    }
}

let modoSimulacaoPerfil = null;

function hasPermission(key) {
    const userToEvaluate = modoSimulacaoPerfil || usuarioLogado;
    if (!userToEvaluate) return false;
    if (userToEvaluate.system_role === 'admin') return true;
    
    let ministryId = userToEvaluate.ministry_id;
    if (!ministryId && userToEvaluate.ministries) {
        const min = (dadosGlobais.ministries || []).find(m => m.name && m.name.toLowerCase() === userToEvaluate.ministries.toLowerCase());
        if (min) ministryId = min.id;
    }

    if (ministryId && dadosGlobais.ministries) {
        const min = dadosGlobais.ministries.find(m => m.id === ministryId);
        if (min && min.permissions && typeof min.permissions === 'object') {
            if (typeof min.permissions[key] !== 'undefined') {
                return !!min.permissions[key];
            }
        }
    }

    // Se não encontrou permissão de ministério, verifica permissões públicas (visitante / sem ministério)
    if (dadosGlobais.church && dadosGlobais.church.public_permissions) {
        let pubPerms = dadosGlobais.church.public_permissions;
        if (typeof pubPerms === 'string') {
            try { pubPerms = JSON.parse(pubPerms); } catch (e) { pubPerms = {}; }
        }
        if (pubPerms && typeof pubPerms === 'object' && typeof pubPerms[key] !== 'undefined') {
            return !!pubPerms[key];
        }
    }

    // Regras de fallback padrão caso nem as públicas tenham sido configuradas
    if (userToEvaluate.system_role === 'lider' || userToEvaluate.system_role === 'voluntario') {
        const defaultPerms = ['ver_escala', 'ver_letra', 'ver_cifra', 'ver_vs', 'ver_youtube', 'ver_cantor', 'ver_midia', 'enviar_solic_musica', 'ver_repertorio', 'ver_musicas_novas', 'ver_agenda'];
        return defaultPerms.includes(key);
    }
    if (userToEvaluate.system_role === 'membro' || userToEvaluate.system_role === 'visitante') {
        const defaultMembroPerms = ['ver_letra', 'ver_youtube', 'ver_cantor', 'ver_repertorio', 'ver_agenda'];
        return defaultMembroPerms.includes(key);
    }

    return false;
}

function carregarOpcoesSimulacaoPerfil() {
    const selects = [
        document.getElementById('select-modo-simulacao-admin'),
        document.getElementById('select-modo-simulacao-banner')
    ];

    const ministerios = dadosGlobais.ministries || [];

    let html = `
        <option value="admin">👑 Visão Administrador (Acesso Total)</option>
        <option value="membro">👤 Visão Membro Geral (Acesso Super Limitado)</option>
    `;

    ministerios.forEach(min => {
        const minName = min.name || 'Ministério';
        html += `
            <optgroup label="🏢 ${minName}">
                <option value="voluntario_${min.id}">🎸 Visualização Voluntário (${minName})</option>
                <option value="lider_${min.id}">⭐ Visualização Líder (${minName})</option>
            </optgroup>
        `;
    });

    selects.forEach(s => {
        if (s) {
            s.innerHTML = html;
            if (modoSimulacaoPerfil) {
                s.value = modoSimulacaoPerfil.key;
            } else {
                s.value = 'admin';
            }
        }
    });
}

function alterarModoSimulacaoPerfil(valorKey) {
    if (!usuarioLogado || usuarioLogado.system_role !== 'admin') return;

    if (!valorKey || valorKey === 'admin') {
        modoSimulacaoPerfil = null;
    } else if (valorKey === 'membro') {
        modoSimulacaoPerfil = { key: 'membro', system_role: 'membro', ministry_id: null, label: 'Membro Geral (Acesso Limitado)' };
    } else if (valorKey.startsWith('voluntario_')) {
        const minId = valorKey.replace('voluntario_', '');
        const min = (dadosGlobais.ministries || []).find(m => m.id === minId);
        const minName = min ? min.name : 'Ministério';
        modoSimulacaoPerfil = { key: valorKey, system_role: 'voluntario', ministry_id: minId, ministries: minName, label: `Voluntário - ${minName}` };
    } else if (valorKey.startsWith('lider_')) {
        const minId = valorKey.replace('lider_', '');
        const min = (dadosGlobais.ministries || []).find(m => m.id === minId);
        const minName = min ? min.name : 'Ministério';
        modoSimulacaoPerfil = { key: valorKey, system_role: 'lider', ministry_id: minId, ministries: minName, label: `Líder - ${minName}` };
    }

    const bannerEl = document.getElementById('banner-simulacao-perfil');
    const nomeEl = document.getElementById('simulacao-perfil-nome');

    if (modoSimulacaoPerfil) {
        if (bannerEl) bannerEl.classList.remove('hidden');
        if (nomeEl) nomeEl.textContent = modoSimulacaoPerfil.label;
    } else {
        if (bannerEl) bannerEl.classList.add('hidden');
    }

    carregarOpcoesSimulacaoPerfil();
    aplicarVisibilidadePermissoes();

    if (typeof renderizarCultos === 'function') renderizarCultos(dadosGlobais.cultos || []);
    if (typeof renderizarRepertorio === 'function') renderizarRepertorio(dadosGlobais.repertorio || []);
    if (typeof renderizarMusicasNovas === 'function') renderizarMusicasNovas(dadosGlobais.novas || []);
    if (typeof carregarAlmoxarifado === 'function') carregarAlmoxarifado();
    if (typeof renderizarAdminMinisterios === 'function') renderizarAdminMinisterios();
    if (typeof carregarAgenda === 'function') carregarAgenda();

    if (typeof mostrarToast === 'function') mostrarToast(`Modo de simulação alterado: ${modoSimulacaoPerfil ? modoSimulacaoPerfil.label : 'Visão Admin'}`, 'sucesso');
}

function resetarModoSimulacaoPerfil() {
    alterarModoSimulacaoPerfil('admin');
}

window.alterarModoSimulacaoPerfil = alterarModoSimulacaoPerfil;
window.resetarModoSimulacaoPerfil = resetarModoSimulacaoPerfil;

// =========================================================================
// ARQUITETURA MODULAR DE CULTOS (ESTILO LITURGE BRANDBOOK)
// =========================================================================

window.cultosProcessados = [];
window.cultoAtualIndex = 0;
window.musicaAtualDetalhe = null;
window.filtroCultosAtual = 'todos';
window.tomMusicaAtualOriginal = 'C';
window.tomMusicaAtualCorrente = 'C';

let tamanhoFonteCifra = 13;
let tamanhoFonteLetra = 15;

const NOMES_MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const DIAS_SEMANA = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

function identificarTipoCulto(nomeCulto) {
    const nomeUp = (nomeCulto || '').toUpperCase();
    if (nomeUp.includes('SANTA CEIA') || nomeUp.includes('CEIA')) {
        return {
            label: 'Santa Ceia',
            stripeClass: 'border-l-4 border-rose-600 dark:border-l-rose-500',
            badgeClass: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30',
            corFundo: 'bg-rose-600',
            icone: '🍷'
        };
    }
    if (nomeUp.includes('JOVENS') || nomeUp.includes('TEENS') || nomeUp.includes('JUVENTUDE')) {
        return {
            label: 'Culto de Jovens',
            stripeClass: 'border-l-4 border-purple-600 dark:border-l-purple-500',
            badgeClass: 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30',
            corFundo: 'bg-purple-600',
            icone: '⚡'
        };
    }
    if (nomeUp.includes('QUARTA')) {
        return {
            label: 'Quarta-feira',
            stripeClass: 'border-l-4 border-indigo-600 dark:border-l-indigo-500',
            badgeClass: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30',
            corFundo: 'bg-indigo-600',
            icone: '📖'
        };
    }
    if (nomeUp.includes('DOMINGO')) {
        return {
            label: 'Culto de Domingo',
            stripeClass: 'border-l-4 border-amber-500',
            badgeClass: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30',
            corFundo: 'bg-amber-500',
            icone: '☀️'
        };
    }
    return {
        label: 'Culto Especial',
        stripeClass: 'border-l-4 border-emerald-600 dark:border-l-emerald-500',
        badgeClass: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30',
        corFundo: 'bg-emerald-600',
        icone: '✨'
    };
}

function extrairIconeFuncao(roleStr) {
    const r = (roleStr || '').toLowerCase();
    if (r.includes('bateria')) return '🥁';
    if (r.includes('violao') || r.includes('violão') || r.includes('guitarra')) return '🎸';
    if (r.includes('baixo')) return '🎸';
    if (r.includes('teclado') || r.includes('piano')) return '🎹';
    if (r.includes('vocal') || r.includes('cantor') || r.includes('voz')) return '🎤';
    if (r.includes('midia') || r.includes('mídia') || r.includes('projec') || r.includes('slide')) return '💻';
    if (r.includes('som') || r.includes('audio') || r.includes('áudio') || r.includes('mesa')) return '🎛️';
    if (r.includes('pastor') || r.includes('pregad') || r.includes('bispo')) return '✝️';
    return '🎯';
}

function processarMatrizCultos(rows) {
    const cultos = [];
    let cultoAtual = null;
    let contadorCulto = 0;
    window.liturgeCultosPlaylists = window.liturgeCultosPlaylists || {};

    const userToEval = (typeof modoSimulacaoPerfil !== 'undefined' && modoSimulacaoPerfil) || usuarioLogado || window.__CACHED_USER__;
    const nomeUsuarioNorm = userToEval ? (userToEval.name || userToEval.full_name || userToEval.nome || '').trim().toLowerCase() : '';

    for (let i = 0; i < rows.length; i++) {
        const linha = rows[i];
        const col0 = linha[0] ? linha[0].toString().trim() : '';

        const ehCabecalhoCulto = col0.includes("CULTO DE") || col0.includes("CULTO ") || (linha[5] && !linha[1] && col0 !== '');

        if (ehCabecalhoCulto) {
            contadorCulto++;
            const playlistId = `playlist-culto-${contadorCulto}`;
            window.liturgeCultosPlaylists[playlistId] = [];

            const rawTitle = col0;
            const emMontagem = rawTitle.toUpperCase().includes('EM MONTAGEM');
            const oculto = rawTitle.toUpperCase().includes('OCULTO');

            // Filtragem por Mês Ativo (SaaS) se configurado na igreja
            if (!oculto && window.dadosGlobais?.church?.active_month) {
                const mesAtivoTarget = window.dadosGlobais.church.active_month.split('-')[1];
                const partesTitulo = rawTitle.split(' - ');
                if (partesTitulo.length > 0 && partesTitulo[0].includes('/')) {
                    const dataPartes = partesTitulo[0].trim().split('/');
                    if (dataPartes.length >= 2 && dataPartes[1] !== mesAtivoTarget) {
                        continue;
                    }
                }
            }

            if (oculto) continue;

            // Extração de data e título limpo
            let dataStr = '';
            let diaSemana = '';
            let mesAno = 'Programação Geral';
            let nomeLimpo = rawTitle.replace(/ - OCULTO/i, '').replace(/ - EM MONTAGEM/i, '').trim();

            const matchData = nomeLimpo.match(/^(\d{1,2}\/\d{1,2})(?:\/\d{2,4})?\s*[-–]\s*(.+)$/i);
            if (matchData) {
                dataStr = matchData[1];
                nomeLimpo = matchData[2].trim();
            }

            const anoAtual = new Date().getFullYear();
            if (dataStr && dataStr.includes('/')) {
                const [dStr, mStr] = dataStr.split('/');
                const diaNum = parseInt(dStr, 10);
                const mesNum = parseInt(mStr, 10);
                if (!isNaN(diaNum) && !isNaN(mesNum) && mesNum >= 1 && mesNum <= 12) {
                    const dataObj = new Date(anoAtual, mesNum - 1, diaNum);
                    diaSemana = DIAS_SEMANA[dataObj.getDay()] || '';
                    mesAno = `${NOMES_MESES[mesNum - 1]} ${anoAtual}`;
                }
            } else {
                if (nomeLimpo.toUpperCase().includes('DOMINGO')) diaSemana = 'Domingo';
                else if (nomeLimpo.toUpperCase().includes('QUARTA')) diaSemana = 'Quarta-feira';
                else if (nomeLimpo.toUpperCase().includes('SÁBADO') || nomeLimpo.toUpperCase().includes('SABADO')) diaSemana = 'Sábado';
                const mesAtualIndex = new Date().getMonth();
                mesAno = `${NOMES_MESES[mesAtualIndex]} ${anoAtual}`;
            }

            // Escala e cantores (Col F = JSON, Col G = cantores, Col H = mídias)
            let instrObj = {};
            try { instrObj = linha[5] ? JSON.parse(linha[5].toString()) : {}; } catch (e) { }
            const cantoresCulto = linha[6] ? linha[6].toString().trim() : '';
            let midiasCulto = [];
            try { midiasCulto = linha[7] ? JSON.parse(linha[7].toString()) : []; } catch (e) { }

            // Verifica se o usuário atual está escalado
            let userIsEscalado = false;
            let userRole = '';
            let iconeFuncao = '🎯';

            if (nomeUsuarioNorm) {
                for (const [papel, nomeAlocado] of Object.entries(instrObj)) {
                    if (nomeAlocado) {
                        const nStr = nomeAlocado.toString().toLowerCase();
                        if (nStr.includes(nomeUsuarioNorm) || nomeUsuarioNorm.includes(nStr)) {
                            userIsEscalado = true;
                            userRole = papel.charAt(0).toUpperCase() + papel.slice(1);
                            iconeFuncao = extrairIconeFuncao(papel);
                            break;
                        }
                    }
                }
                if (!userIsEscalado && cantoresCulto) {
                    const cLow = cantoresCulto.toLowerCase();
                    if (cLow.includes(nomeUsuarioNorm) || nomeUsuarioNorm.includes(cLow)) {
                        userIsEscalado = true;
                        userRole = 'Vocalista';
                        iconeFuncao = '🎤';
                    }
                }
            }

            // Mapeamento de ministérios da igreja para a aba de escala
            const groupedEscala = {};
            const roleToMinistry = {};
            (dadosGlobais.ministries || []).forEach(min => {
                (min.ministry_roles || []).forEach(r => {
                    const rName = typeof removerAcentos === 'function' ? removerAcentos(r.name.toLowerCase()) : r.name.toLowerCase();
                    roleToMinistry[rName] = { name: min.name, color: min.color || 'emerald', icon: min.icon || '🏢' };
                });
            });

            const louvorMin = (dadosGlobais.ministries || []).find(m => {
                const n = (m.name || '').toLowerCase();
                return n.includes('louvor') || n.includes('musica') || n.includes('adora');
            }) || { name: 'Louvor', color: 'brand', icon: '⛪' };

            const vocaisList = [];
            if (cantoresCulto) {
                cantoresCulto.split(',').map(s => s.trim()).filter(Boolean).forEach(c => {
                    if (!vocaisList.includes(c)) vocaisList.push(c);
                });
            }

            Object.keys(instrObj).forEach(key => {
                if (instrObj[key]) {
                    const keyLower = typeof removerAcentos === 'function' ? removerAcentos(key.toLowerCase()) : key.toLowerCase();
                    if (keyLower.includes('vocal') || keyLower.includes('cantor')) {
                        const nomes = instrObj[key].toString().split(',').map(s => s.trim()).filter(Boolean);
                        nomes.forEach(n => { if (!vocaisList.includes(n)) vocaisList.push(n); });
                        return;
                    }
                    const nomeFormato = key.charAt(0).toUpperCase() + key.slice(1);
                    const minInfo = roleToMinistry[keyLower] || louvorMin;
                    if (!groupedEscala[minInfo.name]) {
                        groupedEscala[minInfo.name] = { color: minInfo.color, icon: minInfo.icon, parts: [], cleanParts: [] };
                    }
                    groupedEscala[minInfo.name].parts.push(`<span class="font-medium text-slate-500 dark:text-slate-400">${nomeFormato}:</span> <span class="font-bold text-slate-900 dark:text-white">${instrObj[key]}</span>`);
                    groupedEscala[minInfo.name].cleanParts.push(`${nomeFormato}: ${instrObj[key]}`);
                }
            });

            if (vocaisList.length > 0) {
                const minName = louvorMin.name || 'Louvor';
                if (!groupedEscala[minName]) {
                    groupedEscala[minName] = { color: louvorMin.color || 'brand', icon: louvorMin.icon || '⛪', parts: [], cleanParts: [] };
                }
                const labelVocal = vocaisList.length > 1 ? 'Vocalistas' : 'Vocalista';
                groupedEscala[minName].parts.push(`<span class="font-medium text-slate-500 dark:text-slate-400">${labelVocal}:</span> <span class="font-bold text-slate-900 dark:text-white">${vocaisList.join(', ')}</span>`);
                groupedEscala[minName].cleanParts.push(`${labelVocal}: ${vocaisList.join(', ')}`);
            }

            cultoAtual = {
                id: `culto-${contadorCulto}`,
                index: cultos.length,
                playlistId: playlistId,
                rawTitle: rawTitle,
                nome: nomeLimpo,
                dataStr: dataStr,
                diaSemana: diaSemana,
                horario: '19:00',
                mesAno: mesAno,
                emMontagem: emMontagem,
                oculto: oculto,
                tipoInfo: identificarTipoCulto(nomeLimpo),
                userIsEscalado: userIsEscalado,
                userRole: userRole,
                iconeFuncao: iconeFuncao,
                groupedEscala: groupedEscala,
                midias: midiasCulto,
                songs: []
            };

            cultos.push(cultoAtual);

        } else if (cultoAtual && col0 !== '' && !cultoAtual.emMontagem) {
            const musica = linha[0] ? linha[0].toString().trim() : '';
            const tom = linha[1] || '';
            const variacao = linha[2] || '';
            const vsCelular = linha[3] || '';
            const ytDado = linha[4] || '';
            const cantoresMusica = linha[6] ? linha[6].toString().trim() : '';
            const lyricsTexto = linha[7] ? linha[7].toString().trim() : '';
            const chordsTexto = linha[8] ? linha[8].toString().trim() : '';
            const artistaMusica = linha[9] ? linha[9].toString().trim() : '';

            const fileId = typeof obterUrlAudioVs === 'function' ? obterUrlAudioVs(vsCelular) : vsCelular;
            const linkYoutubeFinal = typeof obterLinkYoutube === 'function' ? obterLinkYoutube(ytDado, musica) : (ytDado ? `https://www.youtube.com/watch?v=${ytDado}` : '');

            let trackIndex = -1;
            if (vsCelular && fileId) {
                window.liturgeCultosPlaylists[cultoAtual.playlistId].push({
                    title: musica,
                    fileIdOrUrl: fileId,
                    artist: artistaMusica || cantoresMusica || 'Liturge • Louvor',
                    album: cultoAtual.nome,
                    cultoId: cultoAtual.playlistId
                });
                trackIndex = window.liturgeCultosPlaylists[cultoAtual.playlistId].length - 1;
            }

            cultoAtual.songs.push({
                index: cultoAtual.songs.length,
                title: musica,
                tom: tom,
                variacao: variacao,
                vs: vsCelular,
                fileId: fileId,
                trackIndex: trackIndex,
                yt: ytDado,
                linkYoutube: linkYoutubeFinal,
                cantor: cantoresMusica,
                lyrics: lyricsTexto,
                chords: chordsTexto,
                artist: artistaMusica,
                cultoNome: cultoAtual.nome,
                playlistId: cultoAtual.playlistId
            });
        }
    }

    return cultos;
}

function renderizarCultos(rows) {
    const container = document.getElementById('secao-cultos');
    if (!container) return;

    const mesesContainer = document.getElementById('cultos-meses-container');
    if (!mesesContainer) {
        setTimeout(() => renderizarCultos(rows), 100);
        return;
    }

    window.cultosProcessados = processarMatrizCultos(rows || []);
    atualizarContadoresFiltro();
    aplicarFiltroCultosRender(window.filtroCultosAtual || 'todos');

    // Se usuário tiver permissão de criar cultos, exibe o botão
    const btnNovoCulto = document.getElementById('acoes-admin-cultos-header');
    if (btnNovoCulto) {
        const canCriarCulto = hasPermission('criar_culto') || hasPermission('gerenciar_cultos');
        btnNovoCulto.classList.toggle('hidden', !canCriarCulto);
    }
}

function atualizarContadoresFiltro() {
    const total = window.cultosProcessados.length;
    const escalados = window.cultosProcessados.filter(c => c.userIsEscalado).length;
    const montagem = window.cultosProcessados.filter(c => c.emMontagem).length;

    const badgeTodos = document.getElementById('badge-count-todos');
    const badgeEscalado = document.getElementById('badge-count-escalado');
    const badgeMontagem = document.getElementById('badge-count-montagem');

    if (badgeTodos) badgeTodos.textContent = total;
    if (badgeEscalado) badgeEscalado.textContent = escalados;
    if (badgeMontagem) badgeMontagem.textContent = montagem;
}

function filtrarCultos(tipo) {
    window.filtroCultosAtual = tipo;

    const btnTodos = document.getElementById('filtro-cultos-todos');
    const btnEscalado = document.getElementById('filtro-cultos-escalado');
    const btnMontagem = document.getElementById('filtro-cultos-montagem');

    const estiloAtivo = "px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer bg-brand-500 text-night-950 shadow-sm shadow-brand-500/20";
    const estiloInativo = "px-3.5 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer bg-slate-100 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300 hover:text-white border border-slate-200 dark:border-slate-700/60";

    if (btnTodos) btnTodos.className = tipo === 'todos' ? estiloAtivo : estiloInativo;
    if (btnEscalado) btnEscalado.className = tipo === 'escalado' ? estiloAtivo : estiloInativo;
    if (btnMontagem) btnMontagem.className = tipo === 'montagem' ? estiloAtivo : estiloInativo;

    aplicarFiltroCultosRender(tipo);
}

function aplicarFiltroCultosRender(tipo) {
    const mesesContainer = document.getElementById('cultos-meses-container');
    const msgVazio = document.getElementById('cultos-vazio-msg');
    if (!mesesContainer) return;

    let lista = [...window.cultosProcessados];
    if (tipo === 'escalado') {
        lista = lista.filter(c => c.userIsEscalado);
    } else if (tipo === 'montagem') {
        lista = lista.filter(c => c.emMontagem);
    }

    if (lista.length === 0) {
        mesesContainer.innerHTML = '';
        if (msgVazio) msgVazio.classList.remove('hidden');
        return;
    } else {
        if (msgVazio) msgVazio.classList.add('hidden');
    }

    // Agrupa por Mês/Ano
    const gruposMes = {};
    lista.forEach(c => {
        if (!gruposMes[c.mesAno]) gruposMes[c.mesAno] = [];
        gruposMes[c.mesAno].push(c);
    });

    let htmlMeses = '';
    Object.entries(gruposMes).forEach(([mesAno, cultosDoMes]) => {
        htmlMeses += `
            <div class="space-y-4">
                <div class="flex items-center gap-3">
                    <h2 class="text-xs sm:text-sm font-extrabold uppercase tracking-widest text-slate-500 dark:text-slate-400">${mesAno}</h2>
                    <div class="h-px flex-1 bg-slate-200 dark:bg-slate-800"></div>
                    <span class="text-[11px] font-mono text-slate-400 dark:text-slate-500">${cultosDoMes.length} culto(s)</span>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
        `;

        cultosDoMes.forEach(culto => {
            const destaqueEscalado = culto.userIsEscalado
                ? 'ring-2 ring-brand-500/60 dark:ring-brand-500/40 shadow-md shadow-brand-500/10 bg-white dark:bg-night-900/90'
                : 'bg-white dark:bg-night-900/90';

            htmlMeses += `
                <div onclick="abrirDetalhesCulto(${culto.index})" 
                     class="group relative ${destaqueEscalado} border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm hover:shadow-md hover:border-brand-500/50 dark:hover:border-brand-500/50 transition-all duration-200 cursor-pointer flex flex-col justify-between gap-3 overflow-hidden ${culto.tipoInfo.stripeClass}">
                    
                    <!-- Topo: Data, dia da semana e status -->
                    <div class="flex items-center justify-between gap-2">
                        <div class="flex items-center gap-1.5 text-xs font-semibold">
                            ${culto.dataStr ? `
                                <span class="font-black text-slate-900 dark:text-white uppercase tracking-wider text-xs">${culto.dataStr}</span>
                                ${culto.diaSemana ? `<span class="text-slate-400 dark:text-slate-500">•</span><span class="capitalize text-slate-600 dark:text-slate-300 text-xs font-semibold">${culto.diaSemana}</span>` : ''}
                            ` : `
                                <span class="font-black text-slate-900 dark:text-white uppercase tracking-wider text-xs">${culto.diaSemana || 'Culto Especial'}</span>
                            `}
                            ${culto.horario ? `<span class="text-slate-400 dark:text-slate-500">•</span><span class="text-slate-500 dark:text-slate-400 text-xs font-mono font-medium">${culto.horario}</span>` : ''}
                        </div>
                        ${culto.emMontagem ? `
                            <span class="inline-flex items-center gap-1.5 text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30 shadow-xs">
                                <span class="w-1.5 h-1.5 rounded-full bg-amber-500 dark:bg-amber-400 animate-pulse"></span>
                                Em Montagem
                            </span>
                        ` : ''}
                    </div>

                    <!-- Título do Culto -->
                    <div class="space-y-1">
                        <h3 class="text-sm sm:text-base font-black text-slate-900 dark:text-white uppercase tracking-tight group-hover:text-brand-600 dark:group-hover:text-brand-400 transition leading-snug line-clamp-2">
                            ${culto.nome}
                        </h3>
                    </div>

                    <!-- Rodapé do Card: Destaque de Escalado + Contadores -->
                    <div class="pt-2 border-t border-slate-100 dark:border-slate-800/70 flex items-center justify-between gap-2 flex-wrap text-xs">
                        ${culto.userIsEscalado ? `
                            <span class="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-lg bg-amber-500/15 dark:bg-brand-500/20 text-amber-900 dark:text-amber-200 border border-amber-500/40 dark:border-brand-500/40 shadow-xs">
                                <span>${culto.iconeFuncao || '🎯'}</span>
                                <span>Escalado: ${culto.userRole}</span>
                            </span>
                        ` : `
                            <span class="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                                <span class="w-1.5 h-1.5 rounded-full bg-slate-400 dark:bg-slate-600"></span>
                                <span>${culto.tipoInfo.label || 'Programação'}</span>
                            </span>
                        `}

                        <div class="flex items-center gap-1.5 ml-auto">
                            <span class="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700/60 shadow-xs" title="${culto.songs.length} músicas">
                                <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="text-brand-500"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>
                                <span>${culto.songs.length}</span>
                            </span>
                            ${culto.midias.length > 0 ? `
                            <span class="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700/60 shadow-xs" title="${culto.midias.length} mídias">
                                <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="text-amber-500"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"></path></svg>
                                <span>${culto.midias.length}</span>
                            </span>` : ''}
                            <span class="text-brand-500 font-bold text-sm group-hover:translate-x-0.5 transition inline-block">›</span>
                        </div>
                    </div>
                </div>
            `;
        });

        htmlMeses += `
                </div>
            </div>
        `;
    });

    mesesContainer.innerHTML = htmlMeses;
}

// =========================================================================
// VISÃO 2: TELA DEDICADA DE DETALHES DO CULTO
// =========================================================================

function abrirDetalhesCulto(cultoIndex, skipPushState = false) {
    const culto = window.cultosProcessados[cultoIndex];
    if (!culto) return;
    window.cultoAtualIndex = cultoIndex;

    const vLista = document.getElementById('visao-cultos-lista');
    const vCulto = document.getElementById('visao-culto-detalhe');
    const vMusica = document.getElementById('visao-musica-detalhe');
    const vEditor = document.getElementById('visao-culto-editor');

    if (vLista) vLista.classList.add('hidden');
    if (vMusica) vMusica.classList.add('hidden');
    if (vEditor) vEditor.classList.add('hidden');
    if (vCulto) vCulto.classList.remove('hidden');

    // Botão de editar culto na visão detalhe
    const btnEditarCulto = document.getElementById('btn-editar-culto-detalhe');
    if (btnEditarCulto) {
        const canEditar = typeof hasPermission === 'function' ? (hasPermission('editar_culto') || hasPermission('gerenciar_cultos')) : true;
        const userToEval = (typeof modoSimulacaoPerfil !== 'undefined' ? modoSimulacaoPerfil : null) || (window.usuarioLogado || null);
        const rUser = userToEval ? (userToEval.system_role || userToEval.role || 'membro') : 'visitante';
        const isLiderOuAdmin = rUser === 'admin' || rUser === 'lider';
        btnEditarCulto.classList.toggle('hidden', !(canEditar || isLiderOuAdmin));
    }

    if (!skipPushState && window.history && window.history.pushState) {
        window.history.pushState({ view: 'culto-detalhe', cultoIndex: cultoIndex }, '', `#culto-${cultoIndex}`);
    }

    // Preenche Hero do Culto
    const elTitulo = document.getElementById('culto-detalhe-titulo');
    const elDataBadge = document.getElementById('culto-detalhe-data-badge');
    const elHorarioBadge = document.getElementById('culto-detalhe-horario-badge');
    const elStatusBadge = document.getElementById('culto-detalhe-status-badge');
    const elFaixaTopo = document.getElementById('culto-detalhe-faixa-topo');

    if (elTitulo) elTitulo.textContent = culto.nome;
    if (elDataBadge) elDataBadge.textContent = `${culto.dataStr || 'Culto'} • ${culto.diaSemana || ''}`;
    if (elHorarioBadge) elHorarioBadge.textContent = culto.horario || '19:00';
    if (elStatusBadge) elStatusBadge.classList.toggle('hidden', !culto.emMontagem);
    if (elFaixaTopo) elFaixaTopo.className = `absolute top-0 left-0 right-0 h-1.5 ${culto.tipoInfo.corFundo}`;

    // Aviso se estiver escalado
    const elAvisoEscalado = document.getElementById('culto-detalhe-aviso-escalado');
    const elIconeFuncao = document.getElementById('culto-detalhe-icone-funcao');
    const elTextoFuncao = document.getElementById('culto-detalhe-texto-funcao');
    if (elAvisoEscalado) {
        if (culto.userIsEscalado) {
            elAvisoEscalado.classList.remove('hidden');
            if (elIconeFuncao) elIconeFuncao.textContent = culto.iconeFuncao || '🎯';
            if (elTextoFuncao) elTextoFuncao.textContent = `Você toca: ${culto.userRole}`;
        } else {
            elAvisoEscalado.classList.add('hidden');
        }
    }

    // Atualiza contadores de abas
    const badgeMusicas = document.getElementById('culto-badge-count-musicas');
    const badgeMidias = document.getElementById('culto-badge-count-midias');
    if (badgeMusicas) badgeMusicas.textContent = culto.songs.length;
    if (badgeMidias) badgeMidias.textContent = culto.midias.length;

    // Renderiza Lista de Músicas do Culto
    const listaMusicasEl = document.getElementById('culto-lista-musicas');
    if (listaMusicasEl) {
        if (culto.songs.length === 0) {
            listaMusicasEl.innerHTML = `
                <div class="p-8 text-center bg-white dark:bg-night-900/40 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
                    <div class="text-2xl">🎵</div>
                    <p class="text-sm font-bold text-slate-700 dark:text-slate-300">${culto.emMontagem ? 'Playlist ainda em montagem' : 'Nenhuma música cadastrada'}</p>
                    <p class="text-xs text-slate-400 max-w-sm mx-auto">Você pode conferir a escala ou sugerir novas músicas na aba de Avisos & Sugestões.</p>
                </div>
            `;
        } else {
            listaMusicasEl.innerHTML = culto.songs.map((song, idx) => {
                return `
                    <div onclick="abrirDetalhesMusica(${idx}, ${cultoIndex})"
                         class="group p-3 sm:p-4 rounded-xl bg-white dark:bg-night-900/80 hover:bg-slate-50 dark:hover:bg-slate-800/60 border border-slate-200 dark:border-slate-800 hover:border-brand-500/40 transition cursor-pointer flex items-center justify-between gap-3 shadow-sm">
                        <div class="flex items-center gap-3 min-w-0">
                            <span class="w-8 h-8 rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20 flex items-center justify-center font-bold text-xs shrink-0 font-mono">
                                ${idx + 1}
                            </span>
                            <div class="min-w-0">
                                <h4 class="font-bold text-slate-900 dark:text-white text-sm sm:text-base group-hover:text-brand-600 dark:group-hover:text-brand-400 transition truncate leading-snug">
                                    ${song.title}
                                </h4>
                                <div class="flex items-center gap-2 flex-wrap text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                    ${song.artist ? `<span>${song.artist}</span><span>•</span>` : ''}
                                    ${song.tom ? `<span class="font-bold text-brand-600 dark:text-brand-400">Tom: ${song.tom}</span>` : ''}
                                    ${song.cantor ? `<span>•</span><span class="text-slate-600 dark:text-slate-300">🎤 ${song.cantor}</span>` : ''}
                                </div>
                            </div>
                        </div>

                        <div class="flex items-center gap-2 shrink-0">
                            ${song.vs ? `
                                <button type="button" onclick="event.stopPropagation(); LiturgePlayer.tocarDoCulto('${culto.playlistId}', ${song.trackIndex})"
                                        class="p-2 sm:px-3 sm:py-1.5 rounded-lg bg-brand-500/10 hover:bg-brand-500 text-brand-600 dark:text-brand-400 hover:text-night-950 border border-brand-500/30 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm" title="Tocar VS">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                                    <span class="hidden sm:inline">VS</span>
                                </button>
                            ` : ''}
                            <span class="text-slate-400 group-hover:text-brand-500 transition text-sm font-bold">›</span>
                        </div>
                    </div>
                `;
            }).join('');
        }
    }

    // Renderiza Escala da Equipe
    const escalaEl = document.getElementById('culto-conteudo-escala');
    if (escalaEl) {
        if (!culto.groupedEscala || Object.keys(culto.groupedEscala).length === 0) {
            escalaEl.innerHTML = `
                <div class="col-span-2 p-8 text-center bg-white dark:bg-night-900/40 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-400 text-xs">
                    Nenhum integrante escalado neste culto até o momento.
                </div>
            `;
        } else {
            escalaEl.innerHTML = Object.entries(culto.groupedEscala).map(([minName, info]) => {
                return `
                    <div class="p-4 rounded-xl bg-white dark:bg-night-900/80 border border-slate-200 dark:border-slate-800 space-y-2.5 shadow-sm">
                        <div class="flex items-center gap-2">
                            <span class="text-base">${info.icon || '🏢'}</span>
                            <h4 class="text-xs font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400">${minName}</h4>
                        </div>
                        <div class="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs space-y-1.5 pt-1">
                            ${info.parts.map(p => `<div class="pt-1.5 flex items-center justify-between">${p}</div>`).join('')}
                        </div>
                    </div>
                `;
            }).join('');
        }
    }

    // Renderiza Mídias & Arquivos
    const midiasEl = document.getElementById('culto-conteudo-midias');
    if (midiasEl) {
        if (!culto.midias || culto.midias.length === 0) {
            midiasEl.innerHTML = `
                <div class="col-span-full p-8 text-center bg-white dark:bg-night-900/40 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-400 text-xs">
                    Nenhuma mídia ou arquivo anexado a este culto.
                </div>
            `;
        } else {
            midiasEl.innerHTML = culto.midias.map(m => {
                return `
                    <a href="${m.url}" target="_blank" class="p-3.5 rounded-xl bg-white dark:bg-night-900/80 hover:bg-slate-50 dark:hover:bg-slate-800/60 border border-slate-200 dark:border-slate-800 flex items-center gap-3 transition group shadow-sm">
                        <div class="w-9 h-9 rounded-lg bg-brand-500/10 text-brand-500 border border-brand-500/20 flex items-center justify-center shrink-0">
                            📎
                        </div>
                        <div class="min-w-0 flex-1">
                            <span class="block text-xs font-bold text-slate-900 dark:text-white truncate group-hover:text-brand-500 transition">${m.name || 'Arquivo'}</span>
                            <span class="text-[10px] text-slate-400">Clique para abrir</span>
                        </div>
                        <span class="text-slate-400 group-hover:translate-x-0.5 transition text-xs">↗</span>
                    </a>
                `;
            }).join('');
        }
    }

    // Renderiza Avisos & Sugestões
    const avisosEl = document.getElementById('culto-conteudo-avisos');
    if (avisosEl) {
        if (culto.emMontagem) {
            avisosEl.innerHTML = `
                <div class="space-y-3">
                    <p class="text-xs font-bold text-amber-500 uppercase tracking-wider flex items-center gap-1.5">
                        <span>🚧</span> Playlist em Montagem: Envie suas sugestões de louvor
                    </p>
                    <div class="flex flex-col sm:flex-row gap-2">
                        <input type="text" id="sugestao-culto-autor" placeholder="Seu nome"
                            class="sm:w-1/3 bg-slate-50 dark:bg-night-950 border border-slate-200 dark:border-slate-800 px-3 py-2 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-brand-500">
                        <input type="text" id="sugestao-culto-texto" placeholder="Música sugerida e tom de preferência"
                            class="sm:w-2/3 bg-slate-50 dark:bg-night-950 border border-slate-200 dark:border-slate-800 px-3 py-2 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-brand-500">
                    </div>
                    <button type="button" onclick="enviarSugestaoCultoAtual()"
                        class="bg-brand-500 hover:bg-brand-400 text-night-950 font-bold px-4 py-2 rounded-xl text-xs shadow-sm cursor-pointer transition">
                        Enviar Sugestão
                    </button>
                    <p id="sugestao-culto-status" class="text-xs text-brand-500 hidden font-medium">Sugestão enviada com sucesso!</p>
                </div>
            `;
        } else {
            avisosEl.innerHTML = `
                <div class="space-y-3">
                    <p class="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Observações do Culto</p>
                    <p class="text-xs text-slate-600 dark:text-slate-300">Este culto já está com repertório confirmado. Para alterações ou alinhamentos de tom, utilize o botão na tela de cada música.</p>
                </div>
            `;
        }
    }

    // Ativa aba padrão de Repertório
    mudarSubAbaCulto('repertorio');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function mudarSubAbaCulto(aba) {
    const abas = ['repertorio', 'escala', 'midias', 'avisos'];
    abas.forEach(a => {
        const conteudo = document.getElementById(`culto-aba-${a}`);
        const btn = document.getElementById(`tab-btn-${a}`);
        const isActive = a === aba;
        if (conteudo) conteudo.classList.toggle('hidden', !isActive);
        if (btn) {
            if (isActive) {
                btn.className = "py-3 px-3 sm:px-4 border-b-2 font-bold text-xs sm:text-sm transition flex items-center gap-2 border-brand-500 text-brand-600 dark:text-brand-400 cursor-pointer";
            } else {
                btn.className = "py-3 px-3 sm:px-4 border-b-2 font-semibold text-xs sm:text-sm transition flex items-center gap-2 border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 cursor-pointer";
            }
        }
    });
}

function voltarParaCultos() {
    const vLista = document.getElementById('visao-cultos-lista');
    const vCulto = document.getElementById('visao-culto-detalhe');
    const vMusica = document.getElementById('visao-musica-detalhe');
    const vEditor = document.getElementById('visao-culto-editor');

    if (vLista) vLista.classList.remove('hidden');
    if (vCulto) vCulto.classList.add('hidden');
    if (vMusica) vMusica.classList.add('hidden');
    if (vEditor) vEditor.classList.add('hidden');

    if (window.history && window.history.pushState) {
        window.history.pushState({ view: 'cultos-lista' }, '', '#cultos');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function editarCultoAtualDeDetalhes() {
    if (typeof mostrarFormCulto === 'function' && window.cultoAtualIndex !== null && window.cultoAtualIndex !== undefined) {
        mostrarFormCulto(window.cultoAtualIndex);
    }
}

// =========================================================================
// VISÃO 3: TELA DEDICADA DE DETALHES DA MÚSICA (CULTOS & REPERTÓRIO)
// =========================================================================

window.origemMusicaDetalhe = 'culto'; // 'culto', 'repertorio' ou 'novas'
window.musicaRepertorioOrigemObj = null;
window.versaoMusicaAtualIndex = 0;

async function atualizarArtworkMusicaDetalhe(titulo, artista) {
    const fotoEl = document.getElementById('musica-detalhe-foto');
    const fallbackEl = document.getElementById('musica-detalhe-foto-fallback');
    if (!fotoEl || !fallbackEl) return;

    fotoEl.classList.add('hidden');
    fallbackEl.classList.remove('hidden');

    if (typeof window.fetchTrackArtwork === 'function') {
        try {
            const art = await window.fetchTrackArtwork(titulo, artista);
            if (art && window.musicaAtualDetalhe && window.musicaAtualDetalhe.title === titulo) {
                fotoEl.src = art;
                fotoEl.onload = () => {
                    fotoEl.classList.remove('hidden');
                    fallbackEl.classList.add('hidden');
                };
            }
        } catch (e) {
            console.warn('[Artwork] Falha ao carregar artwork:', e);
        }
    }
}

function preencherVisaoMusicaDetalhe(musica, options = {}) {
    window.musicaAtualDetalhe = musica;
    window.tomMusicaAtualOriginal = musica.tom || 'C';
    window.tomMusicaAtualCorrente = musica.tom || 'C';
    window.origemMusicaDetalhe = options.origem || 'culto';

    const origem = window.origemMusicaDetalhe;

    // Gerencia visibilidade das seções
    const vLista = document.getElementById('visao-cultos-lista');
    const vCulto = document.getElementById('visao-culto-detalhe');
    const vMusica = document.getElementById('visao-musica-detalhe');
    const secCultos = document.getElementById('secao-cultos');
    const secRep = document.getElementById('secao-repertorio');
    const secNovas = document.getElementById('secao-novas');

    if (origem === 'repertorio') {
        if (secRep) secRep.classList.add('hidden');
        if (secCultos) secCultos.classList.remove('hidden');
        if (vLista) vLista.classList.add('hidden');
        if (vCulto) vCulto.classList.add('hidden');
    } else if (origem === 'novas') {
        if (secNovas) secNovas.classList.add('hidden');
        if (secCultos) secCultos.classList.remove('hidden');
        if (vLista) vLista.classList.add('hidden');
        if (vCulto) vCulto.classList.add('hidden');
    } else {
        if (vLista) vLista.classList.add('hidden');
        if (vCulto) vCulto.classList.add('hidden');
    }
    if (vMusica) vMusica.classList.remove('hidden');

    // Botão Voltar contextual
    const btnVoltarTexto = document.getElementById('musica-btn-voltar-texto');
    if (btnVoltarTexto) {
        if (origem === 'repertorio') {
            btnVoltarTexto.textContent = 'Voltar para o Repertório';
        } else if (origem === 'novas') {
            btnVoltarTexto.textContent = 'Voltar para Músicas Novas';
        } else {
            btnVoltarTexto.textContent = options.cultoNome ? `Voltar para ${options.cultoNome}` : 'Voltar para o Culto';
        }
    }

    // Identificação Principal
    const elTitulo = document.getElementById('musica-detalhe-titulo');
    const elArtista = document.getElementById('musica-detalhe-artista');
    const elOrdem = document.getElementById('musica-detalhe-ordem-badge');
    const elTom = document.getElementById('musica-detalhe-tom-badge');
    const elCantorBloco = document.getElementById('musica-detalhe-cantor-bloco');
    const elCantorNome = document.getElementById('musica-detalhe-cantor-nome');

    if (elTitulo) elTitulo.textContent = musica.title;
    if (elArtista) elArtista.textContent = musica.artist || 'Ministério de Louvor';
    if (elOrdem) {
        if (origem === 'culto' && options.musicaIndex !== undefined) {
            elOrdem.textContent = `Faixa ${options.musicaIndex + 1}`;
            elOrdem.classList.remove('hidden');
        } else if (origem === 'novas') {
            elOrdem.textContent = 'Música Nova';
            elOrdem.classList.remove('hidden');
        } else {
            elOrdem.textContent = 'Catálogo';
            elOrdem.classList.remove('hidden');
        }
    }
    if (elTom) elTom.textContent = `Tom: ${musica.tom || '—'}`;

    if (elCantorBloco && elCantorNome) {
        if (musica.cantor) {
            elCantorBloco.classList.remove('hidden');
            elCantorNome.textContent = musica.cantor;
        } else {
            elCantorBloco.classList.add('hidden');
        }
    }

    // Seletor Dinâmico de Versões / Tons
    const seletorVersoesEl = document.getElementById('musica-detalhe-seletor-versoes');
    const pillsContainer = document.getElementById('musica-versoes-pills');
    const versoes = musica.versions || [];

    if (seletorVersoesEl && pillsContainer) {
        if (versoes.length > 1) {
            seletorVersoesEl.classList.remove('hidden');
            let pillsHtml = '';
            versoes.forEach((v, idx) => {
                const isActive = idx === (options.versaoIndex || 0);
                const rotuloTom = v.key ? `Tom ${v.key}` : `Versão ${idx + 1}`;
                const rotuloVariacao = v.variation || v.cantor || (idx === 0 ? 'Original' : '');
                const classesPill = isActive
                    ? 'px-3 py-1 rounded-xl text-xs font-bold bg-brand-500 text-night-950 border border-brand-500 shadow-sm cursor-pointer'
                    : 'px-3 py-1 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-brand-500/50 cursor-pointer transition';

                pillsHtml += `
                    <button type="button" onclick="trocarVersaoMusicaDetalhe(${idx})" class="${classesPill}">
                        <span>${rotuloTom}</span>
                        ${rotuloVariacao ? `<span class="opacity-80 text-[10px] ml-1">(${rotuloVariacao})</span>` : ''}
                    </button>
                `;
            });
            pillsContainer.innerHTML = pillsHtml;
        } else {
            seletorVersoesEl.classList.add('hidden');
            pillsContainer.innerHTML = '';
        }
    }

    // Capa em Alta Resolução (Apple Music)
    atualizarArtworkMusicaDetalhe(musica.title, musica.artist);

    // Aba 1: Metadados
    const metaTom = document.getElementById('musica-meta-tom');
    const metaBpm = document.getElementById('musica-meta-bpm');
    const metaDuracao = document.getElementById('musica-meta-duracao');
    const metaVersao = document.getElementById('musica-meta-versao');

    if (metaTom) metaTom.textContent = musica.tom || '—';
    if (metaBpm) metaBpm.textContent = musica.bpm || '—';
    if (metaDuracao) metaDuracao.textContent = musica.duracao || '—';
    if (metaVersao) metaVersao.textContent = musica.variacao || 'Original';

    // Links de YouTube e VS
    const btnYt = document.getElementById('btn-musica-link-youtube');
    if (btnYt) {
        if (musica.linkYoutube) {
            btnYt.href = musica.linkYoutube;
            btnYt.classList.remove('opacity-50', 'pointer-events-none');
        } else {
            btnYt.href = '#';
            btnYt.classList.add('opacity-50', 'pointer-events-none');
        }
    }

    const btnVs = document.getElementById('btn-musica-ouvir-vs');
    if (btnVs) {
        btnVs.classList.toggle('opacity-50', !musica.vs);
    }

    // Aba 2: Cifra
    const displayTomCifra = document.getElementById('cifra-tom-atual-display');
    if (displayTomCifra) displayTomCifra.textContent = window.tomMusicaAtualCorrente;

    const cifraTextoEl = document.getElementById('musica-cifra-texto');
    if (cifraTextoEl) {
        cifraTextoEl.textContent = musica.chords 
            ? (typeof sanitizarTextoCifraClub === 'function' ? sanitizarTextoCifraClub(musica.chords) : musica.chords)
            : 'Nenhuma cifra cadastrada para esta música.';
    }

    // Aba 3: Letra
    const letraTextoEl = document.getElementById('musica-letra-texto');
    if (letraTextoEl) {
        letraTextoEl.textContent = musica.lyrics || 'Nenhuma letra cadastrada para esta música.';
    }

    // Botões de Ações Rápidas no Cabeçalho
    const btnEditAdmin = document.getElementById('btn-musica-editar-admin');
    if (btnEditAdmin) {
        const canEdit = (typeof isAdmin !== 'undefined' && isAdmin) || (typeof hasPermission === 'function' && hasPermission('editar_repertorio'));
        btnEditAdmin.classList.toggle('hidden', !canEdit);
    }

    // Ativa aba padrão de Info
    mudarSubAbaMusica('info');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function abrirDetalhesMusica(musicaIndex, cultoIndex, skipPushState = false) {
    const culto = window.cultosProcessados ? window.cultosProcessados[cultoIndex] : null;
    if (!culto || !culto.songs[musicaIndex]) return;

    const musica = culto.songs[musicaIndex];
    window.cultoAtualIndex = cultoIndex;

    if (!skipPushState && window.history && window.history.pushState) {
        window.history.pushState({ view: 'musica-detalhe', musicaIndex: musicaIndex, cultoIndex: cultoIndex }, '', `#musica-${musicaIndex}`);
    }

    preencherVisaoMusicaDetalhe(musica, { origem: 'culto', musicaIndex, cultoNome: culto.nome });
}

function abrirDetalhesMusicaDoRepertorio(musicaId, origem = 'repertorio', versaoIndex = 0, skipPushState = false) {
    let musicaObj = null;
    if (dadosGlobais && dadosGlobais.repertorio) {
        musicaObj = dadosGlobais.repertorio.find(m => String(m.id) === String(musicaId));
    }
    if (!musicaObj && dadosGlobais && dadosGlobais.novas) {
        musicaObj = dadosGlobais.novas.find(m => String(m.id) === String(musicaId));
    }
    if (!musicaObj) return;

    window.musicaRepertorioOrigemObj = musicaObj;
    window.versaoMusicaAtualIndex = versaoIndex;

    const versoes = musicaObj.versions || [];
    const vAtiva = versoes[versaoIndex] || versoes[0];

    const musicaFormatada = {
        id: musicaObj.id,
        title: musicaObj.title,
        artist: musicaObj.artist || 'Ministério de Louvor',
        tom: vAtiva ? (vAtiva.key || musicaObj.key || 'C') : (musicaObj.key || 'C'),
        variacao: vAtiva ? (vAtiva.variation || 'Original') : 'Original',
        cantor: vAtiva ? (vAtiva.cantor || vAtiva.minister || '') : '',
        bpm: (vAtiva && vAtiva.bpm) || musicaObj.bpm || '—',
        duracao: (vAtiva && vAtiva.duration) || musicaObj.duration || '—',
        linkYoutube: (vAtiva && vAtiva.yt) || musicaObj.yt || '',
        vs: (vAtiva && vAtiva.vs) || musicaObj.vs || '',
        chords: (vAtiva && vAtiva.chords) || musicaObj.chords || '',
        lyrics: (vAtiva && vAtiva.lyrics) || musicaObj.lyrics || '',
        versions: versoes
    };

    if (!skipPushState && window.history && window.history.pushState) {
        window.history.pushState({ view: 'musica-detalhe-repertorio', musicaId: musicaId, origem: origem, versaoIndex: versaoIndex }, '', `#musica-${musicaId}`);
    }

    preencherVisaoMusicaDetalhe(musicaFormatada, { origem, versaoIndex });
}

function trocarVersaoMusicaDetalhe(versaoIndex) {
    if (window.origemMusicaDetalhe === 'repertorio' || window.origemMusicaDetalhe === 'novas') {
        if (window.musicaRepertorioOrigemObj) {
            abrirDetalhesMusicaDoRepertorio(window.musicaRepertorioOrigemObj.id, window.origemMusicaDetalhe, versaoIndex, true);
        }
    } else if (window.origemMusicaDetalhe === 'culto') {
        if (window.musicaAtualDetalhe && window.musicaAtualDetalhe.versions && window.musicaAtualDetalhe.versions[versaoIndex]) {
            const v = window.musicaAtualDetalhe.versions[versaoIndex];
            window.musicaAtualDetalhe.tom = v.key || window.musicaAtualDetalhe.tom;
            window.musicaAtualDetalhe.variacao = v.variation || window.musicaAtualDetalhe.variacao;
            window.musicaAtualDetalhe.cantor = v.cantor || window.musicaAtualDetalhe.cantor;
            window.musicaAtualDetalhe.chords = v.chords || window.musicaAtualDetalhe.chords;
            window.musicaAtualDetalhe.lyrics = v.lyrics || window.musicaAtualDetalhe.lyrics;
            window.musicaAtualDetalhe.vs = v.vs || window.musicaAtualDetalhe.vs;
            window.musicaAtualDetalhe.linkYoutube = v.yt || window.musicaAtualDetalhe.linkYoutube;
            const culto = window.cultosProcessados ? window.cultosProcessados[window.cultoAtualIndex] : null;
            preencherVisaoMusicaDetalhe(window.musicaAtualDetalhe, { origem: 'culto', versaoIndex: versaoIndex, cultoNome: culto?.nome });
        }
    }
}

function voltarDeMusicaDetalhe() {
    const vMusica = document.getElementById('visao-musica-detalhe');
    if (vMusica) vMusica.classList.add('hidden');

    const origem = window.origemMusicaDetalhe;
    if (origem === 'repertorio') {
        const secCultos = document.getElementById('secao-cultos');
        const secRep = document.getElementById('secao-repertorio');
        if (secCultos) secCultos.classList.add('hidden');
        if (secRep) secRep.classList.remove('hidden');
    } else if (origem === 'novas') {
        const secCultos = document.getElementById('secao-cultos');
        const secNovas = document.getElementById('secao-novas');
        if (secCultos) secCultos.classList.add('hidden');
        if (secNovas) secNovas.classList.remove('hidden');
    } else {
        const vCulto = document.getElementById('visao-culto-detalhe');
        if (vCulto) vCulto.classList.remove('hidden');
    }

    if (window.history && window.history.pushState) {
        if (origem === 'culto' && window.cultoAtualIndex !== undefined) {
            window.history.pushState({ view: 'culto-detalhe', cultoIndex: window.cultoAtualIndex }, '', `#culto-${window.cultoAtualIndex}`);
        } else {
            window.history.pushState({ view: origem || 'repertorio' }, '', window.location.pathname);
        }
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function voltarParaCultoDetalhe() {
    voltarDeMusicaDetalhe();
}

function abrirModalAjusteMusicaAtual() {
    if (!window.musicaAtualDetalhe) return;
    const modal = document.getElementById('modal-ajuste-tom-rapido');
    const tit = document.getElementById('modal-ajuste-musica-titulo');
    const autorInput = document.getElementById('modal-ajuste-autor');
    const statusMsg = document.getElementById('modal-ajuste-status');

    if (tit) tit.textContent = window.musicaAtualDetalhe.title;
    if (statusMsg) statusMsg.classList.add('hidden');

    if (autorInput && !autorInput.value) {
        const user = (typeof usuarioLogado !== 'undefined' && usuarioLogado) || (typeof modoSimulacaoPerfil !== 'undefined' && modoSimulacaoPerfil);
        if (user && user.name) {
            autorInput.value = `${user.name} (${user.ministries || 'Louvor'})`;
        }
    }

    if (modal) modal.classList.remove('hidden');
}

function fecharModalAjusteMusicaAtual() {
    const modal = document.getElementById('modal-ajuste-tom-rapido');
    if (modal) modal.classList.add('hidden');
}

async function submeterAjusteMusicaAtual(event) {
    if (event) event.preventDefault();
    if (!window.musicaAtualDetalhe) return;

    const autor = (document.getElementById('modal-ajuste-autor')?.value || '').trim();
    const texto = (document.getElementById('modal-ajuste-texto')?.value || '').trim();
    const btnSubmit = document.getElementById('btn-submit-ajuste-musica');

    if (!autor || !texto) {
        if (typeof mostrarToast === 'function') mostrarToast('Preencha seu nome e a solicitação.', 'aviso');
        return;
    }

    if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.textContent = 'Enviando...';
    }

    try {
        await enviarComentario(window.musicaAtualDetalhe.title, 'modal-ajuste-autor', 'modal-ajuste-texto', 'modal-ajuste-status', 'Ajuste de Tom');
        fecharModalAjusteMusicaAtual();
        if (typeof mostrarToast === 'function') mostrarToast('Solicitação de ajuste enviada aos líderes!', 'sucesso');
        const txtEl = document.getElementById('modal-ajuste-texto');
        if (txtEl) txtEl.value = '';
    } catch (err) {
        console.error('Erro ao enviar solicitação:', err);
        if (typeof mostrarToast === 'function') mostrarToast('Erro ao enviar solicitação.', 'erro');
    } finally {
        if (btnSubmit) {
            btnSubmit.disabled = false;
            btnSubmit.textContent = 'Enviar Ajuste';
        }
    }
}

function abrirModalEditarMusicaAdmin() {
    if (!window.musicaAtualDetalhe || !window.musicaAtualDetalhe.id) {
        if (typeof mostrarToast === 'function') mostrarToast('Selecione uma música cadastrada no acervo.', 'aviso');
        return;
    }
    const fnEdit = window.abrirModalEditarMusicaAdmin || (typeof abrirModalEditarMusicaAdmin !== 'undefined' && abrirModalEditarMusicaAdmin);
    if (typeof fnEdit === 'function') {
        fnEdit(window.musicaAtualDetalhe.id);
    }
}

function abrirModalNovaMusicaAdmin() {
    if (typeof abrirModalMusicaAdmin === 'function') {
        abrirModalMusicaAdmin('geral');
    }
}

function mudarSubAbaMusica(aba) {
    const abas = ['info', 'cifra', 'letra'];
    abas.forEach(a => {
        const conteudo = document.getElementById(`musica-aba-${a}`);
        const btn = document.getElementById(`tab-btn-musica-${a}`);
        const isActive = a === aba;
        if (conteudo) conteudo.classList.toggle('hidden', !isActive);
        if (btn) {
            if (isActive) {
                btn.className = "py-3 px-3 sm:px-4 border-b-2 font-bold text-xs sm:text-sm transition flex items-center gap-2 border-brand-500 text-brand-600 dark:text-brand-400 cursor-pointer";
            } else {
                btn.className = "py-3 px-3 sm:px-4 border-b-2 font-semibold text-xs sm:text-sm transition flex items-center gap-2 border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 cursor-pointer";
            }
        }
    });
}

// Suporte para botão físico / Voltar do navegador
window.addEventListener('popstate', (e) => {
    if (e.state) {
        if (e.state.view === 'culto-detalhe') {
            abrirDetalhesCulto(e.state.cultoIndex, true);
        } else if (e.state.view === 'musica-detalhe') {
            abrirDetalhesMusica(e.state.musicaIndex, e.state.cultoIndex, true);
        } else if (e.state.view === 'musica-detalhe-repertorio') {
            abrirDetalhesMusicaDoRepertorio(e.state.musicaId, e.state.origem, e.state.versaoIndex, true);
        } else if (e.state.view === 'repertorio') {
            voltarDeMusicaDetalhe();
        } else if (e.state.view === 'novas') {
            voltarDeMusicaDetalhe();
        } else {
            voltarParaCultos();
        }
    } else {
        voltarDeMusicaDetalhe();
    }
});

// =========================================================================
// AÇÕES & FERRAMENTAS DO CULTO E DA MÚSICA
// =========================================================================

function executarPlaylistCultoAtual() {
    if (window.cultoAtualIndex === undefined || !window.cultosProcessados) return;
    const culto = window.cultosProcessados[window.cultoAtualIndex];
    if (!culto) return;

    if (window.liturgeCultosPlaylists && window.liturgeCultosPlaylists[culto.playlistId] && window.liturgeCultosPlaylists[culto.playlistId].length > 0) {
        if (window.LiturgePlayer && typeof window.LiturgePlayer.tocarDoCulto === 'function') {
            window.LiturgePlayer.tocarDoCulto(culto.playlistId, 0);
            if (typeof mostrarToast === 'function') mostrarToast(`Iniciando playlist: ${culto.nome}`, 'sucesso');
        }
    } else {
        if (typeof mostrarToast === 'function') mostrarToast('Nenhum VS ou áudio disponível nesta playlist.', 'aviso');
    }
}

function copiarCultoAtualWhatsApp() {
    if (window.cultoAtualIndex === undefined || !window.cultosProcessados) return;
    const culto = window.cultosProcessados[window.cultoAtualIndex];
    if (!culto) return;

    let texto = `*LITURGE • ${culto.nome.toUpperCase()}*\n`;
    if (culto.dataStr) texto += `📅 Data: ${culto.dataStr} (${culto.diaSemana || ''})\n`;

    if (culto.songs && culto.songs.length > 0) {
        texto += `\n*🎵 REPERTÓRIO:*\n`;
        culto.songs.forEach((s, idx) => {
            texto += `${idx + 1}. *${s.title}*`;
            if (s.tom) texto += ` - Tom: ${s.tom}`;
            if (s.cantor) texto += ` (Voz: ${s.cantor})`;
            texto += `\n`;
        });
    }

    if (culto.groupedEscala && Object.keys(culto.groupedEscala).length > 0) {
        texto += `\n*👥 ESCALA DA EQUIPE:*\n`;
        Object.entries(culto.groupedEscala).forEach(([min, info]) => {
            if (info.cleanParts && info.cleanParts.length > 0) {
                texto += `• *${min}*: ${info.cleanParts.join(' | ')}\n`;
            }
        });
    }

    navigator.clipboard.writeText(texto).then(() => {
        if (typeof mostrarToast === 'function') {
            mostrarToast('📋 Programação e escala copiadas para o WhatsApp!', 'sucesso');
        }
    }).catch(() => {
        if (typeof mostrarToast === 'function') {
            mostrarToast('Erro ao copiar texto.', 'erro');
        }
    });
}

function exportarHplsCultoAtual() {
    if (window.cultoAtualIndex === undefined || !window.cultosProcessados) return;
    const culto = window.cultosProcessados[window.cultoAtualIndex];
    if (!culto) return;

    if (typeof gerarScriptHolyrics === 'function') {
        gerarScriptHolyrics(culto.rawTitle || culto.nome);
    } else {
        if (typeof mostrarToast === 'function') mostrarToast('Exportador Holyrics não disponível.', 'aviso');
    }
}

function tocarVsMusicaAtual() {
    if (!window.musicaAtualDetalhe) return;
    const m = window.musicaAtualDetalhe;
    if (m.vs && window.LiturgePlayer) {
        const fileId = typeof obterUrlAudioVs === 'function' ? obterUrlAudioVs(m.vs) : m.vs;
        window.LiturgePlayer.playDriveAudio(m.title, fileId, {
            artist: m.artist || m.cantor || 'Liturge • Louvor',
            album: m.cultoNome || 'Culto'
        });
        if (typeof mostrarToast === 'function') mostrarToast(`Tocando: ${m.title}`, 'sucesso');
    } else {
        if (typeof mostrarToast === 'function') mostrarToast('Esta música não possui arquivo de VS vinculado.', 'aviso');
    }
}

function transporCifraMusicaAtual(delta) {
    if (!window.musicaAtualDetalhe || !window.musicaAtualDetalhe.chords) return;
    const tomAtual = window.tomMusicaAtualCorrente || window.musicaAtualDetalhe.tom || 'C';
    const raiz = typeof extrairNotaRaiz === 'function' ? extrairNotaRaiz(tomAtual) : null;
    if (!raiz || typeof NOTAS_SEMITONS_MAP === 'undefined') return;

    const semitom = NOTAS_SEMITONS_MAP[raiz];
    if (semitom === undefined) return;

    const novoSemitom = (semitom + delta + 12) % 12;
    const escalaAlvo = ESCALA_NOTAS_SUSTENIDOS;
    const novaRaiz = escalaAlvo[novoSemitom];
    const sufixo = tomAtual.replace(/^[A-G][#b]?/i, '');
    const novoTom = novaRaiz + sufixo;

    window.tomMusicaAtualCorrente = novoTom;
    const displayEl = document.getElementById('cifra-tom-atual-display');
    if (displayEl) displayEl.textContent = novoTom;

    if (typeof transporCifra === 'function') {
        const textoTransposto = transporCifra(window.musicaAtualDetalhe.chords, window.musicaAtualDetalhe.tom, novoTom);
        const cifraPre = document.getElementById('musica-cifra-texto');
        if (cifraPre) cifraPre.textContent = textoTransposto;
    }
}

function resetarTomCifraMusicaAtual() {
    if (!window.musicaAtualDetalhe) return;
    window.tomMusicaAtualCorrente = window.musicaAtualDetalhe.tom || 'C';
    const displayEl = document.getElementById('cifra-tom-atual-display');
    if (displayEl) displayEl.textContent = window.tomMusicaAtualCorrente;
    const cifraPre = document.getElementById('musica-cifra-texto');
    if (cifraPre) {
        cifraPre.textContent = window.musicaAtualDetalhe.chords 
            ? (typeof sanitizarTextoCifraClub === 'function' ? sanitizarTextoCifraClub(window.musicaAtualDetalhe.chords) : window.musicaAtualDetalhe.chords)
            : 'Nenhuma cifra cadastrada para esta música.';
    }
}

function ajustarFonteCifra(delta) {
    tamanhoFonteCifra = Math.max(10, Math.min(22, tamanhoFonteCifra + delta));
    const cifraPre = document.getElementById('musica-cifra-texto');
    if (cifraPre) cifraPre.style.fontSize = `${tamanhoFonteCifra}px`;
}

function ajustarFonteLetra(delta) {
    tamanhoFonteLetra = Math.max(11, Math.min(24, tamanhoFonteLetra + delta));
    const letraDiv = document.getElementById('musica-letra-texto');
    if (letraDiv) letraDiv.style.fontSize = `${tamanhoFonteLetra}px`;
}

function copiarCifraAtual() {
    const el = document.getElementById('musica-cifra-texto');
    if (el && el.textContent) {
        navigator.clipboard.writeText(el.textContent);
        if (typeof mostrarToast === 'function') mostrarToast('Cifra copiada para a área de transferência!', 'sucesso');
    }
}

function copiarLetraAtual() {
    const el = document.getElementById('musica-letra-texto');
    if (el && el.textContent) {
        navigator.clipboard.writeText(el.textContent);
        if (typeof mostrarToast === 'function') mostrarToast('Letra copiada para a área de transferência!', 'sucesso');
    }
}

function enviarSugestaoCultoAtual() {
    if (window.cultoAtualIndex === undefined || !window.cultosProcessados) return;
    const culto = window.cultosProcessados[window.cultoAtualIndex];
    if (!culto) return;

    const autorEl = document.getElementById('sugestao-culto-autor');
    const textoEl = document.getElementById('sugestao-culto-texto');
    const statusEl = document.getElementById('sugestao-culto-status');

    const autor = autorEl ? autorEl.value.trim() : '';
    const texto = textoEl ? textoEl.value.trim() : '';

    if (!autor || !texto) {
        if (typeof mostrarToast === 'function') mostrarToast('Preencha seu nome e a sugestão.', 'aviso');
        return;
    }

    if (typeof enviarComentario === 'function') {
        enviarComentario(culto.rawTitle || culto.nome, 'sugestao-culto-autor', 'sugestao-culto-texto', 'sugestao-culto-status', 'Sugestão para Culto');
    }
}

// Exportações Globais
window.renderizarCultos = renderizarCultos;
window.filtrarCultos = filtrarCultos;
window.abrirDetalhesCulto = abrirDetalhesCulto;
window.mudarSubAbaCulto = mudarSubAbaCulto;
window.voltarParaCultos = voltarParaCultos;
window.abrirDetalhesMusica = abrirDetalhesMusica;
window.abrirDetalhesMusicaDoRepertorio = abrirDetalhesMusicaDoRepertorio;
window.trocarVersaoMusicaDetalhe = trocarVersaoMusicaDetalhe;
window.voltarDeMusicaDetalhe = voltarDeMusicaDetalhe;
window.mudarSubAbaMusica = mudarSubAbaMusica;
window.voltarParaCultoDetalhe = voltarParaCultoDetalhe;
window.executarPlaylistCultoAtual = executarPlaylistCultoAtual;
window.copiarCultoAtualWhatsApp = copiarCultoAtualWhatsApp;
window.exportarHplsCultoAtual = exportarHplsCultoAtual;
window.tocarVsMusicaAtual = tocarVsMusicaAtual;
window.transporCifraMusicaAtual = transporCifraMusicaAtual;
window.resetarTomCifraMusicaAtual = resetarTomCifraMusicaAtual;
window.ajustarFonteCifra = ajustarFonteCifra;
window.ajustarFonteLetra = ajustarFonteLetra;
window.copiarCifraAtual = copiarCifraAtual;
window.copiarLetraAtual = copiarLetraAtual;
window.abrirModalAjusteMusicaAtual = abrirModalAjusteMusicaAtual;
window.fecharModalAjusteMusicaAtual = fecharModalAjusteMusicaAtual;
window.submeterAjusteMusicaAtual = submeterAjusteMusicaAtual;
window.abrirModalEditarMusicaAdmin = abrirModalEditarMusicaAdmin;
window.abrirModalNovaMusicaAdmin = abrirModalNovaMusicaAdmin;
window.toggleMenuFiltrosRepertorio = toggleMenuFiltrosRepertorio;
window.selecionarFiltroRepertorio = selecionarFiltroRepertorio;
window.limparBuscaRepertorio = limparBuscaRepertorio;
window.renderizarLinhaMusicaStreaming = renderizarLinhaMusicaStreaming;
window.toggleCultoBloco = function() {}; // Mantido para compatibilidade residual

// Gerenciador nativo do botão/gesto "Voltar" do Android (Galaxy S24 / One UI)
window.tratarBotaoVoltarNativo = function() {
    try {
        // 1. Se estiver na tela de Detalhes da Música, volta de acordo com a origem (repertório, novas ou culto)
        const vMusica = document.getElementById('visao-musica-detalhe');
        if (vMusica && !vMusica.classList.contains('hidden') && vMusica.style.display !== 'none') {
            if (typeof voltarDeMusicaDetalhe === 'function') {
                voltarDeMusicaDetalhe();
                return 'HANDLED';
            }
        }

        // 2. Se estiver na tela de Detalhes do Culto, volta para a lista de cultos
        const vCulto = document.getElementById('visao-culto-detalhe');
        if (vCulto && !vCulto.classList.contains('hidden') && vCulto.style.display !== 'none') {
            if (typeof voltarParaCultos === 'function') {
                voltarParaCultos();
                return 'HANDLED';
            }
        }

        // 3. Se a barra lateral estiver aberta, fecha a barra lateral
        const sidebar = document.getElementById('sidebar-menu');
        if (sidebar && !sidebar.classList.contains('hidden') && sidebar.style.display !== 'none') {
            if (typeof fecharSidebarMenu === 'function') fecharSidebarMenu('sidebar-menu');
            return 'HANDLED';
        }
        const adminSidebar = document.getElementById('admin-sidebar-menu');
        if (adminSidebar && !adminSidebar.classList.contains('hidden') && adminSidebar.style.display !== 'none') {
            if (typeof fecharSidebarMenu === 'function') fecharSidebarMenu('admin-sidebar-menu');
            return 'HANDLED';
        }

        // 4. Se houver algum modal aberto na tela (somente contêineres principais fixos), fecha o modal
        const modaisVisiveis = document.querySelectorAll(
            'div[id^="modal-"].fixed:not(.hidden), .modal-container:not(.hidden), div[id^="modal-"][class*="fixed"]:not(.hidden)'
        );
        for (const m of modaisVisiveis) {
            if (m.id && m.id !== 'app-splash-screen' && !m.classList.contains('hidden') && m.style.display !== 'none') {
                m.classList.add('hidden');
                return 'HANDLED';
            }
        }

        // 5. Se o Painel Admin estiver aberto sobreposto, fecha o painel admin
        const painelAdmin = document.getElementById('painel-admin');
        if (painelAdmin && !painelAdmin.classList.contains('hidden') && painelAdmin.style.display !== 'none') {
            if (typeof sairAdmin === 'function') sairAdmin();
            else painelAdmin.classList.add('hidden');
            return 'HANDLED';
        }

        // 6. Se estiver em outra aba principal (agenda, repertorio, novas, midia...), volta para cultos
        const secCultos = document.getElementById('secao-cultos');
        if (secCultos && (secCultos.classList.contains('hidden') || secCultos.style.display === 'none')) {
            if (typeof mudarAba === 'function') {
                mudarAba('cultos');
                return 'HANDLED';
            }
        }

        // 7. Se houver filtro ativo em cultos diferente de 'todos', volta para 'todos'
        if (window.filtroCultosAtual && window.filtroCultosAtual !== 'todos') {
            if (typeof filtrarCultos === 'function') {
                filtrarCultos('todos');
                return 'HANDLED';
            }
        }

        // 8. Já está na tela inicial principal de cultos: solicita confirmação de saída
        return 'EXIT';
    } catch (e) {
        console.error('[Liturge] Erro na rotina tratarBotaoVoltarNativo:', e);
        return 'EXIT';
    }
};

function gerarHtmlCardMusica(musicaObj, prefix) {
    const isAdminMode = typeof isAdmin !== 'undefined' && isAdmin;
    let htmlVersoes = '';
    
    let podeVerLouvor = false;
    if (usuarioLogado) {
        const isAdmin = usuarioLogado.system_role === 'admin';
        let ministryName = '';
        if (usuarioLogado.ministry_id && dadosGlobais.ministries) {
            const min = dadosGlobais.ministries.find(m => m.id === usuarioLogado.ministry_id);
            if (min) ministryName = (min.name || '').toUpperCase();
        }
        if (!ministryName && usuarioLogado.ministries) {
            ministryName = usuarioLogado.ministries.toUpperCase();
        }
        podeVerLouvor = isAdmin || ministryName.includes('LOUVOR');
    }

    if (musicaObj.versions && musicaObj.versions.length > 0) {
        // Se for na aba de músicas novas, exibe apenas a primeira versão (a original)
        const versoesParaExibir = prefix === 'nova' ? [musicaObj.versions[0]] : musicaObj.versions;
        
        versoesParaExibir.forEach((v, index) => {
            const fileId = obterUrlAudioVs(v.vs);
            const linksYt = obterLinksYoutubeArray(v.yt, musicaObj.title);
            const versionLyrics = v.lyrics || musicaObj.lyrics || '';
            const versionChords = v.chords || musicaObj.chords || '';
            const btnLetraCard = versionLyrics.trim() 
                ? `<button onclick="abrirModalLetraPublica('${musicaObj.title.replace(/'/g, "\\'")}', 'Tom: ${v.key}', '${encodeURIComponent(versionLyrics)}')" class="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/80 hover:border-liturge-500/40 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5">
                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-liturge-400"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                    <span>Letra</span>
                </button>`
                : '';
            const btnCifraCard = versionChords.trim()
                ? `<button onclick="abrirModalCifraPublica('${musicaObj.title.replace(/'/g, "\\'")}', '${v.key}', '${encodeURIComponent(versionChords)}')" class="bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700/80 hover:border-liturge-500/40 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5">
                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-liturge-400"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                    <span>Cifra</span>
                </button>`
                : '';
            const itemId = `${prefix}-${musicaObj.id}-v${index}`;
            
            const ytButtonsHtml = linksYt.map(item => 
                `<button onclick="playYoutubeAudio('${musicaObj.title.replace(/'/g, "\\'")}', '${item.url}')" class="bg-red-700/80 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1"><span>📺</span> ${item.label}</button>`
            ).join('');

            htmlVersoes += `
                <div class="mt-3.5 pt-3.5 border-t border-slate-800/70">
                    <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <div class="flex items-center gap-2">
                            ${podeVerLouvor ? `<span class="bg-night-950 border border-slate-800 px-2.5 py-0.5 rounded-md text-[11px] font-mono text-slate-200"><span class="text-slate-400 font-normal">Tom:</span> <span class="font-bold text-white">${v.key}</span> <span class="text-slate-400 font-normal">(${v.variation || 'Original'})</span></span>` : ''}
                        </div>
                        <div class="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
                            ${(podeVerLouvor && v.vs) ? `<button onclick="playDriveAudio('${musicaObj.title.replace(/'/g, "\\'")}', '${fileId}', { artist: '${(musicaObj.artist || '').replace(/'/g, "\\'")}', album: 'Repertório Liturge' })" class="bg-gradient-to-r from-liturge-500 to-amber-600 hover:from-liturge-400 hover:to-amber-500 text-night-950 px-3 py-1.5 rounded-lg text-xs font-bold transition shadow-sm flex items-center gap-1.5 cursor-pointer"><span>▶</span> Ouvir VS</button>` : ''}
                            ${btnLetraCard}
                            ${(podeVerLouvor && btnCifraCard) ? btnCifraCard : ''}
                            ${ytButtonsHtml}
                            ${podeVerLouvor ? `<button onclick="toggleComentario('${itemId}')" class="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/80 px-2.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer flex items-center gap-1"><span>💬</span> Ajuste</button>` : ''}
                        </div>
                    </div>
                    <div id="${itemId}" class="hidden pt-3 mt-3 bg-night-950/60 p-3 rounded-xl border border-slate-800/80 space-y-2">
                        <div class="flex gap-2">
                            <input type="text" id="autor-${itemId}" placeholder="Seu nome" class="w-1/3 bg-night-950 border border-slate-800 px-3 py-1.5 rounded-lg text-xs text-white focus:outline-none focus:border-liturge-500 font-sans">
                            <input type="text" id="comentario-${itemId}" placeholder="Ex: Mudar tom para C..." class="w-2/3 bg-night-950 border border-slate-800 px-3 py-1.5 rounded-lg text-xs text-white focus:outline-none focus:border-liturge-500 font-sans">
                            <button onclick="enviarComentario('${musicaObj.title.replace(/'/g, "\\'")}', 'autor-${itemId}', 'comentario-${itemId}', 'status-${itemId}', 'Ajuste de Tom')" class="bg-liturge-500 hover:bg-liturge-400 text-night-950 font-bold px-3 py-1.5 rounded-lg text-xs cursor-pointer transition">Enviar</button>
                        </div>
                        <p id="status-${itemId}" class="text-xs text-liturge-400 hidden">Solicitação enviada com sucesso!</p>
                    </div>
                </div>
            `;
        });
    }

    return `
        <div class="bg-night-900/90 p-5 rounded-2xl border ${musicaObj.status === 'nova' ? 'border-liturge-500/40 shadow-liturge-500/10' : 'border-slate-800/90'} shadow-xl hover:border-slate-700/80 transition mb-3.5">
            <div class="flex items-center justify-between">
                <h3 class="font-bold text-base sm:text-lg text-white">${musicaObj.title} ${musicaObj.artist ? `<span class="text-xs font-normal text-slate-400 ml-2">(${musicaObj.artist})</span>` : ''}</h3>
                ${musicaObj.status === 'nova' ? '<span class="text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full bg-liturge-500/10 text-liturge-400 border border-liturge-500/30">Música Nova</span>' : ''}
            </div>
            ${htmlVersoes}
        </div>
    `;
}

window.filtroRepertorioAtual = 'todas';

function toggleMenuFiltrosRepertorio() {
    const dropdown = document.getElementById('dropdown-filtros-repertorio');
    if (dropdown) dropdown.classList.toggle('hidden');
}

// Fechar dropdown ao clicar fora
document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('dropdown-filtros-repertorio');
    const btnToggle = document.getElementById('btn-toggle-filtros-repertorio');
    if (dropdown && !dropdown.classList.contains('hidden')) {
        if (!dropdown.contains(e.target) && !btnToggle?.contains(e.target)) {
            dropdown.classList.add('hidden');
        }
    }
});

function selecionarFiltroRepertorio(filtro) {
    window.filtroRepertorioAtual = filtro;
    const dropdown = document.getElementById('dropdown-filtros-repertorio');
    if (dropdown) dropdown.classList.add('hidden');

    const filtrosDisponiveis = ['todas', 'com_vs', 'com_cifra', 'com_yt', 'com_letra'];
    filtrosDisponiveis.forEach(f => {
        const check = document.getElementById(`check-filtro-${f}`);
        if (check) check.classList.toggle('hidden', f !== filtro);
    });

    const dot = document.getElementById('filtro-ativo-dot');
    const badge = document.getElementById('filtro-badge-nome');
    if (dot) dot.classList.toggle('hidden', filtro === 'todas');

    if (badge) {
        if (filtro === 'todas') {
            badge.classList.add('hidden');
        } else {
            const rotulos = {
                com_vs: '🎵 Com Áudio / VS',
                com_cifra: '🎸 Com Cifra',
                com_yt: '📺 Com YouTube',
                com_letra: '📜 Com Letra'
            };
            badge.textContent = rotulos[filtro] || filtro;
            badge.classList.remove('hidden');
        }
    }

    filtrarMusicas();
}

function limparBuscaRepertorio() {
    const input = document.getElementById('searchInput');
    if (input) input.value = '';
    const btnLimpar = document.getElementById('btn-limpar-busca-repertorio');
    if (btnLimpar) btnLimpar.classList.add('hidden');
    filtrarMusicas();
}

function renderizarLinhaMusicaStreaming(musicaObj, index, origem = 'repertorio') {
    if (!musicaObj || !musicaObj.title) return '';

    const versoes = musicaObj.versions || [];
    const v0 = versoes[0] || {};
    const tomExibicao = (v0.key || musicaObj.key || 'C').toUpperCase();
    const temVs = versoes.some(v => v.vs && v.vs.trim()) || (musicaObj.vs && musicaObj.vs.trim());
    const temYt = versoes.some(v => v.yt && v.yt.trim()) || (musicaObj.yt && musicaObj.yt.trim());
    const temCifra = (musicaObj.chords && musicaObj.chords.trim()) || versoes.some(v => v.chords && v.chords.trim());
    const temLetra = (musicaObj.lyrics && musicaObj.lyrics.trim()) || versoes.some(v => v.lyrics && v.lyrics.trim());
    const qtdVersoes = versoes.length;

    const thumbId = `thumb-${origem}-${musicaObj.id}`;
    const fallbackId = `thumb-fallback-${origem}-${musicaObj.id}`;

    // Dispara a busca assíncrona da capa para a thumbnail em lotes leves
    setTimeout(() => {
        if (typeof window.fetchTrackArtwork === 'function') {
            window.fetchTrackArtwork(musicaObj.title, musicaObj.artist).then(art => {
                if (art) {
                    const img = document.getElementById(thumbId);
                    const fb = document.getElementById(fallbackId);
                    if (img && fb) {
                        img.src = art;
                        img.classList.remove('hidden');
                        fb.classList.add('hidden');
                    }
                }
            }).catch(() => {});
        }
    }, 10 + (index * 20));

    return `
        <div onclick="abrirDetalhesMusicaDoRepertorio('${musicaObj.id}', '${origem}')" 
            class="group w-full p-2.5 sm:p-3 rounded-2xl bg-white dark:bg-night-900/90 hover:bg-slate-50 dark:hover:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800/80 transition-all cursor-pointer flex items-center justify-between gap-3 shadow-xs active:scale-[0.99]">
            
            <!-- Capa e Título / Artista -->
            <div class="flex items-center gap-3 min-w-0 flex-1">
                <div class="relative w-11 h-11 sm:w-12 sm:h-12 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 shrink-0 flex items-center justify-center shadow-xs">
                    <img id="${thumbId}" src="" alt="" class="hidden w-full h-full object-cover">
                    <div id="${fallbackId}" class="w-full h-full flex items-center justify-center text-brand-500 bg-gradient-to-br from-brand-500/10 to-brand-500/25">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>
                    </div>
                </div>

                <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-2">
                        <h3 class="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate group-hover:text-brand-600 dark:group-hover:text-brand-400 transition">
                            ${musicaObj.title}
                        </h3>
                        ${qtdVersoes > 1 ? `<span class="text-[10px] px-1.5 py-0.2 rounded font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700 shrink-0">${qtdVersoes} versões</span>` : ''}
                    </div>
                    <p class="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5 font-medium">
                        ${musicaObj.artist || 'Ministério de Louvor'}
                    </p>
                </div>
            </div>

            <!-- Badges e Recursos -->
            <div class="flex items-center gap-2 shrink-0">
                <!-- Badge de Tom -->
                <span class="text-[11px] font-mono font-bold px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700/80">
                    Tom ${tomExibicao}
                </span>

                <!-- Ícones de Recursos -->
                <div class="hidden sm:flex items-center gap-1.5 text-xs text-slate-400">
                    ${temVs ? `<span title="Áudio VS disponível">🎵</span>` : ''}
                    ${temCifra ? `<span title="Cifra disponível">🎸</span>` : ''}
                    ${temYt ? `<span title="Vídeo do YouTube disponível">📺</span>` : ''}
                    ${temLetra ? `<span title="Letra disponível">📜</span>` : ''}
                </div>

                <span class="text-slate-300 dark:text-slate-600 group-hover:text-brand-500 transition text-sm font-bold pl-0.5">›</span>
            </div>
        </div>
    `;
}

function renderizarRepertorio(rows) {
    const container = document.getElementById('musicList');
    if (!container) return;

    // Atualiza visibilidade do botão Admin de Nova Música
    const btnNovaAdmin = document.getElementById('btn-admin-nova-musica-repertorio');
    if (btnNovaAdmin) {
        const canCreate = (typeof isAdmin !== 'undefined' && isAdmin) || (typeof hasPermission === 'function' && hasPermission('criar_musica'));
        btnNovaAdmin.classList.toggle('hidden', !canCreate);
    }

    const contadorTotalEl = document.getElementById('repertorio-contador-total');
    if (contadorTotalEl) {
        contadorTotalEl.textContent = `${rows ? rows.length : 0} músicas cadastradas`;
    }

    if (!rows || rows.length === 0) {
        container.innerHTML = `
            <div class="text-center py-16 px-4 bg-white dark:bg-night-900/40 rounded-2xl border border-slate-200 dark:border-slate-800/80 space-y-3">
                <div class="text-3xl">🎵</div>
                <h3 class="text-base font-bold text-slate-800 dark:text-slate-200">Repertório Vazio</h3>
                <p class="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">Nenhuma música cadastrada no acervo da igreja.</p>
            </div>
        `;
        return;
    }

    let html = '';
    rows.forEach((musicaObj, i) => {
        html += renderizarLinhaMusicaStreaming(musicaObj, i, 'repertorio');
    });
    container.innerHTML = html;
}

function renderizarMusicasNovas(rows) {
    const container = document.getElementById('novasList');
    if (!container) return;

    const contadorTopoEl = document.getElementById('badge-count-novas-topo');
    if (contadorTopoEl) {
        contadorTopoEl.textContent = `${rows ? rows.length : 0} louvores`;
    }

    if (!rows || rows.length === 0) {
        container.innerHTML = `
            <div class="text-center py-16 px-4 bg-white dark:bg-night-900/40 rounded-2xl border border-slate-200 dark:border-slate-800/80 space-y-3">
                <div class="text-3xl">✨</div>
                <h3 class="text-base font-bold text-slate-800 dark:text-slate-200">Nenhuma Música Nova no Momento</h3>
                <p class="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">Quando novas músicas forem selecionadas para ensaio, elas aparecerão aqui.</p>
            </div>
        `;
        return;
    }

    let html = '';
    rows.forEach((musicaObj, i) => {
        html += renderizarLinhaMusicaStreaming(musicaObj, i, 'novas');
    });
    container.innerHTML = html;
}

function filtrarMusicas() {
    const inputSearch = document.getElementById('searchInput');
    const termo = (inputSearch?.value || '').toLowerCase().trim();
    const btnLimpar = document.getElementById('btn-limpar-busca-repertorio');
    if (btnLimpar) btnLimpar.classList.toggle('hidden', termo.length === 0);

    const filtro = window.filtroRepertorioAtual || 'todas';
    const rows = dadosGlobais.repertorio || [];
    const container = document.getElementById('musicList');
    if (!container) return;

    let filtradas = [];
    rows.forEach((musicaObj) => {
        if (!musicaObj || !musicaObj.title) return;

        const title = (musicaObj.title || '').toLowerCase();
        const artist = (musicaObj.artist || '').toLowerCase();
        const passaBusca = !termo || title.includes(termo) || artist.includes(termo);

        let passaFiltro = true;
        const versoes = musicaObj.versions || [];
        const temVs = versoes.some(v => v.vs && v.vs.trim()) || (musicaObj.vs && musicaObj.vs.trim());
        const temYt = versoes.some(v => v.yt && v.yt.trim()) || (musicaObj.yt && musicaObj.yt.trim());
        const temCifra = (musicaObj.chords && musicaObj.chords.trim()) || versoes.some(v => v.chords && v.chords.trim());
        const temLetra = (musicaObj.lyrics && musicaObj.lyrics.trim()) || versoes.some(v => v.lyrics && v.lyrics.trim());

        if (filtro === 'com_vs') passaFiltro = temVs;
        else if (filtro === 'com_cifra') passaFiltro = temCifra;
        else if (filtro === 'com_yt') passaFiltro = temYt;
        else if (filtro === 'com_letra') passaFiltro = temLetra;

        if (passaBusca && passaFiltro) {
            filtradas.push(musicaObj);
        }
    });

    const contadorTotalEl = document.getElementById('repertorio-contador-total');
    if (contadorTotalEl) {
        contadorTotalEl.textContent = `${filtradas.length} de ${rows.length} músicas`;
    }

    if (filtradas.length === 0) {
        container.innerHTML = `
            <div class="text-center py-16 px-4 bg-white dark:bg-night-900/40 rounded-2xl border border-slate-200 dark:border-slate-800/80 space-y-3">
                <div class="text-3xl">🔍</div>
                <h3 class="text-base font-bold text-slate-800 dark:text-slate-200">Nenhuma música encontrada</h3>
                <p class="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">Tente alterar os termos da busca ou redefinir os filtros.</p>
                <button type="button" onclick="limparBuscaRepertorio(); selecionarFiltroRepertorio('todas');" class="text-xs text-brand-500 hover:underline font-semibold cursor-pointer">Ver todas as músicas</button>
            </div>
        `;
    } else {
        let html = '';
        filtradas.forEach((musicaObj, i) => {
            html += renderizarLinhaMusicaStreaming(musicaObj, i, 'repertorio');
        });
        container.innerHTML = html;
    }
}

function toggleCultoBloco(idPlaylist, idSeta) {
    const playlist = document.getElementById(idPlaylist);
    const seta = document.getElementById(idSeta);
    if (!playlist) return;
    playlist.classList.toggle('hidden');
    if (seta) {
        seta.classList.toggle('rotate-180', !playlist.classList.contains('hidden'));
    }
}

function toggleComentario(id) { document.getElementById(id).classList.toggle('hidden'); }

async function enviarComentario(musica, idAutor, idTexto, idStatus, categoria = 'Ajuste de Tom') {
    const autor = document.getElementById(idAutor).value;
    const texto = document.getElementById(idTexto).value;
    const statusEl = document.getElementById(idStatus);
    if (!autor || !texto) { mostrarToast('Preencha seu nome e a solicitação.', 'aviso'); return; }
    statusEl.textContent = 'Enviando...';
    statusEl.classList.remove('hidden');

    const commentText = `${musica} - (${autor}): ${texto}`;

    // Se o usuário estiver offline, salva direto na fila IndexedDB
    if (!navigator.onLine) {
        if (window.LocalDB) {
            await window.LocalDB.enfileirarSolicitacaoOffline({
                category: categoria || 'Ajuste de Tom',
                comment_text: commentText
            });
            statusEl.textContent = '📶 Salvo offline!';
            mostrarToast('Você está offline! Sua solicitação foi salva localmente e será enviada quando a conexão voltar.', 'aviso');
            document.getElementById(idTexto).value = '';
            setTimeout(() => statusEl.classList.add('hidden'), 4000);
            return;
        }
    }

    try {
        if (!supabaseClient) {
            throw new Error("Cliente Supabase não inicializado.");
        }

        const payload = {
            church_id: window.dadosGlobais?.church?.id || usuarioLogado?.church_id,
            category: categoria || 'Ajuste de Tom',
            comment_text: commentText
        };
        if (usuarioLogado) {
            payload.user_id = usuarioLogado.id;
        }

        const { error } = await supabaseClient
            .from('availability_comments')
            .insert(payload);

        if (!error) {
            statusEl.textContent = 'Enviado com sucesso!';
            mostrarToast('Solicitação enviada com sucesso!', 'sucesso');
            document.getElementById(idTexto).value = '';
            setTimeout(() => statusEl.classList.add('hidden'), 4000);
        } else {
            if (window.LocalDB) {
                await window.LocalDB.enfileirarSolicitacaoOffline({
                    category: categoria || 'Ajuste de Tom',
                    comment_text: commentText,
                    user_id: usuarioLogado ? usuarioLogado.id : null
                });
                statusEl.textContent = '📶 Salvo offline!';
                mostrarToast('Erro de rede. Solicitação salva offline no dispositivo!', 'aviso');
                document.getElementById(idTexto).value = '';
                setTimeout(() => statusEl.classList.add('hidden'), 4000);
            } else {
                statusEl.textContent = 'Erro ao enviar.';
                mostrarToast(`Erro ao enviar: ${error.message || 'Falha de conexão.'}`, 'erro');
            }
        }
    } catch (error) {
        if (window.LocalDB) {
            await window.LocalDB.enfileirarSolicitacaoOffline({
                category: categoria || 'Ajuste de Tom',
                comment_text: commentText,
                user_id: usuarioLogado ? usuarioLogado.id : null
            });
            statusEl.textContent = '📶 Salvo offline!';
            mostrarToast('Você está offline! Solicitação guardada no dispositivo.', 'aviso');
            document.getElementById(idTexto).value = '';
            setTimeout(() => statusEl.classList.add('hidden'), 4000);
        } else {
            console.error('Erro ao enviar comentário:', error);
            statusEl.textContent = 'Erro ao enviar.';
            mostrarToast(`Erro ao enviar: ${error.message || 'Falha de conexão.'}`, 'erro');
        }
    }
}

// ===================== AUTENTICAÇÃO DE USUÁRIO =====================

function abrirModalLoginUsuario() {
    const modal = document.getElementById('modal-login-usuario');
    if (modal) modal.classList.remove('hidden');
}

function fecharModalLoginUsuario() {
    const modal = document.getElementById('modal-login-usuario');
    if (modal) modal.classList.add('hidden');
    const erroMsg = document.getElementById('login-erro-msg');
    if (erroMsg) erroMsg.classList.add('hidden');
}

async function verificarSessaoAtiva() {
    try {
        if (!supabaseClient) return;
        const { data: sessionData, error } = await supabaseClient.auth.getSession();
        const session = sessionData ? sessionData.session : null;
        if (error) {
            console.warn('Erro ao obter sessão:', error);
            return;
        }
        if (session && session.user) {
            const userId = session.user.id;
            let profile = null;
            const { data: profileById } = await supabaseClient
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .maybeSingle();

            if (profileById) {
                profile = profileById;
            } else {
                // Tenta buscar pelo email, caso o ID da auth.users esteja dessincronizado
                const { data: profileByEmail } = await supabaseClient
                    .from('profiles')
                    .select('*')
                    .eq('email', session.user.email)
                    .maybeSingle();
                profile = profileByEmail;
            }

            if (profile && profile.id) {
                try {
                    const pid = profile.id;
                    const { data: umrData } = await supabaseClient
                        .from('user_ministry_roles')
                        .select('*, ministry_roles(*)')
                        .or(`profile_id.eq.${pid},user_id.eq.${pid}`);
                    profile.user_ministry_roles = umrData || [];

                    // Buscar os ministérios em que o perfil é líder
                    const { data: mlData } = await supabaseClient
                        .from('ministry_leaders')
                        .select('ministry_id')
                        .eq('profile_id', pid);

                    profile.lider_de = (mlData || []).map(ml => ml.ministry_id).filter(Boolean);
                } catch(e) {
                    profile.user_ministry_roles = [];
                    profile.lider_de = [];
                }
            }

            window.isSuperAdmin = false;
            try {
                const { data: saData } = await supabaseClient
                    .from('super_admins')
                    .select('user_id')
                    .eq('user_id', userId)
                    .maybeSingle();

                if (saData) {
                    window.isSuperAdmin = true;
                }
            } catch(e) {}

            usuarioLogado = profile || { id: userId, name: session.user.email, system_role: 'usuario', email: session.user.email };
            try {
                localStorage.setItem('cached_user_profile', JSON.stringify(usuarioLogado));
            } catch (e) {}

            const btnLogin = document.getElementById('btn-login-header');
            const btnSignup = document.getElementById('btn-signup-header');
            const btnOnboarding = document.getElementById('btn-onboarding-header');
            const sessionBar = document.getElementById('user-session-bar');
            const nameEl = document.getElementById('user-session-name');
            const roleEl = document.getElementById('user-session-role');
            const btnSugerir = document.getElementById('btn-sugerir-nova-container');

            if (btnLogin) btnLogin.classList.add('hidden');
            if (btnSignup) btnSignup.classList.add('hidden');
            if (btnOnboarding) btnOnboarding.classList.add('hidden');
            if (sessionBar) sessionBar.classList.remove('hidden');
            
            const containerBotoes = document.getElementById('botoes-sugestao-container');
            const btnSugerirNova = document.getElementById('btn-sugerir-nova-container');
            const btnIndisp = document.getElementById('btn-indisponibilidade-container');

            const canSugerirNova = hasPermission('enviar_sugestao_nova');
            const canSugerirEscala = hasPermission('enviar_sugestao_escala');

            if (containerBotoes) {
                if (canSugerirNova || canSugerirEscala) {
                    containerBotoes.classList.remove('hidden');
                } else {
                    containerBotoes.classList.add('hidden');
                }
            }

            if (btnSugerirNova) {
                if (canSugerirNova) btnSugerirNova.classList.remove('hidden');
                else btnSugerirNova.classList.add('hidden');
            }

            if (btnIndisp) {
                if (canSugerirEscala) btnIndisp.classList.remove('hidden');
                else btnIndisp.classList.add('hidden');
            }

            const btnMinhaContaSidebar = document.getElementById('sidebar-minha-conta-container');
            if (btnMinhaContaSidebar) btnMinhaContaSidebar.classList.remove('hidden');

            if (nameEl) nameEl.textContent = usuarioLogado.name || usuarioLogado.email || 'Usuário';
            let rawRole = (usuarioLogado.system_role || usuarioLogado.role || 'voluntário').toLowerCase();
            if (rawRole === 'volunteer') rawRole = 'voluntário';
            let roleText = rawRole.toUpperCase();
            const userMin = typeof getMinistryForUser === 'function' ? getMinistryForUser(usuarioLogado) : null;
            if (userMin) {
                roleText += ` - ${userMin.name.toUpperCase()}`;
            }
            if (roleEl) roleEl.textContent = roleText;
            atualizarTemaGlobal();

            // Disparar Assistente de Onboarding se a igreja estiver aprovada mas com onboarding pendente
            setTimeout(() => {
                if (usuarioLogado && (usuarioLogado.system_role === 'admin' || usuarioLogado.role === 'admin' || window.isSuperAdmin)) {
                    if (dadosGlobais.church && dadosGlobais.church.status === 'active' && dadosGlobais.church.onboarding_completed === false) {
                        if (typeof abrirModalOnboardingWizard === 'function') {
                            abrirModalOnboardingWizard();
                        }
                    }
                }
            }, 800);
        } else {
            usuarioLogado = null;
            try {
                localStorage.removeItem('cached_user_profile');
            } catch (e) {}
            const btnLogin = document.getElementById('btn-login-header');
            const btnSignup = document.getElementById('btn-signup-header');
            const btnOnboarding = document.getElementById('btn-onboarding-header');
            const sessionBar = document.getElementById('user-session-bar');
            const btnSugerir = document.getElementById('btn-sugerir-nova-container');
            const btnMinhaContaSidebar = document.getElementById('sidebar-minha-conta-container');
            if (btnLogin) btnLogin.classList.remove('hidden');
            if (btnSignup) btnSignup.classList.remove('hidden');
            if (btnOnboarding) btnOnboarding.classList.remove('hidden');
            if (sessionBar) sessionBar.classList.add('hidden');
            if (btnSugerir) btnSugerir.classList.add('hidden');
            if (btnMinhaContaSidebar) btnMinhaContaSidebar.classList.add('hidden');
            // Abas são controladas por aplicarVisibilidadePermissoes ao final
            const nameEl = document.getElementById('user-session-name');
            if (nameEl) nameEl.textContent = 'Usuário';
            atualizarTemaGlobal();
        }
        aplicarVisibilidadePermissoes();
    } catch (err) {
        console.error('Erro ao verificar sessão ativa:', err);
    }
}

async function realizarLoginUsuario(e) {
    if (e && e.preventDefault) e.preventDefault();
    const btnSubmit = document.getElementById('btn-submit-login');
    const erroMsg = document.getElementById('login-erro-msg');
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-senha').value;

    if (btnSubmit) btnSubmit.disabled = true;
    if (erroMsg) erroMsg.classList.add('hidden');

    try {
        if (!supabaseClient) throw new Error("Cliente Supabase não inicializado.");
        const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) throw error;

        await verificarSessaoAtiva();
        await carregarDados();
        fecharModalLoginUsuario();
        mostrarToast('Login realizado com sucesso!', 'sucesso');
    } catch (err) {
        console.error("Erro no login:", err);
        if (erroMsg) {
            erroMsg.textContent = err.message || 'Erro ao realizar login. Verifique suas credenciais.';
            erroMsg.classList.remove('hidden');
        }
    } finally {
        if (btnSubmit) btnSubmit.disabled = false;
    }
}

async function realizarLogoutUsuario() {
    try {
        try {
            localStorage.removeItem('cached_user_profile');
            localStorage.removeItem('cached_church_data');
            localStorage.removeItem('cached_theme_color');
        } catch (e) {}
        if (supabaseClient) {
            await supabaseClient.auth.signOut();
        }
    } catch (err) {
        console.warn('Erro ao realizar logout:', err);
    } finally {
        usuarioLogado = null;
        window.location.reload();
    }
}

// ===================== CADASTRO DE USUÁRIO =====================
function abrirModalCadastroUsuario() {
    const modal = document.getElementById('modal-cadastro-usuario');
    if (modal) modal.classList.remove('hidden');
}

function fecharModalCadastroUsuario() {
    const modal = document.getElementById('modal-cadastro-usuario');
    if (modal) modal.classList.add('hidden');
}

async function criarContaUsuario(e) {
    if (e && e.preventDefault) e.preventDefault();
    const btnSubmit = document.getElementById('btn-submit-cadastro');
    const erroMsg = document.getElementById('cadastro-erro-msg');
    const email = document.getElementById('cadastro-email').value.trim().toLowerCase();
    const password = document.getElementById('cadastro-senha').value;

    if (btnSubmit) btnSubmit.disabled = true;
    if (erroMsg) erroMsg.classList.add('hidden');

    try {
        if (!supabaseClient) throw new Error("Cliente Supabase não inicializado.");
        
        // 1. Verificar se o e-mail foi pré-cadastrado por um líder no sistema (na tabela profiles)
        const { data: profileExistente } = await supabaseClient
            .from('profiles')
            .select('*')
            .ilike('email', email)
            .maybeSingle();

        if (!profileExistente) {
            throw new Error("Este e-mail ainda não foi cadastrado por um líder no sistema. Peça ao líder da sua equipe para cadastrar seu e-mail no painel primeiro.");
        }

        // Salvar cópia das informações pré-cadastradas pelo líder
        const oldProfileId = profileExistente.id;
        const tempChurchId = profileExistente.church_id;
        const tempName = profileExistente.name;
        const tempPhone = profileExistente.phone;
        const tempRole = profileExistente.role;
        const tempSystemRole = profileExistente.system_role;
        const tempInstruments = profileExistente.instruments;
        const tempMinistryId = profileExistente.ministry_id;

        // Alteramos o e-mail temporariamente para evitar a colisão de UNIQUE KEY 'email' no Postgres
        // quando o trigger da Auth do Supabase rodar durante o signUp
        const tempEmailPlaceholder = `${email}.pending_${Date.now()}`;

        if (oldProfileId) {
            await supabaseClient
                .from('profiles')
                .update({ email: tempEmailPlaceholder })
                .eq('id', oldProfileId);
        }

        // 2. Realizar o cadastro na Auth do Supabase
        const { data, error } = await supabaseClient.auth.signUp({ 
            email, 
            password,
            options: {
                data: {
                    church_id: tempChurchId,
                    name: tempName
                }
            }
        });
        
        if (error) {
            // Reverter alteração de e-mail temporário se o cadastro falhar
            if (oldProfileId) {
                await supabaseClient
                    .from('profiles')
                    .update({ email: email })
                    .eq('id', oldProfileId);
            }
            throw error;
        }

        // 3. Vincular a conta de Auth ao perfil e migrar dados do pré-cadastro
        if (data && data.user) {
            const newAuthUserId = data.user.id;

            // Se o perfil antigo já existia com outro ID, atualizamos as funções vinculadas em user_ministry_roles
            if (oldProfileId && oldProfileId !== newAuthUserId) {
                await supabaseClient
                    .from('user_ministry_roles')
                    .update({ profile_id: newAuthUserId })
                    .eq('profile_id', oldProfileId);

                // Deletar o perfil temporário pré-existente
                await supabaseClient
                    .from('profiles')
                    .delete()
                    .eq('id', oldProfileId);
            }

            // Garante o upsert dos dados do integrante com o novo ID de autenticação
            await supabaseClient
                .from('profiles')
                .upsert({
                    id: newAuthUserId,
                    email: email,
                    name: tempName || data.user.email,
                    phone: tempPhone || '',
                    church_id: tempChurchId,
                    role: tempRole || 'volunteer',
                    system_role: tempSystemRole || 'voluntario',
                    ministry_id: tempMinistryId || null
                });
        }

        await verificarSessaoAtiva();
        fecharModalCadastroUsuario();
        
        if (typeof mostrarToast === 'function') {
            mostrarToast('Conta criada e vinculada com sucesso!', 'sucesso');
        }
    } catch (err) {
        console.error('Erro ao criar conta:', err);
        if (erroMsg) {
            erroMsg.textContent = err.message || 'Erro ao criar conta. Verifique os dados.';
            erroMsg.classList.remove('hidden');
        }
    } finally {
        if (btnSubmit) btnSubmit.disabled = false;
    }
}

// ===================== MINHA CONTA =====================

async function abrirMinhaConta() {
    if (!usuarioLogado || !usuarioLogado.id) {
        if (typeof mostrarToast === 'function') mostrarToast('Você precisa estar conectado para acessar seus dados.', 'aviso');
        else alert('Você precisa estar conectado para acessar seus dados.');
        return;
    }

    const modal = document.getElementById('modal-minha-conta');
    if (!modal) {
        console.warn("Modal #modal-minha-conta não encontrado no DOM.");
        return;
    }

    let profile = usuarioLogado;
    if (supabaseClient && usuarioLogado.id) {
        try {
            const { data, error } = await supabaseClient
                .from('profiles')
                .select('*')
                .eq('id', usuarioLogado.id)
                .maybeSingle();

            if (!error && data) {
                profile = { ...usuarioLogado, ...data };
                usuarioLogado = profile;
            }

            const pid = profile.id;
            try {
                const { data: umrData } = await supabaseClient
                    .from('user_ministry_roles')
                    .select('*, ministry_roles(*)')
                    .or(`profile_id.eq.${pid},user_id.eq.${pid}`);
                profile.user_ministry_roles = umrData || [];
            } catch(e) {
                console.warn('Fallback busca umr:', e);
            }
            if (!profile.user_ministry_roles || profile.user_ministry_roles.length === 0) {
                try {
                    const { data: umrSimple } = await supabaseClient
                        .from('user_ministry_roles')
                        .select('*')
                        .or(`profile_id.eq.${pid},user_id.eq.${pid}`);
                    if (umrSimple && umrSimple.length > 0) profile.user_ministry_roles = umrSimple;
                } catch(e){}
            }

            try {
                const { data: mlData } = await supabaseClient
                    .from('ministry_leaders')
                    .select('ministry_id')
                    .eq('profile_id', pid);
                profile.lider_de = (mlData || []).map(ml => ml.ministry_id).filter(Boolean);
            } catch(e){}

        } catch (e) {
            console.warn('Aviso ao sincronizar dados mais recentes do perfil:', e);
        }
    }

    const inputNome = document.getElementById('minha-conta-nome');
    const inputEmail = document.getElementById('minha-conta-email');
    const inputTelefone = document.getElementById('minha-conta-telefone');
    const inputBirthdate = document.getElementById('minha-conta-birthdate');
    const inputAddress = document.getElementById('minha-conta-address');

    if (inputNome) inputNome.value = profile.name || '';
    if (inputEmail) inputEmail.value = profile.email || '';
    if (inputTelefone) inputTelefone.value = profile.phone || '';
    if (inputBirthdate) inputBirthdate.value = profile.birthdate || '';
    if (inputAddress) inputAddress.value = profile.address || '';

    // Renderizar Badge de Privilégio Global
    const badgeRoleEl = document.getElementById('minha-conta-system-role-badge');
    if (badgeRoleEl) {
        const rawRole = (profile.system_role || profile.role || 'voluntario').toLowerCase();
        if (rawRole === 'admin') {
            badgeRoleEl.className = 'text-[10px] px-2 py-0.5 rounded-full font-bold uppercase bg-indigo-900/70 text-indigo-300 border border-indigo-700/60 shadow-sm';
            badgeRoleEl.innerHTML = '👑 Administrador';
        } else if (rawRole === 'lider') {
            badgeRoleEl.className = 'text-[10px] px-2 py-0.5 rounded-full font-bold uppercase bg-amber-900/70 text-amber-300 border border-amber-700/60 shadow-sm';
            badgeRoleEl.innerHTML = '⭐ Líder';
        } else if (rawRole === 'membro') {
            badgeRoleEl.className = 'text-[10px] px-2 py-0.5 rounded-full font-bold uppercase bg-slate-800 text-slate-300 border border-slate-700 shadow-sm';
            badgeRoleEl.innerHTML = '👤 Membro';
        } else {
            badgeRoleEl.className = 'text-[10px] px-2 py-0.5 rounded-full font-bold uppercase bg-emerald-900/70 text-emerald-300 border border-emerald-700/60 shadow-sm';
            badgeRoleEl.innerHTML = '🤝 Voluntário';
        }
    }

    // Renderizar Ministérios e Funções do Integrante
    const minContainer = document.getElementById('minha-conta-ministerios-container');
    if (minContainer) {
        const allMinistries = window.dadosGlobais?.ministries || [];
        const umr = profile.user_ministry_roles || [];
        const userRoleIds = umr.map(ur => ur.role_id || ur.ministry_role_id).filter(Boolean);

        const userMinIdsSet = new Set();
        if (profile.ministry_id) userMinIdsSet.add(profile.ministry_id);
        if (profile.lider_de && Array.isArray(profile.lider_de)) {
            profile.lider_de.forEach(id => userMinIdsSet.add(id));
        }

        allMinistries.forEach(m => {
            if (m.id === profile.ministry_id) userMinIdsSet.add(m.id);
            const mRoles = m.ministry_roles || [];
            if (mRoles.some(r => userRoleIds.includes(r.id))) {
                userMinIdsSet.add(m.id);
            }
        });

        umr.forEach(ur => {
            if (ur.ministry_id) userMinIdsSet.add(ur.ministry_id);
            if (ur.ministry_roles && ur.ministry_roles.ministry_id) userMinIdsSet.add(ur.ministry_roles.ministry_id);
        });

        const userMinIds = Array.from(userMinIdsSet);

        if (userMinIds.length === 0) {
            minContainer.innerHTML = `
                <div class="p-3 bg-slate-900/60 rounded-xl border border-slate-800 text-slate-400 italic text-center">
                    Você ainda não possui ministérios vinculados à sua conta.
                </div>
            `;
        } else {
            minContainer.innerHTML = userMinIds.map(minId => {
                const min = allMinistries.find(m => m.id === minId) || { name: 'Ministério', icon: '🏢' };
                const isLider = (profile.lider_de && profile.lider_de.includes(minId)) 
                    || (min.leader_id === profile.id);

                // Encontrar funções vinculadas a este ministério
                const funcoesDoMinisterio = [];
                const mRoles = min.ministry_roles || [];
                mRoles.forEach(r => {
                    if (userRoleIds.includes(r.id) && !funcoesDoMinisterio.includes(r.name || r.role_name)) {
                        funcoesDoMinisterio.push(r.name || r.role_name);
                    }
                });

                umr.forEach(ur => {
                    if (ur.ministry_id === minId || (ur.ministry_roles && ur.ministry_roles.ministry_id === minId)) {
                        const name = ur.ministry_roles?.name || ur.role_name;
                        if (name && !funcoesDoMinisterio.includes(name)) {
                            funcoesDoMinisterio.push(name);
                        }
                    }
                });

                const liderBadge = isLider 
                    ? '<span class="bg-amber-500/15 text-amber-400 border border-amber-500/30 text-[10px] px-2 py-0.5 rounded-full font-semibold">⭐ Líder</span>' 
                    : '<span class="bg-emerald-950/40 text-emerald-300 border border-emerald-700/40 text-[10px] px-2 py-0.5 rounded-full">🤝 Voluntário</span>';

                let funcoesHtml = '';
                if (funcoesDoMinisterio.length > 0) {
                    funcoesHtml = funcoesDoMinisterio.map(fn => `
                        <span class="bg-slate-800/90 text-slate-200 px-2 py-0.5 rounded-md text-[11px] border border-slate-700/80 font-medium">
                            ${fn}
                        </span>
                    `).join('');
                } else {
                    funcoesHtml = '<span class="text-slate-500 italic text-[11px]">Nenhuma função específica definida.</span>';
                }

                return `
                    <div class="bg-slate-900/90 rounded-xl p-3 border border-slate-800 space-y-2">
                        <div class="flex items-center justify-between">
                            <div class="flex items-center gap-2">
                                <span class="text-base">${min.icon || '🏢'}</span>
                                <span class="font-bold text-white text-xs">${min.name}</span>
                            </div>
                            ${liderBadge}
                        </div>
                        <div class="flex flex-wrap gap-1.5 pt-0.5">
                            ${funcoesHtml}
                        </div>
                    </div>
                `;
            }).join('');
        }
    }

    if (typeof atualizarIndicadoresModoTema === 'function') {
        const modoAtual = (profile && profile.theme_mode) || (typeof obterModoTemaAtual === 'function' ? obterModoTemaAtual() : 'dark');
        atualizarIndicadoresModoTema(modoAtual);
    }

    modal.classList.remove('hidden');
}

function fecharMinhaConta() {
    const modal = document.getElementById('modal-minha-conta');
    if (modal) modal.classList.add('hidden');
}

async function salvarMinhaConta(e) {
    if (e && e.preventDefault) e.preventDefault();

    if (!usuarioLogado || !usuarioLogado.id) {
        if (typeof mostrarToast === 'function') mostrarToast('Usuário não autenticado.', 'erro');
        else alert('Usuário não autenticado.');
        return;
    }

    const btn = document.getElementById('btn-salvar-minha-conta');
    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Salvando...';
    }

    const nome = document.getElementById('minha-conta-nome')?.value.trim() || '';
    const telefone = document.getElementById('minha-conta-telefone')?.value.trim() || '';
    const birthdate = document.getElementById('minha-conta-birthdate')?.value || null;
    const address = document.getElementById('minha-conta-address')?.value.trim() || '';

    try {
        if (!supabaseClient) throw new Error("Cliente Supabase não inicializado.");

        const modoTema = typeof obterModoTemaAtual === 'function' ? obterModoTemaAtual() : 'dark';
        const updatePayload = {
            name: nome,
            phone: telefone,
            birthdate: birthdate ? birthdate : null,
            address: address,
            theme_mode: modoTema
        };

        const { error } = await supabaseClient
            .from('profiles')
            .update(updatePayload)
            .eq('id', usuarioLogado.id);

        if (error) throw error;

        // Atualizar cache local do usuário logado
        usuarioLogado = {
            ...usuarioLogado,
            ...updatePayload
        };

        // Atualizar exibição do nome no cabeçalho
        const nameEl = document.getElementById('user-session-name');
        if (nameEl && nome) {
            nameEl.textContent = nome;
        }

        if (typeof mostrarToast === 'function') {
            mostrarToast('Dados da sua conta atualizados com sucesso!', 'sucesso');
        } else {
            alert('Dados da sua conta atualizados com sucesso!');
        }

        fecharMinhaConta();
    } catch (err) {
        console.error('Erro ao salvar dados da conta:', err);
        if (typeof mostrarToast === 'function') {
            mostrarToast(`Erro ao salvar dados: ${err.message || 'Falha no banco.'}`, 'erro');
        } else {
            alert('Erro ao salvar dados: ' + err.message);
        }
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = '💾 Salvar';
        }
    }
}

window.abrirMinhaConta = abrirMinhaConta;
window.fecharMinhaConta = fecharMinhaConta;
window.salvarMinhaConta = salvarMinhaConta;

// ===================== CONTROLE DE ACESSO (RBAC) =====================

function aplicarVisibilidadePermissoes() {
    const userToEvaluate = modoSimulacaoPerfil || usuarioLogado;
    const role = userToEvaluate ? (userToEvaluate.system_role || userToEvaluate.role || 'membro') : 'visitante';
    const isSystemAdmin = role === 'admin';
    const isLiderOrAdmin = role === 'admin' || role === 'lider';
    const userMinistryIds = typeof obterIdsMinisteriosDoUsuario === 'function' ? obterIdsMinisteriosDoUsuario(userToEvaluate) : (userToEvaluate?.ministry_id ? [userToEvaluate.ministry_id] : []);
    const temMinisterio = userMinistryIds.length > 0 || isSystemAdmin;

    console.log("Aplicando Visibilidade e Permissões para Papel:", role, "| Tem Ministério:", temMinisterio);

    // 1. Botão Painel Admin
    const btnAdminPanel = document.getElementById('btn-admin-panel');
    if (btnAdminPanel) {
        if (isLiderOrAdmin) {
            btnAdminPanel.classList.remove('hidden');
            isAdmin = isLiderOrAdmin;
        } else {
            btnAdminPanel.classList.add('hidden');
            isAdmin = false;
        }
    }

    // 1.1 Ocultar container de simulação de perfil para quem não é Admin real
    const containerSimulacao = document.getElementById('container-simulacao-admin');
    if (containerSimulacao) {
        const realRole = usuarioLogado ? (usuarioLogado.system_role || usuarioLogado.role || 'membro') : 'visitante';
        if (realRole === 'admin') {
            containerSimulacao.classList.remove('hidden');
        } else {
            containerSimulacao.classList.add('hidden');
        }
    }

    // 1.2. Botão Almoxarifado (Ocultar se o usuário não possuir nenhum ministério e não for admin)
    const btnAlmox = document.getElementById('btn-almoxarifado');
    if (btnAlmox) {
        if (temMinisterio) btnAlmox.classList.remove('hidden');
        else btnAlmox.classList.add('hidden');
    }

    // 1.3. Botão Analytics (Ocultar se não for líder ou admin)
    const btnAnalytics = document.getElementById('btn-analytics');
    if (btnAnalytics) {
        if (isLiderOrAdmin) btnAnalytics.classList.remove('hidden');
        else btnAnalytics.classList.add('hidden');
    }

    // 1.5. Botão Novo Culto
    const btnNovoCulto = document.getElementById('btn-admin-novo-culto');
    if (btnNovoCulto) {
        if (isSystemAdmin) btnNovoCulto.classList.remove('hidden');
        else btnNovoCulto.classList.add('hidden');
    }

    // 2. Abas Principais
    const secoesMain = ['cultos', 'repertorio', 'novas', 'midia', 'almoxarifado', 'analytics'];
    let activeTabMain = 'cultos';
    for (const tab of secoesMain) {
        const el = document.getElementById(`secao-${tab}`);
        if (el && !el.classList.contains('hidden')) {
            activeTabMain = tab;
            break;
        }
    }
    if (activeTabMain === 'repertorio' && !hasPermission('ver_repertorio')) activeTabMain = 'cultos';
    if (activeTabMain === 'novas' && !hasPermission('ver_musicas_novas')) activeTabMain = 'cultos';
    if (activeTabMain === 'midia' && !hasPermission('ver_aba_midias_upadas')) activeTabMain = 'cultos';
    if (activeTabMain === 'almoxarifado' && !temMinisterio) activeTabMain = 'cultos';
    if (activeTabMain === 'analytics' && !isLiderOrAdmin) activeTabMain = 'cultos';

    if (typeof mudarAba === 'function') {
        mudarAba(activeTabMain);
    }

    const containerBotoesAcao = document.getElementById('botoes-sugestao-container');
    const btnSugerirNova = document.getElementById('btn-sugerir-nova-container');
    const btnIndisponibilidade = document.getElementById('btn-indisponibilidade-container');
    const btnHolyricsIgreja = document.getElementById('btn-holyrics-igreja-container');

    const podeSugerir = hasPermission('enviar_sugestao_culto');
    const podeIndisponibilidade = temMinisterio && role !== 'visitante';
    const podeHolyrics = hasPermission('gerar_script_holyrics');

    if (btnSugerirNova) {
        btnSugerirNova.classList.toggle('hidden', !podeSugerir);
    }
    if (btnIndisponibilidade) {
        btnIndisponibilidade.classList.toggle('hidden', !podeIndisponibilidade);
    }
    if (btnHolyricsIgreja) {
        btnHolyricsIgreja.classList.toggle('hidden', !podeHolyrics);
    }
    if (containerBotoesAcao) {
        if (podeSugerir || podeIndisponibilidade || podeHolyrics) containerBotoesAcao.classList.remove('hidden');
        else containerBotoesAcao.classList.add('hidden');
    }

    const botoesAjuste = document.querySelectorAll('.btn-pedir-ajuste');
    botoesAjuste.forEach(btn => {
        if (hasPermission('enviar_solic_musica')) btn.classList.remove('hidden');
        else btn.classList.add('hidden');
    });

    // 3.1. Controle de Upload de Mídias por Ministério
    let podeFazerUploadMidia = isSystemAdmin;
    if (!podeFazerUploadMidia && userMinistryIds.length > 0 && dadosGlobais.ministries) {
        podeFazerUploadMidia = dadosGlobais.ministries.some(m => userMinistryIds.includes(m.id) && m.can_upload_media === true);
    }
    const btnUploadMidiaWrapper = document.getElementById('btn-upload-midia-wrapper');
    const dropzoneMidia = document.getElementById('dropzone-midia');
    const containerMidiaUploadAcao = document.getElementById('container-midia-upload-acao');
    if (btnUploadMidiaWrapper) btnUploadMidiaWrapper.classList.toggle('hidden', !podeFazerUploadMidia);
    if (dropzoneMidia) dropzoneMidia.classList.toggle('hidden', !podeFazerUploadMidia);
    if (containerMidiaUploadAcao) containerMidiaUploadAcao.classList.toggle('hidden', !podeFazerUploadMidia);

    // 4. Modais e Edições restritos (Admin)
    if (typeof renderizarAdminListaCultos === 'function') {
        renderizarAdminListaCultos();
    }

    // 5. Abas do Painel Admin (Visibilidade, Rótulos e Seleção Ativa)
    const tabMinisterios = document.getElementById('tab-admin-ministerios');
    const tituloMinisterios = document.getElementById('admin-ministerios-titulo');
    const btnNovoMin = document.getElementById('btn-admin-novo-ministerio');

    if (tabMinisterios) {
        if (role === 'admin') {
            tabMinisterios.textContent = '🏢 Ministérios & Equipes';
            if (tituloMinisterios) tituloMinisterios.textContent = 'Ministérios & Equipes';
            if (btnNovoMin) btnNovoMin.classList.remove('hidden');
        } else if (role === 'lider') {
            tabMinisterios.textContent = '👥 Minha Equipe';
            if (tituloMinisterios) tituloMinisterios.textContent = 'Minha Equipe';
            if (btnNovoMin) btnNovoMin.classList.add('hidden');
        }
    }

    if (typeof mudarAbaAdmin === 'function') {
        const abasAdmin = ['cultos', 'historico', 'ministerios', 'repertorio', 'novas', 'solicitacoes', 'configuracoes'];
        let activeTab = 'cultos';
        for (const tab of abasAdmin) {
            const el = document.getElementById(`admin-aba-${tab}`);
            if (el && !el.classList.contains('hidden')) {
                activeTab = tab;
                break;
            }
        }
        if (activeTab === 'configuracoes' && role !== 'admin') {
            activeTab = 'cultos';
        }
        mudarAbaAdmin(activeTab);
    }

    if (typeof atualizarSidebarPerfilUsuario === 'function') {
        atualizarSidebarPerfilUsuario();
    }
}
window.aplicarVisibilidadePermissoes = aplicarVisibilidadePermissoes;

function atualizarTemaGlobal() {
    let corTema = 'amber';
    
    console.log('[TEMA] atualizarTemaGlobal chamado. usuarioLogado:', !!usuarioLogado, 'church:', dadosGlobais.church);

    // 1. A paleta configurada na congregação define a atmosfera principal do site (padrão oficial: amber)
    if (dadosGlobais.church && dadosGlobais.church.theme_color_secondary && window.COMPLETE_PALETTES && window.COMPLETE_PALETTES[dadosGlobais.church.theme_color_secondary.toLowerCase()]) {
        corTema = dadosGlobais.church.theme_color_secondary.toLowerCase();
    } else {
        corTema = 'amber';
    }

    console.log('[TEMA] Paleta final aplicada:', corTema);
    if (typeof aplicarTemaColor === 'function') {
        aplicarTemaColor(corTema);
    }
    try {
        localStorage.setItem('cached_theme_color', corTema);
    } catch(e){}

    // 2. Respeitar a preferência individual de Tema Claro / Escuro do usuário
    let modoUsuario = 'dark';
    if (usuarioLogado && usuarioLogado.theme_mode) {
        modoUsuario = usuarioLogado.theme_mode;
    } else if (typeof obterModoTemaAtual === 'function') {
        modoUsuario = obterModoTemaAtual();
    }
    if (typeof definirModoTema === 'function') {
        definirModoTema(modoUsuario, false);
    }
}
window.atualizarTemaGlobal = atualizarTemaGlobal;

// ===================== ONBOARDING SAAS: CADASTRAR NOVA IGREJA =====================

function abrirModalCadastroIgreja() {
    const modal = document.getElementById('modal-cadastro-igreja');
    if (modal) modal.classList.remove('hidden');
    
    // Gerar Math Captcha Simples
    const num1 = Math.floor(Math.random() * 10) + 1;
    const num2 = Math.floor(Math.random() * 10) + 1;
    const operacao = Math.random() > 0.5 ? '+' : '*';
    const resultado = operacao === '+' ? num1 + num2 : num1 * num2;
    
    const perguntaEl = document.getElementById('captcha-pergunta');
    const respostaCorretaEl = document.getElementById('captcha-resposta-correta');
    const inputCaptcha = document.getElementById('onboarding-captcha-admin');
    
    if (perguntaEl) perguntaEl.textContent = `Quanto é ${num1} ${operacao} ${num2}?`;
    if (respostaCorretaEl) respostaCorretaEl.value = resultado;
    if (inputCaptcha) inputCaptcha.value = '';
}

function fecharModalCadastroIgreja() {
    const modal = document.getElementById('modal-cadastro-igreja');
    if (modal) modal.classList.add('hidden');
    const erroEl = document.getElementById('onboarding-erro-msg');
    if (erroEl) erroEl.classList.add('hidden');
}

async function realizarOnboardingIgreja(event) {
    event.preventDefault();
    const erroEl = document.getElementById('onboarding-erro-msg');
    if (erroEl) erroEl.classList.add('hidden');

    // Validação do Captcha
    const captchaDigitado = document.getElementById('onboarding-captcha-admin')?.value;
    const captchaCorreto = document.getElementById('captcha-resposta-correta')?.value;
    if (captchaDigitado !== captchaCorreto) {
        if (erroEl) { erroEl.textContent = "Verificação de segurança incorreta (Captcha). Tente novamente."; erroEl.classList.remove('hidden'); }
        abrirModalCadastroIgreja(); // Regerar captcha
        return;
    }

    // Rate Limit Simples (1 igreja por dia)
    const ultimaIgreja = localStorage.getItem('liturge_last_church_creation');
    if (ultimaIgreja) {
        const diffTempo = Date.now() - parseInt(ultimaIgreja);
        if (diffTempo < 86400000) { // 24 horas
            if (erroEl) { erroEl.textContent = "Você já cadastrou uma igreja recentemente. Aguarde 24 horas."; erroEl.classList.remove('hidden'); }
            return;
        }
    }
    const nomeIgreja = document.getElementById('onboarding-nome-igreja').value.trim();
    const typedTag = document.getElementById('onboarding-slug-igreja')?.value.trim();
    const tagBase = nomeIgreja.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    const tagIgreja = typedTag ? typedTag.toLowerCase().replace(/[^a-z0-9_-]/g, '-') : `${tagBase || 'igreja'}-${Math.floor(Math.random() * 8999 + 1000)}`;
    
    const corTema = document.getElementById('onboarding-cor-igreja').value;
    const nomeAdmin = document.getElementById('onboarding-nome-admin').value.trim();
    const emailAdmin = document.getElementById('onboarding-email-admin').value.trim();
    const senhaAdmin = document.getElementById('onboarding-senha-admin').value;
    const whatsappAdmin = document.getElementById('onboarding-whatsapp-admin').value.trim();

    const btn = document.getElementById('btn-submit-onboarding');

    if (!nomeIgreja || !nomeAdmin || !emailAdmin || !senhaAdmin || !whatsappAdmin) {
        if (erroEl) { erroEl.textContent = 'Preencha todos os campos obrigatórios.'; erroEl.classList.remove('hidden'); }
        return;
    }

    if (btn) { btn.disabled = true; btn.textContent = 'Provisionando igreja...'; }

    try {
        if (!supabaseClient) throw new Error("Cliente Supabase não está inicializado.");

        const emptyPerms = {
            ver_escala: false,
            ver_letra: false,
            ver_cifra: false,
            ver_vs: false,
            ver_youtube: false,
            ver_cantor: false,
            ver_midia: false,
            enviar_solic_musica: false,
            enviar_sugestao_culto: false,
            ver_repertorio: false,
            ver_musicas_novas: false,
            ver_aba_midias_upadas: false,
            ver_agenda: false,
            gerar_script_holyrics: false,
            ver_almoxarifado: false
        };

        // 1. Criar registro na tabela 'churches' como status 'pending' e permissões desativadas
        const { data: newChurch, error: churchErr } = await supabaseClient
            .from('churches')
            .insert({
                name: nomeIgreja,
                slug: tagIgreja,
                theme_color_primary: corTema,
                status: 'pending',
                agreed_payment: 'A combinar',
                leader_whatsapp: whatsappAdmin,
                public_permissions: emptyPerms,
                onboarding_completed: false
            })
            .select('id')
            .single();

        if (churchErr) throw churchErr;
        const churchId = newChurch.id;

        // 2. Criar a conta Auth do Administrador no Supabase
        const { data: authData, error: authErr } = await supabaseClient.auth.signUp({
            email: emailAdmin,
            password: senhaAdmin,
            options: {
                data: {
                    name: nomeAdmin,
                    role: 'admin',
                    system_role: 'admin',
                    church_id: churchId
                }
            }
        });

        if (authErr) throw authErr;
        const userId = authData.user?.id;

        // 3. Criar registro inicial na tabela 'profiles' para o Admin
        if (userId) {
            await supabaseClient.from('profiles').upsert({
                id: userId,
                name: nomeAdmin,
                email: emailAdmin,
                phone: whatsappAdmin,
                role: 'admin',
                system_role: 'admin',
                church_id: churchId,
                instruments: ['Líder']
            });
        }

        // Registrar timestamp para anti-spam
        try { localStorage.setItem('last_church_onboarding_ts', Date.now().toString()); } catch (e) {}

        fecharModalCadastroIgreja();
        mostrarToast('Igreja cadastrada com sucesso! Redirecionando...', 'sucesso');
        
        // Recarregar app com o novo ambiente da igreja (irá detectar status 'pending' e travar na tela pendente)
        await carregarDados();

        // Dispara o WhatsApp imediatamente para o Administrador Global
        const adminPhone = "5511997787992"; // WhatsApp do Administrador do Liturge
        const texto = `Olá! Acabei de cadastrar a minha igreja no Liturge e gostaria de solicitar a ativação.
- *Igreja:* ${nomeIgreja} (TAG: ${tagIgreja})
- *Líder:* ${nomeAdmin} (${emailAdmin})
- *WhatsApp:* ${whatsappAdmin}`;
        
        const encodedText = encodeURIComponent(texto);
        window.open(`https://wa.me/${adminPhone}?text=${encodedText}`, '_blank');

    } catch (err) {
        console.error("Erro no Onboarding da Igreja:", err);
        if (erroEl) {
            erroEl.textContent = `Erro ao cadastrar igreja: ${err.message || 'Verifique se a TAG ou e-mail já estão em uso.'}`;
            erroEl.classList.remove('hidden');
        }
        mostrarToast('Erro ao realizar onboarding da igreja.', 'erro');
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = '🚀 Criar Igreja & Iniciar'; }
    }
}

window.abrirModalCadastroIgreja = abrirModalCadastroIgreja;
window.fecharModalCadastroIgreja = fecharModalCadastroIgreja;
window.realizarOnboardingIgreja = realizarOnboardingIgreja;

function exibirLandingBoasVindas() {
    const landing = document.getElementById('landing-boas-vindas');
    const mainContent = document.getElementById('conteudo-principal-site');
    const footerBar = document.querySelector('div.bg-slate-800.border-t.border-slate-700');
    const authHeader = document.getElementById('auth-header-container');
    const btnMenu = document.getElementById('btn-menu-mobile');
    
    if (landing) landing.classList.remove('hidden');
    if (mainContent) mainContent.classList.add('hidden');
    if (footerBar) footerBar.classList.add('hidden');
    if (authHeader) authHeader.classList.add('hidden');
    if (btnMenu) btnMenu.classList.add('hidden');
}

function ocultarLandingBoasVindas() {
    const landing = document.getElementById('landing-boas-vindas');
    const mainContent = document.getElementById('conteudo-principal-site');
    const footerBar = document.querySelector('div.bg-slate-800.border-t.border-slate-700');
    const authHeader = document.getElementById('auth-header-container');
    const btnMenu = document.getElementById('btn-menu-mobile');
    
    if (landing) landing.classList.add('hidden');
    if (mainContent) mainContent.classList.remove('hidden');
    if (footerBar) footerBar.classList.remove('hidden');
    if (authHeader) authHeader.classList.remove('hidden');
    if (btnMenu) btnMenu.classList.remove('hidden');
}

async function irParaIgrejaBuscada() {
    const input = document.getElementById('landing-busca-igreja');
    const erroEl = document.getElementById('landing-busca-erro');
    if (!input) return;
    
    const tag = input.value.trim().toLowerCase();
    if (!tag) {
        if (erroEl) {
            erroEl.textContent = "Digite a TAG da igreja.";
            erroEl.classList.remove('hidden');
        }
        return;
    }
    
    if (erroEl) erroEl.classList.add('hidden');
    
    try {
        if (!supabaseClient) throw new Error("Cliente Supabase não carregado.");
        const { data, error } = await supabaseClient.from('churches').select('slug').eq('slug', tag).maybeSingle();
        
        if (error) throw error;
        
        if (data) {
            const url = new URL(window.location.href);
            url.searchParams.set('tag', tag);
            url.searchParams.set('c', tag);
            window.location.href = url.toString();
        } else {
            if (erroEl) {
                erroEl.textContent = `Igreja com TAG "${tag}" não encontrada. Verifique se digitou correto.`;
                erroEl.classList.remove('hidden');
            }
        }
    } catch (err) {
        console.error(err);
        if (erroEl) {
            erroEl.textContent = "Erro ao buscar igreja. Tente novamente mais tarde.";
            erroEl.classList.remove('hidden');
        }
    }
}

window.exibirLandingBoasVindas = exibirLandingBoasVindas;
window.ocultarLandingBoasVindas = ocultarLandingBoasVindas;
window.irParaIgrejaBuscada = irParaIgrejaBuscada;

function exibirLandingPendente(church) {
    const landingPendente = document.getElementById('landing-pendente');
    const mainContent = document.getElementById('conteudo-principal-site');
    const footerBar = document.querySelector('div.bg-slate-800.border-t.border-slate-700');
    const authHeader = document.getElementById('auth-header-container');
    const btnMenu = document.getElementById('btn-menu-mobile');
    const landingBoasVindas = document.getElementById('landing-boas-vindas');
    const churchNameEl = document.getElementById('pending-church-name');
    const btnWhatsapp = document.getElementById('btn-pending-whatsapp');

    if (landingPendente) landingPendente.classList.remove('hidden');
    if (landingBoasVindas) landingBoasVindas.classList.add('hidden');
    if (mainContent) mainContent.classList.add('hidden');
    if (footerBar) footerBar.classList.add('hidden');
    if (authHeader) authHeader.classList.add('hidden');
    if (btnMenu) btnMenu.classList.add('hidden');

    if (churchNameEl) {
        churchNameEl.textContent = church.name;
    }

    if (btnWhatsapp) {
        btnWhatsapp.onclick = () => {
            const adminPhone = "5511997787992"; // WhatsApp do Administrador do Liturge
            const texto = `Olá! Gostaria de solicitar a ativação do Liturge para a minha igreja:
- *Igreja:* ${church.name}
- *TAG da Igreja:* ${church.slug}
- *Líder/WhatsApp:* ${church.leader_whatsapp || 'Não informado'}`;
            
            const encodedText = encodeURIComponent(texto);
            window.open(`https://wa.me/${adminPhone}?text=${encodedText}`, '_blank');
        };
    }
}

window.exibirLandingPendente = exibirLandingPendente;

async function migrarNotasParaServiceScalesSeNecessario(servicesData) {
    if (!servicesData || !Array.isArray(servicesData) || !supabaseClient) return;
    const voluntarios = (typeof Store !== 'undefined' && Store.getVoluntarios) ? Store.getVoluntarios() : (window.dadosGlobais?.voluntarios || []);
    const ministries = (typeof Store !== 'undefined' && Store.getMinistries) ? Store.getMinistries() : (window.dadosGlobais?.ministries || []);
    if (!voluntarios || voluntarios.length === 0) return;

    let cantorRoleId = null;
    for (const m of ministries) {
        const found = (m.ministry_roles || []).find(r => {
            if (r.scale_scope === 'song') return true;
            const nameNorm = typeof removerAcentos === 'function' ? removerAcentos((r.name || '').toLowerCase()) : (r.name || '').toLowerCase();
            return nameNorm.includes('cantor') || nameNorm.includes('vocal');
        });
        if (found) { cantorRoleId = found.id; break; }
    }

    for (const service of servicesData) {
        // Se o serviço tem notes em JSON mas não tem registros em service_scales
        if (service.notes && (!service.service_scales || service.service_scales.length === 0)) {
            try {
                const parsed = JSON.parse(service.notes);
                const scalesToInsert = [];

                if (parsed.escala && typeof parsed.escala === 'object') {
                    Object.entries(parsed.escala).forEach(([roleName, nomeVoluntario]) => {
                        if (nomeVoluntario && typeof nomeVoluntario === 'string') {
                            const prof = voluntarios.find(p => p.name === nomeVoluntario || p.id === nomeVoluntario);
                            if (prof && prof.id) {
                                let roleId = null;
                                const searchRoleNorm = typeof removerAcentos === 'function' ? removerAcentos(roleName.toLowerCase()) : roleName.toLowerCase();
                                for (const m of ministries) {
                                    const found = (m.ministry_roles || []).find(r => {
                                        const rNorm = typeof removerAcentos === 'function' ? removerAcentos((r.name || '').toLowerCase()) : (r.name || '').toLowerCase();
                                        return rNorm === searchRoleNorm;
                                    });
                                    if (found) { roleId = found.id; break; }
                                }
                                const payload = {
                                    service_id: service.id,
                                    user_id: prof.id
                                };
                                if (roleId) payload.role_id = roleId;
                                if (service.church_id) payload.church_id = service.church_id;
                                scalesToInsert.push(payload);
                            }
                        }
                    });
                }

                if (parsed.cantores && Array.isArray(parsed.cantores)) {
                    parsed.cantores.forEach(nomeCantor => {
                        if (nomeCantor && typeof nomeCantor === 'string') {
                            const prof = voluntarios.find(p => p.name === nomeCantor || p.id === nomeCantor);
                            if (prof && prof.id) {
                                const payload = {
                                    service_id: service.id,
                                    user_id: prof.id
                                };
                                if (cantorRoleId) payload.role_id = cantorRoleId;
                                if (service.church_id) payload.church_id = service.church_id;
                                scalesToInsert.push(payload);
                            }
                        }
                    });
                }

                if (scalesToInsert.length > 0) {
                    console.log(`[Migração] Tentando migrar ${scalesToInsert.length} voluntários para service_scales no culto ${service.id}...`);
                    const { error: insertErr } = await supabaseClient.from('service_scales').insert(scalesToInsert);
                    if (insertErr) {
                        console.warn('[Migração] Aviso de schema ou permissão em service_scales. Interrompendo auto-migração:', insertErr.message);
                        break; // Interrompe para evitar loop de erros
                    }
                }
            } catch (err) {
                console.warn('[Migração] Erro ao migrar notes para service_scales:', err);
                break;
            }
        }
    }
}

window.migrarNotasParaServiceScalesSeNecessario = migrarNotasParaServiceScalesSeNecessario;

function mudarSubAbaCultos(subAba) {
    const secProximos = document.getElementById('secao-cultos-proximos');
    const secHistorico = document.getElementById('secao-cultos-historico');
    const btnProximos = document.getElementById('btn-cultos-proximos');
    const btnHistorico = document.getElementById('btn-cultos-historico');

    const ativo = "px-4 py-2 rounded-xl text-xs font-semibold transition bg-brand-600 text-white shadow flex items-center gap-1.5";
    const inativo = "px-4 py-2 rounded-xl text-xs font-semibold transition bg-slate-800 text-slate-300 hover:text-white flex items-center gap-1.5";

    if (secProximos && secHistorico && btnProximos && btnHistorico) {
        if (subAba === 'proximos') {
            secProximos.classList.remove('hidden');
            secHistorico.classList.add('hidden');
            btnProximos.className = ativo;
            btnHistorico.className = inativo;
        } else {
            secProximos.classList.add('hidden');
            secHistorico.classList.remove('hidden');
            btnProximos.className = inativo;
            btnHistorico.className = ativo;
            renderizarHistoricoCultos();
        }
    }
}
window.mudarSubAbaCultos = mudarSubAbaCultos;

function renderizarHistoricoCultos() {
    const container = document.getElementById('admin-historico-cultos-lista');
    if (!container) return;
    container.innerHTML = '';

    const rawServices = dadosGlobais.services || [];
    // Filtrar por arquivado ou data passada
    const archivedServices = rawServices.filter(s => s.status === 'arquivado');

    if (archivedServices.length === 0) {
        container.innerHTML = '<p class="text-center text-slate-500 py-10">Nenhum culto arquivado encontrado.</p>';
        return;
    }

    // Ordenar do mais novo para o mais antigo
    archivedServices.sort((a, b) => new Date(b.date) - new Date(a.date));

    const meses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    const grupos = {};
    archivedServices.forEach(s => {
        let mesAno = "Outros";
        if (s.date) {
            const partes = s.date.split('-');
            if (partes.length >= 2) {
                const mesIdx = parseInt(partes[1], 10) - 1;
                mesAno = `${meses[mesIdx]} de ${partes[0]}`;
            }
        }
        if (!grupos[mesAno]) grupos[mesAno] = [];
        grupos[mesAno].push(s);
    });

    let html = '';
    let grupoContador = 0;
    
    const canVerEscala = hasPermission('ver_escala');
    const canVerCantor = hasPermission('ver_cantor');
    const canVerMidia = hasPermission('ver_midia');
    const canVerLetra = hasPermission('ver_letra');
    const canVerCifra = hasPermission('ver_cifra');
    const canVerVs = hasPermission('ver_vs');
    const canVerYoutube = hasPermission('ver_youtube');

    const roleToMinistry = {};
    (dadosGlobais.ministries || []).forEach(min => {
        (min.ministry_roles || []).forEach(r => {
            const rName = typeof removerAcentos === 'function' ? removerAcentos(r.name.toLowerCase()) : r.name.toLowerCase();
            roleToMinistry[rName] = {
                name: min.name,
                color: min.color || 'liturge'
            };
        });
    });

    Object.entries(grupos).forEach(([mesAno, listaServicos]) => {
        grupoContador++;
        const idAccordion = `accordion-grupo-${grupoContador}`;
        const idSeta = `seta-grupo-${grupoContador}`;

        let servicosHtml = '';
        listaServicos.forEach(service => {
            const datePart = service.date ? service.date.split('T')[0] : '';
            const dataFormatada = datePart ? datePart.split('-').reverse().join('/') : '';
            const titulo = service.title || `Culto de ${(service.type || 'DOMINGO').toUpperCase()}`;

            let instrObj = {};
            let cantoresCultoStr = service.singers_list || service.singers || '';
            const cantoresCultoList = [];
            
            if (service.service_scales && service.service_scales.length > 0) {
                service.service_scales.forEach(scaleItem => {
                    const profileName = scaleItem.profiles ? scaleItem.profiles.name : (scaleItem.profile_name || '');
                    const roleName = scaleItem.ministry_roles ? scaleItem.ministry_roles.name : (scaleItem.role_name || '');
                    const rScope = scaleItem.ministry_roles ? scaleItem.ministry_roles.scale_scope : null;
                    const rLow = roleName.toLowerCase();
                    const isSongScope = rScope === 'song' || (!rScope && (rLow.includes('cantor') || rLow.includes('vocal')));
                    if (isSongScope) {
                        if (profileName && !cantoresCultoList.includes(profileName)) {
                            cantoresCultoList.push(profileName);
                        }
                    } else if (roleName) {
                        instrObj[roleName] = profileName;
                    }
                });
                if (cantoresCultoList.length > 0) {
                    cantoresCultoStr = cantoresCultoList.join(', ');
                }
            } else if (service.notes) {
                try {
                    const parsedNotes = JSON.parse(service.notes);
                    if (parsedNotes.escala) instrObj = parsedNotes.escala;
                    if (parsedNotes.cantores && Array.isArray(parsedNotes.cantores)) cantoresCultoStr = parsedNotes.cantores.join(', ');
                } catch(e){}
            }

            const louvorMin = (dadosGlobais.ministries || []).find(m => {
                const n = (m.name || '').toLowerCase();
                return n.includes('louvor') || n.includes('musica') || n.includes('adora');
            }) || { name: 'Louvor', color: 'liturge' };

            const groupedEscala = {};
            const vocaisList = [];
            if (cantoresCultoStr) {
                cantoresCultoStr.split(',').map(s => s.trim()).filter(Boolean).forEach(c => {
                    if (!vocaisList.includes(c)) vocaisList.push(c);
                });
            }

            Object.keys(instrObj).forEach(key => {
                if (instrObj[key]) {
                    const keyLower = typeof removerAcentos === 'function' ? removerAcentos(key.toLowerCase()) : key.toLowerCase();
                    
                    if (keyLower.includes('vocal') || keyLower.includes('cantor')) {
                        const nomes = instrObj[key].toString().split(',').map(s => s.trim()).filter(Boolean);
                        nomes.forEach(n => {
                            if (!vocaisList.includes(n)) vocaisList.push(n);
                        });
                        return;
                    }

                    const nomeFormato = key.charAt(0).toUpperCase() + key.slice(1);
                    const minInfo = roleToMinistry[keyLower] || louvorMin;
                    if (!groupedEscala[minInfo.name]) {
                        groupedEscala[minInfo.name] = { color: minInfo.color, parts: [] };
                    }
                    groupedEscala[minInfo.name].parts.push(`<span class="text-slate-400">${nomeFormato}:</span> <span class="text-white font-semibold">${instrObj[key]}</span>`);
                }
            });

            if (vocaisList.length > 0) {
                const minName = louvorMin.name || 'Louvor';
                if (!groupedEscala[minName]) {
                    groupedEscala[minName] = { color: louvorMin.color || 'liturge', parts: [] };
                }
                const labelVocal = vocaisList.length > 1 ? 'Vocalistas' : 'Vocalista';
                groupedEscala[minName].parts.push(`<span class="text-slate-400">${labelVocal}:</span> <span class="text-white font-semibold">${vocaisList.join(', ')}</span>`);
            }

            let linhaInstrumentos = '';
            if ((canVerEscala || canVerCantor) && Object.keys(groupedEscala).length > 0) {
                linhaInstrumentos = Object.entries(groupedEscala).map(([minName, info]) => {
                    return `<div class="px-4 py-2 text-xs text-slate-300 bg-night-950/70 border-b border-slate-800/80 flex flex-wrap items-center gap-2.5">
                        <span class="font-bold text-liturge-400 tracking-wider text-[11px] uppercase mr-1">${minName}</span>
                        ${info.parts.join('<span class="text-slate-600 font-light">•</span>')}
                    </div>`;
                }).join('');
            }

            let midiasCulto = service.service_media || [];
            if (midiasCulto.length === 0 && service.media_urls) {
                try { midiasCulto = typeof service.media_urls === 'string' ? JSON.parse(service.media_urls) : service.media_urls; } catch(e){}
            }
            let linhaMidias = '';
            if (canVerMidia && midiasCulto && midiasCulto.length > 0) {
                const linksHtml = midiasCulto.map(m => `<a href="${m.url}" target="_blank" class="text-slate-300 hover:text-liturge-400 font-medium underline px-1 transition">${m.name}</a>`).join('');
                linhaMidias = `<div class="px-4 py-2 text-xs bg-liturge-500/5 border-b border-slate-800/80 flex flex-wrap gap-2 items-center">
                    <span class="text-liturge-400 font-semibold flex items-center gap-1.5">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/></svg>
                        Mídias Anexadas:
                    </span>
                    ${linksHtml}
                </div>`;
            }

            let musicasHtml = '';
            const servicePlaylistId = 'service-playlist-' + (service.id || Math.random().toString(36).substring(7));
            window.liturgeCultosPlaylists = window.liturgeCultosPlaylists || {};
            window.liturgeCultosPlaylists[servicePlaylistId] = [];

            const songList = (service.service_songs || []).sort((a, b) => (a.order || 0) - (b.order || 0));
            songList.forEach(sSong => {
                const version = sSong.song_versions || {};
                const song = version.songs || sSong.songs || {};
                const nomeMusica = song.title || version.title || sSong.song_name || sSong.title || '';
                const tom = version.key || sSong.key || sSong.tom || '';
                const vs = version.drive_vs_url || version.drive_url || song.drive_vs_url || song.drive_url || sSong.drive_vs_url || sSong.drive_url || sSong.vs || '';
                const yt = version.youtube_url || sSong.youtube_url || sSong.yt || '';
                const cantoresMusica = sSong.singers_list || sSong.singers || '';
                const lyrics = version.lyrics || song.lyrics || sSong.lyrics || '';
                const chords = version.chords || song.chords || sSong.chords || '';
                const artist = song.artist || version.artist || sSong.artist || '';

                const fileId = obterUrlAudioVs(vs);
                const linkYoutubeFinal = obterLinkYoutube(yt, nomeMusica);

                let trackIndexService = -1;
                if (vs && canVerVs) {
                    window.liturgeCultosPlaylists[servicePlaylistId].push({
                        title: nomeMusica,
                        fileIdOrUrl: fileId,
                        artist: artist || cantoresMusica || 'Liturge • Louvor',
                        album: service.title || 'Culto Liturge',
                        cultoId: servicePlaylistId
                    });
                    trackIndexService = window.liturgeCultosPlaylists[servicePlaylistId].length - 1;
                }

                const btnLetra = (lyrics && canVerLetra)
                    ? `<button onclick="abrirModalLetraPublica('${nomeMusica.replace(/'/g, "\\'")}', 'Tom: ${tom}', '${encodeURIComponent(lyrics)}')" class="bg-night-950/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 px-2.5 py-1 rounded-lg text-[11px] font-medium transition flex items-center gap-1 shadow-sm">
                        <svg class="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                        Letra
                    </button>`
                    : '';
                const btnCifra = (chords && canVerCifra)
                    ? `<button onclick="abrirModalCifraPublica('${nomeMusica.replace(/'/g, "\\'")}', '${tom}', '${encodeURIComponent(chords)}')" class="bg-night-950/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 px-2.5 py-1 rounded-lg text-[11px] font-medium transition flex items-center gap-1 shadow-sm">
                        <svg class="w-3 h-3 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/><path d="M9 18V5l12-2v13"/></svg>
                        Cifra
                    </button>`
                    : '';
                const btnYt = (linkYoutubeFinal && canVerYoutube)
                    ? `<button onclick="playYoutubeAudio('${nomeMusica.replace(/'/g, "\\'")}', '${linkYoutubeFinal}')" class="bg-night-950/80 hover:bg-rose-950/40 text-rose-400 border border-rose-800/40 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition flex items-center gap-1 shadow-sm">
                        <svg class="w-3 h-3 fill-current" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                        YouTube
                    </button>`
                    : '';
                const btnPlayVs = (vs && canVerVs)
                    ? `<button onclick="LiturgePlayer.tocarDoCulto('${servicePlaylistId}', ${trackIndexService})" class="bg-night-950/80 hover:bg-slate-800 text-liturge-400 border border-liturge-500/30 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition flex items-center gap-1 shadow-sm">
                        <svg class="w-3 h-3 fill-current" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                        VS
                    </button>`
                    : '';

                musicasHtml += `
                    <div class="py-2.5 flex items-center justify-between border-b border-slate-800/60 last:border-0 hover:bg-slate-800/30 px-4 transition text-xs">
                        <div>
                            <span class="font-bold text-white">${nomeMusica}</span>
                            ${artist ? `<span class="text-[10px] text-slate-400 ml-1">(${artist})</span>` : ''}
                            <div class="flex items-center gap-1.5 mt-0.5 text-[10px] text-slate-400">
                                ${tom ? `<span class="text-liturge-400 font-mono font-semibold">Tom: ${tom}</span>` : ''}
                                ${cantoresMusica ? `<span class="text-slate-300">• ${cantoresMusica}</span>` : ''}
                            </div>
                        </div>
                        <div class="flex items-center gap-1.5 flex-wrap justify-end">
                            ${btnPlayVs}
                            ${btnLetra}
                            ${btnCifra}
                            ${btnYt}
                        </div>
                    </div>
                `;
            });

            const totalMusicas = songList.length;

            servicosHtml += `
                <div class="border border-slate-800/80 rounded-2xl overflow-hidden bg-night-900/90 mb-2.5 transition hover:border-slate-700 shadow-sm">
                    <div onclick="toggleHistoricoCultoCard('${service.id}')" 
                        class="flex items-center justify-between p-3.5 cursor-pointer hover:bg-night-950/60 transition select-none flex-wrap gap-2.5">
                        <div class="flex items-center gap-3 min-w-0 flex-1">
                            <span id="seta-hist-${service.id}" class="text-slate-400 text-xs font-bold transition-transform shrink-0">▼</span>
                            <div class="min-w-0 flex items-center gap-2 flex-wrap">
                                <span class="font-bold text-slate-200 text-xs uppercase tracking-wide truncate">${titulo}</span>
                                <span class="text-[10px] text-slate-300 font-semibold bg-night-950 px-2.5 py-0.5 rounded-full border border-slate-800">${dataFormatada}</span>
                                <span class="text-[10px] text-liturge-400 font-bold bg-liturge-500/10 px-2.5 py-0.5 rounded-full border border-liturge-500/30 inline-flex items-center gap-1">
                                    <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
                                    ${totalMusicas} ${totalMusicas === 1 ? 'música' : 'músicas'}
                                </span>
                            </div>
                        </div>
                        <div class="flex items-center gap-2 shrink-0">
                            ${totalMusicas > 0 ? `
                                <button type="button" onclick="event.stopPropagation(); abrirModalCopiarPlaylist('${service.id}')" 
                                    class="bg-gradient-to-r from-liturge-500 to-amber-600 hover:brightness-110 text-white font-semibold px-3 py-1.5 rounded-lg text-xs transition shadow-sm flex items-center gap-1.5 cursor-pointer">
                                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/></svg>
                                    Copiar Playlist
                                </button>
                            ` : ''}
                        </div>
                    </div>
                    
                    <div id="content-hist-${service.id}" class="hidden border-t border-slate-800/80 p-3.5 bg-night-950/40 space-y-3">
                        ${linhaMidias}
                        ${linhaInstrumentos}
                        <div class="divide-y divide-slate-800/60 bg-night-900/90 rounded-xl border border-slate-800/80 overflow-hidden">
                            ${musicasHtml || '<p class="text-center text-slate-500 py-3 text-[11px]">Nenhuma música cadastrada neste culto.</p>'}
                        </div>
                        ${totalMusicas > 0 ? `
                            <div class="flex justify-end pt-1">
                                <button type="button" onclick="abrirModalCopiarPlaylist('${service.id}')" 
                                    class="bg-night-950 hover:bg-slate-800 text-liturge-400 hover:text-liturge-300 border border-liturge-500/30 px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer">
                                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/></svg>
                                    Copiar esta Playlist para outro Culto
                                </button>
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
        });

        html += `
            <div class="bg-night-900/80 border border-slate-800/80 rounded-2xl overflow-hidden shadow-md mb-3">
                <button onclick="toggleCultoBloco('${idAccordion}', '${idSeta}')" class="w-full flex items-center justify-between bg-night-950/80 hover:bg-night-950 border-b border-slate-800/80 px-4 py-3 transition text-left cursor-pointer">
                    <h2 class="font-bold text-slate-200 text-xs sm:text-sm uppercase tracking-wider">${mesAno}</h2>
                    <span id="${idSeta}" class="text-slate-400 text-xs font-bold transition-transform">▼</span>
                </button>
                <div id="${idAccordion}" class="hidden p-4 space-y-2">
                    ${servicosHtml}
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}
window.renderizarHistoricoCultos = renderizarHistoricoCultos;

// ===================== CONTROLE DO HISTÓRICO & CÓPIA DE PLAYLIST =====================

function toggleHistoricoCultoCard(serviceId) {
    const content = document.getElementById(`content-hist-${serviceId}`);
    const arrow = document.getElementById(`seta-hist-${serviceId}`);
    if (!content) return;

    const isHidden = content.classList.contains('hidden');
    if (isHidden) {
        content.classList.remove('hidden');
        if (arrow) arrow.textContent = '▲';
    } else {
        content.classList.add('hidden');
        if (arrow) arrow.textContent = '▼';
    }
}

let todosHistoricoAbertos = false;
function toggleTodosHistorico() {
    todosHistoricoAbertos = !todosHistoricoAbertos;
    
    // Grupos de meses
    document.querySelectorAll('[id^="accordion-grupo-"]').forEach(el => {
        if (todosHistoricoAbertos) el.classList.remove('hidden');
        else el.classList.add('hidden');
    });
    document.querySelectorAll('[id^="seta-grupo-"]').forEach(el => {
        el.textContent = todosHistoricoAbertos ? '▲' : '▼';
    });

    // Cultos individuais
    document.querySelectorAll('[id^="content-hist-"]').forEach(el => {
        if (todosHistoricoAbertos) el.classList.remove('hidden');
        else el.classList.add('hidden');
    });
    document.querySelectorAll('[id^="seta-hist-"]').forEach(el => {
        el.textContent = todosHistoricoAbertos ? '▲' : '▼';
    });

    const label = document.getElementById('btn-toggle-todos-historico-label');
    if (label) {
        label.textContent = todosHistoricoAbertos ? '⌃ Recolher Todos' : '⌄ Expandir Todos';
    }
}

let playlistOrigemCopiando = null;

function abrirModalCopiarPlaylist(serviceId) {
    const rawServices = dadosGlobais.services || [];
    const servOrigem = rawServices.find(s => s.id === serviceId);
    
    if (!servOrigem) {
        if (typeof mostrarToast === 'function') mostrarToast('Culto de origem não encontrado.', 'erro');
        return;
    }

    const songList = (servOrigem.service_songs || []).sort((a, b) => (a.order || a.song_order || 0) - (b.order || b.song_order || 0));
    
    if (songList.length === 0) {
        if (typeof mostrarToast === 'function') mostrarToast('Este culto não possui músicas para copiar.', 'aviso');
        return;
    }

    const musicasParaCopiar = songList.map(sSong => {
        const version = sSong.song_versions || {};
        const song = version.songs || sSong.songs || {};
        return {
            nome: song.title || version.title || sSong.song_name || sSong.title || '',
            tom: version.key || sSong.key || sSong.tom || '',
            variacao: version.variation || sSong.variation || sSong.variacao || 'Original',
            vs: version.drive_vs_url || version.drive_url || song.drive_vs_url || song.drive_url || sSong.drive_vs_url || sSong.drive_url || sSong.vs || '',
            yt: version.youtube_url || sSong.youtube_url || sSong.yt || '',
            cantores: sSong.singers_list || sSong.singers || '',
            song_version_id: sSong.song_version_id || version.id || null,
            lyrics: version.lyrics || song.lyrics || sSong.lyrics || '',
            chords: version.chords || song.chords || sSong.chords || '',
            artist: song.artist || version.artist || sSong.artist || ''
        };
    });

    playlistOrigemCopiando = {
        serviceId: servOrigem.id,
        titulo: servOrigem.title || 'Culto Histórico',
        date: servOrigem.date || '',
        musicas: musicasParaCopiar
    };
    window.playlistCopiada = playlistOrigemCopiando;

    // Copia texto legível para a área de transferência do dispositivo
    try {
        const textoClipboard = `🎵 Playlist - ${servOrigem.title || 'Culto'}\n` +
            musicasParaCopiar.map((m, i) => `${i + 1}. ${m.nome}${m.tom ? ` (Tom: ${m.tom})` : ''}${m.cantores ? ` - ${m.cantores}` : ''}`).join('\n');
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(textoClipboard);
        }
    } catch(e) {}

    const labelOrigem = document.getElementById('copiar-playlist-origem-label');
    if (labelOrigem) {
        const dateStr = servOrigem.date ? servOrigem.date.split('T')[0].split('-').reverse().join('/') : '';
        labelOrigem.textContent = `Origem: ${servOrigem.title || 'Culto'} (${dateStr})`;
    }

    const badgeTotal = document.getElementById('copiar-playlist-total-badge');
    if (badgeTotal) {
        badgeTotal.textContent = `${musicasParaCopiar.length} ${musicasParaCopiar.length === 1 ? 'música' : 'músicas'}`;
    }

    const previewContainer = document.getElementById('copiar-playlist-preview-lista');
    if (previewContainer) {
        previewContainer.innerHTML = musicasParaCopiar.map((m, i) => {
            return `<span class="bg-slate-900 border border-slate-700/80 text-slate-200 text-xs px-2.5 py-1 rounded-lg font-medium">
                ${i + 1}. <strong>${m.nome}</strong> ${m.tom ? `<span class="text-brand-300 font-mono text-[11px]">(${m.tom})</span>` : ''}
            </span>`;
        }).join('');
    }

    const selectDestino = document.getElementById('copiar-playlist-destino-select');
    if (selectDestino) {
        let htmlOpts = `<option value="">— Selecione o culto de destino —</option>`;
        
        const modalCulto = document.getElementById('modal-culto');
        if (modalCulto && !modalCulto.classList.contains('hidden')) {
            htmlOpts += `<optgroup label="Editor de Culto Aberto">
                <option value="__CULTO_EM_EDICAO__">✏️ Culto atualmente aberto no Editor</option>
            </optgroup>`;
        }

        htmlOpts += `<optgroup label="Criar Novo Culto">
            <option value="__NOVO_CULTO__">✨ Criar um Novo Culto com estas músicas</option>
        </optgroup>`;

        const cultosDestino = (dadosGlobais.services || [])
            .filter(s => s.id !== serviceId && s.status !== 'arquivado')
            .sort((a, b) => new Date(a.date) - new Date(b.date));

        if (cultosDestino.length > 0) {
            htmlOpts += `<optgroup label="Cultos Agendados / Em Andamento">`;
            cultosDestino.forEach(s => {
                const dateStr = s.date ? s.date.split('T')[0].split('-').reverse().join('/') : '';
                const tituloLimpo = (s.title || 'Culto').replace(/ - OCULTO/i, '').replace(/ - EM MONTAGEM/i, '').trim();
                htmlOpts += `<option value="${s.id}">${dateStr} • ${tituloLimpo}</option>`;
            });
            htmlOpts += `</optgroup>`;
        }

        selectDestino.innerHTML = htmlOpts;
    }

    const modal = document.getElementById('modal-copiar-playlist');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
}

function fecharModalCopiarPlaylist() {
    const modal = document.getElementById('modal-copiar-playlist');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}

async function confirmarCopiarPlaylist() {
    if (!playlistOrigemCopiando || !playlistOrigemCopiando.musicas || playlistOrigemCopiando.musicas.length === 0) {
        if (typeof mostrarToast === 'function') mostrarToast('Nenhuma música selecionada para cópia.', 'aviso');
        return;
    }

    const selectDestino = document.getElementById('copiar-playlist-destino-select');
    const destinoId = selectDestino?.value;

    if (!destinoId) {
        if (typeof mostrarToast === 'function') mostrarToast('Por favor, selecione o culto de destino.', 'aviso');
        return;
    }

    const modo = document.querySelector('input[name="copiar-playlist-modo"]:checked')?.value || 'adicionar';
    const incluirCantores = document.getElementById('copiar-playlist-incluir-cantores')?.checked ?? true;
    const musicas = playlistOrigemCopiando.musicas;

    // Caso A: Criar Novo Culto
    if (destinoId === '__NOVO_CULTO__') {
        fecharModalCopiarPlaylist();
        if (typeof mostrarFormCulto === 'function') {
            mostrarFormCulto(null);
            if (typeof musicasCultoAtual !== 'undefined') {
                musicasCultoAtual = musicas.map(m => ({
                    nome: m.nome,
                    tom: m.tom,
                    variacao: m.variacao,
                    vs: m.vs,
                    yt: m.yt,
                    cantores: incluirCantores ? (Array.isArray(m.cantores) ? m.cantores : (m.cantores ? m.cantores.split(',').map(s=>s.trim()) : [])) : [],
                    song_version_id: m.song_version_id,
                    lyrics: m.lyrics,
                    chords: m.chords,
                    artist: m.artist
                }));
                if (typeof renderizarMusicasCulto === 'function') renderizarMusicasCulto();
                if (typeof atualizarContadoresAccordions === 'function') atualizarContadoresAccordions();
            }
            if (typeof mostrarToast === 'function') mostrarToast(`✨ ${musicas.length} músicas carregadas no novo culto! Defina a data e salve.`, 'sucesso');
        }
        return;
    }

    // Caso B: Injetar no Culto em Edição aberto
    if (destinoId === '__CULTO_EM_EDICAO__') {
        fecharModalCopiarPlaylist();
        if (typeof musicasCultoAtual !== 'undefined') {
            const novasFormatadas = musicas.map(m => ({
                nome: m.nome,
                tom: m.tom,
                variacao: m.variacao,
                vs: m.vs,
                yt: m.yt,
                cantores: incluirCantores ? (Array.isArray(m.cantores) ? m.cantores : (m.cantores ? m.cantores.split(',').map(s=>s.trim()) : [])) : [],
                song_version_id: m.song_version_id,
                lyrics: m.lyrics,
                chords: m.chords,
                artist: m.artist
            }));

            if (modo === 'substituir') {
                musicasCultoAtual = novasFormatadas;
            } else {
                musicasCultoAtual.push(...novasFormatadas);
            }
            if (typeof renderizarMusicasCulto === 'function') renderizarMusicasCulto();
            if (typeof atualizarContadoresAccordions === 'function') atualizarContadoresAccordions();
            if (typeof mostrarToast === 'function') mostrarToast(`📋 Músicas adicionadas ao editor de culto!`, 'sucesso');
        }
        return;
    }

    // Caso C: Gravação direta no Supabase para um culto existente
    const btnConfirmar = document.getElementById('btn-confirmar-copiar-playlist');
    if (btnConfirmar) {
        btnConfirmar.disabled = true;
        btnConfirmar.textContent = 'Copiando...';
    }

    try {
        if (!supabaseClient) throw new Error("Cliente Supabase não inicializado.");

        const targetService = (dadosGlobais.services || []).find(s => s.id === destinoId);
        const targetTitle = targetService?.title || 'o culto selecionado';

        let startOrder = 1;

        if (modo === 'substituir') {
            await supabaseClient.from('service_songs').delete().eq('service_id', destinoId);
        } else {
            const { data: existingSongs } = await supabaseClient
                .from('service_songs')
                .select('song_order')
                .eq('service_id', destinoId)
                .order('song_order', { ascending: false })
                .limit(1);
            if (existingSongs && existingSongs.length > 0 && existingSongs[0].song_order) {
                startOrder = existingSongs[0].song_order + 1;
            }
        }

        for (let idx = 0; idx < musicas.length; idx++) {
            const m = musicas[idx];
            let vId = m.song_version_id;

            if (!vId && m.nome) {
                try {
                    const { data: sData } = await supabaseClient
                        .from('songs')
                        .select('id, song_versions(id)')
                        .eq('title', m.nome)
                        .maybeSingle();
                    if (sData?.song_versions?.[0]?.id) {
                        vId = sData.song_versions[0].id;
                    }
                } catch(e) {}
            }

            if (vId) {
                const singersVal = incluirCantores 
                    ? (Array.isArray(m.cantores) ? m.cantores.join(', ') : (m.cantores || '')) 
                    : '';
                await supabaseClient.from('service_songs').insert({
                    service_id: destinoId,
                    song_version_id: vId,
                    song_order: startOrder + idx,
                    singers_list: singersVal
                });
            }
        }

        fecharModalCopiarPlaylist();
        await carregarDados();
        if (typeof mostrarToast === 'function') {
            mostrarToast(`🎉 ${musicas.length} músicas copiadas com sucesso para "${targetTitle}"!`, 'sucesso');
        }
    } catch (err) {
        console.error('Erro ao copiar playlist:', err);
        if (typeof mostrarToast === 'function') {
            mostrarToast(`Erro ao copiar playlist: ${err.message}`, 'erro');
        }
    } finally {
        if (btnConfirmar) {
            btnConfirmar.disabled = false;
            btnConfirmar.innerHTML = `<span>📋</span> Copiar Playlist`;
        }
    }
}

window.toggleHistoricoCultoCard = toggleHistoricoCultoCard;
window.toggleTodosHistorico = toggleTodosHistorico;
window.abrirModalCopiarPlaylist = abrirModalCopiarPlaylist;
window.fecharModalCopiarPlaylist = fecharModalCopiarPlaylist;
window.confirmarCopiarPlaylist = confirmarCopiarPlaylist;



