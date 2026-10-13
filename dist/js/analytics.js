/**
 * analytics.js - Módulo de Inteligência de Dados, Métricas e Gráficos do Liturge
 */

let chartTopMusicasInstance = null;
let chartTopVoluntariosInstance = null;
let todasMusicasExecutadas = [];
let periodoAtivoAnalytics = 30;

function atualizarPilulasPeriodoAnalytics(opcao) {
    periodoAtivoAnalytics = opcao;
    const botoes = {
        30: document.getElementById('btn-periodo-30d'),
        'mes': document.getElementById('btn-periodo-mes'),
        'ano': document.getElementById('btn-periodo-ano'),
        'tudo': document.getElementById('btn-periodo-tudo'),
        'custom': document.getElementById('btn-periodo-custom')
    };

    const badgePeriodo = document.getElementById('badge-periodo-atual-analytics');
    const textosBadge = {
        30: 'Últimos 30 Dias',
        'mes': 'Este Mês',
        'ano': 'Este Ano',
        'tudo': 'Todo o Histórico',
        'custom': 'Intervalo Personalizado'
    };

    if (badgePeriodo && textosBadge[opcao]) {
        badgePeriodo.textContent = textosBadge[opcao];
    }

    const classeAtiva = "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm border border-slate-200 dark:border-slate-700 font-bold";
    const classeInativa = "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-transparent font-medium";

    Object.keys(botoes).forEach(key => {
        const btn = botoes[key];
        if (!btn) return;
        btn.className = `px-2.5 sm:px-3 py-1.5 rounded-lg text-xs transition flex items-center gap-1 cursor-pointer ${key == opcao ? classeAtiva : classeInativa}`;
    });
}

function alternarPainelDatasCustomizadasAnalytics() {
    const painel = document.getElementById('painel-datas-custom-analytics');
    if (!painel) return;
    const estaOculto = painel.classList.contains('hidden');
    if (estaOculto) {
        painel.classList.remove('hidden');
        atualizarPilulasPeriodoAnalytics('custom');
    } else {
        painel.classList.add('hidden');
    }
}

function aplicarFiltroCustomizadoAnalytics() {
    atualizarPilulasPeriodoAnalytics('custom');
    carregarAnalytics();
}

function definirAtalhoPeriodoAnalytics(opcao) {
    const elInicio = document.getElementById('analytics-data-inicio');
    const elFim = document.getElementById('analytics-data-fim');
    const painelCustom = document.getElementById('painel-datas-custom-analytics');
    if (painelCustom) painelCustom.classList.add('hidden');

    if (!elInicio || !elFim) return;

    const hoje = new Date();
    elFim.value = hoje.toISOString().split('T')[0];

    if (opcao === 30) {
        const inicio = new Date();
        inicio.setDate(hoje.getDate() - 30);
        elInicio.value = inicio.toISOString().split('T')[0];
    } else if (opcao === 'mes') {
        const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
        elInicio.value = inicio.toISOString().split('T')[0];
    } else if (opcao === 'ano') {
        const inicio = new Date(hoje.getFullYear(), 0, 1);
        elInicio.value = inicio.toISOString().split('T')[0];
    }

    atualizarPilulasPeriodoAnalytics(opcao);
    carregarAnalytics();
}

function limparFiltroPeriodoAnalytics() {
    const elInicio = document.getElementById('analytics-data-inicio');
    const elFim = document.getElementById('analytics-data-fim');
    const painelCustom = document.getElementById('painel-datas-custom-analytics');
    if (painelCustom) painelCustom.classList.add('hidden');

    if (elInicio) elInicio.value = '';
    if (elFim) elFim.value = '';

    atualizarPilulasPeriodoAnalytics('tudo');
    carregarAnalytics();
}

async function carregarAnalytics() {
    if (!supabaseClient) return;

    // 1. Guarda de Acesso: Apenas Líderes e Admins
    const userToEvaluate = modoSimulacaoPerfil || usuarioLogado;
    const roleUsuario = userToEvaluate ? (userToEvaluate.system_role || userToEvaluate.role || 'membro') : 'visitante';

    if (roleUsuario !== 'admin' && roleUsuario !== 'lider') {
        const sec = document.getElementById('secao-analytics');
        if (sec) sec.classList.add('hidden');
        if (typeof mostrarToast === 'function') {
            mostrarToast('Acesso negado: O módulo de Analytics é exclusivo para Líderes e Administradores.', 'aviso');
        }
        return;
    }

    // Inicialização padrão de datas se vazias (30 dias)
    const elInicio = document.getElementById('analytics-data-inicio');
    const elFim = document.getElementById('analytics-data-fim');
    if (elInicio && elFim && !elInicio.value && !elFim.value && periodoAtivoAnalytics === 30) {
        const hoje = new Date();
        elFim.value = hoje.toISOString().split('T')[0];
        const inicio = new Date();
        inicio.setDate(hoje.getDate() - 30);
        elInicio.value = inicio.toISOString().split('T')[0];
        atualizarPilulasPeriodoAnalytics(30);
    }

    try {
        const currentChurchId = userToEvaluate?.church_id || window.dadosGlobais?.church?.id || null;
        const ministeriosQueLidera = typeof obterIdsMinisteriosQueLidera === 'function' ? obterIdsMinisteriosQueLidera(userToEvaluate) : (userToEvaluate?.ministry_id ? [userToEvaluate.ministry_id] : []);
        
        let minDoUsuario = null;
        if (ministeriosQueLidera.length > 0 && window.dadosGlobais?.ministries) {
            minDoUsuario = window.dadosGlobais.ministries.find(m => ministeriosQueLidera.includes(m.id));
        }

        const isLiderNaoLouvor = (roleUsuario === 'lider') && minDoUsuario && !minDoUsuario.name.toLowerCase().includes('louvor') && !minDoUsuario.name.toLowerCase().includes('musica');

        // Ajustar visualização dos cards e gráficos para ministérios não-louvor (ex: Mídia)
        const kpiMusicasEl = document.getElementById('kpi-card-musicas');
        const kpiRepertorioEl = document.getElementById('kpi-card-repertorio');
        const cardChartMusicasEl = document.getElementById('card-analytics-musicas');
        const tituloVoluntariosEl = document.getElementById('titulo-chart-voluntarios');

        if (isLiderNaoLouvor) {
            if (kpiMusicasEl) kpiMusicasEl.classList.add('hidden');
            if (kpiRepertorioEl) kpiRepertorioEl.classList.add('hidden');
            if (cardChartMusicasEl) cardChartMusicasEl.classList.add('hidden');
            if (tituloVoluntariosEl) {
                tituloVoluntariosEl.innerHTML = `<span class="text-emerald-500">🎥</span> Frequência da Equipe — ${minDoUsuario ? minDoUsuario.name : 'Ministério'}`;
            }
        } else {
            if (kpiMusicasEl) kpiMusicasEl.classList.remove('hidden');
            if (kpiRepertorioEl) kpiRepertorioEl.classList.remove('hidden');
            if (cardChartMusicasEl) cardChartMusicasEl.classList.remove('hidden');
            if (tituloVoluntariosEl) {
                tituloVoluntariosEl.innerHTML = `<span class="text-emerald-500">🎸</span> Voluntários Mais Escalados`;
            }
        }

        // 2. Filtros de Intervalo de Datas
        const dataInicioStr = document.getElementById('analytics-data-inicio')?.value || '';
        const dataFimStr = document.getElementById('analytics-data-fim')?.value || '';

        // Buscar cultos (services) no Supabase ou no cache global
        let rawServices = [];
        try {
            let queryServices = supabaseClient.from('services').select('id, date, title, notes, church_id');
            if (currentChurchId) {
                queryServices = queryServices.eq('church_id', currentChurchId);
            }
            const { data: sData, error: sErr } = await queryServices;
            if (!sErr && Array.isArray(sData) && sData.length > 0) {
                rawServices = sData;
            } else if (sErr) {
                console.warn('Erro ao consultar services via Supabase:', sErr);
            }
        } catch (eServ) {
            console.warn('Erro de conexão ao buscar services:', eServ);
        }

        // Fallback robusto para dadosGlobais caso a query retorne vazia ou falhe
        if (!rawServices || rawServices.length === 0) {
            const cachedList = window.dadosGlobais?.servicesDataList || window.dadosGlobais?.services || [];
            if (Array.isArray(cachedList) && cachedList.length > 0) {
                rawServices = cachedList;
            }
        }

        // Filtrar cultos por data
        const servicesFiltrados = (rawServices || []).filter(s => {
            if (!s.date) return true;
            let dOnly = '';
            if (s.date.includes('T')) {
                dOnly = s.date.split('T')[0];
            } else if (s.date.includes('/')) {
                const partes = s.date.split('/');
                if (partes.length === 3) {
                    dOnly = `${partes[2]}-${partes[1].padStart(2, '0')}-${partes[0].padStart(2, '0')}`;
                } else if (partes.length === 2) {
                    const anoAtual = new Date().getFullYear();
                    dOnly = `${anoAtual}-${partes[1].padStart(2, '0')}-${partes[0].padStart(2, '0')}`;
                }
            } else {
                dOnly = s.date.substring(0, 10);
            }
            if (dataInicioStr && dOnly && dOnly < dataInicioStr) return false;
            if (dataFimStr && dOnly && dOnly > dataFimStr) return false;
            return true;
        });

        const validServiceIds = servicesFiltrados.map(s => s.id);
        let totalCultos = servicesFiltrados.length;
        const servicesMap = {};
        servicesFiltrados.forEach(s => {
            servicesMap[s.id] = s;
        });

        // Filtrar cultos processados (window.cultosProcessados) para fallback completo
        let cultosProcessadosFiltrados = [];
        if (Array.isArray(window.cultosProcessados) && window.cultosProcessados.length > 0) {
            const anoAtual = new Date().getFullYear();
            cultosProcessadosFiltrados = window.cultosProcessados.filter(c => {
                if (c.oculto) return false;
                let cIso = '';
                if (c.dataStr && c.dataStr.includes('/')) {
                    const [d, m] = c.dataStr.split('/');
                    cIso = `${anoAtual}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                }
                if (dataInicioStr && cIso && cIso < dataInicioStr) return false;
                if (dataFimStr && cIso && cIso > dataFimStr) return false;
                return true;
            });

            if (totalCultos === 0) {
                totalCultos = cultosProcessadosFiltrados.length;
            }
        }

        // Atualizar KPIs Base
        const totalRepertorio = (window.dadosGlobais?.repertorio || window.dadosGlobais?.banco || []).length;
        let listaVoluntariosBase = window.dadosGlobais?.voluntarios || [];
        if (roleUsuario === 'lider' && ministeriosQueLidera.length > 0) {
            listaVoluntariosBase = listaVoluntariosBase.filter(v => {
                const vMinIds = typeof obterIdsMinisteriosDoUsuario === 'function' ? obterIdsMinisteriosDoUsuario(v) : [v.ministry_id];
                return vMinIds.some(id => ministeriosQueLidera.includes(id));
            });
        }
        const totalVoluntariosCadastrados = listaVoluntariosBase.length;

        // 3. Buscar dados de Escalas (service_scales)
        let serviceScalesData = [];
        try {
            let queryScales = supabaseClient.from('service_scales').select('*, profiles(id, name, ministry_id), ministry_roles(id, name, ministry_id)');
            const { data: scData, error: scErr } = await queryScales;
            if (!scErr && Array.isArray(scData) && scData.length > 0) {
                serviceScalesData = scData;
            } else if (scErr) {
                console.warn('Erro ao consultar service_scales via Supabase:', scErr);
            }
        } catch (eScales) {
            console.warn('Erro de conexão ao buscar service_scales:', eScales);
        }

        // Fallback: se serviceScalesData vazio, extrair das escalas aninhadas em rawServices ou dadosGlobais.services
        if (!serviceScalesData || serviceScalesData.length === 0) {
            const sourceServices = (window.dadosGlobais?.servicesDataList || window.dadosGlobais?.services || rawServices || []);
            sourceServices.forEach(s => {
                if (s.service_scales && Array.isArray(s.service_scales)) {
                    s.service_scales.forEach(sc => {
                        serviceScalesData.push({
                            ...sc,
                            service_id: sc.service_id || s.id
                        });
                    });
                }
            });
        }

        const scalesByServiceId = {};
        (serviceScalesData || []).forEach(sc => {
            const sid = sc.service_id;
            if (sid) {
                if (!scalesByServiceId[sid]) {
                    scalesByServiceId[sid] = [];
                }
                scalesByServiceId[sid].push(sc);
            }
        });

        // 4. Buscar e filtrar dados de Músicas (service_songs)
        let topMusicas = [];
        let totalExecucoes = 0;
        const musicasMap = {};

        if (!isLiderNaoLouvor) {
            let serviceSongsData = [];
            try {
                let querySongs = supabaseClient.from('service_songs').select('*, song_versions(songs(title))');
                const { data: ssData, error: ssErr } = await querySongs;
                if (!ssErr && Array.isArray(ssData) && ssData.length > 0) {
                    serviceSongsData = ssData;
                } else if (ssErr) {
                    console.warn('Erro ao consultar service_songs via Supabase:', ssErr);
                }
            } catch (eSongs) {
                console.warn('Erro de conexão ao buscar service_songs:', eSongs);
            }

            // Fallback: se serviceSongsData vazio, extrair das musicas aninhadas em rawServices ou dadosGlobais.services
            if (!serviceSongsData || serviceSongsData.length === 0) {
                const sourceServices = (window.dadosGlobais?.servicesDataList || window.dadosGlobais?.services || rawServices || []);
                sourceServices.forEach(s => {
                    if (s.service_songs && Array.isArray(s.service_songs)) {
                        s.service_songs.forEach(ss => {
                            serviceSongsData.push({
                                ...ss,
                                service_id: ss.service_id || s.id
                            });
                        });
                    }
                });
            }

            const songsFiltradas = (serviceSongsData || []).filter(ss => validServiceIds.includes(ss.service_id));

            songsFiltradas.forEach(item => {
                const title = item.song_versions?.songs?.title || item.song_versions?.title || item.song_name || item.title || 'Música';
                const tomTocado = item.key || item.tom || item.song_versions?.key || '';
                const serviceId = item.service_id;
                const s = servicesMap[serviceId];

                if (!musicasMap[title]) {
                    musicasMap[title] = {
                        title: title,
                        count: 0,
                        execucoes: []
                    };
                }

                musicasMap[title].count++;
                totalExecucoes++;

                if (s) {
                    const scalesDoCulto = scalesByServiceId[serviceId] || [];
                    const cultoProcessado = (window.cultosProcessados || []).find(c => {
                        if (c.playlistId && String(c.playlistId) === String(serviceId)) return true;
                        if (s.date && c.dataStr) {
                            const sDOnly = s.date.split('T')[0];
                            const [sAno, sMes, sDia] = sDOnly.split('-');
                            if (c.dataStr.startsWith(`${sDia}/${sMes}`)) return true;
                        }
                        return false;
                    });

                    const escalaExtraida = extrairEscalaDoCulto(s, scalesDoCulto, cultoProcessado);

                    musicasMap[title].execucoes.push({
                        serviceId: serviceId,
                        date: s.date || '',
                        title: s.title || (cultoProcessado ? cultoProcessado.nome : 'Culto'),
                        diaSemana: cultoProcessado ? cultoProcessado.diaSemana : '',
                        tom: tomTocado,
                        escala: escalaExtraida
                    });
                }
            });

            // Fallback adicional: se totalExecucoes for 0 e existirem cultosProcessadosFiltrados
            if (totalExecucoes === 0 && cultosProcessadosFiltrados.length > 0) {
                const anoAtual = new Date().getFullYear();
                cultosProcessadosFiltrados.forEach(c => {
                    let cIso = '';
                    if (c.dataStr && c.dataStr.includes('/')) {
                        const [d, m] = c.dataStr.split('/');
                        cIso = `${anoAtual}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                    }
                    const cId = c.playlistId || c.id;
                    const escalaExtraida = extrairEscalaDoCulto(null, [], c);

                    (c.songs || []).forEach(sItem => {
                        const songName = sItem.musica || sItem.title || sItem.nome || '';
                        if (!songName) return;

                        if (!musicasMap[songName]) {
                            musicasMap[songName] = {
                                title: songName,
                                count: 0,
                                execucoes: []
                            };
                        }
                        musicasMap[songName].count++;
                        totalExecucoes++;

                        musicasMap[songName].execucoes.push({
                            serviceId: cId,
                            date: cIso || '',
                            title: c.nome || 'Culto',
                            diaSemana: c.diaSemana || '',
                            tom: sItem.tom || '',
                            escala: escalaExtraida
                        });
                    });
                });
            }

            // Ordenar execuções de cada música pela data mais recente
            Object.values(musicasMap).forEach(m => {
                m.execucoes.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
            });

            todasMusicasExecutadas = Object.values(musicasMap)
                .sort((a, b) => b.count - a.count)
                .map(m => [m.title, m.count, m.execucoes]);

            topMusicas = todasMusicasExecutadas.slice(0, 5);
        }

        const todosVoluntarios = window.dadosGlobais?.voluntarios || [];
        const todosMinisterios = window.dadosGlobais?.ministries || [];

        const scalesFiltradas = (serviceScalesData || []).filter(sc => {
            if (validServiceIds.length > 0 && !validServiceIds.includes(sc.service_id)) return false;
            
            if (roleUsuario === 'lider' && ministeriosQueLidera.length > 0) {
                const roleMinId = sc.ministry_roles ? sc.ministry_roles.ministry_id : null;
                const isRoleInLeaderMin = roleMinId ? ministeriosQueLidera.includes(roleMinId) : todosMinisterios.some(m => ministeriosQueLidera.includes(m.id) && (m.ministry_roles || []).some(r => r.id === sc.role_id));

                const pid = sc.user_id || sc.profile_id;
                const prof = sc.profiles || todosVoluntarios.find(v => v.id === pid);
                const profMinIds = typeof obterIdsMinisteriosDoUsuario === 'function' ? obterIdsMinisteriosDoUsuario(prof) : (prof?.ministry_id ? [prof.ministry_id] : []);
                const isProfInLeaderMin = profMinIds.some(id => ministeriosQueLidera.includes(id));

                if (!isRoleInLeaderMin && !isProfInLeaderMin) return false;
            }
            return true;
        });

        const voluntariosContador = {};
        scalesFiltradas.forEach(item => {
            const pid = item.user_id || item.profile_id;
            const prof = item.profiles || todosVoluntarios.find(v => v.id === pid);
            const name = prof ? (prof.name || prof.email) : (item.profile_name || 'Voluntário');
            voluntariosContador[name] = (voluntariosContador[name] || 0) + 1;
        });

        // Fallback para voluntários dos cultosProcessadosFiltrados se voluntariosContador vazio
        if (Object.keys(voluntariosContador).length === 0 && cultosProcessadosFiltrados.length > 0) {
            cultosProcessadosFiltrados.forEach(c => {
                const escalaCulto = extrairEscalaDoCulto(null, [], c);
                escalaCulto.forEach(esc => {
                    if (esc.name) {
                        voluntariosContador[esc.name] = (voluntariosContador[esc.name] || 0) + 1;
                    }
                });
            });
        }

        const topVoluntarios = Object.entries(voluntariosContador)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);

        // Atualizar contadores nos elementos de KPI
        const elTotalCultos = document.getElementById('kpi-total-cultos');
        const elRepertorioAtivo = document.getElementById('kpi-repertorio-ativo');
        const elTotalVoluntarios = document.getElementById('kpi-total-voluntarios');
        const elTotalMusicasTocadas = document.getElementById('kpi-total-musicas-tocadas');

        if (elTotalCultos) elTotalCultos.textContent = totalCultos;
        if (elRepertorioAtivo) elRepertorioAtivo.textContent = totalRepertorio;
        const totalVoluntariosEngajados = Object.keys(voluntariosContador).length;
        if (elTotalVoluntarios) elTotalVoluntarios.textContent = totalVoluntariosEngajados > 0 ? totalVoluntariosEngajados : totalVoluntariosCadastrados;
        if (elTotalMusicasTocadas) elTotalMusicasTocadas.textContent = totalExecucoes;

        // 5. Plotar Gráficos Chart.js
        if (!isLiderNaoLouvor) {
            renderizarGraficoTopMusicas(topMusicas);
        }
        renderizarGraficoTopVoluntarios(topVoluntarios);

    } catch (err) {
        console.warn('Aviso ao carregar analytics:', err);
    }
}

function renderizarGraficoTopMusicas(topMusicas) {
    const canvas = document.getElementById('chart-top-musicas');
    if (!canvas || typeof Chart === 'undefined') return;

    if (chartTopMusicasInstance) {
        chartTopMusicasInstance.destroy();
    }

    const isDark = document.documentElement.classList.contains('dark') || !document.documentElement.classList.contains('light');

    const labels = topMusicas.length > 0 ? topMusicas.map(m => m[0]) : ['Nenhuma música no período'];
    const dataValues = topMusicas.length > 0 ? topMusicas.map(m => m[1]) : [0];

    const ctx = canvas.getContext('2d');
    chartTopMusicasInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Vezes Ministrada',
                data: dataValues,
                backgroundColor: 'rgba(245, 158, 11, 0.85)',
                hoverBackgroundColor: 'rgba(217, 119, 6, 0.95)',
                borderColor: '#f59e0b',
                borderWidth: 1.5,
                borderRadius: 8,
                barThickness: 'flex',
                maxBarThickness: 28
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: isDark ? '#0f172a' : '#1e293b',
                    titleColor: '#ffffff',
                    bodyColor: '#f1f5f9',
                    padding: 10,
                    cornerRadius: 8,
                    callbacks: {
                        label: function(context) {
                            const val = context.parsed.x;
                            return ` ${val} ${val === 1 ? 'culto' : 'cultos'}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    ticks: {
                        color: isDark ? '#94a3b8' : '#64748b',
                        stepSize: 1,
                        precision: 0,
                        font: { family: 'Plus Jakarta Sans', size: 11 }
                    },
                    grid: {
                        color: isDark ? 'rgba(51, 65, 85, 0.25)' : 'rgba(226, 232, 240, 0.8)'
                    }
                },
                y: {
                    ticks: {
                        color: isDark ? '#f8fafc' : '#0f172a',
                        font: { family: 'Plus Jakarta Sans', weight: '600', size: 11 }
                    },
                    grid: { display: false }
                }
            }
        }
    });
}

function renderizarGraficoTopVoluntarios(topVoluntarios) {
    const canvas = document.getElementById('chart-top-voluntarios');
    if (!canvas || typeof Chart === 'undefined') return;

    if (chartTopVoluntariosInstance) {
        chartTopVoluntariosInstance.destroy();
    }

    const isDark = document.documentElement.classList.contains('dark') || !document.documentElement.classList.contains('light');

    const labels = topVoluntarios.length > 0 ? topVoluntarios.map(v => v[0]) : ['Sem escalas no período'];
    const dataValues = topVoluntarios.length > 0 ? topVoluntarios.map(v => v[1]) : [1];
    const colors = ['#f59e0b', '#10b981', '#38bdf8', '#818cf8', '#f43f5e'];

    const ctx = canvas.getContext('2d');
    chartTopVoluntariosInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: dataValues,
                backgroundColor: colors.slice(0, labels.length),
                borderColor: isDark ? '#0b0f19' : '#ffffff',
                borderWidth: 3,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '68%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: isDark ? '#cbd5e1' : '#475569',
                        font: { family: 'Plus Jakarta Sans', size: 11, weight: '500' },
                        boxWidth: 12,
                        padding: 14,
                        usePointStyle: true
                    }
                },
                tooltip: {
                    backgroundColor: isDark ? '#0f172a' : '#1e293b',
                    titleColor: '#ffffff',
                    bodyColor: '#f1f5f9',
                    padding: 10,
                    cornerRadius: 8,
                    callbacks: {
                        label: function(context) {
                            const val = context.raw;
                            return ` ${val} ${val === 1 ? 'escala' : 'escalas'}`;
                        }
                    }
                }
            }
        }
    });
}

// ===================== MODAL DE TODAS AS MÚSICAS MINISTRADAS =====================

function abrirModalTodasMusicasAnalytics() {
    const modal = document.getElementById('modal-todas-musicas-analytics');
    if (!modal) return;

    const inputBusca = document.getElementById('input-busca-musicas-analytics');
    if (inputBusca) inputBusca.value = '';

    renderizarListaMusicasAnalyticsModal(todasMusicasExecutadas);
    modal.classList.remove('hidden');
}

function fecharModalTodasMusicasAnalytics() {
    const modal = document.getElementById('modal-todas-musicas-analytics');
    if (modal) modal.classList.add('hidden');
}

// ===================== FUNÇÕES AUXILIARES DE ESCALA E DATA =====================

function extrairIconeFuncao(roleStr) {
    if (typeof window.extrairIconeFuncao === 'function') {
        return window.extrairIconeFuncao(roleStr);
    }
    const r = (roleStr || '').toLowerCase();
    if (r.includes('bateria')) return '🥁';
    if (r.includes('violao') || r.includes('violão') || r.includes('guitarra')) return '🎸';
    if (r.includes('baixo')) return '🎸';
    if (r.includes('teclado') || r.includes('piano')) return '🎹';
    if (r.includes('vocal') || r.includes('cantor') || r.includes('voz')) return '🎤';
    if (r.includes('midia') || r.includes('mídia') || r.includes('projec') || r.includes('slide')) return '💻';
    if (r.includes('som') || r.includes('audio') || r.includes('áudio') || r.includes('mesa')) return '🎛️';
    if (r.includes('pastor') || r.includes('pregad') || r.includes('bispo')) return '✝️';
    if (r.includes('recep') || r.includes('boas')) return '🤝';
    if (r.includes('kids') || r.includes('infantil')) return '🧒';
    return '👤';
}

function extrairEscalaDoCulto(service, scalesDoServico, cultoProcessado) {
    const escalaList = [];
    const jaAdicionados = new Set();

    // 1. Relacional service_scales (Fonte Primária moderna)
    if (scalesDoServico && scalesDoServico.length > 0) {
        scalesDoServico.forEach(sc => {
            const nomeVoluntario = sc.profiles ? sc.profiles.name : (sc.profile_name || '');
            const nomeFuncao = sc.ministry_roles ? sc.ministry_roles.name : (sc.role_name || '');
            if (nomeVoluntario) {
                const chave = `${nomeFuncao || 'Voluntário'}:${nomeVoluntario}`.toLowerCase();
                if (!jaAdicionados.has(chave)) {
                    jaAdicionados.add(chave);
                    escalaList.push({
                        role: nomeFuncao || 'Escalado',
                        name: nomeVoluntario,
                        icon: extrairIconeFuncao(nomeFuncao)
                    });
                }
            }
        });
    }

    // 2. Fallback de cultoProcessado (se disponível na memória do app)
    if (cultoProcessado && cultoProcessado.groupedEscala) {
        Object.values(cultoProcessado.groupedEscala).forEach(group => {
            if (group.cleanParts && Array.isArray(group.cleanParts)) {
                group.cleanParts.forEach(part => {
                    const [rolePart, namePart] = part.split(':').map(s => s.trim());
                    if (namePart) {
                        const nomes = namePart.split(',').map(s => s.trim()).filter(Boolean);
                        nomes.forEach(n => {
                            const chave = `${rolePart || 'Escalado'}:${n}`.toLowerCase();
                            if (!jaAdicionados.has(chave)) {
                                jaAdicionados.add(chave);
                                escalaList.push({
                                    role: rolePart || 'Escalado',
                                    name: n,
                                    icon: extrairIconeFuncao(rolePart)
                                });
                            }
                        });
                    }
                });
            }
        });
    }

    // 3. Fallback de service.notes (JSON legado)
    if (service && service.notes) {
        try {
            const parsed = typeof service.notes === 'string' ? JSON.parse(service.notes) : service.notes;
            if (parsed.escala && typeof parsed.escala === 'object') {
                Object.entries(parsed.escala).forEach(([papel, nome]) => {
                    if (nome) {
                        const chave = `${papel}:${nome}`.toLowerCase();
                        if (!jaAdicionados.has(chave)) {
                            jaAdicionados.add(chave);
                            escalaList.push({
                                role: papel.charAt(0).toUpperCase() + papel.slice(1),
                                name: String(nome),
                                icon: extrairIconeFuncao(papel)
                            });
                        }
                    }
                });
            }
            if (parsed.cantores && Array.isArray(parsed.cantores)) {
                parsed.cantores.forEach(c => {
                    if (c) {
                        const chave = `vocalista:${c}`.toLowerCase();
                        if (!jaAdicionados.has(chave)) {
                            jaAdicionados.add(chave);
                            escalaList.push({
                                role: 'Vocalista',
                                name: String(c),
                                icon: '🎤'
                            });
                        }
                    }
                });
            }
        } catch(e) {}
    }

    // 4. Fallback de service.singers_list ou service.singers
    if (service && (service.singers_list || service.singers)) {
        const rawSingers = (service.singers_list || service.singers).split(',').map(s => s.trim()).filter(Boolean);
        rawSingers.forEach(c => {
            const chave = `vocalista:${c}`.toLowerCase();
            if (!jaAdicionados.has(chave)) {
                jaAdicionados.add(chave);
                escalaList.push({
                    role: 'Vocalista',
                    name: c,
                    icon: '🎤'
                });
            }
        });
    }

    return escalaList;
}

function formatarDataCultoExecucao(dateStr, title, diaSemanaFallback) {
    let textoData = '';
    let diaSemana = diaSemanaFallback || '';

    if (dateStr) {
        const dClean = dateStr.split('T')[0];
        const partes = dClean.split('-');
        if (partes.length === 3) {
            const ano = parseInt(partes[0], 10);
            const mes = parseInt(partes[1], 10);
            const dia = parseInt(partes[2], 10);
            if (!isNaN(ano) && !isNaN(mes) && !isNaN(dia)) {
                const dObj = new Date(ano, mes - 1, dia);
                const diasSemana = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
                diaSemana = diasSemana[dObj.getDay()] || diaSemana;
                textoData = `${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}/${ano}`;
            }
        }
    }

    if (textoData && diaSemana) {
        return `${textoData} • ${diaSemana}${title ? ` (${title})` : ''}`;
    } else if (textoData) {
        return `${textoData}${title ? ` • ${title}` : ''}`;
    }
    return title || 'Culto';
}

function toggleAcordeaoMusicaAnalytics(accId) {
    const panel = document.getElementById(`panel-${accId}`);
    const chevron = document.getElementById(`chevron-${accId}`);
    const btn = document.getElementById(`btn-acc-${accId}`);
    if (!panel) return;

    const isHidden = panel.classList.contains('hidden');

    if (isHidden) {
        panel.classList.remove('hidden');
        if (chevron) chevron.classList.add('rotate-180');
        if (btn) btn.setAttribute('aria-expanded', 'true');
    } else {
        panel.classList.add('hidden');
        if (chevron) chevron.classList.remove('rotate-180');
        if (btn) btn.setAttribute('aria-expanded', 'false');
    }
}

function renderizarListaMusicasAnalyticsModal(lista) {
    const container = document.getElementById('container-lista-musicas-analytics');
    const subtitulo = document.getElementById('subtitulo-todas-musicas-analytics');
    if (!container) return;

    if (subtitulo) {
        subtitulo.textContent = `${todasMusicasExecutadas.length} músicas diferentes executadas • Toque para ver datas e escalas`;
    }

    if (!lista || lista.length === 0) {
        container.innerHTML = `
            <div class="py-10 text-center space-y-2">
                <span class="text-3xl opacity-40">🎵</span>
                <p class="text-xs text-slate-500 italic">Nenhuma música encontrada no período.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = lista.map((item, idx) => {
        const title = item[0];
        const count = item[1];
        const execucoes = item[2] || [];
        const rank = idx + 1;
        const accId = `acc-musica-${idx}`;

        let badgeCor = 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800';
        let medalhaIcon = '';

        if (rank === 1) {
            badgeCor = 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/40 font-black';
            medalhaIcon = '🥇 ';
        } else if (rank === 2) {
            badgeCor = 'bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700 font-black';
            medalhaIcon = '🥈 ';
        } else if (rank === 3) {
            badgeCor = 'bg-amber-800/15 text-amber-700 dark:text-amber-500 border-amber-700/30 font-black';
            medalhaIcon = '🥉 ';
        }

        // Renderização detalhada dos dias e das escalas dentro do acordeão
        let htmlExecucoes = '';
        if (execucoes.length === 0) {
            htmlExecucoes = `
                <div class="p-3 rounded-xl bg-slate-100/50 dark:bg-night-950/50 border border-slate-200/50 dark:border-slate-800/50 text-center">
                    <p class="text-xs text-slate-400 italic">Histórico detalhado de cultos não registrado para esta música no período.</p>
                </div>
            `;
        } else {
            htmlExecucoes = execucoes.map(ex => {
                const dataFormatada = formatarDataCultoExecucao(ex.date, ex.title, ex.diaSemana);
                
                // Badges da escala
                let htmlEscala = '';
                if (ex.escala && ex.escala.length > 0) {
                    htmlEscala = `
                        <div class="flex flex-wrap gap-1.5 pt-1">
                            ${ex.escala.map(esc => `
                                <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-200/90 dark:border-slate-800 shadow-2xs">
                                    <span>${esc.icon || '👤'}</span>
                                    <span class="text-slate-400 dark:text-slate-500 font-normal">${esc.role}:</span>
                                    <span class="font-bold text-slate-900 dark:text-white">${esc.name}</span>
                                </span>
                            `).join('')}
                        </div>
                    `;
                } else {
                    htmlEscala = `
                        <p class="text-[11px] text-slate-400 italic pt-0.5">Sem voluntários registrados na escala deste dia.</p>
                    `;
                }

                return `
                    <div class="p-3 rounded-xl bg-slate-100/80 dark:bg-night-950/90 border border-slate-200/80 dark:border-slate-800/80 space-y-2 transition">
                        <div class="flex items-center justify-between flex-wrap gap-2 pb-1.5 border-b border-slate-200/60 dark:border-slate-800/60">
                            <div class="flex items-center gap-2">
                                <span class="w-6 h-6 rounded-md bg-brand-500/15 text-brand-600 dark:text-brand-400 flex items-center justify-center text-xs">📅</span>
                                <span class="text-xs font-bold text-slate-900 dark:text-white">${dataFormatada}</span>
                            </div>
                            ${ex.tom ? `<span class="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">Tom: ${ex.tom}</span>` : ''}
                        </div>
                        <div>
                            <p class="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500 mb-1 flex items-center gap-1">
                                <span>👥</span> Equipe Escalada:
                            </p>
                            ${htmlEscala}
                        </div>
                    </div>
                `;
            }).join('');
        }

        return `
            <div class="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-slate-50 dark:bg-night-950/80 overflow-hidden shadow-xs transition hover:border-brand-500/40">
                <!-- CABEÇALHO DO ACORDEÃO (CLICÁVEL) -->
                <button type="button"
                    onclick="toggleAcordeaoMusicaAnalytics('${accId}')"
                    class="w-full flex items-center justify-between p-3 sm:p-3.5 text-left cursor-pointer transition select-none hover:bg-slate-100/60 dark:hover:bg-slate-800/40 gap-3"
                    aria-expanded="false"
                    id="btn-acc-${accId}">
                    
                    <div class="flex items-center gap-3 min-w-0">
                        <span class="text-xs font-mono px-2 py-0.5 rounded-lg border shrink-0 flex items-center gap-1 ${badgeCor}">
                            ${medalhaIcon}#${rank}
                        </span>
                        <div class="min-w-0">
                            <span class="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate block">${title}</span>
                            <span class="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Toque para ver cultos e escalas</span>
                        </div>
                    </div>

                    <div class="flex items-center gap-2 shrink-0">
                        <span class="text-xs font-mono font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-xl border border-amber-500/20">
                            ${count} ${count === 1 ? 'culto' : 'cultos'}
                        </span>
                        <div id="chevron-${accId}" class="w-6 h-6 rounded-lg bg-slate-200/70 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center transition-transform duration-200">
                            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="6 9 12 15 18 9"></polyline>
                            </svg>
                        </div>
                    </div>
                </button>

                <!-- CORPO DO ACORDEÃO (PAINEL EXPANSÍVEL) -->
                <div id="panel-${accId}" class="hidden border-t border-slate-200/60 dark:border-slate-800/60 bg-white/60 dark:bg-night-900/60 p-3 sm:p-4 space-y-2.5">
                    ${htmlExecucoes}
                </div>
            </div>
        `;
    }).join('');
}

function filtrarMusicasAnalyticsModal(query) {
    const term = (query || '').toLowerCase().trim();
    if (!term) {
        renderizarListaMusicasAnalyticsModal(todasMusicasExecutadas);
        return;
    }
    const filtradas = todasMusicasExecutadas.filter(m => m[0].toLowerCase().includes(term));
    renderizarListaMusicasAnalyticsModal(filtradas);
}

// Tornar funções acessíveis globalmente no escopo de window
window.carregarAnalytics = carregarAnalytics;
window.definirAtalhoPeriodoAnalytics = definirAtalhoPeriodoAnalytics;
window.limparFiltroPeriodoAnalytics = limparFiltroPeriodoAnalytics;
window.alternarPainelDatasCustomizadasAnalytics = alternarPainelDatasCustomizadasAnalytics;
window.aplicarFiltroCustomizadoAnalytics = aplicarFiltroCustomizadoAnalytics;
window.abrirModalTodasMusicasAnalytics = abrirModalTodasMusicasAnalytics;
window.fecharModalTodasMusicasAnalytics = fecharModalTodasMusicasAnalytics;
window.filtrarMusicasAnalyticsModal = filtrarMusicasAnalyticsModal;
window.toggleAcordeaoMusicaAnalytics = toggleAcordeaoMusicaAnalytics;
