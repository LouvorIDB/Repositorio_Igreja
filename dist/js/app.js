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

    // 0.1 Limpeza preventiva de Service Workers antigos e cache persistente do navegador
    if ('serviceWorker' in navigator) {
        try {
            const regs = await navigator.serviceWorker.getRegistrations();
            for (const reg of regs) {
                await reg.unregister();
                console.log('🧹 [SW] Service Worker antigo desregistrado.');
            }
        } catch (e) {
            console.warn('Erro ao limpar SW:', e);
        }
    }
    if ('caches' in window) {
        try {
            const cacheNames = await caches.keys();
            for (const name of cacheNames) {
                await caches.delete(name);
                console.log(`🧹 [Cache] Cache "${name}" removido.`);
            }
        } catch (e) {
            console.warn('Erro ao limpar caches:', e);
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

    if ('serviceWorker' in navigator) {
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

        // Se não achou por login, tenta buscar pelo slug na URL (?c=slug)
        if (!currentChurchId) {
            const params = new URLSearchParams(window.location.search);
            const slug = params.get('c') || params.get('church');
            if (slug) {
                const { data: cData } = await supabaseClient.from('churches').select('*').eq('slug', slug.toLowerCase().trim()).maybeSingle();
                if (cData) {
                    dadosGlobais.church = cData;
                    currentChurchId = cData.id;
                    try {
                        localStorage.setItem('cached_church_data', JSON.stringify(cData));
                    } catch (e) {}
                }
            }
        }

        // Se NÃO há igreja definida (usuário deslogado sem slug na URL)
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

        renderizarCultos(dadosGlobais.cultos);
        renderizarRepertorio(dadosGlobais.repertorio);
        renderizarMusicasNovas(dadosGlobais.novas);
        
        if (isAdmin) {
            renderizarAdminListaCultos();
            if (typeof renderizarHistoricoCultos === 'function') {
                renderizarHistoricoCultos();
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
        if (backdrop) backdrop.classList.remove('hidden');
        if (window.innerWidth < 768) {
            document.body.classList.add('overflow-hidden');
        }
    } else {
        menu.classList.add('hidden');
        if (backdrop) backdrop.classList.add('hidden');
        document.body.classList.remove('overflow-hidden');
    }
}

function fecharSidebarMenu(menuId = 'sidebar-menu') {
    const menu = document.getElementById(menuId);
    const backdropId = menuId === 'admin-sidebar-menu' ? 'admin-sidebar-backdrop' : 'sidebar-backdrop';
    const backdrop = document.getElementById(backdropId);

    if (menu) menu.classList.add('hidden');
    if (backdrop) backdrop.classList.add('hidden');
    document.body.classList.remove('overflow-hidden');
}

window.toggleSidebarMenu = toggleSidebarMenu;
window.fecharSidebarMenu = fecharSidebarMenu;

// ===================== SITE PRINCIPAL =====================

function mudarAba(aba) {
    const secoes = { cultos: 'secao-cultos', repertorio: 'secao-repertorio', novas: 'secao-novas', midia: 'secao-midia', agenda: 'secao-agenda', almoxarifado: 'secao-almoxarifado', analytics: 'secao-analytics', holyrics: 'secao-holyrics' };
    const botoes = { cultos: 'btn-cultos', repertorio: 'btn-repertorio', novas: 'btn-novas', midia: 'btn-midia', agenda: 'btn-agenda', almoxarifado: 'btn-almoxarifado', analytics: 'btn-analytics', holyrics: 'btn-holyrics-igreja-container' };
    const ativo = "w-full text-left px-4 py-2.5 rounded-xl font-medium text-sm transition bg-brand-600/20 text-brand-400 border border-brand-500/30 flex items-center gap-3";
    const inativo = "w-full text-left px-4 py-2.5 rounded-xl font-medium text-sm transition text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 flex items-center gap-3";

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
                        ? "w-full text-left px-4 py-2.5 rounded-xl font-medium text-sm transition bg-cyan-900/40 text-cyan-300 border border-cyan-500/40 flex items-center gap-3"
                        : "w-full text-left px-4 py-2.5 rounded-xl font-medium text-sm transition text-cyan-300 hover:bg-cyan-900/30 border border-transparent hover:border-cyan-500/30 flex items-center gap-3";
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

    if (typeof mostrarToast === 'function') mostrarToast(`Modo de simulação alterado: ${modoSimulacaoPerfil ? modoSimulacaoPerfil.label : 'Visão Admin'}`, 'sucesso');
}

function resetarModoSimulacaoPerfil() {
    alterarModoSimulacaoPerfil('admin');
}

window.alterarModoSimulacaoPerfil = alterarModoSimulacaoPerfil;
window.resetarModoSimulacaoPerfil = resetarModoSimulacaoPerfil;

function renderizarCultos(rows) {
    const container = document.getElementById('secao-cultos');
    if (!container) return;
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

            // Filtragem por Mês Ativo (SaaS)
            if (!blocoOculto && window.dadosGlobais?.church?.active_month) {
                const mesAtivoTarget = window.dadosGlobais.church.active_month.split('-')[1]; // ex: '08'
                const partesTitulo = blocoAtual.split(' - ');
                if (partesTitulo.length > 0 && partesTitulo[0].includes('/')) {
                    const dataPartes = partesTitulo[0].trim().split('/');
                    if (dataPartes.length >= 2) {
                        const mesDoCulto = dataPartes[1];
                        if (mesDoCulto !== mesAtivoTarget) {
                            blocoOculto = true;
                        }
                    }
                }
            }

            // Lê instrumentos (col F = JSON), cantores do culto (col G), e mídias (col H)
            let instrObj = {};
            try { instrObj = linha[5] ? JSON.parse(linha[5].toString()) : {}; } catch (e) { }
            const cantoresCulto = linha[6] ? linha[6].toString().trim() : '';
            let midiasCulto = [];
            try { midiasCulto = linha[7] ? JSON.parse(linha[7].toString()) : []; } catch (e) { }

            if (blocoOculto) continue;

            const corHeader = blocoEmMontagem
                ? 'bg-red-900/60 hover:bg-red-900/80 border-b border-red-700/50'
                : 'bg-brand-900/60 hover:bg-brand-900/80 border-b border-brand-700/50';
            const corTexto = blocoEmMontagem ? 'text-red-300' : 'text-brand-300';

            // Build a map of roleName -> ministry
            const roleToMinistry = {};
            (dadosGlobais.ministries || []).forEach(min => {
                (min.ministry_roles || []).forEach(r => {
                    const rName = typeof removerAcentos === 'function' ? removerAcentos(r.name.toLowerCase()) : r.name.toLowerCase();
                    roleToMinistry[rName] = {
                        name: min.name,
                        color: min.color || 'emerald',
                        icon: min.icon || '🏢'
                    };
                });
            });

            // Identifica o ministério de Louvor para integrar cantores/vocalistas na mesma linha
            const louvorMin = (dadosGlobais.ministries || []).find(m => {
                const n = (m.name || '').toLowerCase();
                return n.includes('louvor') || n.includes('musica') || n.includes('adora');
            }) || { name: 'Louvor', color: 'brand', icon: '⛪' };

            const groupedEscala = {};
            const emojimap = { 'violão': '🎸', 'bateria': '🥁', 'teclado': '🎹', 'baixo': '🎸', 'projeção': '💻', 'fotografia': '📷', 'transmissão': '🎥' };
            
            // Unifica todos os cantores e vocalistas sem duplicações
            const vocaisList = [];
            if (cantoresCulto) {
                cantoresCulto.split(',').map(s => s.trim()).filter(Boolean).forEach(c => {
                    if (!vocaisList.includes(c)) vocaisList.push(c);
                });
            }

            Object.keys(instrObj).forEach(key => {
                if (instrObj[key]) {
                    const keyLower = typeof removerAcentos === 'function' ? removerAcentos(key.toLowerCase()) : key.toLowerCase();
                    
                    // Se for vocalista ou cantor, funde na lista unificada de vocais do culto
                    if (keyLower.includes('vocal') || keyLower.includes('cantor')) {
                        const nomes = instrObj[key].toString().split(',').map(s => s.trim()).filter(Boolean);
                        nomes.forEach(n => {
                            if (!vocaisList.includes(n)) vocaisList.push(n);
                        });
                        return; // Evita exibir campo duplicado
                    }

                    const emoji = emojimap[keyLower] || '🎵';
                    const nomeFormato = key.charAt(0).toUpperCase() + key.slice(1);
                    const minInfo = roleToMinistry[keyLower] || louvorMin;
                    
                    if (!groupedEscala[minInfo.name]) {
                        groupedEscala[minInfo.name] = { color: minInfo.color, icon: minInfo.icon, parts: [] };
                    }
                    groupedEscala[minInfo.name].parts.push(`${emoji} ${nomeFormato}: <span class="text-${minInfo.color}-300 font-medium">${instrObj[key]}</span>`);
                }
            });

            // Insere os cantores/vocalistas diretamente na linha do ministério de Louvor
            if (vocaisList.length > 0) {
                const minName = louvorMin.name || 'Louvor';
                if (!groupedEscala[minName]) {
                    groupedEscala[minName] = { color: louvorMin.color || 'brand', icon: louvorMin.icon || '⛪', parts: [] };
                }
                const labelVocal = vocaisList.length > 1 ? 'Vocalistas' : 'Vocalista';
                groupedEscala[minName].parts.push(`🎤 ${labelVocal}: <span class="text-${louvorMin.color || 'brand'}-300 font-medium">${vocaisList.join(', ')}</span>`);
            }

            let linhaInstrumentos = '';
            let linhaMidias = '';

            if (usuarioLogado) {
                const canVerEscala = hasPermission('ver_escala') || hasPermission('ver_cantor');
                const canVerMidia = hasPermission('ver_midia');

                if (canVerEscala && Object.keys(groupedEscala).length > 0) {
                    linhaInstrumentos = Object.entries(groupedEscala).map(([minName, info]) => {
                        return `<div class="px-4 py-1.5 text-xs text-slate-300 bg-slate-900/40 border-b border-slate-700/30 flex flex-wrap items-center gap-3">
                            <span class="font-bold text-${info.color}-400 mr-2">${info.icon} ${minName.toUpperCase()}</span>
                            ${info.parts.join('<span class="text-slate-600">|</span>')}
                        </div>`;
                    }).join('');
                }

                if (canVerMidia) {
                    if (midiasCulto && midiasCulto.length > 0) {
                        const linksHtml = midiasCulto.map(m => `<a href="${m.url}" target="_blank" class="text-indigo-400 hover:text-indigo-300 font-medium underline px-1">${m.name}</a>`).join('');
                        linhaMidias = `<div class="px-4 py-2 text-xs bg-indigo-900/20 border-b border-indigo-700/30 flex flex-wrap gap-2 items-center">
                            <span class="text-indigo-300">📁 Mídias Anexadas: </span>
                            ${linksHtml}
                        </div>`;
                    }
                }
            }

            htmlCultos += `
                <div class="bg-slate-800/80 border border-slate-700 rounded-2xl overflow-hidden shadow-md mb-3">
                    <button onclick="toggleCultoBloco('${idPlaylist}', '${idSeta}')" class="w-full flex items-center justify-between ${corHeader} px-4 py-2.5 transition text-left">
                        <div class="flex items-center gap-2 flex-wrap">
                            <h2 class="font-bold ${corTexto} text-sm uppercase tracking-wider">${blocoAtual.replace(/ - OCULTO/i, '').replace(/ - EM MONTAGEM/i, '').trim()}</h2>
                            ${blocoEmMontagem ? '<span class="text-[10px] bg-red-950 text-red-300 border border-red-700/70 px-2 py-0.5 rounded-full font-bold shadow-sm">🚧 EM MONTAGEM</span>' : ''}
                        </div>
                        <span id="${idSeta}" class="${corTexto} text-xs">▼</span>
                    </button>
                    ${linhaMidias}
                    ${linhaInstrumentos}
                    <div id="${idPlaylist}" class="hidden divide-y divide-slate-700/50">
            `;

            if (blocoEmMontagem) {
                const canSugestaoCulto = hasPermission('enviar_sugestao_culto');
                
                if (canSugestaoCulto) {
                    htmlCultos += `
                        <div class="p-5 text-center space-y-3">
                            <p class="text-red-400 text-sm font-medium">🚧 Incompleto — playlist em montagem</p>
                            <p class="text-slate-400 text-xs">Envie sugestões para esse culto:</p>
                            <div class="flex flex-col sm:flex-row gap-2 max-w-md mx-auto">
                                <input type="text" id="sugestao-autor-${contadorBloco}" placeholder="Seu nome" class="sm:w-1/3 bg-slate-900 border border-slate-700 px-3 py-2 rounded text-sm text-white focus:outline-none focus:border-red-500">
                                <input type="text" id="sugestao-texto-${contadorBloco}" placeholder="Escreva sua sugestão" class="sm:w-2/3 bg-slate-900 border border-slate-700 px-3 py-2 rounded text-sm text-white focus:outline-none focus:border-red-500">
                            </div>
                            <div class="flex justify-center gap-2 mt-2">
                                <button onclick="enviarComentario('${blocoAtual.replace(/'/g, "\\'")}','sugestao-autor-${contadorBloco}','sugestao-texto-${contadorBloco}','sugestao-status-${contadorBloco}','Sugestão para Culto')" class="bg-red-700 hover:bg-red-600 text-white px-4 py-2 rounded text-sm font-medium">Sugestão de Música</button>
                            </div>
                            <p id="sugestao-status-${contadorBloco}" class="text-xs text-brand-400 hidden">Sugestão enviada!</p>
                        </div>
                    `;
                }
            }
        } else if (blocoAtual && !blocoOculto && textoPrimeiraColuna.trim() !== '' && !blocoEmMontagem) {
            const musica = linha[0];
            const tom = linha[1] || '';
            const variacao = linha[2] || '';
            const vsCelular = linha[3] || '';
            const ytDado = linha[4] || '';
            const cantoresMusica = linha[6] ? linha[6].toString().trim() : '';
            const lyricsTexto = linha[7] ? linha[7].toString().trim() : '';
            const chordsTexto = linha[8] ? linha[8].toString().trim() : '';
            const artistaMusica = linha[9] ? linha[9].toString().trim() : '';

            const fileId = obterUrlAudioVs(vsCelular);
            const linkYoutubeFinal = obterLinkYoutube(ytDado, musica);
            
            // Em vez de hardcodado, verificamos as permissões granulares:
            const canVerLetra = hasPermission('ver_letra');
            const canVerCifra = hasPermission('ver_cifra');
            const canVerVs = hasPermission('ver_vs');
            const canVerYoutube = hasPermission('ver_youtube');
            const canVerCantor = hasPermission('ver_cantor');
            const canPedirAjuste = hasPermission('enviar_solic_musica');

            const btnLetraCulto = (lyricsTexto && canVerLetra)
                ? `<button onclick="abrirModalLetraPublica('${musica.toString().replace(/'/g, "\\'")}', 'Tom: ${tom}', '${encodeURIComponent(lyricsTexto)}')" class="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition">📜 Letra</button>`
                : '';
            const btnCifraCulto = (chordsTexto && canVerCifra)
                ? `<button onclick="abrirModalCifraPublica('${musica.toString().replace(/'/g, "\\'")}', '${tom}', '${encodeURIComponent(chordsTexto)}')" class="bg-indigo-700 hover:bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition">🎸 Cifra</button>`
                : '';
            contadorCard++;
            
            htmlCultos += `
                <div class="p-4 flex flex-col gap-2 hover:bg-slate-750 transition">
                    <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <div>
                            <h3 class="font-bold text-white text-base">${musica} ${artistaMusica ? `<span class="text-xs font-normal text-indigo-300 ml-1.5">(${artistaMusica})</span>` : ''}</h3>
                            <div class="flex flex-wrap items-center gap-2 mt-1 text-xs text-slate-400">
                                ${canVerCifra ? `<span class="bg-slate-700 px-2 py-0.5 rounded text-brand-300 font-semibold">Tom: ${tom} ${variacao ? '(' + variacao + ')' : ''}</span>` : ''}
                                ${(canVerCantor && cantoresMusica) ? `<span class="text-slate-400">🎤 <span class="text-slate-300">${cantoresMusica}</span></span>` : ''}
                            </div>
                        </div>
                        <div class="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
                            ${(canVerVs && vsCelular) ? `<button onclick="playDriveAudio('${musica.toString().replace(/'/g, "\\'")}', '${fileId}')" class="bg-brand-600 hover:bg-brand-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition">▶ Ouvir VS</button>` : ''}
                            ${btnLetraCulto}
                            ${btnCifraCulto}
                            ${(canVerYoutube && linkYoutubeFinal) ? `<button onclick="playYoutubeAudio('${musica.toString().replace(/'/g, "\\'")}', '${linkYoutubeFinal}')" class="bg-red-600 hover:bg-red-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition">📺 YouTube</button>` : ''}
                            ${canPedirAjuste ? `<button onclick="toggleComentario('culto-${contadorCard}')" class="bg-slate-700 hover:bg-slate-600 text-slate-200 px-3 py-1.5 rounded-lg text-xs font-medium transition">💬 Pedir Ajuste</button>` : ''}
                        </div>
                    </div>
                </div>
                <div id="culto-${contadorCard}" class="hidden p-4 bg-slate-900/50 border-t border-slate-700/50 space-y-2">
                    <div class="flex gap-2">
                        <input type="text" id="autor-c-${contadorCard}" placeholder="Seu nome" class="w-1/3 bg-slate-900 border border-slate-700 px-3 py-1.5 rounded text-xs text-white focus:outline-none focus:border-brand-500">
                        <input type="text" id="comentario-c-${contadorCard}" placeholder="Ex: Mudar tom para C..." class="w-2/3 bg-slate-900 border border-slate-700 px-3 py-1.5 rounded text-xs text-white focus:outline-none focus:border-brand-500">
                        <button onclick="enviarComentario('${musica.toString().replace(/'/g, "\\'")}','autor-c-${contadorCard}','comentario-c-${contadorCard}','status-c-${contadorCard}','Ajuste de Tom')" class="bg-brand-700 hover:bg-brand-600 text-white px-3 py-1.5 rounded text-xs font-medium">Enviar</button>
                    </div>
                    <p id="status-c-${contadorCard}" class="text-xs text-brand-400 hidden">Enviado com sucesso!</p>
                </div>
            `;
        }
    }

    if (blocoAtual && !blocoOculto) htmlCultos += `</div></div>`;
    container.innerHTML = htmlCultos || '<p class="text-center text-slate-500 py-10">Nenhum culto agendado encontrado no banco de dados.</p>';
}

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
                ? `<button onclick="abrirModalLetraPublica('${musicaObj.title.replace(/'/g, "\\'")}', 'Tom: ${v.key}', '${encodeURIComponent(versionLyrics)}')" class="bg-indigo-600 hover:bg-indigo-500 text-white px-2 py-1.5 rounded-lg text-xs font-medium transition">📜 Letra</button>`
                : '';
            const btnCifraCard = versionChords.trim()
                ? `<button onclick="abrirModalCifraPublica('${musicaObj.title.replace(/'/g, "\\'")}', '${v.key}', '${encodeURIComponent(versionChords)}')" class="bg-indigo-700 hover:bg-indigo-600 text-white px-2 py-1.5 rounded-lg text-xs font-medium transition">🎸 Cifra</button>`
                : '';
            const itemId = `${prefix}-${musicaObj.id}-v${index}`;
            
            const ytButtonsHtml = linksYt.map(item => 
                `<button onclick="playYoutubeAudio('${musicaObj.title.replace(/'/g, "\\'")}', '${item.url}')" class="bg-red-600 hover:bg-red-500 text-white px-2 py-1.5 rounded-lg text-xs font-medium transition">${item.label}</button>`
            ).join('');

            htmlVersoes += `
                <div class="mt-3 pt-3 border-t border-slate-700/50">
                    <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <div class="flex items-center gap-2">
                            ${podeVerLouvor ? `<span class="bg-slate-700 px-2 py-0.5 rounded text-brand-300 text-xs font-semibold">Tom: ${v.key} (${v.variation || 'Original'})</span>` : ''}
                        </div>
                        <div class="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
                            ${(podeVerLouvor && v.vs) ? `<button onclick="playDriveAudio('${musicaObj.title.replace(/'/g, "\\'")}', '${fileId}')" class="bg-brand-600 hover:bg-brand-500 text-white px-2 py-1.5 rounded-lg text-xs font-medium transition">▶ Ouvir VS</button>` : ''}
                            ${btnLetraCard}
                            ${(podeVerLouvor && btnCifraCard) ? btnCifraCard : ''}
                            ${ytButtonsHtml}
                            ${podeVerLouvor ? `<button onclick="toggleComentario('${itemId}')" class="bg-slate-700 hover:bg-slate-600 text-slate-200 px-2 py-1.5 rounded-lg text-xs font-medium transition">💬 Pedir Ajuste</button>` : ''}
                        </div>
                    </div>
                    <div id="${itemId}" class="hidden pt-2 mt-2 space-y-2">
                        <div class="flex gap-2">
                            <input type="text" id="autor-${itemId}" placeholder="Seu nome" class="w-1/3 bg-slate-900 border border-slate-700 px-3 py-1.5 rounded text-xs text-white focus:outline-none focus:border-brand-500">
                            <input type="text" id="comentario-${itemId}" placeholder="Ex: Mudar tom para C..." class="w-2/3 bg-slate-900 border border-slate-700 px-3 py-1.5 rounded text-xs text-white focus:outline-none focus:border-brand-500">
                            <button onclick="enviarComentario('${musicaObj.title.replace(/'/g, "\\'")}', 'autor-${itemId}', 'comentario-${itemId}', 'status-${itemId}', 'Ajuste de Tom')" class="bg-brand-700 hover:bg-brand-600 text-white px-3 py-1.5 rounded text-xs font-medium">Enviar</button>
                        </div>
                        <p id="status-${itemId}" class="text-xs text-brand-400 hidden">Solicitação enviada com sucesso!</p>
                    </div>
                </div>
            `;
        });
    }

    return `
        <div class="bg-slate-800 p-4 rounded-xl border ${musicaObj.status === 'nova' ? 'border-violet-700/30 hover:border-violet-600/50' : 'border-slate-700 hover:border-slate-600'} transition mb-3">
            <div class="flex items-center justify-between">
                <h3 class="font-bold text-lg text-white">${musicaObj.title} ${musicaObj.artist ? `<span class="text-xs font-normal text-indigo-300 ml-2">(${musicaObj.artist})</span>` : ''}</h3>
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
    const termo = (document.getElementById('searchInput')?.value || '').toLowerCase().trim();
    const filtro = document.getElementById('repertorio-filter')?.value || 'todas';
    const rows = dadosGlobais.repertorio || [];
    const container = document.getElementById('musicList');
    if (!container) return;
    container.innerHTML = '';
    
    let html = '';
    rows.forEach((musicaObj, i) => {
        if (!musicaObj || !musicaObj.title) return;

        const title = (musicaObj.title || '').toLowerCase();
        const artist = (musicaObj.artist || '').toLowerCase();
        const passaBusca = title.includes(termo) || artist.includes(termo);

        let passaFiltro = true;
        const versoes = musicaObj.versions || [];
        const temVs = versoes.some(v => v.vs && v.vs.trim());
        const temYt = versoes.some(v => v.yt && v.yt.trim());
        const temLetra = (musicaObj.lyrics && musicaObj.lyrics.trim()) || versoes.some(v => v.lyrics && v.lyrics.trim());

        if (filtro === 'com_vs') passaFiltro = temVs;
        else if (filtro === 'sem_vs') passaFiltro = !temVs;
        else if (filtro === 'com_yt') passaFiltro = temYt;
        else if (filtro === 'sem_yt') passaFiltro = !temYt;
        else if (filtro === 'com_letra') passaFiltro = temLetra;
        else if (filtro === 'sem_letra') passaFiltro = !temLetra;

        if (passaBusca && passaFiltro) {
            html += gerarHtmlCardMusica(musicaObj, 'filtrado');
        }
    });
    
    if (!html) {
        container.innerHTML = '<p class="text-center text-slate-500 py-10">Nenhuma música encontrada para este filtro.</p>';
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

        const updatePayload = {
            name: nome,
            phone: telefone,
            birthdate: birthdate ? birthdate : null,
            address: address
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
}
window.aplicarVisibilidadePermissoes = aplicarVisibilidadePermissoes;

function atualizarTemaGlobal() {
    let corTema = 'emerald';
    
    console.log('[TEMA] atualizarTemaGlobal chamado. usuarioLogado:', !!usuarioLogado, 'church:', dadosGlobais.church);

    // 1. A paleta configurada na congregação define a atmosfera principal do site
    if (dadosGlobais.church && dadosGlobais.church.theme_color_secondary) {
        corTema = dadosGlobais.church.theme_color_secondary;
    } else if (usuarioLogado) {
        const userMin = typeof getMinistryForUser === 'function' ? getMinistryForUser(usuarioLogado) : null;
        if (userMin && userMin.color) {
            corTema = userMin.color;
        }
    }

    console.log('[TEMA] Paleta final aplicada:', corTema);
    if (typeof aplicarTemaColor === 'function') {
        aplicarTemaColor(corTema);
    }
    try {
        localStorage.setItem('cached_theme_color', corTema);
    } catch(e){}
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
    const typedSlug = document.getElementById('onboarding-slug-igreja')?.value.trim();
    const slugBase = nomeIgreja.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    const slugIgreja = typedSlug ? typedSlug.toLowerCase().replace(/[^a-z0-9_-]/g, '-') : `${slugBase || 'igreja'}-${Math.floor(Math.random() * 8999 + 1000)}`;
    
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
                slug: slugIgreja,
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

        // 2. Provisionar o Ministério padrão para a nova igreja (com permissões desativadas por padrão)
        const { data: newMin } = await supabaseClient
            .from('ministries')
            .insert({
                church_id: churchId,
                name: 'Ministério de Louvor & Adoração',
                description: 'Equipe principal de louvor da igreja',
                icon: '🎵',
                permissions: emptyPerms,
                can_upload_media: false
            })
            .select('id')
            .single();

        // 2.1 Provisionar funções padrão com escopo explícito (Música vs Culto)
        if (newMin && newMin.id) {
            await supabaseClient.from('ministry_roles').insert([
                { ministry_id: newMin.id, name: 'Ministro de Louvor', scale_scope: 'song' },
                { ministry_id: newMin.id, name: 'Cantor(a) / Vocal', scale_scope: 'song' },
                { ministry_id: newMin.id, name: 'Violão', scale_scope: 'service' },
                { ministry_id: newMin.id, name: 'Bateria', scale_scope: 'service' },
                { ministry_id: newMin.id, name: 'Teclado', scale_scope: 'service' }
            ]);
        }

        // 3. Cadastrar usuário no Supabase Auth
        const { data: authData, error: authErr } = await supabaseClient.auth.signUp({
            email: emailAdmin,
            password: senhaAdmin,
            options: {
                data: {
                    full_name: nomeAdmin,
                    name: nomeAdmin,
                    church_id: churchId,
                    role: 'admin',
                    system_role: 'admin'
                }
            }
        });

        if (authErr) throw authErr;

        // 4. Criar ou Atualizar perfil do Administrador na tabela 'profiles'
        if (authData && authData.user) {
            await supabaseClient
                .from('profiles')
                .upsert({
                    id: authData.user.id,
                    church_id: churchId,
                    name: nomeAdmin,
                    email: emailAdmin,
                    role: 'admin',
                    system_role: 'admin'
                }, { onConflict: 'id' });
        }

        // Garantir atualização caso o email já possuísse um registro prévio
        try {
            await supabaseClient
                .from('profiles')
                .update({
                    church_id: churchId,
                    name: nomeAdmin,
                    role: 'admin',
                    system_role: 'admin'
                })
                .eq('email', emailAdmin);
        } catch (eProf) {
            console.warn("Aviso ao sincronizar perfil do admin por email:", eProf);
        }

        fecharModalCadastroIgreja();
        localStorage.setItem('liturge_last_church_creation', Date.now().toString());
        try {
            localStorage.removeItem(`louvoridb_events_${churchId}`);
            if (typeof eventosMemoria !== 'undefined') eventosMemoria = [];
        } catch(e) {}
        mostrarToast(`⛪ A igreja "${nomeIgreja}" foi cadastrada e está aguardando ativação!`, 'sucesso');
        
        // Recarregar app com o novo ambiente da igreja (irá detectar status 'pending' e travar na tela pendente)
        await carregarDados();

        // Dispara o WhatsApp imediatamente para o Administrador Global
        const adminPhone = "5511997787992"; // WhatsApp do Administrador do Liturge
        const texto = `Olá! Acabei de cadastrar a minha igreja no Liturge e gostaria de solicitar a ativação.
- *Igreja:* ${nomeIgreja} (${slugIgreja})
- *Líder:* ${nomeAdmin} (${emailAdmin})
- *WhatsApp:* ${whatsappAdmin}`;
        
        const encodedText = encodeURIComponent(texto);
        window.open(`https://wa.me/${adminPhone}?text=${encodedText}`, '_blank');

    } catch (err) {
        console.error("Erro no Onboarding da Igreja:", err);
        if (erroEl) {
            erroEl.textContent = `Erro ao cadastrar igreja: ${err.message || 'Verifique se o slug ou e-mail já estão em uso.'}`;
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
    
    const slug = input.value.trim().toLowerCase();
    if (!slug) {
        if (erroEl) {
            erroEl.textContent = "Digite o identificador (slug) da igreja.";
            erroEl.classList.remove('hidden');
        }
        return;
    }
    
    if (erroEl) erroEl.classList.add('hidden');
    
    try {
        if (!supabaseClient) throw new Error("Cliente Supabase não carregado.");
        const { data, error } = await supabaseClient.from('churches').select('slug').eq('slug', slug).maybeSingle();
        
        if (error) throw error;
        
        if (data) {
            const url = new URL(window.location.href);
            url.searchParams.set('c', slug);
            window.location.href = url.toString();
        } else {
            if (erroEl) {
                erroEl.textContent = `Igreja com slug "${slug}" não encontrada. Verifique se digitou correto.`;
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
- *Identificador (slug):* ${church.slug}
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
                color: min.color || 'emerald',
                icon: min.icon || '🏢'
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
            }) || { name: 'Louvor', color: 'brand', icon: '⛪' };

            const groupedEscala = {};
            const emojimap = { 'violão': '🎸', 'bateria': '🥁', 'teclado': '🎹', 'baixo': '🎸', 'projeção': '💻', 'fotografia': '📷', 'transmissão': '🎥' };
            
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

                    const emoji = emojimap[keyLower] || '🎵';
                    const nomeFormato = key.charAt(0).toUpperCase() + key.slice(1);
                    const minInfo = roleToMinistry[keyLower] || louvorMin;
                    if (!groupedEscala[minInfo.name]) {
                        groupedEscala[minInfo.name] = { color: minInfo.color, icon: minInfo.icon, parts: [] };
                    }
                    groupedEscala[minInfo.name].parts.push(`${emoji} ${nomeFormato}: <span class="text-${minInfo.color}-300 font-medium">${instrObj[key]}</span>`);
                }
            });

            if (vocaisList.length > 0) {
                const minName = louvorMin.name || 'Louvor';
                if (!groupedEscala[minName]) {
                    groupedEscala[minName] = { color: louvorMin.color || 'brand', icon: louvorMin.icon || '⛪', parts: [] };
                }
                const labelVocal = vocaisList.length > 1 ? 'Vocalistas' : 'Vocalista';
                groupedEscala[minName].parts.push(`🎤 ${labelVocal}: <span class="text-${louvorMin.color || 'brand'}-300 font-medium">${vocaisList.join(', ')}</span>`);
            }

            let linhaInstrumentos = '';
            if ((canVerEscala || canVerCantor) && Object.keys(groupedEscala).length > 0) {
                linhaInstrumentos = Object.entries(groupedEscala).map(([minName, info]) => {
                    return `<div class="px-4 py-1.5 text-xs text-slate-300 bg-slate-900/40 border-b border-slate-700/30 flex flex-wrap items-center gap-3">
                        <span class="font-bold text-${info.color}-400 mr-2">${info.icon} ${minName.toUpperCase()}</span>
                        ${info.parts.join('<span class="text-slate-600">|</span>')}
                    </div>`;
                }).join('');
            }

            let midiasCulto = service.service_media || [];
            if (midiasCulto.length === 0 && service.media_urls) {
                try { midiasCulto = typeof service.media_urls === 'string' ? JSON.parse(service.media_urls) : service.media_urls; } catch(e){}
            }
            let linhaMidias = '';
            if (canVerMidia && midiasCulto && midiasCulto.length > 0) {
                const linksHtml = midiasCulto.map(m => `<a href="${m.url}" target="_blank" class="text-indigo-400 hover:text-indigo-300 font-medium underline px-1">${m.name}</a>`).join('');
                linhaMidias = `<div class="px-4 py-2 text-xs bg-indigo-900/20 border-b border-indigo-700/30 flex flex-wrap gap-2 items-center">
                    <span class="text-indigo-300">📁 Mídias Anexadas: </span>
                    ${linksHtml}
                </div>`;
            }

            let musicasHtml = '';
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

                const btnLetra = (lyrics && canVerLetra)
                    ? `<button onclick="abrirModalLetraPublica('${nomeMusica.replace(/'/g, "\\'")}', 'Tom: ${tom}', '${encodeURIComponent(lyrics)}')" class="bg-indigo-600 hover:bg-indigo-500 text-white px-2.5 py-1 rounded-lg text-[11px] font-medium transition">📜 Letra</button>`
                    : '';
                const btnCifra = (chords && canVerCifra)
                    ? `<button onclick="abrirModalCifraPublica('${nomeMusica.replace(/'/g, "\\'")}', '${tom}', '${encodeURIComponent(chords)}')" class="bg-indigo-700 hover:bg-indigo-600 text-white px-2.5 py-1 rounded-lg text-[11px] font-medium transition">🎸 Cifra</button>`
                    : '';
                const btnYt = (linkYoutubeFinal && canVerYoutube)
                    ? `<button onclick="playYoutubeAudio('${nomeMusica.replace(/'/g, "\\'")}', '${linkYoutubeFinal}')" class="bg-red-600 hover:bg-red-500 text-white px-2.5 py-1 rounded-lg text-[11px] font-medium transition">📺 YouTube</button>`
                    : '';
                const btnPlayVs = (vs && canVerVs)
                    ? `<button onclick="playDriveAudio('${nomeMusica.replace(/'/g, "\\'")}', '${fileId}')" class="bg-brand-600 hover:bg-brand-500 text-white px-2.5 py-1 rounded-lg text-[11px] font-medium transition">▶ VS</button>`
                    : '';

                musicasHtml += `
                    <div class="py-2.5 flex items-center justify-between border-b border-slate-700/40 last:border-0 hover:bg-slate-750 px-4 transition text-xs">
                        <div>
                            <span class="font-bold text-white">${nomeMusica}</span>
                            ${artist ? `<span class="text-[10px] text-slate-400 ml-1">(${artist})</span>` : ''}
                            <div class="flex items-center gap-1.5 mt-0.5 text-[10px] text-slate-400">
                                ${tom ? `<span class="text-brand-300 font-semibold">Tom: ${tom}</span>` : ''}
                                ${cantoresMusica ? `<span>• 🎤 ${cantoresMusica}</span>` : ''}
                            </div>
                        </div>
                        <div class="flex items-center gap-1">
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
                <div class="border border-slate-700/70 rounded-xl overflow-hidden bg-slate-900/60 mb-2.5 transition hover:border-slate-600 shadow-sm">
                    <div onclick="toggleHistoricoCultoCard('${service.id}')" 
                        class="flex items-center justify-between p-3.5 cursor-pointer hover:bg-slate-800/60 transition select-none flex-wrap gap-2.5">
                        <div class="flex items-center gap-3 min-w-0 flex-1">
                            <span id="seta-hist-${service.id}" class="text-slate-400 text-xs font-bold transition-transform shrink-0">▼</span>
                            <div class="min-w-0 flex items-center gap-2 flex-wrap">
                                <span class="font-bold text-slate-200 text-xs uppercase truncate">${titulo}</span>
                                <span class="text-[10px] text-slate-400 font-semibold bg-slate-950 px-2 py-0.5 rounded-full border border-slate-800">${dataFormatada}</span>
                                <span class="text-[10px] text-brand-400 font-bold bg-brand-950/80 px-2 py-0.5 rounded-full border border-brand-800/80">🎵 ${totalMusicas} ${totalMusicas === 1 ? 'música' : 'músicas'}</span>
                            </div>
                        </div>
                        <div class="flex items-center gap-2 shrink-0">
                            ${totalMusicas > 0 ? `
                                <button type="button" onclick="event.stopPropagation(); abrirModalCopiarPlaylist('${service.id}')" 
                                    class="bg-brand-600 hover:bg-brand-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition shadow-sm flex items-center gap-1.5 cursor-pointer">
                                    <span>📋</span> Copiar Playlist
                                </button>
                            ` : ''}
                        </div>
                    </div>
                    
                    <div id="content-hist-${service.id}" class="hidden border-t border-slate-800/80 p-3.5 bg-slate-950/40 space-y-3">
                        ${linhaMidias}
                        ${linhaInstrumentos}
                        <div class="divide-y divide-slate-800/60 bg-slate-900/70 rounded-xl border border-slate-800/80 overflow-hidden">
                            ${musicasHtml || '<p class="text-center text-slate-500 py-3 text-[11px]">Nenhuma música cadastrada neste culto.</p>'}
                        </div>
                        ${totalMusicas > 0 ? `
                            <div class="flex justify-end pt-1">
                                <button type="button" onclick="abrirModalCopiarPlaylist('${service.id}')" 
                                    class="bg-slate-800 hover:bg-slate-700 text-brand-400 hover:text-brand-300 border border-slate-700 px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 cursor-pointer">
                                    <span>📋</span> Copiar esta Playlist para outro Culto
                                </button>
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
        });

        html += `
            <div class="bg-slate-800/80 border border-slate-700 rounded-2xl overflow-hidden shadow-md mb-3">
                <button onclick="toggleCultoBloco('${idAccordion}', '${idSeta}')" class="w-full flex items-center justify-between bg-slate-900/60 hover:bg-slate-900/80 border-b border-slate-700/50 px-4 py-2.5 transition text-left">
                    <h2 class="font-bold text-slate-300 text-sm uppercase tracking-wider">${mesAno}</h2>
                    <span id="${idSeta}" class="text-slate-400 text-xs">▼</span>
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



