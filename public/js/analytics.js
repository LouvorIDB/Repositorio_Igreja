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

        // Buscar cultos no banco para filtrar por data e church_id
        let queryServices = supabaseClient.from('services').select('id, date, church_id');
        if (currentChurchId) {
            queryServices = queryServices.eq('church_id', currentChurchId);
        }
        const { data: rawServices } = await queryServices;

        const servicesFiltrados = (rawServices || []).filter(s => {
            if (!s.date) return true;
            const dOnly = s.date.split('T')[0];
            if (dataInicioStr && dOnly < dataInicioStr) return false;
            if (dataFimStr && dOnly > dataFimStr) return false;
            return true;
        });

        const validServiceIds = servicesFiltrados.map(s => s.id);
        const totalCultos = servicesFiltrados.length;

        // Atualizar KPIs Base
        const totalRepertorio = (window.dadosGlobais?.repertorio || []).length;
        let listaVoluntariosBase = window.dadosGlobais?.voluntarios || [];
        if (roleUsuario === 'lider' && ministeriosQueLidera.length > 0) {
            listaVoluntariosBase = listaVoluntariosBase.filter(v => {
                const vMinIds = typeof obterIdsMinisteriosDoUsuario === 'function' ? obterIdsMinisteriosDoUsuario(v) : [v.ministry_id];
                return vMinIds.some(id => ministeriosQueLidera.includes(id));
            });
        }
        const totalVoluntarios = listaVoluntariosBase.length;

        const elTotalCultos = document.getElementById('kpi-total-cultos');
        const elRepertorioAtivo = document.getElementById('kpi-repertorio-ativo');
        const elTotalVoluntarios = document.getElementById('kpi-total-voluntarios');

        if (elTotalCultos) elTotalCultos.textContent = totalCultos;
        if (elRepertorioAtivo) elRepertorioAtivo.textContent = totalRepertorio;
        if (elTotalVoluntarios) elTotalVoluntarios.textContent = totalVoluntarios;

        // 3. Buscar e filtrar dados de Músicas (service_songs)
        let topMusicas = [];
        let totalExecucoes = 0;

        if (!isLiderNaoLouvor) {
            let querySongs = supabaseClient.from('service_songs').select('*, song_versions(songs(title))');
            const { data: serviceSongsData } = await querySongs;

            const songsFiltradas = (serviceSongsData || []).filter(ss => validServiceIds.includes(ss.service_id));
            const musicasContador = {};

            songsFiltradas.forEach(item => {
                const title = item.song_versions?.songs?.title || item.song_name || item.title || 'Música';
                musicasContador[title] = (musicasContador[title] || 0) + 1;
                totalExecucoes++;
            });

            todasMusicasExecutadas = Object.entries(musicasContador)
                .sort((a, b) => b[1] - a[1]);

            topMusicas = todasMusicasExecutadas.slice(0, 5);
        }

        const elTotalMusicasTocadas = document.getElementById('kpi-total-musicas-tocadas');
        if (elTotalMusicasTocadas) elTotalMusicasTocadas.textContent = totalExecucoes;

        // 4. Buscar e filtrar dados de Escalas (service_scales)
        let queryScales = supabaseClient.from('service_scales').select('*, profiles(id, name, ministry_id), ministry_roles(id, name, ministry_id)');
        const { data: serviceScalesData } = await queryScales;

        const todosVoluntarios = window.dadosGlobais?.voluntarios || [];
        const todosMinisterios = window.dadosGlobais?.ministries || [];

        const scalesFiltradas = (serviceScalesData || []).filter(sc => {
            if (!validServiceIds.includes(sc.service_id)) return false;
            
            if (roleUsuario === 'lider' && ministeriosQueLidera.length > 0) {
                // Identifica se a função/cargo pertence aos ministérios liderados
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

        const topVoluntarios = Object.entries(voluntariosContador)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);

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

function renderizarListaMusicasAnalyticsModal(lista) {
    const container = document.getElementById('container-lista-musicas-analytics');
    const subtitulo = document.getElementById('subtitulo-todas-musicas-analytics');
    if (!container) return;

    if (subtitulo) {
        subtitulo.textContent = `${todasMusicasExecutadas.length} músicas diferentes executadas no período`;
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
        const rank = idx + 1;

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

        return `
            <div class="flex items-center justify-between p-3 sm:p-3.5 bg-slate-50 dark:bg-night-950/80 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 hover:border-brand-500/40 transition gap-3 shadow-xs">
                <div class="flex items-center gap-3 min-w-0">
                    <span class="text-xs font-mono px-2 py-0.5 rounded-lg border shrink-0 flex items-center gap-1 ${badgeCor}">
                        ${medalhaIcon}#${rank}
                    </span>
                    <span class="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">${title}</span>
                </div>
                <span class="text-xs font-mono font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-xl border border-amber-500/20 shrink-0">
                    ${count} ${count === 1 ? 'culto' : 'cultos'}
                </span>
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
